# Changelog
All notable changes to this project will be documented in this file. See [conventional commits](https://www.conventionalcommits.org/) for commit guidelines.

- - -
## airborne_server-v0.12.4 - 2026-01-07
#### Bug Fixes
- bug fixes in navigation and user access - (8736cd8) - yuvrajjsingh0

- - -

## airborne_server-v0.12.3 - 2026-01-06
#### Bug Fixes
- return 404 in case of app doesn't exist while serving release - (f7dec1f) - yuvrajjsingh0

- - -

## airborne_server-v0.12.2 - 2026-01-06
#### Bug Fixes
- support Google OAuth in personal access token flow - (4737bd0) - Yash Rajput

- - -

## airborne_server-v0.12.1 - 2026-01-06
#### Bug Fixes
- Send Forbidden incase of not having enough access instead of Unauthorized - (4a420c2) - yuvrajjsingh0

- - -

## airborne_server-v0.12.0 - 2026-01-06
#### Features
- Add optional checksum and size fields for file creation - (075c1f4) - Yash Rajput

- - -

## airborne_server-v0.11.2 - 2026-01-05
#### Bug Fixes
- added .git to repository url - (4a35c5a) - Yaswanth

- - -

## airborne_server-v0.11.1 - 2026-01-05
#### Bug Fixes
- removed .git from repository url - (9785bd8) - Yaswanth

- - -

## airborne_server-v0.11.0 - 2025-12-31
#### Features
- Use authenticated superposition - (65f8ba7) - yuvrajjsingh0

- - -

## airborne_server-v0.10.6 - 2025-12-24
#### Bug Fixes
- android artifact path - (6c1f553) - yuvrajjsingh0

- - -

## airborne_server-v0.10.5 - 2025-12-18
#### Bug Fixes
- Cohort dimension weight - (978b295) - yuvrajjsingh0

- - -

## airborne_server-v0.10.4 - 2025-12-12
#### Bug Fixes
- CVE-2025-55184 and CVE-2025-55183 - (1cf6c67) - yuvrajjsingh0

- - -

## airborne_server-v0.10.3 - 2025-11-28
#### Bug Fixes
- Updated ubuntu image from 24.04 to 25.10 to fix CVE-2025-8941 - (111ebab) - yuvrajjsingh0

- - -

## airborne_server-v0.10.2 - 2025-11-27
#### Bug Fixes
- CVE issues in built image - (9a3de2d) - yuvrajjsingh0

- - -

## airborne_server-v0.10.1 - 2025-11-19
#### Bug Fixes
- docs react package.json - (5f3e96d) - ayush.jain@juspay.in

- - -

## airborne_server-v0.10.0 - 2025-11-18
#### Bug Fixes
- error type in Org->App->User and added custom Result type - (990ba7c) - yuvrajjsingh0
#### Build system
- **(deps)** bump prismjs and react-syntax-highlighter - (582035e) - dependabot[bot]
- **(deps)** bump vite in /airborne_server/docs_react - (fff3ad2) - dependabot[bot]
#### Features
- add pagination to list packages and releases - (760909b) - Yash Rajput

- - -

## airborne_server-v0.9.0 - 2025-11-05
#### Features
- add super admin role support and ownership transfer in organisations - (401252d) - Yash Rajput

- - -

## airborne_server-v0.8.1 - 2025-11-04
#### Bug Fixes
- correct build version ordering using semver SQL functions - (a8cde24) - Yash Rajput

- - -

## airborne_server-v0.8.0 - 2025-10-28
#### Bug Fixes
- File download only when 2xx and unify download logic - (cd79b13) - yuvrajjsingh0
- username not present for google auth users - (0c50dfc) - Yash Rajput
#### Features
- inject gsa to aws using kms - (ab1724a) - yuvrajjsingh0

- - -

## airborne_server-v0.7.1 - 2025-10-22
#### Bug Fixes
- run db migrations under flag - (1d1beaf) - yuvrajjsingh0

- - -

## airborne_server-v0.7.0 - 2025-10-17
#### Features
- PICAF-30659: replace - with . in android manifest - (e5bb848) - george.james

- - -

## airborne_server-v0.6.1 - 2025-10-17
#### Bug Fixes
- not using aws endpoint since it is a reserved env - (e42a681) - george.james

- - -

## airborne_server-v0.6.0 - 2025-10-16
#### Bug Fixes
- aar content and structure fix - (c47ad68) - george.james
#### Features
- added airborne cli - (545c8a7) - yash.rajput.001
- make tag optional for files and packages - (dc88a99) - yash.rajput.001
- add access token authentication using client_id and client_secret - (9687906) - yash.rajput.001

- - -

## airborne_server-v0.5.1 - 2025-10-11
#### Bug Fixes
- Added android support for build generation - (9da7ce0) - george.james

- - -

## airborne_server-v0.5.0 - 2025-10-08
#### Features
- Added support to build zip files for iOS - (155c8f8) - george.james

- - -

## airborne_server-v0.4.2 - 2025-10-07
#### Bug Fixes
- add v2 release route - (8e73c36) - yuvrajjsingh0

- - -

## airborne_server-v0.4.1 - 2025-10-04
#### Bug Fixes
- node module dependancies corrected for npmjs - (0bb90db) - george.james

- - -

## airborne_server-v0.4.0 - 2025-10-04
#### Features
- diallow parallel releases in same dimensions - (88a4e99) - yuvrajjsingh0
- Support for Cohort dimensions - (0b34748) - yuvrajjsingh0

- - -

## airborne_server-v0.3.0 - 2025-10-03
#### Build system
- **(deps)** bump vite in /airborne_server/docs_react - (2cab12c) - dependabot[bot]
#### Features
- Application default config and auto population in release creation - (c11cc64) - yuvrajjsingh0
- add reveret and edit release - (881644f) - yash.rajput.001

- - -

## airborne_server-v0.2.0 - 2025-10-03
#### Features
- implemented user management - (a29091a) - yash.rajput.001

- - -

## airborne_server-v0.1.0 - 2025-10-01
#### Bug Fixes
- Respect toss from application for release - (1ca7fe9) - george.james
- update bundles in background using airborne - (71ea78c) - Yaswanth
#### Features
- offload blocking code to threadpool + implement tracing - (c1887e8) - yuvrajjsingh0
#### Miscellaneous Chores
- fix rebase misses - (ea91dd3) - ayush.jain@juspay.in
#### Refactoring
- Rename server to airborne_server - (3ff65b6) - ayush.jain@juspay.in

- - -

Changelog generated by [cocogitto](https://github.com/cocogitto/cocogitto).