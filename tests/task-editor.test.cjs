const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto}=require('node:crypto');
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.files=[];this.checked=false;this.disabled=false;this.hidden=false;this.open=false;this._text='';this.events={};this.isConnected=true;}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(e=>e.textContent).join('');}
 append(...es){this.children.push(...es);}replaceChildren(...es){this._text='';this.children=es;}addEventListener(k,v){this.events[k]=v;}focus(){}showModal(){this.open=true;}close(){this.open=false;}click(){}remove(){}reset(){for(const k of fields){elements[k].value='';elements[k].files=[];elements[k].checked=false;}}
}
const html=fs.readFileSync(path.join(__dirname,'../web-admin/index.html'),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(e=>e[1]);
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const fields=['taskTitle','taskDescription','taskAssignedSection','taskResponsible','taskNoDeadline','taskDueDate','taskFiles'];
const context={window:{},document:{getElementById:id=>{assert.ok(elements[id],id);return elements[id];},createElement:t=>new Element(t),activeElement:null,body:new Element('body')},crypto:webcrypto,Intl,Date,URL,setTimeout,console};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../web-admin/task-editor.js'),'utf8'),context);
const editor=context.window.JzbTaskEditor;
let tasks=new Map(),attachments=new Map(),objects=new Map(),posts=0,patches=0,refreshes=0,uploadFails=false,conflict=false;
async function api(route,options={}){
 const method=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body;
 if(route==='/rest/v1/jzb_tasks'&&method==='POST'){posts++;if(tasks.has(body.id))throw new Error('duplicate');const row={...body,revision:1};tasks.set(row.id,row);return [{...row}];}
 if(route.startsWith('/rest/v1/jzb_tasks?')&&method==='PATCH'){patches++;if(conflict)return [];const id=route.match(/id=eq\.([^&]+)/)[1],row={...tasks.get(id),...body};row.revision++;tasks.set(id,row);return [{...row}];}
 if(route.startsWith('/rest/v1/jzb_tasks?')&&method==='GET'){const id=route.match(/id=eq\.([^&]+)/)[1];return tasks.has(id)?[{...tasks.get(id)}]:[];}
 if(route.startsWith('/rest/v1/jzb_task_history?'))return [];
 if(route==='/rest/v1/jzb_task_attachments'&&method==='POST'){attachments.set(body.id,body);return {};}
 if(route.startsWith('/rest/v1/jzb_task_attachments?')){const id=route.match(/(?:task_id|id)=eq\.([^&]+)/)[1];return [...attachments.values()].filter(a=>a.id===id||a.task_id===id);}
 if(route.startsWith('/storage/v1/object/authenticated/')){const key=route.split('/authenticated/')[1];if(!objects.has(key))throw new Error('not found');return {size:objects.get(key).size};}
 if(route.startsWith('/storage/v1/object/')&&method==='POST'){if(uploadFails)throw new Error('upload failed');objects.set(route.split('/object/')[1],body);return {};}
 if(route.startsWith('/storage/v1/object/')&&method==='DELETE')return {};
 throw new Error('Unexpected API '+method+' '+route);
}
function fill(){elements.taskTitle.value='Nueva tarea';elements.taskDescription.value='Instrucciones de prueba';elements.taskResponsible.value='Responsable de prueba';elements.taskDueDate.value='2026-11-15';}
const submit=()=>elements.taskForm.onsubmit({preventDefault(){}});
(async()=>{
 editor.configure(api,async()=>{refreshes++;},'admin');editor.openCreate('Logística');assert.equal(elements.taskAssignedSection.value,'Logística');assert.equal(elements.taskEditor.open,true);
 await submit();assert.match(elements.taskEditorMessage.textContent,/Completa/);assert.equal(posts,0,'incomplete forms do not create tasks');
 fill();await submit();assert.equal(posts,1);assert.equal(tasks.size,1);assert.equal(elements.taskEditor.open,false);assert.equal(refreshes,1);
 const first=[...tasks.values()][0];editor.openEdit(first);elements.taskAssignedSection.value='Personal';elements.taskNoDeadline.checked=true;elements.taskNoDeadline.onchange();await submit();assert.equal(patches,1);assert.equal(tasks.get(first.id).section,'Personal');assert.equal(tasks.get(first.id).due_date,null);
 editor.openEdit(tasks.get(first.id));elements.taskAssignedSection.value='Finanzas';conflict=true;await submit();assert.match(elements.taskEditorMessage.textContent,/Otra persona/);assert.equal(elements.taskEditor.open,true);conflict=false;editor.clear();
 editor.configure(api,async()=>{},'jefe');editor.openCreate('Finanzas');fill();elements.taskFiles.files=[{name:'antecedente.pdf',size:120,type:'application/pdf'}];elements.taskFiles.onchange();uploadFails=true;await submit();assert.equal(tasks.size,2);assert.match(elements.taskEditorMessage.textContent,/La tarea está guardada/);assert.equal(elements.taskEditor.open,true);const countBefore=posts;
 uploadFails=false;await submit();assert.equal(posts,countBefore,'retry never creates a duplicate task');assert.equal(attachments.size,1);assert.equal(elements.taskEditor.open,false);
 editor.openCreate('Personal');fill();elements.taskFiles.files=[{name:'demasiado.pdf',size:11*1024*1024,type:'application/pdf'}];await submit();assert.match(elements.taskEditorMessage.textContent,/supera 10 MB/);assert.equal(posts,countBefore);
 editor.clear();editor.configure(api,async()=>{},'user');editor.openCreate('Logística');assert.equal(elements.taskEditor.open,false);assert.equal(elements.createTask.hidden,true);
 console.log('PASS: section preset, required fields, creation, section/deadline editing, conflict, upload retry, file size and role gating');
})().catch(e=>{console.error(e);process.exitCode=1;});
