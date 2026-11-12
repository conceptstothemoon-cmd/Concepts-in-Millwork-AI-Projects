<#
.SYNOPSIS
  Loads setup/sample-issues.csv into the "Quality Issues" list (optional - for demos/training).

.DESCRIPTION
  Run Create-QualityList.ps1 first. Same requirements (PowerShell 7+, PnP.PowerShell).

  To remove the sample data later, delete the items in SharePoint, or run with -Remove,
  which deletes every item whose Reported By matches a sample-data name.

.EXAMPLE
  ./Import-SampleData.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Quality -PnPClientId <guid>
  ./Import-SampleData.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Quality -PnPClientId <guid> -Remove
#>
param(
  [Parameter(Mandatory)] [string] $SiteUrl,
  [Parameter(Mandatory)] [string] $PnPClientId,
  [string] $ListName = 'Quality Issues',
  [string] $CsvPath = (Join-Path $PSScriptRoot 'sample-issues.csv'),
  [switch] $Remove
)

$ErrorActionPreference = 'Stop'
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $PnPClientId
$rows = Import-Csv $CsvPath

if ($Remove) {
  $names = $rows.ReportedBy | Sort-Object -Unique
  $items = Get-PnPListItem -List $ListName -PageSize 500 | Where-Object { $names -contains $_['ReportedBy'] }
  Write-Host "Deleting $($items.Count) sample items (to the site recycle bin)..."
  $items | ForEach-Object { Remove-PnPListItem -List $ListName -Identity $_.Id -Recycle -Force | Out-Null }
  return
}

$i = 0
foreach ($r in $rows) {
  $i++
  Add-PnPListItem -List $ListName -Values @{
    Title            = $r.Description
    Project          = $r.Project
    DateReported     = $r.DateReported
    MNumber          = $r.MNumber
    Category         = $r.Category
    IssueDescription = $r.Description
    Severity         = $r.Severity
    CaughtBy         = $r.CaughtBy
    CreatedByDept    = $r.CreatedBy
    ReportedBy       = $r.ReportedBy
    RootCause        = $r.RootCause
    CostImpact       = [double]$r.CostImpact
    Status           = $r.Status
  } | Out-Null
  Write-Progress -Activity 'Importing sample issues' -Status "$i of $($rows.Count)" -PercentComplete ($i / $rows.Count * 100)
}
Write-Host "Imported $i sample issues." -ForegroundColor Green
