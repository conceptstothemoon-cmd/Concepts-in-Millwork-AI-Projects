"""Build the Purchasing Desk.

Run:  python build.py

Always writes:
  index.html   The online version. Contains no prices: people sign in with Microsoft 365
               and the page loads the price file from SharePoint. Safe to publish.

When the private files are in data/ (they are never committed), also writes to private-build/:
  Purchasing-Desk-Beta.html    Offline copy with the prices built in, for emailing to Jim.
  purchasing-desk-data.json    The price file to upload to SharePoint (see setup/SETUP.md).

Private files in data/ (ask the team or download from SharePoint):
  supplier-prices.json   Wurth and Soudal prices, made by tools/extract_prices.py
  document-info.json     Corian, Formica and Sugatsune prices, document details and vendor terms
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
app = (HERE / "src" / "app.html").read_text(encoding="utf-8")
style = (HERE / "src" / "style.css").read_text(encoding="utf-8")


def page(title, extra_head, extra_body):
    head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>html,body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{extra_head}"""
    return head + style + "\n</head>\n<body>\n" + app + "\n" + extra_body + "\n</body>\n</html>\n"


def write(path, text):
    path.parent.mkdir(exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"Wrote {path.relative_to(HERE)} ({len(text.encode('utf-8')):,} bytes)")


# Online version: sign in, then load prices from SharePoint.
loader = (HERE / "src" / "online-loader.js").read_text(encoding="utf-8")
write(HERE / "index.html", page(
    "CIM Purchasing Desk",
    '<script src="vendor/msal-browser.min.js"></script>\n<script src="config.js"></script>\n',
    "<script>\n" + loader + "</script>"))

# Private outputs, only when the price files are present.
prices = HERE / "data" / "supplier-prices.json"
info = HERE / "data" / "document-info.json"
if prices.exists() and info.exists():
    data = json.loads(prices.read_text(encoding="utf-8"))
    data.update(json.loads(info.read_text(encoding="utf-8")))
    blob = json.dumps(data, separators=(",", ":"))
    out = HERE / "private-build"
    write(out / "purchasing-desk-data.json", blob)
    write(out / "Purchasing-Desk-Beta.html", page("CIM Purchasing Desk (Beta 1)", "", "<script>PD_APP(" + blob + ");</script>"))
    print("private-build/ holds CIM's prices: don't commit it or share it outside CIM.")
else:
    print("No price files in data/, so only index.html was built.")
