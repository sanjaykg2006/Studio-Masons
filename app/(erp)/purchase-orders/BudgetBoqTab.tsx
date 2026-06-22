"use client";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/lib/toast";
import { parseBoqFile } from "./boqParser";
import { uploadFileToStorage, openDocument, isStored, docName } from "../docs";
import {
  loadBudgetBoq,
  saveBudgetBoqDraft,
  releaseBudgetBoq,
  setLinePackage,
  type BudgetBoqDTO,
  type BudgetLineInput,
} from "./procurement";

const card: React.CSSProperties = { background: "white", border: "1px solid #e4e2e1", borderRadius: "12px", padding: "24px" };
const cell: React.CSSProperties = { padding: "8px 10px", fontSize: "13px", color: "#333333", borderBottom: "1px solid #f0eeed" };
const th: React.CSSProperties = { ...cell, fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#999999", textAlign: "left" };
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type DraftRow = { item: string; unit: string; budgetedQty: string; rate: string };

export default function BudgetBoqTab({ projectId, projectName, role }: { projectId: string; projectName: string; role: string }) {
  const toast = useToast();
  const [boq, setBoq] = useState<BudgetBoqDTO | null>(null);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isQs = role === "SENIOR_QS" || role === "ADMIN";
  const isProc = role === "PROCUREMENT_MANAGER" || role === "ADMIN";
  const released = boq?.status === "RELEASED";

  useEffect(() => {
    if (!projectId) return;
    loadBudgetBoq(projectId).then(setBoq).catch(() => setBoq(null));
  }, [projectId]);

  async function importFile(file: File) {
    setBusy(true);
    try {
      const lines = await parseBoqFile(file);
      setDraft(lines.map((l) => ({ item: l.service, unit: l.unit, budgetedQty: l.quantity, rate: l.rate })));
      // Persist as a draft straight away so a reload doesn't lose the import. The
      // workbook itself is stored so it stays downloadable as the project's baseline.
      const input: BudgetLineInput[] = lines.map((l) => ({ item: l.service, unit: l.unit, budgetedQty: Number(l.quantity) || 0, rate: Number(l.rate) || 0 }));
      const path = await uploadFileToStorage(file, "budget-boq");
      const saved = await saveBudgetBoqDraft({ projectId, projectName, fileName: path, lines: input });
      setBoq(saved);
      setDraft([]);
      toast.success("Budget BOQ imported", `${input.length} lines read from ${file.name}. Review and release when ready.`);
    } catch (err) {
      toast.warning("Couldn't import the BOQ", err instanceof Error ? err.message : "The file couldn't be parsed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function release() {
    if (!boq) return;
    if (!confirm("Release the budget BOQ? Quantities lock and become the baseline for all purchase intents.")) return;
    setBusy(true);
    try {
      setBoq(await releaseBudgetBoq(boq.id));
      toast.success("Budget BOQ released", "It is now the locked baseline for purchase intents.");
    } catch (err) {
      toast.warning("Couldn't release", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function savePackage(lineId: string, value: string) {
    try {
      await setLinePackage(lineId, value);
      setBoq((b) => (b ? { ...b, lines: b.lines.map((l) => (l.id === lineId ? { ...l, packageName: value || null } : l)) } : b));
    } catch (err) {
      toast.warning("Couldn't save package", err instanceof Error ? err.message : "Try again.");
    }
  }

  const total = boq?.lines.reduce((s, l) => s + l.amount, 0) ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#333333" }}>Budget BOQ — {projectName || "the project"}</h3>
            <p style={{ fontSize: "13px", color: "#999999", marginTop: "4px", maxWidth: "560px", lineHeight: 1.5 }}>
              The Senior QS Engineer releases the budget BOQ — the locked baseline that gates every purchase intent.
              {released ? " Procurement can assign a package to each line." : " Upload an Excel BOQ, review, then release."}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isStored(boq?.fileName) && (
              <button type="button" onClick={() => openDocument(boq!.fileName!).catch((e) => toast.warning("Couldn't open file", e instanceof Error ? e.message : "Try again."))}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#0059a8", fontSize: "11px", fontWeight: "bold", padding: "4px 10px", cursor: "pointer" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>description</span>
                {docName(boq?.fileName)}
              </button>
            )}
            <span style={{ fontSize: "11px", fontWeight: "bold", padding: "4px 10px", borderRadius: "999px", background: released ? "rgba(22,163,74,0.1)" : "rgba(0,89,168,0.1)", color: released ? "#16a34a" : "#0059a8" }}>
              {boq ? (released ? "RELEASED · LOCKED" : "DRAFT") : "NOT CREATED"}
            </span>
          </div>
        </div>

        {isQs && !released && (
          <div style={{ marginTop: "16px", background: "#f8f8f8", border: "1px dashed #d4d2d1", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ fontSize: "12px", color: "#666666" }}>Import an Excel BOQ (.xlsx) — item, unit, quantity and rate are read in automatically.</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              style={{ display: "flex", alignItems: "center", gap: "6px", border: "1px solid #e4e2e1", borderRadius: "8px", background: "white", color: "#333333", fontSize: "12px", fontWeight: "bold", padding: "9px 14px", cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>upload_file</span>
              {busy ? "Working…" : boq ? "Re-import BOQ" : "Upload Budget BOQ"}
            </button>
          </div>
        )}
        {!isQs && !boq && <p style={{ marginTop: "16px", fontSize: "13px", color: "#999999" }}>Waiting for the Senior QS Engineer to upload the budget BOQ.</p>}
        {draft.length > 0 && <p style={{ marginTop: "12px", fontSize: "12px", color: "#0059a8" }}>Reading {draft.length} lines…</p>}
      </div>

      {boq && boq.lines.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#333333" }}>Lines · {boq.lines.length} · {inr(total)}</h3>
            {isQs && !released && (
              <button onClick={release} disabled={busy}
                style={{ display: "flex", alignItems: "center", gap: "6px", border: "none", borderRadius: "8px", background: "#16a34a", color: "white", fontSize: "13px", fontWeight: "bold", padding: "9px 16px", cursor: busy ? "wait" : "pointer" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>lock</span> Release &amp; Lock
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Package</th><th style={th}>Item</th><th style={th}>Unit</th>
                  <th style={{ ...th, textAlign: "right" }}>Budgeted</th>
                  {released && <th style={{ ...th, textAlign: "right" }}>Committed</th>}
                  {released && <th style={{ ...th, textAlign: "right" }}>Remaining</th>}
                  <th style={{ ...th, textAlign: "right" }}>Rate</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {boq.lines.map((l) => (
                  <tr key={l.id}>
                    <td style={cell}>
                      {released && isProc ? (
                        <input defaultValue={l.packageName ?? ""} placeholder="Package"
                          onBlur={(e) => { if (e.target.value !== (l.packageName ?? "")) savePackage(l.id, e.target.value); }}
                          style={{ width: "110px", padding: "4px 8px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "12px" }} />
                      ) : (l.packageName ?? "—")}
                    </td>
                    <td style={cell}>{l.item}</td>
                    <td style={cell}>{l.unit || "—"}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{l.budgetedQty}</td>
                    {released && <td style={{ ...cell, textAlign: "right", color: l.committedQty > 0 ? "#0059a8" : "#999999" }}>{l.committedQty}</td>}
                    {released && <td style={{ ...cell, textAlign: "right", fontWeight: "bold", color: l.remainingQty <= 0 ? "#ba1a1a" : "#16a34a" }}>{l.remainingQty}</td>}
                    <td style={{ ...cell, textAlign: "right" }}>{inr(l.rate)}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{inr(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
