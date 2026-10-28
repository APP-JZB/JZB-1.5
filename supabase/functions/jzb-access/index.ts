const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const cors={'Access-Control-Allow-Origin':'https://app-jzb.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:cors});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const eq=(s:string)=>encodeURIComponent(s);
const normalizeLogin=(value:string)=>value.normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase();
async function request(path:string,method='GET',body?:unknown,key=service,bearer=key){const r=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+bearer,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null);if(!r.ok)throw new Error('No fue posible completar la operación. Revisa los datos y vuelve a intentar.');return data;}
const table=(name:string,query='')=>'/rest/v1/'+name+query;
const phone=(v:string)=>{if(!/^[+0-9 ()-]+$/.test(v))return null;let p=v.replace(/[^0-9]/g,'');if(p.length===11&&p.startsWith('56'))p=p.slice(2);return /^9[0-9]{8}$/.test(p)?p:null;};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply(200,{});if(req.method!=='POST')return reply(405,{});
 let lockedId:string|null=null;
 try{
  if(Number(req.headers.get('content-length')||0)>16000)return reply(413,{});
  const text=await req.text();if(text.length>16000)return reply(413,{});const body=JSON.parse(text);
  if(body.action==='provision'){
   if(typeof body.secret!=='string')return reply(401,{});
   const grants=await request(table('jzb_access_bootstrap','?token_hash=eq.'+await hash(body.secret)+'&expires_at=gt.'+eq(new Date().toISOString())));if(grants.length!==1)return reply(401,{});const grant=grants[0];
   const entries=await request(table('jzb_responsibles','?id=eq.'+grant.directory_id));const entry=entries[0];if(!entry||entry.profile_id)return reply(409,{message:'Perfil ya vinculado.'});
   const alias=crypto.randomUUID()+'@access.jzb.invalid';
   const created=await request('/auth/v1/admin/users','POST',{email:alias,email_confirm:true,password:grant.phone.slice(-6),user_metadata:{display_name:entry.rank+' '+entry.full_name}});
   const id=created.id;if(!id)throw new Error('No fue posible crear la cuenta.');
   await request(table('profiles','?id=eq.'+id),'PATCH',{section:entry.section,role:'user',must_change_password:true,display_name:entry.rank+' '+entry.full_name});
   await request(table('jzb_access_accounts'),'POST',{id,phone:grant.phone,auth_email:alias});
   await request(table('jzb_responsibles','?id=eq.'+entry.id),'PATCH',{profile_id:id});
   await request(table('jzb_access_bootstrap','?token_hash=eq.'+grant.token_hash),'DELETE');
   return reply(200,{created:true,id,role:'user',section:entry.section});
  }
  if(body.action==='login'){
   const identifier=normalizeLogin(String(body.identifier||'')),password=String(body.password||'');if(!identifier||identifier.length>254||password.length>1024)return reply(401,{message:'Usuario o contraseña incorrectos.'});
   const p=phone(identifier),key=await hash('login:'+(p||identifier));
   if(!await request('/rest/v1/rpc/jzb_access_rate_limit','POST',{attempt_key:key}))return reply(429,{message:'Demasiados intentos. Espera 15 minutos antes de volver a ingresar.'});
   let email=identifier;
   if(!identifier.includes('@')){const accounts=await request(table('jzb_access_accounts',p?'?phone=eq.'+p:'?username=eq.'+eq(identifier)));const account=accounts[0];if(!account||(p&&account.setup_complete))return reply(401,{message:'Usuario o contraseña incorrectos.'});email=account.auth_email;}
   const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const result=await r.json();if(!r.ok)return reply(401,{message:'Usuario o contraseña incorrectos.'});return reply(200,result);
  }
  const bearer=req.headers.get('authorization')?.replace(/^Bearer /i,'');if(!bearer)return reply(401,{message:'Inicia sesión nuevamente.'});
  const user=await request('/auth/v1/user','GET',undefined,anon,bearer);
  const accounts=await request(table('jzb_access_accounts','?id=eq.'+user.id));const account=accounts[0];
  if(body.action==='setup'){
   if(!account||account.setup_complete)return reply(403,{message:'La cuenta no requiere activación.'});
   const usernameDisplay=String(body.username||'').normalize('NFC').trim().replace(/\s+/gu,' '),username=normalizeLogin(usernameDisplay),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
   if(!/^[\p{L}][\p{L}\p{N} ._-]{2,79}$/u.test(username))return reply(400,{message:'Usuario: entre 3 y 80 caracteres; permite letras, tildes, ñ, espacios, números, punto, guion o guion bajo.'});
   if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return reply(400,{message:'Registra un correo válido.'});
   if(password.length<8||password.length>1024||password===account.phone.slice(-6))return reply(400,{message:'Elige una contraseña nueva de al menos 8 caracteres, distinta de la clave inicial.'});
   const claimed=await request(table('jzb_access_accounts','?id=eq.'+user.id+'&setup_complete=eq.false&or=(setup_lock.is.null,setup_lock.lt.'+eq(new Date(Date.now()-120000).toISOString())+')'),'PATCH',{setup_lock:new Date().toISOString()});if(!claimed.length)return reply(409,{message:'La activación se está guardando. Espera un momento.'});lockedId=user.id;
   const owners=await request(table('jzb_access_accounts','?username=eq.'+eq(username)));if(owners.some((a:{id:string})=>a.id!==user.id))throw new Error('Ese nombre de usuario ya está utilizado. Elige otro.');
   await request(table('jzb_access_accounts','?id=eq.'+user.id),'PATCH',{username,username_display:usernameDisplay,contact_email:email});
   await request('/auth/v1/admin/users/'+user.id,'PUT',{password});
   await request(table('profiles','?id=eq.'+user.id),'PATCH',{email,must_change_password:false});
   await request(table('jzb_access_accounts','?id=eq.'+user.id),'PATCH',{setup_complete:true,setup_lock:null});lockedId=null;
   return reply(200,{complete:true,username:usernameDisplay});
  }
  return reply(400,{message:'Operación no válida.'});
 }catch(e){if(lockedId)try{await request(table('jzb_access_accounts','?id=eq.'+lockedId),'PATCH',{setup_lock:null});}catch{}return reply(400,{message:e instanceof Error?e.message:'No fue posible completar la operación.'});}
});

