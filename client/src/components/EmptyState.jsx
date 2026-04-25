import React from "react";

export default function EmptyState({ title = "Nothing here yet", description = "Try adjusting your filters or add a new record." }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: "#8a9aaa" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  );
}
