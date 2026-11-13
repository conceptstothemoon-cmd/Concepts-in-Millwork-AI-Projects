<#
.SYNOPSIS
  Creates the "Job Cost Data" SharePoint list and the "Job Cost Receipts" folder the Job Cost Pilot uses.

.DESCRIPTION
  Requires PowerShell 7+ and the PnP.PowerShell module:
      Install-Module PnP.PowerShell -Scope CurrentUser
  PnP.PowerShell needs its own Entra ID app registration to sign in (one-time, per tenant).
  Reuse the one made for another CIM tool if there is one. Otherwise:
      Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com

  -UsersGroup is the email address (or name) of a group with everyone who uses the pilot:
  Accounting (Dani, Tammy, Abby) and the installers. They get Contribute on the list and the
  receipts folder; the list stops inheriting the site's permissions.

  Safe to run again: it only adds what is missing and re-applies the permissions.

.EXAMPLE
  ./Create-JobCostList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Accounting -PnPClientId <guid> -UsersGroup jobcost@contoso.com
#>
param(
  [Parameter(Mandatory)] [string] $SiteUrl,
  [Parameter(Mandatory)] [string] $PnPClientId,
  [Parameter(Mandatory)] [string] $UsersGroup,
  [string] $ListName = 'Job Cost Data',
  [string] $ReceiptsFolder = 'Job Cost Receipts'
)

$ErrorActionPreference = 'Stop'
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $PnPClientId

if (Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue) {
  Write-Host "List '$ListName' already exists - adding anything missing." -ForegroundColor Yellow
} else {
  New-PnPList -Title $ListName -Template GenericList | Out-Null
  Write-Host "Created list '$ListName'." -ForegroundColor Green
}
# Title holds "<collection>/<id>" and must be unique (uniqueness needs an index).
Set-PnPField -List $ListName -Identity 'Title' -Values @{ Indexed = $true; EnforceUniqueValues = $true } | Out-Null
foreach ($col in @(@('DocCollection', 'Text'), @('DocId', 'Text'), @('DocData', 'Note'))) {
  if (-not (Get-PnPField -List $ListName -Identity $col[0] -ErrorAction SilentlyContinue)) {
    Add-PnPField -List $ListName -InternalName $col[0] -DisplayName $col[0] -Type $col[1] -AddToDefaultView | Out-Null
    Write-Host "  + $($col[0])"
  }
}
Set-PnPField -List $ListName -Identity 'DocCollection' -Values @{ Indexed = $true } | Out-Null
Set-PnPField -List $ListName -Identity 'DocData' -Values @{ RichText = $false; NumLines = 6 } | Out-Null

Set-PnPList -Identity $ListName -BreakRoleInheritance -CopyRoleAssignments:$false | Out-Null
Set-PnPListPermission -Identity $ListName -User $UsersGroup -AddRole 'Contribute' | Out-Null
Write-Host "  Permissions on '$ListName': $UsersGroup Contribute (site owners keep Full Control)"

# Receipt photos: a folder in the site's Documents library.
$docs = Get-PnPList -Identity 'Shared Documents' -ErrorAction SilentlyContinue
if (-not $docs) { $docs = Get-PnPList -Identity 'Documents' }
$folder = Resolve-PnPFolder -SiteRelativePath "$($docs.RootFolder.Name)/$ReceiptsFolder"
Set-PnPFolderPermission -List $docs -Identity $folder.ServerRelativeUrl -User $UsersGroup -AddRole 'Contribute' | Out-Null
Write-Host "Receipts folder ready: $($folder.ServerRelativeUrl) ($UsersGroup Contribute)" -ForegroundColor Green
