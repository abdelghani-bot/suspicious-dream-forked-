import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    allowedHosts: "all",
    watch: {
      ignored: ["**/.vs/**", "**/node_modules/**", "**/release/**", "**/dist/**"],
    },
  },
});