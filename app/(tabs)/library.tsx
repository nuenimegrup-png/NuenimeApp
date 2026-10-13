import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LibraryView } from "@/components/library-view";

export default function LibraryTab() {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      <LibraryView
        variant="tab"
        initialTab="bookmarks"
        allowedTabs={["bookmarks", "alerts"]}
        showTopBar={true}
        headerTitle="Subscribe"
        headerSubtitle="Daftar anime langganan & favorit kamu"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
});

