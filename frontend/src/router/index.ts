import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import History from "../views/History.vue";
import LoginView from "../views/LoginView.vue";

const AUTH_ROUTES = new Set(["login"]);

const router = createRouter({
  history: createWebHistory(import.meta.env.DEV ? "/time-tracker/" : "/"),
  routes: [
    { path: "/login", name: "login", component: LoginView, meta: { guest: true } },
    { path: "/", name: "dashboard", component: Dashboard },
    { path: "/history", name: "history", component: History },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem("auth_token");
  const isDev = import.meta.env.DEV;
  if (!token && !to.meta.guest && isDev) {
    return { name: "login" };
  }
  if (token && to.meta.guest) {
    return { name: "dashboard" };
  }
});

export default router;
