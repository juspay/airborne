This section deals with the various frontend integration offered in airborne. This includes airborne android, iOS and react SDKs. The SDKs can be used along with the juspay hosted airborne server or stand alone with a self hosted release config json.

## SDK Inputs

1. **Release Config Url** : This is a url responds with a JSON specified in the introduction section of the doc. The SDK makes a GET and HEAD call to the server to this URL.

2. **Namespace** : A scope under which the SDK saves assets. This is especially useful when two instance of the SDK are running within the same app. And we do not need any cross contamination between downloads of both the instances

3. **Bundled release config path** : In the very first run there is a chance that downloads do not complete within the boot/ release config timeout. In this case, the SDK uses this path to boot to a packaged version of the code.

4. **Dimensions** : A set of user defined values, which are sent to the release config request as part of the x-dimension header. Values are sent in the format <key1>=<value1>;<key2>=<value1>;...;. Sorted in alphabetical order of keys.

## Callbacks

1. **Boot Completion** : The SDK sends a callback to indicate that boot is completed. In react native instead of the callback the SDK blocks the getJSBundle function
2. **Tracker Callback** : The SDK sends various callbacks to integrating apps. These can be used by the integrating apps to monitor various metrics of the release.
3. **Lazy Download Callback** : The SDK sends events to the application to inform that specific lazy downloaded files are now available for use.
