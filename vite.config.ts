import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: "all",
  },
});
export default defineConfig({
  server: {
    allowedHosts: ["fd2kwy-5173.csb.app"],
  },
});
