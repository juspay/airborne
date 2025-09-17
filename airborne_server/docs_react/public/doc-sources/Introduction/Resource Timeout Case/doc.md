The first case we are going to focus on is when the important block of the package is downloaded before the boot timeout.

### Assumptions

1. The device currently have package and resource v0 on disk
2. New version v1 of release config is being downloaded
3. There are 2 entries in the important block PI1 and PI2
4. There are 2 entries in the lazy block PL1 and PL2
5. There are 2 entries in the resource block R1 R2
6. PI1 of the important block downloads before the timeout
7. One of the resource block entries are downloaded before the timeout
8. PL1 of the lazy block downloads before the timeout

### Result

The SDK boots with Package v1. PI1, PI2, R1 and PL1 are available during boot. PL2 is sent to the application as part of a callback. The v0 version of R2 is available to the package during boot.
