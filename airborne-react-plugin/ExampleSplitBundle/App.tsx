import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  useColorScheme,
  Button,
  Alert,
} from 'react-native';
import UserProfile from './user-profile';
import {
  readReleaseConfig,
  getFileContent,
  getBundlePath,
} from 'airborne-react-native';

const App: React.FC = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = createStyles(isDark);
  const STYLES = ['default', 'dark-content', 'light-content'] as const;

  const statusBarStyle = STYLES[0];

  const [showProfile, setShowProfile] = useState(false);
  const [releaseConfig, setReleaseConfig] = useState<string | undefined>();
  const [bundlePath, setBundlePath] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<string | undefined>();
  const [isInitialized, setIsInitialized] = useState(false);

  // Airborne is initialized in native code (MainApplication.kt for Android, AppDelegate.swift for iOS)
  // This ensures the instance is ready before React Native starts

  useEffect(() => {
    // Test if Airborne is initialized by trying to get the bundle path
    getBundlePath()
      .then(() => setIsInitialized(true))
      .catch(() => setIsInitialized(false));
  }, []);

  const handleReadReleaseConfig = async () => {
    try {
      const config = await readReleaseConfig();
      setReleaseConfig(config);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to read release config');
    }
  };

  const handleGetBundlePath = async () => {
    try {
      const path = await getBundlePath();
      setBundlePath(path);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get bundle path');
    }
  };

  const handleGetFileContent = async () => {
    try {
      const content = await getFileContent('test.js');
      setFileContent(content);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get file content');
    }
  };

  if (showProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <React.Suspense fallback={<Text>Loading...</Text>}>
          <UserProfile
            name="Jane Doe"
            avatarUrl="https://example.com/avatar.jpg"
            bio="React Native developer and coffee lover."
          />
        </React.Suspense>
        <Button title="Back" onPress={() => setShowProfile(false)} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar
          animated={true}
          backgroundColor="#61dafb"
          barStyle={statusBarStyle}
        />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.header}>Welcome to ExampleSplitBundle with Airborne! 🚀</Text>
          <Text style={styles.subheader}>OTA Updates + Split Bundles 🎉</Text>

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Airborne Status: {isInitialized ? '✅ Initialized' : '❌ Not Initialized'}
            </Text>
          </View>

          <View style={styles.section}>
            <Button title="Read Release Config" onPress={handleReadReleaseConfig} />
            {releaseConfig && (
              <Text style={styles.result}>Release Config: {releaseConfig}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Button title="Get Bundle Path" onPress={handleGetBundlePath} />
            {bundlePath && (
              <Text style={styles.result}>Bundle Path: {bundlePath}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Button
              title="Get File Content (test.js)"
              onPress={handleGetFileContent}
            />
            {fileContent && (
              <Text style={styles.result}>File Content: {fileContent}</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Split Bundle Demo 🌎</Text>
            <Text style={styles.cardContent}>
              This app demonstrates both Airborne OTA updates and split bundle functionality! 😃
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => { setShowProfile(true); }}
            >
              <Text style={styles.buttonText}>View User Profile 👉</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by React Native + Airborne ❤️</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

// Dynamic styles based on theme
const createStyles = (dark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: dark ? '#121212' : '#f5f5f5',
    },
    statusContainer: {
      marginBottom: 20,
      padding: 10,
      backgroundColor: '#f0f0f0',
      borderRadius: 8,
    },
    statusText: {
      fontSize: 16,
      fontWeight: '600',
    },
    section: {
      marginVertical: 10,
      alignItems: 'center',
      width: '100%',
    },
    result: {
      marginTop: 10,
      fontSize: 16,
      textAlign: 'center',
      color: '#333',
    },
    toolbar: {
      height: 56,
      backgroundColor: dark ? '#1f1f1f' : '#ffffff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dark ? '#333' : '#ccc',
    },
    toolbarTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: dark ? '#fff' : '#333',
    },
    toolbarAction: {
      fontSize: 20,
    },
    scroll: {
      padding: 20,
      alignItems: 'center',
    },
    header: {
      fontSize: 32,
      fontWeight: 'bold',
      color: dark ? '#fff' : '#333',
      marginTop: 10,
    },
    subheader: {
      fontSize: 18,
      color: dark ? '#ccc' : '#666',
      marginBottom: 20,
    },
    card: {
      backgroundColor: dark ? '#1e1e1e' : '#fff',
      borderRadius: 12,
      padding: 20,
      width: '100%',
      shadowColor: dark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 3,
      marginBottom: 20,
    },
    cardTitle: {
      fontSize: 24,
      fontWeight: '600',
      marginBottom: 10,
      color: dark ? '#fff' : '#222',
    },
    cardContent: {
      fontSize: 16,
      color: dark ? '#ddd' : '#444',
      marginBottom: 20,
    },
    button: {
      backgroundColor: '#4CAF50',
      paddingVertical: 12,
      borderRadius: 8,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '500',
      textAlign: 'center',
    },
    footer: {
      marginTop: 40,
    },
    footerText: {
      color: dark ? '#888' : '#999',
      fontSize: 14,
    },
  });

export default App;
