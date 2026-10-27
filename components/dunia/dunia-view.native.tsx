import React, { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

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
  const webViewRef = useRef<WebView>(null);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        androidLayerType="hardware"
        mixedContentMode="always"
        overScrollMode="never"
        renderToHardwareTextureAndroid={true}
        nestedScrollEnabled={false}
        onLoadProgress={({ nativeEvent }) => {
          onLoadProgress?.(nativeEvent.progress);
        }}
        onLoadEnd={() => {
          onLoadEnd?.();
        }}
        onError={(syntheticEvent) => {
          onError?.(syntheticEvent.nativeEvent);
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            onMessage?.(data);
          } catch {
            onMessage?.(event.nativeEvent.data);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
  webView: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
});
