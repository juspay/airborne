import { getBundlePath } from 'airborne-react-native';

const handleGetBundlePath = async () => {
  try {
    const path = await getBundlePath('airborne-example');
    console.log(path);
  } catch (error) {
    console.error(error);
  }
};
