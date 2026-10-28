const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-28T12:00:00Z']));}}
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.attrs={};this.open=false;this._text='';this.classList={add:(...names)=>{this.className=[this.className||'',...names].join(' ');}};}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this._text='';this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=v;}
 showModal(){this.open=true;}close(){this.open=false;}focus(){}addEventListener(){}
}
const html=fs.readFileSync(path.join(__dirname,'../web-admin/index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'unique element IDs');
for(const target of ['consolidadoTareas','calendarioTareas','tareasCargadas'])assert.ok(html.includes('href="#'+target+'"')&&ids.includes(target),'shortcut targets exist');
assert.ok(html.indexOf('id="calendarDetail"')>html.indexOf('id="calendarTasksDialog"'),'task detail is in the popup');
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
let openedSection=null,editedTask=null;
const context={window:{JzbTaskEditor:{canManage:()=>true,openCreate:section=>{openedSection=section;},openEdit:task=>{editedTask=task;}}},document:{getElementById:id=>{assert.ok(elements[id],`Missing element ${id}`);return elements[id];},createElement:t=>new Element(t)},Date:FixedDate,Intl,console};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../web-admin/tasks.js'),'utf8'),context);
const dashboard=context.window.JzbDashboard;
const rows=[{id:'a',section:'Logística',title:'<img src=x onerror=alert(1)>',description:'Texto de prueba',status:'pendiente',due_date:null,deadline_text:'9/10',needs_review:true,review_notes:'Año por confirmar'},{id:'b',section:'Personal',title:'Tarea de prueba',description:'Ejemplo',status:'finalizada',due_date:'2026-11-12',needs_review:false}];
(async()=>{
 await dashboard.load(async path=>{assert.match(path,/^\/rest\/v1\/jzb_tasks/);return rows;});
 assert.equal(elements.calendarDays.children.length,42,'six complete weeks');
 assert.match(elements.calendarDays.children[0].attrs['aria-label'],/^28 de septiembre de 2026/,'Monday start includes neighboring dates');
 assert.match(elements.calendarDays.children.find(e=>e.attrs['aria-label']?.startsWith('28 de octubre')).className,/is-today/);
 const busyDateRows=Array.from({length:5},(_,i)=>({...rows[0],id:'calendar-'+i,title:'Tarea mensual '+i,due_date:'2026-10-06',needs_review:false}));
 busyDateRows.push({...rows[1],id:'completed',title:'Tarea finalizada visible',due_date:'2026-10-07'});
 await dashboard.load(async()=>busyDateRows);
 const busyDay=elements.calendarDays.children.find(e=>e.attrs['aria-label']?.startsWith('6 de octubre de 2026'));
 assert.equal(busyDay.children.filter(e=>e.className?.startsWith('calendar-task ')).length,3,'only first three chips in the cell');
 assert.match(busyDay.children[1].className,/is-overdue/);
 const more=busyDay.children.find(e=>e.className==='calendar-more');assert.equal(more.textContent,'+2 más');more.onclick();assert.equal(elements.calendarTasksDialog.open,true,'calendar opens task popup');
 assert.match(elements.calendarDetail.textContent,/Tarea mensual 4/,'more button reveals all tasks');
 const completeDay=elements.calendarDays.children.find(e=>e.attrs['aria-label']?.startsWith('7 de octubre de 2026'));
 assert.match(completeDay.children[1].className,/is-complete/);
 elements.calendarTasksClose.onclick();assert.equal(elements.calendarTasksDialog.open,false);elements.calendarNext.onclick();elements.calendarToday.onclick();assert.match(elements.calendarMonth.textContent,/octubre de 2026/,'Today restores the current month');assert.match(elements.calendarDialogTitle.textContent,/28 oct/);
 await dashboard.load(async()=>rows);
 assert.equal(elements.totalTasks.textContent,'2');assert.equal(elements.unconfirmedTasks.textContent,'1');assert.equal(elements.reviewTasks.textContent,'1');
 assert.equal(elements.taskList.children.length,10,'every section has an entry point, including empty sections');
 assert.equal(elements.taskList.children[0].tag,'section');
 assert.match(elements.taskList.children[0].textContent,/Jefe Jefatura Zonas de Bienestar/);assert.match(elements.taskList.children[1].textContent,/Sub Jefe Jefatura Zonas de Bienestar/);
 elements.taskList.children[2].children[0].children[2].onclick();assert.equal(openedSection,'Asistencial','create button exists in an empty section');
 const existingCard=elements.taskList.children.find(group=>group.children[0].textContent.startsWith('Logística')).children.find(child=>child.tag==='article');existingCard.children.find(child=>child.textContent==='Editar tarea').onclick();assert.equal(editedTask.id,'a','edit button opens the selected task');
 assert.match(elements.taskList.children[2].children[0].textContent,/Asistencial/);assert.match(elements.taskList.textContent,/<img src=x/,'title remains literal text');
 await dashboard.load(async path=>path.includes('jzb_task_comments')?[{task_id:'a',actor_name:'Jefe de sección',section:'Logística',body:'Avance <img src=x> registrado',ready_for_review:true,created_at:'2026-10-28T13:00:00Z'}]:rows);
 assert.match(elements.taskList.textContent,/Avance <img src=x> registrado/,'comments render as safe literal text below task');
 const commented=elements.taskList.children.find(group=>group.children[0].textContent.startsWith('Logística')).children.find(child=>child.tag==='article');
 assert.equal(commented.children.at(-1).className,'task-inline-comments','comments follow task controls');
 const uncommented=elements.taskList.children.find(group=>group.children[0].textContent.startsWith('Personal')).children.find(child=>child.tag==='article');
 assert.equal(uncommented.children.some(child=>child.className==='task-inline-comments'),false,'no empty comments block');
 await dashboard.load(async path=>path.includes('jzb_responsibles')?[{id:'person-a',rank:'TTE',full_name:'Responsable A',position:'Cargo A'},{id:'person-b',rank:'MAY',full_name:'Responsable B',position:'Cargo B'}]:path.includes('jzb_task_comments')?[]:rows.map(t=>({...t,responsible_ids:['person-a','person-b']})));
 assert.match(elements.taskList.textContent,/Responsable A/);assert.match(elements.taskList.textContent,/Responsable B/,'both joint responsible names appear on cards');
 const assignedRows=rows.map(t=>({...t,assignee_text:'RESPONSABLE DE PRUEBA'}));
 await dashboard.load(async()=>assignedRows);
 assert.equal(elements.taskList.children.filter(group=>group.children.some(child=>child.tag==='article')).length,2,'different sections stay separate even with the same assignee');
 assert.match(elements.taskList.children.find(group=>group.children[0].textContent.startsWith('Personal')).children[0].textContent,/Personal1 tarea/);
 const sameSectionRows=rows.map((t,i)=>({...t,section:'Coordinación Habitacional',assignee_text:'RESPONSABLE '+i}));
 await dashboard.load(async()=>sameSectionRows);
 assert.equal(elements.taskList.children.filter(group=>group.children.some(child=>child.tag==='article')).length,1,'one subtitle per section despite different assignees');
 assert.match(elements.taskList.children.find(group=>group.children[0].textContent.startsWith('Habitacional')).children[0].textContent,/Habitacional2 tareas/);
 await dashboard.load(async()=>assignedRows);
 elements.taskSection.value='Logística';elements.taskSection.onchange();assert.equal(elements.taskList.children.length,1);
 elements.taskSearch.value='no existe';elements.taskSearch.oninput();assert.match(elements.taskList.textContent,/No hay tareas/);
 elements.calendarNext.onclick();const day=elements.calendarDays.children.find(e=>e.attrs['aria-label']?.startsWith('12 de noviembre de 2026'));assert.ok(day);day.onclick();assert.match(elements.calendarDetail.textContent,/Tarea de prueba/,'calendar ignores section filter');
 elements.calendarView.value='week';elements.calendarView.onchange();assert.equal(elements.calendarDays.children.length,7,'weekly view shows seven days');
 elements.calendarToday.onclick();assert.match(elements.calendarMonth.textContent,/26 de octubre de 2026/);assert.match(elements.calendarMonth.textContent,/1 de noviembre de 2026/,'week crosses month boundary');
 elements.calendarNext.onclick();assert.match(elements.calendarMonth.textContent,/2 de noviembre de 2026/,'next advances a week');
 elements.calendarToday.onclick();elements.calendarView.value='day';elements.calendarView.onchange();assert.equal(elements.calendarDays.children.length,1,'daily view shows one day');assert.equal(elements.calendarWeek.hidden,true);
 elements.calendarNext.onclick();assert.match(elements.calendarMonth.textContent,/29 de octubre de 2026/,'next advances one day');elements.calendarPrev.onclick();assert.match(elements.calendarMonth.textContent,/28 de octubre de 2026/);
 elements.calendarView.value='month';elements.calendarView.onchange();assert.equal(elements.calendarDays.children.length,42);assert.equal(elements.calendarWeek.hidden,false);
 dashboard.clear();assert.equal(elements.totalTasks.textContent,'0');assert.equal(elements.calendarTasksDialog.open,false,'logout closes task popup');assert.doesNotMatch(elements.taskList.textContent,/<img/,'logout clears loaded data');
 await dashboard.load(async()=>{throw new Error('expired');});assert.match(elements.taskLoadMessage.textContent,/No fue posible/);assert.equal(elements.totalTasks.textContent,'0');
 console.log('PASS: counts, filters, calendar, safe text, logout and error state');
})().catch(e=>{console.error(e);process.exitCode=1;});
