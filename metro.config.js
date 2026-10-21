const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// ── Inline requires: modul di-evaluate saat pertama kali diakses ──
// Ini mempercepat cold start karena tidak semua modul di-load saat startup.
// Hanya berlaku saat production build (EAS Build / expo export).
config.transformer.inlineRequires = true;

module.exports = config;
