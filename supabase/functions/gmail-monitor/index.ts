import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function hex(bytes: Uint8Array) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
async function authorized(req: Request) {
  const supplied = req.headers.get("x-monitor-token") || "";
  if (!supplied || supplied.length < 32) return false;
  const { data, error } = await db.from("gmail_monitor_config").select("token_hash").eq("id", 1).single();
  if (error || !data?.token_hash) return false;
  return await sha256(supplied) === data.token_hash;
}
async function decrypt(value: string) {
  const raw = Deno.env.get("GMAIL_TOKEN_ENCRYPTION_KEY");
  if (!raw || raw.length < 32) throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(raw.slice(0, 32)), "AES-GCM", false, ["decrypt"]);
  const packed = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
  return new TextDecoder().decode(clear);
}
async function accessToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");
  const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Gmail token refresh failed");
  return data.access_token as string;
}
function decodeGmailData(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return new TextDecoder("utf-8").decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
function collectParts(part: any, texts: string[], attachments: any[]) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) attachments.push({
    filename: String(part.filename).slice(0, 255),
    mimeType: String(part.mimeType || "").slice(0, 120),
    size: Number(part.body.size || 0),
    attachmentId: String(part.body.attachmentId)
  });
  if (part.mimeType === "text/plain" && part.body?.data) {
    try { texts.push(decodeGmailData(part.body.data)); } catch { /* malformed part */ }
  }
  for (const child of part.parts || []) collectParts(child, texts, attachments);
}
function parseSupplierReply(text: string) {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\r/g, "");
  const prices = [...normalized.matchAll(/([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(₽|руб(?:\.|лей|ля)?|RUB|USD|EUR|€|\$)/gi)]
    .map(m => ({
      amount: Number(m[1].replace(/\s/g, "").replace(",", ".")),
      currency: /₽|руб|RUB/i.test(m[2]) ? "RUB" : /USD|\$/i.test(m[2]) ? "USD" : "EUR",
      excerpt: m[0]
    })).filter(x => Number.isFinite(x.amount) && x.amount > 0).slice(0, 10);
  const lead = normalized.match(/(?:срок\s*(?:поставки|изготовления)?|поставка|отгрузка)[^\n]{0,60}?([0-9]{1,3})\s*(рабочих?\s*)?(дн(?:я|ей)?|день|сут(?:ок)?|недел(?:я|и|ь))/i);
  const availability = /в наличии|на складе|имеется в наличии/i.test(normalized) ? "В наличии" :
    /под заказ|изготовим|срок изготовления/i.test(normalized) ? "Под заказ" :
    /нет в наличии|отсутствует|не можем поставить/i.test(normalized) ? "Нет в наличии" : null;
  const vat = /без\s+ндс|ндс\s*не\s*облагается/i.test(normalized) ? "Без НДС" :
    /включая\s+ндс|с\s+ндс|ндс\s*20\s*%/i.test(normalized) ? "С НДС" : null;
  const payment = (normalized.match(/(?:условия оплаты|оплата|предоплата|отсрочка)[^\n.]{0,100}/i) || [])[0] || null;
  const delivery = (normalized.match(/(?:доставка|транспортные расходы|стоимость доставки)[^\n.]{0,100}/i) || [])[0] || null;
  return {
    price_candidates: prices,
    lead_time_days: lead ? Number(lead[1]) * (/недел/i.test(lead[3]) ? 7 : 1) : null,
    availability, vat, payment_terms_excerpt: payment, delivery_excerpt: delivery,
    extraction_method: "rules_v1", needs_review: true
  };
}
async function recordRun(companyId: string, status: string, messagesSaved: number, lastError: string | null = null) {
  const { error } = await db.from("gmail_monitor_runs").upsert({
    company_id: companyId, last_checked_at: new Date().toISOString(),
    status, messages_saved: messagesSaved, last_error: lastError
  }, { onConflict: "company_id" });
  if (error) console.error("Unable to record Gmail monitor run", companyId, error.message);
}
function header(headers: any[], name: string) {
  return headers.find(x => String(x.name || "").toLowerCase() === name.toLowerCase())?.value || "";
}
async function markSeen(companyId: string, messageId: string) {
  const { error } = await db.from("gmail_monitor_seen_messages").upsert({
    company_id: companyId, gmail_message_id: messageId, checked_at: new Date().toISOString()
  }, { onConflict: "company_id,gmail_message_id", ignoreDuplicates: true });
  if (error) throw error;
}
async function syncCompany(connection: any) {
  const companyId = connection.company_id;
  const refreshToken = await decrypt(connection.refresh_token_ciphertext);
  const token = await accessToken(refreshToken);
  const listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=" + encodeURIComponent("in:inbox newer_than:30d"), {
    headers: { Authorization: "Bearer " + token }
  });
  const listed = await listResponse.json();
  if (!listResponse.ok) throw new Error(listed.error?.message || "Unable to list Gmail inbox");
  const messageIds = (listed.messages || []).map((m: any) => String(m.id)).filter(Boolean);
  if (!messageIds.length) { await recordRun(companyId, "ok", 0); return { companyId, discovered: 0, saved: 0 }; }

  const { data: existing, error: existingError } = await db.from("gmail_monitor_seen_messages")
    .select("gmail_message_id").eq("company_id", companyId).in("gmail_message_id", messageIds);
  if (existingError) throw existingError;
  const known = new Set((existing || []).map((x: any) => x.gmail_message_id));
  const freshIds = messageIds.filter((id: string) => !known.has(id));
  if (!freshIds.length) { await recordRun(companyId, "ok", 0); return { companyId, discovered: messageIds.length, saved: 0 }; }

  const [{ data: suppliers, error: supplierError }, { data: links, error: linkError }] = await Promise.all([
    db.from("suppliers").select("id,name,email").eq("company_id", companyId),
    db.from("purchase_request_suppliers").select("request_id,supplier_id,supplier_email,subject_token").eq("company_id", companyId)
  ]);
  if (supplierError) throw supplierError;
  if (linkError) throw linkError;
  const supplierByEmail = new Map((suppliers || []).filter((s: any) => s.email)
    .map((s: any) => [String(s.email).trim().toLowerCase(), s]));
  let saved = 0;
  for (const messageId of freshIds) {
    const metadataResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + encodeURIComponent(messageId) + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject", {
      headers: { Authorization: "Bearer " + token }
    });
    const metadata = await metadataResponse.json();
    if (!metadataResponse.ok) continue;
    const headers = metadata.payload?.headers || [];
    const from = header(headers, "From");
    const fromEmail = (from.match(/<([^>]+)>/)?.[1] || from).trim().toLowerCase();
    if (!fromEmail || fromEmail === String(connection.gmail_address || "").toLowerCase()) {
      await markSeen(companyId, messageId);
      continue;
    }
    const subject = header(headers, "Subject");
    const tokenMatch = subject.match(/\[(SP-[A-Z0-9-]+)\]/i);
    const subjectToken = tokenMatch?.[1] || null;
    const requestLink = subjectToken ? (links || []).find((x: any) =>
      String(x.subject_token).toLowerCase() === subjectToken.toLowerCase() &&
      String(x.supplier_email).toLowerCase() === fromEmail) : null;
    const supplier = requestLink?.supplier_id
      ? (suppliers || []).find((s: any) => s.id === requestLink.supplier_id)
      : supplierByEmail.get(fromEmail);
    // Keep external messages from unknown senders too. They remain unassigned
    // in the inbox so a buyer can review and map new suppliers instead of losing them.
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + encodeURIComponent(messageId) + "?format=full", {
      headers: { Authorization: "Bearer " + token }
    });
    const message = await response.json();
    if (!response.ok) continue;
    const texts: string[] = [], attachments: any[] = [];
    collectParts(message.payload, texts, attachments);
    const bodyText = (texts.join("\\n\\n").slice(0, 30000) || message.snippet || "");
    const extracted = parseSupplierReply(bodyText);
    const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null;
    const row = {
      company_id: companyId, gmail_message_id: messageId,
      supplier_id: requestLink?.supplier_id || supplier?.id || null,
      request_id: requestLink?.request_id || null,
      from_email: fromEmail, subject, body_text: bodyText,
      attachments, extracted_data: extracted,
      processing_status: "needs_review",
      received_at: receivedAt
    };
    const { error: insertError } = await db.from("supplier_email_messages").upsert(row, {
      onConflict: "company_id,gmail_message_id", ignoreDuplicates: true
    });
    if (!insertError) {
      saved++;
      // Mark as seen only after the message is safely persisted. Transient Gmail/DB
      // failures leave it eligible for the next scheduled sync.
      await markSeen(companyId, messageId);
      if (requestLink) {
        const { error: replyStatusError } = await db.from("purchase_request_suppliers")
          .update({ status: "replied", replied_at: receivedAt || new Date().toISOString() })
          .eq("company_id", companyId).eq("subject_token", requestLink.subject_token)
          .eq("supplier_email", fromEmail);
        if (replyStatusError) console.error("Unable to update supplier reply status", companyId, messageId, replyStatusError.message);
      }
    } else console.error("Unable to save Gmail message", companyId, messageId, insertError.message);
  }
  await recordRun(companyId, "ok", saved);
  return { companyId, discovered: messageIds.length, saved };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    if (!(await authorized(req))) return new Response("Unauthorized", { status: 401 });
    const { data: connections, error } = await db.from("company_gmail_connections")
      .select("company_id,gmail_address,refresh_token_ciphertext");
    if (error) throw error;
    const results = [];
    for (const connection of connections || []) {
      try { results.push({ ...(await syncCompany(connection)), status: "ok" }); }
      catch (e) {
        const message = e instanceof Error ? e.message : "Unknown Gmail monitor error";
        console.error("Gmail monitor failed for company", connection.company_id, message);
        await recordRun(connection.company_id, "error", 0, message.slice(0, 1000));
        results.push({ companyId: connection.company_id, status: "error", error: message });
      }
    }
    return new Response(JSON.stringify({
      ok: true, companies: results.length,
      saved: results.reduce((sum: number, x: any) => sum + Number(x.saved || 0), 0),
      results
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Gmail monitor failed" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});
