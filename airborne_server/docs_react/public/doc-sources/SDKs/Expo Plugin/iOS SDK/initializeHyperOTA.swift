// Step 3: Create initializeHyperOTA function in AppDelegate

private func initializeHyperOTA() {
    airborne = Airborne(
        releaseConfigURL: "https://airborne.juspay.in/release/<organisation>/<application/namespace-name>",
        delegate: self
    )
    print("HyperOTA: Initialized successfully")
}
