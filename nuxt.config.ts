import pkg from "./package.json";

export default defineNuxtConfig({
  devServer: {
    port: 3100,
  },

  modules: ["@nuxt/ui", "@pinia/nuxt", "@nuxtjs/mdc"],

  css: ["~/assets/css/main.css"],

  // The components are styled for a dark surface only (text-white, no dark:
  // variants), so a light OS preference must not switch the UI to light.
  colorMode: { preference: "dark", fallback: "dark" },

  runtimeConfig: {
    dataPath: process.env.DATA_PATH || "./data",
    accountsPath: process.env.ACCOUNTS_PATH || "/app/accounts",
    fwbgApiUrl: process.env.FWBG_API_URL || "http://localhost:8420",
    fwbgAgentsUrl: process.env.FWBG_AGENTS_API_URL || "http://localhost:8421",
    public: {
      appVersion: pkg.version,
    },
  },

  nitro: {
    preset: "bun",
    experimental: {
      websocket: true,
    },
  },

  compatibilityDate: "2025-01-22",
});
