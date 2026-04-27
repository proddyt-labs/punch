import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./assets/main.css";

// Registra o service worker (necessário para PWA instalável)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] registrado:", reg.scope))
      .catch((err) => console.error("[SW] falha:", err));
  });
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
