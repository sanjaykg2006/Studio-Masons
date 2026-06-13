// One-off importer: reads the SMPL quality-control checklist workbook and
// normalizes every work-type sheet into prisma/quality-checklists.json, shaped
// as QualityChecklistTemplate[] for the seed script. Run: node prisma/import-quality-checklists.cjs
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const WORKBOOK = path.join(__dirname, "..", "SMPLPJR07 - Project Quality control checklist SMPL format.xlsx");
const OUT = path.join(__dirname, "quality-checklists.json");

const SKIP_SHEETS = new Set(["Draft", "Index"]);
const HEADER_RE = /^(description|item description|inspection details|work description)$/i;
const FOOTER_RE = /^(observations?|comments?|prepared by|for contractor|for consultant|for client|name|signature|date|location)\s*:?\s*$/i;
// A label that is *exactly* a footer word (e.g. "Observations:") ends the body;
// an item that merely starts with "Observation #01 …" must not.
const FOOTER_LABEL_RE = /^(observations?|comments?)(\s+if any)?\s*:?\s*$/i;
const SECTION_RE = /^[A-Z]$/; // single-letter section markers (A / B / C)

// Build a discipline lookup (C&I / MEP / Structural) from the Index sheet, keyed
// by a normalized checklist name so we can tag each template.
function buildDisciplineMap(wb) {
  const idx = XLSX.utils.sheet_to_json(wb.Sheets["Index"], { header: 1, blankrows: false, defval: "" });
  const map = new Map();
  for (const row of idx) {
    const name = String(row[1] || "").trim();
    const disc = String(row[2] || "").trim();
    if (name && disc) map.set(norm(name), disc);
  }
  return map;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
// Collapse embedded line breaks / repeated spaces from multiline Excel cells.
const clean = (s) => String(s).replace(/\s+/g, " ").trim();

// Resolve a discipline for a sheet name by fuzzy-matching against the Index. The
// sheet tab names are truncated/abbreviated, so fall back to prefix containment.
function disciplineFor(sheetName, discMap) {
  const n = norm(sheetName);
  if (discMap.has(n)) return discMap.get(n);
  for (const [key, disc] of discMap) {
    if (key.startsWith(n) || n.startsWith(key)) return disc;
    if (n.length >= 6 && (key.includes(n) || n.includes(key))) return disc;
  }
  // Tab-name heuristics for the MEP electrical/HVAC/fire sheets.
  if (/hvac|duct|vav|copperpipe|insulation|fan|ahu|cassette|diffuser/.test(n)) return "MEP";
  if (/electric|cable|conduit|earth|raceway|panel|switch|wiring|lt|mcb|db|light|ups|distribution/.test(n)) return "MEP";
  if (/fapa|sprinkler|damper|fire|smoke/.test(n)) return "MEP";
  if (/structural|erection/.test(n)) return "Structural";
  return "C&I";
}

// Pick the description column. Prefer the header cell that names it; otherwise
// choose the data column with the most free text (handles matrix-style sheets).
function findLayout(rows) {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const col = rows[r].findIndex((c) => HEADER_RE.test(String(c).trim()));
    if (col >= 0) return { headerRow: r, descCol: col };
  }
  // Fallback: richest-text column across the body.
  const counts = {};
  rows.forEach((row) =>
    row.forEach((c, i) => {
      const t = String(c).trim();
      if (t.length > 12 && isNaN(Number(t))) counts[i] = (counts[i] || 0) + 1;
    })
  );
  const descCol = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1);
  return { headerRow: -1, descCol };
}

// The "Above & below ceiling check" sheet is a nested completion matrix: numeric
// col-0 marks a phase, a single-letter col-1 marks a sub-section, and item text
// lives in col-3. Flatten it to "Phase — Subsection" categories.
function parseCeilingMatrix(rows) {
  const sections = [];
  let phase = "";
  let current = null;
  for (const row of rows) {
    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    const c2 = String(row[2] ?? "").trim();
    const c3 = String(row[3] ?? "").trim();
    if (/^prepared by/i.test(c0)) break;
    if (/^\d+$/.test(c0) && c1) { phase = c1; current = null; continue; }
    if (/^[A-Z]$/.test(c1) && c2) {
      current = { name: clean(phase ? `${phase} — ${c2}` : c2), items: [] };
      sections.push(current);
      if (c3) current.items.push({ label: clean(c3), linked: false });
      continue;
    }
    if (c3) {
      if (!current) { current = { name: phase || "Checklist", items: [] }; sections.push(current); }
      current.items.push({ label: clean(c3), linked: false });
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

function parseSheet(rows, sheetName) {
  if (/above\s*&?\s*below ceiling/i.test(sheetName)) return parseCeilingMatrix(rows);
  const { headerRow, descCol } = findLayout(rows);
  const sections = [];
  let current = null;
  const pushItem = (label) => {
    if (!current) {
      current = { name: "Checklist", items: [] };
      sections.push(current);
    }
    const linked = /defect|snag|leak|pressure test|water tight|leakage/i.test(label);
    current.items.push({ label: clean(label), linked });
  };

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const c0 = String(row[0] ?? "").trim();
    const label = String(row[descCol] ?? "").trim();

    // Stop at the signature / observations footer block.
    if (FOOTER_RE.test(c0) || FOOTER_LABEL_RE.test(label) || /^for (contractor|consultant|client)/i.test(c0)) break;

    // Section header: a single-letter marker in col0 with the section title in
    // the next non-empty cell (e.g. "A" | "Pre-Work Checks"), or a labelled row
    // with no S.No that introduces a group.
    if (SECTION_RE.test(c0)) {
      const title = String(row.slice(1).find((c) => String(c).trim())) || c0;
      current = { name: clean(title) || c0, items: [] };
      sections.push(current);
      continue;
    }
    if (!label) continue;
    pushItem(label);
  }

  // Drop empty sections; if nothing parsed, signal for special handling.
  return sections.filter((s) => s.items.length > 0);
}

function main() {
  const wb = XLSX.readFile(WORKBOOK);
  const discMap = buildDisciplineMap(wb);
  const templates = [];
  const issues = [];

  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.has(name)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: "" });
    const categories = parseSheet(rows, name);
    const itemCount = categories.reduce((n, c) => n + c.items.length, 0);
    if (itemCount === 0) {
      issues.push(name);
      continue;
    }
    templates.push({
      id: "qct_" + norm(name).slice(0, 40) + "_" + templates.length,
      name: name.trim(),
      discipline: disciplineFor(name, discMap),
      categories,
    });
  }

  fs.writeFileSync(OUT, JSON.stringify(templates, null, 2));
  console.log(`Wrote ${templates.length} templates (` +
    `${templates.reduce((n, t) => n + t.categories.reduce((m, c) => m + c.items.length, 0), 0)} items) to ${path.basename(OUT)}`);
  const byDisc = templates.reduce((a, t) => ((a[t.discipline] = (a[t.discipline] || 0) + 1), a), {});
  console.log("By discipline:", byDisc);
  if (issues.length) console.log("Needs review (0 items):", issues);
}

main();
