import { getBundlePath } from "airborne-react-native";

const handleGetBundlePath = async () => {
  try {
    const path = await getBundlePath();
    console.log(path);
  } catch (error) {
    console.error(error);
  }
};
