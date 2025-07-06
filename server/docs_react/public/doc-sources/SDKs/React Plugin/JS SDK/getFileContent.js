import { getFileContent } from 'airborne-react-native';

const handleGetFileContent = async () => {
  try {
    const content = await getFileContent('test.js');
    console.log(content);
  } catch (error) {
    console.error(error);
  }
};
