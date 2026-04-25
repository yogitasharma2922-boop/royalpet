import React from "react";

export default function LoadingScreen({ label = "Loading..." }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#4a5a6a" }}>
        <span style={{ width: 14, height: 14, border: "2px solid #c9973a", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
        <span>{label}</span>
      </div>
    </div>
  );
}
