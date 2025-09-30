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
            targets: ["AirborneSwift"]
        ),
    ],
    targets: [
        .target(
            name: "AirborneObjC",
            dependencies: [],
            path: "airborne_sdk_iOS/hyper-ota/Airborne/AirborneObjC",
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("ApplicationManager/Constants"),
                .headerSearchPath("ApplicationManager/Tracker"),
                .headerSearchPath("Helper"),
                .headerSearchPath("Network/NetworkDetector"),
                .define("SPM_BUILD", to: "1")
            ]
        ),
        .target(
            name: "AirborneSwift",
            dependencies: ["AirborneObjC"],
            path: "airborne_sdk_iOS/hyper-ota/Airborne/AirborneSwift",
            cSettings: [
                .define("SPM_BUILD", to: "1")
            ]
        ),
        .testTarget(
            name: "AirborneTests",
            dependencies: ["AirborneSwift"],
            path: "airborne_sdk_iOS/hyper-ota/Airborne/AirborneTest",
            cSettings: [
                .define("SPM_BUILD", to: "1")
            ]
        ),
    ]
)
