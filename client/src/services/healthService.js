import api from "./apiClient";

export const fetchHealth = () => api.get("/health");
