import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import JSZip from "npm:jszip@3.10.1";
import { getDocument } from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Войдите в СнабПро.");
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new Error("Сессия недействительна.");
  return data.user;
}

function numberValue(value: string) {
  const cleaned = String(value || "").replace(/[^0-9,.-]/g, "").replace(/\s/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, ""))
    : cleaned.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
function detectCurrency(value: string) {
  if (/₽|руб|RUB/i.test(value)) return "RUB";
  if (/USD|\$/i.test(value)) return "USD";
  if (/EUR|€/i.test(value)) return "EUR";
  return null;
}
function parseLineItems(text: string) {
  const rows = text.split(/\r?\n/).map(line => line.split(/\s*\|\s*/).map(cell => cell.trim())).filter(row => row.some(Boolean));
  const items: any[] = [];
  // Currency is often printed once in the document header, not on every row.
  const documentCurrency = detectCurrency(text) || "RUB";
  const aliases: Record<string, string[]> = {
    description: ["наименование", "товар", "материал", "позиция", "номенклатура", "описание", "product", "item", "name"],
    specification: ["характеристика", "спецификация", "марка", "размер", "стандарт", "параметры", "grade", "specification"],
    quantity: ["количество", "кол-во", "кол.", "qty", "quantity"],
    unit: ["ед.", "ед изм", "единица", "единица измерения", "unit"],
    unit_price: ["цена", "цена за", "стоимость за", "price", "unit price"],
    total: ["сумма", "итого", "общая стоимость", "total", "amount"]
  };
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
  let header: Record<string, number> | null = null;
  for (let ri = 0; ri < Math.min(rows.length, 80); ri++) {
    const cells = rows[ri].map(norm);
    const found: Record<string, number> = {};
    for (const [key, names] of Object.entries(aliases)) {
      const idx = cells.findIndex(cell => names.some(name => cell === norm(name) || cell.includes(norm(name))));
      if (idx >= 0) found[key] = idx;
    }
    if (found.description !== undefined && (found.quantity !== undefined || found.unit_price !== undefined || found.total !== undefined)) {
      header = found;
      for (let j = ri + 1; j < rows.length && items.length < 150; j++) {
        const row = rows[j];
        const get = (key: string) => header![key] === undefined ? "" : (row[header![key]] || "");
        const description = get("description");
        if (!description || /^(итого|всего|ндс|сумма к оплате|подпись)/i.test(description)) continue;
        const quantity = numberValue(get("quantity"));
        const unitPrice = numberValue(get("unit_price"));
        const total = numberValue(get("total"));
        const spec = get("specification");
        const unit = get("unit");
        if (quantity === null && unitPrice === null && total === null) continue;
        items.push({
          description: description.slice(0, 500),
          specification: spec ? { text: spec.slice(0, 500) } : {},
          quantity, unit: unit.slice(0, 40) || null,
          unit_price: unitPrice, total,
          currency: detectCurrency(row.join(" ")) || documentCurrency,
          confidence: 0.75, source_excerpt: row.join(" | ").slice(0, 1000)
        });
      }
      break;
    }
  }
  if (items.length) return items;

  // Some PDFs flatten the whole table into one text line instead of preserving
  // cell separators. Recover common numbered quote rows from that representation.
  // Begin at the detected item-table header so validity dates and other numbered
  // metadata earlier in a flattened PDF cannot be misread as a product row.
  const tableHeader = text.match(/(?:наименование|номенклатура|описание|товар)[\\s\\S]{0,180}?(?:кол-во|количество|qty)[\\s\\S]{0,120}?(?:цена|стоимость)[\\s\\S]{0,120}?(?:сумма|итого|total)/i);
  const flatText = tableHeader ? text.slice(tableHeader.index! + tableHeader[0].length) : text;
  const flatRow = /(?:^|\\s)(\\d{1,3})\\s+(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s+(шт\\.?|штук|лист(?:а|ов)?|м|метр(?:а|ов)?|кг|т|упак\\.?)\\s+([\\d\\s]+[,.]\\d{2})\\s+([\\d\\s]+[,.]\\d{2})(?=\\s+\\d{1,3}\\s+|\\s*(?:Стоимость товаров|ИТОГО)|$)/gi;
  for (const match of flatText.matchAll(flatRow)) {
    const description = match[2].trim();
    const quantity = numberValue(match[3]);
    const unitPrice = numberValue(match[5]);
    const total = numberValue(match[6]);
    if (!description || quantity === null || unitPrice === null) continue;
    items.push({
      description: description.slice(0, 500), specification: {},
      quantity, unit: match[4].slice(0, 40), unit_price: unitPrice, total,
      currency: detectCurrency(match[0]) || documentCurrency,
      confidence: 0.65, source_excerpt: match[0].trim().slice(0, 1000)
    });
    if (items.length >= 150) break;
  }
  return items;
}
function parseText(text: string) {
  const prices = [...text.matchAll(/([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(₽|руб(?:\.|лей|ля)?|RUB|USD|EUR|€|\$)/gi)]
    .map(m => ({
      amount: numberValue(m[1]) || 0,
      currency: detectCurrency(m[2]) || "RUB",
      excerpt: m[0]
    })).filter(x => x.amount > 0).slice(0, 20);
  const lead = text.match(/(?:срок\s*(?:поставки|изготовления)?|поставка|отгрузка)[^\n]{0,80}?([0-9]{1,3})\s*(?:рабочих?\s*)?(дн(?:я|ей)?|день|сут(?:ок)?|недел(?:я|и|ь))/i);
  const delivery = text.match(/(?:доставка|транспортные расходы)[^\n]{0,80}?([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(₽|руб(?:\.|лей|ля)?|RUB)/i);
  const vat = /ндс\s+сверху|плюс\s+ндс|\+\s*ндс/i.test(text) ? "НДС сверху" :
    /без\s+ндс|ндс\s*не\s*облагается/i.test(text) ? "Без НДС" :
    /включая\s+ндс|с\s+ндс|ндс\s*20\s*%/i.test(text) ? "С НДС" : null;
  const availability = /в наличии|на складе|имеется в наличии/i.test(text) ? "В наличии" :
    /под заказ|изготовим|срок изготовления/i.test(text) ? "Под заказ" :
    /нет в наличии|отсутствует/i.test(text) ? "Нет в наличии" : null;
  return {
    price_candidates: prices,
    line_items: parseLineItems(text),
    lead_time_days: lead ? Number(lead[1]) * (/недел/i.test(lead[2]) ? 7 : 1) : null,
    delivery_cost: delivery ? numberValue(delivery[1]) : null,
    vat, availability, needs_review: true, extraction_method: "rules_v2",
    text_preview: text.slice(0, 12000)
  };
}
function xmlText(value: string) {
  return value.replace(/<w:tab\s*\/>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).trim();
}
async function extractDocx(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("В DOCX не найден основной текст документа.");
  const xml = await entry.async("string");
  const lines: string[] = [];
  const tableRows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map(match => {
    const cells = [...match[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map(cell => {
      const parts = [...cell[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(x => xmlText(x[1]));
      return parts.join(" ").trim();
    });
    return cells.some(Boolean) ? cells.join(" | ") : "";
  }).filter(Boolean);
  if (tableRows.length) lines.push(...tableRows);
  else {
    for (const paragraph of xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) {
      const parts = [...paragraph[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(x => xmlText(x[1]));
      const line = parts.join(" ").trim();
      if (line) lines.push(line);
    }
  }
  return lines.join("\n").slice(0, 50000);
}
function decodeText(bytes: Uint8Array) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1251").decode(bytes); }
}

async function extractFile(bytes: Uint8Array, filename: string, mime: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "docx") return await extractDocx(bytes);
  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(bytes, { type: "array" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 10)) {
      lines.push("Лист: " + sheetName);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, blankrows: false }) as unknown[][];
      for (const row of rows.slice(0, 1500)) {
        const cells = row.map(value => String(value ?? "").trim());
        if (cells.length) lines.push(cells.join(" | "));
      }
      if (lines.join("\n").length > 50000) break;
    }
    return lines.join("\n").slice(0, 50000);
  }
  if (ext === "pdf" || mime === "application/pdf") {
    const pdf = await getDocument({ data: bytes, disableWorker: true, isEvalSupported: false } as any).promise;
    const lines: string[] = [];
    for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 60); pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const positioned = (content.items as any[]).filter(item => item.str && String(item.str).trim()).map(item => ({
        text: String(item.str).trim(), x: Number(item.transform?.[4] || 0), y: Number(item.transform?.[5] || 0)
      }));
      const grouped: { y: number; cells: { x: number; text: string }[] }[] = [];
      for (const item of positioned) {
        let row = grouped.find(candidate => Math.abs(candidate.y - item.y) <= 2.5);
        if (!row) { row = { y: item.y, cells: [] }; grouped.push(row); }
        row.cells.push({ x: item.x, text: item.text });
      }
      grouped.sort((a, b) => b.y - a.y);
      for (const row of grouped) {
        row.cells.sort((a, b) => a.x - b.x);
        const line = row.cells.map(cell => cell.text).join(" | ");
        if (line.trim()) lines.push(line);
      }
      if (lines.join("\n").length > 50000) break;
    }
    return lines.join("\n").slice(0, 50000);
  }
  if (["csv", "txt", "eml"].includes(ext)) {
    return decodeText(bytes).replace(/^\uFEFF/, "").slice(0, 50000);
  }
  throw new Error("Поддерживаются PDF, XLSX, XLS, DOCX, CSV, TXT и EML.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается." }, 405);
  let storagePath: string | null = null;
  try {
    const user = await getUser(req);
    const form = await req.formData();
    const companyId = String(form.get("companyId") || "");
    const file = form.get("file");
    if (!(file instanceof File) || !companyId) return json({ error: "Выберите файл и предприятие." }, 400);
    const filename = file.name.slice(0, 255);
    const ext = filename.toLowerCase().split(".").pop() || "";
    if (!["pdf", "xlsx", "xls", "docx", "csv", "txt", "eml"].includes(ext)) return json({ error: "Формат файла не поддерживается." }, 415);
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) return json({ error: "Размер файла должен быть от 1 байта до 15 МБ." }, 413);

    const { data: member, error: memberError } = await db.from("company_members").select("role")
      .eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!member || !["owner", "admin", "buyer"].includes(String(member.role))) return json({ error: "Нет прав на загрузку КП в это предприятие." }, 403);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const inferredMime: Record<string,string> = {
      pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", csv: "text/csv", txt: "text/plain", eml: "message/rfc822"
    };
    const mime = file.type && file.type !== "application/octet-stream" ? file.type : (inferredMime[ext] || "application/octet-stream");
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    storagePath = companyId + "/manual/" + crypto.randomUUID() + "_" + safeName;
    const uploaded = await db.storage.from("quote-documents").upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (uploaded.error) throw uploaded.error;

    let extractedText = "", extracted: any = {}, status = "review", extractionError: string | null = null;
    try {
      extractedText = await extractFile(bytes, filename, mime);
      extracted = parseText(extractedText);
      if (!extractedText.trim()) {
        status = "failed";
        extractionError = ext === "pdf" ? "В PDF не найден текстовый слой. Возможно, это скан — OCR пока не подключён." : "Не удалось извлечь текст из файла.";
      }
    } catch (error) {
      status = "failed";
      extractionError = error instanceof Error ? error.message : "Не удалось извлечь текст из файла.";
      extracted = { source_filename: filename, needs_review: true, extraction_method: "failed", text_preview: "" };
    }

    const { data: document, error: saveError } = await db.from("quote_documents").insert({
      company_id: companyId, request_id: null, supplier_id: null,
      storage_path: storagePath, original_filename: filename, mime_type: mime,
      extraction_status: status, extracted_data: extracted, extraction_error: extractionError,
      uploaded_by: user.id
    }).select("id").single();
    if (saveError) throw saveError;
    return json({
      ok: true, documentId: document.id, filename,
      extractionStatus: status, extractionError,
      extracted: { ...extracted, text_preview: extractedText.slice(0, 12000) }
    });
  } catch (error) {
    if (storagePath) await db.storage.from("quote-documents").remove([storagePath]);
    const message = error instanceof Error ? error.message : "Ошибка загрузки документа.";
    return json({ error: message }, 500);
  }
});
