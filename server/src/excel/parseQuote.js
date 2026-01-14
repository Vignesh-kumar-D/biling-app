import * as XLSX from "xlsx";
import { z } from "zod";

const QuoteItemSchema = z.object({
  sno: z.union([z.string(), z.number()]).optional(),
  room: z.string().optional(),
  item: z.string().optional(),
  widthMm: z.union([z.string(), z.number()]).optional(),
  heightMm: z.union([z.string(), z.number()]).optional(),
  depthMm: z.union([z.string(), z.number()]).optional(),
  qty: z.union([z.string(), z.number()]).optional(),
  areaSqft: z.union([z.string(), z.number()]).optional(),
  ratePerSqft: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  notes: z.array(z.string()).optional(),
});

const QuoteSchema = z.object({
  sourceLabel: z.string().optional(),
  sheetName: z.string().optional(),
  projectName: z.string().optional(),
  clientName: z.string().optional(),
  items: z.array(QuoteItemSchema),
  totalAmount: z.number().optional(),
});

function normalizeCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  return v;
}

function normHeader(v) {
  return String(v ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

function isLikelyHeaderRow(row) {
  const joined = row.map((c) => normHeader(normalizeCell(c))).join(" | ");
  return (
    joined.includes("S.NO") &&
    joined.includes("ROOM") &&
    joined.includes("ITEM") &&
    joined.includes("AMOUNT")
  );
}

function parseNumberLoose(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const s = v.replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isTotalRow(row) {
  const first = normalizeCell(row[0]);
  return String(first).toUpperCase() === "TOTAL";
}

function findColIndex(headers, predicate) {
  for (let i = 0; i < headers.length; i++) {
    if (predicate(headers[i], i)) return i;
  }
  return -1;
}

function buildColumnMap(headerRow) {
  const headers = headerRow.map(normHeader);

  const col = {
    sno: findColIndex(headers, (h) => h.includes("S.NO") || h === "SL." || h === "SL"),
    room: findColIndex(headers, (h) => h === "ROOM" || h.includes("ROOM")),
    item: findColIndex(headers, (h) => h === "ITEM" || h.includes("ITEM")),
    finish: findColIndex(headers, (h) => h.includes("FINISH")),
    width: findColIndex(headers, (h) => h.includes("WIDTH")),
    height: findColIndex(headers, (h) => h.includes("HEIGHT") || h.includes("HEIGTH")),
    depth: findColIndex(headers, (h) => h.includes("DEPTH")),
    qty: findColIndex(headers, (h) => h === "QTY" || h.includes("QUANTITY") || h.includes("QTY")),
    area: findColIndex(headers, (h) => h.includes("AREA")),
    rate: findColIndex(headers, (h) => h.includes("RATE") && !h.includes("OLD")),
    amount: findColIndex(headers, (h) => h.includes("AMOUNT") && !h.includes("OLD")),
    oldAmount: findColIndex(headers, (h) => h.includes("AMOUNT") && h.includes("OLD")),
  };

  const hasDepth = col.depth !== -1;
  const hasFinish = col.finish !== -1;

  // If both exist, prefer DEPTH-style (07-01 sheet).
  const layout = hasDepth ? "A_DEPTH" : hasFinish ? "B_FINISH" : "UNKNOWN";

  // Best-effort fallbacks for amount/rate if not found
  if (col.amount === -1 && col.oldAmount !== -1) col.amount = col.oldAmount;
  if (col.rate === -1) col.rate = findColIndex(headers, (h) => h.includes("RATE"));

  return { headers, col, layout };
}

function sheetScore(headerRow) {
  const { col, layout } = buildColumnMap(headerRow);
  let score = 0;
  if (col.sno !== -1) score += 3;
  if (col.room !== -1) score += 2;
  if (col.item !== -1) score += 4;
  if (col.amount !== -1) score += 4;
  if (col.rate !== -1) score += 2;
  if (col.area !== -1) score += 2;
  if (col.qty !== -1) score += 1;
  if (layout === "A_DEPTH") score += 4; // prefer 07-01 style
  return score;
}

/**
 * Parses the "07-01" style sheet (Sheet3 in your file):
 * Columns: S.NO, ROOM, ITEM, WIDTH(mm), HEIGHT(mm), DEPTH(mm), QUANTITY, AREA(sqft), RATE/sqft, AMOUNT
 * Follow-up rows without S.NO are treated as notes for previous item.
 */
export function parseQuoteFromWorkbookBuffer(buffer, opts = {}) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: true });

  const sheetNames = workbook.SheetNames ?? [];
  const preferred = opts.sheetName
    ? [opts.sheetName, ...sheetNames.filter((n) => n !== opts.sheetName)]
    : sheetNames;

  // Find best matching sheet by scoring its header row.
  let best = null; // { name, rows, headerIdx, score, map }
  for (const name of preferred) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const headerIdx = rows.findIndex(isLikelyHeaderRow);
    if (headerIdx === -1) continue;
    const score = sheetScore(rows[headerIdx]);
    if (!best || score > best.score) {
      best = { name, rows, headerIdx, score, map: buildColumnMap(rows[headerIdx]) };
    }
  }

  if (!best) throw new Error("Could not find a quotation table in this Excel (missing expected headers).");

  const { name: chosenSheetName, rows, headerIdx, map } = best;
  const { col, layout } = map;

  const items = [];
  let currentItem = null;
  let totalAmount = undefined;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r].map(normalizeCell);
    if (!row.some((c) => c !== "")) continue;

    const snoCell = col.sno !== -1 ? row[col.sno] : row[0];
    if (String(snoCell).toUpperCase() === "TOTAL") {
      const amtCell = col.amount !== -1 ? row[col.amount] : row[9];
      const fallbackAmtCell = row[col.amount + 1] ?? row[10];
      const amt = parseNumberLoose(String(amtCell ?? "")) ?? parseNumberLoose(String(fallbackAmtCell ?? ""));
      if (typeof amt === "number") totalAmount = amt;
      break;
    }

    const itemCell = col.item !== -1 ? row[col.item] : row[2];
    const roomCell = col.room !== -1 ? row[col.room] : row[1];
    const amountCell = col.amount !== -1 ? row[col.amount] : row[9];
    const hasNewItem =
      String(snoCell ?? "").trim() !== "" &&
      String(itemCell ?? "").trim() !== "" &&
      String(snoCell).toUpperCase() !== "TOTAL";

    if (hasNewItem) {
      const widthMm = col.width !== -1 ? row[col.width] : "";
      const heightMm = col.height !== -1 ? row[col.height] : "";
      const depthMm = col.depth !== -1 ? row[col.depth] : "";
      const qty = col.qty !== -1 ? row[col.qty] : "";
      const areaSqft = col.area !== -1 ? row[col.area] : "";
      const ratePerSqft = col.rate !== -1 ? row[col.rate] : "";

      const amountNum = parseNumberLoose(String(amountCell));
      const amount = typeof amountNum === "number" ? amountNum : amountCell;

      const notes = [];
      if (layout === "B_FINISH" && col.finish !== -1) {
        const finishText = String(row[col.finish] ?? "").trim();
        if (finishText) {
          finishText
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((s) => notes.push(s));
        }
      }

      currentItem = {
        sno: snoCell,
        room: roomCell,
        item: itemCell,
        widthMm,
        heightMm,
        depthMm: layout === "A_DEPTH" ? depthMm : "",
        qty,
        areaSqft,
        ratePerSqft,
        amount,
        notes,
      };
      items.push(currentItem);
      continue;
    }

    // Continuation lines (07-01 style): treat as notes for previous item.
    const candidate = row.find((c) => String(c ?? "").trim() !== "") ?? "";
    if (candidate && currentItem) {
      currentItem.notes = currentItem.notes ?? [];
      currentItem.notes.push(String(candidate).trim());
    }
  }

  const quote = {
    sourceLabel: opts.sourceLabel ?? chosenSheetName,
    sheetName: chosenSheetName,
    projectName: opts.projectName ?? "",
    clientName: opts.clientName ?? "",
    items,
    totalAmount,
  };

  return QuoteSchema.parse(quote);
}

