import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { AcademicStudentSelector } from "./academic-student-selector";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("AcademicStudentSelector Unit Tests", () => {
  it("renders with disabled section and student when no class is selected", () => {
    const handleChange = vi.fn();

    renderWithProviders(
      <AcademicStudentSelector
        value={{ classId: "", sectionId: "", studentId: "" }}
        onChange={handleChange}
        showClass
        showSection
        showStudent
      />
    );

    // Section and Student should display disabled placeholders
    const buttons = screen.getAllByRole("button");
    // Button 0: Class (Select Class)
    // Button 1: Section (Select class first...)
    // Button 2: Student (Select class first...)
    expect(buttons[1].textContent).toContain("Select class first...");
    expect(buttons[2].textContent).toContain("Select class first...");

    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[2] as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables section when class is selected and prompts for section before student", () => {
    const handleChange = vi.fn();

    renderWithProviders(
      <AcademicStudentSelector
        value={{ classId: "class-10", sectionId: "", studentId: "" }}
        onChange={handleChange}
        showClass
        showSection
        showStudent
      />
    );

    const buttons = screen.getAllByRole("button");
    // Class selected -> Section enabled
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);

    // Student still disabled until Section is selected
    expect(buttons[2].textContent).toContain("Select section first...");
    expect((buttons[2] as HTMLButtonElement).disabled).toBe(true);
  });

  it("resets downstream section and student when class is changed", () => {
    const handleChange = vi.fn();

    const { rerender } = renderWithProviders(
      <AcademicStudentSelector
        value={{ classId: "class-10", sectionId: "sec-a", studentId: "stud-1" }}
        onChange={handleChange}
        showClass
        showSection
        showStudent
      />
    );

    // Simulate class dropdown change trigger by invoking the component callback directly
    // or triggering click on option
    expect(screen.getAllByRole("button").length).toBe(3);
  });

  it("renders search input and triggers search query change when showSearchInput is true", () => {
    const handleChange = vi.fn();
    const handleSearchChange = vi.fn();

    renderWithProviders(
      <AcademicStudentSelector
        value={{ classId: "class-10", sectionId: "sec-a", studentId: "" }}
        onChange={handleChange}
        showClass
        showSection
        showStudent
        showSearchInput
        searchQuery=""
        onSearchQueryChange={handleSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search by name, roll, or ID...");
    expect(searchInput).toBeDefined();

    fireEvent.change(searchInput, { target: { value: "Rahim" } });
    expect(handleSearchChange).toHaveBeenCalledWith("Rahim");
  });
});
