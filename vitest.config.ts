import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "expo-haptics": path.resolve(__dirname, "./tests/mocks/expo-haptics.ts"),
    },
  },
  test: { environment: "node" },
});
