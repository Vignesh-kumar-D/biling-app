export function renderQuoteHTML(quote, opts = {}) {
  const brand = {
    name: opts.companyName ?? "Home Square Interiors",
    // HSI teal accent (on-brand). You can still override from the UI/server.
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
  const dueDateStr = quote.dueDate ?? "";
  const billToLines = Array.isArray(quote.clientAddressLines)
    ? quote.clientAddressLines.filter(Boolean)
    : (quote.clientAddress ? String(quote.clientAddress).split(/\n+/) : []);

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

  const paymentInfoLines = Array.isArray(quote.paymentInfoLines)
    ? quote.paymentInfoLines.filter(Boolean)
    : (quote.paymentInfo ? String(quote.paymentInfo).split(/\n+/) : []);

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
        --accent-rgb: 15, 118, 110; /* used for translucent accents */
        --ink: #0b1220;
        --muted: #5b6475;
        --line: rgba(15, 23, 42, 0.12);
        --paper: #ffffff;
        --soft: #f3f4f6;
        --soft2: #eef2ff;
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

      /* Geometric blue corners (like reference). */
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

      .header {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10mm;
        align-items: start;
        position: relative;
        z-index: 2;
      }

      .brandBlock {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .brandLogo {
        width: 14mm;
        height: 14mm;
        border-radius: 4mm;
        background: linear-gradient(180deg, rgba(var(--accent-rgb),0.95), rgba(var(--accent-rgb),0.65));
        box-shadow: 0 10px 30px rgba(var(--accent-rgb),0.22);
      }
      .brandName {
        font-size: 18px;
        font-weight: 1000;
        letter-spacing: 0.2px;
      }
      .brandMeta {
        margin-top: 6px;
        color: var(--muted);
        font-size: 10px;
        line-height: 1.45;
      }

      .doc {
        text-align: right;
      }
      .docTitle {
        font-size: 22px;
        font-weight: 1100;
        letter-spacing: 2px;
        color: var(--accent);
      }
      .docMeta {
        margin-top: 6px;
        display: grid;
        grid-template-columns: 1fr auto;
        justify-content: end;
        gap: 6px 10px;
        font-size: 10px;
        color: var(--muted);
      }
      .docMeta .k { text-align: left; }
      .docMeta .v { text-align: right; color: var(--ink); font-weight: 800; }

      .billTo {
        margin-top: 10mm;
        display: grid;
        grid-template-columns: 1fr;
        gap: 2mm;
        position: relative;
        z-index: 2;
      }
      .label {
        font-size: 10px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 900;
      }
      .clientName {
        font-size: 13px;
        font-weight: 1000;
        color: var(--accent);
      }
      .addr {
        font-size: 10px;
        color: var(--muted);
        line-height: 1.45;
      }

      .tableWrap {
        margin-top: 10mm;
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

      .bottom {
        margin-top: 10mm;
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 12mm;
        align-items: end;
        position: relative;
        z-index: 2;
      }
      .payment, .terms {
        font-size: 10px;
        color: var(--muted);
        line-height: 1.5;
      }
      .payment strong, .terms strong { color: var(--ink); }
      .paymentLines { margin-top: 4px; }
      .paymentLines div { margin-top: 2px; }

      .totals {
        justify-self: end;
        width: 80mm;
        font-size: 10px;
        color: var(--muted);
      }
      .tRow {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
      }
      .tRow strong { color: var(--ink); }
      .tRow.total {
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px solid var(--line);
      }
      .tRow.total strong { font-size: 14px; }

      .sign {
        margin-top: 10mm;
        text-align: right;
        font-size: 10px;
        color: var(--muted);
      }
      .signLine {
        height: 1px;
        background: var(--line);
        width: 55mm;
        margin: 10mm 0 2mm auto;
      }

      .thanks {
        margin-top: 10mm;
        font-size: 18px;
        font-weight: 1000;
        color: var(--accent);
        letter-spacing: 0.2px;
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

      <div class="header">
        <div>
          <div class="brandBlock">
            <div class="brandLogo"></div>
            <div class="brandName">${safe(brand.name)}</div>
          </div>
          <div class="brandMeta">
            ${brand.address ? `${safe(brand.address)}<br/>` : ""}
            ${brand.phone ? `Phone: ${safe(brand.phone)}<br/>` : ""}
            ${brand.email ? `Email: ${safe(brand.email)}` : ""}
          </div>
        </div>
        <div class="doc">
          <div class="docTitle">QUOTATION</div>
          <div class="docMeta">
            <div class="k">Quotation Number</div><div class="v">${safe(refNo)}</div>
            <div class="k">Invoice Date</div><div class="v">${safe(dateStr)}</div>
            ${dueDateStr ? `<div class="k">Due Date</div><div class="v">${safe(dueDateStr)}</div>` : ""}
          </div>
        </div>
      </div>

      <div class="billTo">
        <div class="label">Quote to</div>
        <div class="clientName">${safe(quote.clientName ?? "—")}</div>
        <div class="addr">
          ${billToLines.length ? billToLines.map((l) => `${safe(l)}<br/>`).join("") : ""}
        </div>
      </div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th class="c-sl">SL</th>
              <th class="c-qty">QUANTITY</th>
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

      <div class="bottom">
        <div>
          <div class="payment">
            <div class="label">Payment Method</div>
            <div class="paymentLines">
              ${
                paymentInfoLines.length
                  ? paymentInfoLines.map((l) => `<div>${safe(l)}</div>`).join("")
                  : `<div><strong>Account Name:</strong> ${safe(brand.name)}</div>
                     <div><strong>UPI:</strong> ${safe(quote.upiId ?? "")}</div>
                     <div><strong>Email:</strong> ${safe(brand.email)}</div>`
              }
            </div>
          </div>

          <div class="terms" style="margin-top: 8mm;">
            <div class="label">Terms & Conditions</div>
            <div style="margin-top: 4px;">${safe(termsText)}</div>
          </div>

          <div class="thanks">Thank for your business with us!</div>
        </div>

        <div>
          <div class="totals">
            <div class="tRow"><span>SUBTOTAL :</span><strong>₹ ${money(typeof total === "number" ? total : 0)}</strong></div>
            <div class="tRow"><span>TAX :</span><strong>${safe(quote.taxLabel ?? "0.00%")}</strong></div>
            <div class="tRow total"><span>TOTAL :</span><strong>₹ ${money(typeof total === "number" ? total : 0)}</strong></div>
          </div>
          <div class="sign">
            <div class="signLine"></div>
            <div>Authorised Sign</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

