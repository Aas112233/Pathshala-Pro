import { describe, it, expect } from "vitest";

describe("Transport & Fleet Management Suite", () => {
  describe("Route Stops & Manifest Structuring", () => {
    it("correctly calculates vehicle occupancy and seat allocation percentage", () => {
      const capacity = 40;
      const allocatedStudents = 32;

      const occupancyPercentage = Math.round((allocatedStudents / capacity) * 100);
      expect(occupancyPercentage).toBe(80);
      expect(allocatedStudents <= capacity).toBe(true);
    });

    it("identifies over-capacity vehicles when allocations exceed seats", () => {
      const capacity = 30;
      const allocatedStudents = 34;

      const isOverCapacity = allocatedStudents > capacity;
      expect(isOverCapacity).toBe(true);
    });

    it("orders and formats comma-separated stops properly", () => {
      const rawStopsText = "Mirpur-10, Kazipara, Shewrapara, Agargaon, Campus";
      const stops = rawStopsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      expect(stops.length).toBe(5);
      expect(stops[0]).toBe("Mirpur-10");
      expect(stops[4]).toBe("Campus");
    });
  });

  describe("Student Passenger Manifest Grouping", () => {
    it("handles student contact mapping with fallback", () => {
      const student = {
        rollNumber: "07",
        firstName: "Tariq",
        lastName: "Mahmood",
        class: { name: "Class 9" },
        section: { name: "A" },
        guardianName: "Mahmood Akhtar",
        guardianContact: "+880 1800-112233",
      };

      const fullName = `${student.firstName} ${student.lastName}`;
      const contact = student.guardianContact || "No contact";

      expect(fullName).toBe("Tariq Mahmood");
      expect(contact).toBe("+880 1800-112233");
    });
  });
});
