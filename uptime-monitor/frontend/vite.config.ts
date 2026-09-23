import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em dev, o Vite faz proxy de /api e /ws para o backend Express (porta 4000),
// então o frontend pode usar caminhos relativos sem se preocupar com CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
});
