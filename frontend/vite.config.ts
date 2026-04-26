import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: "/",
  server: {
    proxy: {
      // Dev mode: frontend serve em /punch/, proxy para backend
      "/punch/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/punch/, ""),
      },
      // Production: quando atrás do nginx, a API vem pela mesma origem
      // O nginx faz proxy_pass para o backend
    },
  },
});
