import React from "react";
import { StyleSheet, View } from "react-native";

export function DuniaView({
  url,
  onLoadProgress,
  onLoadEnd,
  onError,
  onMessage,
}: {
  url: string;
  onLoadProgress?: (progress: number) => void;
  onLoadEnd?: () => void;
  onError?: (err: any) => void;
  onMessage?: (data: any) => void;
}) {
  React.useEffect(() => {
    if (typeof window === "undefined" || !onMessage) return;
    const handleMsg = (e: MessageEvent) => {
      onMessage(e.data);
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, [onMessage]);

  return (
    <View style={styles.container}>
      <iframe
        src={url}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "#0F1115",
        } as any}
        title="Dunia Nuenime RPG"
        onLoad={() => {
          onLoadProgress?.(1);
          onLoadEnd?.();
        }}
        onError={(e) => {
          onError?.(e);
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
});
