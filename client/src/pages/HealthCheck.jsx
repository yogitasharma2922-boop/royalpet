import React, { useEffect, useState } from "react";

import LoadingScreen from "../components/LoadingScreen";
import { fetchHealth } from "../services/healthService";

export default function HealthCheck() {
  const [status, setStatus] = useState({ loading: true, ok: false, error: null, env: "" });

  useEffect(() => {
    let mounted = true;
    fetchHealth()
      .then((data) => {
        if (!mounted) return;
        setStatus({ loading: false, ok: !!data.ok, error: null, env: data.env || "" });
      })
      .catch((err) => {
        if (!mounted) return;
        setStatus({ loading: false, ok: false, error: err.message, env: "" });
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (status.loading) return <LoadingScreen label="Checking server..." />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 520, background: "#fff", border: "1px solid #e0dbd4", borderRadius: 12, padding: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Backend status</h2>
        {status.ok ? (
          <p style={{ color: "#1e7e4e" }}>API is reachable. Environment: {status.env || "unknown"}</p>
        ) : (
          <p style={{ color: "#c0392b" }}>API is not reachable. {status.error}</p>
        )}
      </div>
    </div>
  );
}
