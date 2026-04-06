import axios from "axios";

export const api = axios.create({
  baseURL: "/time-tracker/api",
  headers: {
    "Content-Type": "application/json",
  },
});
