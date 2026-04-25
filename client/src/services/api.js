const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.error || "Request failed";
    throw new Error(message);
  }
  return data?.data ?? data;
};
