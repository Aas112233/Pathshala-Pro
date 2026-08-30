// @ts-nocheck
import { Prisma } from "@prisma/client";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";

export type BookIssueStatusType = "ISSUED" | "RETURNED" | "OVERDUE" | "LOST" | "DAMAGED";
export type AllocationStatusType = "ACTIVE" | "VACATED" | "SUSPENDED";
export type VehicleExpenseTypeEnum = "FUEL" | "MAINTENANCE" | "INSURANCE" | "FITNESS_TAX" | "OTHER";

export interface IssueBookParams {
  tenantId: string;
  bookId: string;
  borrowerType: "STUDENT" | "STAFF";
  studentProfileId?: string;
  staffProfileId?: string;
  borrowerName: string;
  borrowerIdNo: string;
  dueDate: Date;
  issuedById: string;
}

export interface ReturnBookParams {
  tenantId: string;
  issueId: string;
  returnDate?: Date;
  finePerDay?: number; // default 5.0
  paidFromPaymentMethod?: "CASH" | "BANK" | "UNPAID";
}

export interface VehicleExpenseParams {
  tenantId: string;
  vehicleId: string;
  expenseType: VehicleExpenseTypeEnum;
  amount: number;
  odometerReading?: number;
  expenseDate?: Date;
  description?: string;
  paidFromCode?: "1010" | "1020"; // 1010 Bank or 1020 Cash
  recordedById: string;
}

export interface AllocateTransportParams {
  tenantId: string;
  studentProfileId: string;
  routeId: string;
  vehicleId?: string;
  stopName: string;
  monthlyFee: number;
}

export interface AllocateHostelParams {
  tenantId: string;
  hostelId: string;
  roomId: string;
  studentProfileId: string;
  bedNumber?: string;
}

/**
 * =========================================================================
 * 1. LIBRARY CIRCULATION ENGINE
 * =========================================================================
 */
export async function issueLibraryBook(
  tx: Prisma.TransactionClient,
  params: IssueBookParams
) {
  const { tenantId, bookId, borrowerType, studentProfileId, staffProfileId, borrowerName, borrowerIdNo, dueDate, issuedById } = params;

  const book = await tx.book.findUnique({
    where: { id: bookId },
  });

  if (!book || book.tenantId !== tenantId) {
    throw new Error("Book not found or tenant mismatch.");
  }

  if (book.availableCopies <= 0) {
    throw new Error(`No copies available for '${book.title}'. All ${book.copies} copies are currently issued.`);
  }

  // 1. Decrement available copies
  await tx.book.update({
    where: { id: bookId },
    data: { availableCopies: book.availableCopies - 1 },
  });

  // 2. Create Issue Record
  const issue = await tx.bookIssue.create({
    data: {
      tenantId,
      bookId,
      borrowerType,
      studentProfileId: borrowerType === "STUDENT" ? studentProfileId : null,
      staffProfileId: borrowerType === "STAFF" ? staffProfileId : null,
      borrowerName,
      borrowerIdNo,
      dueDate,
      status: "ISSUED",
      issuedById,
    },
  });

  return issue;
}

export async function returnLibraryBook(
  tx: Prisma.TransactionClient,
  params: ReturnBookParams
) {
  const { tenantId, issueId, returnDate = new Date(), finePerDay = 5.0, paidFromPaymentMethod = "CASH" } = params;

  const issue = await tx.bookIssue.findUnique({
    where: { id: issueId },
    include: { book: true },
  });

  if (!issue || issue.tenantId !== tenantId) {
    throw new Error("Book issue record not found.");
  }

  if (issue.status === "RETURNED") {
    throw new Error("Book has already been returned.");
  }

  // 1. Calculate Overdue Fine
  let fineAmount = 0;
  if (returnDate > issue.dueDate) {
    const overdueDays = Math.ceil((returnDate.getTime() - issue.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    // Use fractional overdue days for finer billing; round to 2dp to prevent penny-drift
    const overdueDaysFloat = (returnDate.getTime() - issue.dueDate.getTime()) / (1000 * 60 * 60 * 24);
    fineAmount = Math.round(overdueDaysFloat * finePerDay * 100) / 100;
  }

  // 2. Increment book available copies
  await tx.book.update({
    where: { id: issue.bookId },
    data: { availableCopies: { increment: 1 } },
  });

  // 3. Update BookIssue record
  const updatedIssue = await tx.bookIssue.update({
    where: { id: issueId },
    data: {
      returnDate,
      status: "RETURNED",
      fineAmount,
    },
  });

  // 4. If fine collected, post to General Ledger
  if (fineAmount > 0 && paidFromPaymentMethod !== "UNPAID") {
    const debitAccountCode = paidFromPaymentMethod === "BANK" ? "1010" : "1020";
    const voucherNumber = await getNextVoucherNumber(tx, tenantId, "RECEIPT", returnDate.getFullYear());

    const [debitAccount, revenueAccount] = await Promise.all([
      tx.chartOfAccount.findFirst({ where: { tenantId, code: debitAccountCode } }),
      tx.chartOfAccount.findFirst({ where: { tenantId, code: "4060" } }),
    ]);

    if (!debitAccount || !revenueAccount) {
      throw new Error(`Chart of Accounts not seeded. Missing: ${!debitAccount ? debitAccountCode : ""} ${!revenueAccount ? "4060" : ""}`);
    }

    await tx.journalEntry.create({
      data: {
        tenantId,
        entryNumber: voucherNumber,
        voucherType: "RECEIPT",
        postingDate: returnDate,
        narration: `Library overdue fine collected for book '${issue.book.title}' (${issue.borrowerName})`,
        totalDebit: new Prisma.Decimal(fineAmount),
        totalCredit: new Prisma.Decimal(fineAmount),
        createdById: issue.issuedById || "system",
        lineItems: {
          create: [
            {
              tenantId,
              accountId: debitAccount.id,
              debitAmount: new Prisma.Decimal(fineAmount),
              creditAmount: new Prisma.Decimal(0),
              narration: `Dr. Cash/Bank for Library Fine`,
            },
            {
              tenantId,
              accountId: revenueAccount.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: new Prisma.Decimal(fineAmount),
              narration: `Cr. Library Fine Revenue`,
            },
          ],
        },
      },
    });
  }

  return updatedIssue;
}

/**
 * =========================================================================
 * 2. TRANSPORT FLEET & VEHICLE EXPENSE ENGINE
 * =========================================================================
 */
export async function allocateTransportSeat(
  tx: Prisma.TransactionClient,
  params: AllocateTransportParams
) {
  const { tenantId, studentProfileId, routeId, vehicleId, stopName, monthlyFee } = params;

  if (vehicleId) {
    const vehicle = await tx.transportVehicle.findUnique({
      where: { id: vehicleId },
      include: {
        allocations: {
          where: { tenantId, status: "ACTIVE" },
        },
      },
    });

    if (!vehicle || vehicle.tenantId !== tenantId) {
      throw new Error("Vehicle not found.");
    }

    if (vehicle.allocations.length >= vehicle.capacity) {
      throw new Error(`Vehicle ${vehicle.vehicleNo} has reached full capacity (${vehicle.capacity} seats).`);
    }
  }

  return tx.transportAllocation.upsert({
    where: {
      tenantId_studentProfileId: {
        tenantId,
        studentProfileId,
      },
    },
    create: {
      tenantId,
      studentProfileId,
      routeId,
      vehicleId: vehicleId ?? null,
      stopName,
      monthlyFee,
      status: "ACTIVE",
    },
    update: {
      routeId,
      vehicleId: vehicleId ?? null,
      stopName,
      monthlyFee,
      status: "ACTIVE",
    },
  });
}

export async function recordTransportVehicleExpense(
  tx: Prisma.TransactionClient,
  params: VehicleExpenseParams
) {
  const {
    tenantId,
    vehicleId,
    expenseType,
    amount,
    odometerReading,
    expenseDate = new Date(),
    description,
    paidFromCode = "1010",
    recordedById,
  } = params;

  const vehicle = await tx.transportVehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!vehicle || vehicle.tenantId !== tenantId) {
    throw new Error("Vehicle not found.");
  }

  // 1. Post Double-Entry Journal Entry
  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "PAYMENT", expenseDate.getFullYear());

  const [expenseAccount, paymentAccount] = await Promise.all([
    tx.chartOfAccount.findFirst({ where: { tenantId, code: "5040" } }),
    tx.chartOfAccount.findFirst({ where: { tenantId, code: paidFromCode } }),
  ]);

  if (!expenseAccount || !paymentAccount) {
    throw new Error(`Chart of Accounts not seeded. Missing: ${!expenseAccount ? "5040" : ""} ${!paymentAccount ? paidFromCode : ""}`);
  }

  const journalEntry = await tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber: voucherNumber,
      voucherType: "PAYMENT",
      postingDate: expenseDate,
      postingStatus: "POSTED",
      narration: `Vehicle ${vehicle.vehicleNo} ${expenseType} Expense: ${description || "Maintenance & Operation"}`,
      totalDebit: new Prisma.Decimal(amount),
      totalCredit: new Prisma.Decimal(amount),
      createdById: recordedById,
      lineItems: {
        create: [
          {
            tenantId,
            accountId: expenseAccount.id,
            debitAmount: new Prisma.Decimal(amount),
            creditAmount: new Prisma.Decimal(0),
            narration: `Dr. Vehicle ${vehicle.vehicleNo} (${expenseType})`,
          },
          {
            tenantId,
            accountId: paymentAccount.id,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: new Prisma.Decimal(amount),
            narration: `Cr. Payment Account (${paidFromCode})`,
          },
        ],
      },
    },
  });

  // 2. Create Vehicle Expense Log
  const expenseLog = await tx.vehicleExpenseLog.create({
    data: {
      tenantId,
      vehicleId,
      expenseType: expenseType as any,
      amount: new Prisma.Decimal(amount),
      odometerReading,
      expenseDate,
      description,
      paidFromCode,
      journalEntryId: journalEntry.id,
      recordedById,
    },
  });

  return {
    expenseLog,
    journalEntry,
  };
}

/**
 * =========================================================================
 * 3. HOSTEL ROOM ALLOCATION ENGINE
 * =========================================================================
 */
export async function allocateHostelRoomBed(
  tx: Prisma.TransactionClient,
  params: AllocateHostelParams
) {
  const { tenantId, hostelId, roomId, studentProfileId, bedNumber } = params;

  const room = await tx.hostelRoom.findUnique({
    where: { id: roomId },
    include: {
      allocations: {
        where: { tenantId, status: "ACTIVE" },
      },
    },
  });

  if (!room || room.tenantId !== tenantId) {
    throw new Error("Hostel room not found.");
  }

  if (room.allocations.length >= room.capacity) {
    throw new Error(`Room ${room.roomNumber} has reached maximum occupancy (${room.capacity} beds).`);
  }

  return tx.hostelAllocation.upsert({
    where: {
      tenantId_studentProfileId: {
        tenantId,
        studentProfileId,
      },
    },
    create: {
      tenantId,
      hostelId,
      roomId,
      studentProfileId,
      bedNumber: bedNumber ?? `Bed-${room.allocations.length + 1}`,
      status: "ACTIVE",
    },
    update: {
      hostelId,
      roomId,
      bedNumber: bedNumber ?? `Bed-${room.allocations.length + 1}`,
      status: "ACTIVE",
      vacatedAt: null,
    },
  });
}

export async function vacateHostelRoomBed(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    studentProfileId: string;
    vacateDate?: Date;
  }
) {
  const { tenantId, studentProfileId, vacateDate = new Date() } = params;

  const allocation = await tx.hostelAllocation.findUnique({
    where: {
      tenantId_studentProfileId: {
        tenantId,
        studentProfileId,
      },
    },
  });

  if (!allocation) {
    throw new Error("Hostel allocation not found for this student.");
  }

  return tx.hostelAllocation.update({
    where: { id: allocation.id },
    data: {
      status: "VACATED",
      vacatedAt: vacateDate,
    },
  });
}
