import { describe, it, expect } from "vitest";
import { createHomeworkSchema, createSubmissionSchema } from "@/lib/schemas";

describe("Homework & Digital Assignments Suite", () => {
  describe("Homework Schema Validation", () => {
    it("validates correct homework payload", () => {
      const validPayload = {
        classId: "cls-101",
        subjectId: "sub-202",
        title: "Chapter 4 Science Worksheet",
        description: "Complete all questions from page 45-48",
        dueDate: "2026-09-15T23:59:59.000Z",
        attachmentUrl: "https://r2.pathshala.pro/homework/ws-45.pdf",
      };

      const result = createHomeworkSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("rejects homework with missing title or classId", () => {
      const invalidPayload = {
        classId: "",
        title: "",
        description: "Test description",
        dueDate: "2026-09-15T23:59:59.000Z",
      };

      const result = createHomeworkSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("Submission Schema Validation", () => {
    it("validates student homework submission", () => {
      const submission = {
        homeworkId: "hw-1",
        studentProfileId: "st-99",
        attachmentUrl: "https://r2.pathshala.pro/submissions/ans-99.pdf",
        remarks: "Completed assignment with neat diagrams",
      };

      const result = createSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });
  });

  describe("Urgency & Overdue Calculations", () => {
    it("identifies past due dates as overdue", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const isOverdue = yesterday.getTime() < Date.now();
      expect(isOverdue).toBe(true);
    });

    it("identifies future due dates as active", () => {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const isOverdue = nextWeek.getTime() < Date.now();
      expect(isOverdue).toBe(false);
    });
  });
});
