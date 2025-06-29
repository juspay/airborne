To integrate the react plugin on the android application. You need to instantiate the Airborne instance with application context, release config url and an AirborneInterface.

It is preferable to call this function onCreate of your application to allow maximum time for downloads.

The AirborneInterface consists of the following functions.

getNamespace : In case there are multiple instances of airborne running in the application. Each unique namespace string is assigned a storage location.

getDimensions : This is a hash map of properties used for bucketing releases made on the server. Values sent here are sent to the release config call as a request header.

getIndexBundlePath (Deprecated) : This function expects the default path for picking up the boot bundle in react app. 

getLazyDownloadCallback : This function accepts a callback to infrom the application on availability of each lazy file entry. There are 2 interface functions to be implemented
- fileInstalled (filePath: String, success: Boolean) : File at filePath has completed downloads. Success indicates if the download was successful or has failed.
- lazySplitsInstalled (Might get renamed) : This function is used to indicate that all lazy files have completed downloading.

onBootComplete : This callback indicates that download has completed. You should create your ReactInstanceManager at this point.

onEvent : This function triggers analytics events to the application. Events triggered are mentioned in the events section