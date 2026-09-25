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

    const academicYearId = searchParams.get("academicYearId") || "";
    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam + "T23:59:59.999Z") : null;

    // 1. Return list of available entities for dropdowns if requested or alongside data
    const [students, staffList, bankAccounts, academicYears] = await Promise.all([
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
        // No `take` cap: the statement must be reachable for *every* active
        // student. The old cap of 200 silently hid the 201st student's
        // statement from the picker entirely.
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
      prisma.academicYear.findMany({
        where: { tenantId },
        select: {
          id: true,
          label: true,
          isCurrent: true,
        },
        orderBy: { startDate: "desc" },
      }),
    ]);

    // Target specific entity if provided; if none selected, empty state is returned with options
    const targetEntityId = entityId;

    // =========================================================================
    // STUDENT FEE STATEMENT
    // =========================================================================
    if (type === "STUDENT") {
      if (!targetEntityId) {
        return successResponse({
          type: "STUDENT",
          entity: null,
          options: { students, staffList, bankAccounts, academicYears },
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
          ...(academicYearId ? { academicYearId } : {}),
        },
        orderBy: { createdAt: "asc" },
      });

      const [voucherAcademicYears, transactions] = await Promise.all([
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
            isVoided: false,
            feeVoucherId: { in: vouchers.map((voucher) => voucher.id) },
          },
          include: {
            collectedBy: { select: { name: true } },
          },
          orderBy: { timestamp: "asc" },
        }),
      ]);
      const academicYearLabels = new Map(
        voucherAcademicYears.map((ay) => [ay.id, ay.label])
      );
      const transactionsByVoucherId = new Map<string, typeof transactions>();
      for (const transaction of transactions) {
        const voucherTransactions = transactionsByVoucherId.get(transaction.feeVoucherId) || [];
        voucherTransactions.push(transaction);
        transactionsByVoucherId.set(transaction.feeVoucherId, voucherTransactions);
      }

      // Calculate Aging Analysis (0-30, 31-60, 61-90, 90+ days)
      let currentAging = 0;
      let days30Aging = 0;
      let days60Aging = 0;
      let days90PlusAging = 0;
      const now = new Date();

      vouchers.forEach((v) => {
        const vTx = transactionsByVoucherId.get(v.id) || [];
        const paidForVoucher = vTx.reduce((sum, tx) => sum + Number(tx.amountPaid), 0);
        const outstanding = Math.max(0, Number(v.totalDue) - paidForVoucher);
        if (outstanding > 0 && v.status !== "PAID" && v.status !== "VOID") {
          const dueTime = v.dueDate ? new Date(v.dueDate).getTime() : new Date(v.createdAt).getTime();
          const daysPastDue = Math.floor((now.getTime() - dueTime) / (1000 * 60 * 60 * 24));
          if (daysPastDue <= 30) {
            currentAging += outstanding;
          } else if (daysPastDue <= 60) {
            days30Aging += outstanding;
          } else if (daysPastDue <= 90) {
            days60Aging += outstanding;
          } else {
            days90PlusAging += outstanding;
          }
        }
      });

      const aging = {
        current: Math.round(currentAging * 100) / 100,
        days30: Math.round(days30Aging * 100) / 100,
        days60: Math.round(days60Aging * 100) / 100,
        days90Plus: Math.round(days90PlusAging * 100) / 100,
        totalOverdue: Math.round((currentAging + days30Aging + days60Aging + days90PlusAging) * 100) / 100,
      };

      const rawEntries: any[] = [];

      vouchers.forEach((v) => {
        const vTx = transactionsByVoucherId.get(v.id) || [];
        const paidForVoucher = vTx.reduce((sum, tx) => sum + Number(tx.amountPaid), 0);

        rawEntries.push({
          id: `voucher-${v.id}`,
          date: v.createdAt,
          refId: v.voucherId,
          type: "DEBIT",
          category: "FEE_BILLING",
          description: `${v.feeType} (${academicYearLabels.get(v.academicYearId) || "General"})${v.billingMonth ? ` - ${v.billingMonth}/${v.billingYear}` : ""}`,
          debit: Number(v.totalDue),
          credit: 0,
          status: v.status,
          paymentMethod: "-",
          details: {
            voucherId: v.voucherId,
            feeType: v.feeType,
            billingMonth: v.billingMonth,
            billingYear: v.billingYear,
            dueDate: v.dueDate,
            baseAmount: Number(v.baseAmount),
            discount: Number(v.discountAmount),
            arrears: Number(v.arrears),
            totalDue: Number(v.totalDue),
            paidAmount: paidForVoucher,
            academicYear: academicYearLabels.get(v.academicYearId),
            status: v.status,
          },
        });

        vTx.forEach((tx) => {
          rawEntries.push({
            id: `tx-${tx.id}`,
            date: tx.timestamp || tx.createdAt,
            refId: tx.receiptNumber || tx.transactionId,
            type: "CREDIT",
            category: "FEE_PAYMENT",
            description: `Payment for ${v.voucherId} - ${tx.note || "Tuition Receipt"}`,
            debit: 0,
            credit: Number(tx.amountPaid),
            status: "PAID",
            paymentMethod: tx.paymentMethod,
            details: {
              receiptNumber: tx.receiptNumber,
              transactionId: tx.transactionId,
              paymentMethod: tx.paymentMethod,
              amountPaid: Number(tx.amountPaid),
              timestamp: tx.timestamp || tx.createdAt,
              note: tx.note,
              voucherId: v.voucherId,
              reference: tx.reference,
              chequeNumber: tx.chequeNumber,
              collectedBy: tx.collectedBy?.name || "Cashier Desk",
            },
          });
        });
      });

      // Sort chronologically BEFORE computing running balance
      rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBalance = 0;
      const allEntries = rawEntries.map((e) => {
        runningBalance = Math.round((runningBalance + e.debit - e.credit) * 100) / 100;
        return {
          ...e,
          runningBalance,
        };
      });

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

      const periodDebit = Math.round(filteredEntries.reduce((sum, e) => sum + e.debit, 0) * 100) / 100;
      const periodCredit = Math.round(filteredEntries.reduce((sum, e) => sum + e.credit, 0) * 100) / 100;
      const closingBalance = Math.round((openingBalance + periodDebit - periodCredit) * 100) / 100;

      return successResponse({
        type: "STUDENT",
        entity: student,
        options: { students, staffList, bankAccounts, academicYears },
        statement: {
          openingBalance,
          totalDebit: periodDebit,
          totalCredit: periodCredit,
          closingBalance,
          entries: filteredEntries,
          aging,
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
          options: { students, staffList, bankAccounts, academicYears },
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
          ...(academicYearId ? { academicYearId } : {}),
        },
        include: {
          academicYear: true,
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      });

      const rawStaffEntries: any[] = [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      salaryRecords.forEach((sal) => {
        const monthLabel = `${monthNames[sal.month - 1] || sal.month} ${sal.year}`;
        const netPayableNum = Number(sal.netPayable);

        // Credit: Salary Accrual (Institution owes staff)
        rawStaffEntries.push({
          id: `salary-accrual-${sal.id}`,
          date: sal.createdAt,
          refId: `PAY-${sal.year}-${String(sal.month).padStart(2, "0")}`,
          type: "CREDIT",
          category: "SALARY_ACCRUAL",
          description: `Salary Accrual for ${monthLabel}`,
          debit: 0,
          credit: netPayableNum,
          status: sal.status,
          paymentMethod: "-",
          details: {
            year: sal.year,
            month: sal.month,
            monthLabel,
            baseSalary: Number(sal.baseSalary),
            deductions: sal.deductions,
            advances: sal.advances,
            netPayable: netPayableNum,
            academicYear: sal.academicYear?.label,
            status: sal.status,
          },
        });

        // Debit: Salary Payout (Disbursed to staff)
        if (Number(sal.paidAmount) > 0) {
          rawStaffEntries.push({
            id: `salary-paid-${sal.id}`,
            date: sal.paidAt || sal.updatedAt,
            refId: `DISB-${sal.id.slice(-6).toUpperCase()}`,
            type: "DEBIT",
            category: "SALARY_DISBURSEMENT",
            description: `Salary Payout Disbursed for ${monthLabel}`,
            debit: Number(sal.paidAmount),
            credit: 0,
            status: "PAID",
            paymentMethod: "BANK_TRANSFER",
            details: {
              disbursementRef: `DISB-${sal.id.slice(-6).toUpperCase()}`,
              paidAmount: Number(sal.paidAmount),
              paidAt: sal.paidAt,
              monthLabel,
              paymentMethod: "BANK_TRANSFER",
            },
          });
        }
      });

      // Sort chronologically BEFORE computing running balance
      rawStaffEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let staffRunningBalance = 0;
      const allEntries = rawStaffEntries.map((e) => {
        staffRunningBalance = Math.round((staffRunningBalance + e.credit - e.debit) * 100) / 100;
        return {
          ...e,
          runningBalance: staffRunningBalance,
        };
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

      const periodDebit = Math.round(filteredEntries.reduce((sum, e) => sum + e.debit, 0) * 100) / 100;
      const periodCredit = Math.round(filteredEntries.reduce((sum, e) => sum + e.credit, 0) * 100) / 100;
      const closingBalance = Math.round((openingBalance + periodCredit - periodDebit) * 100) / 100;

      return successResponse({
        type: "STAFF",
        entity: staff,
        options: { students, staffList, bankAccounts, academicYears },
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
          options: { students, staffList, bankAccounts, academicYears },
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

      // GL-driven statement when the bank master is linked to a chart code:
      // every posted receipt, deposit, expense and payroll journal already
      // carries its debit/credit legs, so the ledger — not a synthetic
      // re-assembly of subledgers — is the single source of truth.
      if ((account as any).accountCode) {
        const glCode = (account as any).accountCode as string;
        const glAccount = await prisma.chartOfAccount.findFirst({
          where: { tenantId, code: glCode },
          select: { id: true, code: true, name: true },
        });
        if (glAccount) {
          const glLines = await prisma.journalLineItem.findMany({
            where: { tenantId, accountId: glAccount.id },
            include: {
              journalEntry: { select: { entryNumber: true, voucherType: true, postingDate: true, narration: true, reference: true } },
            },
            orderBy: { journalEntry: { postingDate: "asc" } },
          });

          const toNum = (v: unknown) => Number((v as any)?.toString?.() ?? v ?? 0);
          let runningBalance = account.openingBalance || 0;
          const allEntries: any[] = [
            {
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
            },
          ];
          for (const line of glLines) {
            const debit = toNum((line as any).debitAmount);
            const credit = toNum((line as any).creditAmount);
            runningBalance += debit - credit;
            const je = (line as any).journalEntry;
            allEntries.push({
              id: `gl-${line.id}`,
              date: je?.postingDate || (line as any).createdAt,
              refId: je?.entryNumber || je?.reference || "GL",
              type: debit > 0 ? "DEBIT" : "CREDIT",
              category: je?.voucherType || "JOURNAL",
              description: (line as any).narration || je?.narration || "General Ledger Entry",
              debit,
              credit,
              runningBalance,
              status: "CLEARED",
              paymentMethod: glCode,
            });
          }

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
          const expectedClosing = (account.openingBalance || 0) + glLines.reduce((s, l) => s + toNum((l as any).debitAmount) - toNum((l as any).creditAmount), 0);

          return successResponse({
            type: "ACCOUNT",
            entity: account,
            options: { students, staffList, bankAccounts, academicYears },
            statement: {
              openingBalance,
              totalDebit: periodDebit,
              totalCredit: periodCredit,
              closingBalance,
              entries: filteredEntries,
              glLinked: true,
              glCode,
              // Live currentBalance is synced on every post; any non-zero
              // difference here means a journal bypassed the posters.
              syncedBalance: account.currentBalance,
              difference: Number((expectedClosing - (account.currentBalance || 0)).toFixed(2)),
            },
          });
        }
      }

      // Unlinked bank master: legacy synthetic statement (subledgers).
      // 1. Fee collection deposits (Inflow / Debit to Bank)
      const transactions = await prisma.transaction.findMany({
        where: { tenantId, isVoided: false },
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
        runningBalance += Number(tx.amountPaid);
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
        options: { students, staffList, bankAccounts, academicYears },
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
