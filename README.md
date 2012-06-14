## NodeTest
This is a simple Visual Studio solution that shows how to use iisnode on Azure accessing an Azure dedicated cache the client memcached shim using the node package mc

## Using the solution
This is a Visual Studio 2010 solution that requires both .Net SDK and node.js SDK June 2012 release

The Following config entries need updating with your own account details

	YOURSTORAGEACCOUNT - needs to be replaced with a Windows Azure Storage Account Name
	YOURSTORAGEACCOUNTKEY - needs to be replaced with the key for the Windows Azure Storage Account
	
## Modifying cache properties

The cache behaviour and configuration can be modified either via the properties dialog for the Cache Service in Visual Studio or by editing the cache services configuration in the service configuration files
	
