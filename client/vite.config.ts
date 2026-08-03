import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Both are overridable so a second stack can run alongside the normal dev one
// rather than replacing it — the beta-test harness brings up its own client
// and API against a throwaway database.
const port = Number(process.env.VITE_PORT ?? 5173);
const apiTarget = process.env.VITE_API_PROXY ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    proxy: {
      "/api": apiTarget,
    },
  },
});
