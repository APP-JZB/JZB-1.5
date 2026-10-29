/* Task data stays in Supabase; never bundle operational records in public assets. */
window.JzbDashboard = (() => {
 const q=id=>document.getElementById(id);
 const sections=['Jefe Jefatura Zonas de Bienestar','Sub Jefe Jefatura Zonas de Bienestar','Asistencial','Coordinación Habitacional','Servicio Bandas','Planificación','Personal','Finanzas','Recreacional','Logística','Seguridad'];
 let tasks=[],date=null,selected=null,calendarView="month",statsKey=null,currentProfile=null,progressByTask=new Map(),commentsByTask=new Map(),responsibles=new Map();
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const initialDate=today().split('-').map(Number);date=new Date(initialDate[0],initialDate[1]-1,initialDate[2]);
 const iso=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const format=s=>s?new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(s+'T12:00:00')):'Sin plazo';
 const state=t=>t.status==='finalizada'?'Finalizada':t.due_date&&t.due_date<today()?'Vencida':t.status==='en_desarrollo'?'En desarrollo':'Pendiente';
 function taskCard(t){
  const card=node('article',undefined,'task-card');card.append(node('h3',t.title),node('p',`${t.section} · ${state(t)}`,'muted'));
  if(t.status!=='finalizada'&&progressByTask.get(t.id)?.ready_for_review)card.append(node('p','Lista para revisión de la Jefatura','review-tag'));
  card.append(node('p',t.description));
  const designated=(t.responsible_ids||[]).map(id=>responsibles.get(id)).filter(Boolean);
  if(designated.length){const box=node('div',undefined,'task-responsibles');box.append(node('strong','Responsables designados:'));for(const person of designated)box.append(node('p',person.rank+' '+person.full_name+' · '+person.position));card.append(box);}
  else card.append(node('p','Responsables designados: Por designar','muted'));
  if(t.assignee_text)card.append(node('p','Antecedente anterior: '+t.assignee_text,'muted'));
  card.append(node('p','Plazo: '+format(t.due_date),'deadline'));
  if(!t.due_date&&t.deadline_text)card.append(node('p','Fecha visible en captura: '+t.deadline_text+' (por validar)','muted'));
  if(t.needs_review){card.append(node('span','Pendiente de revisión','review-tag'),node('p',t.review_notes,'review-note'));}
  if(window.JzbTaskEditor?.canManage()){const edit=node('button','Editar tarea','secondary task-edit');edit.type='button';edit.onclick=()=>window.JzbTaskEditor.openEdit(t);card.append(edit);}
  const complete=node('button',t.status==='finalizada'?'Reabrir tarea':'Marcar como completada','task-complete');
  complete.type='button';complete.disabled=!window.JzbTaskEditor?.canComplete?.();
  if(complete.disabled)complete.setAttribute('title','Solo el Administrador, Jefe o Subjefe pueden cambiar el estado.');
  complete.onclick=()=>window.JzbTaskEditor?.setCompleted(t,complete);card.append(complete);
  if(t.completed_at)card.append(node('p','Completada el '+new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(t.completed_at)),'completion-note'));
  const progress=node('button','Comentarios y avances','secondary');progress.type='button';progress.onclick=()=>window.JzbTaskProgress?.open(t);card.append(progress);
  const comments=commentsByTask.get(t.id)||[];
  if(comments.length){
   const history=node('section',undefined,'task-inline-comments');history.append(node('h4','Comentarios y avances'));
   for(const comment of comments){const entry=node('article',undefined,'progress-entry');
    entry.append(node('strong',comment.actor_name+' · '+comment.section));
    entry.append(node('p',new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(comment.created_at)),'muted'));
    if(comment.ready_for_review)entry.append(node('b','Trabajo cumplido · Listo para revisión'));
    entry.append(node('p',comment.body));history.append(entry);
   }
   card.append(history);
  }
  return card;
 }
 function isMine(task){
  if(!currentProfile?.id)return false;
  const people=[...responsibles.values()].filter(p=>p.profile_id===currentProfile.id&&p.active!==false);
  const assigned=task.responsible_ids||[];
  if(assigned.length)return people.some(p=>assigned.includes(p.id));
  const destination=currentProfile.role==='jefe'?'Jefe Jefatura Zonas de Bienestar':currentProfile.role==='subjefe'?'Sub Jefe Jefatura Zonas de Bienestar':currentProfile.section;
  return Boolean(destination&&task.section===destination);
 }
 function configure(profile){currentProfile=profile;q('statMine').hidden=!profile?.id||!['user','jefe','subjefe'].includes(profile.role);}
 const statViews={mine:{button:'statMine',label:'Mis tareas asignadas',match:isMine},all:{button:'statAll',label:'Total de tareas',match:()=>true},open:{button:'statOpen',label:'Pendientes o en desarrollo',match:t=>t.status!=='finalizada'},review:{button:'statReview',label:'Antecedentes por revisar',match:t=>t.needs_review},noDeadline:{button:'statNoDeadline',label:'Sin plazo',match:t=>!t.due_date}};
 function renderStatsTasks(){
  if(!statsKey)return;const view=statViews[statsKey],rows=tasks.filter(view.match);
  q('statsDialogTitle').textContent=view.label;q('statsDialogCount').textContent=rows.length+' tarea'+(rows.length===1?'':'s');q('statsTasksList').replaceChildren();
  if(!rows.length)q('statsTasksList').append(node('p','No hay tareas en esta categoría.','muted'));
  for(const section of sections){const entries=rows.filter(t=>t.section===section);if(!entries.length)continue;const group=node('section',undefined,'task-section-group');group.append(node('h3',section));for(const task of entries)group.append(taskCard(task));q('statsTasksList').append(group);}
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
  q('myTasks').textContent=tasks.filter(isMine).length;
  q('totalTasks').textContent=tasks.length;
  q('openTasks').textContent=tasks.filter(t=>t.status!=='finalizada').length;
  q('reviewTasks').textContent=tasks.filter(t=>t.needs_review).length;
  q('unconfirmedTasks').textContent=tasks.filter(t=>!t.due_date).length;
  q('sectionRows').replaceChildren();
  for(const section of sections){const rows=tasks.filter(t=>t.section===section),r=node('tr');
   [section,rows.length,rows.filter(t=>t.status==='en_desarrollo').length,rows.filter(t=>t.status==='finalizada').length,rows.filter(t=>state(t)==='Vencida').length].forEach(v=>r.append(node('td',String(v))));q('sectionRows').append(r);}
 }
 function weekRange(start,end){
  const month=d=>new Intl.DateTimeFormat('es-CL',{month:'long'}).format(d),last=String(end.getDate()).padStart(2,'0');
  if(start.getFullYear()!==end.getFullYear())return start.getDate()+' '+month(start)+' '+start.getFullYear()+' al '+last+' '+month(end)+' '+end.getFullYear();
  if(start.getMonth()===end.getMonth())return start.getDate()+' al '+end.getDate()+' '+month(end)+' '+end.getFullYear();
  return start.getDate()+' '+month(start)+' al '+last+' '+month(end)+' '+end.getFullYear();
 }
 function renderCalendar(){
  renderStatsTasks();
  const y=date.getFullYear(),m=date.getMonth(),currentDay=today();
  const weekStart=new Date(y,m,date.getDate()-(date.getDay()+6)%7),weekEnd=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+6);
  const fullFormat=d=>new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'long',year:'numeric'}).format(d);
  q('calendarMonth').textContent=calendarView==='day'?fullFormat(date):calendarView==='week'?weekRange(weekStart,weekEnd):new Intl.DateTimeFormat('es-CL',{month:'long',year:'numeric'}).format(date);
  q('calendarDays').setAttribute('data-view',calendarView);q('calendarWeek').hidden=calendarView==='day';
  q('calendarView').value=calendarView;
  q('calendarPrev').setAttribute('aria-label',calendarView==='month'?'Mes anterior':calendarView==='week'?'Semana anterior':'Día anterior');
  q('calendarNext').setAttribute('aria-label',calendarView==='month'?'Mes siguiente':calendarView==='week'?'Semana siguiente':'Día siguiente');
  q('calendarDays').replaceChildren();
  const offset=(new Date(y,m,1).getDay()+6)%7;
  const selectDay=key=>{selected=key;renderCalendar();if(!q('calendarTasksDialog').open)q('calendarTasksDialog').showModal();q('calendarTasksClose').focus();};
  for(let i=0;i<(calendarView==='month'?42:calendarView==='week'?7:1);i++){
   const start=calendarView==='month'?new Date(y,m,1-offset):calendarView==='week'?weekStart:date;
   const cellDate=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),key=iso(cellDate.getFullYear(),cellDate.getMonth(),cellDate.getDate());
   const items=tasks.filter(t=>t.due_date===key).sort((a,b)=>Number(a.status==='finalizada')-Number(b.status==='finalizada')||a.title.localeCompare(b.title,'es'));
   const cell=node('div',undefined,'calendar-day');
   const fullDate=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'long',year:'numeric'}).format(cellDate);
   cell.setAttribute('aria-label',fullDate+', '+items.length+' tareas');
   if(calendarView==='month'&&cellDate.getMonth()!==m)cell.classList.add('other-month');
   if(key===currentDay)cell.classList.add('is-today');
   if(key===selected)cell.classList.add('selected');
   const dayButton=node('button',calendarView==='day'?fullDate:String(cellDate.getDate()),'calendar-day-number');dayButton.type='button';
   dayButton.setAttribute('data-date',key);dayButton.setAttribute('aria-label','Ver tareas del '+fullDate);dayButton.setAttribute('aria-pressed',String(selected===key));
   if(key===currentDay)dayButton.setAttribute('aria-current','date');
   dayButton.onclick=()=>selectDay(key);cell.append(dayButton);
   for(const task of items.slice(0,calendarView==='month'?3:items.length)){
    const complete=task.status==='finalizada',overdue=!complete&&key<currentDay;
    const chip=node('button',undefined,'calendar-task '+(complete?'is-complete':overdue?'is-overdue':'is-pending'));chip.type='button';
    chip.setAttribute('title',task.section+' · '+task.title+' · '+state(task));
    chip.setAttribute('aria-label',task.title+', '+task.section+', '+state(task)+', '+fullDate);
    const icon=node('span',complete?'✓':'○','calendar-task-icon');icon.setAttribute('aria-hidden','true');
    chip.append(icon,node('span',task.title,'calendar-task-title'));
    chip.onclick=()=>selectDay(key);cell.append(chip);
   }
   if(calendarView==='month'&&items.length>3){const more=node('button','+'+(items.length-3)+' más','calendar-more');more.type='button';more.setAttribute('aria-label','Ver las '+items.length+' tareas del '+fullDate);more.onclick=()=>selectDay(key);cell.append(more);}
   if(calendarView!=='month'&&!items.length)cell.append(node('p','Sin tareas con plazo.','muted'));
   cell.onclick=e=>{if(!e||e.target===cell)selectDay(key);};
   q('calendarDays').append(cell);
  }
  q('calendarDetail').replaceChildren();
  if(selected){
   const rows=tasks.filter(t=>t.due_date===selected);
   q('calendarDialogTitle').textContent='Tareas del '+format(selected);
   q('calendarDialogCount').textContent=rows.length+' tarea'+(rows.length===1?'':'s')+' con plazo en esta fecha';
   if(!rows.length)q('calendarDetail').append(node('p','Sin plazos confirmados para esta fecha.','muted'));
   rows.forEach(t=>q('calendarDetail').append(taskCard(t)));
  }else{q('calendarDialogTitle').textContent='Tareas del día';q('calendarDialogCount').textContent='';}
 }
 async function load(api){
  q('taskLoadMessage').textContent='Cargando tareas…';q('refreshTasks').disabled=true;
  try{const rows=await api('/rest/v1/jzb_tasks?select=id,section,title,description,assignee_text,responsible_ids,status,due_date,deadline_text,needs_review,review_notes,revision,completed_at&order=section.asc,created_at.asc&limit=1000');if(!Array.isArray(rows))throw new Error('Respuesta no válida');tasks=rows;const directory=await api('/rest/v1/jzb_responsibles?select=id,rank,full_name,position,profile_id,active&order=full_name.asc');responsibles=new Map(directory.map(p=>[p.id,p]));progressByTask=new Map();commentsByTask=new Map();try{let offset=0;while(true){const advances=await api('/rest/v1/jzb_task_comments?select=id,task_id,actor_name,section,body,ready_for_review,created_at&order=created_at.desc,id.desc&limit=1000&offset='+offset);for(const a of advances){if(!a.task_id)continue;if(!progressByTask.has(a.task_id))progressByTask.set(a.task_id,a);if(!commentsByTask.has(a.task_id))commentsByTask.set(a.task_id,[]);commentsByTask.get(a.task_id).push(a);}if(advances.length<1000)break;offset+=1000;}}catch(e){}renderSummary();renderList();renderCalendar();q('taskLoadMessage').textContent=tasks.length?'Los registros señalados requieren validar sus antecedentes. Puedes crear tareas y consultar sus documentos.':'Todavía no hay tareas cargadas.';}
  catch(e){tasks=[];responsibles.clear();progressByTask.clear();commentsByTask.clear();renderSummary();renderList();renderCalendar();q('taskLoadMessage').textContent='No fue posible cargar las tareas. Vuelve a iniciar sesión si la sesión venció o intenta actualizar.';}
  finally{q('refreshTasks').disabled=false;}
 }
 function clear(){currentProfile=null;q('statMine').hidden=true;if(q('statsTasksDialog').open)q('statsTasksDialog').close();statsKey=null;q('statsTasksList').replaceChildren();if(q('calendarTasksDialog').open)q('calendarTasksDialog').close();tasks=[];responsibles.clear();progressByTask.clear();commentsByTask.clear();selected=null;q('taskSearch').value='';q('taskSection').value='';renderSummary();renderList();renderCalendar();q('taskLoadMessage').textContent='';}
 for(const section of sections){const o=node('option',section);o.value=section;q('taskSection').append(o);}
 q('taskSection').onchange=renderList;q('taskSearch').oninput=renderList;
 function moveCalendar(direction){date=calendarView==='month'?new Date(date.getFullYear(),date.getMonth()+direction,1):new Date(date.getFullYear(),date.getMonth(),date.getDate()+direction*(calendarView==='week'?7:1));selected=null;renderCalendar();}
 q('calendarPrev').onclick=()=>moveCalendar(-1);q('calendarNext').onclick=()=>moveCalendar(1);
 q('calendarView').onchange=()=>{const next=q('calendarView').value;if(!['month','week','day'].includes(next))return;if(selected){const parts=selected.split('-').map(Number);date=new Date(parts[0],parts[1]-1,parts[2]);}calendarView=next;renderCalendar();};
 q('calendarToday').onclick=()=>{const parts=today().split('-').map(Number);date=new Date(parts[0],parts[1]-1,parts[2]);selected=today();renderCalendar();};
 for(const [key,view] of Object.entries(statViews))q(view.button).onclick=()=>{statsKey=key;renderStatsTasks();q('statsTasksDialog').showModal();q('statsTasksClose').focus();};
 q('statsTasksClose').onclick=()=>q('statsTasksDialog').close();
 q('statsTasksDialog').addEventListener('close',()=>{if(statsKey)q(statViews[statsKey].button).focus();statsKey=null;});
 q('calendarTasksClose').onclick=()=>q('calendarTasksDialog').close();
 q('calendarTasksDialog').addEventListener('close',()=>{if(selected)q('calendarDays').querySelector?.('[data-date="'+selected+'"]')?.focus();});
 return {load,clear,configure};
})();
