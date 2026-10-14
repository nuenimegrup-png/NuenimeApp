import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: true,
  },
  plugins: [
    {
      name: "mock-binary-assets",
      transform(_code, id) {
        if (/\.(gif|png|jpg|jpeg|webp|svg)$/i.test(id)) {
          return {
            code: "module.exports = 'mock-asset'; export default 'mock-asset';",
            map: null,
          };
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "expo-haptics": path.resolve(__dirname, "./tests/mocks/expo-haptics.ts"),
    },
  },
  test: { environment: "node" },
});
