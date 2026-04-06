import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import History from "../views/History.vue";

const router = createRouter({
  history: createWebHistory("/time-tracker/"),
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: Dashboard,
    },
    {
      path: "/history",
      name: "history",
      component: History,
    },
  ],
});

export default router;
