import pkg from "./package.json";

export default defineNuxtConfig({
  devServer: {
    port: 3100,
  },

  modules: ["@nuxt/ui", "@pinia/nuxt", "@nuxtjs/mdc"],

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    dataPath: process.env.DATA_PATH || "./data",
    accountsPath: process.env.ACCOUNTS_PATH || "/app/accounts",
    fwbgApiUrl: process.env.FWBG_API_URL || "http://localhost:8420",
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
