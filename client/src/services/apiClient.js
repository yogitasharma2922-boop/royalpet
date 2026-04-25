import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
  (error) => {
    const message = error?.response?.data?.error?.message || error?.response?.data?.error || error.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

export default api;
