import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppDropdown } from "@/components/ui/app-dropdown";

describe("AppDropdown Smart Search Contracts", () => {
  it("renders a standard dropdown button with placeholder", () => {
    const handleChange = vi.fn();
    render(
      <AppDropdown
        value=""
        onChange={handleChange}
        options={[
          { value: "opt1", label: "Option 1" },
          { value: "opt2", label: "Option 2" },
        ]}
        placeholder="Choose Option"
      />
    );

    expect(screen.getByRole("button").textContent).toContain("Choose Option");
  });

  it("automatically renders a search input when options count > 5", () => {
    const handleChange = vi.fn();
    const manyOptions = Array.from({ length: 10 }, (_, i) => ({
      value: `student_${i}`,
      label: `Student Name ${i + 1}`,
    }));

    render(
      <AppDropdown
        value=""
        onChange={handleChange}
        options={manyOptions}
        placeholder="Select Student"
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("button"));

    // Search input should exist automatically
    const searchInput = screen.getByPlaceholderText("Search...");
    expect(searchInput).toBeDefined();

    // Type query to filter
    fireEvent.change(searchInput, { target: { value: "Student Name 9" } });

    expect(screen.getByText("Student Name 9")).toBeDefined();
    expect(screen.queryByText("Student Name 1")).toBeNull();
  });

  it("does not render search input when options <= 5 unless searchable is true", () => {
    const handleChange = vi.fn();
    const fewOptions = [
      { value: "MALE", label: "Male" },
      { value: "FEMALE", label: "Female" },
      { value: "OTHER", label: "Other" },
    ];

    render(
      <AppDropdown
        value=""
        onChange={handleChange}
        options={fewOptions}
        placeholder="Select Gender"
        searchable={false}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByPlaceholderText("Search...")).toBeNull();
  });

  it("renders search input when explicitly searchable={true} even for short lists", () => {
    const handleChange = vi.fn();
    const shortList = [
      { value: "A", label: "Class A" },
      { value: "B", label: "Class B" },
    ];

    render(
      <AppDropdown
        value=""
        onChange={handleChange}
        options={shortList}
        placeholder="Select Class"
        searchable={true}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByPlaceholderText("Search...")).toBeDefined();
  });
});
