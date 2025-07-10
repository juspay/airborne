import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export interface UserProfileProps {
  name: string;
  avatarUrl?: string;
  bio?: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ name, avatarUrl, bio }) => (
  <View style={styles.container}>
    {avatarUrl && <Image source={{ uri: avatarUrl }} style={styles.avatar} />}
    <Text style={styles.name}>{name}</Text>
    {bio && <Text style={styles.bio}>{bio}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  bio: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
});

export default UserProfile;