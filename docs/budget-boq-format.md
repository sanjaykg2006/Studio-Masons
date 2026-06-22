# Budget BOQ — Standard Format for Import

This is the format the ERP's Budget BOQ importer expects. If a workbook follows it,
every package and line is read correctly and the per-sheet total reconciliation
passes. It is written for whoever prepares the BOQ workbook (Senior QS) and reflects
exactly what the parser does — see `app/(erp)/purchase-orders/budgetBoqParser.ts`.

> The import has a **review step**: every sheet is listed with its detected columns,
> line count, and a "Total vs sheet" check before anything is saved. This format
> makes that review come up clean. The review is your safety net — always glance at
> it, but a compliant workbook needs no manual fixing.

---

## 1. Workbook = packages

- **One worksheet per package.** The **sheet name becomes the package name** (e.g.
  `Internal Electrical Works`, `Sanitary Fixtures & CP Fittings`). Name sheets the
  way you want the packages labelled.
- **Don't hide sheets you want imported.** Hidden / very-hidden worksheets are
  **skipped automatically** (they appear in the review, pre-unticked). Working copies
  you don't want imported *should* be hidden.
- **Reserved names are skipped.** A sheet whose name contains any of `summary`,
  `cost summary`, `cost-summary`, `m sheet`, or `measurement` is treated as a
  non-line-item sheet and skipped. **Never give a real package sheet one of these
  names.**
- A sheet with no recognizable header row, or no priced rows, is skipped.

---

## 2. The header row

Each package sheet needs **one header row**. The parser finds it automatically (it
may sit below title/logo rows). A row qualifies as the header when it has a
**Description** column **plus at least one of** Quantity, Rate, or Amount.

Use these column headers (matching is case-insensitive and substring-based):

| Column | Accepted header text | Notes |
|---|---|---|
| **Description** (required) | `Description`, `Description of Work`, `Particulars`, `Nomenclature`, `Scope` | Must be present. Do **not** rely on the serial column — headers like `Item No`, `Sl No`, `S.No`, `S.L` are treated as **serial numbers, not descriptions**. Always include a clear `Description` header. |
| **Unit** | `Unit`, `UOM`, `U.O.M` | Optional but recommended. |
| **Quantity** | `Qty`, `Quantity`, `Nos`, `Total Qty` | Header should contain the word **"Qty"**. A bare `Total` is accepted as quantity **only** if it has no "amount/value" in it — prefer an explicit `Qty`/`Total Qty`. |
| **Rate** | `Rate`, `Unit Price` | Use plain `Rate`. Avoid having **`Basic Rate`** as the only rate column — the parser de-prioritizes "basic"; keep the chargeable rate column headed simply `Rate`. |
| **Amount** | `Amount`, `Total Amount` | The line value. |

### Supply + Installation (split rate / amount)

If a package prices **supply** and **installation** separately, use **either** layout:

**A — inline (single header row), preferred:**

```
Sl No | Description | Unit | Total Qty | Supply Rate | Installation Rate | Total Amount
```

**B — two-row header:** a `Rate` and/or `Amount` header on the first row, with
`Supply | Installation` directly beneath them on the next row:

```
Row 1:  Sl No | Description | Unit | Total Qty | Rate            |              | Amount          |
Row 2:                                          | Supply | Installation       | Supply | Installation
```

Rules for split columns:
- The parser reads **both** supply and installation. The stored **Rate = Supply +
  Installation** (per unit) and the line **Amount clubs both** (supply amount +
  installation amount).
- Put the two amount sub-columns **under** the `Amount`/`Total Amount` header, and the
  two rate sub-columns **under** the `Rate` header (position matters in layout B).
- The misspelling `Suply` is tolerated, but spell it `Supply`.

---

## 3. Data rows

- A **priced line** = a row with a Description **and** at least one of Qty / Rate /
  Amount. These become budget lines.
- **Section headings and spec paragraphs** (a description but no numbers) are
  skipped automatically — you can keep them for readability.
- A row whose description is **only a number** is skipped (stray serial).
- Keep one item per row. The item's quantity is the **budgeted quantity** that gates
  purchase intents downstream, so make sure quantities are real (a `0` quantity means
  "budgeted nil" — any intent for it will flag the Project Director).

---

## 4. Total / subtotal rows

- **Always label total rows with a leading total word** — `Total`, `Sub Total`,
  `Grand Total`, `Total Amount Section-4 (…)`, `Carried to Summary`. Any row whose
  **description begins with** a total label is excluded from the line items
  (regardless of length), so it is never counted as a budget line.
- **Put the total value in the same Amount column** as the line items.
- **Tax rows** — label them `GST`, `IGST`, `CGST`, `SGST`, or `Round Off`, or include
  `GST`/`Incl` in the label. They are excluded from both the lines and the
  reconciliation (line items are ex-GST).
- ⚠️ **Do not leave a total row's description blank.** A blank-label subtotal (value
  only in the amount column) is skipped as a line — which is fine — but it **cannot be
  used for the total reconciliation**, so that sheet shows "unchecked". To get the
  green ✓, give the grand total a real label like **`Grand Total`**.

---

## 5. Per-sheet reconciliation (the ✓ / ⚠ in the review)

The importer cross-checks each sheet's **parsed line sum** against the sheet's **own
stated total**:

- If the sheet has a **`Grand Total`** row → that is the target.
- Otherwise → the **sum of the sheet's `Sub Total` / section-total rows**.
- A match (within 0.5%) shows **✓**; a mismatch shows **⚠ parsed ≠ sheet** with both
  figures; no total row shows **—** (unchecked).

To make a sheet reconcile, include a clearly labelled grand total (or a set of
section subtotals that add up to it). This is what would catch a future
double-count or a dropped column.

---

## 6. Numbers & formatting

- Currency symbols and thousands separators are tolerated (`Rs. 1,250.00` → `1250`).
- Amounts/rates are stored to 2 decimals; quantities to 2 decimals.
- Blank cells read as `0`.

---

## 7. Recommended canonical template

A clean, single-header-row package sheet that always imports correctly:

```
| Sl No | Description        | Unit | Qty | Supply Rate | Installation Rate | Total Amount |
|-------|--------------------|------|-----|-------------|-------------------|--------------|
| 1     | <section heading>  |      |     |             |                   |              |
| 1.1   | <item>             | Nos  | 10  | 3150        | 660               | 38100        |
| 1.2   | <item>             | Sqm  | 25  | 484         | 0                 | 12100        |
|       | Grand Total        |      |     |             |                   | 50200        |
```

For supply-only / single-rate packages (civil, furniture), drop the split columns:

```
| Sl No | Description | Unit | Qty | Rate | Amount |
|-------|-------------|------|-----|------|--------|
| 1.1   | <item>      | Sqm  | 87  | 650  | 56550  |
|       | Grand Total |      |     |      | 56550  |
```

---

## 8. Quick checklist

- [ ] One sheet per package; sheet name = package name.
- [ ] No sheet you want imported is **hidden**.
- [ ] No package sheet named with `summary` / `cost summary` / `m sheet` / `measurement`.
- [ ] A clear **`Description`** header (not just `Item No` / `Sl No`).
- [ ] A **`Qty`** header, a **`Rate`** (or `Supply Rate` + `Installation Rate`) header,
      and an **`Amount`** (or `Total Amount (Supply)` + `(Installation)`) header.
- [ ] Split supply/installation laid out inline, or with `Supply | Installation`
      directly under the `Rate` / `Amount` headers.
- [ ] Every total row's description **starts with** `Total` / `Grand Total` /
      `Sub Total`; tax rows labelled `GST` etc.
- [ ] A labelled **`Grand Total`** per sheet so the reconciliation shows ✓.
- [ ] Open the **review step** on import and confirm each package reads ✓.
