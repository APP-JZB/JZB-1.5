window.JzbTaskProgress=(()=>{
 let api=null,profile={},active=null,requestId=0,assignedIds=[];
 const q=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function configure(request,p){api=request;profile=p;assignedIds=[];if(p.id)request('/rest/v1/jzb_responsibles?select=id&active=eq.true&profile_id=eq.'+encodeURIComponent(p.id)).then(rows=>{if(profile===p)assignedIds=rows.map(r=>r.id);}).catch(()=>{});}
 function canWrite(t){return t.status!=='finalizada'&&(['admin','jefe','subjefe'].includes(profile.role)||(profile.role==='user'&&(profile.section===t.section||(t.responsible_ids||[]).some(id=>assignedIds.includes(id)))));}
 async function read(task,version){
  q('progressHistory').textContent='Cargando comentarios…';
  try{const rows=await api('/rest/v1/jzb_task_comments?select=actor_name,section,body,ready_for_review,created_at&task_id=eq.'+encodeURIComponent(task.id)+'&order=created_at.desc');if(version!==requestId)return;
   q('progressHistory').replaceChildren();if(!rows.length)q('progressHistory').append(el('p','Todavía no hay avances registrados.'));
   rows.forEach(r=>{const a=el('article','');a.className='progress-entry';a.append(el('strong',r.actor_name+' · '+r.section),el('p',new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(r.created_at))),el('b',r.ready_for_review?'Lista para revisión de la Jefatura':'Trabajo en desarrollo'),el('p',r.body));q('progressHistory').append(a);});
  }catch(e){if(version===requestId)q('progressHistory').textContent='No fue posible cargar los comentarios. Cierra y vuelve a abrir para reintentar.';}
 }
 function open(task){if(!api)return;active=task;const version=++requestId;q('progressTitle').textContent='Avances · '+task.title;q('progressForm').reset();q('progressForm').hidden=!canWrite(task);q('progressMessage').textContent='';q('progressSave').disabled=false;q('progressDialog').showModal();read(task,version);}
 q('progressForm').onsubmit=async e=>{e.preventDefault();if(!active||!canWrite(active)||q('progressSave').disabled)return;const body=q('progressBody').value.trim();if(!body){q('progressMessage').textContent='Escribe el trabajo realizado.';return;}
  const task=active,version=requestId;q('progressSave').disabled=true;
  try{await api('/rest/v1/jzb_task_comments',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),task_id:task.id,body,ready_for_review:q('progressReady').checked})});if(version!==requestId)return;q('progressForm').reset();q('progressMessage').textContent='Avance guardado. La Jefatura debe confirmar el cierre de la tarea.';await read(task,version);await window.JzbDashboard.load(api);}
  catch(e){if(version===requestId)q('progressMessage').textContent='No se pudo guardar. Verifica que la tarea siga abierta y pertenezca a tu sección antes de reintentar.';}
  finally{if(version===requestId)q('progressSave').disabled=false;}
 };
 q('progressClose').onclick=()=>q('progressDialog').close();q('progressDialog').addEventListener('close',()=>{requestId++;active=null;});
 function clear(){requestId++;active=null;api=null;profile={};assignedIds=[];q('progressDialog').close();q('progressForm').reset();q('progressHistory').replaceChildren();}
 return {configure,open,clear,canWrite};
})();
