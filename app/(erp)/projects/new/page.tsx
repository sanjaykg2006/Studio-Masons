"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const engineers = ["Vikram R.", "Sneha P.", "Amit S.", "Rahul K.", "Priya M."];

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", clientName: "", location: "", engineer: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => router.push("/dashboard"), 1800);
  }

  const isValid = form.name.trim() && form.clientName.trim() && form.location.trim() && form.engineer;

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="material-symbols-outlined" style={{ color: "#16a34a", fontSize: "32px" }}>check_circle</span>
        </div>
        <p style={{ fontSize: "20px", fontWeight: "bold", color: "#333333" }}>Project Created</p>
        <p style={{ fontSize: "14px", color: "#666666" }}>Redirecting to dashboard…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", color: "#666666", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", padding: 0 }}>Dashboard</button>
        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
        <span style={{ color: "#e30613" }}>New Project</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#333333" }}>Add New Project</h1>
        <p style={{ fontSize: "14px", color: "#666666", marginTop: "4px" }}>Fill in the project details to get started.</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Project Details card */}
        <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", padding: "24px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666", marginBottom: "20px" }}>Project Details</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Project Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                Project Name <span style={{ color: "#e30613" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Indiranagar Duplex"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                required
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                onFocus={e => (e.target.style.borderColor = "#e30613")}
                onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
              />
            </div>

            {/* Client Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                Client Name <span style={{ color: "#e30613" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sharma Family"
                value={form.clientName}
                onChange={e => set("clientName", e.target.value)}
                required
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                onFocus={e => (e.target.style.borderColor = "#e30613")}
                onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
              />
            </div>

            {/* Location + Engineer row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                  Location <span style={{ color: "#e30613" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bengaluru"
                  value={form.location}
                  onChange={e => set("location", e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "#e30613")}
                  onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                  Site Engineer <span style={{ color: "#e30613" }}>*</span>
                </label>
                <select
                  value={form.engineer}
                  onChange={e => set("engineer", e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: form.engineer ? "#333333" : "#aaaaaa", background: "white", outline: "none", boxSizing: "border-box", appearance: "none" }}
                  onFocus={e => (e.target.style.borderColor = "#e30613")}
                  onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
                >
                  <option value="" disabled>Select engineer</option>
                  {engineers.map(eng => (
                    <option key={eng} value={eng}>{eng}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>Notes</label>
              <textarea
                placeholder="Any initial notes about scope, timeline, or special requirements…"
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "#e30613")}
                onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ padding: "10px 24px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", fontWeight: "600", color: "#666666", background: "white", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f8f8f8")}
            onMouseLeave={e => (e.currentTarget.style.background = "white")}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid}
            style={{ padding: "10px 28px", border: "none", borderRadius: "6px", fontSize: "14px", fontWeight: "bold", color: "white", background: isValid ? "#e30613" : "#e4e2e1", cursor: isValid ? "pointer" : "not-allowed", transition: "opacity 0.15s" }}
            onMouseEnter={e => { if (isValid) e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}
