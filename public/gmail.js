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
  async function inbox() {
    const out=$("gmailInboxList"), b=$("gmailInbox");
    try {
      if(b){b.disabled=true;b.textContent="Проверяем…";}
      const d=await call("inbox");
      out.innerHTML=(d.messages||[]).map(m=>'<div style="border-top:1px solid #e7ebf2;padding:8px 0"><b>'+escapeHtml(m.subject||"(без темы)")+'</b><br>'+escapeHtml(m.from)+'<br><span style="color:#78849a">'+escapeHtml(m.date)+' · '+escapeHtml(m.snippet)+'</span></div>').join("") || "Новых писем за последние 30 дней не найдено.";
    } catch(e) { out.textContent=e.message; }
    finally {if(b){b.disabled=false;b.textContent="Проверить входящие";}}
  }
  function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  document.addEventListener("DOMContentLoaded",()=>{
    $("gmailConnect")?.addEventListener("click",connect);
    $("gmailInbox")?.addEventListener("click",inbox);
    $("accountBtn")?.addEventListener("click",()=>setTimeout(status,250));
    const params=new URLSearchParams(location.search);
    if(params.get("gmail")==="connected"){history.replaceState({}, "", location.pathname);setTimeout(()=>{status();if(typeof showToast==="function")showToast("Gmail успешно подключён.");},500);}
    if(params.get("gmail")==="denied"||params.get("gmail")==="error"){if(statusEl())statusEl().textContent="Google не завершил подключение. Попробуйте ещё раз.";}
  });
})();