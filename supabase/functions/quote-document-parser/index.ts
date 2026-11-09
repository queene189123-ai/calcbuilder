import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
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

function parseText(text: string) {
  const prices = [...text.matchAll(/([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(₽|руб(?:\.|лей|ля)?|RUB|USD|EUR|€|\$)/gi)]
    .map(m => ({
      amount: Number(m[1].replace(/\s/g, "").replace(",", ".")),
      currency: /₽|руб|RUB/i.test(m[2]) ? "RUB" : /USD|\$/i.test(m[2]) ? "USD" : "EUR",
      excerpt: m[0]
    })).filter(x => Number.isFinite(x.amount) && x.amount > 0).slice(0, 20);
  const lead = text.match(/(?:срок\s*(?:поставки|изготовления)?|поставка|отгрузка)[^\n]{0,80}?([0-9]{1,3})\s*(?:рабочих?\s*)?(дн(?:я|ей)?|день|сут(?:ок)?|недел(?:я|и|ь))/i);
  const delivery = text.match(/(?:доставка|транспортные расходы)[^\n]{0,80}?([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(₽|руб(?:\.|лей|ля)?|RUB)/i);
  const vat = /ндс\\s+сверху|плюс\\s+ндс|\\+\\s*ндс/i.test(text) ? "НДС сверху" :\n    /без\\s+ндс|ндс\\s*не\\s*облагается/i.test(text) ? "Без НДС" :\n    /включая\\s+ндс|с\\s+ндс|ндс\\s*20\\s*%/i.test(text) ? "С НДС" : null;
  const availability = /в наличии|на складе|имеется в наличии/i.test(text) ? "В наличии" :
    /под заказ|изготовим|срок изготовления/i.test(text) ? "Под заказ" :
    /нет в наличии|отсутствует/i.test(text) ? "Нет в наличии" : null;
  return {
    price_candidates: prices,
    lead_time_days: lead ? Number(lead[1]) * (/недел/i.test(lead[2]) ? 7 : 1) : null,
    delivery_cost: delivery ? Number(delivery[1].replace(/\s/g, "").replace(",", ".")) : null,
    vat, availability, needs_review: true, extraction_method: "rules_v1",
    text_preview: text.slice(0, 12000)
  };
}

function decodeText(bytes: Uint8Array) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1251").decode(bytes); }
}

async function extractFile(bytes: Uint8Array, filename: string, mime: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(bytes, { type: "array" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 10)) {
      lines.push("Лист: " + sheetName);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, blankrows: false }) as unknown[][];
      for (const row of rows.slice(0, 1500)) {
        const cells = row.map(value => String(value ?? "").trim()).filter(Boolean);
        if (cells.length) lines.push(cells.join(" | "));
      }
      if (lines.join("\n").length > 50000) break;
    }
    return lines.join("\n").slice(0, 50000);
  }
  if (ext === "pdf" || mime === "application/pdf") {
    const pdf = await getDocument({ data: bytes, disableWorker: true, isEvalSupported: false }).promise;
    const lines: string[] = [];
    for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 60); pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const line = (content.items as any[]).map(item => item.str || "").filter(Boolean).join(" ");
      if (line) lines.push(line);
      if (lines.join("\n").length > 50000) break;
    }
    return lines.join("\n").slice(0, 50000);
  }
  if (["csv", "txt", "eml"].includes(ext)) {
    return decodeText(bytes).replace(/^\uFEFF/, "").slice(0, 50000);
  }
  throw new Error("Поддерживаются PDF, XLSX, XLS, CSV, TXT и EML.");
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
    if (!["pdf", "xlsx", "xls", "csv", "txt", "eml"].includes(ext)) return json({ error: "Формат файла не поддерживается." }, 415);
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) return json({ error: "Размер файла должен быть от 1 байта до 15 МБ." }, 413);

    const { data: member, error: memberError } = await db.from("company_members").select("role")
      .eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!member || !["owner", "admin", "buyer"].includes(String(member.role))) return json({ error: "Нет прав на загрузку КП в это предприятие." }, 403);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const inferredMime: Record<string,string> = {
      pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel", csv: "text/csv", txt: "text/plain", eml: "message/rfc822"
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
