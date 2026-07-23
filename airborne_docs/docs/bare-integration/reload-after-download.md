---
title: Reload after a post-timeout update
description: Use the onPackageDownloaded callback in the bare Airborne flow to prompt users to reload when an update lands after the boot timeout, plus the boot_timeout 0 "always prompt" configuration.
---

This is the payoff of the [bare Airborne flow](/docs/bare-integration/overview): the native SDKs raise **`onPackageDownloaded`** when a new package finishes downloading, and you can use it to offer users a **"Reload now"** prompt so they get the update immediately — instead of waiting for the next natural app restart.

:::note[Prerequisites]
Complete the [React Native (bare)](/docs/bare-integration/react-native) or [Expo (bare)](/docs/bare-integration/expo) integration first. This page extends the `onPackageDownloaded` stub left in those pages.
:::

## When `onPackageDownloaded` fires

Recall the [download & boot flow](/docs/concepts/download-and-boot-flow): on launch the SDK races the package's important files against the **boot timeout**.

- **Downloaded within the boot timeout** — the package is applied on this run and React Native boots straight onto it. `onPackageDownloaded` is **not** the interesting case here; the user already has the update.
- **Downloaded *after* the boot timeout** — boot already happened on the previous package, so the freshly downloaded package is **staged**: written to disk and applied on the **next** Airborne initialization. `onPackageDownloaded(oldVersion, newVersion)` fires to tell you a newer package is ready but not yet running.

That second case is the one worth handling. Without any UX, the staged update only takes effect the next time the user cold-starts the app. By reacting to `onPackageDownloaded`, you can apply it now.

:::info[The callback delivers versions, not files]
`onPackageDownloaded(oldVersion, newVersion)` gives you the package version the app is currently running (`oldVersion`) and the one that was just staged (`newVersion`). It is delivered on a **background thread** on both platforms — dispatch any UI work to the main thread. Ignore it when `newVersion` is empty or equal to `oldVersion`.
:::

## Android — prompt and restart

Applying a staged package on Android means starting a fresh process: Airborne installs the staged files during its init on the next process start, before React Native loads them. `Activity.recreate()` is not enough — it does not re-run `Application.onCreate`.

Extend the `MainApplication` from [React Native (bare)](/docs/bare-integration/react-native): track the foreground activity (the download can land before any activity resumes), fill in `onPackageDownloaded`, and add the prompt + restart.

```kotlin
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import java.util.concurrent.atomic.AtomicReference

// Add to MainApplication:

@Volatile private var currentActivity: Activity? = null

/** A staged version awaiting a prompt; the download can finish before any Activity resumes. */
private val pendingPrompt = AtomicReference<String?>(null)

/** Call this from onCreate(), before loadReactNative(this). */
private fun trackForegroundActivity() {
    registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
        override fun onActivityResumed(activity: Activity) {
            currentActivity = activity
            showPendingPrompt(activity)   // drain a prompt that arrived before this resume
        }
        override fun onActivityPaused(activity: Activity) {
            if (currentActivity == activity) currentActivity = null
        }
        override fun onActivityDestroyed(activity: Activity) {
            if (currentActivity == activity) currentActivity = null
        }
        override fun onActivityCreated(activity: Activity, b: Bundle?) {}
        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityStopped(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, b: Bundle) {}
    })
}

/** Replace the logging stub from the integration page with this. */
private fun onPackageDownloaded(oldVersion: String, newVersion: String) {
    if (newVersion.isEmpty() || newVersion == oldVersion) return
    pendingPrompt.set(newVersion)
    // The download can land before MainActivity resumes; onActivityResumed drains it too.
    currentActivity?.let { showPendingPrompt(it) }
}

private fun showPendingPrompt(activity: Activity) {
    val staged = pendingPrompt.getAndSet(null) ?: return
    activity.runOnUiThread { promptForReload(activity, staged) }
}

private fun promptForReload(activity: Activity, newVersion: String) {
    AlertDialog.Builder(activity)
        .setTitle("Update ready")
        .setMessage("A new version ($newVersion) has downloaded. Reload now?")
        .setPositiveButton("Reload now") { _, _ -> restartProcess(activity) }
        .setNegativeButton("Later", null)
        .setCancelable(false)
        .show()
}

/**
 * The staged bundle is installed during Airborne's init on the next process start, before React
 * Native loads it — so restart the process rather than recreating the Activity.
 */
private fun restartProcess(activity: Activity) {
    val intent = activity.packageManager
        .getLaunchIntentForPackage(activity.packageName)!!
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    activity.startActivity(intent)
    activity.finish()
    Runtime.getRuntime().exit(0)
}
```

Wire the two callbacks in:

```kotlin
override fun onCreate() {
    super.onCreate()
    trackForegroundActivity()      // add this
    startAirborne()
    loadReactNative(this)
}
```

And point `HyperOTAServices`' callback at the new handler:

```kotlin
onPackageDownloaded = { old, new -> onPackageDownloaded(old, new) },
```

## iOS — prompt and re-initialize

iOS forbids programmatic process restart, so instead of killing the process you **re-create `AirborneServices`**. A fresh instance installs the staged package (moving it from temp into place) during its init, then fires `startApp(indexBundleURL:)` again with the new bundle URL — and the `reactStarted` guard in `bootReactNative` from [React Native (bare)](/docs/bare-integration/react-native) reloads JS onto it.

Extend the `AppDelegate`: fill in `onPackageDownloaded` and add `applyStagedUpdate()`.

```swift
// Replace the logging stub from the integration page with this.
func onPackageDownloaded(oldVersion: String, newVersion: String) {
    guard !newVersion.isEmpty, newVersion != oldVersion else { return }
    DispatchQueue.main.async { [weak self] in self?.promptForReload(version: newVersion) }
}

private func promptForReload(version: String) {
    guard let root = window?.rootViewController else { return }
    let alert = UIAlertController(
        title: "Update ready",
        message: "A new version (\(version)) has downloaded. Reload now?",
        preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "Later", style: .cancel))
    alert.addAction(UIAlertAction(title: "Reload now", style: .default) { [weak self] _ in
        self?.applyStagedUpdate()
    })
    root.present(alert, animated: true)
}

/**
 * Re-initialising AirborneServices installs the staged package during init and fires startApp()
 * again with the new bundle URL. bootReactNative's reactStarted guard reloads RN onto it.
 */
private func applyStagedUpdate() {
    airborne = AirborneServices(releaseConfigURL: RELEASE_CONFIG_URL, delegate: self)
}
```

No other changes are needed: `bootReactNative` already handles the second `startApp` by swapping `airborneBundleURL` and calling `RCTTriggerReloadCommandListeners`.

## Always prompt: set `boot_timeout` to `0`

By default a package that downloads quickly is applied **inline** during boot, so `onPackageDownloaded` only fires on the slower launches where the download crosses the boot timeout. If you want the reload prompt to appear **every time** there is a new package — a consistent "an update is ready" experience rather than an occasional one — release with **`boot_timeout: 0`**.

With a zero boot timeout the SDK never blocks boot waiting for downloads: React Native always boots immediately from the package already on disk, and any newer package always finishes *after* the (zero-length) timeout. It is therefore always **staged**, and `onPackageDownloaded` fires **every time** an update is available — so your prompt shows on every launch that has a pending update.

`boot_timeout` is a property of the **release config**, set when you create the release from the dashboard — the SDK integration does not change. See [Create & target a release](/docs/guides/create-and-target-a-release) and the [Releases](/docs/dashboard/releases) reference.

:::tip[Two supported strategies]
- **Seamless when possible, prompt when slow** — use a normal `boot_timeout` (e.g. a few seconds). Fast updates apply silently on cold start; only late ones prompt.
- **Always prompt** — set `boot_timeout: 0`. Cold start is never blocked, and every pending update surfaces a "Reload now" prompt via `onPackageDownloaded`.
:::

## See also

- [Download & boot flow](/docs/concepts/download-and-boot-flow) — how the boot timeout decides applied vs. staged.
- [Callbacks & events](/docs/react-native-sdk/reference/callbacks-and-events) — the wider event stream the SDK emits.
