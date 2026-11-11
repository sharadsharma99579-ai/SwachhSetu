const $=id=>document.getElementById(id);const KEY='swachhsetu_premium_v1';let mode='login';let state;try{state=JSON.parse(localStorage.getItem(KEY))}catch(e){}if(!state||!Array.isArray(state.users))state={users:[],complaints:[],scans:[],session:null};state.users ||= [];state.complaints=Array.isArray(state.complaints)?state.complaints:[];state.scans=Array.isArray(state.scans)?state.scans:[];save();
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){alert('Browser storage unavailable. Try Chrome with local file permissions.')}}
function current(){return state.users.find(u=>u.id===state.session)||null}function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(window._tt);window._tt=setTimeout(()=>$('toast').style.display='none',3500)}
const names={home:'Overview',scan:'Waste Scanner',report:'Report Issue',track:'Track Complaints',facilities:'Facilities',dashboard:'Dashboard',auth:'Login / Sign Up'};
function show(page){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('crumb').textContent=names[page];if(page==='dashboard')dashboard();if(page==='track')track();if(page==='scan')scanHistory();if(page==='home')homeStats();if(page==='auth')updateAuth();window.scrollTo(0,0)}
function authTab(m){mode=m;$('tabLogin').classList.toggle('selected',m==='login');$('tabSignup').classList.toggle('selected',m==='signup');$('nameWrap').classList.toggle('hidden',m==='login');$('authTitle').textContent=m==='login'?'Login to your account':'Create your citizen account';$('authSubmit').textContent=m==='login'?'Login →':'Create Account →'}
function updateAuth(){let u=current();$('accountButton').textContent=u?'👤 '+u.name:'👤 Login / Sign Up';$('loggedIn').classList.toggle('hidden',!u);$('authSubmit').classList.toggle('hidden',!!u);if(u){$('authTitle').textContent='Logged in as '+u.name;$('tabLogin').classList.add('hidden');$('tabSignup').classList.add('hidden')}else{$('tabLogin').classList.remove('hidden');$('tabSignup').classList.remove('hidden');authTab(mode)}}
function submitAuth(){let email=$('email').value.trim().toLowerCase(),password=$('password').value,name=$('name').value.trim();if(!email.includes('@')||!email.includes('.'))return toast('Enter a valid email');if(password.length<8)return toast('Password must be at least 8 characters');if(mode==='signup'){if(name.length<2)return toast('Enter your full name');if(state.users.some(u=>u.email===email))return toast('Email already registered');let u={id:'u'+Date.now(),name,email,password,role:'citizen'};state.users.push(u);state.session=u.id;save();toast('Account created successfully!')}else{let u=state.users.find(u=>u.email===email&&u.password===password);if(!u)return toast('Incorrect email or password');state.session=u.id;save();toast('Welcome back, '+u.name+'!')}updateAuth();show('dashboard')}
function logout(){state.session=null;save();updateAuth();toast('Logged out');show('home')}
function requireLogin(){if(current())return true;toast('Please login first');show('auth');return false}
function mineComplaints(){let u=current();return !u?[]:u.role==='admin'?state.complaints:state.complaints.filter(c=>c.uid===u.id)}
function mineScans(){let u=current();return !u?[]:state.scans.filter(s=>s.uid===u.id)}
function homeStats(){let u=current(),c=mineComplaints(),s=mineScans();let values=[['🌱','Green Points',s.length*10],['📷','Your Scans',s.length],['📋','Complaints',c.length],['✓','Resolved',c.filter(x=>x.status==='Resolved').length]];$('homeStats').innerHTML=values.map(([ico,label,n])=>`<div class="stat"><div class="symbol">${ico}</div><strong>${n}</strong><span>${label}</span></div>`).join('')}
function previewImage(){let f=$('wasteImage').files[0],img=$('preview');if(!f)return;if(!f.type.startsWith('image/'))return toast('Choose an image');if(img.dataset.url)URL.revokeObjectURL(img.dataset.url);let url=URL.createObjectURL(f);img.src=url;img.dataset.url=url;img.style.display='block'}
const advice={Wet:['Organic / Wet Waste','Separate food scraps and plant waste. Compost when possible or use designated wet-waste collection.','🥬'],Dry:['Dry / Recyclable Waste','Keep paper, plastic, metal and glass clean and dry. Send to suitable recycling collection.','📦'],Hazardous:['Hazardous Waste','Do not mix batteries, chemicals, paints or sharps with household waste. Consult an authorized handler.','⚠️'],'E-Waste':['Electronic Waste','Use authorized e-waste collection channels. Avoid breaking devices or putting them in household bins.','🔋']};
function scan(){let cat=$('wasteCategory').value,[title,info,emoji]=advice[cat];$('scanResult').innerHTML=`<div class="result"><h3>${emoji} ${title}</h3><p>${info}</p><small>Category selected manually — no AI prediction performed.</small></div>`;if(current()){state.scans.push({id:Date.now(),uid:current().id,category:cat,date:new Date().toLocaleString()});save();toast('Scan saved · +10 demo green points')}else toast('Guidance shown. Login to save scans.');scanHistory()}
function scanHistory(){let a=mineScans().slice().reverse().slice(0,6);$('scanHistory').innerHTML=a.length?a.map(s=>`<div class="rowitem"><strong>${safe(s.category)} waste</strong><small>${safe(s.date)}</small></div>`).join(''):'<p class="hint">Login and scan an item to see history.</p>'}
function getLocation(){if(!navigator.geolocation)return toast('GPS not supported');navigator.geolocation.getCurrentPosition(p=>{$('location').value=p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5);toast('GPS coordinates added')},()=>toast('Location unavailable. Enter landmark manually.'),{timeout:10000})}
function report(){if(!requireLogin())return;let desc=$('description').value.trim(),loc=$('location').value.trim();if(desc.length<8||loc.length<3)return toast('Add a description (8+ chars) and location');let c={id:'SS-'+Date.now().toString().slice(-8),uid:current().id,citizen:current().name,issue:$('issue').value,description:desc,location:loc,status:'Reported',date:new Date().toLocaleString()};state.complaints.push(c);save();$('description').value='';$('location').value='';toast('Complaint '+c.id+' submitted');show('track')}
function renderComplaints(target,items,admin){$(target).innerHTML=items.length?items.slice().reverse().map(c=>`<div class="rowitem"><strong>${safe(c.issue)} <span class="status ${c.status==='Resolved'?'resolved':''}">${safe(c.status)}</span></strong><p>${safe(c.description)}</p><p>📍 ${safe(c.location)}</p><small>${safe(c.id)} · ${safe(c.date)} ${admin?'· '+safe(c.citizen):''}</small>${admin?`<select onchange="changeStatus('${c.id}',this.value)">${['Reported','Assigned','In Progress','Resolved'].map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}</select>`:''}</div>`).join(''):'<p class="hint">No complaints yet. Submit your first report.</p>'}
function track(){if(!current()){$('trackList').innerHTML='<p class="hint">Please log in to track complaints.</p>';return}renderComplaints('trackList',mineComplaints(),current().role==='admin')}
function changeStatus(id,status){if(current()?.role!=='admin')return toast('Admin access required');let c=state.complaints.find(x=>x.id===id);if(!c)return;c.status=status;save();toast('Status updated to '+status);track();dashboard()}
function dashboard(){let u=current();if(!u){$('dashboardTitle').textContent='Dashboard';$('dashboardSub').textContent='Login to view your dashboard';$('dashboardStats').innerHTML='<div class="stat"><span>Login required</span><p><button class="btn small" onclick="show(\'auth\')">Login / Sign Up</button></p></div>';$('dashboardComplaints').innerHTML='';$('categoryBreakdown').innerHTML='';$('rewardPoints').textContent='0';$('progressBar').style.width='0%';$('progressText').textContent='No data';return}let c=mineComplaints(),s=mineScans(),resolved=c.filter(x=>x.status==='Resolved').length,admin=u.role==='admin';$('dashboardTitle').textContent=admin?'Municipal Admin Dashboard':'Hello, '+u.name+' 👋';$('dashboardSub').textContent=admin?'Manage demo citizen complaints and monitor progress':'Your personal activity, complaints and green impact';let metrics=[['📋','Total Complaints',c.length],['⏳','Pending',c.length-resolved],['✓','Resolved',resolved],['📸',admin?'Total Scans': 'Your Scans',admin?state.scans.length:s.length]];$('dashboardStats').innerHTML=metrics.map(([i,l,v])=>`<div class="stat"><div class="symbol">${i}</div><strong>${v}</strong><span>${l}</span></div>`).join('');let pct=c.length?Math.round(100*resolved/c.length):0;$('progressText').textContent=pct+'% of complaints resolved';$('progressBar').style.width=pct+'%';renderComplaints('dashboardComplaints',c.slice(-5),admin);$('rewardPoints').textContent=s.length*10;let counts={Wet:0,Dry:0,Hazardous:0,'E-Waste':0};s.forEach(x=>{if(x.category in counts)counts[x.category]++});$('categoryBreakdown').innerHTML=Object.entries(counts).map(([k,v])=>`<div class="rowitem"><strong>${safe(k)} <span class="tag" style="float:right">${v}</span></strong></div>`).join('')}
function maps(q){window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q),'_blank','noopener,noreferrer')}
updateAuth();homeStats();

// ===== REAL AI + SUPABASE INTEGRATIONS =====
const CONFIG_KEY='swachhsetu_integrations_v1';
let config={};try{config=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')||{}}catch(e){config={}}
let cloudClient=null, cloudSession=null, aiModel=null;
function integrationStatus(msg){const e=$('cloudStatus');if(e)e.textContent=msg;}
function saveIntegrations(){
  config={url:$('sbUrl').value.trim().replace(/\/$/,''),key:$('sbKey').value.trim(),model:$('modelUrl').value.trim()};
  localStorage.setItem(CONFIG_KEY,JSON.stringify(config));
  aiModel=null;genericModel=null;cloudClient=null;cloudSession=null;
  initializeCloud();toast('Connection settings saved');
}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Could not load library. Check internet connection.'));document.head.appendChild(s)})}
async function initializeCloud(){
  $('sbUrl').value=config.url||'';$('sbKey').value=config.key||'';$('modelUrl').value=config.model||'';
  $('aiStatus').textContent=config.model?'Custom waste model configured. Upload photo to classify.':'Pretrained AI ready. Upload photo to classify (internet required).';
  if(!config.url||!config.key){integrationStatus('Local demo mode — configure Supabase for cloud storage.');return}
  try{
    if(!window.supabase)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
    cloudClient=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true}});
    const {data,error}=await cloudClient.auth.getSession();if(error)throw error;
    cloudSession=data.session;
    integrationStatus(cloudSession?'Supabase connected ✓ Logged in':'Supabase connected ✓ Please log in');
    if(cloudSession)await loadCloudData();
  }catch(e){integrationStatus('Cloud connection failed: '+e.message)}
}
// Supabase authentication is used when configured; local demo authentication otherwise.
const demoSubmitAuth=submitAuth;
submitAuth=async function(){
  if(!cloudClient)return demoSubmitAuth();
  const email=$('email').value.trim().toLowerCase(),password=$('password').value,name=$('name').value.trim();
  if(password.length<8)return toast('Password must be at least 8 characters');
  try{
    const res=mode==='signup' ? await cloudClient.auth.signUp({email,password,options:{data:{name}}}) : await cloudClient.auth.signInWithPassword({email,password});
    if(res.error)throw res.error;
    if(!res.data.session){toast('Check your email to confirm your account, then log in.');return}
    cloudSession=res.data.session;
    state.session='cloud-'+cloudSession.user.id;
    const cloudUser={id:state.session,name:cloudSession.user.user_metadata?.name||email.split('@')[0],email,role:'citizen'};
    state.users=state.users.filter(x=>x.id!==cloudUser.id);state.users.push(cloudUser);save();
    await loadCloudData();updateAuth();show('dashboard');toast('Supabase login successful');
  }catch(e){toast('Cloud login: '+e.message)}
};
const demoLogout=logout;
logout=async function(){if(cloudClient)await cloudClient.auth.signOut();cloudSession=null;demoLogout()};
async function loadCloudData(){
  if(!cloudClient)return integrationStatus('Configure Supabase first');
  const {data:{session}}=await cloudClient.auth.getSession();cloudSession=session;
  if(!session)return integrationStatus('Supabase connected — log in to load data');
  const uid=session.user.id;
  const [a,b]=await Promise.all([cloudClient.from('complaints').select('*').order('created_at',{ascending:true}),cloudClient.from('scans').select('*').order('created_at',{ascending:true})]);
  if(a.error||b.error)return integrationStatus('Tables/RLS error: '+(a.error||b.error).message);
  state.complaints=a.data.map(x=>({id:x.id,uid:'cloud-'+x.user_id,citizen:x.citizen||'Citizen',issue:x.issue,description:x.description,location:x.location,status:x.status,date:new Date(x.created_at).toLocaleString()}));
  state.scans=b.data.map(x=>({id:x.id,uid:'cloud-'+x.user_id,category:x.category,date:new Date(x.created_at).toLocaleString()}));
  state.session='cloud-'+uid;
  const u={id:state.session,name:session.user.user_metadata?.name||session.user.email,email:session.user.email,role:'citizen'};
  state.users=state.users.filter(x=>x.id!==u.id);state.users.push(u);save();
  integrationStatus('Supabase connected ✓ '+a.data.length+' complaints · '+b.data.length+' scans');
  homeStats();if($('dashboard').classList.contains('active'))dashboard();
}
const demoReport=report;
report=async function(){
  if(!cloudClient)return demoReport();
  if(!cloudSession)return toast('Please sign in with Supabase');
  const description=$('description').value.trim(),location=$('location').value.trim();
  if(description.length<8||location.length<3)return toast('Enter description and location');
  const row={user_id:cloudSession.user.id,citizen:current()?.name||'Citizen',issue:$('issue').value,description,location,status:'Reported'};
  const {error}=await cloudClient.from('complaints').insert(row);
  if(error)return toast('Save failed: '+error.message);
  $('description').value='';$('location').value='';await loadCloudData();show('track');toast('Complaint saved to Supabase');
};
const demoScan=scan;
scan=async function(){
  if(!cloudClient)return demoScan();
  const cat=$('wasteCategory').value,[title,info,emoji]=advice[cat];
  $('scanResult').innerHTML=`<div class="result"><h3>${emoji} ${title}</h3><p>${info}</p></div>`;
  if(!cloudSession)return toast('Log in with Supabase to save scans');
  const {error}=await cloudClient.from('scans').insert({user_id:cloudSession.user.id,category:cat});
  if(error)return toast('Save failed: '+error.message);
  await loadCloudData();scanHistory();toast('Scan saved to Supabase');
};
async function loadAnyScript(urls){
  let lastError;
  for(const url of urls){
    try { await loadScript(url); return; }
    catch(e){ lastError=e; }
  }
  throw new Error('AI library download blocked. Check internet, browser tracking protection or network restrictions. '+(lastError?.message||''));
}
// Automatic image recognition: generic MobileNet image labels are mapped cautiously.
// This is NOT a waste-trained classifier. Uncertain labels require manual review.
let genericModel=null;
const keywordGroups={
  'E-Waste':[/cellular telephone/,/cellphone/,/mobile phone/,/laptop/,/notebook computer/,/desktop computer/,/computer keyboard/,/computer mouse/,/monitor/,/television/,/remote control/,/printer/,/digital clock/,/radio/,/microphone/,/headphone/,/ipod/,/modem/,/hard disc/,/electric fan/,/vacuum cleaner/],
  'Wet':[/banana/,/orange/,/lemon/,/apple/,/pineapple/,/strawberry/,/broccoli/,/cauliflower/,/cucumber/,/zucchini/,/mushroom/,/corn/,/artichoke/,/bell pepper/,/cabbage/,/pomegranate/,/fig/,/potato/,/carrot/],
  'Dry':[/water bottle/,/pop bottle/,/beer bottle/,/wine bottle/,/plastic bag/,/paper towel/,/envelope/,/carton/,/cardboard/,/newspaper/,/book jacket/,/packet/,/tin can/,/soda can/,/milk can/,/glass bottle/,/shopping basket/]
};
function suggestedCategory(label){
  const l=label.toLowerCase();
  for(const [category,patterns] of Object.entries(keywordGroups)){
    if(patterns.some(p=>p.test(l)))return category;
  }
  return null;
}
function renderPrediction(label,score,category,source){
  const result=document.createElement('div');result.className='result';
  const heading=document.createElement('h3');heading.textContent='🤖 Recognized: '+label;
  const confidence=document.createElement('p');confidence.textContent='Model score: '+(score*100).toFixed(1)+'% · '+source;
  const suggestion=document.createElement('p');
  suggestion.textContent=category?'Suggested waste category: '+category+'. '+advice[category][1]:'No reliable waste category mapped from this object. Please select category manually.';
  const caution=document.createElement('small');
  caution.textContent='Experimental suggestion, not a verified waste classification. The score is not disposal accuracy. Never rely on this to identify hazardous materials.';
  result.append(heading,confidence,suggestion,caution);
  $('scanResult').replaceChildren(result);
  if(category)$('wasteCategory').value=category;
  $('aiStatus').textContent=category?'Suggested: '+category+' · Please verify before saving.':'Object recognized, category uncertain. Use Manual fallback.';
}
async function classifyAI(){
  const file=$('wasteImage').files[0];
  if(!file||!file.type.startsWith('image/'))return toast('Upload a valid waste image first');
  const button=$('aiButton');button.disabled=true;
  $('aiStatus').textContent='Loading image model... first use may take a minute.';
  try{
    const image=$('preview');
    if(!image.complete||!image.naturalWidth)await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Image preview timed out')),12000);image.addEventListener('load',()=>{clearTimeout(timeout);resolve()},{once:true});image.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Could not decode image'))},{once:true})});
    if(!window.tf)await loadAnyScript(['https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js','https://unpkg.com/@tensorflow/tfjs@4.22.0/dist/tf.min.js']);
    if(config.model){
      if(!window.tmImage)await loadAnyScript(['https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js','https://unpkg.com/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js']);
      const base=config.model.replace(/\/$/,'')+'/';
      if(!aiModel)aiModel=await window.tmImage.load(base+'model.json',base+'metadata.json');
      const predictions=await aiModel.predict(image);
      predictions.sort((a,b)=>b.probability-a.probability);
      const best=predictions[0];
      const normalized=best.className.toLowerCase().replace(/[^a-z]/g,'');
      const mapping={wet:'Wet',organic:'Wet',biodegradable:'Wet',dry:'Dry',recyclable:'Dry',hazardous:'Hazardous',ewaste:'E-Waste',electronic:'E-Waste'};
      renderPrediction(best.className,best.probability,mapping[normalized]||null,'Custom waste model');
    }else{
      if(!window.mobilenet)await loadAnyScript(['https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js','https://unpkg.com/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js']);
      if(!genericModel)genericModel=await window.mobilenet.load({version:2,alpha:1.0});
      $('aiStatus').textContent='Recognizing objects in photo...';
      const predictions=await genericModel.classify(image,5);
      const mapped=predictions.map(p=>({...p,category:suggestedCategory(p.className)}));
      const match=mapped.find(p=>p.category && p.probability>=0.15);
      const best=match||predictions[0];
      renderPrediction(best.className,best.probability,match?match.category:null,'Generic pretrained MobileNet (not waste-trained)');
    }
    toast('Image analyzed. Review suggested category, then click Manual fallback to save.');
  }catch(e){
    $('aiStatus').textContent='AI could not load: '+e.message+' | Try opening this file through a local web server if Edge blocks file:// model loading.'; console.error('SwachhSetu AI failure:',e);
    toast('Internet/model unavailable. Manual category selection still works.');
  }finally{button.disabled=false}
}

initializeCloud();
