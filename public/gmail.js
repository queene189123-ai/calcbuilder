(() => {
  const endpoint = "https://tdewylpxanviyhdwdnci.supabase.co/functions/v1/gmail-integration";
  const $ = id => document.getElementById(id);
  const statusEl = () => $("gmailStatus");
  function companyId() { return window.snabproGetCompany?.()?.id || null; }
  async function call(action, extra={}) {
    const client = window.snabproClient;
    if (!client) throw new Error("Модуль аккаунта не загружен.");
    const { data:{session} } = await client.auth.getSession();
    if (!session) throw new Error("Сначала войдите в СнабПро.");
    const r = await fetch(endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+session.access_token, "apikey":window.SNABPRO_CONFIG.supabaseKey },
      body:JSON.stringify({action, companyId:companyId(), ...extra})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Ошибка почтового сервиса.");
    return data;
  }
  async function status() {
    if (!companyId()) { if(statusEl()) statusEl().textContent="Сначала войдите и выберите предприятие."; return; }
    try {
      const d=await call("status");
      if(statusEl()) statusEl().textContent=d.connected ? "Подключён: "+d.connection.gmail_address : "Gmail не подключён. Подключите рабочий ящик предприятия.";
    } catch(e) { if(statusEl()) {statusEl().textContent=e.message;statusEl().classList.add("error");} }
  }
  async function connect() {
    try {
      const b=$("gmailConnect"); if(b){b.disabled=true;b.textContent="Подготавливаем подключение…";}
      const d=await call("connect");
      location.href=d.authUrl;
    } catch(e) {
      if(statusEl()){statusEl().textContent=e.message;statusEl().classList.add("error");}
      if(typeof showToast==="function") showToast(e.message);
    } finally {
      const b=$("gmailConnect"); if(b){b.disabled=false;b.textContent="Подключить Gmail";}
    }
  }
  function renderInboxMessage(m) {
    const e=escapeHtml, x=m.extracted||{};
    const prices=(x.price_candidates||[]).map(p=>e(p.amount)+" "+e(p.currency)).join(", ")||"Не распознана";
    const attachments=(m.attachments||[]).map(a=>e(a.filename)).join(", ");
    const supplier=m.supplierName ? "Поставщик: "+e(m.supplierName) : "Поставщик не сопоставлен — проверьте email в карточке поставщика";
    const fields=[
      ["Цена",prices],["Срок поставки",x.lead_time_days!=null?e(x.lead_time_days)+" дн.":"Не распознан"],
      ["Наличие",e(x.availability||"Не указано")],["НДС",e(x.vat||"Не указано")],
      ["Оплата",e(x.payment_terms_excerpt||"Не указано")],["Доставка",e(x.delivery_excerpt||"Не указана")]
    ];
    return '<article style="border:1px solid #e7ebf2;border-radius:10px;padding:12px;margin:10px 0">'+
      '<div style="font-weight:700">'+e(m.subject||"(без темы)")+'</div>'+
      '<div style="font-size:11px;color:#78849a;margin:4px 0">'+e(m.from||m.fromEmail)+' · '+e(m.date||"")+'</div>'+
      '<div style="font-size:12px;margin:6px 0">'+supplier+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">'+fields.map(f=>'<div><span style="color:#78849a">'+f[0]+':</span> <b>'+f[1]+'</b></div>').join("")+'</div>'+
      (attachments?'<div style="font-size:11px;margin-top:7px">Вложения: '+attachments+'</div>':"")+
      '<div style="font-size:10px;color:#8a6a2e;margin-top:8px">Предварительное извлечение · требуется проверка</div>'+
      '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:11px">Показать текст письма</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.5 inherit;max-height:220px;overflow:auto">'+e(m.bodyText||m.snippet||"Текст не найден")+'</pre></details></article>';
  }
  async function inbox() {
    const out=$("gmailInboxList"), b=$("gmailInbox");
    try {
      if(b){b.disabled=true;b.textContent="Синхронизируем…";}
      if(out)out.textContent="Читаем новые письма и сопоставляем отправителей с базой поставщиков…";
      const d=await call("inbox"), items=d.messages||[];
      const matched=items.filter(m=>m.supplierName).length;
      out.innerHTML='<div style="font-size:11px;color:#78849a;margin:8px 0">Синхронизировано писем: '+items.length+' · распознано поставщиков: '+matched+'</div>'+
        (items.map(renderInboxMessage).join("")||"Новых входящих писем за последние 30 дней не найдено.");
    } catch(e) { if(out)out.textContent=e.message; }
    finally {if(b){b.disabled=false;b.textContent="Проверить входящие";}}
  }
  async function sendMail() {
    const b=$("gmailSend"), out=$("gmailSendStatus");
    const to=$("gmailTo")?.value.trim(), subject=$("gmailSubject")?.value.trim(), textBody=$("gmailText")?.value.trim();
    if(!to || !textBody){if(out)out.textContent="Укажи адрес получателя и текст письма.";return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){if(out)out.textContent="Проверь адрес электронной почты.";return;}
    if(!confirm("Отправить письмо на "+to+"?")) return;
    try {
      if(b){b.disabled=true;b.textContent="Отправляем…";}
      if(out)out.textContent="Связываемся с Gmail…";
      await call("send",{to,subject:subject||"Запрос коммерческого предложения",text:textBody});
      if(out)out.textContent="Письмо успешно отправлено на "+to+".";
      if(typeof showToast==="function")showToast("Письмо отправлено.");
    } catch(e) { if(out)out.textContent="Не удалось отправить: "+e.message; }
    finally {if(b){b.disabled=false;b.textContent="Отправить письмо";}}
  }
  function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  document.addEventListener("DOMContentLoaded",()=>{
    $("gmailConnect")?.addEventListener("click",connect);
    $("gmailInbox")?.addEventListener("click",inbox);
    $("gmailSend")?.addEventListener("click",sendMail);
    $("accountBtn")?.addEventListener("click",()=>setTimeout(status,250));
    const params=new URLSearchParams(location.search);
    if(params.get("gmail")==="connected"){history.replaceState({}, "", location.pathname);setTimeout(()=>{status();if(typeof showToast==="function")showToast("Gmail успешно подключён.");},500);}
    if(params.get("gmail")==="denied"||params.get("gmail")==="error"){if(statusEl())statusEl().textContent="Google не завершил подключение. Попробуйте ещё раз.";}
  });
})();