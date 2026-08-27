import { describe, it, expect } from "vitest";
import { createNoticeSchema, updateNoticeSchema } from "@/lib/schemas";
import { hasPermission, ALL_PERMISSION_MODULES } from "@/lib/permissions";
import {
  mapNoticeToGroup,
  filterNoticesByCategory,
  calculateNotificationCategoryCounts,
  formatNoticeRelativeTime,
  type NoticeItem,
} from "@/lib/notices-helpers";

describe("Dual-Level Notice System & Permissions", () => {
  describe("Tenant Notice Schemas", () => {
    it("validates an institutional school notice payload", () => {
      const payload = {
        title: "Annual Sports Day 2026 Scheduled",
        content: "The annual sports day will be held on September 15, 2026. All students must wear athletic uniform.",
        category: "EVENT",
        priority: "HIGH",
        audience: "ALL",
        isPinned: true,
        isPublished: true,
        publishDate: "2026-08-26",
        expiresAt: "2026-09-16",
      };

      const result = createNoticeSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects notice with empty title or content", () => {
      const invalid = {
        title: "A",
        content: "Bad",
      };

      const result = createNoticeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates SuperAdmin platform broadcast notice", () => {
      const broadcastPayload = {
        title: "Cloud Infrastructure Maintenance Notice",
        content: "Platform maintenance will take place between 02:00 AM and 03:00 AM UTC on Sunday.",
        category: "MAINTENANCE",
        priority: "URGENT",
        audience: "ALL_SCHOOLS",
        targetTenants: [],
        isPinned: true,
        isPublished: true,
      };

      const result = createNoticeSchema.safeParse(broadcastPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.audience).toBe("ALL_SCHOOLS");
        expect(result.data.priority).toBe("URGENT");
      }
    });

    it("validates partial notice update payload", () => {
      const updatePayload = {
        title: "Updated Annual Sports Day 2026",
        isPinned: false,
      };

      const result = updateNoticeSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
    });
  });

  describe("Notice Permission Module", () => {
    it("includes notices in ALL_PERMISSION_MODULES registry", () => {
      expect(ALL_PERMISSION_MODULES).toContain("notices");
    });

    it("allows full access when permissions object grants read/write on notices", () => {
      const permissions = {
        notices: { read: true, write: true, manage: true },
      };

      expect(hasPermission(permissions, "notices", "read")).toBe(true);
      expect(hasPermission(permissions, "notices", "write")).toBe(true);
      expect(hasPermission(permissions, "notices", "manage")).toBe(true);
    });
  });

  describe("Categorized Notification Helpers", () => {
    const mockNotices: NoticeItem[] = [
      {
        id: "n-1",
        tenantId: "t-1",
        scope: "TENANT",
        title: "Mid-Term Exam Schedule",
        content: "Exams start next Monday",
        category: "EXAMINATION",
        priority: "NORMAL",
        audience: "STUDENTS",
        isPinned: true,
        isPublished: true,
        publishDate: new Date(),
      },
      {
        id: "n-2",
        tenantId: "t-1",
        scope: "TENANT",
        title: "Tuition Fee Due Reminder",
        content: "Kindly pay fee by 15th",
        category: "FEE_REMINDER",
        priority: "HIGH",
        audience: "ALL",
        isPinned: false,
        isPublished: true,
        publishDate: new Date(),
      },
      {
        id: "n-3",
        tenantId: "t-1",
        scope: "TENANT",
        title: "Emergency Weather Closure",
        content: "Campus will remain closed tomorrow",
        category: "GENERAL",
        priority: "URGENT",
        audience: "ALL",
        isPinned: true,
        isPublished: true,
        publishDate: new Date(),
      },
      {
        id: "n-4",
        tenantId: "t-1",
        scope: "GLOBAL",
        title: "Platform Maintenance",
        content: "Routine server updates",
        category: "MAINTENANCE",
        priority: "NORMAL",
        audience: "ALL_SCHOOLS",
        isPinned: false,
        isPublished: true,
        publishDate: new Date(),
      },
    ];

    it("maps notice categories into proper top-level groups", () => {
      expect(mapNoticeToGroup(mockNotices[0])).toBe("ACADEMIC");
      expect(mapNoticeToGroup(mockNotices[1])).toBe("FEES");
      expect(mapNoticeToGroup(mockNotices[2])).toBe("URGENT");
      expect(mapNoticeToGroup(mockNotices[3])).toBe("GENERAL");
    });

    it("filters notices by category group accurately", () => {
      const all = filterNoticesByCategory(mockNotices, "ALL");
      expect(all).toHaveLength(4);

      const academic = filterNoticesByCategory(mockNotices, "ACADEMIC");
      expect(academic).toHaveLength(1);
      expect(academic[0].id).toBe("n-1");

      const fees = filterNoticesByCategory(mockNotices, "FEES");
      expect(fees).toHaveLength(1);
      expect(fees[0].id).toBe("n-2");

      const urgent = filterNoticesByCategory(mockNotices, "URGENT");
      expect(urgent).toHaveLength(1);
      expect(urgent[0].id).toBe("n-3");
    });

    it("calculates unread category counts correctly based on read IDs set", () => {
      const readSet = new Set(["n-1", "n-4"]);
      const counts = calculateNotificationCategoryCounts(mockNotices, readSet);

      expect(counts.ALL.total).toBe(4);
      expect(counts.ALL.unread).toBe(2);

      expect(counts.ACADEMIC.total).toBe(1);
      expect(counts.ACADEMIC.unread).toBe(0); // n-1 is read

      expect(counts.FEES.total).toBe(1);
      expect(counts.FEES.unread).toBe(1); // n-2 is unread

      expect(counts.URGENT.total).toBe(1);
      expect(counts.URGENT.unread).toBe(1); // n-3 is unread

      expect(counts.GENERAL.total).toBe(1);
      expect(counts.GENERAL.unread).toBe(0); // n-4 is read
    });

    it("formats relative notice time correctly", () => {
      const now = new Date();
      expect(formatNoticeRelativeTime(now)).toBe("Just now");

      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(formatNoticeRelativeTime(fiveMinutesAgo)).toBe("5m ago");

      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatNoticeRelativeTime(twoHoursAgo)).toBe("2h ago");

      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatNoticeRelativeTime(threeDaysAgo)).toBe("3d ago");

      expect(formatNoticeRelativeTime(null)).toBe("Recently");
    });
  });
});
