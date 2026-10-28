window.JzbTaskEditor=(()=>{
 const q=id=>document.getElementById(id),BUCKET='jzb-task-documents',MAX_BYTES=10*1024*1024;
 const allowed=/\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|txt|csv)$/i;
 let api=null,refresh=null,canManage=false,canMarkComplete=false,current=null,draftId=null,busy=false,queue=[],previousFocus=null;
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 let directory=[],directoryReady=false,directoryRequest=0;
 const selectedResponsibleIds=()=>Array.from(q('taskAssigneeOptions').children).filter(label=>label.children[0]?.checked).map(label=>label.children[0].value);
 function updateResponsibleSummary(){const count=selectedResponsibleIds().length;const summary=q('taskAssigneeSummary');if(!summary)return;summary.textContent=count?count+' responsable'+(count===1?' seleccionado':'s seleccionados'):'Seleccionar responsables';}
 function renderResponsibleOptions(){q('taskAssigneeOptions').replaceChildren();for(const person of directory){const label=el('label',undefined,'responsible-option'),box=el('input');box.type='checkbox';box.value=person.id;box.checked=(current?.responsible_ids||[]).includes(person.id);box.disabled=!canMarkComplete||busy;box.onchange=updateResponsibleSummary;label.append(box,el('span',person.rank+' '+person.full_name));q('taskAssigneeOptions').append(label);}updateResponsibleSummary();}
 async function loadDirectory(){const version=++directoryRequest;directoryReady=false;q('taskAssigneeMessage').textContent='Cargando perfiles…';try{const rows=await api('/rest/v1/jzb_responsibles?select=id,rank,full_name,position,section,active&active=eq.true&order=full_name.asc');if(version!==directoryRequest)return;directory=rows;directoryReady=true;renderResponsibleOptions();q('taskAssigneeMessage').textContent=canMarkComplete?'':'Solo el Administrador, Jefe o Subjefe puede designar responsables.';}catch(e){if(version===directoryRequest)q('taskAssigneeMessage').textContent='No se pudieron cargar los perfiles. Cierra y vuelve a abrir para reintentar.';}}
 const pathEncode=p=>p.split('/').map(encodeURIComponent).join('/');
 const dateText=d=>d?new Intl.DateTimeFormat('es-CL',{dateStyle:'medium'}).format(new Date(d+'T12:00:00')):'Sin plazo';
 const payload=()=>({title:q('taskTitle').value.trim(),description:q('taskDescription').value.trim(),section:q('taskAssignedSection').value,assignee_text:q('taskResponsible').value.trim()||null,due_date:q('taskNoDeadline').checked?null:q('taskDueDate').value,...(canMarkComplete&&directoryReady?{responsible_ids:selectedResponsibleIds()}: {})});
 function setBusy(value){busy=value;for(const id of ['taskSave','taskCancel','taskClose','taskTitle','taskDescription','taskAssignedSection','taskResponsible','taskNoDeadline','taskDueDate','taskFiles'])q(id).disabled=value;q('taskDueDate').disabled=value||q('taskNoDeadline').checked;for(const label of q('taskAssigneeOptions').children)label.children[0].disabled=value||!canMarkComplete;}
 function showMessage(message){q('taskEditorMessage').textContent=message;}
 function updateDeadline(){q('taskDueDate').disabled=q('taskNoDeadline').checked;q('taskDueDate').required=!q('taskNoDeadline').checked;if(q('taskNoDeadline').checked)q('taskDueDate').value='';}
 function fileSelection(){
  queue=[];q('taskFileSelection').replaceChildren();const files=Array.from(q('taskFiles').files||[]);
  if(files.length>5){showMessage('Selecciona hasta cinco archivos por guardado.');return;}
  for(const f of files)q('taskFileSelection').append(el('li',f.name+' · '+(f.size/1024/1024).toFixed(2)+' MB'));
  showMessage('');
 }
 function validateFiles(){
  const files=Array.from(q('taskFiles').files||[]);
  if(files.length>5)throw new Error('Selecciona hasta cinco archivos por guardado.');
  for(const f of files){if(!f.size)throw new Error('El archivo '+f.name+' está vacío.');if(f.size>MAX_BYTES)throw new Error('El archivo '+f.name+' supera 10 MB.');if(f.name.length>255||!allowed.test(f.name))throw new Error('Formato o nombre de archivo no permitido: '+f.name);}
  if(!queue.length)queue=files.map(file=>({file,id:crypto.randomUUID(),uploaded:false,registered:false}));
 }
 function close(){if(busy)return;q('taskEditor').close();if(previousFocus?.isConnected)previousFocus.focus();}
 function configure(request,reload,role){api=request;refresh=reload;canManage=['admin','jefe','subjefe'].includes(role);canMarkComplete=['admin','jefe','subjefe'].includes(role);q('createTask').hidden=!canManage;}
 function open(section='',task=null){
  if(!canManage||!api)return;previousFocus=document.activeElement;current=task?{...task}:null;draftId=task?.id||crypto.randomUUID();queue=[];
  q('taskForm').reset();if(q('taskAssigneeDropdown'))q('taskAssigneeDropdown').open=false;q('taskEditorTitle').textContent=task?'Editar tarea':'Crear tarea';q('taskSave').textContent=task?'Guardar cambios':'Crear tarea';
  q('taskAssignedSection').value=task?.section||section;q('taskTitle').value=task?.title||'';q('taskDescription').value=task?.description||'';q('taskResponsible').value=task?.assignee_text||'';
  q('taskNoDeadline').checked=task?!task.due_date:false;q('taskDueDate').value=task?.due_date||'';updateDeadline();
  q('taskFileSelection').replaceChildren();q('taskExistingFiles').replaceChildren();q('taskHistory').replaceChildren();showMessage('');setBusy(false);
  q('taskExistingFiles').textContent=task?'Cargando documentos…':'Todavía no hay documentos adjuntos.';
  q('taskHistory').textContent=task?'Cargando historial…':'El historial se generará al crear la tarea.';
  q('taskEditor').showModal();q('taskTitle').focus();renderResponsibleOptions();loadDirectory();if(task)loadDetails(task.id);
 }
 async function loadDetails(taskId){
  const existing=q('taskExistingFiles'),history=q('taskHistory');
  const results=await Promise.allSettled([
   api('/rest/v1/jzb_task_attachments?select=id,task_id,object_path,file_name,size_bytes&task_id=eq.'+encodeURIComponent(taskId)+'&order=created_at.asc'),
   api('/rest/v1/jzb_task_history?select=actor_name,event,before_values,after_values,created_at&task_id=eq.'+encodeURIComponent(taskId)+'&order=created_at.desc&limit=50')
  ]);
  if(current?.id!==taskId)return;
  existing.replaceChildren();history.replaceChildren();
  if(results[0].status==='rejected')existing.textContent='No se pudieron cargar los documentos.';
  else if(!results[0].value.length)existing.textContent='Todavía no hay documentos adjuntos.';
  else for(const attachment of results[0].value){const b=el('button','Descargar '+attachment.file_name,'document-download');b.type='button';b.onclick=()=>download(attachment,b);existing.append(b);}
  if(results[1].status==='rejected')history.textContent='No se pudo cargar el historial.';
  else if(!results[1].value.length)history.textContent='No hay cambios registrados desde que se habilitó el historial.';
  else for(const row of results[1].value){const item=el('div',undefined,'history-entry');const when=new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(row.created_at));
   item.append(el('strong',row.actor_name+' · '+when),el('p',row.event==='created'?'Creó la tarea.':'Modificó la tarea.'));
   const before=row.before_values,after=row.after_values;
   if(before&&before.section!==after.section)item.append(el('p','Sección: '+before.section+' → '+after.section));
   if(before&&before.due_date!==after.due_date)item.append(el('p','Plazo: '+dateText(before.due_date)+' → '+dateText(after.due_date)));
   if(after.responsible_ids)item.append(el('p','Responsables designados: '+(after.responsible_ids.map(id=>{const person=directory.find(d=>d.id===id);return person?person.rank+' '+person.full_name:id;}).join(', ')||'Sin designar')));
   if(before&&before.status!==after.status){const names={pendiente:'Pendiente',en_desarrollo:'En desarrollo',finalizada:'Completada'};item.append(el('p','Estado: '+(names[before.status]||before.status)+' → '+(names[after.status]||after.status)));}
   history.append(item);
  }
 }
 async function download(attachment,button){
  button.disabled=true;
  try{const blob=await api('/storage/v1/object/authenticated/'+BUCKET+'/'+pathEncode(attachment.object_path),{responseType:'blob'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=attachment.file_name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(e){showMessage('No fue posible descargar '+attachment.file_name+'. Vuelve a iniciar sesión si es necesario.');}
  finally{button.disabled=false;}
 }
 async function saveRow(values){
  const headers={'Prefer':'return=representation'};
  if(current){
   if(Object.entries(values).every(([key,value])=>JSON.stringify(current[key]??null)===JSON.stringify(value??null)))return;
   const rows=await api('/rest/v1/jzb_tasks?id=eq.'+encodeURIComponent(current.id)+'&revision=eq.'+current.revision,{method:'PATCH',headers,body:JSON.stringify(values)});
   if(!rows.length)throw new Error('Otra persona modificó esta tarea. Cierra el formulario, actualiza las tareas y vuelve a editarla.');
   current=rows[0];return;
  }
  try{const rows=await api('/rest/v1/jzb_tasks',{method:'POST',headers,body:JSON.stringify({id:draftId,...values})});if(!rows[0])throw new Error('No se pudo confirmar la creación.');current=rows[0];}
  catch(error){
   // Reuse the draft ID after an uncertain network result; never create a duplicate.
   const found=await api('/rest/v1/jzb_tasks?select=*&id=eq.'+encodeURIComponent(draftId));
   if(found.length){current=found[0];await saveRow(values);}else throw error;
  }
 }
 async function saveFile(entry){
  if(entry.registered)return;const objectPath=current.id+'/'+entry.id;
  if(!entry.uploaded){
   try{await api('/storage/v1/object/'+BUCKET+'/'+pathEncode(objectPath),{method:'POST',headers:{'Content-Type':entry.file.type||'application/octet-stream','x-upsert':'false'},body:entry.file});entry.uploaded=true;}
   catch(error){try{const existing=await api('/storage/v1/object/authenticated/'+BUCKET+'/'+pathEncode(objectPath),{responseType:'blob'});if(existing.size!==entry.file.size)throw error;entry.uploaded=true;}catch(e){throw error;}}
  }
  const meta={id:entry.id,task_id:current.id,object_path:objectPath,file_name:entry.file.name,mime_type:entry.file.type||'application/octet-stream',size_bytes:entry.file.size};
  try{await api('/rest/v1/jzb_task_attachments',{method:'POST',body:JSON.stringify(meta)});entry.registered=true;}
  catch(error){
   // Metadata could have committed before a connection error. Check before cleanup.
   try{const found=await api('/rest/v1/jzb_task_attachments?select=id&id=eq.'+encodeURIComponent(entry.id));if(found.length){entry.registered=true;return;}}catch(e){throw error;}
   try{await api('/storage/v1/object/'+BUCKET,{method:'DELETE',body:JSON.stringify({prefixes:[objectPath]})});entry.uploaded=false;}catch(e){}
   throw error;
  }
 }
 async function save(event){
  event.preventDefault();if(busy||!canManage||!api)return;showMessage('');
  try{if(canMarkComplete&&!directoryReady)throw new Error('Espera a que carguen los perfiles responsables o vuelve a abrir el formulario.');const values=payload();if(!values.title||!values.description||!values.section||(!q('taskNoDeadline').checked&&!values.due_date))throw new Error('Completa título, instrucciones, sección y plazo, o marca Sin plazo.');validateFiles();}
  catch(e){showMessage(e.message);return;}
  setBusy(true);let completed=false;
  try{
   showMessage('Guardando tarea…');await saveRow(payload());q('taskEditorTitle').textContent='Editar tarea';
   let failed=0;for(const entry of queue){try{showMessage('Guardando documento '+entry.file.name+'…');await saveFile(entry);}catch(e){failed++;}}
   q('taskSection').value='';q('taskSearch').value='';await refresh();
   if(failed){showMessage('La tarea está guardada. No se pudieron adjuntar '+failed+' archivo(s). Pulsa Reintentar para subir los pendientes; no se creará otra tarea.');q('taskSave').textContent='Reintentar adjuntos';await loadDetails(current.id);}
   else{completed=true;q('panelMessage').textContent='Tarea guardada correctamente.';}
  }catch(e){showMessage(e.message||'No se pudo guardar. Revisa tu conexión y vuelve a intentar.');}
  finally{setBusy(false);if(completed)close();}
 }
 async function setCompleted(task,button){
  if(!canMarkComplete||!api){q('panelMessage').textContent='Solo el Administrador, Jefe o Subjefe pueden cambiar el estado de las tareas.';return;}
  button.disabled=true;q('panelMessage').textContent='Actualizando estado…';
  try{
   const next=task.status==='finalizada'?'pendiente':'finalizada';
   const rows=await api('/rest/v1/jzb_tasks?id=eq.'+encodeURIComponent(task.id)+'&revision=eq.'+task.revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:next})});
   if(!rows.length)throw new Error('Otra persona modificó esta tarea. Actualiza el listado antes de cambiar su estado.');
   await refresh();q('panelMessage').textContent=next==='finalizada'?'Tarea marcada como completada.':'Tarea reabierta.';
  }catch(e){q('panelMessage').textContent=e.message||'No se pudo cambiar el estado de la tarea.';}
  finally{button.disabled=!canMarkComplete;}
 }
 function clear(){directoryRequest++;directory=[];directoryReady=false;q('taskAssigneeOptions').replaceChildren();busy=false;current=null;draftId=null;queue=[];canManage=false;canMarkComplete=false;api=null;refresh=null;q('taskForm').reset();q('taskExistingFiles').replaceChildren();q('taskHistory').replaceChildren();q('taskFileSelection').replaceChildren();showMessage('');if(q('taskEditor').open)q('taskEditor').close();}
 q('createTask').onclick=()=>open();q('taskCancel').onclick=close;q('taskClose').onclick=close;q('taskNoDeadline').onchange=updateDeadline;q('taskFiles').onchange=fileSelection;q('taskForm').onsubmit=save;
 q('taskEditor').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 return {configure,openCreate:section=>open(section),openEdit:task=>open(task.section,task),clear,canManage:()=>canManage,canComplete:()=>canMarkComplete,setCompleted};
})();
