import copy
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from app import OrderApi

class OrdersTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "orders.db"
        self.catalog = Path(__file__).resolve().parents[1] / "catalog.json"
        self.api = OrderApi(self.db, self.catalog, ["https://shop.example"], rate_limit=100)
        self.payload = {
            "items": [{"code":"85/04","size":"M","qty":1},{"code":"85/31","qty":1},{"code":"5T15","qty":1}],
            "customer":{"name":"Test Buyer","phone":"+79001234567","city":"Test City",
                        "consents":{"personal_data":True,"offer":True,"marketing":False}},
            "delivery":{"method":"pickup","address":"Test pickup 1"},"source":"test"}
        self.key = "test-key-123456789"
    def tearDown(self):
        self.temp.cleanup()
    def request(self, payload=None, origin="https://shop.example", method="POST",
                route="/orders", raw=None, length=None):
        body = raw if raw is not None else json.dumps(self.payload if payload is None else payload).encode()
        env = {"REQUEST_METHOD":method,"PATH_INFO":route,"CONTENT_TYPE":"application/json",
               "CONTENT_LENGTH":str(len(body) if length is None else length),
               "wsgi.input":BytesIO(body),"REMOTE_ADDR":"127.0.0.1",
               "HTTP_ORIGIN":origin,"HTTP_IDEMPOTENCY_KEY":self.key}
        result = {}
        def start(status, headers):
            result.update(status=int(status[:3]), headers=dict(headers))
        result["body"] = json.loads(b"".join(self.api(env,start)))
        return result
    def test_durable_retry_and_delivery(self):
        first = self.request()
        self.assertEqual(first["status"],201)
        self.assertEqual(first["body"]["total"],62200)
        self.api = OrderApi(self.db,self.catalog,["https://shop.example"],rate_limit=100)
        again = self.request()
        self.assertEqual(again["status"],200)
        self.assertEqual(first["body"],again["body"])
        with sqlite3.connect(self.db) as conn:
            value=json.loads(conn.execute("SELECT payload FROM orders").fetchone()[0])
        conn.close()
        self.assertEqual(value["delivery"],self.payload["delivery"])
    def test_concurrent_key_creates_once(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda _:self.api.create_order(self.payload,self.key),range(16)))
        self.assertEqual(len({r[0]["order_id"] for r in results}),1)
        self.assertEqual(sum(r[1] for r in results),1)
    def test_conflict(self):
        self.request()
        changed=copy.deepcopy(self.payload); changed["items"][0]["qty"]=2
        self.assertEqual(self.request(changed)["status"],409)
    def test_price_tampering(self):
        changed=copy.deepcopy(self.payload); changed["items"][0]["price"]=1;changed["total"]=1
        self.assertEqual(self.request(changed)["body"]["total"],62200)
    def test_invalid_sku_size_quantity_consent(self):
        for field,value in [("code","unknown"),("size",""),("qty",True),("size",["M"])]:
            with self.subTest(field=field,value=value):
                changed=copy.deepcopy(self.payload);changed["items"][0][field]=value
                self.assertEqual(self.request(changed)["status"],400)
        changed=copy.deepcopy(self.payload);changed["customer"]["consents"]["offer"]=False
        self.assertEqual(self.request(changed)["status"],400)
    def test_rate_across_instances(self):
        self.api.rate_limit=1
        self.assertEqual(self.request()["status"],201)
        self.api=OrderApi(self.db,self.catalog,["https://shop.example"],rate_limit=1)
        self.assertEqual(self.request()["status"],429)
    def test_boundary(self):
        self.assertEqual(self.request(origin="https://other.example")["status"],403)
        self.assertEqual(self.request(raw=b"{")["status"],400)
        self.assertEqual(self.request(length=999999)["status"],413)
        self.assertEqual(self.request(payload=[])["status"],400)
        self.assertEqual(self.request(method="GET")["status"],405)
        self.assertEqual(self.request(method="GET",route="/health",origin="")["body"],{"status":"ok"})
        self.assertEqual(self.request(method="OPTIONS")["headers"]["Access-Control-Allow-Origin"],"https://shop.example")

if __name__ == "__main__":
    unittest.main()
