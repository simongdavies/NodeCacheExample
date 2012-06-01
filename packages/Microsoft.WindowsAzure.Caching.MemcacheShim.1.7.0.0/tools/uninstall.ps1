param($installPath, $toolsPath, $package, $project)

	# Errors out and exits the rollback process
	function Assert([bool]$condition, [string]$errorMessage)
	{		
		if (-not $condition)
		{
			Write-Host $errorMessage
			throw $errorMessage
		}
	}
	
	# Ensures the list has a single element, and returns that element
	function GetSingle($list, [string]$errorMessageZero, [string]$errorMessagePlural)
	{
		Assert ($list -ne $null) $errorMessageZero
	
		$count = 0
		foreach ($element in $list)
		{
			$count++
		}
		
		Assert ($count -ne 0) $errorMessageZero
		Assert ($count -eq 1) $errorMessagePlural
		
		foreach ($element in $list)
		{
			return $element
		}
	}
	
	# Checks that a file starts with a 3-letter extension of the form (.xxx)
	function CheckExtension([string]$file, [string]$extPrefix)
	{
		return [System.IO.Path]::GetExtension($file).StartsWith($extPrefix, [StringComparison]::OrdinalIgnoreCase)
	}

$projectName = $project.Name

$solution = $project.DTE.Solution
$ccProjects = $solution.Projects | where { $_.Kind -eq '{cc5fd16d-436d-48ad-a40c-5a424c6e3e79}' -and (CheckExtension $_.FileName '.ccp') }
$ccProject = GetSingle $ccProjects 'No Windows Azure project was found in this solution.' 'More than one Windows Azure project were found in this solution.'

$ccProjectName = $ccProject.Name

$rolesSections = $ccProject.ProjectItems | where { $_.GetType().FullName -eq 'Microsoft.VisualStudio.Project.Automation.OAReferenceFolderItem' }
$rolesSection = GetSingle $rolesSections "The Windows Azure Project $ccProjectName does not have a Roles section." "The Windows Azure Project $ccProjectName has duplicate Roles section defined."
$roleNames = $rolesSection.ProjectItems | where { $_.Object.SourceProject.UniqueName -eq $project.UniqueName } | %{ $_.Name }
$roleName = GetSingle $roleNames "The Windows Azure Project $ccProjectName does not include a Role for $projectName" "The Windows Azure Project $ccProjectName has duplicate Role entries referring to $projectName."

$csdefFiles = $ccProject.ProjectItems | where { $_.Object.GetType().FullName -eq 'Microsoft.Cct.CctServiceDefinitionFileNode' } # Internal class
$csdefFile = GetSingle $csdefFiles "The Windows Azure Project $ccProjectName does not have a ServiceDefinition (CSDEF) file." "The Windows Azure Project $ccProjectName has more than one ServiceDefinition (CSDEF) files."

$csdefFileName = $csdefFile.Name
## Assert $csdefFile.Saved "Save the file $csdefFileName in project $ccProjectName before continuing."

$csdefFilePath = $csdefFile.Object.Url
Assert (Test-Path $csdefFilePath) "The file $csdefFileName in project $ccProjectName was not found. Check if the file exists at $csdefFilePath"

$csdefXml = New-Object XML
$csdefXml.PreserveWhitespace = $true
$csdefXml.LoadXml([System.IO.File]::ReadAllText($csdefFilePath))
$nsMgr = New-Object System.Xml.XmlNamespaceManager($csdefXml.NameTable)
$namespace = 'http://schemas.microsoft.com/ServiceHosting/2008/10/ServiceDefinition'
$nsMgr.AddNamespace('sd', $namespace)

$requiredWebRole = $csdefXml.DocumentElement.SelectSingleNode("/sd:ServiceDefinition/sd:WebRole[@name='$roleName']", $nsmgr)
$requiredWorkerRole = $csdefXml.DocumentElement.SelectSingleNode("/sd:ServiceDefinition/sd:WorkerRole[@name='$roleName']", $nsmgr)

$roleNode = $requiredWebRole
if ($requiredWorkerRole -ne $null)
{
    Assert ($roleNode -eq $null) "The ServiceDefinition file $csdefFileName in project $ccProjectName is corrupt."
    $roleNode = $requiredWorkerRole
}

Assert ($roleNode -ne $null) "The ServiceDefinition file $csdefFileName for project $ccProjectName does not include a WebRole/WorkerRole section named $roleName."

# Start modifying the XML

$startupNode = $roleNode.SelectSingleNode("sd:Startup", $nsMgr)
if ($startupNode -ne $null)
{
    $startupTaskNodes = $startupNode.SelectNodes('sd:Task[@commandLine="WindowsAzure.Caching.MemcacheShim\MemcacheShimInstaller.exe"]', $nsmgr)
    foreach ($startupTaskNode in $startupTaskNodes)
    {
	    if ($startupTaskNode -ne $null)
	    {
		    $startupNode.RemoveChild($startupTaskNode) | Out-Null
	    }
    }

    if ($startupNode.ChildNodes.Count -eq 0)
    {
	    $roleNode.RemoveChild($startupNode) | Out-Null
    }
}

$allInternalEndpoints = $roleNode.SelectNodes('sd:Endpoints/sd:InternalEndpoint', $nsMgr)
$existingMemcacheEndpoints = $allInternalEndpoints | where { $_.Attributes.ItemOf("name") -and $_.Attributes.ItemOf("name").Value.StartsWith('memcache_') }
foreach ($existingMemcacheEndpoint in $existingMemcacheEndpoints)
{
	if ($existingMemcacheEndpoint -ne $null)
	{
		$existingMemcacheEndpoint.ParentNode.RemoveChild($existingMemcacheEndpoint) | Out-Null
	}
}

# Commit changes
#
# arisen: Any failure here will be ignored by NuGet.

$csdefXml.Save($csdefFilePath)
