'use strict';
// SwachhSetu hackathon demo backend: Node.js 18+, no external dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const ROOT = path.resolve(__dirname, '../frontend');
const DB = process.env.SWACHHSETU_DB_PATH ? path.resolve(process.env.SWACHHSETU_DB_PATH) : path.join(__dirname, 'data', 'database.json');
const PORT = Number(process.env.PORT || 3000);
if(!Number.isInteger(PORT)||PORT<0||PORT>65535)throw Error('PORT must be a valid TCP port');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const fresh = () => ({users:[],complaints:[],scans:[],sessions:[]});
function load() {try {const d=JSON.parse(fs.readFileSync(DB,'utf8'));for(const k of ['users','complaints','scans','sessions'])if(!Array.isArray(d[k]))throw Error('Corrupt database');return d} catch(e){if(e.code==='ENOENT')return fresh();throw e}}
const db = load();
function save() {fs.mkdirSync(path.dirname(DB),{recursive:true});const tmp=DB+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(tmp,DB)}
const key = () => crypto.randomBytes(32).toString('hex');
const uid = () => crypto.randomUUID();
const digest = (secret) => crypto.createHash('sha256').update(secret).digest('hex');
const passhash = (pass,salt) => crypto.scryptSync(pass,salt,64).toString('hex');
function createUser(name,email,password,role='citizen') {const salt=crypto.randomBytes(16).toString('hex');const user={id:uid(),name,email,salt,hash:passhash(password,salt),role};db.users.push(user);save();return user}
function publicUser(u){return{id:u.id,name:u.name,email:u.email,role:u.role}}
function issueToken(u){const token=key();db.sessions.push({userId:u.id,tokenHash:digest(token)});save();return token}
// Optional admin configured by environment, no hardcoded administrator password.
if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD){
  const email=process.env.ADMIN_EMAIL.trim().toLowerCase();
  if(process.env.ADMIN_PASSWORD.length<12)throw Error('ADMIN_PASSWORD must be at least 12 characters');
  if(!db.users.some(u=>u.email===email))createUser('Municipal Admin',email,process.env.ADMIN_PASSWORD,'admin');
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function fail(res,status,message){send(res,status,{error:message})}
function readJSON(req){return new Promise((resolve,reject)=>{let raw='';let size=0;let tooLarge=false;req.on('data',c=>{size+=c.length;if(size>65536){tooLarge=true;return}if(!tooLarge)raw+=c});req.on('end',()=>{if(tooLarge)return reject(Object.assign(Error('Request too large'),{status:413}));try{const x=JSON.parse(raw||'{}');if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Expected JSON object');resolve(x)}catch(e){reject(Object.assign(Error('Invalid JSON body'),{status:400}))}});req.on('error',reject)})}
function auth(req){const value=req.headers.authorization||'';const match=/^Bearer\s+([a-f0-9]{64})$/i.exec(value);if(!match)return null;const row=db.sessions.find(s=>s.tokenHash===digest(match[1]));return row?db.users.find(u=>u.id===row.userId)||null:null}
function authorized(req,res){const u=auth(req);if(!u)fail(res,401,'Authentication required');return u}
const attempts=new Map();
function checkRate(req,res){const now=Date.now();const ip=req.socket.remoteAddress||'unknown';const v=attempts.get(ip)||{start:now,n:0};if(now-v.start>60000){v.start=now;v.n=0}v.n++;attempts.set(ip,v);if(v.n>40){fail(res,429,'Too many attempts. Try later.');return false}return true}
async function api(req,res,p){
  if(req.method==='GET'&&p==='/api/health')return send(res,200,{status:'ok',app:'SwachhSetu'});
  if(req.method==='POST'&&p==='/api/auth/signup'){
    if(!checkRate(req,res))return;
    const d=await readJSON(req);const name=String(d.name||'').trim(),email=String(d.email||'').trim().toLowerCase(),password=d.password;
    if(name.length<2||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<8||password.length>256)return fail(res,400,'Valid name, email, and password (8–256 characters) required');
    if(db.users.some(u=>u.email===email))return fail(res,409,'Email already registered');
    const u=createUser(name,email,password);return send(res,201,{token:issueToken(u),user:publicUser(u)});
  }
  if(req.method==='POST'&&p==='/api/auth/login'){
    if(!checkRate(req,res))return;
    const d=await readJSON(req);if(typeof d.email!=='string'||typeof d.password!=='string')return fail(res,400,'Email and password required');
    if(d.email.length>254||d.password.length>256)return fail(res,400,'Invalid credentials');
    const u=db.users.find(x=>x.email===d.email.trim().toLowerCase());
    if(!u)return fail(res,401,'Invalid credentials');
    const got=Buffer.from(passhash(d.password,u.salt),'hex'),want=Buffer.from(u.hash,'hex');
    if(got.length!==want.length||!crypto.timingSafeEqual(got,want))return fail(res,401,'Invalid credentials');
    return send(res,200,{token:issueToken(u),user:publicUser(u)});
  }
  const u=authorized(req,res);if(!u)return;
  if(req.method==='POST'&&p==='/api/auth/logout'){
    const token=req.headers.authorization.slice(7);db.sessions=db.sessions.filter(s=>s.tokenHash!==digest(token));save();return send(res,200,{ok:true});
  }
  if(req.method==='GET'&&p==='/api/bootstrap'){
    const admin=u.role==='admin';return send(res,200,{user:publicUser(u),complaints:db.complaints.filter(c=>admin||c.uid===u.id),scans:db.scans.filter(s=>admin||s.uid===u.id)});
  }
  if(req.method==='GET'&&p==='/api/complaints')return send(res,200,db.complaints.filter(c=>u.role==='admin'||c.uid===u.id));
  if(req.method==='POST'&&p==='/api/complaints'){
    const d=await readJSON(req);const issue=String(d.issue||'').trim(),description=String(d.description||'').trim(),location=String(d.location||'').trim();
    if(issue.length<2||issue.length>100||description.length<8||description.length>3000||location.length<3||location.length>500)return fail(res,400,'Valid issue, description and location required');
    const c={id:'SS-'+Date.now()+'-'+crypto.randomBytes(2).toString('hex'),uid:u.id,citizen:u.name,issue,description,location,status:'Reported',date:new Date().toLocaleString()};db.complaints.push(c);save();return send(res,201,c);
  }
  if(req.method==='GET'&&p==='/api/scans')return send(res,200,db.scans.filter(s=>s.uid===u.id));
  if(req.method==='POST'&&p==='/api/scans'){
    const d=await readJSON(req);if(!['Wet','Dry','Hazardous','E-Waste'].includes(d.category))return fail(res,400,'Invalid waste category');
    const s={id:uid(),uid:u.id,category:d.category,date:new Date().toLocaleString()};db.scans.push(s);save();return send(res,201,s);
  }
  const m=/^\/api\/complaints\/([^/]+)\/status$/.exec(p);
  if(req.method==='PATCH'&&m){
    if(u.role!=='admin')return fail(res,403,'Admin access required');
    const d=await readJSON(req);if(!['Reported','Assigned','In Progress','Resolved'].includes(d.status))return fail(res,400,'Invalid status');
    const c=db.complaints.find(x=>x.id===decodeURIComponent(m[1]));if(!c)return fail(res,404,'Complaint not found');
    c.status=d.status;save();return send(res,200,c);
  }
  return fail(res,404,'Unknown API endpoint');
}
function staticFile(req,res,p){
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
  let pathname;
  try{pathname=decodeURIComponent(p)}catch{return fail(res,400,'Invalid path')}
  if(pathname==='/'||!path.extname(pathname))pathname='/index.html';
  if(pathname.includes('\0') || pathname.split('/').some(x=>x==='..'))return fail(res,403,'Forbidden');
  const target=path.resolve(ROOT,'.'+pathname);
  if(!target.startsWith(ROOT+path.sep))return fail(res,403,'Forbidden');
  fs.stat(target,(e,stat)=>{
    if(e||!stat.isFile())return fail(res,404,'File not found');
    // Do not follow symlinks out of the public frontend directory.
    try{const real=fs.realpathSync(target);if(!real.startsWith(ROOT+path.sep))return fail(res,403,'Forbidden')}catch{return fail(res,404,'File not found')}
    res.writeHead(200,{'Content-Type':MIME[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(target).pipe(res);
  });
}
const server=http.createServer(async(req,res)=>{
  const requestUrl=new URL(req.url,'http://localhost');
  try{if(requestUrl.pathname.startsWith('/api/'))await api(req,res,requestUrl.pathname);else staticFile(req,res,requestUrl.pathname)}
  catch(e){console.error('Request failed:',e.message);if(!res.headersSent)fail(res,e.status||500,e.status?e.message:'Internal server error')}
});
if(require.main===module)server.listen(PORT,()=>console.log(`SwachhSetu: http://localhost:${PORT}`));
module.exports={server};
