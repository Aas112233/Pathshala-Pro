// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const access = await requireApiAccess(req);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(req.url);

    const type = (searchParams.get("type") || "STUDENT").toUpperCase(); // "STUDENT" | "STAFF" | "ACCOUNT"
    const entityId = searchParams.get("entityId") || "";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam + "T23:59:59.999Z") : null;

    // 1. Return list of available entities for dropdowns if requested or alongside data
    const [students, staffList, bankAccounts] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { tenantId, status: "ACTIVE" },
        select: {
          id: true,
          studentId: true,
          rollNumber: true,
          firstName: true,
          lastName: true,
          guardianName: true,
          guardianContact: true,
          classId: true,
          sectionId: true,
        },
        orderBy: [{ firstName: "asc" }, { rollNumber: "asc" }],
        take: 200,
      }),
      prisma.staffProfile.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true,
          staffId: true,
          firstName: true,
          lastName: true,
          department: true,
          designation: true,
          baseSalary: true,
          phone: true,
        },
        orderBy: { firstName: "asc" },
        take: 100,
      }),
      prisma.bankAccount.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true,
          accountName: true,
          accountNumber: true,
          bankName: true,
          accountType: true,
          currentBalance: true,
          currency: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // If no specific entity selected, return first available or empty state with selector lists
    let targetEntityId = entityId;
    if (!targetEntityId) {
      if (type === "STUDENT" && students.length > 0) targetEntityId = students[0].id;
      else if (type === "STAFF" && staffList.length > 0) targetEntityId = staffList[0].id;
      else if (type === "ACCOUNT" && bankAccounts.length > 0) targetEntityId = bankAccounts[0].id;
    }

    // =========================================================================
    // STUDENT FEE STATEMENT
    // =========================================================================
    if (type === "STUDENT") {
      if (!targetEntityId) {
        return successResponse({
          type: "STUDENT",
          entity: null,
          options: { students, staffList, bankAccounts },
          statement: {
            openingBalance: 0,
            totalDebit: 0,
            totalCredit: 0,
            closingBalance: 0,
            entries: [],
          },
        });
      }

      const student = await prisma.studentProfile.findFirst({
        where: { id: targetEntityId, tenantId },
      });

      if (!student) {
        return errorResponse("Student profile not found", 404);
      }

      // Fetch all fee vouchers for student
      const vouchers = await prisma.feeVoucher.findMany({
        where: {
          studentProfileId: student.id,
          tenantId,
        },
        orderBy: { createdAt: "asc" },
      });

      const [academicYears, transactions] = await Promise.all([
        prisma.academicYear.findMany({
          where: {
            tenantId,
            id: { in: vouchers.map((voucher) => voucher.academicYearId) },
          },
          select: { id: true, label: true },
        }),
        prisma.transaction.findMany({
          where: {
            tenantId,
            feeVoucherId: { in: vouchers.map((voucher) => voucher.id) },
          },
          orderBy: { timestamp: "asc" },
        }),
      ]);
      const academicYearLabels = new Map(
        academicYears.map((academicYear) => [academicYear.id, academicYear.label])
      );
      const transactionsByVoucherId = new Map<string, typeof transactions>();
      for (const transaction of transactions) {
        const voucherTransactions = transactionsByVoucherId.get(transaction.feeVoucherId) || [];
        voucherTransactions.push(transaction);
        transactionsByVoucherId.set(transaction.feeVoucherId, voucherTransactions);
      }

      let runningBalance = 0;
      let totalBilled = 0;
      let totalPaid = 0;
      const allEntries: any[] = [];

      vouchers.forEach((v) => {
        // Debit: Voucher Generated / Billed
        runningBalance += v.totalDue;
        totalBilled += v.totalDue;

        allEntries.push({
          id: `voucher-${v.id}`,
          date: v.createdAt,
          refId: v.voucherId,
          type: "DEBIT",
          category: "FEE_BILLING",
          description: `${v.feeType} (${academicYearLabels.get(v.academicYearId) || "General"})`,
          debit: v.totalDue,
          credit: 0,
          runningBalance,
          status: v.status,
          paymentMethod: "-",
          details: {
            baseAmount: v.baseAmount,
            discount: v.discountAmount,
            arrears: v.arrears,
          },
        });

        // Credit: Transactions / Payments Made
        const voucherTransactions = transactionsByVoucherId.get(v.id) || [];
        voucherTransactions.forEach((tx) => {
          runningBalance -= tx.amountPaid;
          totalPaid += tx.amountPaid;

          allEntries.push({
            id: `tx-${tx.id}`,
            date: tx.timestamp || tx.createdAt,
            refId: tx.receiptNumber || tx.transactionId,
            type: "CREDIT",
            category: "FEE_PAYMENT",
            description: `Payment for ${v.voucherId} - ${tx.note || "Tuition Receipt"}`,
            debit: 0,
            credit: tx.amountPaid,
            runningBalance,
            status: "PAID",
            paymentMethod: tx.paymentMethod,
            details: {
              transactionId: tx.transactionId,
            },
          });
        });
      });

      // Sort chronologically
      allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Filter by Date Range if provided
      let filteredEntries = allEntries;
      let openingBalance = 0;

      if (startDate) {
        const priorEntries = allEntries.filter((e) => new Date(e.date) < startDate);
        if (priorEntries.length > 0) {
          openingBalance = priorEntries[priorEntries.length - 1].runningBalance;
        }
        filteredEntries = filteredEntries.filter((e) => new Date(e.date) >= startDate);
      }

      if (endDate) {
        filteredEntries = filteredEntries.filter((e) => new Date(e.date) <= endDate);
      }

      const periodDebit = filteredEntries.reduce((sum, e) => sum + e.debit, 0);
      const periodCredit = filteredEntries.reduce((sum, e) => sum + e.credit, 0);
      const closingBalance = openingBalance + periodDebit - periodCredit;

      return successResponse({
        type: "STUDENT",
        entity: student,
        options: { students, staffList, bankAccounts },
        statement: {
          openingBalance,
          totalDebit: periodDebit,
          totalCredit: periodCredit,
          closingBalance,
          entries: filteredEntries,
        },
      });
    }

    // =========================================================================
    // STAFF SALARY STATEMENT / LEDGER
    // =========================================================================
    if (type === "STAFF") {
      if (!targetEntityId) {
        return successResponse({
          type: "STAFF",
          entity: null,
          options: { students, staffList, bankAccounts },
          statement: {
            openingBalance: 0,
            totalDebit: 0,
            totalCredit: 0,
            closingBalance: 0,
            entries: [],
          },
        });
      }

      const staff = await prisma.staffProfile.findFirst({
        where: { id: targetEntityId, tenantId },
      });

      if (!staff) {
        return errorResponse("Staff member not found", 404);
      }

      const salaryRecords = await prisma.salaryLedger.findMany({
        where: {
          staffProfileId: staff.id,
          tenantId,
        },
        include: {
          academicYear: true,
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      });

      let runningBalance = 0;
      const allEntries: any[] = [];

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      salaryRecords.forEach((sal) => {
        const monthLabel = `${monthNames[sal.month - 1] || sal.month} ${sal.year}`;
        // sal.netPayable is a Prisma.Decimal (schema: Decimal(15,2)). Convert to
        // a plain number before any arithmetic: `number += Decimal` coerces the
        // Decimal via its `valueOf()`, which returns a *string*, so `+=` does
        // STRING CONCATENATION rather than addition (e.g. 0 += "5000" yields
        // the string "05000", and a second record then concatenates onto that
        // string too, producing a garbled running balance instead of a sum).
        const netPayableNum = sal.netPayable.toNumber();

        // Credit: Salary Accrual (Institution owes staff)
        runningBalance += netPayableNum;
        allEntries.push({
          id: `salary-accrual-${sal.id}`,
          date: sal.createdAt,
          refId: `PAY-${sal.year}-${String(sal.month).padStart(2, "0")}`,
          type: "CREDIT",
          category: "SALARY_ACCRUAL",
          description: `Salary Accrual for ${monthLabel}`,
          debit: 0,
          credit: netPayableNum,
          runningBalance,
          status: sal.status,
          paymentMethod: "-",
          details: {
            baseSalary: sal.baseSalary,
            deductions: sal.deductions,
            advances: sal.advances,
          },
        });

        // Debit: Salary Payout (Disbursed to staff)
        if (sal.paidAmount > 0) {
          runningBalance -= sal.paidAmount;
          allEntries.push({
            id: `salary-paid-${sal.id}`,
            date: sal.paidAt || sal.updatedAt,
            refId: `DISB-${sal.id.slice(-6).toUpperCase()}`,
            type: "DEBIT",
            category: "SALARY_DISBURSEMENT",
            description: `Salary Payout Disbursed for ${monthLabel}`,
            debit: sal.paidAmount,
            credit: 0,
            runningBalance,
            status: "PAID",
            paymentMethod: "BANK_TRANSFER",
            details: {
              paidAt: sal.paidAt,
            },
          });
        }
      });

      // Filter by Date Range
      let filteredEntries = allEntries;
      let openingBalance = 0;

      if (startDate) {
        const priorEntries = allEntries.filter((e) => new Date(e.date) < startDate);
        if (priorEntries.length > 0) {
          openingBalance = priorEntries[priorEntries.length - 1].runningBalance;
        }
        filteredEntries = filteredEntries.filter((e) => new Date(e.date) >= startDate);
      }

      if (endDate) {
        filteredEntries = filteredEntries.filter((e) => new Date(e.date) <= endDate);
      }

      const periodDebit = filteredEntries.reduce((sum, e) => sum + e.debit, 0);
      const periodCredit = filteredEntries.reduce((sum, e) => sum + e.credit, 0);
      const closingBalance = openingBalance + periodCredit - periodDebit;

      return successResponse({
        type: "STAFF",
        entity: staff,
        options: { students, staffList, bankAccounts },
        statement: {
          openingBalance,
          totalDebit: periodDebit,
          totalCredit: periodCredit,
          closingBalance,
          entries: filteredEntries,
        },
      });
    }

    // =========================================================================
    // BANK / CASH GENERAL ACCOUNT STATEMENT
    // =========================================================================
    if (type === "ACCOUNT") {
      if (!targetEntityId) {
        return successResponse({
          type: "ACCOUNT",
          entity: null,
          options: { students, staffList, bankAccounts },
          statement: {
            openingBalance: 0,
            totalDebit: 0,
            totalCredit: 0,
            closingBalance: 0,
            entries: [],
          },
        });
      }

      const account = await prisma.bankAccount.findFirst({
        where: { id: targetEntityId, tenantId },
      });

      if (!account) {
        return errorResponse("Bank account not found", 404);
      }

      // 1. Fee collection deposits (Inflow / Debit to Bank)
      const transactions = await prisma.transaction.findMany({
        where: { tenantId },
        orderBy: { timestamp: "asc" },
      });
      const feeVouchers = await prisma.feeVoucher.findMany({
        where: {
          tenantId,
          id: { in: transactions.map((transaction) => transaction.feeVoucherId) },
        },
        select: { id: true, voucherId: true },
      });
      const voucherIds = new Map(
        feeVouchers.map((voucher) => [voucher.id, voucher.voucherId])
      );

      // 2. Expenses (Outflow / Credit from Bank)
      const expenses = await prisma.expense.findMany({
        where: { tenantId },
        orderBy: { expenseDate: "asc" },
      });
      const expenseCategories = await prisma.expenseCategory.findMany({
        where: {
          tenantId,
          id: { in: expenses.map((expense) => expense.categoryId) },
        },
        select: { id: true, name: true },
      });
      const expenseCategoryNames = new Map(
        expenseCategories.map((category) => [category.id, category.name])
      );

      // 3. Paid Salary Disbursements (Outflow)
      const salaries = await prisma.salaryLedger.findMany({
        where: { tenantId, status: "PAID", paidAmount: { gt: 0 } },
        orderBy: { paidAt: "asc" },
      });
      const staffProfiles = await prisma.staffProfile.findMany({
        where: {
          tenantId,
          id: { in: salaries.map((salary) => salary.staffProfileId) },
        },
        select: { id: true, firstName: true, lastName: true, designation: true },
      });
      const staffById = new Map(
        staffProfiles.map((staffProfile) => [staffProfile.id, staffProfile])
      );

      let runningBalance = account.openingBalance || 0;
      const allEntries: any[] = [];

      // Add Opening Balance as starting anchor
      allEntries.push({
        id: `open-${account.id}`,
        date: account.createdAt,
        refId: "OPENING-BAL",
        type: "DEBIT",
        category: "OPENING_BALANCE",
        description: `Initial Opening Balance for ${account.accountName}`,
        debit: account.openingBalance,
        credit: 0,
        runningBalance: account.openingBalance,
        status: "CLEARED",
        paymentMethod: account.accountType,
      });

      // Inflow: Fee Collections
      transactions.forEach((tx) => {
        runningBalance += tx.amountPaid;
        allEntries.push({
          id: `tx-${tx.id}`,
          date: tx.timestamp || tx.createdAt,
          refId: tx.receiptNumber || tx.transactionId,
          type: "DEBIT",
          category: "FEE_COLLECTION",
          description: `Fee Deposit: ${voucherIds.get(tx.feeVoucherId) || "Tuition Collection"} (${tx.note || "Direct Deposit"})`,
          debit: tx.amountPaid,
          credit: 0,
          runningBalance,
          status: "CLEARED",
          paymentMethod: tx.paymentMethod,
        });
      });

      // Outflow: Expenses
      expenses.forEach((exp) => {
        runningBalance -= exp.amount;
        allEntries.push({
          id: `exp-${exp.id}`,
          date: exp.expenseDate,
          refId: exp.expenseNumber,
          type: "CREDIT",
          category: "EXPENSE_PAYOUT",
          description: `Expense: ${exp.title} (${expenseCategoryNames.get(exp.categoryId) || "General"})`,
          debit: 0,
          credit: exp.amount,
          runningBalance,
          status: "CLEARED",
          paymentMethod: exp.paymentMethod,
        });
      });

      // Outflow: Salary Payouts
      salaries.forEach((sal) => {
        runningBalance -= sal.paidAmount;
        const staffProfile = staffById.get(sal.staffProfileId);
        allEntries.push({
          id: `sal-${sal.id}`,
          date: sal.paidAt || sal.updatedAt,
          refId: `PAY-${sal.year}-${String(sal.month).padStart(2, "0")}`,
          type: "CREDIT",
          category: "PAYROLL_DISBURSEMENT",
          description: `Payroll Disbursement: ${staffProfile?.firstName || "Staff"} ${staffProfile?.lastName || ""} (${staffProfile?.designation || "Payroll"})`,
          debit: 0,
          credit: sal.paidAmount,
          runningBalance,
          status: "CLEARED",
          paymentMethod: "BANK",
        });
      });

      // Sort all entries chronologically
      allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Recalculate true progressive running balance in chronological order
      let progressive = 0;
      allEntries.forEach((entry) => {
        if (entry.category === "OPENING_BALANCE") {
          progressive = entry.debit;
          entry.runningBalance = progressive;
        } else {
          progressive = progressive + entry.debit - entry.credit;
          entry.runningBalance = progressive;
        }
      });

      // Filter by Date Range
      let filteredEntries = allEntries;
      let openingBalance = 0;

      if (startDate) {
        const priorEntries = allEntries.filter((e) => new Date(e.date) < startDate);
        if (priorEntries.length > 0) {
          openingBalance = priorEntries[priorEntries.length - 1].runningBalance;
        }
        filteredEntries = filteredEntries.filter((e) => new Date(e.date) >= startDate);
      }

      if (endDate) {
        filteredEntries = filteredEntries.filter((e) => new Date(e.date) <= endDate);
      }

      const periodDebit = filteredEntries.reduce((sum, e) => sum + e.debit, 0);
      const periodCredit = filteredEntries.reduce((sum, e) => sum + e.credit, 0);
      const closingBalance = openingBalance + periodDebit - periodCredit;

      return successResponse({
        type: "ACCOUNT",
        entity: account,
        options: { students, staffList, bankAccounts },
        statement: {
          openingBalance,
          totalDebit: periodDebit,
          totalCredit: periodCredit,
          closingBalance,
          entries: filteredEntries,
        },
      });
    }

    return errorResponse("Invalid statement type. Supported: STUDENT, STAFF, ACCOUNT", 400);
  } catch (error) {
    return handleApiError(error, "GET /api/accounting/statements");
  }
}
