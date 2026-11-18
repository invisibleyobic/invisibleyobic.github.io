from pathlib import Path
from html.parser import HTMLParser
from html import unescape,escape
from urllib.parse import urljoin
from datetime import date
import json,re,os,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]/'ozonebox-review'/'ozotens'
base=os.environ.get('OZOTENS_PUBLIC_URL','https://asherbakov.ru/ozonebox-review/ozotens/').rstrip('/')+'/'
catalog=json.loads((root/'commerce-catalog.json').read_text(encoding='utf-8'))['items']
class MainText(HTMLParser):
 def __init__(self):super().__init__();self.main=False;self.skip=0;self.out=[]
 def handle_starttag(self,tag,attrs):
  if tag=='main':self.main=True
  if self.main and tag in ('script','style'):self.skip+=1
 def handle_endtag(self,tag):
  if tag=='main':self.main=False
  if self.main and tag in ('script','style') and self.skip:self.skip-=1
 def handle_data(self,data):
  if self.main and not self.skip:self.out.append(data)
def plain(html):
 p=MainText();p.feed(html);return re.sub(r'\s+',' ',' '.join(p.out)).strip()
def url_of(p):
 key=p.relative_to(root).as_posix()
 return base+(key[:-10] if key.endswith('index.html') else key)
search=[];sitemap=[]
aliases={'articles/sciatica/':'защемление защемило ишиас радикулит поясница боль в ноге','assistant/':'защемление артроз артрит спина колено не знаю как выбрать помощь','how-to/video/':'видео ролики спина шея колено плечо первый сеанс настройка технические аспекты'}
for p in sorted(root.rglob('*.html')):
 s=p.read_text(encoding='utf-8')
 if 'site.css' not in s or 'http-equiv="refresh"' in s:continue
 route=p.relative_to(root).as_posix()
 canonical=url_of(p)
 nonindex=route.startswith(('cart/','checkout/','search/','legal/','start/'))
 if route.startswith('start/'):canonical=base
 meta='noindex,follow' if nonindex else 'index,follow'
 s=re.sub(r'<meta name="robots" content="[^"]*">',f'<meta name="robots" content="{meta}">',s)
 s=re.sub(r'<link rel="canonical"[^>]*>','',s)
 s=s.replace('</head>',f'<link rel="canonical" href="{canonical}"></head>')
 text=plain(s)
 title_m=re.search(r'<h1\b[^>]*>(.*?)</h1>',s,re.S)
 title=re.sub('<[^>]+>',' ',title_m[1]) if title_m else route
 title=unescape(re.sub(r'\s+',' ',title)).strip()
 desc_m=re.search(r'<meta name="description" content="([^"]*)"',s)
 desc=unescape(desc_m[1]) if desc_m else text[:170]
 if not desc_m:s=s.replace('</head>',f'<meta name="description" content="{escape(desc,quote=True)}"></head>')
 if 'commerce-catalog' not in route:
  sku=next((code for code,item in catalog.items() if route=='catalog/'+item['slug']+'/index.html'),None)
  if sku:
   item=catalog[sku]
   data={'@context':'https://schema.org','@type':'Product','name':item['name'],'sku':sku,'description':item['description'],'image':urljoin(base,'img/'+item['image']),'offers':{'@type':'Offer','url':canonical,'priceCurrency':'RUB','price':str(item['price']),'availability':'https://schema.org/InStock'}}
   s=re.sub(r'<script type="application/ld\+json"[^>]*>.*?</script>','',s,flags=re.S)
   s=s.replace('</head>','<script type="application/ld+json">'+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+'</script></head>')
 if not nonindex:
  sitemap.append(canonical)
  extra=aliases.get(route.replace('index.html',''),'')
  if route.startswith('catalog/'):
   item=next((it for it in catalog.values() if route=='catalog/'+it['slug']+'/index.html'),None)
   if item:
    code=next(k for k,v in catalog.items() if v is item)
    extra+=' '+code+' '+item['description']+' '+' '.join(item['sizes'])
  if route.startswith('how-to/video/'):extra+=' '+text[:3000]
  search.append({'title':title,'sku':sku or '','url':route.replace('index.html',''),'description':desc,'keywords':extra+' '+text[:8000]})
 p.write_text(s,encoding='utf-8')
(root/'search-index.json').write_text(json.dumps(search,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ns='http://www.sitemaps.org/schemas/sitemap/0.9'
ET.register_namespace('',ns)
tree=ET.Element('{'+ns+'}urlset')
for loc in sorted(set(sitemap)):
 u=ET.SubElement(tree,'{'+ns+'}url')
 ET.SubElement(u,'{'+ns+'}loc').text=loc
 ET.SubElement(u,'{'+ns+'}lastmod').text=os.environ.get('OZOTENS_LASTMOD',date.today().isoformat())
ET.indent(tree)
ET.ElementTree(tree).write(root/'sitemap.xml',encoding='utf-8',xml_declaration=True)
(root/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+base+'sitemap.xml\n',encoding='utf-8')
parent=root.parents[1]/'robots.txt'
s=parent.read_text(encoding='utf-8');entry='Sitemap: '+base+'sitemap.xml'
if entry not in s:parent.write_text(s.rstrip()+'\n'+entry+'\n',encoding='utf-8')
print(f'Search records {len(search)}, canonical sitemap URLs {len(set(sitemap))}')

from pathlib import Path
import re,xml.etree.ElementTree as ET
r=root
# Structured video sitemap data points at actual local players and files.
p=r/'sitemap.xml'
ns='http://www.sitemaps.org/schemas/sitemap/0.9'
vns='http://www.google.com/schemas/sitemap-video/1.1'
ET.register_namespace('',ns);ET.register_namespace('video',vns)
tree=ET.parse(p);root=tree.getroot()
url=next((e for e in root if e.find('{'+ns+'}loc').text.endswith('/how-to/video/')),None)
if url is not None:
 for e in list(url):
  if e.tag.startswith('{'+vns+'}'):url.remove(e)
 html=(r/'how-to/video/index.html').read_text(encoding='utf-8')
 for card in re.findall(r'<article class="card video-card".*?</article>',html,re.S):
  src=re.search(r'<source src="[^"]*/([^/"]+\.mp4)"',card)
  title=re.search(r'<h3>(.*?)</h3>',card,re.S)
  descs=re.findall(r'<p>(.*?)</p>',card,re.S)
  if not src or not title:continue
  key=src[1][:-4];title=re.sub('<[^>]+>','',title[1]);desc=re.sub('<[^>]+>','',descs[0]) if descs else title
  video=ET.SubElement(url,'{'+vns+'}video')
  for tag,text in [('thumbnail_loc',base+'media/'+key+'.jpg'),('title',title),('description',desc),('content_loc',base+'media/'+src[1])]:
   ET.SubElement(video,'{'+vns+'}'+tag).text=text
 ET.indent(root);tree.write(p,encoding='utf-8',xml_declaration=True)
 print('Video sitemap entries',len(url.findall('{'+vns+'}video')))
