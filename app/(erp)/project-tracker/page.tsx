"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useProject } from "../../../contexts/ProjectContext";
import { useToast } from "@/lib/toast";
import {
  loadTrackerPage,
  assignLead,
  setHelpers,
  updateStage,
  approveStageChange,
  rejectStageChange,
  triggerHandoff,
  type TeamRole,
  type ProjectStageDTO,
  type ProjectTeamDTO,
  type TrackerActor,
  type TeamMemberDTO,
  type StageStatus,
  type StageZone,
  type StagePatch,
} from "../data";
import DrawingIssueRegister from "./DrawingIssueRegister";
import ChangeRiskTracker from "./ChangeRiskTracker";

type Tab = "stages" | "drawings" | "changes";

// ── Status colour logic (from the Design Operating System deck) ──────
const STATUS_META: Record<StageStatus, { label: string; color: string; bg: string; border: string }> = {
  NOT_STARTED: { label: "Not started", color: "#666666", bg: "#f0eded",                 border: "#e4e2e1" },
  ON_TRACK:    { label: "On track",    color: "#16a34a", bg: "rgba(34,197,94,0.10)",    border: "rgba(34,197,94,0.30)" },
  SUBMITTED:   { label: "Submitted",   color: "#2563eb", bg: "rgba(37,99,235,0.10)",    border: "rgba(37,99,235,0.30)" },
  DELAY_RISK:  { label: "Delay risk",  color: "#b45309", bg: "rgba(217,119,6,0.12)",    border: "rgba(217,119,6,0.30)" },
  DELAYED:     { label: "Delayed",     color: "#dc2626", bg: "rgba(220,38,38,0.10)",    border: "rgba(220,38,38,0.30)" },
  ON_HOLD:     { label: "On hold",     color: "#6b7280", bg: "rgba(107,114,128,0.12)",  border: "rgba(107,114,128,0.30)" },
  DONE:        { label: "Done",        color: "#15803d", bg: "rgba(21,128,61,0.12)",    border: "rgba(21,128,61,0.35)" },
};
const STATUS_ORDER: StageStatus[] = ["NOT_STARTED", "ON_TRACK", "SUBMITTED", "DELAY_RISK", "DELAYED", "ON_HOLD", "DONE"];
const PHASES = ["Initiation", "Design Development", "Approval + GFC", "Execution Control"];

function StatusPill({ status }: { status: StageStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", border: `1px solid ${m.border}`, background: m.bg, color: m.color, whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function toInputDate(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export default function ProjectTrackerPage() {
  const { selectedProject } = useProject();
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [stages, setStages] = useState<ProjectStageDTO[]>([]);
  const [team, setTeam] = useState<ProjectTeamDTO | null>(null);
  const [actor, setActor] = useState<TrackerActor | null>(null);
  const [members, setMembers] = useState<TeamMemberDTO[]>([]);
  const [mounted, setMounted] = useState(false);

  const [tab, setTab] = useState<Tab>("stages");
  const [editStage, setEditStage] = useState<ProjectStageDTO | null>(null);
  const [draft, setDraft] = useState<StagePatch>({});
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setMounted(true), []);

  const reload = useCallback(async (projectId: string) => {
    const data = await loadTrackerPage(projectId);
    setStages(data.stages);
    setTeam(data.team);
    setActor(data.actor);
    setMembers(data.members);
    setLoaded(true);
  }, []);

  const pid = selectedProject?.id;
  useEffect(() => {
    if (!pid) { setLoaded(true); return; }
    setLoaded(false);
    reload(pid).catch((err) => { console.warn("[Tracker] load failed:", err); setLoaded(true); });
  }, [pid, reload]);

  // ── Permission helpers (the server re-checks all of these) ──────────
  const isAdmin = actor?.role === "ADMIN";
  const canManageTeam = isAdmin || actor?.role === "PROJECT_MANAGER";
  const isConceptLead = !!actor && team?.conceptLeadId === actor.id;
  const isProjectLead = !!actor && team?.projectLeadId === actor.id;
  const handoffDone = !!team?.handoffAt;
  const isConceptVice = !!actor && team?.conceptViceLeadId === actor.id;
  const isProjectVice = !!actor && team?.projectViceLeadId === actor.id;
  const canManageRegisters = isAdmin || canManageTeam || isConceptLead || isProjectLead || isConceptVice || isProjectVice;

  // Authority rank within a zone (mirrors the server): 3 PM/admin, 2 lead, 1 vice, 0 none.
  const rankForZone = (zone: StageZone): number => {
    if (canManageTeam) return 3;
    if (!actor || !team) return 0;
    const leadId = zone === "CONCEPT" ? team.conceptLeadId : team.projectLeadId;
    const viceId = zone === "CONCEPT" ? team.conceptViceLeadId : team.projectViceLeadId;
    if (actor.id === leadId) return 2;
    if (actor.id === viceId) return 1;
    return 0;
  };

  // Can touch a stage's operational columns (status moves are gated separately).
  const canEditColumns = (s: ProjectStageDTO) =>
    rankForZone(s.zone) >= 1 && (s.zone === "PROJECT" ? handoffDone : true);
  // Can approve a queued status move on this stage (strictly higher than requester).
  const canApprove = (s: ProjectStageDTO) =>
    s.pendingStatus !== null && rankForZone(s.zone) > (s.pendingRank ?? 0);
  // Can clear a queued request: a higher post, or the original requester.
  const canCancel = (s: ProjectStageDTO) =>
    s.pendingStatus !== null && (canApprove(s) || (!!actor && actor.id === s.pendingById));

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? null;
  const membersForZone = (zone: StageZone) => {
    const tag = zone === "CONCEPT" ? "Concept" : "Project";
    const tagged = members.filter((m) => m.team === tag);
    return tagged.length > 0 ? tagged : members; // fall back to all if none tagged yet
  };

  // ── Snapshot metrics ────────────────────────────────────────────────
  const currentStage = stages.find((s) => s.status !== "DONE");
  const gateStages = stages.filter((s) => s.gateNumber !== null);
  const gatesCleared = gateStages.filter((s) => s.status === "DONE").length;
  const flagged = stages.filter((s) => s.status === "DELAY_RISK" || s.status === "DELAYED").length;
  const doneCount = stages.filter((s) => s.status === "DONE").length;
  const stage11 = stages.find((s) => s.stageNumber === 11);

  // ── Actions ─────────────────────────────────────────────────────────
  async function doAssignLead(zone: StageZone, role: TeamRole, memberId: string) {
    if (!pid || !memberId) return;
    setBusy(true);
    const res = await assignLead({ projectId: pid, zone, role, memberId });
    setBusy(false);
    if (!res.ok) { toast.error("Couldn't assign", res.error); return; }
    toast.success(`${role === "LEAD" ? "Lead" : "Vice lead"} assigned`, "This role is now locked for the project.");
    reload(pid);
  }

  async function doApprove(s: ProjectStageDTO) {
    if (!pid) return;
    const res = await approveStageChange({ projectId: pid, stageNumber: s.stageNumber });
    if (!res.ok) { toast.error("Couldn't approve", res.error); return; }
    toast.success("Change approved", `Stage ${s.stageNumber} updated.`);
    reload(pid);
  }
  async function doReject(s: ProjectStageDTO) {
    if (!pid) return;
    const res = await rejectStageChange({ projectId: pid, stageNumber: s.stageNumber });
    if (!res.ok) { toast.error("Couldn't clear request", res.error); return; }
    toast.success("Request cleared", `Stage ${s.stageNumber} request removed.`);
    reload(pid);
  }

  async function toggleHelper(zone: StageZone, memberId: string) {
    if (!pid || !team) return;
    const cur = zone === "CONCEPT" ? team.conceptHelpers : team.projectHelpers;
    const next = cur.includes(memberId) ? cur.filter((x) => x !== memberId) : [...cur, memberId];
    const res = await setHelpers({ projectId: pid, zone, memberIds: next });
    if (!res.ok) { toast.error("Couldn't update helpers", res.error); return; }
    reload(pid);
  }

  function openEdit(s: ProjectStageDTO) {
    setEditStage(s);
    setDraft({
      status: s.status,
      ownerId: s.ownerId,
      plannedDate: s.plannedDate,
      actualDate: s.actualDate,
      dependency: s.dependency,
      risk: s.risk,
      nextAction: s.nextAction,
      notes: s.notes,
    });
  }

  async function saveEdit() {
    if (!pid || !editStage) return;
    setBusy(true);
    // Drop the status field for auto stages so the server doesn't reject the patch.
    const patch: StagePatch = { ...draft };
    if (editStage.auto) delete patch.status;
    const res = await updateStage({ projectId: pid, stageNumber: editStage.stageNumber, patch });
    setBusy(false);
    if (!res.ok) { toast.error("Couldn't save stage", res.error); return; }
    if (res.queued) toast.info("Sent for approval", `Stage ${editStage.stageNumber} status change awaits a higher post's approval.`);
    else toast.success("Stage updated", `Stage ${editStage.stageNumber} saved.`);
    setEditStage(null);
    reload(pid);
  }

  async function doHandoff() {
    if (!pid) return;
    setBusy(true);
    const res = await triggerHandoff({ projectId: pid });
    setBusy(false);
    if (!res.ok) { toast.error("Handoff blocked", res.error); return; }
    toast.success("Control handed off", "The Project team now owns stages 12–14.");
    setHandoffOpen(false);
    reload(pid);
  }

  const handoffReady = stage11?.status === "DONE" && (isConceptLead || isAdmin) && !handoffDone;

  // ── No project selected ─────────────────────────────────────────────
  if (loaded && !selectedProject) {
    return (
      <div>
        <Breadcrumb />
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Project Tracker</h2>
        <p style={{ fontSize: "16px", color: "#666666", marginBottom: "40px" }}>
          Track every project from brief to GFC release and site support across the 14-stage workflow.
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "96px 24px", textAlign: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#f8f8f8", border: "1px solid #e4e2e1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "#e4e2e1" }}>timeline</span>
          </div>
          <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "#333333", marginBottom: "8px" }}>No Project Selected</h3>
          <p style={{ fontSize: "16px", color: "#666666", maxWidth: "420px", lineHeight: 1.6 }}>
            Use the <span style={{ fontWeight: "bold", color: "#e30613" }}>Project Selector</span> in the top bar to choose a project and view its stage tracker.
          </p>
        </div>
      </div>
    );
  }

  if (!loaded || !team) {
    return (
      <div>
        <Breadcrumb />
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Project Tracker</h2>
        <div style={{ padding: "80px", textAlign: "center", color: "#999999" }}>Loading tracker…</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb />

      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333]">Project Tracker</h2>
          <p style={{ fontSize: "16px", color: "#666666", marginTop: "4px" }}>
            Design Operating System for <strong style={{ color: "#333333" }}>{selectedProject!.name}</strong>
            <span style={{ color: "#e4e2e1", margin: "0 8px" }}>•</span>
            <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#e30613" }}>{selectedProject!.status}</span>
          </p>
        </div>
        <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: "bold", border: "1px solid", ...(handoffDone ? { background: "rgba(37,99,235,0.08)", color: "#2563eb", borderColor: "rgba(37,99,235,0.25)" } : { background: "rgba(227,6,19,0.06)", color: "#e30613", borderColor: "rgba(227,6,19,0.2)" }) }}>
          Control: {handoffDone ? "Project team" : "Concept team"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#e4e2e1] mb-8">
        {([
          { id: "stages", label: "Stage Tracker", icon: "timeline" },
          { id: "drawings", label: "Drawing Issue Register", icon: "draft" },
          { id: "changes", label: "Change & Risk", icon: "published_with_changes" },
        ] as { id: Tab; label: string; icon: string }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-[14px] font-bold border-b-2 -mb-px transition-colors ${tab === t.id ? "border-[#e30613] text-[#e30613]" : "border-transparent text-[#666666] hover:text-[#333333]"}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "drawings" && <DrawingIssueRegister projectId={pid!} canManage={canManageRegisters} />}
      {tab === "changes" && <ChangeRiskTracker projectId={pid!} canManage={canManageRegisters} />}

      {tab === "stages" && (<>
      {/* Snapshot strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Kpi label="Current stage" value={currentStage ? `${currentStage.stageNumber} / 14` : "Complete"} sub={currentStage ? currentStage.activity : "All stages done"} color="#2563eb" />
        <Kpi label="Gates cleared" value={`${gatesCleared} / 7`} sub="Approval checkpoints" color="#16a34a" />
        <Kpi label="At-risk / delayed" value={`${flagged}`} sub="Amber + red items" color={flagged > 0 ? "#dc2626" : "#666666"} />
        <Kpi label="Stages complete" value={`${doneCount} / 14`} sub="Marked done" color="#e30613" />
      </div>

      {/* Ownership */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ZoneTeamCard
          title="Concept team" subtitle="Stages 1–11 · brief → GFC" zone="CONCEPT"
          leadId={team.conceptLeadId} viceLeadId={team.conceptViceLeadId} helperIds={team.conceptHelpers}
          members={members} pickFrom={membersForZone("CONCEPT")} canManage={canManageTeam}
          memberName={memberName} onAssign={(role, id) => doAssignLead("CONCEPT", role, id)} onToggleHelper={(id) => toggleHelper("CONCEPT", id)}
        />
        <ZoneTeamCard
          title="Project team" subtitle="Stages 12–14 · execution control" zone="PROJECT"
          leadId={team.projectLeadId} viceLeadId={team.projectViceLeadId} helperIds={team.projectHelpers}
          members={members} pickFrom={membersForZone("PROJECT")} canManage={canManageTeam}
          memberName={memberName} onAssign={(role, id) => doAssignLead("PROJECT", role, id)} onToggleHelper={(id) => toggleHelper("PROJECT", id)}
        />
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999999", marginRight: "4px" }}>Status</span>
        {STATUS_ORDER.map((s) => <StatusPill key={s} status={s} />)}
      </div>

      {/* Stage-gate dashboard, grouped by phase */}
      {PHASES.map((phase) => {
        const phaseStages = stages.filter((s) => s.phase === phase);
        if (phaseStages.length === 0) return null;
        const showHandoffAfter = phase === "Approval + GFC";
        return (
          <div key={phase} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-5 bg-[#e30613]" />
              <h3 className="text-[18px] font-bold text-[#333333]">{phase}</h3>
              <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#999999" }}>
                {phaseStages[0].zone === "CONCEPT" ? "Concept zone" : "Project zone"}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {phaseStages.map((s) => (
                <StageCard key={s.stageNumber} stage={s} ownerName={memberName(s.ownerId)} canEdit={canEditColumns(s)} onEdit={() => openEdit(s)}
                  canApprove={canApprove(s)} canCancel={canCancel(s)} onApprove={() => doApprove(s)} onCancel={() => doReject(s)} />
              ))}
            </div>

            {showHandoffAfter && (
              <HandoffDivider
                handoffDone={handoffDone} handoffBy={team.handoffBy} handoffAt={team.handoffAt}
                ready={!!handoffReady} stage11Done={stage11?.status === "DONE"}
                onClick={() => setHandoffOpen(true)}
              />
            )}
          </div>
        );
      })}
      </>)}

      {/* ── Edit stage modal ───────────────────────────────────────── */}
      {mounted && editStage && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setEditStage(null)}>
          <div style={{ background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: "640px", borderRadius: "10px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#e30613" }}>Stage {editStage.stageNumber} · {editStage.zone === "CONCEPT" ? "Concept" : "Project"}</p>
                <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "#333333" }}>{editStage.activity}</h3>
              </div>
              <button onClick={() => setEditStage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px", overflowY: "auto" }}>
              {/* Status */}
              <Field label="Status">
                {editStage.auto ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <StatusPill status={editStage.status} />
                    <span style={{ fontSize: "11px", color: "#999999" }}>Auto-reflected from {editStage.autoSource === "survey" ? "Site Survey" : "Design approvals"} — not editable here.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {STATUS_ORDER.map((st) => {
                      const m = STATUS_META[st];
                      const active = draft.status === st;
                      return (
                        <button key={st} onClick={() => setDraft((d) => ({ ...d, status: st }))}
                          style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", border: `1px solid ${active ? m.border : "#e4e2e1"}`, background: active ? m.bg : "white", color: active ? m.color : "#666666" }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!editStage.auto && rankForZone(editStage.zone) < 3 && (
                  <p style={{ fontSize: "11px", color: "#b45309", marginTop: "8px" }}>
                    A status change you make is submitted as a <strong>request</strong> and applies only after a higher post approves it. Other fields save immediately.
                  </p>
                )}
                {editStage.pendingStatus && (
                  <p style={{ fontSize: "11px", color: "#666666", marginTop: "6px" }}>
                    Pending request: <StatusPill status={editStage.pendingStatus} /> by {editStage.pendingBy ?? "—"}.
                  </p>
                )}
              </Field>

              {/* Owner */}
              <Field label="Owner (main owner)">
                <select value={draft.ownerId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value || null }))}
                  style={selectStyle}>
                  <option value="">— Unassigned —</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.team ? ` · ${m.team}` : ""}</option>)}
                </select>
              </Field>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <Field label="Planned date">
                  <input type="date" value={toInputDate(draft.plannedDate ?? null)} onChange={(e) => setDraft((d) => ({ ...d, plannedDate: e.target.value || null }))} style={inputStyle} />
                </Field>
                <Field label="Actual date">
                  <input type="date" value={toInputDate(draft.actualDate ?? null)} onChange={(e) => setDraft((d) => ({ ...d, actualDate: e.target.value || null }))} style={inputStyle} />
                </Field>
              </div>

              {/* Dependency / Risk / Next action */}
              <Field label="Dependency (pending input from client / MEP / QS / vendor)">
                <input value={draft.dependency ?? ""} onChange={(e) => setDraft((d) => ({ ...d, dependency: e.target.value }))} placeholder="e.g. Awaiting client ceiling-height confirmation" style={inputStyle} />
              </Field>
              <Field label="Risk">
                <input value={draft.risk ?? ""} onChange={(e) => setDraft((d) => ({ ...d, risk: e.target.value }))} placeholder="e.g. MEP coordination slip may delay GFC" style={inputStyle} />
              </Field>
              <Field label="Next action">
                <input value={draft.nextAction ?? ""} onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))} placeholder="e.g. Close revision register" style={inputStyle} />
              </Field>
              <Field label="Notes">
                <textarea value={draft.notes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </Field>

              {/* Gate context */}
              {editStage.gateNumber !== null && (
                <div style={{ background: "rgba(227,6,19,0.04)", border: "1px solid rgba(227,6,19,0.15)", borderRadius: "8px", padding: "12px 14px" }}>
                  <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#e30613", marginBottom: "4px" }}>Approval Gate {editStage.gateNumber}</p>
                  <p style={{ fontSize: "13px", color: "#333333" }}>{editStage.gateCheck}</p>
                  <p style={{ fontSize: "11px", color: "#666666", marginTop: "3px" }}>Owner: {editStage.gateOwner} · Output: {editStage.gateOutput}</p>
                </div>
              )}
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setEditStage(null)} style={btnGhost}>Cancel</button>
              <button onClick={saveEdit} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save stage"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Handoff confirm modal ──────────────────────────────────── */}
      {mounted && handoffOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setHandoffOpen(false)}>
          <div style={{ background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: "480px", borderRadius: "10px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e4e2e1", background: "#f8f8f8" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "#333333" }}>Hand off to Project team?</h3>
            </div>
            <div style={{ padding: "24px", fontSize: "14px", color: "#333333", lineHeight: 1.6 }}>
              This transfers control from the <strong>Concept team</strong> to the <strong>Project team</strong> and unlocks stages 12–14 (DTM, site support, change control). The Concept team&apos;s role shifts to drawing clarification and approved change control only. This cannot be undone.
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setHandoffOpen(false)} style={btnGhost}>Cancel</button>
              <button onClick={doHandoff} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? "Working…" : "Confirm handoff"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────
function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-wider">
      <span>Dashboard</span>
      <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
      <span className="text-[#e30613]">Project Tracker</span>
    </nav>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ border: "1px solid #e4e2e1", borderRadius: "12px", padding: "18px 20px", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999999" }}>{label}</p>
      <p style={{ fontSize: "28px", fontWeight: "bold", color, marginTop: "4px", lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: "11px", color: "#666666", marginTop: "2px" }}>{sub}</p>
    </div>
  );
}

function ZoneTeamCard({ title, subtitle, leadId, viceLeadId, helperIds, members, pickFrom, canManage, memberName, onAssign, onToggleHelper }: {
  title: string; subtitle: string; zone: StageZone;
  leadId: string | null; viceLeadId: string | null; helperIds: string[]; members: TeamMemberDTO[]; pickFrom: TeamMemberDTO[];
  canManage: boolean; memberName: (id: string | null) => string | null;
  onAssign: (role: TeamRole, id: string) => void; onToggleHelper: (id: string) => void;
}) {
  const helperOptions = pickFrom.filter((m) => m.id !== leadId && m.id !== viceLeadId);
  return (
    <div style={{ border: "1px solid #e4e2e1", borderRadius: "12px", padding: "20px", background: "#f8f8f8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ marginBottom: "14px" }}>
        <h4 style={{ fontSize: "16px", fontWeight: "bold", color: "#333333" }}>{title}</h4>
        <p style={{ fontSize: "11px", color: "#999999" }}>{subtitle}</p>
      </div>

      <RoleSlot label="Lead · sole decision-maker" holderId={leadId} pickFrom={pickFrom} exclude={viceLeadId} canManage={canManage} memberName={memberName} onAssign={(id) => onAssign("LEAD", id)} />
      <div style={{ height: "12px" }} />
      <RoleSlot label="Vice lead · deputy + can request changes" holderId={viceLeadId} pickFrom={pickFrom} exclude={leadId} canManage={canManage} memberName={memberName} onAssign={(id) => onAssign("VICE", id)} />

      {/* Helpers */}
      <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999999", margin: "16px 0 6px" }}>Support architects</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {helperIds.length === 0 && !canManage && <span style={{ fontSize: "13px", color: "#999999", fontStyle: "italic" }}>None</span>}
        {(canManage ? helperOptions : members.filter((m) => helperIds.includes(m.id))).map((m) => {
          const on = helperIds.includes(m.id);
          return (
            <button key={m.id} disabled={!canManage} onClick={() => onToggleHelper(m.id)}
              style={{ padding: "5px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", cursor: canManage ? "pointer" : "default", border: `1px solid ${on ? "rgba(227,6,19,0.3)" : "#e4e2e1"}`, background: on ? "rgba(227,6,19,0.06)" : "white", color: on ? "#e30613" : "#666666" }}>
              {on && <span style={{ marginRight: "4px" }}>✓</span>}{m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A single locked role slot (lead or vice lead) — assignable once by a manager.
function RoleSlot({ label, holderId, pickFrom, exclude, canManage, memberName, onAssign }: {
  label: string; holderId: string | null; pickFrom: TeamMemberDTO[]; exclude: string | null;
  canManage: boolean; memberName: (id: string | null) => string | null; onAssign: (id: string) => void;
}) {
  const [pick, setPick] = useState("");
  const options = pickFrom.filter((m) => m.id !== exclude);
  return (
    <div>
      <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999999", marginBottom: "6px" }}>{label}</p>
      {holderId ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "white", border: "1px solid #e4e2e1", borderRadius: "8px" }}>
          <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#eae8e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", color: "#e30613" }}>
            {(memberName(holderId) ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#333333", flex: 1 }}>{memberName(holderId) ?? "Unknown member"}</span>
          <span className="material-symbols-outlined" title="Locked once assigned" style={{ fontSize: "16px", color: "#999999" }}>lock</span>
        </div>
      ) : canManage ? (
        <div style={{ display: "flex", gap: "8px" }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
            <option value="">Select…</option>
            {options.map((m) => <option key={m.id} value={m.id}>{m.name}{m.team ? ` · ${m.team}` : ""}</option>)}
          </select>
          <button onClick={() => { if (pick) onAssign(pick); }} disabled={!pick} style={{ ...btnPrimary, padding: "8px 16px", opacity: pick ? 1 : 0.5 }}>Assign</button>
        </div>
      ) : (
        <p style={{ fontSize: "13px", color: "#999999", fontStyle: "italic" }}>Not yet assigned.</p>
      )}
    </div>
  );
}

function StageCard({ stage, ownerName, canEdit, onEdit, canApprove, canCancel, onApprove, onCancel }: { stage: ProjectStageDTO; ownerName: string | null; canEdit: boolean; onEdit: () => void; canApprove: boolean; canCancel: boolean; onApprove: () => void; onCancel: () => void }) {
  const flagged = stage.status === "DELAYED" || stage.status === "DELAY_RISK";
  return (
    <div style={{ border: `1px solid ${flagged ? "rgba(220,38,38,0.3)" : "#e4e2e1"}`, borderRadius: "10px", background: "white", padding: "16px 18px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0eded", color: "#e30613", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px", flexShrink: 0 }}>{stage.stageNumber}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <p style={{ fontSize: "15px", fontWeight: "bold", color: "#333333" }}>{stage.activity}</p>
            {stage.gateNumber !== null && (
              <span title={`${stage.gateCheck} · ${stage.gateOwner}`} style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 7px", borderRadius: "4px", background: "#1a1a1a", color: "white" }}>
                Gate {stage.gateNumber}
              </span>
            )}
            {stage.auto && (
              <span title="Auto-reflected from Site Survey" style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", padding: "2px 7px", borderRadius: "4px", background: "rgba(37,99,235,0.1)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.25)" }}>Auto</span>
            )}
          </div>
          <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>
            <strong style={{ color: "#333333" }}>Deliverable:</strong> {stage.output} · <span style={{ color: "#999999" }}>{stage.checkpoint}</span>
          </p>
        </div>
        <StatusPill status={stage.status} />
        {canEdit && (
          <button onClick={onEdit} style={{ padding: "5px 12px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", color: "#333333", background: "white", cursor: "pointer", flexShrink: 0 }}>Edit</button>
        )}
      </div>

      {/* Dashboard columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #f0eded" }}>
        <Cell label="Owner" value={ownerName ?? "—"} />
        <Cell label="Planned" value={fmtDate(stage.plannedDate)} />
        <Cell label="Actual" value={fmtDate(stage.actualDate)} />
        <Cell label="Dependency" value={stage.dependency || "—"} accent={!!stage.dependency} />
        <Cell label="Risk" value={stage.risk || "—"} accent={!!stage.risk} danger={flagged} />
        <Cell label="Next action" value={stage.nextAction || "—"} />
      </div>

      {/* Pending status-change request awaiting approval */}
      {stage.pendingStatus && (
        <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.25)", borderRadius: "8px", padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#b45309" }}>pending_actions</span>
            <span style={{ fontSize: "12px", color: "#333333" }}>
              <strong>{stage.pendingBy ?? "Someone"}</strong> requested change to <StatusPill status={stage.pendingStatus} /> — awaiting a higher post&apos;s approval.
            </span>
          </div>
          {(canApprove || canCancel) && (
            <div style={{ display: "flex", gap: "8px" }}>
              {canApprove && (
                <button onClick={onApprove} style={{ padding: "5px 14px", border: "1px solid rgba(21,128,61,0.3)", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", color: "#15803d", background: "rgba(21,128,61,0.08)", cursor: "pointer" }}>Approve</button>
              )}
              {canCancel && (
                <button onClick={onCancel} style={{ padding: "5px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", color: "#ba1a1a", background: "white", cursor: "pointer" }}>{canApprove ? "Reject" : "Cancel"}</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em", color: "#999999", marginBottom: "2px" }}>{label}</p>
      <p style={{ fontSize: "12px", color: danger ? "#dc2626" : accent ? "#333333" : "#666666", fontWeight: accent ? "600" : "400", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
    </div>
  );
}

function HandoffDivider({ handoffDone, handoffBy, handoffAt, ready, stage11Done, onClick }: {
  handoffDone: boolean; handoffBy: string | null; handoffAt: string | null; ready: boolean; stage11Done: boolean; onClick: () => void;
}) {
  return (
    <div style={{ margin: "20px 0 4px", border: `1px dashed ${handoffDone ? "rgba(37,99,235,0.4)" : "#e30613"}`, borderRadius: "10px", padding: "16px 20px", background: handoffDone ? "rgba(37,99,235,0.04)" : "rgba(227,6,19,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span className="material-symbols-outlined" style={{ color: handoffDone ? "#2563eb" : "#e30613" }}>swap_horiz</span>
        <div>
          <p style={{ fontSize: "13px", fontWeight: "bold", color: "#333333" }}>Concept → Project handoff (Stage 11 → 12)</p>
          <p style={{ fontSize: "11px", color: "#666666" }}>
            {handoffDone
              ? `Control transferred by ${handoffBy ?? "—"} on ${fmtDate(handoffAt)}.`
              : stage11Done ? "Stage 11 is done — ready to hand control to the Project team." : "Locked until Stage 11 (Final GFC issue) is marked Done."}
          </p>
        </div>
      </div>
      {handoffDone ? (
        <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: "bold", background: "rgba(37,99,235,0.1)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.25)" }}>Handed off</span>
      ) : (
        <button onClick={onClick} disabled={!ready} title={ready ? "" : "Stage 11 must be Done and you must be the Concept lead"}
          style={{ ...btnPrimary, opacity: ready ? 1 : 0.45, cursor: ready ? "pointer" : "not-allowed" }}>
          Hand off to Project team
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999999", marginBottom: "6px" }}>{label}</p>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "13px", color: "#333333", outline: "none", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", background: "white" };
const btnPrimary: React.CSSProperties = { padding: "8px 20px", border: "none", borderRadius: "6px", background: "#e30613", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "13px" };
const btnGhost: React.CSSProperties = { padding: "8px 20px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "13px" };
