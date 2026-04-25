import React from "react";
import { render, screen } from "@testing-library/react";
import LoadingScreen from "../components/LoadingScreen";
import EmptyState from "../components/EmptyState";

describe("UI components", () => {
  it("renders loading label", () => {
    render(<LoadingScreen label="Loading data" />);
    expect(screen.getByText(/Loading data/i)).toBeInTheDocument();
  });

  it("renders empty state defaults", () => {
    render(<EmptyState />);
    expect(screen.getByText(/Nothing here yet/i)).toBeInTheDocument();
  });
});
