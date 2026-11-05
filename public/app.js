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
   const {error:delError}=await client.from('purchase_request_items').delete().eq('company_id',company.id).eq('request_id',p.dbId);
   if(delError)throw delError;
   const itemRows=p.requestItems.map(x=>({company_id:company.id,request_id:p.dbId,material_id:materials.find(m=>m.id===x.id)?.dbId||null,description:x.name,specification:{text:x.spec||'',category:x.cat||''},quantity:x.qty,unit:x.unit}));
   const {error:itemError}=await client.from('purchase_request_items').insert(itemRows);
   if(itemError)throw itemError;
  }
  if(p.draftBatch){
   const batchDrafts=emailDrafts.filter(d=>d.batchId===p.draftBatch);
   for(const d of batchDrafts){
    const supplier=suppliers.find(s=>s.id===d.supplierLocalId);
    const link={company_id:company.id,request_id:p.dbId,supplier_id:supplier?.dbId||null,supplier_email:d.to,subject_token:d.subjectToken,status:d.status==='Отправлено'?'sent':'draft'};
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
function renderPurchases(){let f=$('purchaseFilter')?.value||'',a=purchases.filter(p=>!f||p.status===f);$('purchasesBody').innerHTML=a.map(p=>'<tr><td class="strong">'+eh(p.name)+'</td><td>'+eh(p.items)+'</td><td>'+eh(p.date)+'</td><td>'+p.replies+' / '+p.vendors+'</td><td><span class="pill '+(p.status==='Завершена'?'green':p.status==='Ожидаем ответы'?'orange':'')+'">'+eh(p.status)+'</span></td><td><button class="btn small" onclick="showPurchase('+p.id+')">Открыть</button></td></tr>').join('')||'<tr><td colspan="6" class="empty">Закупок пока нет</td></tr>'}
const recs=[['Проверить альтернативного поставщика нержавейки','В демо есть вариант на 600 ₽ за лист дешевле, но доставка дольше на 5 дней.','до 60 000 ₽'],['Объединить закупку труб 25 и 50 мм','Один поставщик может привезти обе позиции одним рейсом.','до 12 000 ₽'],['Запросить обновлённую цену на АБС-листы','Последнее предложение старше месяца — нужно подтвердить цену.','до 5 000 ₽'],['Проверить условия по утеплителю','Сопоставить плотность, толщину и стоимость упаковки.','до 10 000 ₽']];
function recHtml(a){return a.map(r=>'<div class="recommend"><div><h4>'+r[0]+'</h4><p>'+r[1]+'</p></div><div class="saving">'+r[2]+'</div></div>').join('')}
function renderDashboard(){$('statPurchases').textContent=purchases.filter(p=>p.status!=='Завершена').length;$('statSuppliers').textContent=suppliers.length;$('dashPurchases').innerHTML=purchases.slice(0,4).map(p=>'<tr><td class="strong">'+eh(p.name)+'</td><td>'+p.vendors+'</td><td><span class="pill">'+eh(p.status)+'</span></td><td>'+eh(p.date)+'</td></tr>').join('')||'<tr><td colspan="4" class="empty">Создайте первую закупку</td></tr>';$('dashRecs').innerHTML=recHtml(recs.slice(0,2))}
function renderAll(){renderMaterials();renderSuppliers();renderPurchases();renderDashboard();$('recommendations').innerHTML=recHtml(recs);renderQuotes()}
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
function showPurchase(id){let p=purchases.find(x=>x.id===id);modal(p.name,'<div class="notice warn">Демо-сценарий: настоящие письма и коммерческие предложения пока не подключены.</div><p style="font-size:11px"><b>Позиции:</b> '+eh(p.items)+'</p><p style="font-size:11px"><b>Поставщиков:</b> '+p.vendors+' · <b>Ответов:</b> '+p.replies+'</p><p style="font-size:11px"><b>Статус:</b> '+eh(p.status)+'</p><div class="panel"><div class="panelhead"><h3>Пример сравнения</h3></div><div class="tablewrap"><table><tr><th>Поставщик</th><th>Цена</th><th>Срок</th></tr><tr><td>МеталлСнаб Север</td><td>8 500 ₽/лист</td><td>2 дня</td></tr><tr><td>СтальТрейд</td><td>7 900 ₽/лист</td><td>7 дней</td></tr></table></div></div><div class="modalfoot"><button class="btn" onclick="closeModal()">Закрыть</button><button class="btn primary" id="modalSave">Завершить закупку</button></div>',()=>{p.status='Завершена';p.replies=p.vendors;save();renderAll();toast('Закупка завершена');return true})}
function marketSearch(){let m=$('marketMaterial').value,r=$('marketRegion').value,q=$('marketQty').value,p=$('marketPriority').value;$('marketResults').innerHTML='<div class="panel"><div class="panelhead"><h3>Результаты демонстрационного поиска</h3><span class="pill orange">Примеры · не проверены</span></div><div class="panelbody"><p class="muted" style="font-size:10px">Запрос: '+eh(m)+' · '+eh(r)+' · '+eh(q)+' · '+eh(p)+'</p><div class="suppliergrid"><div class="suppliercard"><h4>СеверМет Ресурс</h4><div class="suppliermeta">Пример цены: 7 900 ₽/лист<br>Срок: 7–10 дней<br>Требуется проверка</div><span class="pill orange">Не подтверждено</span></div><div class="suppliercard"><h4>БалтикПром Снаб</h4><div class="suppliermeta">Пример цены: 8 150 ₽/лист<br>Срок: 3–5 дней<br>Требуется проверка</div><span class="pill orange">Не подтверждено</span></div><div class="suppliercard"><h4>РегионКомплект</h4><div class="suppliermeta">Цена по запросу<br>Срок уточняется<br>Требуется проверка</div><span class="pill orange">Не подтверждено</span></div></div><div class="notice" style="margin-top:12px">В реальной версии следующий шаг — проверить компанию, запросить КП и сопоставить марку, размеры, НДС, доставку и сроки.</div></div></div>'}
function runAnalysis(){toast('Демо-анализ: 4 рекомендации, потенциальная экономия 87 000 ₽.');$('recommendations').innerHTML=recHtml(recs)}
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
window.snabproMarkDraftSent=draftId=>{const d=emailDrafts.find(x=>x.id===draftId);if(d)d.status='Отправлено';localStorage.setItem('sp_email_drafts',JSON.stringify(emailDrafts));};
const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n))+' ₽';
function quotesForSelected(){let m=$('quoteMaterial')?.value||'Труба нержавеющая Ø25 мм';return quoteOffers.filter(q=>q.material===m)}
function syncQuoteMaterialOptions(preferFirst=false){
 const select=$('quoteMaterial');if(!select)return;
 const current=select.value,labels=[...new Set(quoteOffers.map(q=>q.material).filter(Boolean))];
 const known=new Set([...select.options].map(o=>o.value));
 labels.forEach(label=>{if(!known.has(label)){const option=document.createElement('option');option.value=label;option.textContent=label;select.appendChild(option)}});
 if(preferFirst&&labels.length)select.value=labels[0];
 else if(current&&[...select.options].some(o=>o.value===current))select.value=current;
}
async function loadCompanyQuotes(company){
 const client=window.snabproClient;if(!client||!company?.id)return;
 const [q,qi,ri]=await Promise.all([
  client.from('supplier_quotes').select('*').eq('company_id',company.id).order('created_at',{ascending:false}),
  client.from('quote_items').select('*').eq('company_id',company.id).order('created_at',{ascending:false}),
  client.from('purchase_request_items').select('id,description,specification,quantity,unit').eq('company_id',company.id)
 ]);
 if(q.error)throw q.error;if(qi.error)throw qi.error;if(ri.error)throw ri.error;
 const quoteById=new Map((q.data||[]).map(x=>[x.id,x]));
 const itemById=new Map((ri.data||[]).map(x=>[x.id,x]));
 const supplierById=new Map(suppliers.filter(x=>x.dbId).map(x=>[x.dbId,x]));
 quoteOffers=(qi.data||[]).flatMap(item=>{
  const quote=quoteById.get(item.quote_id);if(!quote)return [];
  const requestItem=item.request_item_id?itemById.get(item.request_item_id):null;
  const spec=item.specification?.text||requestItem?.specification?.text||'';
  const material=String(item.description||requestItem?.description||'Позиция закупки')+(spec?' · '+spec:'');
  const supplier=supplierById.get(quote.supplier_id);
  return [{id:item.id,dbQuoteId:quote.id,material,supplier:supplier?.name||'Поставщик',unitPrice:Number(item.unit_price)||0,qty:Number(item.quantity??requestItem?.quantity)||1,delivery:Number(quote.delivery_cost)||0,vat:item.vat_included===true?'НДС включён':item.vat_included===false?'Без НДС':'Не указано',lead:Number(quote.lead_time_days)||0,unit:item.unit||requestItem?.unit||'шт.',spec:spec||'Характеристики не указаны',status:'Получено из почты',source:item.source_excerpt||quote.notes||'Письмо поставщика',currency:quote.currency||'RUB'}];
 });
 localStorage.setItem('sp_quotes',JSON.stringify(quoteOffers));
 syncQuoteMaterialOptions(true);renderQuotes();
}
window.snabproRefreshQuotes=async()=>{const company=window.snabproGetCompany?.();if(!company)throw new Error('Предприятие не выбрано');await loadCompanyQuotes(company);return quoteOffers.length};
function renderQuotes(){
 const arr=quotesForSelected(),body=$('quotesBody');if(!body)return;
 const sorted=arr.map(q=>({...q,total:q.qty*q.unitPrice+q.delivery})).sort((a,b)=>a.total-b.total),best=sorted[0],worst=sorted[sorted.length-1];
 body.innerHTML=sorted.map((q,i)=>'<tr class="'+(i===0?'bestrow':'')+'"><td>'+eh(q.supplier)+'</td><td>'+money(q.unitPrice)+' / '+eh(q.unit)+'</td><td>'+q.qty+' '+eh(q.unit)+'</td><td>'+money(q.delivery)+'</td><td>'+eh(q.vat)+'</td><td>'+q.lead+' дн.</td><td class="strong">'+money(q.total)+'</td><td><span class="pill '+(i===0?'green':'')+'">'+(i===0?'Самая низкая сумма':eh(q.status))+'</span></td></tr>').join('')||'<tr><td colspan="8" class="empty">Пока нет предложений для этой позиции. Добавьте КП.</td></tr>';
 $('quoteCount').textContent=quoteOffers.length;
 $('quoteQty').textContent=best?best.qty+' '+best.unit:'—';
 $('quoteBest').textContent=best?money(best.total):'—';
 $('quoteSaving').textContent=best&&worst?money(worst.total-best.total):'—';
 $('quoteVerdict').textContent=best?'Лучшее по полной стоимости: '+best.supplier+' — '+money(best.total)+'. Срок: '+best.lead+' дн. Спецификация: '+best.spec+'. Перед выбором подтвердите наличие, документы и соответствие характеристик.':'Добавьте предложения, чтобы сравнить итоговую стоимость.';
 buildManagementReport();
}
function openQuoteImport(){
 modal('Добавить коммерческое предложение','<div class="notice">Введите данные из КП. Система посчитает итоговую стоимость с доставкой. Для реального внедрения распознавание документов будет автоматизировано.</div><div class="formgrid"><div class="field full"><label>Материал / позиция</label><select id="qiMaterial"><option>Труба нержавеющая Ø25 мм</option><option>Нержавеющая сталь AISI 304 · лист</option><option>АБС-пластик · лист 3 мм</option></select></div><div class="field"><label>Поставщик</label><input id="qiSupplier" placeholder="Название компании"></div><div class="field"><label>Цена за единицу, ₽</label><input id="qiPrice" type="number" min="0" placeholder="175"></div><div class="field"><label>Количество</label><input id="qiQty" type="number" min="1" value="300"></div><div class="field"><label>Доставка, ₽</label><input id="qiDelivery" type="number" min="0" value="0"></div><div class="field"><label>НДС</label><select id="qiVat"><option>НДС включён</option><option>Без НДС</option><option>НДС сверху</option><option>Не указано</option></select></div><div class="field"><label>Срок, дней</label><input id="qiLead" type="number" min="0" value="3"></div><div class="field full"><label>Характеристики / примечание</label><input id="qiSpec" placeholder="Марка, размеры, толщина, стандарт"></div></div><div class="modalfoot"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn primary" id="modalSave">Сохранить КП</button></div>',()=>{
 const supplier=$('qiSupplier').value.trim(),price=Number($('qiPrice').value),qty=Number($('qiQty').value),delivery=Number($('qiDelivery').value||0);
 if(!supplier||!(price>0)||!(qty>0)){toast('Укажите поставщика, цену и количество');return false}
 const material=$('qiMaterial').value;quoteOffers.push({id:Date.now(),material,supplier,unitPrice:price,qty,delivery,vat:$('qiVat').value,lead:Number($('qiLead').value||0),unit:material.includes('Труба')?'м':'лист',spec:$('qiSpec').value||'Характеристики не подтверждены',status:'Добавлено вручную',source:'Ручной ввод'});localStorage.setItem('sp_quotes',JSON.stringify(quoteOffers));renderQuotes();toast('КП добавлено в сравнение');return true;
 });
}
let previewDrafts=[];
async function composeDraft(i){const d=previewDrafts[i];if(!d){toast('Черновик не найден');return}try{await window.snabproEnsureWorkspaceSaved?.()}catch(e){toast('Не удалось сохранить заявку: '+e.message);return}if(!d.requestId&&d.subjectToken){const client=window.snabproClient,company=window.snabproGetCompany?.();if(client&&company){const {data,error}=await client.from('purchase_request_suppliers').select('request_id').eq('company_id',company.id).eq('subject_token',d.subjectToken).maybeSingle();if(error){toast('Не удалось связать письмо с заявкой: '+error.message);return}d.requestId=data?.request_id||null;}}if(!window.snabproComposeEmail){toast('Почтовый модуль не загружен. Обновите страницу.');return}closeModal();window.snabproComposeEmail(d)}
function showRequestPreview(){
 const batch=emailDrafts.length?emailDrafts[emailDrafts.length-1].batchId:null;
 let drafts=batch?emailDrafts.filter(d=>d.batchId===batch):[];
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
 const initialRequest=doc.request_id||requests[0]?.id||'';
 const requestItems=items.filter(x=>x.request_id===initialRequest);
 const initialItem=requestItems[0];
 const supplierOptions=suppliersList.map(x=>'<option value="'+eh(x.id)+'" '+(x.id===doc.supplier_id?'selected':'')+'>'+eh(x.name)+'</option>').join('');
 const requestOptions=requests.map(x=>'<option value="'+eh(x.id)+'" '+(x.id===initialRequest?'selected':'')+'>'+eh(x.title)+'</option>').join('');
 const itemOptions=list=>list.map(x=>'<option value="'+eh(x.id)+'">'+eh(x.description)+' · '+eh(x.quantity)+' '+eh(x.unit)+'</option>').join('');
 const spec=(initialItem?.specification?.text||ex.specification||'');
 const price=Number(candidate.amount)||'';
 const currency=candidate.currency||'RUB';
 const textPreview=ex.text_preview||'';
 modal('Проверка коммерческого предложения',
  '<div class="notice">Проверьте распознанные значения. Ничего не попадёт в сравнение, пока вы не нажмёте «Подтвердить и добавить».</div>'+
  '<div class="formgrid">'+
  '<div class="field full"><label>Поставщик</label><select id="drSupplier">'+supplierOptions+'</select></div>'+
  '<div class="field full"><label>Закупка</label><select id="drRequest">'+requestOptions+'</select></div>'+
  '<div class="field full"><label>Позиция закупки</label><select id="drItem">'+itemOptions(requestItems)+'</select></div>'+
  '<div class="field"><label>Цена за единицу</label><input id="drPrice" type="number" min="0.0001" step="0.01" value="'+eh(price)+'" placeholder="Введите цену"></div>'+
  '<div class="field"><label>Валюта</label><select id="drCurrency"><option '+(currency==='RUB'?'selected':'')+' value="RUB">RUB · ₽</option><option '+(currency==='USD'?'selected':'')+' value="USD">USD · $</option><option '+(currency==='EUR'?'selected':'')+' value="EUR">EUR · €</option></select></div>'+
  '<div class="field"><label>Доставка, ₽</label><input id="drDelivery" type="number" min="0" step="0.01" value="0"></div>'+
  '<div class="field"><label>Срок поставки, дней</label><input id="drLead" type="number" min="0" value="'+eh(ex.lead_time_days||'')+'"></div>'+
  '<div class="field"><label>НДС</label><select id="drVat"><option value="">Не указано</option><option value="yes" '+(ex.vat==='С НДС'?'selected':'')+'>Включён</option><option value="no" '+(ex.vat==='Без НДС'?'selected':'')+'>Без НДС</option></select></div>'+
  '<div class="field"><label>Наличие</label><input id="drAvailability" value="'+eh(ex.availability||'')+'" placeholder="Например, в наличии"></div>'+
  '<div class="field full"><label>Характеристики / комментарий</label><input id="drSpec" value="'+eh(spec)+'" placeholder="Проверьте марку, размер, толщину"></div>'+
  '<div class="field full"><label>Фрагмент документа</label><textarea readonly rows="6" style="width:100%;font:12px/1.5 inherit">'+eh(textPreview.slice(0,5000)||doc.extraction_error||'Текст документа не извлечён. Заполните данные вручную.')+'</textarea></div>'+
  '</div><div class="modalfoot"><button class="btn" type="button" onclick="closeModal()">Отмена</button><button class="btn primary" type="button" id="drSubmit">Подтвердить и добавить в сравнение</button></div>',()=>false);
 $('drRequest').addEventListener('change',()=>{
  const list=items.filter(x=>x.request_id===$('drRequest').value);
  $('drItem').innerHTML=itemOptions(list);
 });
 $('drSubmit').addEventListener('click',async()=>{
  const supplierId=$('drSupplier').value,requestId=$('drRequest').value,itemId=$('drItem').value,price=Number($('drPrice').value),delivery=Number($('drDelivery').value||0),lead=Number($('drLead').value||0);
  if(!supplierId||!requestId||!itemId||!(price>0)||delivery<0||lead<0){toast('Выберите поставщика, закупку, позицию и укажите корректную цену');return;}
  const item=items.find(x=>x.id===itemId);
  if(!item||item.request_id!==requestId){toast('Позиция не относится к выбранной закупке');return;}
  const btn=$('drSubmit');btn.disabled=true;btn.textContent='Сохраняем…';
  const quote={company_id:company.id,request_id:requestId,supplier_id:supplierId,document_id:doc.id,currency:$('drCurrency').value,delivery_cost:delivery,lead_time_days:lead||null,notes:'Проверено вручную по документу '+doc.original_filename};
  const {data:quoteRow,error:quoteError}=await client.from('supplier_quotes').insert(quote).select('id').single();
  if(quoteError){btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось сохранить КП: '+quoteError.message);return;}
  const vat=$('drVat').value;
  const quoteItem={company_id:company.id,quote_id:quoteRow.id,request_item_id:itemId,description:item.description,specification:{text:$('drSpec').value.trim()},quantity:item.quantity,unit:item.unit,unit_price:price,vat_included:vat===''?null:vat==='yes',availability:$('drAvailability').value.trim()||null,confidence:candidate.amount?0.75:0.5,source_excerpt:textPreview.slice(0,1000)||doc.original_filename};
  const {error:itemError}=await client.from('quote_items').insert(quoteItem);
  if(itemError){await client.from('supplier_quotes').delete().eq('id',quoteRow.id).eq('company_id',company.id);btn.disabled=false;btn.textContent='Подтвердить и добавить в сравнение';toast('Не удалось сохранить позицию КП: '+itemError.message);return;}
  const {error:docError}=await client.from('quote_documents').update({extraction_status:'approved'}).eq('id',doc.id).eq('company_id',company.id);
  closeModal();await window.snabproRefreshQuotes?.();await renderUploadedDocuments();
  toast(docError?'КП добавлено в сравнение. Статус документа не обновился.':'КП подтверждено и добавлено в сравнение.');
 });
}

async function importQuoteFile(){
 const f=$('quoteFile')?.files?.[0];if(!f){toast('Выберите файл');return}
 const ext=f.name.split('.').pop().toLowerCase();
 if(['pdf','xlsx','xls','docx','doc'].includes(ext)){
  const client=window.snabproClient,company=window.snabproGetCompany?.();
  if(!client){toast('Модуль подключения не загружен. Обновите страницу.');return}
  if(!company){toast('Сначала войдите и зарегистрируйте предприятие через кнопку «Войти».');return}
  try{
   const {data:{user},error:userError}=await client.auth.getUser();
   if(userError||!user){toast('Войдите в аккаунт перед загрузкой документа.');return}
   const safeName=f.name.replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)||'quote.'+ext;
   const token=window.crypto?.randomUUID?.()||String(Date.now());
   const path=company.id+'/'+token+'-'+safeName;
   const mime=f.type||({pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword'}[ext]);
   const {error:uploadError}=await client.storage.from('quote-documents').upload(path,f,{contentType:mime,upsert:false});
   if(uploadError)throw uploadError;
   const {error:rowError}=await client.from('quote_documents').insert({
    company_id:company.id,storage_path:path,original_filename:f.name,mime_type:mime,
    extraction_status:'uploaded',uploaded_by:user.id
   });
   if(rowError){await client.storage.from('quote-documents').remove([path]);throw rowError;}
   toast('Документ безопасно сохранён в закрытом хранилище предприятия. AI-распознавание подключим следующим серверным этапом.');
   $('quoteFile').value='';await renderUploadedDocuments();
  }catch(e){toast('Не удалось загрузить документ: '+(e.message||'ошибка доступа'))}
  return;
 }
 if(!['csv','txt','eml'].includes(ext)){toast('Поддерживаются CSV, TXT, EML, PDF, XLSX, XLS, DOCX и DOC.');return}
 const reader=new FileReader();reader.onload=()=>{const t=String(reader.result||'');const lines=t.split(/\r?\n/).filter(Boolean);let added=0;
  lines.slice(1).forEach(line=>{const cells=line.split(/[;,\t]/).map(x=>x.trim().replace(/^"|"$/g,''));if(cells.length>=4){const [material,supplier,price,qty,delivery='0',vat='Не указано',lead='0',spec=''] = cells;const m=material.toLowerCase().includes('труб')?'Труба нержавеющая Ø25 мм':material.toLowerCase().includes('абс')?'АБС-пластик · лист 3 мм':'Нержавеющая сталь AISI 304 · лист';if(Number(price)>0&&Number(qty)>0){quoteOffers.push({id:Date.now()+added,material:m,supplier,unitPrice:Number(price),qty:Number(qty),delivery:Number(delivery)||0,vat,lead:Number(lead)||0,unit:m.includes('Труба')?'м':'лист',spec:spec||'Не указано',status:'Импортировано',source:f.name});added++}}});
  if(!added){const price=(t.match(/(?:цена|price)\D{0,15}(\d+[.,]?\d*)/i)||[])[1];toast(price?'Формат не распознан автоматически. Добавьте КП вручную.':'Не удалось извлечь табличные строки. Используйте шаблон CSV.');return}
  localStorage.setItem('sp_quotes',JSON.stringify(quoteOffers));renderQuotes();toast('Импортировано КП: '+added);
 };reader.readAsText(f,'UTF-8');
}
function buildManagementReport(){
 const all=quoteOffers,by={};all.forEach(q=>{(by[q.material]??=[]).push({...q,total:q.qty*q.unitPrice+q.delivery})});
 const items=Object.entries(by).map(([m,a])=>{a.sort((x,y)=>x.total-y.total);return {m,best:a[0],worst:a[a.length-1],saving:a[a.length-1].total-a[0].total}});
 const total=items.reduce((s,x)=>s+x.saving,0),el=$('managementReport');if(el)el.innerHTML=items.map(x=>'<div class="recommend"><div><h4>'+eh(x.m)+'</h4><p>Лучшее предложение: '+eh(x.best.supplier)+' · '+money(x.best.total)+' с доставкой. Срок '+x.best.lead+' дн. Проверьте соответствие спецификации и наличие.</p></div><div class="saving">'+money(x.saving)+'</div></div>').join('')||'<div class="empty">Добавьте коммерческие предложения для анализа.</div>';
 if($('reportSaving'))$('reportSaving').textContent=money(total);if($('reportOffers'))$('reportOffers').textContent=all.length;if($('reportRisks'))$('reportRisks').textContent=items.filter(x=>x.best.lead>5).length;
}
init();

window.snabproWorkspaceReady=false;
window.snabproLoadWorkspace=async function(company){
 const client=window.snabproClient;if(!client||!company)return;
 window.snabproWorkspaceReady=false;
 try{
  const [m,s,p,d,links,folders]=await Promise.all([
   client.from('materials').select('*').eq('company_id',company.id).order('created_at',{ascending:true}),
   client.from('suppliers').select('*').eq('company_id',company.id).order('created_at',{ascending:true}),
   client.from('purchase_requests').select('*').eq('company_id',company.id).order('created_at',{ascending:false}),
   client.from('quote_documents').select('id,original_filename,extraction_status,created_at').eq('company_id',company.id).order('created_at',{ascending:false}),
   client.from('purchase_request_suppliers').select('request_id,status').eq('company_id',company.id),
   client.from('material_folders').select('id,name,sort_order').eq('company_id',company.id).order('sort_order').order('name')
  ]);
  if(m.error)throw m.error;if(s.error)throw s.error;if(p.error)throw p.error;if(d.error)throw d.error;if(links.error)throw links.error;if(folders.error)throw folders.error;
  const linkStatuses=new Map();
  (links.data||[]).forEach(link=>{const a=linkStatuses.get(link.request_id)||[];a.push(link.status);linkStatuses.set(link.request_id,a);});
  materials=(m.data||[]).map((x,i)=>({id:i+1,dbId:x.id,name:x.name,cat:x.category||'Без категории',folder:x.folder_name||x.category||'Без папки',spec:x.specification?.text||'',unit:x.unit||'шт.',price:x.last_price==null?'—':money(x.last_price),sup:0}));
  materialFolders=(folders.data||[]).map(x=>x.name);
  [...new Set(materials.map(x=>x.folder))].forEach(n=>{if(!materialFolders.includes(n))materialFolders.push(n)});
  if(!materialFolders.length)materialFolders=['Металл','Пластик','Трубы','Комплектующие','Изоляция'];
  suppliers=(s.data||[]).map((x,i)=>({id:i+1,dbId:x.id,name:x.name,email:x.email||'',contact:x.contact||x.phone||'',region:x.region||'',cats:x.categories||[],rating:x.rating||'—',lead:x.lead_time||'Не указан'}));
  purchases=(p.data||[]).map((x,i)=>({id:i+1,dbId:x.id,name:x.title,items:x.details?.items||'',vendors:x.details?.vendors||0,replies:x.details?.replies||0,status:x.status==='completed'?'Завершена':x.status==='cancelled'?'Отменена':(linkStatuses.get(x.id)?.length&&linkStatuses.get(x.id).every(v=>v==='sent')?'Ожидаем ответы':'Черновики готовы'),date:x.details?.date||new Date(x.created_at).toLocaleDateString('ru-RU')}));
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

