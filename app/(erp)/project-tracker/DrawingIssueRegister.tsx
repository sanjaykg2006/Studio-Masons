"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/lib/toast";
import {
  loadDrawingIssues,
  addDrawingIssue,
  updateDrawingIssue,
  deleteDrawingIssue,
  type DrawingIssueDTO,
  type DrawingIssueInput,
} from "../data";

const STATUSES = ["For Approval", "Issued", "Approved", "Superseded"];
const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "For Approval": { color: "#2563eb", bg: "rgba(37,99,235,0.1)",  border: "rgba(37,99,235,0.25)" },
  "Issued":       { color: "#b45309", bg: "rgba(217,119,6,0.12)", border: "rgba(217,119,6,0.25)" },
  "Approved":     { color: "#15803d", bg: "rgba(21,128,61,0.12)", border: "rgba(21,128,61,0.3)" },
  "Superseded":   { color: "#6b7280", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.25)" },
};

const EMPTY: DrawingIssueInput = { drawingNo: "", title: "", revision: "R0", issueDate: new Date().toISOString().slice(0, 10), recipients: "", purpose: "", status: "Issued" };

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DrawingIssueRegister({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<DrawingIssueDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DrawingIssueInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => setMounted(true), []);
  const reload = useCallback(() => {
    loadDrawingIssues(projectId).then(setRows).catch(() => setRows([])).finally(() => setLoaded(true));
  }, [projectId]);
  useEffect(() => { setLoaded(false); reload(); }, [reload]);

  function openAdd() { setEditId(null); setDraft({ ...EMPTY, issueDate: new Date().toISOString().slice(0, 10) }); setModalOpen(true); }
  function openEdit(r: DrawingIssueDTO) {
    setEditId(r.id);
    setDraft({ drawingNo: r.drawingNo, title: r.title, revision: r.revision, issueDate: r.issueDate.slice(0, 10), recipients: r.recipients, purpose: r.purpose ?? "", status: r.status });
    setModalOpen(true);
  }
  async function save() {
    if (!draft.drawingNo.trim() || !draft.title.trim()) { toast.error("Missing fields", "Drawing number and title are required."); return; }
    setBusy(true);
    const res = editId ? await updateDrawingIssue(editId, projectId, draft) : await addDrawingIssue(projectId, draft);
    setBusy(false);
    if (!res.ok) { toast.error("Couldn't save", res.error); return; }
    toast.success(editId ? "Drawing updated" : "Drawing logged", `${draft.drawingNo} ${draft.revision}`);
    setModalOpen(false); reload();
  }
  async function remove(r: DrawingIssueDTO) {
    if (!confirm(`Delete ${r.drawingNo} ${r.revision} from the register?`)) return;
    const res = await deleteDrawingIssue(r.id, projectId);
    if (!res.ok) { toast.error("Couldn't delete", res.error); return; }
    reload();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-[20px] font-bold text-[#333333]">Drawing Issue Register</h3>
          <p style={{ fontSize: "13px", color: "#666666" }}>Revision number, issue date, recipients and status for every drawing released.</p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="bg-[#e30613] text-white px-5 py-2.5 rounded-lg text-[13px] font-bold flex items-center gap-2 hover:opacity-90">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span> Log Drawing
          </button>
        )}
      </div>

      <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
        {!loaded ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#999999", fontSize: "14px" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-[#999999]">
            <span className="material-symbols-outlined" style={{ fontSize: "40px" }}>draft</span>
            <p style={{ fontSize: "14px" }}>No drawings issued yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-left" style={{ minWidth: "860px" }}>
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                  {["Drawing", "Rev", "Issue date", "Recipients", "Purpose", "Status", "By", canManage ? "" : null].filter((h) => h !== null).map((h, i) => (
                    <th key={i} style={{ padding: "14px 18px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#666666" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e2e1]">
                {rows.map((r) => {
                  const st = STATUS_STYLE[r.status] ?? STATUS_STYLE["Issued"];
                  return (
                    <tr key={r.id} className="hover:bg-[#f8f8f8]">
                      <td style={{ padding: "14px 18px" }}>
                        <p style={{ fontSize: "14px", fontWeight: "600", color: "#333333" }}>{r.drawingNo}</p>
                        <p style={{ fontSize: "12px", color: "#666666" }}>{r.title}</p>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: "bold", color: "#333333" }}>{r.revision}</td>
                      <td style={{ padding: "14px 18px", fontSize: "13px", color: "#666666" }}>{fmt(r.issueDate)}</td>
                      <td style={{ padding: "14px 18px", fontSize: "13px", color: "#666666", maxWidth: "200px" }}>{r.recipients || "—"}</td>
                      <td style={{ padding: "14px 18px", fontSize: "13px", color: "#666666" }}>{r.purpose || "—"}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", border: `1px solid ${st.border}`, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>{r.status}</span>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: "12px", color: "#999999" }}>{r.issuedBy || "—"}</td>
                      {canManage && (
                        <td style={{ padding: "14px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => openEdit(r)} style={iconBtn} title="Edit"><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span></button>
                          <button onClick={() => remove(r)} style={{ ...iconBtn, color: "#ba1a1a" }} title="Delete"><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mounted && modalOpen && createPortal(
        <div style={overlay} onClick={() => setModalOpen(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "#333333" }}>{editId ? "Edit drawing" : "Log drawing"}</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div style={modalBody}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                <L label="Drawing number"><input value={draft.drawingNo} onChange={(e) => setDraft({ ...draft, drawingNo: e.target.value })} placeholder="SM-GFC-001" style={inp} /></L>
                <L label="Revision"><input value={draft.revision} onChange={(e) => setDraft({ ...draft, revision: e.target.value })} placeholder="R0" style={inp} /></L>
              </div>
              <L label="Title / description"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ground floor GFC layout" style={inp} /></L>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <L label="Issue date"><input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} style={inp} /></L>
                <L label="Status"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={sel}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></L>
              </div>
              <L label="Recipients"><input value={draft.recipients} onChange={(e) => setDraft({ ...draft, recipients: e.target.value })} placeholder="Client, MEP consultant, site team" style={inp} /></L>
              <L label="Purpose (optional)"><input value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} placeholder="For Construction" style={inp} /></L>
            </div>
            <div style={modalFoot}>
              <button onClick={() => setModalOpen(false)} style={ghost}>Cancel</button>
              <button onClick={save} disabled={busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999999", marginBottom: "5px" }}>{label}</p>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "13px", color: "#333333", outline: "none", boxSizing: "border-box" };
const sel: React.CSSProperties = { ...inp, cursor: "pointer", background: "white" };
const iconBtn: React.CSSProperties = { padding: "5px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", cursor: "pointer", color: "#666666", marginLeft: "6px", display: "inline-flex", verticalAlign: "middle" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" };
const modalBox: React.CSSProperties = { background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: "560px", borderRadius: "10px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", display: "flex", flexDirection: "column" };
const modalHead: React.CSSProperties = { padding: "16px 24px", borderBottom: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center" };
const modalBody: React.CSSProperties = { padding: "24px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" };
const modalFoot: React.CSSProperties = { padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "10px" };
const ghost: React.CSSProperties = { padding: "8px 20px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "13px" };
const primary: React.CSSProperties = { padding: "8px 20px", border: "none", borderRadius: "6px", background: "#e30613", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "13px" };
