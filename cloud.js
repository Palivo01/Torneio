(function(root){
'use strict';
const cfg=root.TORNEIO_CONFIG||{};
const configured=Boolean(/^https:\/\/[^/]+/.test(cfg.supabaseUrl||'')&&cfg.supabasePublishableKey);
let client=null,revision=null,session=null,role=null,context={admin:false,id:null,token:null};
function getClient(){
 if(!configured)throw Error('Configure a conexão do projeto.');
 if(!root.supabase?.createClient)throw Error('Não foi possível carregar a conexão.');
 if(!client){client=root.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'torneio-auth-'+(cfg.tournamentId||'principal')}});client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){session=null;role=null;root.dispatchEvent(new CustomEvent('torneio-signed-out'));}if(event==='PASSWORD_RECOVERY')root.dispatchEvent(new CustomEvent('torneio-recovery'));});}
 return client;
}
function backendError(error){if(!error)return;if(['42P01','PGRST202','PGRST205','42883'].includes(error.code))throw Error('Execute a migração SQL da versão 5 antes de usar este painel.');throw Error(error.message||'Não foi possível acessar o servidor.');}
async function rpc(name,args){const r=await getClient().rpc(name,args);backendError(r.error);return r.data;}
const first=data=>Array.isArray(data)?data[0]||null:data;
function configure(value){context={admin:Boolean(value.admin),id:value.id||null,token:value.token||null};revision=null;}
async function identify(){const db=getClient(),stored=await db.auth.getSession();backendError(stored.error);session=stored.data.session;role=null;if(session){const checked=await db.auth.getUser();if(checked.error){await db.auth.signOut({scope:'local'});session=null;}else{const profile=await rpc('rt_profile');role=profile?.role||null;}}return {session,role,admin:Boolean(role)};}
async function list(){if(!role)throw Error('Entre com uma conta autorizada.');return await rpc('rt_list_competitions')||[];}
async function load(){
 let row;
 if(context.admin){if(!context.id)return null;row=first(await rpc('rt_get_competition',{p_id:context.id}));}
 else{if(!context.token)context.token=await rpc('rt_default_public');if(!context.token)return null;row=first(await rpc('rt_public_competition',{p_token:context.token}));}
 if(!row)throw Error('Competição não encontrada ou acompanhamento indisponível.');
 context.id=row.id;if(row.public_token)context.token=row.public_token;return row;
}
function acceptRevision(value){revision=value===null?null:Number(value);}
async function loadIfChanged(){
 const current=context.admin?await rpc('rt_revision',{p_id:context.id}):await rpc('rt_public_revision',{p_token:context.token});
 if(current===null)throw Error('O acesso a esta competição não está disponível.');
 if(Number(current)===revision)return null;
 return load();
}
async function create(payload,requestId){const row=first(await rpc('rt_create_competition',{p_payload:payload,p_id:requestId}));if(!row?.id)throw Error('Não foi possível criar a competição.');return row;}
async function save(payload){if(!session||!role||!context.admin||!context.id)throw Error('Entre com uma conta autorizada para salvar.');const next=await rpc('rt_save_competition',{p_id:context.id,p_payload:payload,p_expected_revision:revision,p_state:root.Arena.competitionState(payload)});acceptRevision(next);return revision;}
async function organizers(){return await rpc('rt_list_organizers')||[];}
async function setOrganizer(email,active){return rpc('rt_set_organizer',{p_email:email,p_active:active});}
async function login(email,password){const r=await getClient().auth.signInWithPassword({email,password});if(r.error)throw Error('Não foi possível entrar. Confira e-mail, senha e conexão.');return identify();}
async function logout(){const r=await getClient().auth.signOut({scope:'local'});backendError(r.error);session=null;role=null;}
async function resetPassword(email){const redirect=new URL('admin.html',document.baseURI);redirect.search='';redirect.hash='';const r=await getClient().auth.resetPasswordForEmail(email,{redirectTo:redirect.href});backendError(r.error);}
async function changePassword(password){const r=await getClient().auth.updateUser({password});backendError(r.error);}
root.TorneioCloud={configured,configure,identify,list,load,loadIfChanged,create,save,organizers,setOrganizer,acceptRevision,login,logout,resetPassword,changePassword,get revision(){return revision;},get session(){return session;},get role(){return role;},get context(){return {...context};}};
})(window);
