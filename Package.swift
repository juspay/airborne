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
    targets: [
        .target(
            name: "AirborneObjC",
            dependencies: [],
            path: "airborne_sdk_iOS/hyper-ota/Airborne/AirborneObjC",
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("include"),
                .headerSearchPath("ApplicationManager/Constants"),
                .headerSearchPath("ApplicationManager/Tracker"),
                .headerSearchPath("Helper"),
                .headerSearchPath("Network/NetworkDetector")
            ],
        ),
        .target(
            name: "Airborne",
            dependencies: ["AirborneObjC"],
            path: "airborne_sdk_iOS/hyper-ota/Airborne/AirborneSwift"
        ),
        .testTarget(
            name: "AirborneTests",
            dependencies: ["Airborne"],
            path: "airborne_sdk_iOS/hyper-ota/Airborne/AirborneTest"
        ),
    ]
)
