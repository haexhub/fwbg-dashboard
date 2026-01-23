import pkg from "./package.json";

export default defineNuxtConfig({
  modules: ["@nuxt/ui"],

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    dataPath: process.env.DATA_PATH || "./data",
    public: {
      appVersion: pkg.version,
    },
  },

  compatibilityDate: "2025-01-22",
});
