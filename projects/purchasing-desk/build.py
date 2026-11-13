"""Build the single-file Purchasing Desk beta.

Run:  python build.py
Reads src/app.html, src/style.css and data/supplier-prices.json
and writes Purchasing-Desk-Beta.html, a file anyone can open in a browser,
plus an identical index.html so the folder opens as a web page when hosted.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
app = (HERE / "src" / "app.html").read_text(encoding="utf-8")
style = (HERE / "src" / "style.css").read_text(encoding="utf-8")
data = json.loads((HERE / "data" / "supplier-prices.json").read_text(encoding="utf-8"))

head = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CIM Purchasing Desk (Beta 1)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
"""
html = head + style + "\n</head>\n<body>\n" + app.replace("__DATA__", json.dumps(data, separators=(",", ":"))) + "\n</body>\n</html>\n"
for name in ("Purchasing-Desk-Beta.html", "index.html"):
    out = HERE / name
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {out.name} ({len(html):,} bytes)")
