# Optional: Power BI on the same data

The web dashboard in `dashboard/` covers the day-to-day views. If CIM also wants Power BI (custom reports, scheduled email subscriptions, Teams embedding), it can read the same SharePoint list.

1. Power BI Desktop → **Get data → SharePoint Online list** → **2.0** implementation.
2. Site URL: `https://contoso.sharepoint.com/sites/Quality` (site, not list URL). Sign in with an organizational account.
3. Select **Quality Issues** → **Transform Data**.
4. Keep these columns: `ID`, `Project`, `DateReported`, `MNumber`, `Category`, `IssueDescription`, `Severity`, `CaughtBy`, `CreatedByDept`, `ReportedBy`, `RootCause`, `CorrectiveAction`, `CostImpact`, `Status`, `Created`, `Modified`.
5. Add a custom column for the issue number used in the apps: `= "QI-" & Text.From(1000 + [ID])`.
6. Set `DateReported` to type **Date**.
7. Close & Apply. Publish to the Power BI service and set a scheduled refresh (the SharePoint connector needs no gateway).

Pareto tip: build a bar chart of `CaughtBy` (or `CreatedByDept`) by count, sorted descending, plus a line measure:

```DAX
Cumulative % =
VAR thisCount = COUNTROWS('Quality Issues')
VAR tbl = ADDCOLUMNS(ALLSELECTED('Quality Issues'[CaughtBy]), "@n", CALCULATE(COUNTROWS('Quality Issues')))
VAR running = SUMX(FILTER(tbl, [@n] >= thisCount), [@n])
RETURN DIVIDE(running, SUMX(tbl, [@n]))
```

(Departments with equal counts share the same cumulative value.)
