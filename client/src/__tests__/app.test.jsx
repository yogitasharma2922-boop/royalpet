import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "../App";

vi.mock("../pages/RoyalPetClinicApp", () => ({
  default: () => <div>Royal App Shell</div>,
}));

vi.mock("../services/healthService", () => ({
  fetchHealth: () => Promise.resolve({ ok: true, env: "test" }),
}));

describe("App routing", () => {
  it("renders main app on root", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(screen.getByText(/Royal App Shell/i)).toBeInTheDocument();
  });

  it("renders health check route", async () => {
    window.history.pushState({}, "", "/health");
    render(<App />);
    expect(await screen.findByText(/Backend status/i)).toBeInTheDocument();
    expect(await screen.findByText(/API is reachable/i)).toBeInTheDocument();
  });
});
