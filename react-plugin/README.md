# react-native-airborne

airborne

## Installation

```sh
npm install react-native-airborne
```

# React Native Airborne Implementation Summary

This implementation provides a React Native module for Airborne that:
1. Initializes Airborne in native code (iOS/Android)
2. Provides React Native methods to access the native Airborne instance
3. Is compatible with both old and new React Native architectures

## Key Features

### Native Initialization
- Airborne should be initialized once in native code when the app starts
- The instance should be created before React Native initializes
- This ensures the Airborne instance is ready when React Native needs it

### Architecture Compatibility
- **Old Architecture**: Uses traditional React Native bridge (`AirborneModule`)
- **New Architecture**: Uses TurboModules with JSI (`AirborneTurboModule`)
- Automatically detects and uses the appropriate implementation

### Shared Implementation
- Android uses `AirborneModuleImpl` to share logic between architectures
- iOS uses `AirborneiOS` wrapper to manage the native instance
- Both platforms follow the same initialization pattern

## File Structure

### Android
- `Airborne.kt` - Integration class for Airborne SDK
- `AirborneInterface.kt` - The interface that has to be implemented by the consumer for providing all the necessary integration params.
- `AirborneModuleImpl.kt` - Shared implementation logic
- `AirborneModule.kt` - Old architecture module
- `AirborneTurboModule.kt` - New architecture module
- `NativeAirborneSpec.java` - TurboModule spec

### iOS
- `AirborneiOS.h/m` - Integration class for Airborne SDK
- `Airborne.h/mm` - React Native module implementation
- Supports both architectures with conditional compilation

### JavaScript/TypeScript
- `NativeAirborne.ts` - TurboModule TypeScript spec
- `index.tsx` - Module exports with architecture detection

## API Methods

1. **readReleaseConfig()** - Returns the release configuration as a stringified JSON
2. **getFileContent(filePath)** - Reads content from a file in the OTA bundle
3. **getBundlePath()** - Returns the path to the JavaScript bundle

## Usage

### Native Initialization



### React Native Usage
```typescript
import { readReleaseConfig, getFileContent, getBundlePath } from 'react-native-Airborne';

// Read configuration
const config = await readReleaseConfig();

// Get file content
const content = await getFileContent('path/to/file.json');

// Get bundle path
const bundlePath = await getBundlePath();
```

## Implementation Notes

1. **Thread Safety**: Both Android and iOS implementations are thread-safe
2. **Error Handling**: All methods return promises that reject with descriptive errors
3. **Placeholder Implementation**: The iOS implementation includes placeholders for the actual Airborne SDK integration

## Next Steps

To complete the integration:
1. Implement additional Airborne features as needed
2. Add event emitters for callbacks if required

## Testing

The example app demonstrates:
- Native initialization in MainApplication/AppDelegate
- Using all three API methods
- Status indicator showing initialization state
- Error handling for failed operations
