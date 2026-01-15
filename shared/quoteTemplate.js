export function renderQuoteHTML(quote, opts = {}) {
  const brand = {
    name: opts.companyName ?? "Home Square Interiors",
    accent: opts.accent ?? "#0f766e",
    phone: opts.phone ?? "",
    email: opts.email ?? "",
    address: opts.address ?? "",
  };

  const safe = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");

  const money = (n) => {
    if (typeof n !== "number" || Number.isNaN(n)) return "";
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  const items = quote.items ?? [];
  const total = quote.totalAmount ?? items.reduce((s, it) => s + (typeof it.amount === "number" ? it.amount : 0), 0);

  const today = new Date();
  const dateStr = quote.date ?? today.toISOString().slice(0, 10);
  const refNo = quote.quoteNumber ?? quote.invoiceNumber ?? quote.referenceNo ?? quote.sourceLabel ?? "";

  const formatItemDescription = (it) => {
    const bits = [];
    const room = String(it.room ?? "").trim();
    const itemName = String(it.item ?? "").trim();
    const dims =
      it.widthMm || it.heightMm || it.depthMm
        ? `${safe(it.widthMm ?? "—")} × ${safe(it.heightMm ?? "—")} × ${safe(it.depthMm ?? "—")} mm`
        : "";
    const area = it.areaSqft !== undefined && it.areaSqft !== "" ? `${safe(it.areaSqft)} sqft` : "";

    if (room) bits.push(`<span class="pill">${safe(room)}</span>`);
    if (itemName) bits.push(`<span class="descTitle">${safe(itemName)}</span>`);

    const sub = [dims, area].filter(Boolean).join(" • ");
    const notes =
      Array.isArray(it.notes) && it.notes.length
        ? it.notes
            .map((n) => String(n).trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];

    return `
      <div class="desc">
        <div class="descTop">${bits.join(" ")}</div>
        ${sub ? `<div class="descSub">${sub}</div>` : ""}
        ${
          notes.length
            ? `<ul class="descNotes">${notes.map((n) => `<li>${safe(n)}</li>`).join("")}</ul>`
            : ""
        }
      </div>
    `;
  };

  const rowsHtml = items
    .map((it, idx) => {
      const qty = it.qty ?? "";
      const rate = it.ratePerSqft ?? "";
      const amountCell = typeof it.amount === "number" ? `₹ ${money(it.amount)}` : safe(it.amount ?? "");

      return `
        <tr class="item-row">
          <td class="c-sl">${safe(it.sno ?? idx + 1)}</td>
          <td class="c-qty">${safe(qty)}</td>
          <td class="c-desc">${formatItemDescription(it)}</td>
          <td class="c-rate">${safe(rate)}</td>
          <td class="c-amt">${amountCell}</td>
        </tr>
      `;
    })
    .join("");

  const termsText =
    quote.terms ??
    "Please confirm the scope and finish details before execution. Final pricing will be confirmed after site verification. Taxes, if applicable, will be updated as per government rules.";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quotation</title>
    <style>
      :root {
        --accent: ${brand.accent};
        --accent-rgb: 15, 118, 110;
        --ink: #0b1220;
        --muted: #5b6475;
        --line: rgba(15, 23, 42, 0.12);
        --paper: #ffffff;
        --soft: #f3f4f6;
        --headerGrey: #e5e7eb;
      }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        color: var(--ink);
        background: var(--paper);
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 12mm 12mm 10mm;
        margin: 0 auto;
        position: relative;
        overflow: hidden;
      }

      /* Geometric teal corners */
      .decor-tl, .decor-br {
        position: absolute;
        width: 70mm;
        height: 70mm;
        background: transparent;
        pointer-events: none;
      }
      .decor-tl {
        left: -26mm;
        top: -26mm;
        background: var(--accent);
        transform: rotate(-18deg);
      }
      .decor-tl:after {
        content: "";
        position: absolute;
        inset: 14mm 8mm auto auto;
        width: 44mm;
        height: 44mm;
        background: rgba(255,255,255,0.18);
        transform: rotate(12deg);
      }
      .decor-br {
        right: -26mm;
        bottom: -26mm;
        background: var(--accent);
        transform: rotate(18deg);
      }
      .decor-br:after {
        content: "";
        position: absolute;
        inset: auto auto 12mm 10mm;
        width: 48mm;
        height: 48mm;
        background: rgba(255,255,255,0.16);
        transform: rotate(-14deg);
      }

      /* Header - centered company name */
      .header {
        text-align: center;
        padding-bottom: 6mm;
        border-bottom: 2px solid var(--accent);
        position: relative;
        z-index: 2;
      }
      .brandName {
        font-size: 26px;
        font-weight: 1000;
        letter-spacing: 1px;
        color: var(--accent);
      }

      /* Sub-header: client + ref/date */
      .subHeader {
        margin-top: 8mm;
        display: grid;
        grid-template-columns: 1fr ;
        gap: 10mm;
        position: relative;
        z-index: 2;
      }
      .clientBlock {}
      .label {
        font-size: 10px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 900;
      }
      .clientName {
        margin-top: 2mm;
        font-size: 14px;
        font-weight: 1000;
        color: var(--ink);
      }
      .refBlock {
        text-align: right;
      }
      .refMeta {
        margin-top: 2mm;
        font-size: 11px;
        color: var(--muted);
      }
      .refMeta span { color: var(--ink); font-weight: 800; }

      /* QUOTATION label above table */
      .quotationLabel {
        margin-top: 10mm;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: var(--accent);
        text-align: left;
        padding-bottom: 3mm;
        border-bottom: 1px solid var(--line);
        position: relative;
        z-index: 2;
      }
      .quotationLabel .forName {
        color: var(--ink);
        font-weight: 800;
      }

      .tableWrap {
        margin-top: 6mm;
        position: relative;
        z-index: 2;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10.5px;
      }
      thead th {
        background: var(--headerGrey);
        color: rgba(17,24,39,0.70);
        text-transform: uppercase;
        letter-spacing: 0.7px;
        font-size: 9.5px;
        padding: 8px 8px;
        border-bottom: 1px solid var(--line);
      }
      tbody td {
        padding: 8px 8px;
        border-bottom: 1px solid rgba(15,23,42,0.08);
        vertical-align: top;
      }
      tbody tr:last-child td { border-bottom: 0; }

      .c-sl { width: 10mm; text-align: center; color: var(--muted); }
      .c-qty { width: 16mm; text-align: center; font-weight: 800; }
      .c-desc { width: auto; }
      .c-rate { width: 22mm; text-align: right; color: var(--muted); }
      .c-amt { width: 28mm; text-align: right; font-weight: 1000; }

      .pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(var(--accent-rgb),0.20);
        background: rgba(var(--accent-rgb),0.06);
        color: rgba(var(--accent-rgb),0.95);
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.4px;
        margin-right: 8px;
      }
      .descTitle { font-weight: 900; color: var(--ink); }
      .descSub { margin-top: 4px; color: var(--muted); font-size: 9.5px; }
      ul.descNotes {
        margin: 5px 0 0;
        padding-left: 14px;
        color: var(--muted);
        line-height: 1.35;
      }

      /* Bottom section: totals on left, sign on right */
      .bottom {
        margin-top: 10mm;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12mm;
        align-items: start;
        position: relative;
        z-index: 2;
      }

      .totals {
        width: 80mm;
        font-size: 11px;
        color: var(--muted);
      }
      .tRow {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
      }
      .tRow strong { color: var(--ink); }
      .tRow.total {
        margin-top: 4px;
        padding-top: 6px;
        border-top: 2px solid var(--accent);
      }
      .tRow.total strong { font-size: 15px; color: var(--accent); }

      .sign {
        text-align: right;
        font-size: 10px;
        color: var(--muted);
      }
      .signLine {
        height: 1px;
        background: var(--line);
        width: 55mm;
        margin: 4mm 0 2mm auto;
      }

      /* Terms section - keep away from bottom-right corner */
      .termsSection {
        margin-top: 8mm;
        font-size: 10px;
        color: var(--muted);
        line-height: 1.5;
        position: relative;
        z-index: 2;
        max-width: 140mm;
      }

      /* Thank you */
      .thanks {
        margin-top: 8mm;
        margin-bottom: 20mm;
        text-align: center;
        font-size: 18px;
        font-weight: 1000;
        color: var(--accent);
        letter-spacing: 0.2px;
        position: relative;
        z-index: 2;
      }

      @page { size: A4; margin: 0; }
      @media print {
        body { background: #fff; }
        .page { margin: 0; width: auto; min-height: auto; }
        .tableWrap { break-inside: auto; }
        tr.item-row { break-inside: avoid; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="decor-tl"></div>
      <div class="decor-br"></div>

      <!-- Header: Company name centered -->
      <div class="header">
        <div class="brandName">${safe(brand.name)}</div>
      </div>

      <!-- Sub-header: Client name + Ref/Date -->
      <div class="subHeader">
        <div class="refBlock">
          <div class="refMeta">Ref: <span>${safe(refNo)}</span></div>
          <div class="refMeta">Date: <span>${safe(dateStr)}</span></div>
        </div>
      </div>

      <!-- QUOTATION label above table -->
      <div class="quotationLabel">Quotation${quote.clientName ? ` for <span class="quotationLabel">${safe(quote.clientName)}</span>` : ""}</div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th class="c-sl">SL</th>
              <th class="c-qty">QTY</th>
              <th class="c-desc">ITEM DESCRIPTION</th>
              <th class="c-rate">RATE</th>
              <th class="c-amt">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Bottom: Totals on left, Sign on right -->
      <div class="bottom">
        <div class="totals">
          <div class="tRow"><span>SUBTOTAL :</span><strong>₹ ${money(typeof total === "number" ? total : 0)}</strong></div>
          <div class="tRow"><span>TAX :</span><strong>${safe(quote.taxLabel ?? "0.00%")}</strong></div>
          <div class="tRow total"><span>TOTAL :</span><strong>₹ ${money(typeof total === "number" ? total : 0)}</strong></div>
        </div>
        <div class="sign">
        Aravind Srinivasan
          <div class="signLine"></div>
          <div>Production head Signature</div>
        </div>
      </div>

      <!-- Terms -->
      <div class="termsSection">
        <div class="label">Terms & Conditions</div>
        <div style="margin-top: 4px;">${safe(termsText)}</div>
      </div>

      <!-- Thank you -->
      <div class="thanks">Thank you for selecting  home square interiors!</div>
    </div>
  </body>
</html>`;
}
