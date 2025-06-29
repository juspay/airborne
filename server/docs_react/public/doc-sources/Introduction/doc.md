Airborne is a general purpose OTA sdk which allows downloads for native or reactive native mobile applications for remotely updatable files. OTA is powered by the release config JSON displayed on the right.

## **Core Concepts**
File downloads can be broadly clubbed into 2 categories.

**Package**: 
Files that are have to be downloaded as a set, and will not work correctly if not used together is know as a package. We can futher categorise this into the following constructs, based on importance.

**Important**:
A file which is required as minimum to boot the app is added as important. Example the code that is required to open the home screen of your app.

**Lazy**: 
A file which can be downloaded in the background. And sits in a non critical code point is categorised as lazy. Example the user profile page, in a shopping app, which is not visited frequently

**Resources**: 
Files that can work with any version of the package is known as a resource. This maybe a string json file, or an icon used in the app.

## **Release Config**
On the right is a sample release config, which is used to power the SDK. Aside from the package and the resource block mentioned above. Below are the key parts of the release config

**release_config_timeout** : The maximum amount of time the SDK will wait to complete download of the release config file. As you can see, since this time is part of the release config file itself. It is applicable only on the next run.

**boot_timeout** : The maximum amount of time the SDK will wait for completion of package download. More specifically the important block. If the important block downloads before said timeout, the SDK proceeds to boot.

**properties** : User defined configurations that is available to the application. The properties in the config block is available if the release config is downloaded before the release config timeout.
The properties block in the package is available based on which package has been used to boot with.

The next section covers how the SDK handles various cases between dowloads and timeouts