(function(){
  const cfg = window.SNABPRO_CONFIG;
  const client = window.supabase && cfg ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;
  const $ = id => document.getElementById(id);
  let currentUser = null;
  let activeCompany = null;
  window.snabproClient = client;
  window.snabproGetCompany = () => activeCompany;
  const panel = () => $('accountPanel');
  function note(message, bad=false) {
    const el=$('accountNote');
    if (!el) return;
    el.textContent=message;
    el.className='account-note'+(bad?' error':'');
  }
  function showPanel() {
    if (!client) { note('Не удалось загрузить модуль подключения. Обновите страницу.',true); }
    panel().classList.add('open');
    refresh();
  }
  function hidePanel(){ panel().classList.remove('open'); }
  async function refresh(){
    if(!client) return;
    const {data:{session}}=await client.auth.getSession();
    currentUser=session?.user||null;
    $('authForms').style.display=currentUser?'none':'block';
    $('companyArea').style.display=currentUser?'block':'none';
    $('authUser').textContent=currentUser?currentUser.email:'';
    $('accountBtn').textContent=currentUser?'Кабинет':'Войти';
    if(currentUser) await loadCompanies();
    else { activeCompany=null; $('companyList').innerHTML=''; window.snabproResetWorkspace?.(); }
  }
  async function loadCompanies(){
    const {data,error}=await client.from('companies').select('id,name,created_at,contact_person,phone,email,address,inn,delivery_notes').order('created_at',{ascending:true});
    if(error){note('Не удалось загрузить предприятия: '+error.message,true);return;}
    const list=$('companyList');
    list.innerHTML='';
    if(!data?.length){
      list.innerHTML='<div class="account-empty">Пока нет зарегистрированного предприятия. Создайте рабочее пространство ниже.</div>';
      activeCompany=null;window.snabproResetWorkspace?.();return;
    }
    data.forEach(company=>{
      const row=document.createElement('button');
      row.type='button';row.className='company-choice'+(activeCompany?.id===company.id?' selected':'');
      row.textContent=company.name;
      row.addEventListener('click',()=>{activeCompany=company;localStorage.setItem('sp_company_id',company.id);localStorage.setItem('sp_company_name',company.name);loadCompanies();note('Выбрано предприятие: '+company.name);});
      list.appendChild(row);
    });
    const saved=localStorage.getItem('sp_company_id');
    activeCompany=data.find(c=>c.id===saved)||data[0];
    if(activeCompany){localStorage.setItem('sp_company_id',activeCompany.id);localStorage.setItem('sp_company_name',activeCompany.name);fillCompanyProfile();await window.snabproLoadWorkspace?.(activeCompany);}
    [...list.children].forEach((el,i)=>el.classList.toggle('selected',data[i]?.id===activeCompany?.id));
    note(activeCompany?'Рабочее пространство подключено. Данные предприятия будут храниться отдельно.':'');
  }

  function fillCompanyProfile(){
    if(!activeCompany) return;
    const fields={companyContact:activeCompany.contact_person,companyPhone:activeCompany.phone,companyEmail:activeCompany.email,companyAddress:activeCompany.address,companyInn:activeCompany.inn,companyDeliveryNotes:activeCompany.delivery_notes};
    Object.entries(fields).forEach(([id,value])=>{const el=$(id);if(el)el.value=value||'';});
    const title=$('companyProfileTitle');if(title)title.textContent=activeCompany.name;
  }
  async function saveCompanyProfile(){
    if(!activeCompany){note('Сначала выберите предприятие.',true);return;}
    const b=$('companyProfileSave');
    const payload={
      contact_person:$('companyContact').value.trim()||null,
      phone:$('companyPhone').value.trim()||null,
      email:$('companyEmail').value.trim()||null,
      address:$('companyAddress').value.trim()||null,
      inn:$('companyInn').value.trim()||null,
      delivery_notes:$('companyDeliveryNotes').value.trim()||null,
      updated_at:new Date().toISOString()
    };
    if(payload.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)){note('Проверьте email предприятия.',true);return;}
    try{
      if(b){b.disabled=true;b.textContent='Сохраняем…';}
      const {data,error}=await client.from('companies').update(payload).eq('id',activeCompany.id).select('id,name,contact_person,phone,email,address,inn,delivery_notes').single();
      if(error)throw error;
      activeCompany={...activeCompany,...data};
      fillCompanyProfile();
      note('Реквизиты предприятия сохранены. Они будут подставляться в запросы поставщикам.');
    }catch(e){note(e.message||'Не удалось сохранить реквизиты.',true);}
    finally{if(b){b.disabled=false;b.textContent='Сохранить реквизиты';}}
  }
  async function submitAuth(mode){
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    if(!email||password.length<8){note('Введите email и пароль не короче 8 символов.',true);return;}
    $('authSubmit').disabled=true;
    try{
      if(mode==='signup'){
        const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
        if(error) throw error;
        if(data.session){note('Аккаунт создан. Теперь зарегистрируйте предприятие.');await refresh();}
        else note('Письмо для подтверждения отправлено на '+email+'. Подтвердите адрес и затем войдите.');
      }else{
        const {error}=await client.auth.signInWithPassword({email,password});
        if(error) throw error;
        note('Вход выполнен.');await refresh();
      }
    }catch(e){note(e.message||'Ошибка авторизации.',true);}
    finally{$('authSubmit').disabled=false;}
  }
  async function createCompany(){
    const name=$('companyName').value.trim();
    if(!name){note('Введите название предприятия.',true);return;}
    const {data:{user}}=await client.auth.getUser();
    if(!user){note('Сессия истекла. Войдите снова.',true);return;}
    $('companyCreate').disabled=true;
    try{
      const {data:rows,error}=await client.rpc('create_company_for_current_user',{p_name:name});
      if(error) throw error;
      const data=Array.isArray(rows)?rows[0]:rows;
      if(!data?.id) throw new Error('Предприятие не было создано. Повторите попытку.');
      activeCompany=data;
      localStorage.setItem('sp_company_id',data.id);
      localStorage.setItem('sp_company_name',data.name);
      $('companyName').value='';
      await loadCompanies();
      note('Предприятие «'+data.name+'» зарегистрировано. Владелец назначен автоматически.');
    }catch(e){note(e.message||'Не удалось создать предприятие.',true);}
    finally{$('companyCreate').disabled=false;}
  }
  async function signOut(){
    const {error}=await client.auth.signOut();
    if(error){note(error.message,true);return;}
    localStorage.removeItem('sp_company_id');localStorage.removeItem('sp_company_name');
    activeCompany=null;await refresh();note('Вы вышли из аккаунта.');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('accountBtn').addEventListener('click',showPanel);
    $('accountClose').addEventListener('click',hidePanel);
    panel().addEventListener('click',e=>{if(e.target===panel())hidePanel();});
    $('authSignup').addEventListener('click',()=>{ $('authMode').textContent='Регистрация';$('authSubmit').dataset.mode='signup';$('authSignup').classList.add('active');$('authLogin').classList.remove('active');});
    $('authLogin').addEventListener('click',()=>{ $('authMode').textContent='Вход';$('authSubmit').dataset.mode='login';$('authLogin').classList.add('active');$('authSignup').classList.remove('active');});
    $('authSubmit').addEventListener('click',()=>submitAuth($('authSubmit').dataset.mode||'login'));
    $('companyCreate').addEventListener('click',createCompany);\n    $('companyProfileSave').addEventListener('click',saveCompanyProfile);
    $('signOutBtn').addEventListener('click',signOut);
    if(client) client.auth.onAuthStateChange(()=>{setTimeout(refresh,0);});
    refresh();
  });
})();
