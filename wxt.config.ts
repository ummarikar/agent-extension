import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Web Scraper Agent",
    description:
      "AI-powered web scraping agent with specialized LinkedIn extraction capabilities",
    version: "1.0.0",
    host_permissions: [
      "https://*.openai.azure.com/*",
      "<all_urls>",
    ],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {},
    permissions: ["activeTab", "sidePanel", "storage", "tabs", "scripting"],
  },
  vite: () => ({
    define: {
      "import.meta.env.AZURE_OPENAI_API_KEY": JSON.stringify(
        process.env.AZURE_OPENAI_API_KEY,
      ),
      "import.meta.env.AZURE_ENDPOINT": JSON.stringify(
        process.env.AZURE_ENDPOINT,
      ),
      "import.meta.env.AZURE_API_VERSION": JSON.stringify(
        process.env.AZURE_API_VERSION,
      ),
      "import.meta.env.LLM_AZURE_DEPLOYMENT": JSON.stringify(
        process.env.LLM_AZURE_DEPLOYMENT,
      ),
      "import.meta.env.BRIGHT_DATA_TOKEN": JSON.stringify(
        process.env.BRIGHT_DATA_TOKEN,
      ),
    },
    build: {
      rollupOptions: {
        external: [],
      },
    },
    optimizeDeps: {
      include: ["zod-to-json-schema", "openai"],
    },
  }),
});
