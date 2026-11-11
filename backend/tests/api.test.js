'use strict';
const {test,after,before} = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'swachhsetu-test-'));
process.env.SWACHHSETU_DB_PATH=path.join(tmp,'database.json');
process.env.ADMIN_EMAIL='judge-admin@example.test';
process.env.ADMIN_PASSWORD='test-admin-secret-12345';
const {server}=require('../server');
let base, userToken, otherToken, adminToken, complaintId;
before(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 await new Promise(resolve=>server.close(resolve));
 fs.rmSync(tmp,{recursive:true,force:true});
});
async function call(route,method='GET',body,token){
 const headers={};if(body!==undefined)headers['content-type']='application/json';if(token)headers.authorization=`Bearer ${token}`;
 const res=await fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const ct=res.headers.get('content-type')||'';
 return {status:res.status,data:ct.includes('application/json')?await res.json():await res.text(),headers:res.headers};
}
test('Health endpoint and frontend assets work',async()=>{
 const health=await call('/api/health');assert.equal(health.status,200);assert.equal(health.data.app,'SwachhSetu');
 for(const url of ['/','/css/style.css','/js/app.js','/js/api-client.js']){let r=await call(url);assert.equal(r.status,200,url);assert.ok(r.data.length>100,url)}
 const bad=await call('/api/missing');assert.equal(bad.status,401);
});
test('Rejects bad signups, creates citizen account and rejects duplicates',async()=>{
 const invalid=await call('/api/auth/signup','POST',{name:'A',email:'invalid',password:'short'});assert.equal(invalid.status,400);
 const one=await call('/api/auth/signup','POST',{name:'Demo Citizen',email:'citizen@example.test',password:'long-password-123'});
 assert.equal(one.status,201);assert.equal(one.data.user.role,'citizen');assert.ok(one.data.token);userToken=one.data.token;
 assert.equal((await call('/api/auth/signup','POST',{name:'Demo Citizen',email:'citizen@example.test',password:'long-password-123'})).status,409);
 const second=await call('/api/auth/signup','POST',{name:'Other User',email:'other@example.test',password:'long-password-123'});
 assert.equal(second.status,201);otherToken=second.data.token;
});
test('Login rejects wrong password and admin login works',async()=>{
 assert.equal((await call('/api/auth/login','POST',{email:'citizen@example.test',password:'invalid-password'})).status,401);
 const login=await call('/api/auth/login','POST',{email:'citizen@example.test',password:'long-password-123'});
 assert.equal(login.status,200);assert.equal(login.data.user.email,'citizen@example.test');
 const admin=await call('/api/auth/login','POST',{email:'judge-admin@example.test',password:'test-admin-secret-12345'});
 assert.equal(admin.status,200);assert.equal(admin.data.user.role,'admin');adminToken=admin.data.token;
});
test('Authentication blocks unauthorized access and validates complaint submissions',async()=>{
 assert.equal((await call('/api/bootstrap')).status,401);
 assert.equal((await call('/api/complaints')).status,401);
 assert.equal((await call('/api/complaints','POST',{issue:'Overflowing Bin',description:'short',location:'A'},userToken)).status,400);
 const item=await call('/api/complaints','POST',{issue:'Overflowing Bin',description:'Garbage on road near the marketplace',location:'Market road'},userToken);
 assert.equal(item.status,201);assert.equal(item.data.status,'Reported');complaintId=item.data.id;
 const mine=await call('/api/complaints','GET',undefined,userToken);assert.equal(mine.data.length,1);
 const others=await call('/api/complaints','GET',undefined,otherToken);assert.equal(others.data.length,0);
 const admin=await call('/api/complaints','GET',undefined,adminToken);assert.equal(admin.data.length,1);
});
test('Scans save correctly and only appear for account owner',async()=>{
 assert.equal((await call('/api/scans','POST',{category:'Garbage'},userToken)).status,400);
 const scan=await call('/api/scans','POST',{category:'Wet'},userToken);
 assert.equal(scan.status,201);
 const mine=await call('/api/scans','GET',undefined,userToken);assert.equal(mine.data.length,1);
 const others=await call('/api/scans','GET',undefined,otherToken);assert.equal(others.data.length,0);
 const bootstrap=await call('/api/bootstrap','GET',undefined,userToken);assert.equal(bootstrap.data.complaints.length,1);assert.equal(bootstrap.data.scans.length,1);
});
test('Only admin can change complaint status',async()=>{
 const endpoint='/api/complaints/'+encodeURIComponent(complaintId)+'/status';
 assert.equal((await call(endpoint,'PATCH',{status:'Resolved'},userToken)).status,403);
 assert.equal((await call(endpoint,'PATCH',{status:'Unknown'},adminToken)).status,400);
 const changed=await call(endpoint,'PATCH',{status:'Resolved'},adminToken);
 assert.equal(changed.status,200);assert.equal(changed.data.status,'Resolved');
 const mine=await call('/api/complaints','GET',undefined,userToken);assert.equal(mine.data[0].status,'Resolved');
});
test('Logout revokes old bearer token',async()=>{
 assert.equal((await call('/api/auth/logout','POST',{},userToken)).status,200);
 assert.equal((await call('/api/bootstrap','GET',undefined,userToken)).status,401);
});
test('Storage persists on disk, passwords are hashed, session tokens are not stored raw',async()=>{
 const db=JSON.parse(fs.readFileSync(process.env.SWACHHSETU_DB_PATH,'utf8'));
 assert.equal(db.complaints.length,1);assert.equal(db.scans.length,1);
 const citizen=db.users.find(x=>x.email==='citizen@example.test');
 assert.ok(citizen.hash);assert.ok(citizen.salt);assert.equal(citizen.password,undefined);
 assert.ok(db.sessions.every(x=>!('token' in x)&&'tokenHash' in x));
});
