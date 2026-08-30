import { prisma } from "@/lib/prisma";
import { dispatchToRecipients } from "../index";

export async function triggerFeeReminders(input: { tenantId: string; daysBeforeDue?: number; now?: Date }) {
  try {
    const now = input.now || new Date(); const end = new Date(now); end.setDate(end.getDate() + (input.daysBeforeDue ?? 3));
    const vouchers = await prisma.feeVoucher.findMany({ where: { tenantId: input.tenantId, balance: { gt: 0 }, status: { not: "PAID" }, dueDate: { gte: now, lte: end } }, include: { studentProfile: { include: { class: true } } } });
    await Promise.all(vouchers.map((voucher) => dispatchToRecipients({ tenantId: input.tenantId, event: "FEE_REMINDER", recipients: [{ phone: voucher.studentProfile.guardianContact, email: voucher.studentProfile.guardianEmail, name: voucher.studentProfile.guardianName }], variables: { studentName: `${voucher.studentProfile.firstName} ${voucher.studentProfile.lastName}`, className: voucher.studentProfile.class?.name || "", dueDate: voucher.dueDate.toISOString().slice(0, 10), dueAmount: voucher.balance, voucherId: voucher.voucherId } })));
    return vouchers.length;
  } catch (error) { console.error("Fee reminder notification failed", error); return 0; }
}
