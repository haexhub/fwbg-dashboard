export default defineNuxtConfig({
  modules: ["@nuxt/ui"],

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    dataPath: process.env.DATA_PATH || "./data",
  },

  compatibilityDate: "2025-01-22",
});
