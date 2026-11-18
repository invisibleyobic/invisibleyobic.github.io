"""WSGI order API using the existing OЗОТЭНС validation and calculation core."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import uuid

from order_core import OrderError, calc_order, clean_source, validate_customer


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


class OrderApi:
    def __init__(self, database, catalog_path, allowed_origins=(), body_limit=32768,
                 rate_limit=5, rate_window=60):
        self.database = str(database)
        self.allowed_origins = frozenset(allowed_origins)
        self.body_limit = body_limit
        self.rate_limit = rate_limit
        self.rate_window = rate_window
        raw = json.loads(Path(catalog_path).read_text(encoding="utf-8"))["items"]
        self.catalog = {code: dict(item, short=item.get("short", item["name"]))
                        for code, item in raw.items()}
        Path(self.database).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    request_hash TEXT NOT NULL,
                    total INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS request_limits (
                    client TEXT NOT NULL, occurred_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS request_limits_client
                    ON request_limits(client, occurred_at);
            """)

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.database, timeout=15)
        try:
            connection.execute("PRAGMA busy_timeout=15000")
            with connection:
                yield connection
        finally:
            connection.close()

    def check_rate(self, address):
        client = hashlib.sha256(address.encode("utf-8")).hexdigest()
        now = time.time()
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM request_limits WHERE occurred_at < ?",
                               (now - self.rate_window,))
            count = connection.execute(
                "SELECT COUNT(*) FROM request_limits WHERE client = ?", (client,)
            ).fetchone()[0]
            if count >= self.rate_limit:
                raise ApiError(429, "Слишком много запросов. Попробуйте позже.")
            connection.execute("INSERT INTO request_limits VALUES (?, ?)", (client, now))

    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ApiError(400, "Неверный формат заказа.")
        if str(payload.get("website", "")).strip():
            raise ApiError(400, "Заказ не принят.")
        customer = payload.get("customer")
        if not isinstance(customer, dict) or not isinstance(customer.get("consents"), dict):
            raise ApiError(400, "Проверьте контактные данные и согласия.")
        items = payload.get("items")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and not isinstance(item.get("size", ""), str):
                    raise ApiError(400, "Неверный размер.")
        calculation = calc_order(items, self.catalog)
        checked_customer = validate_customer(customer)
        delivery = payload.get("delivery") or {}
        if not isinstance(delivery, dict):
            raise ApiError(400, "Неверные данные доставки.")
        method = str(delivery.get("method", customer.get("delivery", ""))).strip()
        address = str(delivery.get("address", customer.get("address", ""))).strip()
        if method and method not in ("courier", "pickup"):
            raise ApiError(400, "Неверный способ доставки.")
        if len(address) > 1000:
            raise ApiError(400, "Слишком длинный адрес.")
        return {
            "lines": sorted(calculation["lines"], key=lambda line: (line["code"], line["size"])),
            "total": calculation["total"],
            "customer": checked_customer,
            "delivery": {"method": method, "address": address},
            "source": clean_source(payload.get("source"))
        }

    def create_order(self, payload, key):
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", key):
            raise ApiError(400, "Неверный ключ запроса.")
        normalized = self.validate(payload)
        # A price update must not alter the identity of a retried request.
        identity = dict(normalized)
        identity["lines"] = [{field: line[field] for field in ("code", "size", "qty")}
                             for line in normalized["lines"]]
        identity.pop("total")
        request_hash = hashlib.sha256(json.dumps(
            identity, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")).hexdigest()
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            previous = connection.execute(
                "SELECT id, request_hash, total, status FROM orders WHERE idempotency_key = ?",
                (key,)
            ).fetchone()
            if previous:
                if previous[1] != request_hash:
                    raise ApiError(409, "Ключ уже использован для другого заказа.")
                return {"order_id": previous[0], "total": previous[2], "status": previous[3]}, False
            order_id = uuid.uuid4().hex
            connection.execute(
                "INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)",
                (order_id, key, request_hash, normalized["total"], "pending_confirmation",
                 json.dumps(normalized, ensure_ascii=False), int(time.time()))
            )
            return {"order_id": order_id, "total": normalized["total"],
                    "status": "pending_confirmation"}, True

    def __call__(self, environ, start_response):
        headers = [("Content-Type", "application/json; charset=utf-8"),
                   ("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff"),
                   ("Vary", "Origin")]
        status = 200
        origin = environ.get("HTTP_ORIGIN", "")
        try:
            if origin:
                if origin not in self.allowed_origins:
                    raise ApiError(403, "Источник запроса не разрешён.")
                headers.append(("Access-Control-Allow-Origin", origin))
            route = environ.get("PATH_INFO", "")
            method = environ.get("REQUEST_METHOD", "GET").upper()
            if route == "/health" and method == "GET":
                body = {"status": "ok"}
            elif route == "/orders" and method == "OPTIONS":
                headers.extend([
                    ("Access-Control-Allow-Methods", "POST, OPTIONS"),
                    ("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key"),
                    ("Access-Control-Max-Age", "600")
                ])
                body = {}
            elif route == "/orders" and method == "POST":
                self.check_rate(environ.get("REMOTE_ADDR", "unknown"))
                if environ.get("CONTENT_TYPE", "").split(";")[0].strip() != "application/json":
                    raise ApiError(415, "Ожидается application/json.")
                try:
                    length = int(environ.get("CONTENT_LENGTH") or "0")
                except ValueError:
                    raise ApiError(400, "Неверная длина запроса.")
                if length <= 0:
                    raise ApiError(400, "Пустой запрос.")
                if length > self.body_limit:
                    raise ApiError(413, "Слишком большой запрос.")
                content = environ["wsgi.input"].read(length)
                if len(content) != length:
                    raise ApiError(400, "Неполный запрос.")
                try:
                    payload = json.loads(content.decode("utf-8"))
                except (UnicodeDecodeError, ValueError):
                    raise ApiError(400, "Неверный JSON.")
                body, created = self.create_order(payload, environ.get("HTTP_IDEMPOTENCY_KEY", ""))
                status = 201 if created else 200
            elif route in ("/orders", "/health"):
                raise ApiError(405, "Метод не поддерживается.")
            else:
                raise ApiError(404, "Страница не найдена.")
        except OrderError as error:
            status, body = 400, {"error": str(error)}
        except ApiError as error:
            status, body = error.status, {"error": error.message}
        except (sqlite3.Error, OSError):
            status, body = 503, {"error": "Сервис временно недоступен. Попробуйте позже."}
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers.append(("Content-Length", str(len(encoded))))
        reasons = {200: "OK", 201: "Created", 400: "Bad Request", 403: "Forbidden",
                   404: "Not Found", 405: "Method Not Allowed", 413: "Content Too Large",
                   415: "Unsupported Media Type", 429: "Too Many Requests",
                   409: "Conflict", 503: "Service Unavailable"}
        start_response(str(status) + " " + reasons[status], headers)
        return [encoded]


def create_app():
    root = Path(__file__).resolve().parent
    return OrderApi(
        os.environ.get("OZOTENS_DATABASE", str(root / "data/orders.sqlite3")),
        os.environ.get("OZOTENS_CATALOG", str(root / "catalog.json")),
        [origin.strip() for origin in os.environ.get("OZOTENS_ALLOWED_ORIGINS", "").split(",")
         if origin.strip()],
        body_limit=int(os.environ.get("OZOTENS_BODY_LIMIT", "32768")),
        rate_limit=int(os.environ.get("OZOTENS_RATE_LIMIT", "5"))
    )
