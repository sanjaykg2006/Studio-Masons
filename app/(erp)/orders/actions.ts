"use server";
import { prisma } from "@/lib/prisma";

// An invoice as exchanged with the client. Prisma Decimals are converted to numbers
// and nulls to undefined so the object survives the server→client boundary and maps
// cleanly onto the client-side Invoice type. The in-memory File is never persisted —
// only its name (fileName) is kept.
export type InvoiceDTO = {
  id: string;
  vendor: string;
  project: string;
  amount: string;
  amountNum: number;
  due: string;
  status: string;
  flagged?: boolean;
  baseValue?: number;
  sgstPct?: number;
  cgstPct?: number;
  igstPct?: number;
  remarks?: string;
  amountPayable?: number;
  requestedAmount?: number;
  advanceDeducted?: number;
  tdsPct?: number;
  retentionHeld?: boolean;
  retentionAmount?: number;
  taxLines?: { base: number; sgst: number; cgst: number; igst: number }[];
  otherCharges?: number;
  retentionEarlyRelease?: boolean;
  pmApprovedAt?: string;
  pmApprovedBy?: string;
  accountsApprovedBy?: string;
  fileName?: string;
};

export type PaymentRequestDTO = {
  id: string;
  vendor: string;
  project: string;
  amount: string;
  amountNum: number;
  requested: string;
  status: string;
  notes?: string;
  invoiceRef?: string;
  priority?: string;
  accountsApprovedBy?: string;
  paidBy?: string;
  fileName?: string;
};

const num = (v: { toString(): string } | null) => (v == null ? undefined : Number(v));
const str = (v: string | null) => (v == null ? undefined : v);

// ── Invoices ──────────────────────────────────────────────────────
export async function loadInvoices(): Promise<InvoiceDTO[]> {
  const rows = await prisma.vendorInvoice.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    vendor: r.vendor,
    project: r.project,
    amount: r.amount,
    amountNum: Number(r.amountNum),
    due: r.due,
    status: r.status,
    flagged: r.flagged,
    baseValue: num(r.baseValue),
    sgstPct: num(r.sgstPct),
    cgstPct: num(r.cgstPct),
    igstPct: num(r.igstPct),
    remarks: str(r.remarks),
    amountPayable: num(r.amountPayable),
    requestedAmount: num(r.requestedAmount),
    advanceDeducted: num(r.advanceDeducted),
    tdsPct: num(r.tdsPct),
    retentionHeld: r.retentionHeld,
    retentionAmount: num(r.retentionAmount),
    taxLines: (r.taxLines as InvoiceDTO["taxLines"]) ?? undefined,
    otherCharges: num(r.otherCharges),
    retentionEarlyRelease: r.retentionEarlyRelease,
    pmApprovedAt: str(r.pmApprovedAt),
    pmApprovedBy: str(r.pmApprovedBy),
    accountsApprovedBy: str(r.accountsApprovedBy),
    fileName: str(r.fileName),
  }));
}

// Replaces the whole invoice set with the supplied list — the client holds the full
// collection in state, so persistence is a wipe-and-recreate inside a transaction.
export async function saveInvoices(list: InvoiceDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.vendorInvoice.deleteMany({}),
    prisma.vendorInvoice.createMany({
      data: list.map((i) => ({
        id: i.id,
        vendor: i.vendor,
        project: i.project,
        amount: i.amount,
        amountNum: i.amountNum,
        due: i.due,
        status: i.status,
        flagged: i.flagged ?? false,
        baseValue: i.baseValue ?? null,
        sgstPct: i.sgstPct ?? null,
        cgstPct: i.cgstPct ?? null,
        igstPct: i.igstPct ?? null,
        remarks: i.remarks ?? null,
        amountPayable: i.amountPayable ?? null,
        requestedAmount: i.requestedAmount ?? null,
        advanceDeducted: i.advanceDeducted ?? null,
        tdsPct: i.tdsPct ?? null,
        retentionHeld: i.retentionHeld ?? false,
        retentionAmount: i.retentionAmount ?? null,
        taxLines: i.taxLines ?? undefined,
        otherCharges: i.otherCharges ?? null,
        retentionEarlyRelease: i.retentionEarlyRelease ?? false,
        pmApprovedAt: i.pmApprovedAt ?? null,
        pmApprovedBy: i.pmApprovedBy ?? null,
        accountsApprovedBy: i.accountsApprovedBy ?? null,
        fileName: i.fileName ?? null,
      })),
    }),
  ]);
}

// ── Payment requests ─────────────────────────────────────────────
export async function loadPaymentRequests(): Promise<PaymentRequestDTO[]> {
  const rows = await prisma.paymentRequest.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    vendor: r.vendor,
    project: r.project,
    amount: r.amount,
    amountNum: Number(r.amountNum),
    requested: r.requested,
    status: r.status,
    notes: str(r.notes),
    invoiceRef: str(r.invoiceRef),
    priority: str(r.priority),
    accountsApprovedBy: str(r.accountsApprovedBy),
    paidBy: str(r.paidBy),
    fileName: str(r.fileName),
  }));
}

export async function savePaymentRequests(list: PaymentRequestDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.paymentRequest.deleteMany({}),
    prisma.paymentRequest.createMany({
      data: list.map((r) => ({
        id: r.id,
        vendor: r.vendor,
        project: r.project,
        amount: r.amount,
        amountNum: r.amountNum,
        requested: r.requested,
        status: r.status,
        notes: r.notes ?? null,
        invoiceRef: r.invoiceRef ?? null,
        priority: r.priority ?? null,
        accountsApprovedBy: r.accountsApprovedBy ?? null,
        paidBy: r.paidBy ?? null,
        fileName: r.fileName ?? null,
      })),
    }),
  ]);
}
