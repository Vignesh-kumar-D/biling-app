import puppeteer from "puppeteer";
import { renderQuoteHTML } from "../../../shared/quoteTemplate.js";
import fs from "node:fs";
import path from "node:path";

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const userDataDir = path.resolve(process.cwd(), ".puppeteer-profile");
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
    } catch {
      // ignore
    }

    browserPromise = puppeteer.launch({
      headless: "new",
      userDataDir,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=medium",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-crash-reporter",
        "--disable-crashpad",
      ],
    });
  }

  return browserPromise;
}

export async function warmPdfRenderer() {
  await getBrowser();
}

export async function closePdfRenderer() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } finally {
    browserPromise = null;
  }
}

export async function renderQuotePdfBuffer(quote, opts = {}) {
  const html = renderQuoteHTML(quote, opts);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Slightly lower DPR for speed; bump to 2 if you need ultra-crisp output.
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1.5 });
    // Our template is self-contained (no external resources), so domcontentloaded is enough.
    await page.setContent(html, { waitUntil: ["domcontentloaded"] });
    await page.emulateMediaType("screen");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return pdf;
  } finally {
    await page.close().catch(() => {});
  }
}

