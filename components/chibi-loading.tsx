import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";

export const CHIBI_LOADING_IMAGE = require("@/assets/images/loading-chibi.png");

interface ChibiLoadingProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  label?: string;
  subtitle?: string;
}

export function ChibiLoading({
  size = 72,
  style,
  label,
  subtitle,
}: ChibiLoadingProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.View
        style={[
          styles.imageContainer,
          { transform: [{ translateY: floatAnim }] },
        ]}
      >
        <Image
          source={CHIBI_LOADING_IMAGE}
          style={{ width: size, height: size }}
          contentFit="contain"
          priority="high"
          cachePolicy="memory-disk"
        />
      </Animated.View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
});

