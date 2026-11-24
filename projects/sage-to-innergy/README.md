# Sage to Innergy

Reads Sage AP journal PDFs (Enter Invoices, Import Invoices, Record Payments Credit Cards), keeps only the lines charged to a job, and fills the `costInput` table in Dani's `INNERGY_addedExpenses` workbook so its macro can post them to Innergy.

## Use it

Open <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/sage-to-innergy/>, or double-click `index.html` in a downloaded copy.

1. Drop the INNERGY_addedExpenses `.xlsm` you post from (refresh its lists in Excel first).
2. Drop one or more Sage journal PDFs.
3. Check the lines, then download the filled workbook. It downloads as `.xlsm`.
4. In Excel: Enable Content, read the **Review** sheet, fix yellow rows on the **Input** sheet, run the duplicate check, post.

Everything runs in the browser. Nothing is uploaded, and the workbook's macros, Setup sheet (API key), Power Query connections and Innergy lists are copied through unchanged. Only the Input sheet's `costInput` rows change, and **Review** and **Rules** sheets are added.

## What it pulls

For each invoice line with a job number:

| Innergy column | From the Sage PDF |
|---|---|
| WorkOrder | the job (261151 → work order starting `P-26-1151`), or a rule |
| BudgetGroup | a rule for the cost code |
| Cost | the line's amount |
| PostDate, InvoiceDate | invoice date |
| DueDate | payment date |
| Status | `Open` |
| ExternalId | `VENDORCODE-INVOICE-LINE`, so Innergy's duplicate check works |
| Notes | the line's description |
| GL Account | a rule for the Sage debit account |
| Terms | a rule for the vendor |
| Pay To | the vendor name without its Sage code, or a rule |
| VendorInvoiceNumber | invoice number |

Lines with no job are left out and listed on the Review sheet. Each PDF's total is checked against its own Job Cost Recap.

## How it learns

The **Rules** sheet maps Sage names to Innergy names (vendor → Pay To, job → work order, cost code → budget group, debit account → GL account, vendor → terms). Dani can edit it directly. When the same workbook is dropped in again, the tool compares the Input sheet with what it filled last time (kept on the Review sheet) and saves her changes as rules.

`core.source.js` is the readable copy of the parsing and workbook code that is inlined into `index.html`.
