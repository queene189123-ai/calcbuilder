import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const redirect = (url: string) => new Response(null, { status: 302, headers: { ...cors, Location: url } });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const redirectUri = supabaseUrl + "/functions/v1/gmail-integration";
const scopes = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"];

async function cryptoKey() {
  const raw = Deno.env.get("GMAIL_TOKEN_ENCRYPTION_KEY");
  if (!raw || raw.length < 32) throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is not configured (minimum 32 characters)");
  return await crypto.subtle.importKey("raw", new TextEncoder().encode(raw.slice(0, 32)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), new TextEncoder().encode(value));
  const bytes = new Uint8Array(iv.length + data.byteLength); bytes.set(iv); bytes.set(new Uint8Array(data), iv.length);
  return btoa(String.fromCharCode(...bytes));
}
async function decrypt(value: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await cryptoKey(), bytes.slice(12));
  return new TextDecoder().decode(clear);
}
async function userFrom(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Нужно войти в СнабПро.");
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new Error("Сессия недействительна. Войдите снова.");
  return data.user;
}
async function accessToken(refreshToken: string) {
  const body = new URLSearchParams({ client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!, refresh_token: refreshToken, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.error || "Не удалось обновить доступ Gmail");
  return data.access_token as string;
}
async function getConnection(companyId: string, userId: string) {
  const { data: member } = await admin.from("company_members").select("role").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
  if (!member) throw new Error("Нет доступа к этому предприятию.");
  const { data, error } = await admin.from("company_gmail_connections").select("*").eq("company_id", companyId).maybeSingle();
  if (error || !data) throw new Error("Gmail ещё не подключён для этого предприятия.");
  return data;
}

async function canManagePurchasing(companyId: string, userId: string) {
  const { data: member, error } = await admin.from("company_members").select("role")
    .eq("company_id", companyId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return !!member && ["owner", "admin", "buyer"].includes(String(member.role));
}

function decodeGmailData(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return new TextDecoder("utf-8").decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
function collectMessageParts(part: any, texts: string[], attachments: any[]) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) attachments.push({filename:part.filename,mimeType:part.mimeType||"",size:part.body.size||0,attachmentId:part.body.attachmentId});
  if (part.mimeType === "text/plain" && part.body?.data) { try { texts.push(decodeGmailData(part.body.data)); } catch {} }
  for (const child of part.parts || []) collectMessageParts(child, texts, attachments);
}
function parseSupplierReply(text: string) {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\r/g, "");
  const prices = [...normalized.matchAll(/([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(₽|руб(?:\.|лей|ля)?|RUB|USD|EUR|€|\$)/gi)]
    .map(m=>({amount:Number(m[1].replace(/\s/g,"").replace(",",".")),currency:/₽|руб|RUB/i.test(m[2])?"RUB":/USD|\$/i.test(m[2])?"USD":"EUR",excerpt:m[0]}))
    .filter(x=>Number.isFinite(x.amount)&&x.amount>0).slice(0,5);
  const lead=normalized.match(/(?:срок\s*(?:поставки|изготовления)?|поставка|отгрузка)[^\n]{0,60}?([0-9]{1,3})\s*(рабочих?\s*)?(дн(?:я|ей)?|день|сут(?:ок)?|недел(?:я|и|ь))/i);
  const availability=/в наличии|на складе|имеется в наличии/i.test(normalized)?"В наличии":/под заказ|изготовим|срок изготовления/i.test(normalized)?"Под заказ":/нет в наличии|отсутствует|не можем поставить/i.test(normalized)?"Нет в наличии":null;
  const vat=/без\s+ндс|ндс\s*не\s*облагается/i.test(normalized)?"Без НДС":/включая\s+ндс|с\s+ндс|ндс\s*20\s*%/i.test(normalized)?"С НДС":null;
  const payment=(normalized.match(/(?:условия оплаты|оплата|предоплата|отсрочка)[^\n.]{0,100}/i)||[])[0]||null;
  const delivery=(normalized.match(/(?:доставка|транспортные расходы|стоимость доставки)[^\n.]{0,100}/i)||[])[0]||null;
  return {price_candidates:prices,lead_time_days:lead?Number(lead[1])*(/недел/i.test(lead[3])?7:1):null,availability,vat,payment_terms_excerpt:payment,delivery_excerpt:delivery,extraction_method:"rules_v1",needs_review:true};
}

function base64url(s: string) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.searchParams.has("code")) {
      const code = url.searchParams.get("code")!;
      const state = url.searchParams.get("state") || "";
      const { data: flow } = await admin.from("gmail_oauth_states").select("*").eq("state", state).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!flow) return redirect("https://queene189123-ai.github.io/calcbuilder/?gmail=error&reason=state");
      await admin.from("gmail_oauth_states").delete().eq("state", state);
      const body = new URLSearchParams({ code, client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!, redirect_uri: redirectUri, grant_type: "authorization_code" });
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.refresh_token) throw new Error(tokens.error_description || "Google не вернул refresh token. Переподключите Gmail с подтверждением доступа.");
      const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: "Bearer " + tokens.access_token } });
      const profile = await profileRes.json();
      if (!profileRes.ok || !profile.emailAddress) throw new Error("Не удалось определить адрес Gmail.");
      const cipher = await encrypt(tokens.refresh_token);
      const { error } = await admin.from("company_gmail_connections").upsert({
        company_id: flow.company_id, connected_by: flow.user_id, gmail_address: profile.emailAddress,
        refresh_token_ciphertext: cipher, scopes
      }, { onConflict: "company_id" });
      if (error) throw error;
      return redirect("https://queene189123-ai.github.io/calcbuilder/?gmail=connected");
    }
    if (req.method === "GET" && url.searchParams.has("error")) {
      return redirect("https://queene189123-ai.github.io/calcbuilder/?gmail=denied");
    }
    const user = await userFrom(req);
    const body = req.method === "POST" ? await req.json() : {};
    if (body.action === "connect") {
      const companyId = String(body.companyId || "");
      if (!(await canManagePurchasing(companyId, user.id))) return json({ error: "Для подключения почты нужны права владельца, администратора или закупщика." }, 403);
      if (!Deno.env.get("GOOGLE_CLIENT_ID") || !Deno.env.get("GOOGLE_CLIENT_SECRET")) return json({ error: "Сервер Gmail ещё не настроен: добавьте Google OAuth Client ID и Client Secret в секреты Supabase." }, 503);
      const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      const { error } = await admin.from("gmail_oauth_states").insert({ state, user_id: user.id, company_id: companyId, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
      if (error) throw error;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.search = new URLSearchParams({ client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: scopes.join(" "), state }).toString();
      return json({ authUrl: authUrl.toString(), redirectUri, scopes });
    }
    if (body.action === "status") {
      const companyId = String(body.companyId || "");
      const { data: member } = await admin.from("company_members").select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
      if (!member) return json({ error: "Нет доступа к предприятию." }, 403);
      const { data } = await admin.from("company_gmail_connections").select("gmail_address,scopes,created_at").eq("company_id", companyId).maybeSingle();
      return json({ connected: !!data, connection: data || null });
    }
    if (body.action === "send") {
      const companyId = String(body.companyId || "");
      if (!(await canManagePurchasing(companyId, user.id))) return json({ error: "Для отправки писем нужны права владельца, администратора или закупщика." }, 403);
      const c = await getConnection(companyId, user.id);
      const token = await accessToken(await decrypt(c.refresh_token_ciphertext));
      const to = String(body.to || "").trim();
      const subject = String(body.subject || "Запрос коммерческого предложения");
      const textBody = String(body.text || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !textBody || textBody.length > 20000) return json({ error: "Проверьте адрес получателя и текст письма." }, 400);
      const raw = ["To: " + to, "Subject: =?UTF-8?B?" + btoa(unescape(encodeURIComponent(subject))) + "?=", "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", btoa(unescape(encodeURIComponent(textBody)))].join("\r\n");
      const sent = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ raw: base64url(raw) }) });
      const result = await sent.json();
      if (!sent.ok) return json({ error: result.error?.message || "Gmail не отправил письмо." }, 502);
      const requestId = String(body.requestId || "");
      const subjectToken = String(body.subjectToken || "");
      if (requestId && subjectToken) {
        const { data: linked, error: linkError } = await admin.from("purchase_request_suppliers")
          .update({ status: "sent", gmail_message_id: result.id, sent_at: new Date().toISOString() })
          .eq("company_id", companyId).eq("request_id", requestId).eq("subject_token", subjectToken).eq("supplier_email", to)
          .select("id").maybeSingle();
        if (linkError || !linked) {
          // The message is already sent. Do not report a send failure that could cause a duplicate retry.
          return json({ ok: true, messageId: result.id, threadId: result.threadId,
            warning: "Письмо отправлено, но статус заявки не обновился. Обновите закупку вручную." });
        }
      }
      return json({ ok: true, messageId: result.id, threadId: result.threadId });
    }
    if (body.action === "save_quote") {
      const companyId=String(body.companyId||"");
      const messageId=String(body.messageId||"");
      const requestItemId=String(body.requestItemId||"");
      const unitPrice=Number(body.unitPrice);
      const deliveryCost=Math.max(0,Number(body.deliveryCost)||0);
      const currency=String(body.currency||"RUB").toUpperCase();
      if(!(await canManagePurchasing(companyId,user.id)))return json({error:"Для добавления КП нужны права владельца, администратора или закупщика."},403);
      const c=await getConnection(companyId,user.id);
      if(!messageId||!requestItemId||!Number.isFinite(unitPrice)||unitPrice<=0||!["RUB","USD","EUR"].includes(currency)) return json({error:"Укажите позицию закупки и корректную цену."},400);
      const {data:message,error:messageError}=await admin.from("supplier_email_messages").select("id,request_id,supplier_id,from_email,subject,body_text").eq("company_id",companyId).eq("gmail_message_id",messageId).maybeSingle();
      if(messageError||!message||!message.request_id||!message.supplier_id) return json({error:"Письмо не привязано к закупке и поставщику. Сначала проверьте сопоставление."},400);
      const {data:item,error:itemError}=await admin.from("purchase_request_items").select("id,request_id,description,specification,quantity,unit").eq("company_id",companyId).eq("request_id",message.request_id).eq("id",requestItemId).maybeSingle();
      if(itemError||!item) return json({error:"Выбранная позиция не относится к этой закупке."},400);
      const {data:quote,error:quoteError}=await admin.from("supplier_quotes").insert({company_id:companyId,request_id:message.request_id,supplier_id:message.supplier_id,currency,delivery_cost:deliveryCost,lead_time_days:body.leadTimeDays===""||body.leadTimeDays==null?null:Math.max(0,Math.round(Number(body.leadTimeDays))),payment_terms:String(body.paymentTerms||"").slice(0,500)||null,notes:"Сохранено из письма: "+String(message.subject||"").slice(0,180)}).select("id").single();
      if(quoteError) throw quoteError;
      const {error:quoteItemError}=await admin.from("quote_items").insert({company_id:companyId,quote_id:quote.id,request_item_id:item.id,description:item.description,specification:item.specification,quantity:item.quantity,unit:item.unit,unit_price:unitPrice,vat_included:body.vatIncluded==="true"?true:body.vatIncluded==="false"?false:null,availability:String(body.availability||"").slice(0,80)||null,confidence:0.7,source_excerpt:String(body.sourceExcerpt||"").slice(0,500)||null});
      if(quoteItemError){await admin.from("supplier_quotes").delete().eq("company_id",companyId).eq("id",quote.id);throw quoteItemError;}
      await admin.from("supplier_email_messages").update({processing_status:"parsed"}).eq("company_id",companyId).eq("gmail_message_id",messageId);
      return json({ok:true,quoteId:quote.id});
    }
    if (body.action === "saved_inbox") {
      const companyId = String(body.companyId || "");
      const { data: member, error: memberError } = await admin.from("company_members")
        .select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
      if (memberError) throw memberError;
      if (!member) return json({ error: "Нет доступа к предприятию." }, 403);
      const [messageResult, supplierResult, requestResult, monitorResult] = await Promise.all([
        admin.from("supplier_email_messages").select("id,gmail_message_id,supplier_id,request_id,from_email,subject,body_text,attachments,extracted_data,processing_status,received_at")
          .eq("company_id", companyId).order("received_at", { ascending: false }).limit(30),
        admin.from("suppliers").select("id,name,email").eq("company_id", companyId),
        admin.from("purchase_requests").select("id,title").eq("company_id", companyId),
        admin.from("gmail_monitor_runs").select("last_checked_at,status,messages_saved,last_error").eq("company_id", companyId).maybeSingle()
      ]);
      if (messageResult.error) throw messageResult.error;
      if (supplierResult.error) throw supplierResult.error;
      if (requestResult.error) throw requestResult.error;
      if (monitorResult.error) throw monitorResult.error;
      const supplierById = new Map((supplierResult.data || []).map((s: any) => [s.id, s]));
      const requestById = new Map((requestResult.data || []).map((r: any) => [r.id, r]));
      const requestIds = [...new Set((messageResult.data || []).map((m: any) => m.request_id).filter(Boolean))];
      let requestItems: any[] = [];
      if (requestIds.length) {
        const { data, error } = await admin.from("purchase_request_items")
          .select("id,request_id,description,specification,quantity,unit")
          .eq("company_id", companyId).in("request_id", requestIds);
        if (error) throw error;
        requestItems = data || [];
      }
      const itemsByRequest = new Map<string, any[]>();
      for (const item of requestItems) {
        const group = itemsByRequest.get(item.request_id) || [];
        group.push(item);
        itemsByRequest.set(item.request_id, group);
      }
      const messages = (messageResult.data || []).map((m: any) => ({
        id: m.gmail_message_id,
        dbId: m.id,
        gmailMessageId: m.gmail_message_id,
        from: m.from_email,
        fromEmail: m.from_email,
        subject: m.subject,
        date: m.received_at,
        receivedAt: m.received_at,
        bodyText: m.body_text,
        attachments: m.attachments || [],
        extracted: m.extracted_data || {},
        processingStatus: m.processing_status,
        supplierName: (supplierById.get(m.supplier_id) || (supplierResult.data || []).find((s: any) => String(s.email || "").trim().toLowerCase() === String(m.from_email || "").trim().toLowerCase()))?.name || null,
        requestId: m.request_id || null,
        requestTitle: requestById.get(m.request_id)?.title || null,
        requestItems: itemsByRequest.get(m.request_id) || []
      }));
      return json({ messages, synced: messages.length, source: "database", monitor: monitorResult.data || null });
    }
    if (body.action === "inbox") {
      const companyId = String(body.companyId || "");
      const c = await getConnection(companyId, user.id);
      const token = await accessToken(await decrypt(c.refresh_token_ciphertext));
      const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=" + encodeURIComponent("in:inbox newer_than:30d"), { headers: { Authorization: "Bearer " + token } });
      const messages = await list.json();
      if (!list.ok) return json({ error: messages.error?.message || "Не удалось прочитать входящие." }, 502);
      const { data: suppliers, error: suppliersError } = await admin.from("suppliers").select("id,name,email").eq("company_id", companyId);
      if (suppliersError) throw suppliersError;
      const supplierByEmail = new Map((suppliers || []).filter((s: any) => s.email).map((s: any) => [String(s.email).trim().toLowerCase(), s]));
      const items = await Promise.all((messages.messages || []).slice(0, 30).map(async (m: {id:string}) => {
        const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + m.id + "?format=full", { headers: { Authorization: "Bearer " + token } });
        const d = await r.json();
        if (!r.ok) return null;
        const headers = d.payload?.headers || [];
        const header = (name: string) => headers.find((x:any)=>String(x.name).toLowerCase()===name.toLowerCase())?.value || "";
        const from = header("From");
        const fromEmail = (from.match(/<([^>]+)>/)?.[1] || from).trim().toLowerCase();
        const supplier = supplierByEmail.get(fromEmail) || null;
        const subject = header("Subject");
        const subjectToken = subject.match(/\[(SP-[A-Z0-9-]+)\]/i)?.[1] || null;
        let requestLink: any = null;
        if (subjectToken) {
          const { data: link } = await admin.from("purchase_request_suppliers").select("request_id,supplier_id,supplier_email").eq("company_id", companyId).eq("subject_token", subjectToken).maybeSingle();
          if (link && String(link.supplier_email).toLowerCase() === fromEmail) requestLink = link;
        }
        const texts: string[] = [], attachments: any[] = [];
        collectMessageParts(d.payload, texts, attachments);
        const bodyText = texts.join("\n\n").slice(0, 30000) || d.snippet || "";
        const extracted = parseSupplierReply(bodyText);
        const receivedAt = d.internalDate ? new Date(Number(d.internalDate)).toISOString() : null;
        const row = {company_id:companyId,gmail_message_id:m.id,supplier_id:requestLink?.supplier_id||supplier?.id||null,request_id:requestLink?.request_id||null,from_email:fromEmail,subject,body_text:bodyText,attachments,extracted_data:extracted,processing_status:requestLink?"needs_review":supplier?"needs_review":"received",received_at:receivedAt};
        const {data:existingMessage,error:findMessageError}=await admin.from("supplier_email_messages").select("id").eq("company_id",companyId).eq("gmail_message_id",m.id).maybeSingle();
        if(findMessageError) throw findMessageError;
        const saveResult=existingMessage
          ? await admin.from("supplier_email_messages").update(row).eq("id",existingMessage.id)
          : await admin.from("supplier_email_messages").insert(row);
        if(saveResult.error) throw saveResult.error;
        if(requestLink){
          const {error:replyStatusError}=await admin.from("purchase_request_suppliers")
            .update({status:"replied",replied_at:receivedAt||new Date().toISOString()})
            .eq("company_id",companyId).eq("subject_token",subjectToken).eq("supplier_email",fromEmail);
          if(replyStatusError)throw replyStatusError;
        }
        const linkedSupplier = requestLink?.supplier_id ? (suppliers || []).find((s:any)=>s.id===requestLink.supplier_id) : supplier;
        let requestTitle: string | null = null;
        if (requestLink?.request_id) {
          const { data: request } = await admin.from("purchase_requests").select("title").eq("id", requestLink.request_id).maybeSingle();
          requestTitle = request?.title || null;
        }
        return {id:m.id,snippet:d.snippet||"",from,fromEmail,supplierName:linkedSupplier?.name||null,subject:row.subject,date:header("Date"),receivedAt,bodyText,attachments:attachments.map(a=>({filename:a.filename,mimeType:a.mimeType,size:a.size})),extracted,processingStatus:row.processing_status,requestId:requestLink?.request_id||null,requestTitle};
      }));
      const linkedRequestIds=[...new Set(items.filter(Boolean).map((x:any)=>x.requestId).filter(Boolean))];
      const requestItemsById:Record<string,any[]>={};
      if(linkedRequestIds.length){
        const {data:requestItems,error:requestItemsError}=await admin.from("purchase_request_items").select("id,request_id,description,specification,quantity,unit").eq("company_id",companyId).in("request_id",linkedRequestIds);
        if(requestItemsError) throw requestItemsError;
        for(const item of requestItems||[])(requestItemsById[item.request_id] ||= []).push(item);
      }
      return json({messages:items.filter(Boolean).map((m:any)=>({...m,requestItems:requestItemsById[m.requestId]||[]})),synced:items.filter(Boolean).length});
    }
    return json({ error: "Неизвестное действие." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Внутренняя ошибка Gmail." }, 500);
  }
});