import { describe, it, expect, vi } from "vitest";
import {
  issueLibraryBook,
  returnLibraryBook,
  allocateTransportSeat,
  recordTransportVehicleExpense,
  allocateHostelRoomBed,
  vacateHostelRoomBed,
} from "@/lib/auxiliary-service";

vi.mock("@/lib/accounting-sequence", () => ({
  generateVoucherNumber: vi.fn().mockResolvedValue("PAY-2026-0099"),
  getNextVoucherNumber: vi.fn().mockResolvedValue("PAY-2026-0099"),
}));

describe("Campus Auxiliary Services & GL Integration Engine", () => {
  describe("Library Circulation", () => {
    it("issues a book when copies are available and decrements inventory", async () => {
      const mockTx = {
        book: {
          findUnique: vi.fn().mockResolvedValue({
            id: "book-1",
            tenantId: "tenant-1",
            title: "Advanced Physics",
            copies: 5,
            availableCopies: 3,
          }),
          update: vi.fn().mockResolvedValue({ availableCopies: 2 }),
        },
        bookIssue: {
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: "issue-1", ...data })
          ),
        },
      } as any;

      const issue = await issueLibraryBook(mockTx, {
        tenantId: "tenant-1",
        bookId: "book-1",
        borrowerType: "STUDENT",
        studentProfileId: "st-101",
        borrowerName: "Arman Khan",
        borrowerIdNo: "101",
        dueDate: new Date("2026-09-20"),
        issuedById: "librarian-1",
      });

      expect(issue.id).toBe("issue-1");
      expect(issue.status).toBe("ISSUED");
      expect(mockTx.book.update).toHaveBeenCalledWith({
        where: { id: "book-1" },
        data: { availableCopies: 2 },
      });
    });

    it("rejects book issue if 0 copies are available", async () => {
      const mockTx = {
        book: {
          findUnique: vi.fn().mockResolvedValue({
            id: "book-2",
            tenantId: "tenant-1",
            title: "Chemistry Vol 1",
            copies: 2,
            availableCopies: 0,
          }),
        },
      } as any;

      await expect(
        issueLibraryBook(mockTx, {
          tenantId: "tenant-1",
          bookId: "book-2",
          borrowerType: "STUDENT",
          studentProfileId: "st-101",
          borrowerName: "Arman Khan",
          borrowerIdNo: "101",
          dueDate: new Date("2026-09-20"),
          issuedById: "librarian-1",
        })
      ).rejects.toThrow("No copies available");
    });

    it("returns book, calculates late fee if overdue, and creates GL receipt entry", async () => {
      const mockTx = {
        bookIssue: {
          findUnique: vi.fn().mockResolvedValue({
            id: "issue-1",
            tenantId: "tenant-1",
            bookId: "book-1",
            borrowerName: "Arman Khan",
            status: "ISSUED",
            dueDate: new Date("2026-09-10"),
            book: { title: "Advanced Physics" },
          }),
          update: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: "issue-1", ...data })
          ),
        },
        book: {
          update: vi.fn().mockResolvedValue({ availableCopies: 3 }),
        },
        journalEntry: {
          create: vi.fn().mockResolvedValue({ id: "je-lib-fine" }),
        },
        chartOfAccount: {
          findFirst: vi.fn().mockImplementation(({ where }) =>
            Promise.resolve({ id: `account-${where.code}` })
          ),
        },
      } as any;

      const returnDate = new Date("2026-09-14"); // 4 days overdue * 5.0 = 20.0 fine
      const updated = await returnLibraryBook(mockTx, {
        tenantId: "tenant-1",
        issueId: "issue-1",
        returnDate,
        finePerDay: 5.0,
        paidFromPaymentMethod: "CASH",
      });

      expect(updated.status).toBe("RETURNED");
      expect(updated.fineAmount).toBe(20.0);
      expect(mockTx.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            voucherType: "RECEIPT",
          }),
        })
      );
    });
  });

  describe("Transport Fleet & Expense Logging", () => {
    it("allocates transport seat when vehicle has capacity", async () => {
      const mockTx = {
        transportVehicle: {
          findUnique: vi.fn().mockResolvedValue({
            id: "veh-1",
            tenantId: "tenant-1",
            vehicleNo: "DHK-BUS-01",
            capacity: 40,
            allocations: new Array(30), // 30 active seats
          }),
        },
        transportAllocation: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "alloc-1",
            status: "ACTIVE",
            monthlyFee: 1500,
          }),
          update: vi.fn().mockResolvedValue({
            id: "alloc-1",
            status: "ACTIVE",
            monthlyFee: 1500,
          }),
        },
      } as any;

      const alloc = await allocateTransportSeat(mockTx, {
        tenantId: "tenant-1",
        studentProfileId: "st-1",
        routeId: "route-1",
        vehicleId: "veh-1",
        stopName: "Kazipara",
        monthlyFee: 1500,
      });

      expect(alloc.status).toBe("ACTIVE");
      expect(alloc.monthlyFee).toBe(1500);
    });

    it("records vehicle expense and posts double-entry journal entry", async () => {
      const mockTx = {
        transportVehicle: {
          findUnique: vi.fn().mockResolvedValue({
            id: "veh-1",
            tenantId: "tenant-1",
            vehicleNo: "DHK-BUS-01",
          }),
        },
        journalEntry: {
          create: vi.fn().mockResolvedValue({ id: "je-fuel-1" }),
        },
        chartOfAccount: {
          findFirst: vi.fn().mockImplementation(({ where }) =>
            Promise.resolve({ id: `account-${where.code}` })
          ),
        },
        vehicleExpenseLog: {
          create: vi.fn().mockResolvedValue({
            id: "exp-log-1",
            amount: 4500,
          }),
        },
      } as any;

      const result = await recordTransportVehicleExpense(mockTx, {
        tenantId: "tenant-1",
        vehicleId: "veh-1",
        expenseType: "FUEL",
        amount: 4500,
        paidFromCode: "1010",
        recordedById: "user-1",
      });

      expect(result.expenseLog.id).toBe("exp-log-1");
      expect(result.journalEntry).toBeDefined();
    });
  });

  describe("Hostel Room Allocations", () => {
    it("allocates bed in hostel room when occupancy limit is not reached", async () => {
      const mockTx = {
        hostelRoom: {
          findUnique: vi.fn().mockResolvedValue({
            id: "room-101",
            tenantId: "tenant-1",
            roomNumber: "101",
            capacity: 4,
            allocations: [{ id: "a1" }, { id: "a2" }], // 2 active
          }),
        },
        hostelAllocation: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "h-alloc-1",
            status: "ACTIVE",
            bedNumber: "Bed-3",
          }),
          update: vi.fn().mockResolvedValue({
            id: "h-alloc-1",
            status: "ACTIVE",
            bedNumber: "Bed-3",
          }),
        },
      } as any;

      const alloc = await allocateHostelRoomBed(mockTx, {
        tenantId: "tenant-1",
        hostelId: "hostel-boys",
        roomId: "room-101",
        studentProfileId: "st-202",
      });

      expect(alloc.status).toBe("ACTIVE");
      expect(alloc.bedNumber).toBe("Bed-3");
    });

    it("vacates hostel room bed and marks vacatedAt timestamp", async () => {
      const mockTx = {
        hostelAllocation: {
          findFirst: vi.fn().mockResolvedValue({
            id: "h-alloc-1",
            status: "ACTIVE",
          }),
          update: vi.fn().mockResolvedValue({
            id: "h-alloc-1",
            status: "VACATED",
            vacatedAt: new Date("2026-09-30"),
          }),
        },
      } as any;

      const vacated = await vacateHostelRoomBed(mockTx, {
        tenantId: "tenant-1",
        studentProfileId: "st-202",
        vacateDate: new Date("2026-09-30"),
      });

      expect(vacated.status).toBe("VACATED");
      expect(vacated.vacatedAt).toBeDefined();
    });
  });
});
