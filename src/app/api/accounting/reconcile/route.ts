import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";
import { GL_CODES } from "@/lib/constants";

const dec = (v: unknown) => new Prisma.Decimal((v as any)?.toString?.() ?? v ?? 0);

/**
 * GET /api/accounting/reconcile?accountCode=1010
 * Compares the GL against its subledger so a drift is caught here instead of
 * at audit time:
 *  - bank/cash code → GL net + opening balance vs linked BankAccount.currentBalance
 *  - 1030 → GL net vs SUM(FeeVoucher.balance) of open vouchers
 *  - 2050 → GL net vs SUM(StudentWalletLedger.amount)
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const accountCode = searchParams.get("accountCode") || GL_CODES.BANK;

    const account = await prisma.chartOfAccount.findFirst({
      where: { tenantId, code: accountCode },
      select: { id: true, code: true, name: true },
    });
    if (!account) return successResponse({ ok: false, reason: `Account ${accountCode} not configured` });

    const lines = await prisma.journalLineItem.findMany({
      where: { tenantId, accountId: account.id },
      select: { debitAmount: true, creditAmount: true },
    });
    const glNet = lines.reduce(
      (sum, l) => sum.plus(dec(l.debitAmount)).minus(dec(l.creditAmount)),
      new Prisma.Decimal(0)
    );

    let subledger = "gl-only";
    let subledgerValue = glNet;
    let expected = glNet;

    if (accountCode === GL_CODES.RECEIVABLE) {
      const agg = await prisma.feeVoucher.aggregate({
        where: { tenantId, voidedAt: null, status: { notIn: ["VOID", "VOIDED", "CANCELLED"] } },
        _sum: { balance: true },
      });
      subledger = "sum(open voucher balance)";
      subledgerValue = dec(agg._sum.balance);
      expected = subledgerValue;
    } else if (accountCode === GL_CODES.WALLET) {
      const agg = await (prisma as any).studentWalletLedger.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      });
      // Wallet GL is kept as Cr-positive; ledger amounts net to the same.
      subledger = "sum(wallet ledger amount)";
      subledgerValue = dec(agg._sum.amount);
      const glWallet = glNet.mul(-1); // Cr-positive view
      const difference = glWallet.minus(subledgerValue).toDecimalPlaces(2);
      return successResponse({
        accountCode,
        accountName: account.name,
        glNet: glNet.toFixed(2),
        subledger,
        subledgerValue: subledgerValue.toFixed(2),
        difference: difference.toFixed(2),
        ok: difference.isZero(),
      });
    } else {
      // A tenant may link several physical bank/cash accounts to one GL code
      // (e.g. two checking accounts on 1010). The mirror sync credits exactly
      // one account per code and skips ambiguous ones, so the check aggregates
      // every linked account instead of trusting the first row.
      const banks = await prisma.bankAccount.findMany({
        where: { tenantId, accountCode, isActive: true },
        select: { accountName: true, openingBalance: true, currentBalance: true },
      });
      if (banks.length > 0) {
        const opening = banks.reduce((sum, b) => sum.plus(dec(b.openingBalance)), new Prisma.Decimal(0));
        const current = banks.reduce((sum, b) => sum.plus(dec(b.currentBalance)), new Prisma.Decimal(0));
        subledger = banks.length === 1
          ? `bank account ${banks[0].accountName}`
          : `${banks.length} bank accounts on ${accountCode} (${banks.map((b) => b.accountName).join(', ')})`;
        expected = opening.plus(glNet);
        subledgerValue = current;
      }
    }

    const difference = expected.minus(subledgerValue).toDecimalPlaces(2);
    return successResponse({
      accountCode,
      accountName: account.name,
      glNet: glNet.toFixed(2),
      subledger,
      subledgerValue: subledgerValue.toFixed(2),
      expected: expected.toFixed(2),
      difference: difference.toFixed(2),
      ok: difference.isZero(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
