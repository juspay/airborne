# iOS SDK Developer Docs

This document provides instructions on how to integrate the Airborne iOS SDK into your application.

## Installation

(Instructions for installation will be added here.)

## iOS Integration

To integrate the Airborne SDK on iOS, you need to initialize it in your `AppDelegate.swift` or the main `ViewController.swift` file.

1.  **Import Airborne:** Add `import Airborne` to the top of your file.
2.  **Initialize AirborneServices:** Create an instance of `AirborneServices` within your `viewDidLoad` method (or equivalent entry point), providing your release configuration URL and a delegate.

An example of how to initialize the SDK is available in the code file on the right.

### `AirborneServices` Parameters

-   `releaseConfigURL`: The URL for fetching release configurations.
-   `delegate`: A delegate that conforms to the `AirborneDelegate` protocol to handle events.
