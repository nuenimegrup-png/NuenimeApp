import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";

export default function AuthScreen() {
  useEffect(() => {
    router.replace("/(tabs)" as never);
  }, []);

  return <View style={{ flex: 1, backgroundColor: "#0B0E17" }} />;
}
