const $=id=>document.getElementById(id),eh=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dm=[{id:1,name:'Нержавеющая сталь',spec:'AISI 304 · лист 1500 × 3000 × 1,5 мм',cat:'Металл',unit:'лист',price:'8 500 ₽',sup:3},{id:2,name:'АБС-пластик',spec:'Лист 3000 × 1500 × 3 мм',cat:'Пластик',unit:'лист',price:'2 050 ₽',sup:2},{id:3,name:'Труба нержавеющая 25 мм',spec:'Ø 25 мм · стенка 1,5 мм',cat:'Трубы',unit:'метр',price:'180 ₽',sup:3},{id:4,name:'Труба нержавеющая 50 мм',spec:'Ø 50 мм · стенка 1,5 мм',cat:'Трубы',unit:'метр',price:'320 ₽',sup:2},{id:5,name:'Утеплитель',spec:'Для бойлеров · толщина 30 мм',cat:'Изоляция',unit:'упаковка',price:'680 ₽',sup:2},{id:6,name:'Крышка бойлера',spec:'По чертежу · нержавейка',cat:'Комплектующие',unit:'шт.',price:'460 ₽',sup:2},{id:7,name:'Пластиковая заглушка',spec:'Ø 25 мм · чёрная',cat:'Комплектующие',unit:'шт.',price:'18 ₽',sup:4}];
const ds=[{id:1,name:'МеталлСнаб Север',contact:'Иван · +7 921 000-12-34',email:'sales@metallsnab.example',region:'Санкт-Петербург',cats:['Металл','Трубы'],rating:'4,9',lead:'2 дня'},{id:2,name:'ПластКомплект',contact:'Мария · +7 921 000-22-45',email:'order@plast.example',region:'Санкт-Петербург',cats:['Пластик','Комплектующие'],rating:'4,8',lead:'3 дня'},{id:3,name:'СтальТрейд',contact:'Алексей · +7 921 000-33-56',email:'info@steel.example',region:'Ленинградская область',cats:['Металл','Трубы'],rating:'4,6',lead:'5–7 дней'},{id:4,name:'ТеплоПром',contact:'Отдел продаж · +7 812 000-44-67',email:'sale@teplo.example',region:'Санкт-Петербург',cats:['Изоляция','Комплектующие'],rating:'4,7',lead:'4 дня'}];
const dp=[{id:1,name:'Нержавейка AISI 304 · ноябрь',items:'Нержавеющая сталь · 100 листов',vendors:3,replies:2,status:'Сравнение предложений',date:'03.11.2026'},{id:2,name:'Трубы для партии бойлеров',items:'Труба 25 мм · 300 м; труба 50 мм · 200 м',vendors:3,replies:1,status:'Ожидаем ответы',date:'02.11.2026'}];
function get(k,d){try{return JSON.parse(localStorage.getItem(k))||JSON.parse(JSON.stringify(d))}catch(e){return JSON.parse(JSON.stringify(d))}}
let materials=get('sp_materials',dm),suppliers=get('sp_suppliers',ds),purchases=get('sp_purchases',dp);
let materialFolders=get('sp_material_folders',['Металл','Пластик','Трубы','Комплектующие','Изоляция']);
materials.forEach(m=>{if(!m.folder)m.folder=m.cat||'Без папки'});
let activeMaterialFolder='';
let workspaceSyncTimer=null;
function save(){
 localStorage.setItem('sp_materials',JSON.stringify(materials));
 localStorage.setItem('sp_suppliers',JSON.stringify(suppliers));
 localStorage.setItem('sp_purchases',JSON.stringify(purchases));
 localStorage.setItem('sp_material_folders',JSON.stringify(materialFolders));
 if(window.snabproWorkspaceReady){
  clearTimeout(workspaceSyncTimer);
  workspaceSyncTimer=setTimeout(()=>syncWorkspace().catch(e=>toast('Ошибка сохранения в рабочее пространство: '+(e.message||'ошибка'))),500);
 }
}
async function syncWorkspace(){
 const client=window.snabproClient,company=window.snabproGetCompany?.();
 if(!client||!company||!window.snabproWorkspaceReady)return;
 const {data:{user},error:userError}=await client.auth.getUser();
 if(userError||!user)throw new Error('Сессия не найдена');
 const folderNames=[...new Set([...materialFolders,...materials.map(m=>m.folder||'Без папки')])];
 materialFolders=folderNames;
 for(let i=0;i<folderNames.length;i++){const {error}=await client.from('material_folders').upsert({company_id:company.id,name:folderNames[i],sort_order:i},{onConflict:'company_id,name'});if(error)throw error;}
 for(const m of materials){
  const price=String(m.price??'').replace(/[^0-9,.-]/g,'').replace(',','.');
  const row={company_id:company.id,name:m.name,category:m.cat||null,folder_name:m.folder||m.cat||'Без папки',specification:{text:m.spec||''},unit:m.unit||'шт.',last_price:price&&Number.isFinite(Number(price))?Number(price):null,created_by:user.id};
  if(m.dbId)row.id=m.dbId;
  const {data,error}=await client.from('materials').upsert(row).select('id').single();
  if(error)throw error;m.dbId=data.id;
 }
 for(const v of suppliers){
  const row={company_id:company.id,name:v.name,email:v.email||null,phone:null,contact:v.contact||null,categories:v.cats||[],region:v.region||null,notes:null,rating:v.rating||null,lead_time:v.lead||null};
  if(v.dbId)row.id=v.dbId;
  const {data,error}=await client.from('suppliers').upsert(row).select('id').single();
  if(error)throw error;v.dbId=data.id;
 }
 for(const p of purchases){
  const status=p.status==='Завершена'?'completed':p.status==='Отменена'?'cancelled':'collecting';
  const row={company_id:company.id,title:p.name,status,created_by:user.id,details:{items:p.items||'',vendors:p.vendors||0,replies:p.replies||0,date:p.date||''}};
  if(p.dbId)row.id=p.dbId;
  const {data,error}=await client.from('purchase_requests').upsert(row).select('id').single();
  if(error)throw error;p.dbId=data.id;
  if(Array.isArray(p.requestItems)&&p.requestItems.length){
   const {data:existingItems,error:existingError}=await client.from('purchase_request_items').select('id,description,specification,quantity,unit').eq('company_id',company.id).eq('request_id',p.dbId);
   if(existingError)throw existingError;
   const unmatched=[...(existingItems||[])];
   const itemRows=p.requestItems.map(x=>{
    let existing=x.dbId?unmatched.find(r=>r.id===x.dbId):null;
    if(!existing)existing=unmatched.find(r=>r.description===x.name&&Number(r.quantity)===Number(x.qty)&&r.unit===x.unit&&(r.specification?.text||'')===(x.spec||''));
    if(existing){const idx=unmatched.findIndex(r=>r.id===existing.id);if(idx>=0)unmatched.splice(idx,1);x.dbId=existing.id;}
    const row={company_id:company.id,request_id:p.dbId,material_id:materials.find(m=>m.id===x.id)?.dbId||null,description:x.name,specification:{text:x.spec||'',category:x.cat||''},quantity:x.qty,unit:x.unit};
    if(x.dbId)row.id=x.dbId;
    return row;
   });
   const {data:savedItems,error:itemError}=await client.from('purchase_request_items').upsert(itemRows).select('id');
   if(itemError)throw itemError;
   p.requestItems.forEach((x,i)=>x.dbId=savedItems[i]?.id||x.dbId);
  }
  if(p.draftBatch){
   const batchDrafts=emailDrafts.filter(d=>d.batchId===p.draftBatch);
   for(const d of batchDrafts){
    const supplier=suppliers.find(s=>s.id===d.supplierLocalId);
    const link={company_id:company.id,request_id:p.dbId,supplier_id:supplier?.dbId||null,supplier_email:d.to,subject_token:d.subjectToken,status:d.status==='Получен ответ'?'replied':d.status==='Отправлено'?'sent':'draft',email_subject:d.subject||null,email_body:d.body||null,drafted_at:d.createdAt||new Date().toISOString(),replied_at:d.status==='Получен ответ'?(d.repliedAt||new Date().toISOString()):null};
    const {error:linkError}=await client.from('purchase_request_suppliers').upsert(link,{onConflict:'company_id,subject_token'});
    if(linkError)throw linkError;
    d.requestId=p.dbId;
   }
  }
 }
 localStorage.setItem('sp_materials',JSON.stringify(materials));
 localStorage.setItem('sp_suppliers',JSON.stringify(suppliers));
 localStorage.setItem('sp_purchases',JSON.stringify(purchases));
 localStorage.setItem('sp_email_drafts',JSON.stringify(emailDrafts));
}
window.snabproEnsureWorkspaceSaved=async()=>{clearTimeout(workspaceSyncTimer);await syncWorkspace();return true};

document.addEventListener('click',e=>{const b=e.target.closest('[data-review-document]');if(b){b.disabled=true;openDocumentReview(b.dataset.reviewDocument).catch(err=>toast(err.message)).finally(()=>{b.disabled=false;});}});
function toast(t){$('toast').textContent=t;$('toast').style.display='block';clearTimeout(window.tt);window.tt=setTimeout(()=>$('toast').style.display='none',3500)}
function go(p){document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===p));document.querySelectorAll('.nav button[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));$('crumb').textContent=({dashboard:'Обзор',materials:'Мои материалы',suppliers:'Поставщики',purchases:'Закупки',quotes:'КП и сравнение',market:'Поиск поставщиков',saving:'Оптимизация расходов',report:'Отчёт руководителю',history:'История цен'})[p];renderAll();window.scrollTo(0,0)}
document.querySelectorAll('.nav button[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));
function modal(title,body,fn){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modal').classList.add('open');$('modalSave')?.addEventListener('click',()=>{if(fn())closeModal()})}
function closeModal(){$('modal').classList.remove('open')}
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
function editMaterial(id){const m=materials.find(x=>x.id===id);if(!m)return;const cats=['Металл','Пластик','Трубы','Комплектующие','Изоляция','Другое'];modal('Изменить материал','<div class="formgrid"><div class="field full"><label>Название</label><input id="emn" value="'+eh(m.name)+'"></div><div class="field"><label>Категория для поставщиков</label><select id="emc">'+cats.map(c=>'<option '+(m.cat===c?'selected':'')+'>'+c+'</option>').join('')+'</select></div><div class="field"><label>Папка</label><select id="emf">'+folderOptions(m.folder)+'</select></div><div class="field full"><label>Характеристики</label><input id="ems" value="'+eh(m.spec||'')+'"></div><div class="field"><label>Единица закупки</label><input id="emu" value="'+eh(m.unit||'шт.')+'"></div><div class="field"><label>Последняя цена</label><input id="emp" value="'+eh(m.price||'')+'"></div></div><div class="modalfoot"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn primary" id="modalSave">Сохранить изменения</button></div>',()=>{const name=$('emn').value.trim();if(!name){toast('Введите название материала');return false}m.name=name;m.cat=$('emc').value;m.folder=$('emf').value||'Без папки';m.spec=$('ems').value.trim();m.unit=$('emu').value.trim()||'шт.';m.price=$('emp').value.trim()||'—';save();renderAll();toast('Материал обновлён');return true})}
function openMaterial(){modal('Новая позиция справочника','<div class="formgrid"><div class="field"><label>Название</label><input id="mn" placeholder="Лист нержавейки"></div><div class="field"><label>Категория для поставщиков</label><select id="mc"><option>Металл</option><option>Пластик</option><option>Трубы</option><option>Комплектующие</option><option>Изоляция</option></select></div><div class="field"><label>Папка</label><select id="mf">'+folderOptions()+'</select></div><div class="field full"><label>Характеристики</label><input id="ms" placeholder="Марка, размеры, толщина, диаметр"></div><div class="field"><label>Единица закупки</label><input id="mu" placeholder="лист, метр, шт."></div><div class="field"><label>Последняя цена</label><input id="mp" placeholder="8500 ₽"></div></div><div class="modalfoot"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn primary" id="modalSave">Добавить</button></div>',()=>{let n=$('mn').value.trim();if(!n){toast('Введите название');return false}materials.push({id:Date.now(),name:n,cat:$('mc').value,folder:$('mf').value||'Без папки',spec:$('ms').value,unit:$('mu').value||'шт.',price:$('mp').value||'—',sup:0});save();renderAll();toast('Позиция добавлена');return true})}
function openSupplier(){modal('Новый поставщик','<div class="formgrid"><div class="field"><label>Компания</label><input id="sn" placeholder="ООО Поставщик"></div><div class="field"><label>Категория</label><select id="sc"><option>Металл</option><option>Пластик</option><option>Трубы</option><option>Комплектующие</option><option>Изоляция</option></select></div><div class="field"><label>Email</label><input id="se" placeholder="sales@company.ru"></div><div class="field"><label>Контакт</label><input id="st" placeholder="Телефон / контактное лицо"></div><div class="field full"><label>Регион</label><input id="sr" value="Санкт-Петербург"></div></div><div class="modalfoot"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn primary" id="modalSave">Сохранить</button></div>',()=>{let n=$('sn').value.trim();if(!n){toast('Введите название компании');return false}suppliers.push({id:Date.now(),name:n,email:$('se').value,contact:$('st').value,region:$('sr').value,cats:[$('sc').value],rating:'Новый',lead:'Неизвестно'});save();renderAll();toast('Поставщик добавлен');return true})}
function folderOptions(selected=''){return [...new Set([...materialFolders,...materials.map(m=>m.folder||'Без папки')])].map(n=>'<option value="'+eh(n)+'" '+(n===selected?'selected':'')+'>'+eh(n)+'</option>').join('')}
function createMaterialFolder(){modal('Новая папка','<div class="field"><label>Название папки</label><input id="newFolderName" maxlength="80" placeholder="Например: Нержавеющая сталь"></div><div class="modalfoot"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn primary" id="modalSave">Создать папку</button></div>',()=>{const name=$('newFolderName').value.trim();if(!name){toast('Введите название папки');return false}if(materialFolders.some(x=>x.toLowerCase()===name.toLowerCase())){toast('Такая папка уже есть');return false}materialFolders.push(name);save();renderAll();toast('Папка создана');return true})}
function manageMaterialFolders(){const opts=materialFolders.map(n=>'<option value="'+eh(n)+'">'+eh(n)+'</option>').join('');modal('Управление папками','<div class="field"><label>Папка</label><select id="manageFolder">'+opts+'</select></div><div class="field"><label>Новое название</label><input id="renameFolderName" maxlength="80" placeholder="Новое название"></div><div class="modalfoot folder-actions"><button class="btn" onclick="deleteSelectedFolder()">Удалить пустую папку</button><button class="btn primary" id="modalSave">Переименовать</button></div>',()=>{const old=$('manageFolder').value,name=$('renameFolderName').value.trim();if(!name){toast('Введите новое название');return false}if(materialFolders.some(x=>x.toLowerCase()===name.toLowerCase()&&x!==old)){toast('Папка с таким названием уже существует');return false}materialFolders=materialFolders.map(x=>x===old?name:x);materials.forEach(m=>{if(m.folder===old)m.folder=name});const client=window.snabproClient,company=window.snabproGetCompany?.();if(client&&company&&window.snabproWorkspaceReady)client.from('material_folders').update({name}).eq('company_id',company.id).eq('name',old).then(({error})=>{if(error)toast('Ошибка переименования папки в облаке: '+error.message)});save();renderAll();toast('Папка переименована');return true})}
async function deleteSelectedFolder(){const name=$('manageFolder')?.value;if(!name)return;if(materials.some(m=>m.folder===name)){toast('В папке есть материалы. Сначала переместите их в другую папку.');return}materialFolders=materialFolders.filter(x=>x!==name);const client=window.snabproClient,company=window.snabproGetCompany?.();if(client&&company&&window.snabproWorkspaceReady){const {error}=await client.from('material_folders').delete().eq('company_id',company.id).eq('name',name);if(error){toast('Не удалось удалить папку: '+error.message);return}}save();closeModal();renderAll();toast('Папка удалена')}
function setMaterialFolder(id,name){const m=materials.find(x=>x.id===id);if(!m)return;m.folder=name;save();renderMaterials();toast('Папка материала обновлена')}
function renderMaterials(){let q=($('matSearch')?.value||'').toLowerCase(),c=$('matCategory')?.value||'',folder=$('matFolderFilter')?.value||'',a=materials.filter(m=>(!c||m.cat===c)&&(!folder||m.folder===folder)&&(m.name+' '+m.spec).toLowerCase().includes(q));$('materialsBody').innerHTML=a.map(m=>'<tr><td><input class="check" type="checkbox" '+(m.selected?'checked':'')+' onchange="setSelected('+m.id+',this.checked)"></td><td><span class="materialicon">▤</span><span class="materialname">'+eh(m.name)+'</span></td><td class="muted">'+eh(m.spec)+'</td><td><select class="folder-inline" aria-label="Папка материала" onchange="setMaterialFolder('+m.id+',this.value)">'+folderOptions(m.folder)+'</select></td><td>'+eh(m.unit)+'</td><td class="strong">'+eh(m.price)+'</td><td>'+m.sup+'</td><td><button class="btn material-edit" onclick="editMaterial('+m.id+')">Изменить</button></td></tr>').join('')||'<tr><td colspan="7" class="empty">Материалы не найдены</td></tr>';$('selectedCount').textContent=materials.filter(m=>m.selected).length;const filter=$('matFolderFilter');if(filter){const v=filter.value;filter.innerHTML='<option value="">Все папки</option>'+folderOptions();filter.value=v}}
function setSelected(id,v){let m=materials.find(x=>x.id===id);m.selected=v;save();renderMaterials()}
function selectAll(){materials.forEach(m=>m.selected=true);save();renderMaterials()}
function clearSelection(){materials.forEach(m=>m.selected=false);save();renderMaterials()}
function renderSuppliers(){let q=($('supSearch')?.value||'').toLowerCase(),a=suppliers.filter(s=>(s.name+' '+s.cats.join(' ')).toLowerCase().includes(q));$('supplierGrid').innerHTML=a.map(s=>'<div class="suppliercard"><div style="display:flex;justify-content:space-between"><h4>'+eh(s.name)+'</h4><span class="pill">'+eh(s.rating)+'</span></div><div class="suppliermeta">'+eh(s.region)+'<br>'+eh(s.contact)+'<br>'+eh(s.email)+'<br>Обычный срок: '+eh(s.lead)+'</div>'+s.cats.map(c=>'<span class="tag">'+eh(c)+'</span>').join('')+'</div>').join('')||'<div class="empty">Поставщики не найдены</div>'}
function renderPurchases(){let f=$('purchaseFilter')?.value||'',a=purchases.filter(p=>!f||p.status===f);$('purchasesBody').innerHTML=a.map(p=>'<tr><td class="strong">'+eh(p.name)+'</td><td>'+eh(p.items)+'</td><td>'+eh(p.date)+'</td><td>'+p.replies+' / '+p.vendors+'</td><td><span class="pill '+(['Завершена','Получены ответы','Есть ответы','Есть КП'].includes(p.status)?'green':['Ожидаем ответы','Частично отправлено'].includes(p.status)?'orange':'')+'">'+eh(p.status)+'</span></td><td><button class="btn small" onclick="showPurchase('+p.id+')">Открыть</button></td></tr>').join('')||'<tr><td colspan="6" class="empty">Закупок пока нет</td></tr>'}
function buildQuoteComparisons(){
 const groups=new Map();
 (quoteOffers||[]).forEach(q=>{
  const currency=['RUB','USD','EUR'].includes(q.currency)?q.currency:'RUB';
  const qty=Number(q.qty),price=Number(q.unitPrice),delivery=Math.max(0,Number(q.delivery)||0);
  if(!q.material||!(qty>0)||!(price>0))return;
  const vat=String(q.vat||'Не указано'),key=String(q.material)+'||'+currency+'||'+qty+'||'+String(q.unit||'')+'||'+vat;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({...q,currency,total:qty*price+delivery});
 });
 return [...groups.values()].filter(a=>a.length>=2).map(a=>{
  a.sort((x,y)=>x.total-y.total);
  return {material:a[0].material,currency:a[0].currency,best:a[0],worst:a[a.length-1],saving:Math.max(0,a[a.length-1].total-a[0].total),count:a.length};
 });
}
function buildQuoteRecommendations(){
 return buildQuoteComparisons().filter(x=>x.saving>0).map(x=>[
  'Сравнить предложения: '+x.material,
  'Самая низкая полная стоимость — '+x.best.supplier+'. Разница с самым дорогим вариантом: '+money(x.saving,x.currency)+'. Перед выбором проверьте сроки, наличие и спецификацию.',
  money(x.saving,x.currency)
 ]);
}
function recHtml(a){return a.map(r=>'<div class="recommend"><div><h4>'+eh(r[0])+'</h4><p>'+eh(r[1])+'</p></div><div class="saving">'+eh(r[2])+'</div></div>').join('')}
function renderDashboard(){
 $('statPurchases').textContent=purchases.filter(p=>p.status!=='Завершена').length;
 $('statSuppliers').textContent=suppliers.length;
 const offerCount=new Set((quoteOffers||[]).map(q=>q.dbQuoteId||q.id)).size;
 const comparisons=buildQuoteComparisons(),currencies=[...new Set((quoteOffers||[]).map(q=>q.currency||'RUB'))];
 const total=currencies.length<=1&&comparisons.length?comparisons.reduce((sum,x)=>sum+x.saving,0):null;
 if($('statOffers'))$('statOffers').textContent=offerCount;
 if($('statSaving'))$('statSaving').textContent=total===null?(comparisons.length?'Разные валюты':'—'):money(total,currencies[0]||'RUB');
 if($('savingPotential'))$('savingPotential').textContent=total===null?(comparisons.length?'Разные валюты':'—'):money(total,currencies[0]||'RUB');
 if($('savingOptions'))$('savingOptions').textContent=comparisons.length;
 if($('savingSuppliers'))$('savingSuppliers').textContent=new Set((quoteOffers||[]).map(q=>q.supplier)).size;
 if($('savingRisks'))$('savingRisks').textContent=comparisons.filter(x=>Number(x.best.lead)>5).length;
 $('dashPurchases').innerHTML=purchases.slice(0,4).map(p=>'<tr><td class="strong">'+eh(p.name)+'</td><td>'+p.vendors+'</td><td><span class="pill">'+eh(p.status)+'</span></td><td>'+eh(p.date)+'</td></tr>').join('')||'<tr><td colspan="4" class="empty">Создайте первую закупку</td></tr>';
 const recommendations=buildQuoteRecommendations();
 $('dashRecs').innerHTML=recommendations.length?recHtml(recommendations.slice(0,3)):'<div class="empty">Для расчёта экономии добавьте минимум два предложения по одной позиции.</div>';
 if($('recommendations'))$('recommendations').innerHTML=recommendations.length?recHtml(recommendations):'<div class="empty">Пока нет сопоставимых предложений. Экономия появится после получения двух и более КП на одну позицию.</div>';
 if($('attentionList'))$('attentionList').innerHTML=offerCount
  ?'<div class="activity"><i class="dot"></i><div><b>Получено коммерческих предложений: '+offerCount+'</b><small>Сопоставимых позиций для сравнения: '+comparisons.length+'</small></div></div>'+
   (comparisons.length?'<div class="activity"><i class="dot"></i><div><b>Есть варианты для экономии</b><small>Потенциальная разница по сопоставимым предложениям: '+(total===null?'разные валюты':money(total,currencies[0]||'RUB'))+'</small></div></div>':'<div class="activity"><i class="dot" style="background:#e5a13a"></i><div><b>Пока недостаточно КП для сравнения</b><small>Добавьте ещё одно предложение на ту же позицию.</small></div></div>')
  :'<div class="empty">Новых событий пока нет. Создайте закупку и соберите первые предложения поставщиков.</div>';
}
function renderAll(){renderMaterials();renderSuppliers();renderPurchases();renderDashboard();renderQuotes();renderPriceHistory()}
function openPurchase(){
 const items=materials;
 const groups=[...new Set([...materialFolders,...items.map(m=>m.folder||'Без папки')])].map(name=>({name,items:items.filter(m=>(m.folder||'Без папки')===name)})).filter(g=>g.items.length);
 let rows=groups.map(g=>'<details class="purchase-folder"><summary><span>'+eh(g.name)+'</span><small>'+g.items.length+' поз.</small></summary><div class="purchase-folder-items">'+g.items.map(m=>'<div class="purchase-material"><label class="purchase-material-name"><input type="checkbox" class="pcheck" data-id="'+m.id+'" '+(m.selected?'checked':'')+'> <span>'+eh(m.name)+'</span><small>'+eh(m.spec)+'</small></label><div class="purchase-material-meta"><label>Количество ('+eh(m.unit)+')<input type="number" min="1" value="'+(m.cat==='Трубы'?300:m.cat==='Металл'?50:100)+'" id="qty'+m.id+'"></label><small>Поставщики: '+(suppliers.filter(s=>s.cats.includes(m.cat)).map(s=>eh(s.name)).join(', ')||'не назначены')+'</small></div></div>').join('')+'</div></details>').join('');
 modal('Сформировать закупку','<div class="notice">Откройте нужную папку и отметьте позиции. Можно выбрать материалы из нескольких папок.</div><div class="formgrid"><div class="field full"><label>Что закупаем / для чего нужна закупка</label><input id="pt" placeholder="Например: комплектующие для партии бойлеров № 24"></div><div class="field full"><details class="folder-picker"><summary class="folder-picker-trigger">Выбрать материалы <span>Разложено по папкам⌄</span></summary><div class="folder-picker-list">'+rows+'</div></details></div><div class="field full"><label>Комментарий поставщикам</label><textarea id="pc" rows="2" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:9px" placeholder="Срок, доставка, оплата, требования…"></textarea></div></div><div class="notice">После создания появятся черновики писем. Проверьте их и нажмите «Отправить» в Gmail.</div><div class="modalfoot"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn primary" id="modalSave">Создать закупку и письма</button></div>',()=>{
  let ids=[...document.querySelectorAll('.pcheck:checked')].map(x=>+x.dataset.id),sel=materials.filter(m=>ids.includes(m.id));
  if(!sel.length){toast('Сначала отметьте материалы, которые нужно закупить');return false}
  const quantities=sel.map(m=>({id:m.id,name:m.name,spec:m.spec,qty:Math.max(1,Number($('qty'+m.id).value)||1),unit:m.unit,cat:m.cat}));
  const vendorMap=new Map();
  sel.forEach(m=>suppliers.filter(s=>s.cats.includes(m.cat)).forEach(v=>{
   const key=(v.email||'').trim().toLowerCase()||'supplier:'+v.id;
   if(!vendorMap.has(key))vendorMap.set(key,{suppliers:[],items:[]});
   const group=vendorMap.get(key);
   if(!group.suppliers.some(x=>x.id===v.id))group.suppliers.push(v);
   const item=quantities.find(q=>q.id===m.id);
   if(item&&!group.items.some(x=>x.id===item.id))group.items.push(item);
  }));
  const batchId=Date.now(),comment=$('pc').value.trim(),purpose=$('pt').value.trim(),title=purpose||'Закупка · '+sel.slice(0,2).map(m=>m.name).join(', '),company=window.snabproGetCompany?.()||{};
  const drafts=[...vendorMap.values()].map(({suppliers:groupSuppliers,items})=>{
   const supplier=groupSuppliers[0];
   const subjectToken='SP-'+batchId.toString(36).toUpperCase()+'-'+String(supplier.id);
   const subject=title+' ['+subjectToken+']';
   const body='Добрый день!\\n\\nПросим подготовить коммерческое предложение на следующие позиции:\\n\\n'+items.map(x=>'• '+x.name+' — '+x.spec+'; количество: '+x.qty+' '+x.unit).join('\\n')+'\\n\\nНазначение закупки: '+(purpose||'не указано')+'\\n\\nПросим указать:\\n1. Цену за единицу и общую стоимость;\\n2. Наличие и возможный объём поставки;\\n3. Срок поставки;\\n4. Стоимость и условия доставки;\\n5. НДС и условия оплаты;\\n6. Срок действия предложения.'+(comment?'\\n\\nКомментарий: '+comment:'')+'\\n\\nАдрес доставки: '+(company.address||'НЕ УКАЗАН — заполните реквизиты предприятия')+(company.delivery_notes?'\\nОсобенности разгрузки/доставки: '+company.delivery_notes:'')+(company.name?'\\nПредприятие: '+company.name:'')+(company.contact_person?'\\nКонтактное лицо: '+company.contact_person:'')+(company.phone?'\\nТелефон: '+company.phone:'')+(company.email?'\\nEmail: '+company.email:'')+(company.inn?'\\nИНН: '+company.inn:'')+'\\n\\nБудем благодарны за ответ на это письмо.\\n\\nС уважением, '+(company.contact_person||'отдел снабжения');
   return {id:batchId+'-'+supplier.id,batchId,supplierLocalId:groupSuppliers.length===1?supplier.id:null,supplierIds:groupSuppliers.map(x=>x.id),subjectToken,to:supplier.email||'',supplier:groupSuppliers.map(x=>x.name).join(' / '),subject,body,items,createdAt:new Date().toISOString(),status:'Черновик'};
  });
  emailDrafts=emailDrafts.concat(drafts);localStorage.setItem('sp_email_drafts',JSON.stringify(emailDrafts));
  purchases.unshift({id:batchId,name:title,items:quantities.map(x=>x.name+' · '+x.qty+' '+x.unit).join('; '),vendors:vendorMap.size,replies:0,status:'Черновики готовы',date:new Date().toLocaleDateString('ru-RU'),draftBatch:batchId,comment,purpose,requestItems:quantities,requestSuppliers:drafts.map(d=>({supplierLocalId:d.supplierLocalId,email:d.to,subjectToken:d.subjectToken}))});
  save();renderAll();toast('Закупка создана. Подготовлено писем: '+drafts.length);go('purchases');setTimeout(()=>showRequestPreview(),0);return true;
 });
}
function showPurchase(id){
 const p=purchases.find(x=>x.id===id);if(!p)return;
 const drafts=emailDrafts.filter(d=>p.dbId?(d.requestId===p.dbId||d.batchId===p.dbId):(d.batchId===p.draftBatch));
 const offers=quoteOffers.filter(q=>p.name&&String(q.material||'').includes(p.name));
 const itemRows=(p.requestItems||[]).map(x=>'<tr><td>'+eh(x.name)+'</td><td>'+eh(x.spec||'—')+'</td><td>'+eh(x.qty)+'</td><td>'+eh(x.unit)+'</td></tr>').join('');
 const draftRows=drafts.map(d=>'<tr><td>'+eh(d.supplier||d.to)+'</td><td>'+eh(d.to)+'</td><td><span class="pill '+(['Отправлено','Получен ответ'].includes(d.status)?'green':'orange')+'">'+eh(d.status||'Черновик')+'</span></td></tr>').join('');
 const quoteRows=offers.map(q=>'<tr><td>'+eh(q.supplier)+'</td><td>'+money(q.unitPrice,q.currency)+' / '+eh(q.unit)+'</td><td>'+eh(q.qty)+' '+eh(q.unit)+'</td><td>'+money(q.delivery,q.currency)+'</td><td class="strong">'+money(q.qty*q.unitPrice+q.delivery,q.currency)+'</td></tr>').join('');
 const body='<div class="notice '+(p.dbId?'':'warn')+'">'+(p.dbId?'Рабочая закупка · данные загружены из базы предприятия.':'Демонстрационная закупка. Для реальной работы войдите в аккаунт и выберите предприятие.')+'</div>'+
 '<div class="cards" style="grid-template-columns:repeat(2,1fr)"><div class="stat"><div class="statline">Поставщики</div><strong>'+Number(p.vendors||drafts.length||0)+'</strong></div><div class="stat"><div class="statline">Отправлено</div><strong>'+Number(p.sent??drafts.filter(d=>['Отправлено','Получен ответ'].includes(d.status)).length)+'</strong></div><div class="stat"><div class="statline">Получено ответов</div><strong>'+Number(p.replies??drafts.filter(d=>d.status==='Получен ответ').length)+'</strong></div><div class="stat"><div class="statline">Статус</div><strong style="font-size:13px">'+eh(p.status)+'</strong></div></div>'+
 '<div class="panel"><div class="panelhead"><h3>Позиции закупки</h3></div><div class="tablewrap"><table><thead><tr><th>Материал</th><th>Характеристики</th><th>Количество</th><th>Ед.</th></tr></thead><tbody>'+(itemRows||'<tr><td colspan="4" class="empty">'+eh(p.items||'Позиции не указаны')+'</td></tr>')+'</tbody></table></div></div>'+
 '<div class="panel" style="margin-top:12px"><div class="panelhead"><h3>Запросы поставщикам</h3><span class="pill">'+drafts.length+' писем</span></div><div class="tablewrap"><table><thead><tr><th>Поставщик</th><th>Email</th><th>Статус</th></tr></thead><tbody>'+(draftRows||'<tr><td colspan="3" class="empty">Черновики запросов не найдены</td></tr>')+'</tbody></table></div></div>'+
 '<div class="panel" style="margin-top:12px"><div class="panelhead"><h3>Полученные коммерческие предложения</h3><span class="pill">'+offers.length+' позиций КП</span></div><div class="tablewrap"><table><thead><tr><th>Поставщик</th><th>Цена</th><th>Количество</th><th>Доставка</th><th>Итого</th></tr></thead><tbody>'+(quoteRows||'<tr><td colspan="5" class="empty">КП по этой закупке пока не получены</td></tr>')+'</tbody></table></div></div>'+
 '<div class="modalfoot">'+(drafts.length?'<button class="btn primary" onclick="closeModal();showRequestPreview(\''+(p.dbId||p.draftBatch||'')+'\')">Открыть письма поставщикам</button>':'')+'<button class="btn" onclick="closeModal();go(\'quotes\')">Открыть сравнение КП</button><button class="btn" onclick="closeModal()">Закрыть</button>'+(p.status!=='Завершена'?'<button class="btn" id="modalSave">Завершить закупку</button>':'')+'</div>';
 modal(p.name,body,()=>{p.status='Завершена';save();renderAll();toast('Закупка завершена');return true});
}
function marketSearch(){
 const material=$('marketMaterial').value.trim().toLowerCase(),region=$('marketRegion').value.trim().toLowerCase(),qty=$('marketQty').value,priority=$('marketPriority').value;
 const matches=suppliers.filter(s=>{
  const categories=(s.cats||[]).join(' ').toLowerCase(),name=String(s.name||'').toLowerCase(),supplierRegion=String(s.region||'').toLowerCase();
  const categoryMatch=!material||categories.includes(material)||name.includes(material)||material.split(/[ ,]+/).some(word=>word.length>2&&categories.includes(word));
  const regionMatch=!region||supplierRegion.includes(region);
  return categoryMatch&&regionMatch;
 });
 const cards=matches.map(s=>'<div class="suppliercard"><h4>'+eh(s.name)+'</h4><div class="suppliermeta">'+(s.email?'Email: '+eh(s.email)+'<br>':'')+(s.region?'Регион: '+eh(s.region)+'<br>':'')+'Категории: '+eh((s.cats||[]).join(', ')||'Не указаны')+'<br>Срок: '+eh(s.lead||'Не указан')+'</div><span class="pill green">В базе предприятия</span></div>').join('');
 const searchQuery='поставщик '+$('marketMaterial').value.trim()+' '+$('marketRegion').value.trim();
 const googleUrl='https://www.google.com/search?q='+encodeURIComponent(searchQuery);
 const yandexUrl='https://yandex.ru/search/?text='+encodeURIComponent(searchQuery);
 const external='<div class="notice" style="margin-top:12px">Автоматический внешний каталог пока не подключён. Чтобы найти новых кандидатов без платного API, откройте поиск: <a href="'+googleUrl+'" target="_blank" rel="noopener noreferrer">Google</a> · <a href="'+yandexUrl+'" target="_blank" rel="noopener noreferrer">Яндекс</a>. Проверяйте компанию, реквизиты и условия самостоятельно.</div>';
 $('marketResults').innerHTML='<div class="panel"><div class="panelhead"><h3>Поставщики из вашей базы</h3><span class="pill">'+matches.length+' найдено</span></div><div class="panelbody"><p class="muted" style="font-size:10px">Фильтр: '+eh(material||'любая категория')+' · '+eh(region||'любой регион')+' · объём: '+eh(qty||'не указан')+' · приоритет: '+eh(priority||'не указан')+'</p>'+(cards?'<div class="suppliergrid">'+cards+'</div>':'<div class="empty">Совпадений в базе нет. Добавьте поставщика в раздел «Поставщики» или измените фильтры.</div>')+external+'</div></div>';
}
function runAnalysis(){const recommendations=buildQuoteRecommendations();$('recommendations').innerHTML=recommendations.length?recHtml(recommendations):'<div class="empty">Недостаточно сопоставимых КП для анализа.</div>';toast(recommendations.length?'Анализ завершён по реальным предложениям поставщиков.':'Добавьте ещё КП по тем же позициям для расчёта экономии.')}
function openPlans(){const chosen=localStorage.getItem('sp_plan')||'';modal('Тарифы СнабПро','<div class="notice">Сейчас это демонстрация интерфейса. Оплата банковской картой будет подключена после выбора хостинга и запуска коммерческой версии. Никакие данные карты здесь не запрашиваются.</div><div class="suppliergrid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="suppliercard"><span class="pill">СТАРТ</span><h4 style="font-size:19px;margin-top:12px">4 900 ₽ <small class="muted">/ месяц</small></h4><div class="suppliermeta">До 3 пользователей<br>База поставщиков<br>Создание закупок<br>Сравнение предложений</div><button class="btn '+(chosen==='Старт'?'primary':'')+'" style="margin-top:14px;width:100%" onclick="choosePlan(\'Старт\')">'+(chosen==='Старт'?'Выбран':'Выбрать тариф')+'</button></div><div class="suppliercard" style="border-color:#4268e8"><span class="pill green">БИЗНЕС</span><h4 style="font-size:19px;margin-top:12px">9 900 ₽ <small class="muted">/ месяц</small></h4><div class="suppliermeta">До 10 пользователей<br>Все функции тарифа Старт<br>Аналитика экономии<br>История цен и поставщиков<br>Приоритетная поддержка</div><button class="btn primary" style="margin-top:14px;width:100%" onclick="choosePlan(\'Бизнес\')">'+(chosen==='Бизнес'?'Выбран':'Выбрать тариф')+'</button></div></div><div class="notice warn" style="margin-top:12px">Статус оплаты: отключена в демоверсии. После подключения эквайринга здесь появится защищённая оплата картой и управление подпиской.</div><div class="modalfoot"><button class="btn" onclick="closeModal()">Закрыть</button></div>',()=>true)}
function choosePlan(name){localStorage.setItem('sp_plan',name);closeModal();toast('Выбран тариф «'+name+'». Оплата будет подключена после запуска коммерческой версии.');}
function init(){renderAll()}
const demoQuotes=[
{id:101,material:'Труба нержавеющая Ø25 мм',supplier:'МеталлСнаб Север',unitPrice:180,qty:300,delivery:2000,vat:'Без НДС',lead:2,unit:'м',spec:'AISI 304 · Ø25 · стенка 1,5 мм',status:'Получено',source:'Образец КП №1'},
{id:102,material:'Труба нержавеющая Ø25 мм',supplier:'СтальТрейд',unitPrice:165,qty:300,delivery:4000,vat:'НДС включён',lead:5,unit:'м',spec:'AISI 304 · Ø25 · стенка 1,5 мм',status:'Получено',source:'Образец КП №2'},
{id:103,material:'Труба нержавеющая Ø25 мм',supplier:'БалтикПром',unitPrice:175,qty:300,delivery:0,vat:'НДС включён',lead:3,unit:'м',spec:'AISI 304 · Ø25 · стенка 1,5 мм',status:'Получено',source:'Образец КП №3'},
{id:104,material:'Нержавеющая сталь AISI 304 · лист',supplier:'МеталлСнаб Север',unitPrice:8500,qty:50,delivery:2500,vat:'Без НДС',lead:2,unit:'лист',spec:'AISI 304 · 1500×3000×1,5 мм',status:'Получено',source:'Образец КП'},
{id:105,material:'Нержавеющая сталь AISI 304 · лист',supplier:'СтальТрейд',unitPrice:7900,qty:50,delivery:5000,vat:'НДС включён',lead:7,unit:'лист',spec:'AISI 304 · 1500×3000×1,5 мм',status:'Получено',source:'Образец КП'},
{id:106,material:'АБС-пластик · лист 3 мм',supplier:'ПластКомплект',unitPrice:2050,qty:100,delivery:1500,vat:'НДС включён',lead:3,unit:'лист',spec:'АБС · 3000×1500×3 мм',status:'Получено',source:'Образец КП'}
];
let quoteOffers=get('sp_quotes',demoQuotes);
let emailDrafts=get('sp_email_drafts',[]);
function normalizeDrafts(list){
 const groups=new Map();
 for(const d of list){
  const key=String(d.batchId||'')+'|'+(String(d.to||'').trim().toLowerCase()||'supplier:'+String(d.supplierLocalId||d.id));
  if(!groups.has(key)){groups.set(key,{...d,items:[...(d.items||[])],supplierNames:[d.supplier].filter(Boolean),supplierIds:d.supplierLocalId?[d.supplierLocalId]:[]});continue;}
  const g=groups.get(key);
  (d.items||[]).forEach(x=>{if(!g.items.some(y=>y.id===x.id))g.items.push(x);});
  if(d.supplier&&!g.supplierNames.includes(d.supplier))g.supplierNames.push(d.supplier);
  if(d.supplierLocalId&&!g.supplierIds.includes(d.supplierLocalId))g.supplierIds.push(d.supplierLocalId);
  if(d.status!=='Отправлено')g.status='Черновик';
 }
 for(const g of groups.values()){
  g.supplier=g.supplierNames.join(' / ');
  g.supplierLocalId=g.supplierIds.length===1?g.supplierIds[0]:null;
  const marker='\n\nПросим указать:',tail=String(g.body||'');
  const suffix=tail.includes(marker)?tail.slice(tail.indexOf(marker)):'';
  g.body='Добрый день!\n\nПросим подготовить коммерческое предложение на следующие позиции:\n\n'+g.items.map(x=>'• '+x.name+' — '+x.spec+'; количество: '+x.qty+' '+x.unit).join('\n')+suffix;
  delete g.supplierNames;delete g.supplierIds;
 }
 return [...groups.values()];
}
emailDrafts=normalizeDrafts(emailDrafts);
localStorage.setItem('sp_email_drafts',JSON.stringify(emailDrafts));
window.snabproMarkReplyReceived=(requestId,email)=>{
 const target=String(email||'').trim().toLowerCase();
 const d=emailDrafts.find(x=>(x.requestId||x.batchId)===requestId&&String(x.to||'').trim().toLowerCase()===target);
 if(!d)return;
 d.status='Получен ответ';d.repliedAt=d.repliedAt||new Date().toISOString();
 const batch=emailDrafts.filter(x=>(x.requestId||x.batchId)===requestId||x.batchId===requestId);
 const p=purchases.find(x=>x.dbId===requestId||x.draftBatch===requestId);
 if(p){p.vendors=batch.length;p.sent=batch.filter(x=>['Отправлено','Получен ответ'].includes(x.status)).length;p.replies=batch.filter(x=>x.status==='Получен ответ').length;p.status=p.replies===p.vendors?'Получены ответы':'Есть ответы';}
 localStorage.setItem('sp_email_drafts',JSON.stringify(emailDrafts));
 if(p){save();renderPurchases();renderDashboard();}
};
window.snabproMarkDraftSent=draftId=>{
 const d=emailDrafts.find(x=>x.id===draftId);if(!d)return;
 d.status='Отправлено';
 const requestId=d.requestId||d.batchId;
 const batch=emailDrafts.filter(x=>(x.requestId||x.batchId)===requestId||x.batchId===requestId);
 const p=purchases.find(x=>x.dbId===requestId||x.draftBatch===requestId);
 if(p){p.vendors=batch.length;p.sent=batch.filter(x=>['Отправлено','Получен ответ'].includes(x.status)).length;p.replies=batch.filter(x=>x.status==='Получен ответ').length;p.status=p.replies===p.vendors?'Получены ответы':p.replies?'Есть ответы':p.sent===p.vendors?'Ожидаем ответы':p.sent?'Частично отправлено':'Черновики готовы';}
 localStorage.setItem('sp_email_drafts',JSON.stringify(emailDrafts));
 if(p){save();renderPurchases();renderDashboard();}
};
const money=(n,currency='RUB')=>{const code=['RUB','USD','EUR'].includes(currency)?currency:'RUB';return new Intl.NumberFormat('ru-RU',{style:'currency',currency:code,maximumFractionDigits:code==='RUB'?0:2}).format(Number(n)||0)};
function quotesForSelected(){let m=$('quoteMaterial')?.value||'Труба нержавеющая Ø25 мм';return quoteOffers.filter(q=>q.material===m)}
function syncQuoteMaterialOptions(preferFirst=false,replace=false){
 const select=$('quoteMaterial');if(!select)return;
 const current=select.value,labels=[...new Set(quoteOffers.map(q=>q.material).filter(Boolean))];
 if(replace)select.innerHTML='';
 const known=new Set([...select.options].map(o=>o.value));
 labels.forEach(label=>{if(!known.has(label)){const option=document.createElement('option');option.value=label;option.textContent=label;select.appendChild(option)}});
 if(!labels.length&&replace){const option=document.createElement('option');option.value='';option.textContent='Нет сохранённых КП';select.appendChild(option);}
 if(preferFirst&&labels.length)select.value=labels[0];
 else if(current&&[...select.options].some(o=>o.value===current))select.value=current;
}
async function loadCompanyQuotes(company){
 const client=window.snabproClient;if(!client||!company?.id)return;
 const [q,qi,ri,sr,pr]=await Promise.all([
  client.from('supplier_quotes').select('*').eq('company_id',company.id).order('created_at',{ascending:false}),
  client.from('quote_items').select('*').eq('company_id',company.id).order('created_at',{ascending:false}),
  client.from('purchase_request_items').select('id,request_id,description,specification,quantity,unit').eq('company_id',company.id),
  client.from('suppliers').select('id,name').eq('company_id',company.id),
  client.from('purchase_requests').select('id,title').eq('company_id',company.id)
 ]);
 if(q.error)throw q.error;if(qi.error)throw qi.error;if(ri.error)throw ri.error;if(sr.error)throw sr.error;if(pr.error)throw pr.error;
 const quoteById=new Map((q.data||[]).map(x=>[x.id,x]));
 const itemById=new Map((ri.data||[]).map(x=>[x.id,x]));
 const supplierById=new Map((sr.data||[]).map(x=>[x.id,x]));
 const requestById=new Map((pr.data||[]).map(x=>[x.id,x]));
 // Общая доставка распределяется между строками КП пропорционально стоимости товаров.
 // Распределяем копейки методом наибольших остатков, чтобы сумма долей точно совпадала с доставкой в КП.
 const itemsByQuote=new Map();
 (qi.data||[]).forEach(item=>{
  const requestItem=item.request_item_id?itemById.get(item.request_item_id):null;
  const qty=Number(item.quantity??requestItem?.quantity)||1;
  const lineTotal=(Number(item.unit_price)||0)*qty;
  if(!itemsByQuote.has(item.quote_id))itemsByQuote.set(item.quote_id,[]);
  itemsByQuote.get(item.quote_id).push({item,lineTotal});
 });
 const deliveryByItemId=new Map();
 itemsByQuote.forEach((rows,quoteId)=>{
  const quote=quoteById.get(quoteId),deliveryCents=Math.max(0,Math.round((Number(quote?.delivery_cost)||0)*100));
  const goodsTotal=rows.reduce((sum,row)=>sum+row.lineTotal,0);
  if(!goodsTotal||!deliveryCents){rows.forEach(row=>deliveryByItemId.set(row.item.id,0));return;}
  const shares=rows.map(row=>{
   const raw=deliveryCents*row.lineTotal/goodsTotal;
   const cents=Math.floor(raw);
   return {id:row.item.id,cents,fraction:raw-cents};
  });
  let remainder=deliveryCents-shares.reduce((sum,row)=>sum+row.cents,0);
  shares.slice().sort((a,b)=>b.fraction-a.fraction).forEach(row=>{if(remainder>0){const target=shares.find(x=>x.id===row.id);target.cents++;remainder--;}});
  shares.forEach(row=>deliveryByItemId.set(row.id,row.cents/100));
 });
 quoteOffers=(qi.data||[]).flatMap(item=>{
  const quote=quoteById.get(item.quote_id);if(!quote)return [];
  const requestItem=item.request_item_id?itemById.get(item.request_item_id):null;
  // Для привязанных строк используем каноническое наименование из заявки:
  // поставщики могут описывать один и тот же материал разными словами.
  const spec=requestItem?.specification?.text||item.specification?.text||'';
  const baseMaterial=String(requestItem?.description||item.description||'Позиция закупки')+(spec?' · '+spec:'');
  const requestTitle=requestById.get(requestItem?.request_id||quote.request_id)?.title;
  const material=baseMaterial+(requestTitle?' — заявка: '+requestTitle:'');
  const supplier=supplierById.get(quote.supplier_id);
  const qty=Number(item.quantity??requestItem?.quantity)||1;
  const deliveryShare=deliveryByItemId.get(item.id)||0;
  return [{id:item.id,dbQuoteId:quote.id,material,supplier:supplier?.name||'Поставщик',unitPrice:Number(item.unit_price)||0,qty,delivery:deliveryShare,vat:item.vat_included===true?'НДС включён':item.vat_included===false?(item.specification?.vat_label==='top'?'НДС сверху':'Без НДС'):'Не указано',lead:Number(item.specification?.lead_time_days)||Number(quote.lead_time_days)||0,unit:item.unit||requestItem?.unit||'шт.',spec:spec||'Характеристики не указаны',status:item.source_excerpt==='Ручной ввод'?'Добавлено вручную':'Получено из почты',source:item.source_excerpt||quote.notes||'Письмо поставщика',currency:quote.currency||'RUB',createdAt:item.created_at||quote.created_at||null}];
 });
 localStorage.setItem('sp_quotes',JSON.stringify(quoteOffers));
 syncQuoteMaterialOptions(true,true);renderQuotes();renderPriceHistory();renderDashboard();
}
window.snabproRefreshQuotes=async()=>{const company=window.snabproGetCompany?.();if(!company)throw new Error('Предприятие не выбрано');await loadCompanyQuotes(company);return quoteOffers.length};
function renderQuotes(){
 const arr=quotesForSelected(),body=$('quotesBody');if(!body)return;
 const currencies=[...new Set(arr.map(q=>q.currency||'RUB'))],quantities=[...new Set(arr.map(q=>String(q.qty)+' '+String(q.unit||'')))],vatTypes=[...new Set(arr.map(q=>q.vat||'Не указано'))];
 const vatKnown=vatTypes.length===1&&['НДС включён','Без НДС'].includes(vatTypes[0]);
 const comparable=currencies.length<=1&&quantities.length<=1&&vatKnown;
 const sorted=arr.map(q=>({...q,currency:q.currency||'RUB',total:q.qty*q.unitPrice+q.delivery})).sort((a,b)=>a.currency===b.currency?a.total-b.total:a.currency.localeCompare(b.currency));
 const best=comparable?sorted[0]:null,worst=comparable?sorted[sorted.length-1]:null;
 body.innerHTML=sorted.map((q,i)=>{const isBest=!!best&&i===0;return '<tr class="'+(isBest?'bestrow':'')+'"><td>'+eh(q.supplier)+'</td><td>'+money(q.unitPrice,q.currency)+' / '+eh(q.unit)+'</td><td>'+q.qty+' '+eh(q.unit)+'</td><td>'+money(q.delivery,q.currency)+'</td><td>'+eh(q.vat)+'</td><td>'+q.lead+' дн.</td><td class="strong">'+(vatKnown?money(q.total,q.currency):'Не рассчитано')+'</td><td><span class="pill '+(isBest?'green':'')+'">'+(isBest?'Самая низкая сумма':eh(q.status))+'</span></td></tr>'}).join('')||'<tr><td colspan="8" class="empty">Пока нет предложений для этой позиции. Добавьте КП.</td></tr>';
 $('quoteCount').textContent=new Set(quoteOffers.map(q=>q.dbQuoteId||q.id)).size;
 $('quoteQty').textContent=best?best.qty+' '+best.unit:arr.length?'Несопоставимые условия':'—';
 $('quoteBest').textContent=best?money(best.total,best.currency):arr.length?'Нужна сверка условий':'—';
 $('quoteSaving').textContent=best&&worst?money(worst.total-best.total,best.currency):'—';
 $('quoteVerdict').textContent=currencies.length>1?'Предложения указаны в разных валютах. Их нельзя корректно ранжировать без пересчёта в одну валюту.':quantities.length>1?'Различаются количество или единицы измерения. Сначала приведите предложения к одной партии.':vatTypes.length>1?'Различаются условия НДС ('+vatTypes.join(', ')+'). Сначала уточните сопоставимую цену.':arr.length&&!vatKnown?'Условия НДС не подтверждены или указано «НДС сверху» без ставки. Уточните налоговую составляющую у поставщика — до этого рейтинг полной стоимости не рассчитывается.':best?'Лучшее по полной стоимости: '+best.supplier+' — '+money(best.total,best.currency)+'. Срок: '+best.lead+' дн. Спецификация: '+best.spec+'. Перед выбором подтвердите наличие, документы и соответствие характеристик.':'Добавьте предложения, чтобы сравнить итоговую стоимость.';
 buildManagementReport();
}
function openQuoteImport(){
 const html='<div class="notice">Добавьте полученное предложение вручную. В рабочем аккаунте КП, поставщик и закупка сохраняются в облачной базе предприятия.</div>'+
 '<div class="formgrid">'+
 '<div class="field full"><label>Материал / позиция</label><input id="qiMaterial" placeholder="Например, Лист Ст3 1500×3000×2 мм"></div>'+
 '<div class="field"><label>Поставщик</label><input id="qiSupplier" placeholder="Название компании"></div>'+
 '<div class="field"><label>Email поставщика (необязательно)</label><input id="qiEmail" type="email" placeholder="sales@company.ru"></div>'+
 '<div class="field"><label>Цена за единицу</label><input id="qiPrice" type="number" min="0.0001" step="0.01" placeholder="175"></div>'+
 '<div class="field"><label>Валюта</label><select id="qiCurrency"><option value="RUB">RUB · ₽</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option></select></div>'+
 '<div class="field"><label>Количество</label><input id="qiQty" type="number" min="0.0001" step="0.0001" value="1"></div>'+
 '<div class="field"><label>Единица</label><input id="qiUnit" value="шт." placeholder="лист, кг, м, шт."></div>'+
 '<div class="field"><label>Доставка</label><input id="qiDelivery" type="number" min="0" step="0.01" value="0"></div>'+
 '<div class="field"><label>Срок, дней</label><input id="qiLead" type="number" min="0" step="1" value="3"></div>'+
 '<div class="field"><label>НДС</label><select id="qiVat"><option value="">Не указано</option><option value="yes">НДС включён</option><option value="no">Без НДС</option><option value="top">НДС сверху</option></select></div>'+
 '<div class="field full"><label>Характеристики / примечание</label><input id="qiSpec" placeholder="Марка, размеры, толщина, стандарт"></div>'+
 '</div><div class="modalfoot"><button class="btn" type="button" onclick="closeModal()">Отмена</button><button class="btn primary" type="button" id="modalSave">Сохранить КП</button></div>';
 modal('Добавить коммерческое предложение',html,()=>false);
 $('modalSave').addEventListener('click',async()=>{
  const supplier=$('qiSupplier').value.trim(),email=$('qiEmail').value.trim(),material=$('qiMaterial').value.trim(),spec=$('qiSpec').value.trim();
  const price=Number($('qiPrice').value),qty=Number($('qiQty').value),delivery=Number($('qiDelivery').value||0),lead=Number($('qiLead').value||0);
  const unit=$('qiUnit').value.trim(),currency=$('qiCurrency').value,vat=$('qiVat').value;
  if(!supplier||!material||!(price>0)||!(qty>0)||!unit||delivery<0||lead<0||!['RUB','USD','EUR'].includes(currency)){
   toast('Проверьте поставщика, материал, количество, единицу и цену');return;
  }
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Проверьте email поставщика');return;}
  const btn=$('modalSave');btn.disabled=true;btn.textContent='Сохраняем…';
  const client=window.snabproClient,company=window.snabproGetCompany?.();
  if(client&&company?.id){
   if(!window.snabproWorkspaceReady){btn.disabled=false;btn.textContent='Сохранить КП';toast('Дождитесь загрузки данных предприятия');return;}
   try{
    const {data,error}=await client.rpc('create_manual_quote',{
     p_company_id:company.id,p_supplier_name:supplier,p_supplier_email:email||null,
     p_material:material,p_specification:spec,p_quantity:qty,p_unit:unit,
     p_unit_price:price,p_delivery_cost:delivery,p_currency:currency,p_vat:vat,
     p_lead_time_days:lead
    });
    if(error)throw error;
    closeModal();
   }catch(error){btn.disabled=false;btn.textContent='Сохранить КП';toast('Не удалось сохранить КП: '+(error.message||'ошибка'));return;}
   try{await window.snabproLoadWorkspace?.(company);toast('КП сохранено в базе предприятия и добавлено в сравнение');}
   catch(refreshError){toast('КП сохранено. Не удалось обновить экран — обновите страницу.');}
   return;
  }
  quoteOffers.push({id:Date.now(),material,supplier,unitPrice:price,qty,delivery,vat:vat==='yes'?'НДС включён':vat==='no'?'Без НДС':vat==='top'?'НДС сверху':'Не указано',lead,unit,spec:spec||'Характеристики не подтверждены',status:'Добавлено вручную',source:'Ручной ввод',currency,createdAt:new Date().toISOString()});
  localStorage.setItem('sp_quotes',JSON.stringify(quoteOffers));syncQuoteMaterialOptions();renderQuotes();renderPriceHistory();renderDashboard();
  closeModal();toast('КП добавлено в локальное сравнение');
 });
}
let previewDrafts=[];
async function composeDraft(i){const d=previewDrafts[i];if(!d){toast('Черновик не найден');return}try{await window.snabproEnsureWorkspaceSaved?.()}catch(e){toast('Не удалось сохранить заявку: '+e.message);return}if(!d.requestId&&d.subjectToken){const client=window.snabproClient,company=window.snabproGetCompany?.();if(client&&company){const {data,error}=await client.from('purchase_request_suppliers').select('request_id').eq('company_id',company.id).eq('subject_token',d.subjectToken).maybeSingle();if(error){toast('Не удалось связать письмо с заявкой: '+error.message);return}d.requestId=data?.request_id||null;}}if(!window.snabproComposeEmail){toast('Почтовый модуль не загружен. Обновите страницу.');return}closeModal();window.snabproComposeEmail(d)}
function showRequestPreview(requestId){
 const batch=requestId||(emailDrafts.length?emailDrafts[emailDrafts.length-1].batchId:null);
 let drafts=batch?emailDrafts.filter(d=>String(d.requestId||d.batchId)===String(batch)||String(d.batchId)===String(batch)):[];
 if(!drafts.length){
  const items=materials.filter(m=>m.selected).slice(0,4);
  const vendors=[...new Map(items.flatMap(m=>suppliers.filter(v=>v.cats.includes(m.cat))).map(v=>[v.id,v])).values()];
  drafts=vendors.map(v=>({to:v.email||'',supplier:v.name,subject:'Запрос коммерческого предложения',body:'Добрый день! Просим предоставить коммерческое предложение на:\n'+items.filter(m=>v.cats.includes(m.cat)).map(m=>'• '+m.name+' — '+m.spec).join('\n')+'\n\nУкажите цену, наличие, срок поставки, доставку, НДС и условия оплаты.'}));
 }
 if(!drafts.length){toast('Сначала создайте закупку и выберите позиции');return}
 previewDrafts=drafts;
 const cards=drafts.map((d,i)=>{
  const href=d.to?'mailto:'+encodeURIComponent(d.to)+'?subject='+encodeURIComponent(d.subject)+'&body='+encodeURIComponent(d.body):'';
  return '<div class="panel" style="padding:12px;margin:10px 0"><div class="panelhead"><h3>'+eh(d.supplier)+'</h3><span class="pill">'+(d.status==='Отправлено'?'Отправлено':'Черновик')+'</span></div><p class="muted">'+(d.to?eh(d.to):'Email поставщика не указан — добавьте его в карточке поставщика')+'</p><div class="notice" style="white-space:pre-wrap">'+eh(d.body)+'</div><div class="modalfoot">'+(d.to?'<button class="btn primary" onclick="composeDraft('+i+')">Открыть в Gmail СнабПро</button>':'<button class="btn" disabled>Нужен email поставщика</button>')+(href?'<a class="btn" href="'+href+'">Открыть в почтовой программе ↗</a>':'')+'<button class="btn" onclick="copyDraft('+i+')">Копировать текст</button></div></div>';
 }).join('');
 modal('Запросы поставщикам','<div class="notice">Письма сформированы по каждой компании с учётом только тех материалов, которые она поставляет. Нажмите «Открыть письмо в почте» — адресат, тема и текст подставятся автоматически. Письмо отправится только после вашего нажатия «Отправить» в почтовой программе.</div>'+cards+'<div class="modalfoot"><button class="btn" onclick="closeModal()">Закрыть</button></div>',()=>true);
}
function copyDraft(i){
 const batch=emailDrafts.length?emailDrafts[emailDrafts.length-1].batchId:null;
 const drafts=batch?emailDrafts.filter(d=>d.batchId===batch):[];
 const d=drafts[i];if(!d){toast('Черновик не найден');return}
 const text='Кому: '+d.to+'\nТема: '+d.subject+'\n\n'+d.body;
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('Текст письма скопирован')).catch(()=>toast('Не удалось скопировать текст'));
 else toast('Скопируйте текст из окна письма');
}
async function importQuoteFile(){
 const input=$('quoteFile'),file=input?.files?.[0];
 if(!file){toast('Выберите файл коммерческого предложения');return;}
 const client=window.snabproClient,company=window.snabproGetCompany?.();
 if(!client||!company?.id){toast('Сначала войдите и выберите предприятие');return;}
 if(!window.snabproWorkspaceReady){toast('Дождитесь загрузки данных предприятия');return;}
 if(file.size<=0||file.size>15*1024*1024){toast('Размер файла должен быть до 15 МБ');return;}
 const ext=file.name.toLowerCase().split('.').pop();
 if(!['pdf','xlsx','xls','csv','txt','eml'].includes(ext)){toast('Поддерживаются PDF, XLSX, XLS, CSV, TXT и EML');return;}
 const btn=document.querySelector('button[onclick="importQuoteFile()"]');
 if(btn){btn.disabled=true;btn.textContent='Загружаем и извлекаем…';}
 try{
  const form=new FormData();form.append('companyId',company.id);form.append('file',file,file.name);
  const {data,error}=await client.functions.invoke('quote-document-parser',{body:form});
  if(error)throw error;
  if(!data?.ok)throw new Error(data?.error||'Не удалось обработать файл');
  await renderUploadedDocuments();
  input.value='';
  if(data.extractionStatus==='review')toast('Файл сохранён. Проверьте извлечённые данные и подтвердите КП.');
  else toast('Файл сохранён, но текст не извлечён. Можно заполнить КП вручную.');
 }catch(error){toast('Ошибка обработки файла: '+(error.message||'попробуйте ещё раз'));}
 finally{if(btn){btn.disabled=false;btn.textContent='Обработать файл';}}
}
async function renderUploadedDocuments(prefetched){
 const el=$('uploadedDocs');if(!el)return;
 const company=window.snabproGetCompany?.(),client=window.snabproClient;
 if(!company||!client){el.innerHTML='<div class="empty">Войдите и выберите предприятие, чтобы видеть загруженные КП.</div>';return;}
 let docs=prefetched;
 if(!docs){const {data,error}=await client.from('quote_documents').select('id,original_filename,extraction_status,created_at,extraction_error').eq('company_id',company.id).order('created_at',{ascending:false});if(error){el.innerHTML='<div class="empty">Не удалось загрузить список документов: '+eh(error.message)+'</div>';return;}docs=data||[];}
 const labels={uploaded:'Загружен',processing:'Обрабатывается',review:'Распознано · нужна проверка',approved:'Добавлен в сравнение',failed:'Не удалось извлечь данные'};
 el.innerHTML=docs.length?docs.map(d=>'<div class="activity" style="align-items:center"><span class="dot"></span><div style="flex:1;min-width:0"><b>'+eh(d.original_filename)+'</b><small>'+eh(labels[d.extraction_status]||d.extraction_status)+' · '+new Date(d.created_at).toLocaleString('ru-RU')+(d.extraction_error?' · '+eh(d.extraction_error):'')+'</small></div>'+(d.extraction_status!=='approved'?'<button class="btn" type="button" data-review-document="'+eh(d.id)+'">Проверить и добавить КП</button>':'')+'</div>').join(''):'<div class="empty">Пока нет загруженных коммерческих предложений.</div>';
}
async function openDocumentReview(documentId){
 const client=window.snabproClient,company=window.snabproGetCompany?.();
 if(!client||!company?.id){toast('Сначала войдите в предприятие');return;}
 const [docRes,supplierRes,requestRes,itemRes]=await Promise.all([
  client.from('quote_documents').select('*').eq('id',documentId).eq('company_id',company.id).single(),
  client.from('suppliers').select('id,name,email').eq('company_id',company.id).order('name'),
  client.from('purchase_requests').select('id,title,status').eq('company_id',company.id).order('created_at',{ascending:false}),
  client.from('purchase_request_items').select('id,request_id,description,specification,quantity,unit').eq('company_id',company.id)
 ]);
 for(const r of [docRes,supplierRes,requestRes,itemRes])if(r.error){toast('Не удалось открыть проверку: '+r.error.message);return;}
 const doc=docRes.data,ex=doc.extracted_data||{},candidate=(ex.price_candidates||[])[0]||{};
 const suppliersList=supplierRes.data||[],requests=requestRes.data||[],items=itemRes.data||[];
 const createRequestValue='__new__';
 const initialRequest=doc.request_id||createRequestValue;
 const requestItems=items.filter(x=>x.request_id===initialRequest);
 const textPreview=ex.text_preview||'';
 const currency=candidate.currency||'RUB';
 const itemOptions=(list,selected='')=>list.map(x=>'<option value="'+eh(x.id)+'" '+(x.id===selected?'selected':'')+'>'+eh(x.description)+' · '+eh(x.quantity)+' '+eh(x.unit)+'</option>').join('');
 const supplierOptions=suppliersList.map(x=>'<option value="'+eh(x.id)+'" '+(x.id===doc.supplier_id?'selected':'')+'>'+eh(x.name)+'</option>').join('');
 const requestOptions='<option value="'+createRequestValue+'" '+(initialRequest===createRequestValue?'selected':'')+'>＋ Создать новую закупку из этого КП</option>'+requests.map(x=>'<option value="'+eh(x.id)+'" '+(x.id===initialRequest?'selected':'')+'>'+eh(x.title)+'</option>').join('');
 const parsedLineItems=[...textPreview.matchAll(/(\d{1,2})\s+(Лист.+?)\s+(\d+(?:[.,]\d+)?)\s+(лист|шт\.?|м|кг)\s+([\d\s]+,[0-9]{2})\s+([\d\s]+,[0-9]{2})/gi)].map(m=>({description:m[2].trim(),quantity:Number(m[3].replace(',','.')),unit:m[4],price:Number(m[5].replace(/\s/g,'').replace(',','.'))})).filter(x=>x.description&&x.quantity>0&&x.price>0);
 const priceMatches=[...textPreview.matchAll(/(?:^|\s)\d{1,2}\s+.{3,180}?\s+\d+(?:[.,]\d+)?\s+(?:лист|шт\.?|м|метр|упак\.?)\s+([\d\s]+[,.]\d{2})(?=\s|$)/gim)].map(m=>Number(m[1].replace(/\s/g,'').replace(',','.'))).filter(n=>n>0);
 const detectedRows=Math.max(parsedLineItems.length,(textPreview.match(/\b\d+\s*(?:лист(?:ов|а)?|шт\.?|м)\b/gi)||[]).length);
 const deliveryMatch=textPreview.match(/Доставка[^0-9]{0,80}([\d\s]+(?:[,.][0-9]{2})?)\s*₽/i);
 const detectedDelivery=deliveryMatch?Number(deliveryMatch[1].replace(/\s/g,'').replace(',','.')):0;
  const vatTop=/ндс\s+сверху|плюс\s+ндс|\+\s*ндс/i.test(ex.vat||textPreview);
  const vatNo=!vatTop&&/без\s*ндс/i.test(ex.vat||textPreview);
  const vatYes=!vatTop&&!vatNo&&/ндс/i.test(ex.vat||'');
 const makeRow=(index,itemId='',priceValue='',parsed=null)=>{
  const item=items.find(x=>x.id===itemId);
  const rowItems=items.filter(x=>x.request_id===initialRequest);
  return '<div class="dr-quote-row" data-quote-row style="border:1px solid var(--line,#ddd);border-radius:10px;padding:12px;margin:10px 0">'+
   '<div class="field full"><label>Связать с позицией существующей закупки (необязательно)</label><select data-row-item><option value="">Без привязки — создать позицию из строки КП</option>'+itemOptions(rowItems,itemId)+'</select></div>'+
   '<div class="formgrid"><div class="field full"><label>Материал / наименование позиции</label><input data-row-description value="'+eh(item?.description||parsed?.description||'')+'" placeholder="Например, Ст3сп лист 1500×6000"></div>'+
   '<div class="field full"><label>Характеристики</label><input data-row-spec value="'+eh(item?.specification?.text||'')+'" placeholder="Марка, толщина, размеры, стандарт"></div>'+
   '<div class="field"><label>Количество</label><input data-row-quantity type="number" min="0.0001" step="0.0001" value="'+eh(item?.quantity??parsed?.quantity??'')+'" placeholder="20"></div>'+
   '<div class="field"><label>Единица</label><input data-row-unit value="'+eh(item?.unit||parsed?.unit||'лист')+'" placeholder="лист, кг, м, шт."></div>'+
   '<div class="field"><label>Цена за единицу, ₽</label><input data-row-price type="number" min="0.0001" step="0.01" value="'+eh(priceValue)+'" placeholder="Введите цену"></div>'+
   '<div class="field"><label>Срок, дней</label><input data-row-lead type="number" min="0" value="'+eh(ex.lead_time_days||'')+'"></div>'+
   '<div class="field full"><label>Наличие / комментарий</label><input data-row-availability value="'+eh(ex.availability||'')+'" placeholder="Например, в наличии"></div></div>'+
   '<button class="btn" type="button" data-remove-quote-row>Удалить позицию</button></div>';
 };
 const rowCount=initialRequest===createRequestValue?Math.max(1,Math.min(12,detectedRows||priceMatches.length||1)):Math.max(1,requestItems.length);
 const initialRows=Array.from({length:rowCount},(_,i)=>makeRow(i,initialRequest===createRequestValue?'':requestItems[i]?.id||'',parsedLineItems[i]?.price||priceMatches[i]||'',parsedLineItems[i]||null)).join('');
 modal('Проверка коммерческого предложения',
  '<div class="notice">Можно привязать КП к существующей закупке или создать новую прямо из документа. Для каждой строки проверьте наименование, характеристики, количество и цену. Новая закупка и её позиции создадутся только после нажатия «Подтвердить».</div>'+
  '<div class="formgrid">'+
  '<div class="field full"><label>Поставщик</label><select id="drSupplier">'+supplierOptions+'</select></div>'+
  '<div class="field full"><label>Закупка</label><select id="drRequest">'+requestOptions+'</select></div>'+
  '<div class="field"><label>Название новой закупки</label><input id="drNewTitle" value="'+eh('КП · '+(suppliersList.find(x=>x.id===doc.supplier_id)?.name||doc.original_filename||'Новая закупка'))+'"></div>'+
  '<div class="field"><label>Валюта</label><select id="drCurrency"><option '+(currency==='RUB'?'selected':'')+' value="RUB">RUB · ₽</option><option '+(currency==='USD'?'selected':'')+' value="USD">USD · $</option><option '+(currency==='EUR'?'selected':'')+' value="EUR">EUR · €</option></select></div>'+
  '<div class="field"><label>Доставка, ₽</label><input id="drDelivery" type="number" min="0" step="0.01" value="'+eh(ex.delivery_cost||detectedDelivery||'0')+'"></div>'+
  '<div class="field"><label>НДС</label><select id="drVat"><option value="">Не указано</option><option value="yes" '+(vatYes?'selected':'')+'>Включён</option><option value="no" '+(vatNo?'selected':'')+'>Без НДС</option><option value="top" '+(vatTop?'selected':'')+'>НДС сверху — ставка уточняется</option></select></div>'+
  '<div class="field full"><label>Позиции коммерческого предложения</label><div id="drQuoteRows">'+initialRows+'</div><button class="btn" type="button" id="drAddRow">＋ Добавить позицию</button></div>'+
  '<div class="field full"><label>Фрагмент документа</label><textarea readonly rows="7" style="width:100%;font:12px/1.5 inherit">'+eh(textPreview.slice(0,7000)||doc.extraction_error||'Текст документа не извлечён. Заполните данные вручную.')+'</textarea></div>'+
  '</div><div class="modalfoot"><button class="btn" type="button" onclick="closeModal()">Отмена</button><button class="btn primary" type="button" id="drSubmit">Подтвердить и добавить в сравнение</button></div>',()=>false);
 const rowsEl=$('drQuoteRows');
 const refreshRowOptions=()=>{
  const requestId=$('drRequest').value;
  const list=requestId===createRequestValue?[]:items.filter(x=>x.request_id===requestId);
  rowsEl.querySelectorAll('[data-row-item]').forEach(sel=>{
   const old=sel.value;sel.innerHTML='<option value="">Без привязки — создать позицию из строки КП</option>'+itemOptions(list,old);
   if(old&&!list.some(x=>x.id===old))sel.value='';
  });
 };
 $('drRequest').addEventListener('change',refreshRowOptions);
 rowsEl.addEventListener('change',e=>{
  const sel=e.target.closest('[data-row-item]');if(!sel||!sel.value)return;
  const item=items.find(x=>x.id===sel.value),row=sel.closest('[data-quote-row]');if(!item||!row)return;
  row.querySelector('[data-row-description]').value=item.description||'';
  row.querySelector('[data-row-spec]').value=item.specification?.text||'';
  row.querySelector('[data-row-quantity]').value=item.quantity??'';
  row.querySelector('[data-row-unit]').value=item.unit||'шт.';
 });
 $('drAddRow').addEventListener('click',()=>{
  const wrap=document.createElement('div');wrap.innerHTML=makeRow(rowsEl.children.length,'','');
  rowsEl.appendChild(wrap.firstElementChild);refreshRowOptions();
 });
 rowsEl.addEventListener('click',e=>{
  const btn=e.target.closest('[data-remove-quote-row]');if(!btn)return;
  if(rowsEl.children.length<=1){toast('В КП должна остаться хотя бы одна позиция');return;}
  btn.closest('[data-quote-row]').remove();
 });
 $('drSubmit').addEventListener('click',async()=>{
  const supplierId=$('drSupplier').value,selectedRequest=$('drRequest').value,delivery=Number($('drDelivery').value||0);
  const rows=[...rowsEl.querySelectorAll('[data-quote-row]')].map(el=>({
   itemId:el.querySelector('[data-row-item]').value,
   description:el.querySelector('[data-row-description]').value.trim(),
   spec:el.querySelector('[data-row-spec]').value.trim(),
   quantity:Number(el.querySelector('[data-row-quantity]').value),
   unit:el.querySelector('[data-row-unit]').value.trim(),
   price:Number(el.querySelector('[data-row-price]').value),
   lead:Number(el.querySelector('[data-row-lead]').value||0),
   availability:el.querySelector('[data-row-availability]').value.trim()
  }));
  if(!supplierId||!selectedRequest||delivery<0||!rows.length){toast('Выберите поставщика, закупку и проверьте доставку');return;}
  const seen=new Set();
  for(const row of rows){
   const item=row.itemId?items.find(x=>x.id===row.itemId):null;
   if(!row.description||!(row.quantity>0)||!row.unit||!(row.price>0)||row.lead<0||(row.itemId&&(!item||item.request_id!==selectedRequest||seen.has(row.itemId)))){
    toast('Проверьте строки: нужны наименование, количество, единица и цена; позиции закупки не должны повторяться');return;
   }
   if(row.itemId)seen.add(row.itemId);
  }
  const btn=$('drSubmit');btn.disabled=true;btn.textContent='Сохраняем…';
  let requestId=selectedRequest,createdRequest=false,createdRequestTitle='',createdItemIds=[];
  const cleanupCreated=async()=>{
   if(createdItemIds.length)await client.from('purchase_request_items').delete().eq('company_id',company.id).in('id',createdItemIds);
   if(createdRequest&&requestId)await client.from('purchase_requests').delete().eq('company_id',company.id).eq('id',requestId);
  };
  if(selectedRequest===createRequestValue){
   const {data:userData,error:userError}=await client.auth.getUser();
   if(userError||!userData?.user){btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось определить пользователя предприятия');return;}
   const title=$('drNewTitle').value.trim()||'Закупка по КП · '+doc.original_filename;
   createdRequestTitle=title;
   const {data:newRequest,error:requestError}=await client.from('purchase_requests').insert({company_id:company.id,title,status:'collecting',created_by:userData.user.id,details:{source:'quote_document',document_id:doc.id}}).select('id').single();
   if(requestError){btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось создать закупку: '+requestError.message);return;}
   requestId=newRequest.id;createdRequest=true;
   const newItemRows=rows.map(row=>({company_id:company.id,request_id:requestId,description:row.description,specification:{text:row.spec},quantity:row.quantity,unit:row.unit}));
   const {data:newItems,error:newItemsError}=await client.from('purchase_request_items').insert(newItemRows).select('id');
   if(newItemsError){await cleanupCreated();btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось создать позиции закупки: '+newItemsError.message);return;}
   createdItemIds=(newItems||[]).map(x=>x.id);
   rows.forEach((row,i)=>row.itemId=createdItemIds[i]);
  }else{
   const rowsWithoutLink=rows.filter(row=>!row.itemId);
   if(rowsWithoutLink.length){
    const newItemRows=rowsWithoutLink.map(row=>({company_id:company.id,request_id:requestId,description:row.description,specification:{text:row.spec},quantity:row.quantity,unit:row.unit}));
    const {data:newItems,error:newItemsError}=await client.from('purchase_request_items').insert(newItemRows).select('id');
    if(newItemsError){btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось добавить позиции в закупку: '+newItemsError.message);return;}
    createdItemIds=(newItems||[]).map(x=>x.id);
    let cursor=0;rows.forEach(row=>{if(!row.itemId)row.itemId=createdItemIds[cursor++];});
   }
  }
  const quote={company_id:company.id,request_id:requestId,supplier_id:supplierId,document_id:doc.id,currency:$('drCurrency').value,delivery_cost:delivery,lead_time_days:(rows.every(x=>x.lead>0&&x.lead===rows[0].lead)?rows[0].lead:null),notes:'Проверено вручную по документу '+doc.original_filename};
  const {data:quoteRow,error:quoteError}=await client.from('supplier_quotes').insert(quote).select('id').single();
  if(quoteError){await cleanupCreated();btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось сохранить КП: '+quoteError.message);return;}
  const vat=$('drVat').value;
  const quoteItems=rows.map(row=>({company_id:company.id,quote_id:quoteRow.id,request_item_id:row.itemId,description:row.description,specification:{text:row.spec,lead_time_days:row.lead||null,vat_label:vat},quantity:row.quantity,unit:row.unit,unit_price:row.price,vat_included:vat===''?null:vat==='yes'||vat==='no'||vat==='top'?vat==='yes':null,availability:row.availability||null,confidence:priceMatches.length?0.75:0.5,source_excerpt:textPreview.slice(0,1000)||doc.original_filename}));
  const {error:itemError}=await client.from('quote_items').insert(quoteItems);
  if(itemError){await client.from('supplier_quotes').delete().eq('id',quoteRow.id).eq('company_id',company.id);await cleanupCreated();btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось сохранить позиции КП: '+itemError.message);return;}
  const {error:docError}=await client.from('quote_documents').update({extraction_status:'approved',request_id:requestId,supplier_id:supplierId}).eq('id',doc.id).eq('company_id',company.id);
  if(createdRequest){
   const localId=Date.now();
   const localItems=rows.map((row,i)=>({id:localId+i,dbId:createdItemIds[i],name:row.description,spec:row.spec,qty:row.quantity,unit:row.unit,cat:'Другое'}));
   purchases.unshift({id:localId,dbId:requestId,name:createdRequestTitle,items:rows.map(row=>row.description+' · '+row.quantity+' '+row.unit).join('; '),vendors:1,replies:1,status:'Сравнение предложений',date:new Date().toLocaleDateString('ru-RU'),requestItems:localItems});
   save();renderPurchases();renderDashboard();
  }
  closeModal();await window.snabproLoadWorkspace?.(company);await renderUploadedDocuments();
  toast(docError?'КП добавлено в сравнение. Статус документа не обновился.':'КП подтверждено: добавлено позиций — '+quoteItems.length+'.');
 }); 
}
function renderPriceHistory(){
 const el=$('priceHistoryRows');if(!el)return;
 const rows=(quoteOffers||[]).filter(q=>q.createdAt&&Number.isFinite(Date.parse(q.createdAt))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,100);
 el.innerHTML=rows.length?rows.map(q=>{const vat=q.vat||'Не указано',taxKnown=['НДС включён','Без НДС'].includes(vat);return '<tr><td>'+new Date(q.createdAt).toLocaleDateString('ru-RU')+'</td><td>'+eh(q.material)+'</td><td>'+eh(q.supplier)+'</td><td>'+money(q.unitPrice,q.currency)+' / '+eh(q.unit)+'</td><td>'+money(q.delivery,q.currency)+'</td><td>'+eh(vat)+'</td><td class="strong">'+(taxKnown?money(q.qty*q.unitPrice+q.delivery,q.currency):'Не рассчитано')+'</td></tr>'}).join(''):'<tr><td colspan="7" class="empty">История появится после сохранения первых реальных коммерческих предложений.</td></tr>';
}
function buildManagementReport(){
 const all=quoteOffers,by={};all.forEach(q=>{const currency=q.currency||'RUB',key=[q.material,currency,q.qty,q.unit,q.vat||'Не указано'].join('||');(by[key]??=[]).push({...q,currency,total:q.qty*q.unitPrice+q.delivery})});
 const items=Object.values(by).filter(a=>a.length>=2&&['НДС включён','Без НДС'].includes(a[0].vat||'Не указано')).map(a=>{a.sort((x,y)=>x.total-y.total);return {m:a[0].material,currency:a[0].currency,best:a[0],worst:a[a.length-1],saving:a[a.length-1].total-a[0].total}});
 const currencies=[...new Set(items.map(x=>x.currency))],total=items.length&&currencies.length<=1?items.reduce((s,x)=>s+x.saving,0):null,el=$('managementReport');
 if(el)el.innerHTML=items.map(x=>'<div class="recommend"><div><h4>'+eh(x.m)+'</h4><p>Лучшее предложение: '+eh(x.best.supplier)+' · '+money(x.best.total,x.currency)+' с доставкой. Срок '+x.best.lead+' дн. Проверьте соответствие спецификации и наличие.</p></div><div class="saving">'+money(x.saving,x.currency)+'</div></div>').join('')||'<div class="empty">Добавьте коммерческие предложения для анализа.</div>';
 if($('reportSaving'))$('reportSaving').textContent=total===null?'—':money(total,currencies[0]||'RUB');if($('reportOffers'))$('reportOffers').textContent=new Set(all.map(q=>q.dbQuoteId||q.id)).size;if($('reportRisks'))$('reportRisks').textContent=items.filter(x=>x.best.lead>5).length;
}
init();

window.snabproWorkspaceReady=false;
window.snabproLoadWorkspace=async function(company){
 const client=window.snabproClient;if(!client||!company)return;
 window.snabproWorkspaceReady=false;
 try{
  const [m,s,p,d,links,folders,requestItemsRes]=await Promise.all([
   client.from('materials').select('*').eq('company_id',company.id).order('created_at',{ascending:true}),
   client.from('suppliers').select('*').eq('company_id',company.id).order('created_at',{ascending:true}),
   client.from('purchase_requests').select('*').eq('company_id',company.id).order('created_at',{ascending:false}),
   client.from('quote_documents').select('id,original_filename,extraction_status,created_at').eq('company_id',company.id).order('created_at',{ascending:false}),
   client.from('purchase_request_suppliers').select('request_id,status,supplier_id,supplier_email,subject_token,gmail_message_id,sent_at,replied_at,email_subject,email_body,drafted_at').eq('company_id',company.id).order('drafted_at',{ascending:true}),
   client.from('material_folders').select('id,name,sort_order').eq('company_id',company.id).order('sort_order').order('name'),
   client.from('purchase_request_items').select('id,request_id,material_id,description,specification,quantity,unit').eq('company_id',company.id).order('created_at',{ascending:true})
  ]);
  if(m.error)throw m.error;if(s.error)throw s.error;if(p.error)throw p.error;if(d.error)throw d.error;if(links.error)throw links.error;if(folders.error)throw folders.error;if(requestItemsRes.error)throw requestItemsRes.error;
  const linkStatuses=new Map();
  (links.data||[]).forEach(link=>{const a=linkStatuses.get(link.request_id)||[];a.push(link.status);linkStatuses.set(link.request_id,a);});
  const itemsByRequest=new Map();
  (requestItemsRes.data||[]).forEach(item=>{const a=itemsByRequest.get(item.request_id)||[];a.push(item);itemsByRequest.set(item.request_id,a);});
  materials=(m.data||[]).map((x,i)=>({id:i+1,dbId:x.id,name:x.name,cat:x.category||'Без категории',folder:x.folder_name||x.category||'Без папки',spec:x.specification?.text||'',unit:x.unit||'шт.',price:x.last_price==null?'—':money(x.last_price),sup:0}));
  materialFolders=(folders.data||[]).map(x=>x.name);
  [...new Set(materials.map(x=>x.folder))].forEach(n=>{if(!materialFolders.includes(n))materialFolders.push(n)});
  if(!materialFolders.length)materialFolders=['Металл','Пластик','Трубы','Комплектующие','Изоляция'];
  suppliers=(s.data||[]).map((x,i)=>({id:i+1,dbId:x.id,name:x.name,email:x.email||'',contact:x.contact||x.phone||'',region:x.region||'',cats:x.categories||[],rating:x.rating||'—',lead:x.lead_time||'Не указан'}));
  purchases=(p.data||[]).map((x,i)=>{
   const linked=linkStatuses.get(x.id)||[],requestItems=(itemsByRequest.get(x.id)||[]).map((item,j)=>({id:materials.find(m=>m.dbId===item.material_id)?.id||null,dbId:item.id,materialDbId:item.material_id,name:item.description,spec:item.specification?.text||'',qty:Number(item.quantity),unit:item.unit,cat:item.specification?.category||''}));
   const replies=linked.filter(v=>v==='replied').length,sent=linked.filter(v=>v==='sent'||v==='replied').length;
   return {id:i+1,dbId:x.id,name:x.title,items:x.details?.items||requestItems.map(v=>v.name+' · '+v.qty+' '+v.unit).join('; '),vendors:linked.length||x.details?.vendors||0,sent,replies,status:x.status==='completed'?'Завершена':x.status==='cancelled'?'Отменена':x.details?.source==='manual_quote_import'?'Есть КП':(linked.length&&replies===linked.length?'Получены ответы':replies?'Есть ответы':linked.length&&sent===linked.length?'Ожидаем ответы':sent?'Частично отправлено':linked.length?'Черновики готовы':'Черновик'),date:x.details?.date||new Date(x.created_at).toLocaleDateString('ru-RU'),requestItems,draftBatch:x.id};
  });
  emailDrafts=(links.data||[]).map(link=>{
   const supplier=(s.data||[]).find(v=>v.id===link.supplier_id),requestItems=itemsByRequest.get(link.request_id)||[];
   const items=requestItems.map(item=>({id:item.id,dbId:item.id,name:item.description,spec:item.specification?.text||'',qty:Number(item.quantity),unit:item.unit}));
   const fallbackBody='Добрый день!\n\nПросим подготовить коммерческое предложение на следующие позиции:\n\n'+items.map(item=>'• '+item.name+' — '+item.spec+'; количество: '+item.qty+' '+item.unit).join('\n')+'\n\nПросим указать цену, наличие, срок поставки, стоимость доставки, НДС и условия оплаты.';
   return {id:link.subject_token,batchId:link.request_id,requestId:link.request_id,supplierLocalId:supplier?suppliers.find(v=>v.dbId===supplier.id)?.id:null,supplier:supplier?.name||link.supplier_email,to:link.supplier_email,subjectToken:link.subject_token,subject:link.email_subject||('Запрос коммерческого предложения ['+link.subject_token+']'),body:link.email_body||fallbackBody,items,createdAt:link.drafted_at,repliedAt:link.replied_at||null,status:link.status==='replied'?'Получен ответ':link.status==='sent'?'Отправлено':'Черновик'};
  });
  localStorage.setItem('sp_email_drafts',JSON.stringify(emailDrafts));
  materials.forEach(m=>m.sup=suppliers.filter(v=>v.cats.includes(m.cat)).length);
  try{await loadCompanyQuotes(company);}catch(quoteError){console.warn('Не удалось загрузить КП из базы:',quoteError);quoteOffers=[];localStorage.setItem('sp_quotes','[]');}
  window.snabproWorkspaceReady=true;
  save();renderAll();await renderUploadedDocuments(d.data||[]);
  toast('Загружены данные предприятия «'+company.name+'».');
 }catch(e){window.snabproWorkspaceReady=false;toast('Не удалось загрузить данные предприятия: '+(e.message||'ошибка'));}
};
window.snabproResetWorkspace=function(){
 window.snabproWorkspaceReady=false;
 materials=JSON.parse(JSON.stringify(dm));suppliers=JSON.parse(JSON.stringify(ds));purchases=JSON.parse(JSON.stringify(dp));
 if(typeof demoQuotes!=='undefined'){quoteOffers=JSON.parse(JSON.stringify(demoQuotes));localStorage.setItem('sp_quotes',JSON.stringify(quoteOffers));}
 renderUploadedDocuments([]);
 localStorage.setItem('sp_materials',JSON.stringify(materials));localStorage.setItem('sp_suppliers',JSON.stringify(suppliers));localStorage.setItem('sp_purchases',JSON.stringify(purchases));
 renderAll();
};

