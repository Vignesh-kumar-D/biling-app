import "./style.css";
import { renderQuoteHTML } from "../../shared/quoteTemplate.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

const state = {
  file: null,
  sheets: [],
  selectedSheet: "",
  quote: null,
  isParsing: false,
  isGenerating: false,
  error: "",
  brand: {
    companyName: "Home Square Interiors",
    accent: "#0f766e",
    phone: "",
    email: "",
    address: "",
  },
};

function $(sel) {
  return document.querySelector(sel);
}

function setStatus(msg, kind = "info") {
  const el = $("#status");
  el.textContent = msg || "";
  el.dataset.kind = kind;
}

function setError(msg) {
  state.error = msg || "";
  const el = $("#error");
  el.textContent = state.error;
  el.classList.toggle("show", Boolean(state.error));
}

function render() {
  $("#clientName").value = state.quote?.clientName ?? "";
  $("#projectName").value = state.quote?.projectName ?? "";

  $("#btnPdf").disabled = !state.quote || state.isGenerating;

  $("#fileName").textContent = state.file ? state.file.name : "No file chosen";
  $("#fileBadge").textContent = state.quote?.sheetName ? `Using: ${state.quote.sheetName}` : (state.sheets.length ? `${state.sheets.length} sheet(s) found` : "Upload an Excel file to begin");

  $("#btnPdf").textContent = state.isGenerating ? "Generating…" : "Download PDF";

  // Sheet selector (custom dropdown)
  const sheetField = $("#sheetField");
  const selectValue = $("#selectValue");
  const selectOptions = $("#selectOptions");
  if (state.sheets.length > 0) {
    sheetField.classList.add("show");
    selectValue.textContent = state.selectedSheet || "Choose a sheet";
    selectOptions.innerHTML = state.sheets.map((s) => 
      `<div class="customSelect-option ${s === state.selectedSheet ? "selected" : ""}" data-value="${s}">${s}</div>`
    ).join("");
  } else {
    sheetField.classList.remove("show");
    selectValue.textContent = "Choose a sheet";
    selectOptions.innerHTML = "";
  }

  const iframe = $("#previewFrame");
  if (state.quote) {
    const html = renderQuoteHTML(state.quote, state.brand);
    iframe.srcdoc = html;
    $("#previewEmpty").classList.remove("show");
    $("#previewWrap").classList.add("show");
  } else {
    iframe.srcdoc = "";
    $("#previewWrap").classList.remove("show");
    $("#previewEmpty").classList.add("show");
  }
}

async function fetchSheets() {
  if (!state.file) return;
  setError("");
  setStatus("Reading sheets from Excel…", "info");

  try {
    const form = new FormData();
    form.append("file", state.file);
    const res = await fetch(`${API_BASE}/api/sheets`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to read Excel");

    state.sheets = data.sheets ?? [];
    state.selectedSheet = state.sheets[0] ?? "";
    setStatus("Select a sheet and it will be parsed automatically.", "info");
    render();

    // Auto-parse the first sheet
    if (state.selectedSheet) {
      await parseExcel();
    }
  } catch (e) {
    state.sheets = [];
    state.selectedSheet = "";
    setError(e?.message || "Failed to read sheets");
    setStatus("Fix the issue and try again.", "error");
    render();
  }
}

async function parseExcel() {
  if (!state.file || !state.selectedSheet) return;
  state.isParsing = true;
  setError("");
  setStatus(`Parsing sheet "${state.selectedSheet}"…`, "info");
  render();

  try {
    const form = new FormData();
    form.append("file", state.file);
    form.append("sheetName", state.selectedSheet);
    form.append("projectName", $("#projectName").value || "");
    const res = await fetch(`${API_BASE}/api/parse`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to parse Excel");

    state.quote = data.quote;
    // keep current client name input if present
    state.quote.clientName = $("#clientName").value || state.quote.clientName || "";

    setStatus("Parsed. Review the preview and download your PDF.", "ok");
  } catch (e) {
    state.quote = null;
    setError(e?.message || "Parse failed");
    setStatus("Fix the issue and try again.", "error");
  } finally {
    state.isParsing = false;
    render();
  }
}

async function downloadPdf() {
  if (!state.quote) return;
  state.isGenerating = true;
  setError("");
  setStatus("Generating premium PDF…", "info");
  render();

  try {
    const q = { ...state.quote, clientName: $("#clientName").value || "" , projectName: $("#projectName").value || "" };
    state.quote = q;

    const res = await fetch(`${API_BASE}/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote: q, brand: state.brand }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "PDF generation failed");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Quotation-${(q.clientName || "Client").replaceAll(/[\\s\\/\\\\]+/g, "-")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Downloaded. You're done.", "ok");
  } catch (e) {
    setError(e?.message || "PDF generation failed");
    setStatus("Fix the issue and try again.", "error");
  } finally {
    state.isGenerating = false;
    render();
  }
}

function init() {
  $("#app").innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brandMark"></div>
          <div>
            <div class="brandTitle">Home Square Interiors</div>
            <div class="brandSub">Excel → premium quotation PDF</div>
          </div>
        </div>
        <div class="status" id="status" data-kind="info">Upload an Excel file to begin</div>
      </header>

      <main class="grid">
        <section class="card lift">
          <div class="cardTitle">Input</div>
          <div class="cardHint">Upload your quotation Excel and enter client details.</div>

          <div class="field">
            <label>Excel file</label>
            <div class="fileRow">
              <label for="file" class="fileBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Choose File
              </label>
              <input id="file" type="file" accept=".xlsx,.xls" style="display: none;" />
              <div class="fileMeta">
                <div class="fileName" id="fileName">No file chosen</div>
                <div class="fileBadge" id="fileBadge">Upload an Excel file to begin</div>
              </div>
            </div>
          </div>

          <div class="field" id="sheetField">
            <label>Select Sheet</label>
            <div class="customSelect" id="customSelect">
              <div class="customSelect-trigger" id="selectTrigger">
                <span id="selectValue">Choose a sheet</span>
                <svg class="customSelect-arrow" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 11L3 6h10l-5 5z"/>
                </svg>
              </div>
              <div class="customSelect-options" id="selectOptions"></div>
            </div>
          </div>

          <div class="fieldRow">
            <div class="field">
              <label>Client name</label>
              <input id="clientName" type="text" placeholder="e.g., Mr. Hrushikesh" />
            </div>
            <div class="field">
              <label>Project (optional)</label>
              <input id="projectName" type="text" placeholder="e.g., Study + Wardrobe (Yemmalur)" />
            </div>
          </div>

          <div class="actions">
            <button class="btn" id="btnPdf">Download PDF</button>
          </div>

          <div class="error" id="error"></div>

          <div class="tip">
            <div class="dot"></div>
            <div>
              Best results: use Chrome, and keep the Excel sheet headers aligned with your current format.
            </div>
          </div>
        </section>

        <section class="card preview lift">
          <div class="cardTitle">Preview</div>
          <div class="cardHint">This is exactly what will be printed to the PDF.</div>

          <div class="previewEmpty show" id="previewEmpty">
            <div class="ghost"></div>
            <div class="previewText">Upload an Excel file to see the premium preview here.</div>
          </div>

          <div class="previewWrap" id="previewWrap">
            <iframe id="previewFrame" title="Quotation preview"></iframe>
          </div>
        </section>
      </main>

      <footer class="footer">
        <div>© ${new Date().getFullYear()} Home Square Interiors</div>
        <div class="muted">Local server PDF renderer for consistent output</div>
      </footer>
    </div>
  `;

  $("#file").addEventListener("change", (e) => {
    const f = e.target.files?.[0] ?? null;
    // Reset input so re-selecting the same file triggers change again
    e.target.value = "";
    state.file = f;
    state.sheets = [];
    state.selectedSheet = "";
    state.quote = null;
    setError("");
    render();
    if (f) fetchSheets();
  });

  // Custom dropdown toggle
  const customSelect = $("#customSelect");
  const selectTrigger = $("#selectTrigger");
  
  selectTrigger.addEventListener("click", () => {
    customSelect.classList.toggle("open");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!customSelect.contains(e.target)) {
      customSelect.classList.remove("open");
    }
  });

  // Handle option selection
  $("#selectOptions").addEventListener("click", (e) => {
    const option = e.target.closest(".customSelect-option");
    if (!option) return;
    
    const value = option.dataset.value;
    state.selectedSheet = value;
    state.quote = null;
    customSelect.classList.remove("open");
    render();
    if (state.selectedSheet) parseExcel();
  });

  $("#clientName").addEventListener("input", () => {
    if (!state.quote) return;
    state.quote.clientName = $("#clientName").value || "";
    render();
  });

  $("#projectName").addEventListener("input", () => {
    if (!state.quote) return;
    state.quote.projectName = $("#projectName").value || "";
    render();
  });

  $("#btnPdf").addEventListener("click", downloadPdf);

  render();
}

init();
