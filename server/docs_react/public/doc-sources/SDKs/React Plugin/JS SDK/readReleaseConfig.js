import { readReleaseConfig } from 'airborne-react-native';

const handleReadReleaseConfig = async () => {
  try {
    const config = await readReleaseConfig('airborne-example');
    console.log(config);
  } catch (error) {
    console.error(error);
  }
};
