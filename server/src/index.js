import express from "express";
import multer from "multer";
import fs from "node:fs";
import puppeteer from "puppeteer";
import { getSheetNames, parseQuoteFromWorkbookBuffer } from "./excel/parseQuote.js";
import { closePdfRenderer, renderQuotePdfBuffer, warmPdfRenderer } from "./pdf/renderPdf.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));

// Dev-friendly CORS (adjust if you deploy under a single domain)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Debug endpoint to verify Puppeteer/Chrome setup in production.
app.get("/api/diag", (req, res) => {
  const executablePath = (() => {
    try {
      return puppeteer.executablePath();
    } catch {
      return null;
    }
  })();

  const exists = executablePath ? fs.existsSync(executablePath) : false;

  res.json({
    ok: true,
    node: process.version,
    puppeteer: puppeteer.version,
    executablePath,
    executableExists: exists,
    env: {
      PUPPETEER_CACHE_DIR: process.env.PUPPETEER_CACHE_DIR ?? null,
      PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH ?? null,
      HOST: process.env.HOST ?? null,
      PORT: process.env.PORT ?? null,
    },
  });
});

// Upload Excel -> get sheet names (for sheet selector UI)
app.post("/api/sheets", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing Excel file (form-data key: file)" });

    const sheets = getSheetNames(file.buffer);
    res.json({ sheets });
  } catch (err) {
    res.status(400).json({ error: err?.message ?? "Failed to read Excel" });
  }
});

// Upload Excel -> parse -> quote JSON
app.post("/api/parse", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing Excel file (form-data key: file)" });

    const sheetName = typeof req.body?.sheetName === "string" && req.body.sheetName.trim() ? req.body.sheetName.trim() : undefined;
    const projectName = typeof req.body?.projectName === "string" ? req.body.projectName.trim() : "";
    const sourceLabel = typeof req.body?.sourceLabel === "string" ? req.body.sourceLabel.trim() : "";

    const quote = parseQuoteFromWorkbookBuffer(file.buffer, { sheetName, projectName, sourceLabel });
    res.json({ quote });
  } catch (err) {
    res.status(400).json({ error: err?.message ?? "Failed to parse Excel" });
  }
});

// Quote JSON -> PDF
app.post("/api/pdf", async (req, res) => {
  try {
    const { quote, brand } = req.body ?? {};
    if (!quote) return res.status(400).json({ error: "Missing quote in request body" });

    const t0 = Date.now();
    const pdf = await renderQuotePdfBuffer(quote, brand);
    res.setHeader("Server-Timing", "pdf;dur=" + (Date.now() - t0));
    const filename = "Quotation-" + (quote.clientName || "Client").replace(/[\s\/\\]+/g, "-") + ".pdf";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.send(Buffer.from(pdf));
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "Failed to generate PDF" });
  }
});

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log("HSI quote server running on http://" + host + ":" + port);
});

// Warm Chromium on boot to reduce first PDF latency.
warmPdfRenderer().catch(() => {});

// Graceful shutdown on Render
process.on("SIGTERM", () => {
  closePdfRenderer().finally(() => process.exit(0));
});
