import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const hash = s => createHash('sha256').update(s).digest('hex');
const manual = 'Manual integration: install airborne-react-native; add the Juspay Maven repository; replace DefaultReactNativeHost and DefaultReactActivityDelegate with Airborne hosts; initialize Airborne before React with app_version and a stable per-install toss. On iOS import AirborneReact, defer factory.startReactNative until AirborneDelegate.startApp, return its bundle URL, and copy release_config.json into the app bundle. Exact code: https://airborne.juspay.in/docs/react-native-sdk/integration/android-setup and https://airborne.juspay.in/docs/react-native-sdk/integration/ios-setup';
// Hosts a developer machine serves from: loopback, the Android emulator and Genymotion host aliases, mDNS names and private networks.
export function isLocalHost(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '10.0.2.2', '10.0.3.2'].includes(h) || h.endsWith('.local')) return true;
  const ip = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  return Boolean(ip) && (ip[1] === '10' || (ip[1] === '192' && ip[2] === '168') || (ip[1] === '172' && ip[2] >= 16 && ip[2] <= 31));
}
const networkConfig = hosts => `<?xml version="1.0" encoding="utf-8"?>
<!-- Added by airborne-devkit init. Development only: cleartext HTTP is allowed for these local hosts and nothing else.
     Serve a real deployment over HTTPS and delete this file and src/release/AndroidManifest.xml. -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
${hosts.map(host => `        <domain includeSubdomains="false">${host}</domain>`).join('\n')}
    </domain-config>
</network-security-config>
`;
const releaseManifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:networkSecurityConfig="@xml/network_security_config" />
</manifest>
`;
// Returns the Info.plist text with local networking allowed, or the same text when it already is.
export function allowLocalNetworking(plist) {
  if (/<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/.test(plist) || /<key>NSAllowsLocalNetworking<\/key>\s*<true\/>/.test(plist)) return plist;
  if (/<key>NSAllowsLocalNetworking<\/key>\s*<false\/>/.test(plist)) return plist.replace(/(<key>NSAllowsLocalNetworking<\/key>\s*)<false\/>/, '$1<true/>');
  const entry = '\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n';
  if (/<key>NSAppTransportSecurity<\/key>\s*<dict\s*\/>/.test(plist)) return plist.replace(/(<key>NSAppTransportSecurity<\/key>\s*)<dict\s*\/>/, `$1<dict>\n${entry}\t</dict>`);
  if (/<key>NSAppTransportSecurity<\/key>\s*<dict>/.test(plist)) return plist.replace(/(<key>NSAppTransportSecurity<\/key>\s*<dict>\s*)/, `$1${entry}`);
  const end = plist.lastIndexOf('</dict>');
  if (end < 0) throw new Error('Info.plist has no top-level dictionary');
  return `${plist.slice(0, end)}\t<key>NSAppTransportSecurity</key>\n\t<dict>\n${entry}\t</dict>\n${plist.slice(end)}`;
}
export function initProject(directory, options) {
  const root = fs.realpathSync(directory);
  const { organisation, application, endpoint, dryRun = false, sdk = '^0.45.0' } = options;
  for (const [key, value] of Object.entries({ organisation, application })) {
    if (!/^[a-zA-Z0-9_-]+$/.test(value || '')) throw new Error(`Invalid ${key}; use letters, numbers, _ or -`);
  }
  if (!/^[A-Za-z0-9._~:/\[\]@!&'()*+,;=%-]+$/.test(endpoint || '')) throw new Error('Endpoint contains unsafe native source characters');
  const url = new URL(endpoint);
  if (!['https:', 'http:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error('Endpoint must be an HTTP(S) origin/path without credentials, query or fragment');
  if (!/^[A-Za-z0-9.:[\]_-]+$/.test(url.hostname)) throw new Error('Unsafe endpoint host');
  const releaseURL = `${endpoint.replace(/\/$/, '')}/release/${organisation}/${application}`;
  const iosApplication = options.iosApplication || `${application}-ios`;
  if (!/^[a-zA-Z0-9_-]+$/.test(iosApplication) || iosApplication === application) throw new Error('iOS must use a valid, distinct application scope');
  const iosReleaseURL = `${endpoint.replace(/\/$/, '')}/release/${organisation}/${iosApplication}`;
  const nativeSdkProject = options.androidSdkProject ? fs.realpathSync(options.androidSdkProject) : null;
  if (nativeSdkProject && (!/^[a-zA-Z0-9_./ -]+$/.test(nativeSdkProject) || !fs.existsSync(path.join(nativeSdkProject, 'build.gradle')))) throw new Error('Android SDK project must be a local Airborne Gradle module');
  const iosSdkProject = options.iosSdkProject ? fs.realpathSync(options.iosSdkProject) : null;
  if (iosSdkProject && (!/^[a-zA-Z0-9_./ -]+$/.test(iosSdkProject) || !fs.existsSync(path.join(iosSdkProject, 'Airborne.podspec')))) throw new Error('iOS SDK project must contain Airborne.podspec');
  const statePath = path.join(root, '.airborne-init.json');
  const journal = path.join(root, '.airborne-init-pending.json');
  // Recover a process interruption before inspecting partially installed files.
  const recover = () => {
    if (!fs.existsSync(journal)) return;
    if (fs.lstatSync(journal).isSymbolicLink()) throw new Error('Refusing linked recovery journal');
    for (const item of JSON.parse(fs.readFileSync(journal))) {
      const dest = path.resolve(root, item.file);
      if (!dest.startsWith(root + path.sep)) throw new Error('Invalid init recovery path');
      let current = root;
      for (const part of path.relative(root, dest).split(path.sep)) {
        current = path.join(current, part);
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Refusing linked recovery path');
      }
      if (item.before === null) fs.rmSync(dest, { force: true });
      else fs.writeFileSync(dest, Buffer.from(item.before, 'base64'));
      fs.rmSync(dest + '.airborne-stage', { force: true });
    }
    fs.rmSync(journal);
  };
  if (!dryRun) recover();
  else if (fs.existsSync(journal)) throw new Error('Interrupted init; rerun without --dry-run to recover first');
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath));
    if (state.releaseURL !== releaseURL || state.iosReleaseURL !== iosReleaseURL || (state.nativeSdkProject ? path.resolve(root, state.nativeSdkProject) : null) !== nativeSdkProject || (state.iosSdkProject ? path.resolve(root, state.iosSdkProject) : null) !== iosSdkProject) throw new Error('Already initialized for another endpoint/application; review native configuration manually.');
    for (const [file, digest] of Object.entries(state.files)) {
      if (file === 'package.json' && state.sdk && JSON.parse(fs.readFileSync(path.join(root, file))).dependencies?.['airborne-react-native'] === state.sdk) continue;
      if (!fs.existsSync(path.join(root, file)) || hash(fs.readFileSync(path.join(root, file))) !== digest) throw new Error(`Initialized file changed: ${file}. Review manually before reinitializing.`);
    }
    return 'Airborne already initialized; no changes.\n';
  }
  const planned = new Map();
  const read = file => {
    const full = path.join(root, file);
    if (!full.startsWith(root + path.sep) || fs.lstatSync(full).isSymbolicLink()) throw new Error(`Refusing linked file: ${file}`);
    return fs.readFileSync(full, 'utf8');
  };
  const replace = (s, anchor, value, file) => {
    if (s.split(anchor).length !== 2) throw new Error(`Unsupported ${file}: expected exactly one ${JSON.stringify(anchor)}.\n${manual}`);
    return s.replace(anchor, () => value);
  };
  const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  const unique = (files, suffix) => {
    const found = files.filter(f => f.endsWith(suffix));
    if (found.length !== 1) throw new Error(`Expected one ${suffix}; found ${found.length}.\n${manual}`);
    return found[0];
  };
  const normalize = text => text.replace(/\/\/[^\n]*/g, '').replace(/package [a-zA-Z0-9_.]+/, 'package APP').replace(/"(?:Kharcha|HelloWorld)"/g, '"APP"').replace(/\s+/g, '');
  const shape = (text, name) => normalize(text) === normalize(fs.readFileSync(new URL(`./shapes/${name}`, import.meta.url), 'utf8'));
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.dependencies?.['react-native'] || pkg.dependencies.expo) throw new Error(`Requires a bare React Native app.\n${manual}`);
  pkg.dependencies['airborne-react-native'] ||= sdk;
  planned.set('package.json', JSON.stringify(pkg, null, 2) + '\n');
  const android = walk('android/app/src/main/java');
  const main = unique(android, '/MainApplication.kt');
  let s = read(main);
  if (!shape(s, 'MainApplication.kt')) throw new Error(`Unsupported ${main}.\n${manual}`);
  s = replace(s, 'import com.facebook.react.defaults.DefaultReactNativeHost', 'import `in`.juspay.airborneplugin.Airborne\nimport `in`.juspay.airborneplugin.AirborneInterface\nimport `in`.juspay.airborneplugin.AirborneReactNativeHost\nimport `in`.juspay.airborneplugin.AirborneReactNativeHostBase', main);
  s = replace(s, 'object : DefaultReactNativeHost(this) {', 'object : AirborneReactNativeHost(this@MainApplication) {\n        override fun getJSBundleFile(): String? = airborneInstance.getBundlePath()', main);
  s = replace(s, 'getDefaultReactHost(applicationContext, reactNativeHost)', 'AirborneReactNativeHostBase.getReactHost(applicationContext, reactNativeHost)', main);
  s = replace(s, 'class MainApplication : Application(), ReactApplication {', `class MainApplication : Application(), ReactApplication {
  private lateinit var airborneInstance: Airborne
  private fun initializeAirborne() {
    val prefs = getSharedPreferences("airborne", MODE_PRIVATE)
    if (!prefs.contains("toss")) prefs.edit().putInt("toss", (0..99).random()).commit()
    airborneInstance = Airborne(this, ${JSON.stringify(releaseURL + '?toss=')} + prefs.getInt("toss", 0), object : AirborneInterface() {
      override fun getNamespace(): String = ${JSON.stringify(application)}
      override fun getDimensions(): HashMap<String, String> = hashMapOf("app_version" to BuildConfig.VERSION_NAME)
    })
  }`, main);
  s = replace(s, '    super.onCreate()', '    super.onCreate()\n    initializeAirborne()', main);
  planned.set(main, s);
  const activity = unique(android, '/MainActivity.kt');
  s = read(activity);
  // Preserve the app's registered JS component name while checking native structure.
  const activityShape = s.replace(/getMainComponentName\(\): String = "[^"]+"/, 'getMainComponentName(): String = "Kharcha"');
  if (!shape(activityShape, 'MainActivity.kt')) throw new Error(`Unsupported ${activity}.\n${manual}`);
  s = replace(s, 'import com.facebook.react.defaults.DefaultReactActivityDelegate', 'import `in`.juspay.airborneplugin.AirborneReactActivityDelegate', activity);
  s = replace(s, 'DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)', 'AirborneReactActivityDelegate(this, mainComponentName, fabricEnabled)', activity);
  planned.set(activity, s);
  const gradle = 'android/build.gradle';
  s = read(gradle);
  if (s.includes('maven.juspay.in')) throw new Error('Existing Juspay Gradle configuration requires manual review');
  s += '\nallprojects { repositories { maven { url "https://maven.juspay.in/jp-build-packages/hyper-sdk/" } } }\n';
  if (nativeSdkProject) {
    const settings = 'android/settings.gradle';
    let settingsText = read(settings);
    if (settingsText.includes(":airborne")) throw new Error('Existing Airborne SDK project requires manual review');
    settingsText += `\ninclude ':airborne'\nproject(':airborne').projectDir = new File(${JSON.stringify(nativeSdkProject)})\n`;
    planned.set(settings, settingsText);
    s += `\nbuildscript {
      ext { airborne_version = "2.2.8-local"; airborne_build_version = "" }
      dependencies { classpath("com.gradleup.nmcp:nmcp:1.0.3") }
    }
    allprojects {
      configurations.configureEach {
        resolutionStrategy.dependencySubstitution {
          substitute module('io.juspay:airborne') using project(':airborne')
        }
      }
    }
    project(':airborne') {
      tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions.jvmTarget = '17'
      }
    }\n`;
  }
  planned.set(gradle, s);
  const ios = unique(walk('ios').filter(f => !f.includes('/Pods/')), '/AppDelegate.swift');
  s = read(ios);
  const iosShape = s.replace(/(self.moduleName = |withModuleName: )"[^"]+"/g, '$1"Kharcha"');
  if (!shape(iosShape, 'ios-078.swift') && !shape(iosShape, 'ios-079.swift')) throw new Error(`Unsupported ${ios}.\n${manual}`);
  if (s.includes('class AppDelegate: RCTAppDelegate')) {
    const module = s.match(/self.moduleName = "([A-Za-z0-9_]+)"/);
    if (!module || (s.match(/func /g) || []).length !== 3 || s.includes('Airborne')) throw new Error(`Unsupported ${ios}.\n${manual}`);
    s = `import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AirborneReact

@main
class AppDelegate: RCTAppDelegate, AirborneDelegate {
  private var airborne: Airborne?
  private var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  private var customPath: URL?
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    self.moduleName = "${module[1]}"
    self.dependencyProvider = RCTAppDependencyProvider()
    self.initialProps = [:]
    self.launchOptions = launchOptions
    let defaults = UserDefaults.standard
    if defaults.object(forKey: "airborne_toss") == nil { defaults.set(Int.random(in: 0...99), forKey: "airborne_toss") }
    airborne = Airborne(releaseConfigURL: "${iosReleaseURL}?toss=\\(defaults.integer(forKey: "airborne_toss"))", delegate: self)
    return true
  }
  func namespace() -> String { "${iosApplication}" }
  func bundle() -> Bundle { Bundle.main }
  func dimensions() -> [String: String] { ["app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""] }
  func onEvent(level: String, label: String, key: String, value: [String: Any], category: String, subcategory: String) { print("Airborne: \\(key)") }
  func startApp(indexBundleURL: URL?) {
    DispatchQueue.main.async { [self] in
      customPath = indexBundleURL
      startReactNative()
    }
  }
  private func startReactNative() {
    _ = super.application(UIApplication.shared, didFinishLaunchingWithOptions: self.launchOptions)
  }
  override func sourceURL(for bridge: RCTBridge) -> URL? { customPath }
  override func bundleURL() -> URL? { customPath }
}
`;
  } else {
  if (!s.includes('class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate') || !s.includes('factory.startReactNative(')) throw new Error(`Unsupported ${ios}.\n${manual}`);
  const module = s.match(/withModuleName: "([A-Za-z0-9_]+)"/);
  const launch = s.indexOf('    let delegate = ReactNativeDelegate()');
  const end = s.indexOf('    return true', launch);
  if (!module || launch < 0 || end < 0 || s.includes('Airborne')) throw new Error(`Unsupported ${ios}.\n${manual}`);
  const boot = s.slice(launch, end).replace('ReactNativeDelegate()', 'ReactNativeDelegate(customPath: indexBundleURL)').replace('launchOptions: launchOptions', 'launchOptions: self.launchOptions');
  s = s.slice(0, launch) + `    self.launchOptions = launchOptions
    window = UIWindow(frame: UIScreen.main.bounds)
    let defaults = UserDefaults.standard
    if defaults.object(forKey: "airborne_toss") == nil { defaults.set(Int.random(in: 0...99), forKey: "airborne_toss") }
    airborne = Airborne(releaseConfigURL: "${iosReleaseURL}?toss=\\(defaults.integer(forKey: "airborne_toss"))", delegate: self)
` + s.slice(end);
  s = replace(s, 'import UIKit', 'import UIKit\nimport AirborneReact', ios);
  s = replace(s, '  var window: UIWindow?', '  private var airborne: Airborne?\n  private var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n  var window: UIWindow?', ios);
  const delegateStart = s.indexOf('class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate');
  s = s.slice(0, delegateStart) + `extension AppDelegate: AirborneDelegate {
  func namespace() -> String { "${iosApplication}" }
  func bundle() -> Bundle { Bundle.main }
  func dimensions() -> [String: String] { ["app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""] }
  func onEvent(level: String, label: String, key: String, value: [String: Any], category: String, subcategory: String) { print("Airborne: \\(key)") }
  func startApp(indexBundleURL: URL?) {
    DispatchQueue.main.async { [self] in
${boot}
    }
  }
}
class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  private let customPath: URL?
  init(customPath: URL?) { self.customPath = customPath; super.init() }
  override func sourceURL(for bridge: RCTBridge) -> URL? { customPath }
  override func bundleURL() -> URL? { customPath }
}
`;
  }
  planned.set(ios, s);
  const podfile = 'ios/Podfile';
  s = read(podfile);
  if (!s.includes('use_react_native!(') || s.includes('post_integrate') || s.includes('resource_bundles')) throw new Error(`Unsupported Podfile.\n${manual}`);
  s = replace(s, 'post_install do |installer|', 'post_install do |installer|\n' + "    # Xcode 27's libc++ rejects fmt's consteval parser on Apple Clang.\n    fmt_header = installer.sandbox.root + 'fmt/include/fmt/base.h'\n    if fmt_header.exist? && `xcodebuild -version`[/Xcode (\\d+)/, 1].to_i >= 27\n      File.chmod(0644, fmt_header)\n      text = File.read(fmt_header)\n      text = text.sub('#if !defined(__cpp_lib_is_constant_evaluated)',\n                      '#if defined(__apple_build_version__) || !defined(__cpp_lib_is_constant_evaluated)')\n      File.write(fmt_header, text) unless File.read(fmt_header) == text\n    end\n\n", podfile);
  s = replace(s, "linkage = ENV['USE_FRAMEWORKS']", "linkage = ENV.fetch('USE_FRAMEWORKS', 'static')\nlinkage = nil if linkage.empty?", podfile);
  if (iosSdkProject) s = replace(s, '  config = use_native_modules!', `  config = use_native_modules!\n  pod 'Airborne', :path => ${JSON.stringify(iosSdkProject)}`, podfile);
  // CocoaPods resources are copied into the application target, unlike a file merely placed in ios/.
  s += `\n# Airborne fallback resource\npost_integrate do |installer|\n  installer.aggregate_targets.map(&:user_project).uniq.each do |project|\n    project.native_targets.select { |t| t.product_type == 'com.apple.product-type.application' }.each do |target|\n      ref = project.files.find { |f| f.path == 'release_config.json' } || project.main_group.new_file('release_config.json')\n      target.resources_build_phase.add_file_reference(ref) unless target.resources_build_phase.files_references.include?(ref)\n    end\n    project.save\n  end\nend\n`;
  planned.set(podfile, s);
  // A release build silently serves the bundled JS when the platform blocks plain HTTP, so say what was done.
  const notes = [];
  if (url.protocol === 'http:') {
    if (!isLocalHost(url.hostname)) {
      notes.push(`Warning: ${url.origin} is plain HTTP on a non-local host. Android and iOS release builds block it and the app silently runs its bundled JS. Use HTTPS; nothing was added to allow cleartext.`);
    } else {
      const cleartextHosts = [...new Set([url.hostname, 'localhost', '127.0.0.1', '10.0.2.2'])].filter(h => !h.includes(':'));
      const configFile = 'android/app/src/release/res/xml/network_security_config.xml';
      const overlay = 'android/app/src/release/AndroidManifest.xml';
      const mainManifest = path.join(root, 'android/app/src/main/AndroidManifest.xml');
      if (fs.existsSync(path.join(root, configFile)) || fs.existsSync(path.join(root, overlay)) || (fs.existsSync(mainManifest) && read('android/app/src/main/AndroidManifest.xml').includes('networkSecurityConfig'))) {
        notes.push(`Warning: Android already has a network security configuration; add cleartext for ${cleartextHosts.join(', ')} yourself or release builds will run bundled JS.`);
      } else {
        planned.set(configFile, networkConfig(cleartextHosts));
        planned.set(overlay, releaseManifest);
        notes.push(`Android release builds may use cleartext HTTP to ${cleartextHosts.join(', ')} only (android/app/src/release/res/xml/network_security_config.xml). Development only; use HTTPS elsewhere.`);
      }
      const plists = walk('ios').filter(f => !f.includes('/Pods/') && f.endsWith('/Info.plist'));
      if (plists.length !== 1) throw new Error(`Expected one Info.plist under ios/; found ${plists.length}.\n${manual}`);
      const plist = read(plists[0]);
      const allowed = allowLocalNetworking(plist);
      if (allowed === plist) notes.push(`iOS ${plists[0]} already allows local networking; left unchanged.`);
      else {
        planned.set(plists[0], allowed);
        notes.push(`iOS ${plists[0]} now sets NSAllowsLocalNetworking so the simulator can use ${url.origin}. Development only; use HTTPS elsewhere.`);
      }
    }
  }
  const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const localProperties = path.join(root, 'android/local.properties');
  if (!sdkDir && !(fs.existsSync(localProperties) && /^sdk\.dir\s*=/m.test(fs.readFileSync(localProperties, 'utf8')))) {
    notes.push('Note: ANDROID_HOME is not set and android/local.properties has no sdk.dir, so ./gradlew will stop with "SDK location not found". Set ANDROID_HOME to your Android SDK (macOS default: $HOME/Library/Android/sdk).');
  }
  const config = { hermes_enabled: true, expo: false, js_entry_file: 'index.js' };
  for (const platform of ['android', 'ios']) {
    config[platform] = { organisation, namespace: platform === 'ios' ? iosApplication : application, index_file_path: platform === 'android' ? 'index.android.bundle' : 'main.jsbundle' };
    const file = platform === 'android' ? `android/app/src/main/assets/${application}/release_config.json` : 'ios/release_config.json';
    planned.set(file, JSON.stringify({ version: '1', config: { version: '1', boot_timeout: 4000, release_config_timeout: 4000, properties: {} }, package: { name: config[platform].namespace, version: '1', index: { file_path: config[platform].index_file_path, url: '', checksum: '' }, important: [], lazy: [], properties: {} }, resources: [] }, null, 2) + '\n');
  }
  planned.set('airborne-config.json', JSON.stringify(config, null, 2) + '\n');
  for (const file of ['airborne-config.json', 'ios/release_config.json', `android/app/src/main/assets/${application}/release_config.json`]) if (fs.existsSync(path.join(root, file))) throw new Error(`Refusing existing ${file}; merge manually.`);
  for (const file of planned.keys()) {
    let current = root;
    for (const part of file.split('/')) { current = path.join(current, part); if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`Refusing linked path: ${file}`); }
  }
  let diff = '';
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'airborne-init-'));
  try {
    for (const [file, after] of planned) {
      const before = fs.existsSync(path.join(root, file)) ? read(file) : '';
      fs.writeFileSync(path.join(temp, 'before'), before); fs.writeFileSync(path.join(temp, 'after'), after);
      const result = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--', path.join(temp, 'before'), path.join(temp, 'after')], { encoding: 'utf8' });
      if (result.status !== 0 && result.status !== 1) throw new Error('Cannot generate dry-run diff');
      diff += result.stdout.replaceAll(`a${path.join(temp, 'before')}`, `a/${file}`).replaceAll(`b${path.join(temp, 'after')}`, `b/${file}`).replaceAll(path.join(temp, 'before'), file).replaceAll(path.join(temp, 'after'), file);
    }
    if (!dryRun) {
      const state = JSON.stringify({ releaseURL, iosReleaseURL, sdk: pkg.dependencies['airborne-react-native'], nativeSdkProject: nativeSdkProject ? path.relative(root, nativeSdkProject) : null, iosSdkProject: iosSdkProject ? path.relative(root, iosSdkProject) : null, files: Object.fromEntries([...planned].map(([file, content]) => [file, hash(content)])) }, null, 2) + '\n';
      const outputs = [...planned, ['.airborne-init.json', state]];
      const originals = outputs.map(([file]) => ({ file, before: fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file)).toString('base64') : null }));
      fs.writeFileSync(journal, JSON.stringify(originals), { flag: 'wx', mode: 0o600 });
      try {
        for (const [file, after] of outputs) {
          const dest = path.join(root, file);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const previousMode = fs.existsSync(dest) ? fs.statSync(dest).mode & 0o777 : undefined;
          fs.writeFileSync(dest + '.airborne-stage', after, { flag: 'wx', mode: previousMode ?? 0o644 });
          if (previousMode !== undefined) fs.chmodSync(dest + '.airborne-stage', previousMode);
        }
        for (const [file] of outputs) fs.renameSync(path.join(root, file) + '.airborne-stage', path.join(root, file));
        fs.rmSync(journal);
      } catch (error) { recover(); throw error; }
    }
  } finally { fs.rmSync(temp, { recursive: true }); }
  const report = notes.length ? `\n${notes.join('\n')}\n` : '';
  return diff + report + (dryRun ? '\nDry run; no files written.\n' : '\nInstall dependencies, run pod install, and rebuild the native app.\n');
}
