/* Task data stays in Supabase; never bundle operational records in public assets. */
window.JzbDashboard = (() => {
 const q=id=>document.getElementById(id);
 const sections=['Asistencial','Coordinación Habitacional','Servicio Bandas','Planificación','Personal','Finanzas','Recreacional','Logística'];
 let tasks=[],date=new Date(),selected=null;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const iso=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const format=s=>s?new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(s+'T12:00:00')):'Sin plazo';
 const state=t=>t.status==='finalizada'?'Finalizada':t.due_date&&t.due_date<today()?'Vencida':t.status==='en_desarrollo'?'En desarrollo':'Pendiente';
 function taskCard(t){
  const card=node('article',undefined,'task-card');card.append(node('h3',t.title),node('p',`${t.section} · ${state(t)}`,'muted'));
  card.append(node('p',t.description));
  card.append(node('p','Responsable indicado: '+(t.assignee_text||'Por confirmar'),'muted'));
  card.append(node('p','Plazo: '+format(t.due_date),'deadline'));
  if(!t.due_date&&t.deadline_text)card.append(node('p','Fecha visible en captura: '+t.deadline_text+' (por validar)','muted'));
  if(t.needs_review){card.append(node('span','Pendiente de revisión','review-tag'),node('p',t.review_notes,'review-note'));}
  if(window.JzbTaskEditor?.canManage()){const edit=node('button','Editar tarea','secondary task-edit');edit.type='button';edit.onclick=()=>window.JzbTaskEditor.openEdit(t);card.append(edit);}
  return card;
 }
 function renderList(){
  const filterSection=q('taskSection').value,term=q('taskSearch').value.trim().toLocaleLowerCase('es');
  const list=tasks.filter(t=>(!filterSection||t.section===filterSection)&&(!term||[t.title,t.description,t.section,t.assignee_text||''].join(' ').toLocaleLowerCase('es').includes(term)));
  q('taskList').replaceChildren();q('taskCount').textContent=list.length+' tareas';
  if(!list.length&&term){q('taskList').append(node('p','No hay tareas que coincidan con la búsqueda.','muted'));return;}
  const groups=new Map();
  for(const task of list){
   const key=task.section;
   const label=key==='Coordinación Habitacional'?'Habitacional':key;
   if(!groups.has(key))groups.set(key,{label,items:[]});
   groups.get(key).items.push(task);
  }
  for(const name of sections){
   if(filterSection&&name!==filterSection)continue;
   const group=groups.get(name)||{label:name==='Coordinación Habitacional'?'Habitacional':name,items:[]};
   if(term&&!group.items.length)continue;
   const section=node('section',undefined,'task-section-group');
   const heading=node('div',undefined,'task-section-heading');
   heading.append(node('h3',group.label),node('span',group.items.length+' tarea'+(group.items.length===1?'':'s'),'pill'));
   if(window.JzbTaskEditor?.canManage()){const create=node('button','Crear tarea','secondary section-create');create.type='button';create.setAttribute('aria-label','Crear tarea para '+group.label);create.onclick=()=>window.JzbTaskEditor.openCreate(name);heading.append(create);}
   section.append(heading);
   if(!group.items.length)section.append(node('p','Sin tareas asignadas.','muted empty-section'));
   for(const task of group.items)section.append(taskCard(task));
   q('taskList').append(section);
  }
 }
 function renderSummary(){
  q('totalTasks').textContent=tasks.length;
  q('openTasks').textContent=tasks.filter(t=>t.status!=='finalizada').length;
  q('reviewTasks').textContent=tasks.filter(t=>t.needs_review).length;
  q('unconfirmedTasks').textContent=tasks.filter(t=>!t.due_date).length;
  q('sectionRows').replaceChildren();
  for(const section of sections){const rows=tasks.filter(t=>t.section===section),r=node('tr');
   [section,rows.length,rows.filter(t=>t.status==='en_desarrollo').length,rows.filter(t=>t.status==='finalizada').length,rows.filter(t=>state(t)==='Vencida').length].forEach(v=>r.append(node('td',String(v))));q('sectionRows').append(r);}
 }
 function renderCalendar(){
  const y=date.getFullYear(),m=date.getMonth();q('calendarMonth').textContent=new Intl.DateTimeFormat('es-CL',{month:'long',year:'numeric'}).format(date);
  q('calendarDays').replaceChildren();
  for(let i=0;i<(new Date(y,m,1).getDay()+6)%7;i++)q('calendarDays').append(node('span'));
  for(let d=1;d<=new Date(y,m+1,0).getDate();d++){
   const key=iso(y,m,d),items=tasks.filter(t=>t.due_date===key),b=node('button',String(d),'calendar-day');b.type='button';
   b.setAttribute('aria-label',`${d} de ${q('calendarMonth').textContent}, ${items.length} tareas`);
   b.setAttribute('aria-pressed',String(selected===key));
   if(items.length){b.classList.add('has-tasks');b.append(node('small',String(items.length)+' tarea'+(items.length===1?'':'s')));}
   if(key===today())b.classList.add('is-today');if(selected===key)b.classList.add('selected');
   b.onclick=()=>{selected=key;renderCalendar();};q('calendarDays').append(b);
  }
  q('calendarDetail').replaceChildren();
  if(selected){const rows=tasks.filter(t=>t.due_date===selected);q('calendarDetail').append(node('h3',format(selected)));if(!rows.length)q('calendarDetail').append(node('p','Sin plazos confirmados para esta fecha.','muted'));rows.forEach(t=>q('calendarDetail').append(taskCard(t)));}
  else q('calendarDetail').append(node('p','Selecciona un día para consultar sus tareas. Solo se muestran vencimientos con fecha completa confirmada.','muted'));
 }
 async function load(api){
  q('taskLoadMessage').textContent='Cargando tareas…';q('refreshTasks').disabled=true;
  try{const rows=await api('/rest/v1/jzb_tasks?select=id,section,title,description,assignee_text,status,due_date,deadline_text,needs_review,review_notes,revision&order=section.asc,created_at.asc&limit=1000');if(!Array.isArray(rows))throw new Error('Respuesta no válida');tasks=rows;renderSummary();renderList();renderCalendar();q('taskLoadMessage').textContent=tasks.length?'Los registros señalados requieren validar sus antecedentes. Puedes crear tareas y consultar sus documentos.':'Todavía no hay tareas cargadas.';}
  catch(e){tasks=[];renderSummary();renderList();renderCalendar();q('taskLoadMessage').textContent='No fue posible cargar las tareas. Vuelve a iniciar sesión si la sesión venció o intenta actualizar.';}
  finally{q('refreshTasks').disabled=false;}
 }
 function clear(){tasks=[];selected=null;q('taskSearch').value='';q('taskSection').value='';renderSummary();renderList();renderCalendar();q('taskLoadMessage').textContent='';}
 for(const section of sections){const o=node('option',section);o.value=section;q('taskSection').append(o);}
 q('taskSection').onchange=renderList;q('taskSearch').oninput=renderList;
 q('calendarPrev').onclick=()=>{date=new Date(date.getFullYear(),date.getMonth()-1,1);selected=null;renderCalendar();};
 q('calendarNext').onclick=()=>{date=new Date(date.getFullYear(),date.getMonth()+1,1);selected=null;renderCalendar();};
 return {load,clear};
})();
