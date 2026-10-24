import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { API_BASE_PATH } from "./src/shared/constants/api.constants.ts";

const proxy = {
  [API_BASE_PATH]: {
    target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
});
