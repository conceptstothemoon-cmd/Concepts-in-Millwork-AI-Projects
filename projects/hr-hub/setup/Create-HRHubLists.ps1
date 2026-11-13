<#
.SYNOPSIS
  Creates the three SharePoint lists the HR Hub stores everything in, and sets who can open each.

.DESCRIPTION
  Requires PowerShell 7+ and the PnP.PowerShell module:
      Install-Module PnP.PowerShell -Scope CurrentUser
  PnP.PowerShell needs its own Entra ID app registration to sign in (one-time, per tenant).
  Reuse the one made for the Quality Tracker or Bid Screener if there is one. Otherwise:
      Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com

  Lists and permissions (each list stops inheriting the site's permissions):
    HR Hub Private   people, interviews, paper inbox, feedback   HR: Edit.  Nobody else.
    HR Hub Tasks     checklist tasks                             HR: Edit.  Staff: Contribute.
    HR Hub Settings  rules, messages, questions, departments     HR: Edit.  Staff: Read.
  Site owners keep Full Control of all three.

  -HrGroup and -StaffGroup are the email addresses (or names) of a Microsoft 365 group or
  security group. Staff = everyone who owns checklist steps (supervisors, payroll, IT, safety).

  Safe to run again: it only adds what is missing and re-applies the permissions.

.EXAMPLE
  ./Create-HRHubLists.ps1 -SiteUrl https://contoso.sharepoint.com/sites/HR -PnPClientId <guid> `
      -HrGroup hr@contoso.com -StaffGroup hrhub-owners@contoso.com
#>
param(
  [Parameter(Mandatory)] [string] $SiteUrl,
  [Parameter(Mandatory)] [string] $PnPClientId,
  [Parameter(Mandatory)] [string] $HrGroup,
  [Parameter(Mandatory)] [string] $StaffGroup
)

$ErrorActionPreference = 'Stop'
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $PnPClientId

function New-HubList($Name) {
  if (Get-PnPList -Identity $Name -ErrorAction SilentlyContinue) {
    Write-Host "List '$Name' already exists - adding anything missing." -ForegroundColor Yellow
  } else {
    New-PnPList -Title $Name -Template GenericList | Out-Null
    Write-Host "Created list '$Name'." -ForegroundColor Green
  }
  # Title holds "<collection>/<id>" and must be unique (uniqueness needs an index).
  Set-PnPField -List $Name -Identity 'Title' -Values @{ Indexed = $true; EnforceUniqueValues = $true } | Out-Null
  foreach ($col in @(@('DocCollection', 'Text'), @('DocId', 'Text'), @('DocData', 'Note'))) {
    if (-not (Get-PnPField -List $Name -Identity $col[0] -ErrorAction SilentlyContinue)) {
      Add-PnPField -List $Name -InternalName $col[0] -DisplayName $col[0] -Type $col[1] -AddToDefaultView | Out-Null
      Write-Host "  + $($col[0])"
    }
  }
  Set-PnPField -List $Name -Identity 'DocCollection' -Values @{ Indexed = $true } | Out-Null
  Set-PnPField -List $Name -Identity 'DocData' -Values @{ RichText = $false; NumLines = 6 } | Out-Null
}

function Set-HubPermissions($Name, $StaffRole) {
  # Stop inheriting, without copying the site's permissions, then grant exactly these.
  Set-PnPList -Identity $Name -BreakRoleInheritance -CopyRoleAssignments:$false | Out-Null
  Set-PnPListPermission -Identity $Name -User $HrGroup -AddRole 'Edit' | Out-Null
  if ($StaffRole) { Set-PnPListPermission -Identity $Name -User $StaffGroup -AddRole $StaffRole | Out-Null }
  Write-Host "  Permissions on '$Name': HR Edit$(if ($StaffRole) { ", staff $StaffRole" } else { ', staff none' })"
}

New-HubList 'HR Hub Private';  Set-HubPermissions 'HR Hub Private' $null
New-HubList 'HR Hub Tasks';    Set-HubPermissions 'HR Hub Tasks' 'Contribute'
New-HubList 'HR Hub Settings'; Set-HubPermissions 'HR Hub Settings' 'Read'

Write-Host ''
Write-Host 'Done. Check each list under List settings > Permissions for this list.' -ForegroundColor Green
