<#
.SYNOPSIS
  Creates the "Quality Issues" SharePoint list used by the CIM Quality entry app and dashboard.

.DESCRIPTION
  Requires PowerShell 7+ and the PnP.PowerShell module:
      Install-Module PnP.PowerShell -Scope CurrentUser

  PnP.PowerShell needs its own Entra ID app registration to sign in (one-time, per tenant):
      Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com
  Use the Client ID it prints as -PnPClientId below.

  Column internal names must match shared/data.js. Choice values must match shared/lists.js.

.EXAMPLE
  ./Create-QualityList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Quality -PnPClientId <guid>
#>
param(
  [Parameter(Mandatory)] [string] $SiteUrl,
  [Parameter(Mandatory)] [string] $PnPClientId,
  [string] $ListName = 'Quality Issues'
)

$ErrorActionPreference = 'Stop'

# Keep in sync with shared/lists.js
$Depts       = 'Estimating','Engineering','Project Management','Procurement','Programming','Case Work','Millwork','Layup','CNC','Edge Banding','Delivery','Installation'
$Categories  = 'Dimensional Error','Material Defect','Finish Quality','Hardware Issue','Design Mismatch','Assembly Error','Documentation Error','Shipping Damage','Installation Issue','Other'
$RootCauses  = 'Human Error','Process Gap','Training Gap','Equipment Malfunction','Material Issue','Communication Failure','Design Error','Vendor Issue','Pending'
$Severities  = 'Critical','High','Medium','Low'
$Statuses    = 'Open','In Progress','Resolved'

Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $PnPClientId

if (Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue) {
  Write-Host "List '$ListName' already exists - adding any missing columns." -ForegroundColor Yellow
} else {
  New-PnPList -Title $ListName -Template GenericList -OnQuickLaunch | Out-Null
  Write-Host "Created list '$ListName'." -ForegroundColor Green
}

function Add-Column($InternalName, $DisplayName, $Type, $Choices = $null, [switch]$Required) {
  if (Get-PnPField -List $ListName -Identity $InternalName -ErrorAction SilentlyContinue) {
    Write-Host "  = $DisplayName (exists)"
    return
  }
  $params = @{ List = $ListName; InternalName = $InternalName; DisplayName = $DisplayName; Type = $Type; AddToDefaultView = $true }
  if ($Choices) { $params.Choices = $Choices }
  if ($Required) { $params.Required = $true }
  Add-PnPField @params | Out-Null
  Write-Host "  + $DisplayName"
}

Add-Column 'Project'          'Project'               Text     -Required
Add-Column 'DateReported'     'Date Reported'         DateTime -Required
Add-Column 'MNumber'          'M Number'              Text
Add-Column 'Category'         'Issue Category'        Choice   $Categories -Required
Add-Column 'IssueDescription' 'Issue Description'     Note     -Required
Add-Column 'Severity'         'Severity'              Choice   $Severities -Required
Add-Column 'CaughtBy'         'Caught By Department'  Choice   $Depts -Required
Add-Column 'CreatedByDept'    'Created By Department' Choice   $Depts -Required
Add-Column 'ReportedBy'       'Reported By'           Text
Add-Column 'RootCause'        'Root Cause'            Choice   $RootCauses
Add-Column 'CorrectiveAction' 'Corrective Action'     Note
Add-Column 'CostImpact'       'Cost Impact'           Currency
Add-Column 'Status'           'Status'                Choice   $Statuses -Required

# Date-only display for Date Reported
Set-PnPField -List $ListName -Identity 'DateReported' -Values @{ DisplayFormat = 0 } | Out-Null
# New items default to Open
Set-PnPField -List $ListName -Identity 'Status' -Values @{ DefaultValue = 'Open' } | Out-Null

Write-Host "`nDone. List URL: $SiteUrl/Lists/$($ListName -replace ' ','')" -ForegroundColor Green
