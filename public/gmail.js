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
    const request=m.requestTitle ? "Заявка: "+e(m.requestTitle) : "";
    const reviewLabel=m.requestId ? "Связано с закупкой · нужна проверка" : m.supplierName ? "Поставщик найден · нужна проверка" : "Не сопоставлено с поставщиком";
    const fields=[
      ["Цена",prices],["Срок поставки",x.lead_time_days!=null?e(x.lead_time_days)+" дн.":"Не распознан"],
      ["Наличие",e(x.availability||"Не указано")],["НДС",e(x.vat||"Не указано")],
      ["Оплата",e(x.payment_terms_excerpt||"Не указано")],["Доставка",e(x.delivery_excerpt||"Не указана")]
    ];
    return '<article style="border:1px solid #e7ebf2;border-radius:10px;padding:12px;margin:10px 0">'+
      '<div style="font-weight:700">'+e(m.subject||"(без темы)")+'</div>'+
      '<div style="font-size:11px;color:#78849a;margin:4px 0">'+e(m.from||m.fromEmail)+' · '+e(m.date||"")+'</div>'+
      '<div style="font-size:12px;margin:6px 0">'+supplier+'</div>'+
      '<div style="font-size:11px;color:#8a6a2e;margin:4px 0">'+e(reviewLabel)+'</div>'+(request?'<div style="font-size:11px;color:#245a9b;margin:4px 0">'+request+'</div>':'')+
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
      const matched=items.filter(m=>m.supplierName).length, linked=items.filter(m=>m.requestId).length;
      out.innerHTML='<div style="font-size:11px;color:#78849a;margin:8px 0">Синхронизировано писем: '+items.length+' · распознано поставщиков: '+matched+' · привязано к заявкам: '+linked+'</div>'+
        (items.map(renderInboxMessage).join("")||"Новых входящих писем за последние 30 дней не найдено.");
    } catch(e) { if(out)out.textContent=e.message; }
    finally {if(b){b.disabled=false;b.textContent="Проверить входящие";}}
  }

  function insertSupplierRequest(){
    const c=window.snabproGetCompany?.()||{};
    const address=c.address||"АДРЕС ДОСТАВКИ НЕ УКАЗАН — заполните в карточке предприятия";
    const lines=[
      "Здравствуйте!",
      "",
      "Просим подготовить коммерческое предложение на следующие позиции:",
      "",
      "[Укажите материал, марку/характеристики, толщину/размер, количество и единицы измерения]",
      "",
      "Просим в ответе указать:",
      "1. Цену за единицу и общую стоимость по каждой позиции.",
      "2. Наличие и доступное количество.",
      "3. Срок отгрузки / изготовления.",
      "4. Стоимость доставки до нашего адреса отдельной строкой и срок доставки.",
      "5. Условия оплаты и размер предоплаты.",
      "6. НДС: включён в цену или нет.",
      "7. Срок действия коммерческого предложения.",
      "",
      "Адрес доставки: "+address,
      c.delivery_notes?"Особенности доставки/разгрузки: "+c.delivery_notes:"",
      "",
      "Наше предприятие: "+(c.name||""),
      c.contact_person?"Контактное лицо: "+c.contact_person:"",
      c.phone?"Телефон: "+c.phone:"",
      c.email?"Email: "+c.email:"",
      c.inn?"ИНН: "+c.inn:"",
      "",
      "Будем благодарны за полный расчёт с доставкой до указанного адреса.",
      "",
      "С уважением,",
      c.name||"Отдел закупок"
    ].filter(Boolean);
    $("gmailSubject").value="Запрос коммерческого предложения";
    $("gmailText").value=lines.join("\n");
    $("gmailSendStatus").textContent= c.address ? "Шаблон заполнен реквизитами предприятия. Добавьте позиции и проверьте адрес доставки." : "Внимание: адрес доставки не заполнен. Укажите его в карточке предприятия перед отправкой.";
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
      const meta=window.snabproCurrentDraftMeta||{};
      const result=await call("send",{to,subject:subject||"Запрос коммерческого предложения",text:textBody,requestId:meta.requestId||null,subjectToken:meta.subjectToken||null});
      if(out)out.textContent="Письмо успешно отправлено на "+to+".";
      if(meta.draftId){const drafts=JSON.parse(localStorage.getItem("sp_email_drafts")||"[]");const d=drafts.find(x=>x.id===meta.draftId);if(d)d.status="Отправлено";localStorage.setItem("sp_email_drafts",JSON.stringify(drafts));window.snabproMarkDraftSent?.(meta.draftId);window.snabproCurrentDraftMeta=null;}
      if(typeof showToast==="function")showToast("Письмо отправлено.");
    } catch(e) { if(out)out.textContent="Не удалось отправить: "+e.message; }
    finally {if(b){b.disabled=false;b.textContent="Отправить письмо";}}
  }
  window.snabproComposeEmail = function(draft){
    window.snabproCurrentDraftMeta={requestId:draft.requestId||null,subjectToken:draft.subjectToken||null,draftId:draft.id||null};
    $("gmailTo").value=draft.to||"";
    $("gmailSubject").value=draft.subject||"Запрос коммерческого предложения";
    $("gmailText").value=draft.body||"";
    $("gmailSendStatus").textContent="Письмо подготовлено из заявки. Проверьте адресата и текст, затем нажмите «Отправить письмо».";
    $("accountBtn")?.click();
    $("gmailTo")?.scrollIntoView({behavior:"smooth",block:"center"});
  };
  function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  document.addEventListener("DOMContentLoaded",()=>{
    $("gmailConnect")?.addEventListener("click",connect);
    $("gmailInbox")?.addEventListener("click",inbox);
    $("gmailSend")?.addEventListener("click",sendMail);
    $("gmailSupplierTemplate")?.addEventListener("click",insertSupplierRequest);
    $("accountBtn")?.addEventListener("click",()=>setTimeout(status,250));
    const params=new URLSearchParams(location.search);
    if(params.get("gmail")==="connected"){history.replaceState({}, "", location.pathname);setTimeout(()=>{status();if(typeof showToast==="function")showToast("Gmail успешно подключён.");},500);}
    if(params.get("gmail")==="denied"||params.get("gmail")==="error"){if(statusEl())statusEl().textContent="Google не завершил подключение. Попробуйте ещё раз.";}
  });
})();