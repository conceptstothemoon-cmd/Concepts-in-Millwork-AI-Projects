"""Rebuild data/supplier-prices.json from Jim's supplier files.

Usage:
  python tools/extract_prices.py WURTH_CONTRACT.txt SOUDAL_PRICE_SHEET.xlsx

WURTH_CONTRACT.txt is the Wurth Louis and Company contract letter converted
to text with layout kept (for example: pdftotext -layout contract.pdf contract.txt).
SOUDAL_PRICE_SHEET.xlsx is the BOSS/Soudal distributor workbook. "Sheet4" holds
the current prices and "Sheet1" the 2025 sheet used for comparison.

The Hallmark Corian groups, the Formica increase rules and the Sugatsune
increases are short and are typed into src/app.html (CORIAN, FORMICA, SUGA).
The supplier files themselves are not kept in this repo.

Needs: pip install openpyxl
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

LINE = re.compile(r"^\s*\*?\s*([A-Z0-9][A-Z0-9\-\.]+)\s{2,}(.+?)\s{2,}([\d,]+\.\d+)\s+([A-Z]{2,3})\s*$")


def wurth(path):
    rows = []
    for line in Path(path).read_text(encoding="utf-8", errors="ignore").splitlines():
        m = LINE.match(line)
        if m:
            rows.append([m.group(1), re.sub(r"\s+", " ", m.group(2)).strip(), float(m.group(3).replace(",", "")), m.group(4)])
    return rows


def soudal(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    old = {}
    for r in wb["Sheet1"].iter_rows(min_row=21, values_only=True):
        if isinstance(r[10], (int, float)) and r[1]:
            old[str(r[1])] = round(r[10], 2)
    rows, group = [], None
    for r in wb["Sheet4"].iter_rows(min_row=21, values_only=True):
        if r[1] and not r[2] and not isinstance(r[11], (int, float)):
            group = "Hybrids" if r[1] == "#VALUE!" else str(r[1]).strip()
            continue
        if isinstance(r[11], (int, float)):
            part = str(r[2]) if r[2] is not None else ""
            color = str(r[7]) if r[7] and str(r[7]) != "None" else ""
            pallet = round(r[12], 2) if isinstance(r[12], (int, float)) else None
            rows.append([part, str(r[6] or "").strip(), color, str(r[8] or ""), r[9] or "", r[10] or "", round(r[11], 2), pallet, group, old.get(part)])
    return rows


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    data = {"wurth": wurth(sys.argv[1]), "soudal": soudal(sys.argv[2])}
    out = Path(__file__).resolve().parent.parent / "data" / "supplier-prices.json"
    out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"Wurth: {len(data['wurth'])} prices, Soudal: {len(data['soudal'])} prices -> {out}")
