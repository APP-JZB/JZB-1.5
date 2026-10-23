from PIL import Image
import json,sys
d=sys.argv[1]
im=Image.open('assets/icon.png').convert('RGB')
for n in (180,192,512): im.resize((n,n),Image.LANCZOS).save(f'{d}/icon-{n}.png')
json.dump({"name":"Hito ZB Arica","short_name":"Hito","start_url":"/hito-zb-arica-web/","scope":"/hito-zb-arica-web/","display":"standalone","background_color":"#F3F4F0","theme_color":"#C8102E",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"}]},open(f'{d}/manifest.json','w'),ensure_ascii=False)
s=open(f'{d}/index.html').read()
head='<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="Hito"><link rel="apple-touch-icon" href="/hito-zb-arica-web/icon-180.png"><link rel="manifest" href="/hito-zb-arica-web/manifest.json">'
s=s.replace('</head>',head+'</head>').replace('<html lang="en">','<html lang="es">')
import re; s=re.sub(r'<title>.*?</title>','<title>Hito ZB Arica</title>',s)
open(f'{d}/index.html','w').write(s)
open(f'{d}/.nojekyll','w').write('')
open(f'{d}/404.html','w').write(s)
