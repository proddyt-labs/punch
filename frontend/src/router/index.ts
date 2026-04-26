import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import History from "../views/History.vue";
import AuthCallback from "../views/AuthCallback.vue";
import QuickAction from "../views/QuickAction.vue";
import { buildAuthorizeUrl } from "../stores/user";

const router = createRouter({
  history: createWebHistory(import.meta.env.DEV ? "/punch/" : "/"),
  routes: [
    { path: "/auth/callback", name: "callback", component: AuthCallback, meta: { guest: true } },
    { path: "/", name: "dashboard", component: Dashboard },
    { path: "/history", name: "history", component: History },
    { path: "/quick/:type", name: "quick", component: QuickAction, meta: { bare: true } },
  ],
});

router.beforeEach((to) => {
  if (to.meta.guest) return true;
  const token = localStorage.getItem("auth_token");
  if (!token) {
    window.location.href = buildAuthorizeUrl();
    return false;
  }
  return true;
});

export default router;
