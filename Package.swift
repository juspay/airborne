// swift-tools-version:5.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Airborne",
    platforms: [
        .iOS(.v12)
    ],
    products: [
        .library(
            name: "Airborne",
            targets: ["Airborne"]
        ),
    ],
    dependencies: [
        .package(name: "HyperCore", url: "https://github.com/juspay/hypercore-ios.git", .exact("0.1.3"))
    ],
    targets: [
        .target(
            name: "Airborne",
            dependencies: [
                "HyperCore"
            ],
            path: "iOS/hyper-ota/Airborne/Classes",
            publicHeadersPath: ".",
            cSettings: [
                .headerSearchPath("."),
                .headerSearchPath("ApplicationManager"),
                .headerSearchPath("ApplicationManager/AppConfig"),
                .headerSearchPath("ApplicationManager/AppManifest"),
                .headerSearchPath("ApplicationManager/AppPackage"),
                .headerSearchPath("ApplicationManager/AppResources"),
                .headerSearchPath("ApplicationManager/Constants"),
                .headerSearchPath("ApplicationManager/Resource"),
                .headerSearchPath("ApplicationManager/Tracker"),
            ]
        ),
    ]
)