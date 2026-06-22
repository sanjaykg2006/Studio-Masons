"use client";
// Multi-sheet Budget BOQ parser. Real consolidated BOQs (e.g. the Indegene file)
// carry one sheet per package plus summary/measurement sheets, varied header
// layouts, and split supply/installation rate columns. This reads EVERY sheet,
// best-effort detects its columns, auto-flags non-line-item sheets to skip, and
// treats each remaining sheet as a package (packageName = sheet name). The QS
// reviews the result before release — see BudgetBoqTab.
import * as XLSX from "xlsx";

export type ParsedBudgetLine = {
  item: string;
  unit: string;
  budgetedQty: number;
  supplyRate?: number;
  installRate?: number;
  rate: number;   // effective combined rate
  amount: number;
};

export type ParsedSheet = {
  sheetName: string;
  suggestedPackage: string;
  skipped: boolean;          // auto-suggestion; the QS can override in review
  skipReason?: string;
  rateMode: "single" | "split" | "none";
  columnNote: string;        // human summary of what was detected
  lines: ParsedBudgetLine[];
};

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// Strong vs weak description keywords; "item"/"work" are weak because "Item No"
// and "Total Amount" can masquerade as them.
const DESC_STRONG = ["description", "particular", "nomenclature", "scope", "of work"];
const DESC_WEAK = ["item", "service", "work"];
const SERIAL_HEADERS = ["item no", "item no.", "sl no", "sl.no", "s.no", "s no", "sno", "si no", "s.l", "sl", "s no.", "version"];

function cleanNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function findDescCol(cells: string[]): number {
  const isSerial = (h: string) => SERIAL_HEADERS.includes(h);
  // Prefer a strong keyword that isn't a serial-number header.
  for (let i = 0; i < cells.length; i++) {
    const h = norm(cells[i]);
    if (h && DESC_STRONG.some((k) => h.includes(k)) && !isSerial(h)) return i;
  }
  for (let i = 0; i < cells.length; i++) {
    const h = norm(cells[i]);
    if (h && DESC_WEAK.some((k) => h.includes(k)) && !isSerial(h)) return i;
  }
  return -1;
}

function findCol(cells: string[], test: (h: string) => boolean): number {
  return cells.findIndex((c) => { const h = norm(c); return !!h && test(h); });
}

// A qty column is one whose header mentions qty/quantity/nos, or a bare "total"
// that is not a money column (so the C&I "TOTAL" qty is caught, "TOTAL AMOUNT" isn't).
function findQtyCol(cells: string[]): number {
  const direct = findCol(cells, (h) => h.includes("qty") || h.includes("quantity") || h === "nos" || h.includes("nos."));
  if (direct !== -1) return direct;
  return findCol(cells, (h) => h.includes("total") && !h.includes("amount") && !h.includes("amt") && !h.includes("value"));
}

export async function parseBudgetWorkbook(file: File): Promise<ParsedSheet[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: ParsedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const nameNorm = norm(sheetName);

    // Auto-skip obvious non-line-item sheets by name.
    if (/summary|measurement|^m sheet|cost-?summary/.test(nameNorm)) {
      out.push({ sheetName, suggestedPackage: sheetName.trim(), skipped: true, skipReason: "Looks like a summary / measurement sheet", rateMode: "none", columnNote: "—", lines: [] });
      continue;
    }

    // Locate the header row: a description-ish column plus a qty / rate / amount.
    let headerIdx = -1, descCol = -1, unitCol = -1, qtyCol = -1, amountCol = -1;
    let supplyCol = -1, installCol = -1, singleRateCol = -1;
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const cells = rows[i].map((c) => String(c ?? ""));
      const d = findDescCol(cells);
      if (d === -1) continue;
      const q = findQtyCol(cells);
      const rateLike = findCol(cells, (h) => h.includes("rate") || h.includes("price"));
      const amt = findCol(cells, (h) => h.includes("amount"));
      if (q === -1 && rateLike === -1 && amt === -1) continue;

      headerIdx = i; descCol = d; qtyCol = q;
      unitCol = findCol(cells, (h) => h.includes("unit") || h.includes("uom") || h === "u.o.m");
      amountCol = findCol(cells, (h) => h.includes("amount") && !h.includes("rate"));
      // Split supply / installation rate columns (tolerate the "suply" misspelling).
      supplyCol = findCol(cells, (h) => (h.includes("supply") || h.includes("suply")) && h.includes("rate"));
      installCol = findCol(cells, (h) => h.includes("install") && h.includes("rate"));
      // Multi-row header: a bare "Rate" with "Supply | Installation" on the next row.
      if (supplyCol === -1 && installCol === -1 && i + 1 < rows.length) {
        // Array.from densifies any sparse holes so findIndex never sees `undefined`.
        const sub = Array.from(rows[i + 1] ?? [], (c) => norm(c));
        const s = sub.findIndex((h) => h.includes("supply") || h.includes("suply"));
        const ins = sub.findIndex((h) => h.includes("install"));
        if (s !== -1 && ins !== -1) { supplyCol = s; installCol = ins; }
      }
      if (supplyCol === -1 && installCol === -1) {
        // Single rate: prefer an exact "rate" over "basic rate".
        singleRateCol = findCol(cells, (h) => (h === "rate" || h === "rate ") );
        if (singleRateCol === -1) singleRateCol = findCol(cells, (h) => (h.includes("rate") || h.includes("price")) && !h.includes("basic") && !h.includes("per sqft") && !h.includes("per sq"));
        if (singleRateCol === -1) singleRateCol = rateLike;
      }
      break;
    }

    if (headerIdx === -1) {
      out.push({ sheetName, suggestedPackage: sheetName.trim(), skipped: true, skipReason: "No BOQ header row found", rateMode: "none", columnNote: "—", lines: [] });
      continue;
    }

    const rateMode: ParsedSheet["rateMode"] = supplyCol !== -1 && installCol !== -1 ? "split" : singleRateCol !== -1 ? "single" : "none";
    const lines: ParsedBudgetLine[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const cells = rows[i];
      const item = String(cells[descCol] ?? "").trim();
      if (!item || item.length < 2) continue;
      if (/^\d+(\.\d+)?$/.test(item)) continue; // stray serial number leaked into desc
      const qty = qtyCol !== -1 ? cleanNum(cells[qtyCol]) : 0;
      const supply = supplyCol !== -1 ? cleanNum(cells[supplyCol]) : undefined;
      const install = installCol !== -1 ? cleanNum(cells[installCol]) : undefined;
      const rate = rateMode === "split" ? (supply ?? 0) + (install ?? 0) : singleRateCol !== -1 ? cleanNum(cells[singleRateCol]) : 0;
      const amount = amountCol !== -1 ? cleanNum(cells[amountCol]) : qty * rate;
      // Skip section headings / spec paragraphs: no qty, no rate, no amount.
      if (!qty && !rate && !amount) continue;
      lines.push({ item, unit: unitCol !== -1 ? String(cells[unitCol] ?? "").trim() : "", budgetedQty: qty, supplyRate: supply, installRate: install, rate, amount });
    }

    const parts = [`desc col ${descCol}`, unitCol !== -1 ? "unit" : "no unit", qtyCol !== -1 ? "qty" : "no qty",
      rateMode === "split" ? "supply+install rate" : rateMode === "single" ? "rate" : "no rate", amountCol !== -1 ? "amount" : "computed amount"];

    out.push({
      sheetName,
      suggestedPackage: sheetName.trim(),
      skipped: lines.length === 0,
      skipReason: lines.length === 0 ? "No priced line items found" : undefined,
      rateMode,
      columnNote: parts.join(" · "),
      lines,
    });
  }

  return out;
}
