param($installPath, $toolsPath, $package, $project)

	# Aborts execution and effects a rollback if the condition is false.
	function Assert([bool]$condition, [string]$errorMessage)
	{		
		if (-not $condition)
		{
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
## Assert ($project.Saved) "Save the project $projectName before continuing."
# arisen: Since the project-level changes we're making are not to the *.csproj file directly, but to the DTE, we do
# not need to assert if the project is not saved.

$solution = $project.DTE.Solution
$ccProjects = $solution.Projects | where { $_.Kind -eq '{cc5fd16d-436d-48ad-a40c-5a424c6e3e79}' -and (CheckExtension $_.FileName '.ccp') }
$ccProject = GetSingle $ccProjects 'No Windows Azure project was found in this solution.' 'More than one Windows Azure project were found in this solution.'

# arisen: The .ccproj file is used by Azure to generate the CSPKG.

$ccProjectName = $ccProject.Name
## Assert $ccProject.Saved "Save the project $ccProjectName before continuing."
# arisen: Changes are limited to .CSDEF only.

# arisen: The ccproj uses the References section to encapsulate what are essentially Roles.
#
$rolesSections = $ccProject.ProjectItems | where { $_.GetType().FullName -eq 'Microsoft.VisualStudio.Project.Automation.OAReferenceFolderItem' }
$rolesSection = GetSingle $rolesSections "The Windows Azure Project $ccProjectName does not have a Roles section." "The Windows Azure Project $ccProjectName has duplicate Roles section defined."
$roleNames = $rolesSection.ProjectItems | where { $_.Object.SourceProject.UniqueName -eq $project.UniqueName } | %{ $_.Name }
$roleName = GetSingle $roleNames "The Windows Azure Project $ccProjectName does not include a Role for $projectName" "The Windows Azure Project $ccProjectName has duplicate Role entries referring to $projectName."

# arisen: The right way would have been to verify that { $_.Object -is [Microsoft.Cct.CctServiceDefinitionFileNode] }, but the type is internal
#
$csdefFiles = $ccProject.ProjectItems | where { $_.Object.GetType().FullName -eq 'Microsoft.Cct.CctServiceDefinitionFileNode' }
$csdefFile = GetSingle $csdefFiles "The Windows Azure Project $ccProjectName does not have a ServiceDefinition (CSDEF) file." "The Windows Azure Project $ccProjectName has more than one ServiceDefinition (CSDEF) files."

$csdefFileName = $csdefFile.Name
Assert $csdefFile.Saved "Save the file $csdefFileName in project $ccProjectName before continuing."

$csdefFilePath = $csdefFile.Object.Url
Assert (Test-Path $csdefFilePath) "The file $csdefFileName in project $ccProjectName was not found. Check if the file exists at $csdefFilePath"

# arisen: This roundabout means to loading the XML file is to ensure whitespace is preserved.
#
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
if ($startupNode -eq $null)
{
	$startupNode = $csdefXml.CreateElement('Startup', $namespace)
	$roleNode.AppendChild($startupNode) | Out-Null
}

if ($startupNode.Attributes.ItemOf('priority') -eq $null)
{
	$startupPriorityAttribute = $csdefXml.CreateAttribute('priority')
	$startupPriorityAttribute.Value = '-2'
	$startupNode.Attributes.Append($startupPriorityAttribute) | Out-Null
}

$startupTaskNode = $csdefXml.CreateElement('Task', $namespace)
$startupNode.AppendChild($startupTaskNode) | Out-Null

$startupTaskCommandLine = $csdefXml.CreateAttribute('commandLine')
$startupTaskCommandLine.Value = 'WindowsAzure.Caching.MemcacheShim\MemcacheShimInstaller.exe'
$startupTaskNode.Attributes.Append($startupTaskCommandLine) | Out-Null

$startupTaskExecutionContext = $csdefXml.CreateAttribute('executionContext')
$startupTaskExecutionContext.Value = 'elevated'
$startupTaskNode.Attributes.Append($startupTaskExecutionContext) | Out-Null

$startupTaskTaskType = $csdefXml.CreateAttribute('taskType')
$startupTaskTaskType.Value = 'simple'
$startupTaskNode.Attributes.Append($startupTaskTaskType) | Out-Null

# arisen: Do not add any memcache ports if a single memcache port already exists.
#
$internalEndpoints = $roleNode.SelectNodes('sd:Endpoints/sd:InternalEndpoint', $nsMgr)
$existingMemcacheEndpoints = $internalEndpoints | where { $_.Attributes.ItemOf("name") -and $_.Attributes.ItemOf("name").Value.StartsWith('memcache_') }

if ($existingMemcacheEndpoints -eq $null)
{
	$endpointsNode = $roleNode.SelectSingleNode('sd:Endpoints', $nsMgr)
	
	# arisen: Pick the next unused port after 11211
	#
	$port = 11211	
	if ($endpointsNode -ne $null -and $endpointsNode.HasChildNodes)
	{
	    while ($endpointsNode.ChildNodes | where {
	            $_ -is [System.Xml.XmlElement] -and 
	            $_.Attributes.ItemOf('port') -and 
	            $_.Attributes.ItemOf('port').Value -eq "$port" 
	        })
	    {
    		$port++
    	}
    }

	if ($endpointsNode -eq $null)
	{
		$endpointsNode = $csdefXml.CreateElement('Endpoints', $namespace)
		$roleNode.AppendChild($endpointsNode) | Out-Null
	}
	
	$memacheDefaultInternalEndpointNode = $csdefXml.CreateElement('InternalEndpoint', $namespace)
	$endpointsNode.AppendChild($memacheDefaultInternalEndpointNode) | Out-Null
	
	$memacheDefaultInternalEndpointNameAttribute = $csdefXml.CreateAttribute('name')
	$memacheDefaultInternalEndpointNameAttribute.Value = 'memcache_default'
	$memacheDefaultInternalEndpointNode.Attributes.Append($memacheDefaultInternalEndpointNameAttribute) | Out-Null
	
	$memacheDefaultInternalEndpointProtocolAttribute = $csdefXml.CreateAttribute('protocol')
	$memacheDefaultInternalEndpointProtocolAttribute.Value = 'tcp'
	$memacheDefaultInternalEndpointNode.Attributes.Append($memacheDefaultInternalEndpointProtocolAttribute) | Out-Null
	
	$memacheDefaultInternalEndpointPortAttribute = $csdefXml.CreateAttribute('port')
	$memacheDefaultInternalEndpointPortAttribute.Value = "$port"
	$memacheDefaultInternalEndpointNode.Attributes.Append($memacheDefaultInternalEndpointPortAttribute) | Out-Null	
}

# Commit changes
#
# arisen: Any exception beyond this point requires the code below to rollback existing changes.

foreach ($item in $project.ProjectItems | where { $_.Name -eq 'WindowsAzure.Caching.MemcacheShim' } | %{ $_.ProjectItems })
{
	$item.Properties.Item("BuildAction").Value = 0
	$item.Properties.Item("CopyToOutputDirectory").Value = 1
}

$csdefXml.Save($csdefFilePath)
