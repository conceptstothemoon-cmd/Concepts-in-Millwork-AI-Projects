<#
.SYNOPSIS
  Creates the "Bid Screener Data" SharePoint list that the Bid Screener page stores everything in.

.DESCRIPTION
  Requires PowerShell 7+ and the PnP.PowerShell module:
      Install-Module PnP.PowerShell -Scope CurrentUser

  PnP.PowerShell needs its own Entra ID app registration to sign in (one-time, per tenant).
  If you already made one for the Quality Tracker, reuse its Client ID. Otherwise:
      Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com

  Every GC, invite, decision, estimate and suggestion is one row. Column internal names must
  match m365.js. Safe to run again: it only adds what is missing.

.EXAMPLE
  ./Create-BidScreenerList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Sales -PnPClientId <guid>
#>
param(
  [Parameter(Mandatory)] [string] $SiteUrl,
  [Parameter(Mandatory)] [string] $PnPClientId,
  [string] $ListName = 'Bid Screener Data'
)

$ErrorActionPreference = 'Stop'
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $PnPClientId

if (Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue) {
  Write-Host "List '$ListName' already exists - adding anything missing." -ForegroundColor Yellow
} else {
  # Hidden from the site's left menu: people use the Bid Screener page, not the raw list.
  New-PnPList -Title $ListName -Template GenericList | Out-Null
  Write-Host "Created list '$ListName'." -ForegroundColor Green
}

# Title holds "<collection>/<id>" and must be unique (indexing is required for uniqueness).
Set-PnPField -List $ListName -Identity 'Title' -Values @{ Indexed = $true; EnforceUniqueValues = $true } | Out-Null
Write-Host '  = Title (indexed, unique)'

function Add-Column($InternalName, $Type, [switch]$Indexed) {
  if (-not (Get-PnPField -List $ListName -Identity $InternalName -ErrorAction SilentlyContinue)) {
    Add-PnPField -List $ListName -InternalName $InternalName -DisplayName $InternalName -Type $Type -AddToDefaultView | Out-Null
    Write-Host "  + $InternalName"
  } else {
    Write-Host "  = $InternalName (exists)"
  }
  if ($Indexed) { Set-PnPField -List $ListName -Identity $InternalName -Values @{ Indexed = $true } | Out-Null }
}

Add-Column 'DocCollection' Text -Indexed
Add-Column 'DocId'         Text
Add-Column 'DocData'       Note
# Plain text, not rich text: the page stores JSON here.
Set-PnPField -List $ListName -Identity 'DocData' -Values @{ RichText = $false; NumLines = 6 } | Out-Null

Write-Host ''
Write-Host "Done. Give the Sales and Estimating team 'Contribute' permission on this list (or the site)." -ForegroundColor Green
