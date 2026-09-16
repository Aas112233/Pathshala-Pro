import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import ClassesPage from "./page";

const subjects = [{ id: "subject-1", subjectId: "SUB-1", name: "Mathematics", code: "MATH", category: "COMPULSORY" }];
const classes = [{ id: "class-1", classId: "CLS-1", name: "Class One", classNumber: 1, isActive: true }];
const assignedSubjects = [{ subjectId: "subject-1", subject: { subjectId: "SUB-1" }, isCompulsory: true }];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { role: "ADMIN" }, isLoading: false }),
}));
vi.mock("@/lib/permissions", () => ({
  getEffectivePermissions: () => ({}),
  hasPermission: () => true,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === "subjects" ? { data: subjects }
      : queryKey[0] === "classes" ? { data: classes }
        : queryKey[1] ? assignedSubjects : undefined,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useMutation: ({ mutationFn }: { mutationFn: (data: unknown) => Promise<unknown> }) => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: mutationFn,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderSubjects(edit = false) {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const originalError = console.error;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("Maximum update depth")) throw new Error("Subject selection render loop");
    originalError(...args);
  });
  render(<ClassesPage />);
  if (edit) {
    fireEvent.click(screen.getByText("Class One").closest("tr")!.querySelectorAll("button")[1]);
  } else {
    fireEvent.click(screen.getByRole("button", { name: "addClass" }));
  }
  fireEvent.click(screen.getByRole("button", { name: /tabSubjects/ }));
}

describe("class subject selection", () => {
  it("selects and deselects a subject without a bubbling-click loop", () => {
    renderSubjects();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(screen.getByText("Mathematics"));
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByText("Mathematics"));
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
  });

  it("saves an empty subject selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderSubjects(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "saveClassAndSubjects" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/class-subjects", expect.objectContaining({
      body: JSON.stringify({ classId: "class-1", subjects: [] }),
    })));
  });

  it("shows subject-save failures instead of reporting success", async () => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Subject assignment rejected" }), { status: 400 })));
    renderSubjects(true);
    fireEvent.click(screen.getByRole("button", { name: "saveClassAndSubjects" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Subject assignment rejected"));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("keeps assigned subjects selected when the edit tab mounts", () => {
    renderSubjects(true);
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
  });
});
