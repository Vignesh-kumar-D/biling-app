import puppeteer from "puppeteer";
import { renderQuoteHTML } from "../../../shared/quoteTemplate.js";
import fs from "node:fs";
import path from "node:path";

export async function renderQuotePdfBuffer(quote, opts = {}) {
  const html = renderQuoteHTML(quote, opts);

  // Keep Chromium profile/cache inside the project to avoid OS/sandbox permission issues.
  const userDataDir = path.resolve(process.cwd(), ".puppeteer-profile");
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
  } catch {
    // ignore
  }

  const browser = await puppeteer.launch({
    headless: "new",
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=medium",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-crash-reporter",
      "--disable-crashpad",
    ],
    env: {
      ...process.env,
      HOME: userDataDir,
    },
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: ["domcontentloaded", "networkidle0"] });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

