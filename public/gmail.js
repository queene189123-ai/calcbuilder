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
  async function processFile(messageId,filename){
    const client=window.snabproClient;
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw new Error("Сначала войдите в СнабПро.");
    const response=await fetch("https://tdewylpxanviyhdwdnci.supabase.co/functions/v1/gmail-attachment-reader-v2",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":window.SNABPRO_CONFIG.supabaseKey},
      body:JSON.stringify({companyId:companyId(),messageId,filename})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Ошибка обработки вложения.");
    return result;
  }
  async function status() {
    if (!companyId()) { if(statusEl()) statusEl().textContent="Сначала войдите и выберите предприятие."; return; }
    try {
      const d=await call("status");
      if(statusEl()) statusEl().textContent=d.connected ? "Подключён: "+d.connection.gmail_address+" · автообновление каждые 10 минут" : "Gmail не подключён. Подключите рабочий ящик предприятия.";
      if(d.connected){
        const inboxData=await inbox(),monitor=inboxData?.monitor;
        if(statusEl()&&monitor?.last_checked_at){
          const checked=new Date(monitor.last_checked_at).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
          statusEl().textContent="Подключён: "+d.connection.gmail_address+" · автопроверка каждые 10 минут · проверено "+checked+(monitor.status==="error"?" · ошибка: "+(monitor.last_error||"см. журнал"):"");
        }else if(statusEl())statusEl().textContent="Подключён: "+d.connection.gmail_address+" · автопроверка каждые 10 минут · ожидаем первую проверку";
      }
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
    const attachments=(m.attachments||[]).map(a=>{const ext=String(a.filename||"").toLowerCase().split(".").pop();return e(a.filename)+(["pdf","xlsx","xls","docx"].includes(ext)?' <button type="button" data-process-file="'+e(m.gmailMessageId||m.gmail_message_id||m.id)+'" data-file-name="'+e(a.filename)+'">Извлечь данные</button>':"")}).join(" ");
    const supplier=m.supplierName ? "Поставщик: "+e(m.supplierName) : "Поставщик не сопоставлен — проверьте email в карточке поставщика";
    const request=m.requestTitle ? "Заявка: "+e(m.requestTitle) : "";
    const reviewLabel=m.requestId ? "Связано с закупкой · нужна проверка" : m.supplierName ? "Поставщик найден · нужна проверка" : "Не сопоставлено с поставщиком";
    const fields=[
      ["Цена",prices],["Срок поставки",x.lead_time_days!=null?e(x.lead_time_days)+" дн.":"Не распознан"],
      ["Наличие",e(x.availability||"Не указано")],["НДС",e(x.vat||"Не указано")],
      ["Оплата",e(x.payment_terms_excerpt||"Не указано")],["Доставка",e(x.delivery_excerpt||"Не указана")]
    ];
    const defaultVat=x.vat==="С НДС"?"yes":x.vat==="Без НДС"?"no":"";
    const defaultCurrency=(x.price_candidates||[])[0]?.currency||"RUB";
    const quoteForm=m.requestId&&m.supplierName&&(m.requestItems||[]).length?'<div style="margin-top:10px;padding:10px;background:#f5f7fc;border-radius:8px"><b>Добавить в сравнение КП</b><select data-q-item style="width:100%;padding:8px;margin:6px 0">'+m.requestItems.map(i=>'<option value="'+e(i.id)+'">'+e(i.description)+' · '+e(i.quantity)+' '+e(i.unit)+'</option>').join("")+'</select><select data-q-currency style="width:100%;padding:8px;margin:4px 0"><option value="RUB" '+(defaultCurrency==="RUB"?"selected":"")+'>RUB · ₽</option><option value="USD" '+(defaultCurrency==="USD"?"selected":"")+'>USD · $</option><option value="EUR" '+(defaultCurrency==="EUR"?"selected":"")+'>EUR · €</option></select><select data-q-vat style="width:100%;padding:8px;margin:4px 0"><option value="" '+(defaultVat===""?"selected":"")+'>НДС не указан</option><option value="yes" '+(defaultVat==="yes"?"selected":"")+'>НДС включён</option><option value="no" '+(defaultVat==="no"?"selected":"")+'>Без НДС</option><option value="top">НДС сверху (ставка уточняется)</option></select><input data-q-price type="number" min="0.01" step="0.01" placeholder="Цена за единицу" style="width:100%;padding:8px;margin:4px 0"><input data-q-delivery type="number" min="0" step="0.01" value="0" placeholder="Доставка" style="width:100%;padding:8px;margin:4px 0"><input data-q-lead type="number" min="0" value="'+e(x.lead_time_days||"")+'" placeholder="Срок поставки, дней" style="width:100%;padding:8px;margin:4px 0"><button type="button" data-save-quote="'+e(m.id)+'" style="width:100%;padding:9px;background:#315eea;color:white;border:0;border-radius:7px">Сохранить в сравнение КП</button></div>':"";
    return '<article style="border:1px solid #e7ebf2;border-radius:10px;padding:12px;margin:10px 0">'+
      '<div style="font-weight:700">'+e(m.subject||"(без темы)")+'</div>'+
      '<div style="font-size:11px;color:#78849a;margin:4px 0">'+e(m.from||m.fromEmail)+' · '+e(m.date||"")+'</div>'+
      '<div style="font-size:12px;margin:6px 0">'+supplier+'</div>'+
      '<div style="font-size:11px;color:#8a6a2e;margin:4px 0">'+e(reviewLabel)+'</div>'+(request?'<div style="font-size:11px;color:#245a9b;margin:4px 0">'+request+'</div>':'')+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">'+fields.map(f=>'<div><span style="color:#78849a">'+f[0]+':</span> <b>'+f[1]+'</b></div>').join("")+'</div>'+
      (attachments?'<div style="font-size:11px;margin-top:7px">Вложения: '+attachments+'</div>':"")+
      quoteForm+
      '<div style="font-size:10px;color:#8a6a2e;margin-top:8px">Предварительное извлечение · требуется проверка</div>'+
      '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:11px">Показать текст письма</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.5 inherit;max-height:220px;overflow:auto">'+e(m.bodyText||m.snippet||"Текст не найден")+'</pre></details></article>';
  }
  async function inbox() {
    const out=$("gmailInboxList"), b=$("gmailInbox");
    try {
      if(b){b.disabled=true;b.textContent="Синхронизируем…";}
      if(out)out.textContent="Загружаем письма, автоматически собранные системой…";
      const d=await call("saved_inbox"), items=d.messages||[];
      items.forEach(m=>{if(m.requestId&&m.fromEmail)window.snabproMarkReplyReceived?.(m.requestId,m.fromEmail);});
      const matched=items.filter(m=>m.supplierName).length, linked=items.filter(m=>m.requestId).length;
      out.innerHTML='<div style="font-size:11px;color:#78849a;margin:8px 0">Синхронизировано писем: '+items.length+' · распознано поставщиков: '+matched+' · привязано к заявкам: '+linked+'</div>'+
        (items.map(renderInboxMessage).join("")||"Новых входящих писем за последние 30 дней не найдено.");
      return d;
    } catch(e) { if(out)out.textContent=e.message; return null; }
    finally {if(b){b.disabled=false;b.textContent="Показать входящие";}}
  }

  async function syncNow() {
    const b=$("gmailSyncNow"), out=$("gmailInboxList");
    try {
      if(b){b.disabled=true;b.textContent="Синхронизируем…";}
      if(out)out.textContent="Повторно проверяем последние 30 писем и сохраняем только ответы поставщиков…";
      const result=await call("inbox",{force:true});
      await inbox();
      if(out)out.insertAdjacentHTML("afterbegin",'<div style="font-size:10px;color:#16856f;margin:6px 0">Синхронизация завершена · обработано писем: '+Number(result.synced||0)+'</div>');
    } catch(e) { if(out)out.textContent=e.message; }
    finally {if(b){b.disabled=false;b.textContent="Синхронизировать сейчас";}}
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
      if(out)out.textContent=result.warning ? "Письмо отправлено на "+to+". "+result.warning : "Письмо успешно отправлено на "+to+".";
      if(meta.draftId){const drafts=JSON.parse(localStorage.getItem("sp_email_drafts")||"[]");const d=drafts.find(x=>x.id===meta.draftId);if(d)d.status="Отправлено";localStorage.setItem("sp_email_drafts",JSON.stringify(drafts));window.snabproMarkDraftSent?.(meta.draftId);window.snabproCurrentDraftMeta=null;}
      if(typeof showToast==="function")showToast(result.warning||"Письмо отправлено.");
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
    $("gmailSyncNow")?.addEventListener("click",syncNow);
    $("gmailInboxList")?.addEventListener("click",async function(ev){
      const fileButton=ev.target.closest("[data-process-file]");
      if(fileButton){
        fileButton.disabled=true;fileButton.textContent="Обрабатываем…";
        try{
          const result=await processFile(fileButton.dataset.processFile,fileButton.dataset.fileName);
          const card=fileButton.closest("article");
          let panel=card.querySelector("[data-file-result]");
          if(!panel){panel=document.createElement("pre");panel.dataset.fileResult="1";panel.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;background:#f5f7fc;padding:10px;border-radius:8px;margin-top:8px;font-size:11px";fileButton.parentElement.appendChild(panel);}
          const prices=result.extracted?.price_candidates||[];
          panel.textContent="Документ сохранён · "+result.extractionStatus+"\\nЦены-кандидаты: "+(prices.map(x=>x.amount+" "+x.currency).join(", ")||"не найдены")+"\\n"+(result.extractedText||result.extractionError||"Текст не извлечён");
          fileButton.textContent=result.extractionStatus==="review"?"Извлечено · проверить":"Сохранено";
          if(typeof window.renderUploadedDocuments==="function") await window.renderUploadedDocuments();
        }catch(error){fileButton.disabled=false;fileButton.textContent="Повторить";showToast?.(error.message);}
        return;
      }
      const button=ev.target.closest("[data-save-quote]");
      if(!button)return;
      const card=button.closest("article");
      const price=Number(card.querySelector("[data-q-price]")?.value);
      if(!price||price<=0){showToast?.("Укажи цену");return;}
      button.disabled=true;
      try{
        await call("save_quote",{messageId:button.dataset.saveQuote,requestItemId:card.querySelector("[data-q-item]").value,unitPrice:price,currency:card.querySelector("[data-q-currency]").value,vatLabel:card.querySelector("[data-q-vat]").value,deliveryCost:card.querySelector("[data-q-delivery]").value,leadTimeDays:card.querySelector("[data-q-lead]").value});
        button.textContent="Сохранено";button.style.background="#18845b";
        try{await window.snabproRefreshQuotes?.();showToast?.("КП сохранено и загружено в сравнение");}
        catch(refreshError){showToast?.("КП сохранено. Обновите страницу, чтобы загрузить сравнение.");}
      }catch(error){button.disabled=false;button.textContent="Сохранить в сравнение КП";showToast?.(error.message);}
    });
    $("gmailSend")?.addEventListener("click",sendMail);
    $("gmailSupplierTemplate")?.addEventListener("click",insertSupplierRequest);
    $("accountBtn")?.addEventListener("click",()=>setTimeout(status,250));
    const params=new URLSearchParams(location.search);
    if(params.get("gmail")==="connected"){history.replaceState({}, "", location.pathname);setTimeout(()=>{status();if(typeof showToast==="function")showToast("Gmail успешно подключён.");},500);}
    if(params.get("gmail")==="denied"||params.get("gmail")==="error"){if(statusEl())statusEl().textContent="Google не завершил подключение. Попробуйте ещё раз.";}
  });
})();