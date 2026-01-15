import express from "express";
import multer from "multer";
import fs from "node:fs";
import puppeteer from "puppeteer";
import { parseQuoteFromWorkbookBuffer } from "./excel/parseQuote.js";
import { renderQuotePdfBuffer } from "./pdf/renderPdf.js";

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

    const pdf = await renderQuotePdfBuffer(quote, brand);
    const filename = `Quotation-${(quote.clientName || "Client").replaceAll(/[\\s\\/\\\\]+/g, "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdf));
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "Failed to generate PDF" });
  }
});

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`HSI quote server running on http://${host}:${port}`);
});

