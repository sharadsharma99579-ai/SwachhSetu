'use strict';

const view = document.querySelector('#view');
const nav = document.querySelector('#nav');
const notice = document.querySelector('#notice');
const workspaceTitle = document.querySelector('#workspace-title');
const workspaceUser = document.querySelector('#workspace-user');
const railFoot = document.querySelector('#rail-foot');
const geminiBadge = document.querySelector('#gemini-badge');
const navMarks = {Overview:'⌂',Dashboard:'▦',Report:'⚑',Scanner:'✦','Green Revolt':'◈',Facilities:'⌖',Profile:'◉',
                  'Sign in':'↪','Create account':'+','Sign out':'↩'};
const heroArt = '<div class="hero-visual" aria-hidden="true">🌍</div>';
const navNames = {Scanner:'Gemini AI Scanner',Report:'Report Issue'};
let previewUrl;
const categories = ['Wet','Dry','Hazardous','E-Waste','Unknown / mixed'];
const issues = ['Overflowing bin','Illegal dumping','Missed pickup','Mixed waste','Hazardous waste'];
const spaces = {citizen:'Citizen workspace',officer:'Municipal officer',admin:'Municipal command center'};
const routes = {
  admin: {'Reported':['Under Review','Assigned','Rejected'],'Under Review':['Assigned','Rejected'],
          'Reopened':['Assigned','Rejected'],'Assigned':['Assigned']},
  officer: {'Assigned':['In Progress'],'In Progress':['Awaiting Verification']},
  citizen: {'Awaiting Verification':['Resolved','Reopened']},
};
const advice = {
  Wet:'Separate food and garden scraps. Follow local wet-waste collection or composting guidance.',
  Dry:'Keep clean, dry recyclables separate. Confirm materials accepted by your local recycler.',
  Hazardous:'Keep the item separate and avoid opening or mixing it. Ask your local waste authority about safe collection.',
  'E-Waste':'Keep electronics separate from household waste. Confirm collection options with your local waste authority.',
  'Unknown / mixed':'Keep the items separate for review. Choose individual categories once you can identify them.',
};
let state;
let page = 'Overview';
let demoEnabled = false;
let scan;
let adminFilter = {};
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, x => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[x]));
const date = (seconds) => new Date(seconds*1000).toLocaleString();
const options = (values) => values.map(value => `<option>${escape(value)}</option>`).join('');
const status = (message) => { notice.textContent = message; };
const heading = (title, description) => `<div class="heading"><h1>${title}</h1><p>${description}</p></div>`;

async function api(path, data) {
  const response = await fetch('/api/'+path, data === undefined ? {} : {
    method:'POST', headers:{'Content-Type':'application/json','X-SwachhSetu':'1'},
    body:JSON.stringify(data),
  });
  if (response.status === 401 && state) {
    state = null;
    scan = null;
    render();
  }
  const content = await response.json();
  if (!response.ok) throw new Error(content.error || 'Request failed.');
  return content;
}

async function load() {
  try { state = await api('dashboard'); }
  catch (error) {
    if (error.message !== 'Please sign in to continue.') throw error;
    state = null;
  }
  render();
}

function render() {
  view.setAttribute('aria-busy','false');
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl=undefined; }
  const role = state?.user.role;
  const pages = role==='citizen' ? ['Overview','Scanner','Report','Dashboard','Facilities','Green Revolt','Profile'] :
    role ? ['Dashboard','Profile'] : ['Overview','Facilities','Sign in','Create account'];
  if (!pages.includes(page)) page = pages[0];
  workspaceTitle.textContent = navNames[page] || page;
  workspaceUser.textContent = role ? state.user.name : 'Login / Sign Up';
  workspaceUser.dataset.page = role ? 'Profile' : 'Sign in';
  geminiBadge.textContent = role==='citizen' ?
    (state.gemini_configured?'✦ Gemini key configured':'✦ Gemini setup needed') : '✦ Gemini AI Scanner';
  railFoot.innerHTML = `<strong>♻ SwachhSetu</strong><p>${role ? spaces[role] : 'Smart waste management'}</p>`;
  nav.innerHTML = pages.map(name => `<button data-page="${name}" ${page===name?'aria-current="page"':''}><span class="nav-mark" aria-hidden="true">${navMarks[name]}</span>${navNames[name] || name}</button>`).join('');
  if (role) nav.insertAdjacentHTML('beforeend','<button data-action="logout"><span class="nav-mark" aria-hidden="true">↩</span>Sign out</button>');
  const renderers = {
    Overview:overview, Dashboard:dashboard, Report:reportPage, Scanner:scannerPage,
    'Green Revolt':wallet, Facilities:facilities, Profile:profile,
    'Sign in':() => auth(false), 'Create account':() => auth(true),
  };
  view.innerHTML = renderers[page]();
  for (const button of view.querySelectorAll('button:not(.btn),a.action')) {
    const primary = button.classList.contains('primary');
    button.classList.add('btn', primary ? 'solid' : 'outline');
  }
  if (page==='Report') restoreDraft();
}

function demoLogin() {
  if (!demoEnabled || state) return '';
  return `<section class="panel demo-login"><h2>Quick demo login</h2>
    <div class="actions">
      <button class="btn gemini" data-action="demo-login" data-id="citizen">Continue as Citizen</button>
      <button class="btn outline" data-action="demo-login" data-id="officer">Continue as Officer</button>
      <button class="btn outline" data-action="demo-login" data-id="admin">Continue as Admin</button>
    </div></section>`;
}

function overview() {
  const citizen = state?.user.role==='citizen';
  const balance = citizen ? state.ledger.reduce((total,row)=>total+row.points,0) : 0;
  return `<section class="hero">
    <div><div class="eyebrow">✦ SMART CITY · SUSTAINABLE FUTURE</div>
    <h1>Waste less.<br><span>Live greener.</span></h1>
    <p>Identify waste with Gemini, find the right disposal route and track sanitation reports through cleanup.</p>
    <div class="actions">
      <button class="btn gemini" data-page="${citizen?'Scanner':'Sign in'}">${citizen?'✦ Start Gemini AI Scan →':'Sign in →'}</button>
      <button class="btn outline" data-page="${citizen?'Report':'Create account'}">${citizen?'⚑ Report an Issue':'Create account'}</button>
    </div></div>${heroArt}</section>
    ${demoLogin()}
    ${citizen?`<div class="stats">${metric('Green Points',balance,'♻')}${metric('Scans',state.scans.length,'✦')}
    ${metric('Complaints',state.complaints.length,'⚑')}${metric('Resolved',state.complaints.filter(row=>row.status==='Resolved').length,'✓')}</div>`:''}
    <h2 class="sectiontitle">Explore SwachhSetu</h2>
    <div class="grid">
      <article class="feature"><span class="symbol" aria-hidden="true">✦</span><h3>Gemini AI Scanner</h3><p>Identify waste categories from a photo and review disposal guidance.</p><button class="btn gemini small" data-page="${citizen?'Scanner':'Sign in'}">Open scanner →</button></article>
      <article class="feature"><span class="symbol" aria-hidden="true">⚑</span><h3>Report Sanitation Issues</h3><p>Submit local issues with location and photo evidence.</p><button class="btn outline small" data-page="${citizen?'Report':'Sign in'}">Report an issue →</button></article>
      <article class="feature"><span class="symbol" aria-hidden="true">⌖</span><h3>Disposal Facilities</h3><p>Find disposal options by waste type.</p><button class="btn outline small" data-page="Facilities">View facilities →</button></article>
    </div>`;
}

function auth(signup) {
  return `<div class="auth-layout"><section class="hero"><div class="hero-copy"><p class="eyebrow">Sanitation platform</p>
    ${heading('Cleaner streets start here.', 'Identify waste, find the right disposal route and follow sanitation reports through to verification.')}</div>${heroArt}</section>
    <form class="panel stack compact" data-form="${signup?'signup':'login'}">
    <h2>${signup?'Create a citizen account':'Sign in'}</h2>
    ${signup?'<label>Full name<input name="name" required minlength="2" maxlength="80" autocomplete="name"></label>':''}
    <label>Email<input name="email" type="email" required maxlength="254" autocomplete="username"></label>
    <label>Password<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${signup?'new-password':'current-password'}"></label>
    <button class="primary">${signup?'Create account':'Sign in'}</button></form></div>`;
}

function profile() {
  return heading('Profile', escape(state.user.email))+`<form class="panel stack compact" data-form="profile">
    <label>Display name<input name="name" value="${escape(state.user.name)}" minlength="2" maxlength="80" required></label>
    <button class="primary">Save profile</button></form>`;
}

function gpsButton() {
  return '<button type="button" data-action="gps">Use my location</button>';
}

function reportPage() {
  return heading('Report an issue','Add a landmark and optional photos. Coordinates enable nearby duplicate checks.')+
    `<form class="panel stack report-panel" data-form="complaint">
      <label>Issue type<select name="issue">${options(issues)}</select></label>
      <label>Description<textarea name="description" minlength="8" maxlength="1500" required></textarea></label>
      <label>Street or landmark<input name="location" required minlength="3" maxlength="150"></label>
      <div class="grid"><label>Latitude<input name="lat" type="number" min="-90" max="90" step="any"></label>
      <label>Longitude<input name="lon" type="number" min="-180" max="180" step="any"></label></div>
      <div class="actions">${gpsButton()}</div>
      <label>Before photos (optional, up to 3)<input name="photos" type="file" accept="image/*" multiple></label>
      <div id="matches"></div>
      <button class="primary">Submit report</button>
    </form>`;
}

function draftKey() { return 'swachhsetu-draft-'+state.user.id; }
function clearDraft() { try { localStorage.removeItem(draftKey()); } catch {} }
function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey()) || '{}');
    const form = view.querySelector('form');
    for (const name of ['issue','description','location','lat','lon']) {
      if (typeof draft[name]==='string') form.elements[name].value = draft[name];
    }
  } catch {}
}
function saveDraft(form) {
  try {
    const values = new FormData(form);
    localStorage.setItem(draftKey(),JSON.stringify(Object.fromEntries(
      ['issue','description','location','lat','lon'].map(name => [name,values.get(name)]))));
  } catch {}
}

function scannerPage() {
  const history = state.scans.map(item => `<tr><td>${date(item.created)}</td><td>${escape(item.category)}</td>
    <td>${escape(item.result.source)}</td><td>${item.confirmed?'Confirmed':'Pending'}${item.confirmed?'':` <button data-action="review" data-id="${item.id}">Review</button>`}</td></tr>`).join('');
  const configured = state.gemini_configured;
  return heading('Waste scanner','Try Gemini on a photo, choose a category yourself, or review a labelled sample.')+
    `<div class="grid scanner-grid"><form class="panel stack scanner-card" data-form="scanner">
    <div><h2>Identify from a photo</h2><span class="pill ${configured?'':'pending'}">${configured?'Gemini key configured':'Gemini setup needed'}</span></div>
    <label class="upload">Waste image<input name="photo" type="file" accept="image/*" capture="environment"></label>
    <img class="photo-preview" data-photo-preview alt="Selected waste photo" hidden>
    ${configured?'<p class="quiet">Online classification sends the selected photo to Google Gemini.</p>':
      '<p class="quiet">On the server computer, run <code>python server.py --configure-gemini</code>, then restart the server. Manual and demo scans are available now.</p>'}
    <button class="btn gemini" name="mode" value="gemini" ${configured?'':'disabled'}>Analyze with Gemini</button>
    <label>Manual category<select name="category">${options(categories)}</select></label>
    <div class="actions"><button name="mode" value="manual">Use manual category</button><button name="mode" value="sample">Show demo sample</button></div></form>
    <section class="panel scanner-result" id="scan-result"><h2>Classification result</h2>${scan?scanResult():'<p class="quiet">Choose a classification method to begin.</p>'}</section></div>
    <section class="panel"><h2>Scan history</h2>${history?`<div class="table"><table><thead><tr><th>Date</th><th>Category</th><th>Source</th><th>Status</th></tr></thead><tbody>${history}</tbody></table></div>`:'<p class="quiet">Your scans will appear here.</p>'}</section>`;
}

function scanResult() {
  return `<p class="pill">${escape(scan.source)}</p> <strong>${escape(scan.category)}</strong>
  <p>${escape(scan.explanation)}</p>${scan.items.length?`<ul>${scan.items.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`:''}
  ${scan.review?'<p class="warn">Review the category before disposing of this item.</p>':''}
  <p data-scan-advice>${escape(advice[scan.category])}</p>
  <button data-action="facility-category" data-category="${escape(scan.category)}">Find disposal options</button>
  <form class="stack" data-form="confirm" data-id="${scan.id}">
  <label>Confirmed category<select name="category">${categories.map(c=>`<option ${c===scan.category?'selected':''}>${escape(c)}</option>`).join('')}</select></label>
  <label>Correction feedback (optional)<input name="feedback" maxlength="500"></label>
  <button class="primary">Confirm scan</button></form>`;
}

function wallet() {
  const balance = state.ledger.reduce((sum,item)=>sum+item.points,0);
  return heading('Green Revolt', 'Confirm learning scans to earn 2 points per scan, capped at 10 points per rolling 24 hours. Sample scans earn zero.')+
    `<div class="stat wallet-balance"><div class="symbol" aria-hidden="true">◈</div><span>Green Wallet balance</span><strong>${balance} pts</strong></div>
    <div class="grid">${state.rewards.map(reward=>`<article class="panel reward-card"><p class="pill">Demo reward</p>
      <h2>${escape(reward.title)}</h2><p>Simulated redemption · ${reward.cost} points</p>
      <button data-action="redeem" data-id="${reward.id}" ${balance<reward.cost?'disabled':''}>Redeem demo reward</button>
    </article>`).join('')}</div><section class="panel"><h2>Transactions</h2>${state.ledger.length?
      `<ul>${state.ledger.map(row=>`<li>${row.points>0?'+':''}${row.points} pts · ${row.points>0?'Educational scan':'Demo redemption'} · ${date(row.created)}</li>`).join('')}</ul>`:
      '<p class="quiet">No transactions yet.</p>'}</section>`;
}

const directory = [
  {name:'Sample dry recycling point',category:'Dry',lat:28.746,lon:77.117,hours:'Example 10 am–4 pm'},
  {name:'Sample e-waste drop-off',category:'E-Waste',lat:28.728,lon:77.137,hours:'Example 10 am–5 pm'},
  {name:'Sample hazardous collection point',category:'Hazardous',lat:28.708,lon:77.105,hours:'By appointment in this example'},
  {name:'Sample composting site',category:'Wet',lat:28.737,lon:77.103,hours:'Example 9 am–4 pm'},
];
let facilityCategory = '';
let facilityLocation;
function facilities() {
  const listed = directory.filter(row=>!facilityCategory || facilityCategory===row.category || facilityCategory===categories.at(-1))
    .map(row=>({...row,distance:facilityLocation?Math.hypot((row.lat-facilityLocation.lat)*111.2,
      (row.lon-facilityLocation.lon)*111.2*Math.cos(facilityLocation.lat*Math.PI/180)):null}))
    .sort((a,b)=>a.distance-b.distance);
  const query = facilityCategory && facilityCategory!==categories.at(-1) ?
    facilityCategory+' waste collection near me' : 'recycling and waste collection near me';
  return heading('Disposal facilities', 'Explore the sample directory or look up nearby options in Maps. Confirm acceptance and authorization directly before visiting.')+
    `<div class="panel stack"><label>Waste type<select id="facility-category"><option value="">All types</option>
    ${categories.map(c=>`<option ${c===facilityCategory?'selected':''}>${escape(c)}</option>`).join('')}</select></label>
    <div class="actions"><button data-action="facility-gps">Sort sample sites by distance</button>
    <a class="action" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}">Search nearby in Maps ↗</a></div></div>
    <div class="grid">${listed.map(row=>`<article class="panel"><p class="pill">Demo site · Unverified</p><h2>${row.name}</h2>
    <p>${row.category} · ${row.hours}</p><p class="quiet">${row.distance===null?'Distance requires your location':row.distance.toFixed(1)+' km straight-line distance'}</p></article>`).join('')}</div>`;
}

function metric(label,value,mark) {
  return `<div class="stat"><div class="symbol" aria-hidden="true">${mark}</div><strong>${value}</strong><span>${label}</span></div>`;
}
function dashboard() {
  const role = state.user.role;
  const all = state.complaints;
  const rows = role==='admin'?all.filter(row=>Object.entries(adminFilter).every(([key,value])=>{
    if (!value) return true;
    if (key==='date') return new Date(row.created*1000).toISOString().slice(0,10)>=value;
    return row[key]===value;
  })):all;
  const resolved = rows.filter(row=>row.status==='Resolved');
  const pending = rows.filter(row=>!['Resolved','Rejected'].includes(row.status));
  const inProgress = rows.filter(row=>row.status==='In Progress');
  const avg = resolved.length ? (resolved.reduce((sum,row)=>sum+row.resolved-row.created,0)/resolved.length/3600).toFixed(1)+' h' : '—';
  const ordered = [...rows].sort((a,b)=>(b.priority==='High')-(a.priority==='High') || b.created-a.created);
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">${spaces[role]}</p>
    ${heading('Welcome, '+escape(state.user.name), role==='citizen'?'Track your reports and check the cleanup evidence when a case is ready for verification.':
      role==='officer'?'Work through your assigned cases and upload cleanup evidence.':'Review reports, assign ward teams and monitor resolution.')}
    ${role==='citizen'?'<div class="actions"><button class="primary" data-page="Report">Report an issue</button><button data-page="Scanner">Open scanner ↗</button></div>':''}
    </div>${heroArt}</section>
    ${role==='admin'?filters(all):''}<div class="grid stats metrics">${metric('Total reports',rows.length,'▤')+metric('Open',pending.length,'⚑')+
    metric('In progress',inProgress.length,'↻')+metric('Resolved',resolved.length,'✓')+metric('Average resolution',avg,'◷')}</div>
    ${role==='admin'?analytics(rows):''}
    <details class="panel"><summary>Recent notifications</summary>${state.activity.length?
      `<ul>${state.activity.map(entry=>`<li>${escape(entry.label)} · ${date(entry.created)}</li>`).join('')}</ul>`:
      '<p class="quiet">No activity yet.</p>'}</details>
    <h2 class="section-title">${role==='officer'?'Assigned queue':'Complaints'}</h2>
    <div class="stack">${ordered.length?ordered.map(complaintCard).join(''):'<p class="panel quiet">No complaints in this view.</p>'}</div>`;
}
function filters(rows) {
  const select = (label,key,values) => `<label>${label}<select name="${key}"><option value="">All</option>
    ${values.map(value=>`<option ${adminFilter[key]===value?'selected':''}>${escape(value)}</option>`).join('')}</select></label>`;
  return `<form class="panel" data-form="filters"><h2>Filter reports</h2><div class="grid">
    ${select('Ward','ward',[...new Set(rows.map(row=>row.ward).filter(Boolean))])}
    ${select('Issue','issue',issues)}${select('Priority','priority',['High','Normal'])}
    ${select('Status','status',['Reported','Under Review','Assigned','In Progress','Awaiting Verification','Resolved','Reopened','Rejected'])}
    <label>Reported from (UTC)<input type="date" name="date" value="${escape(adminFilter.date)}"></label></div>
    <div class="actions"><button class="primary">Apply filters</button><a class="action" href="/api/report.csv">Download all reports CSV</a></div></form>`;
}
function analytics(rows) {
  function bars(groups) {
    return Object.entries(groups).map(([name,count])=>`<label>${escape(name)} · ${count}<meter min="0" max="${Math.max(1,rows.length)}" value="${count}"></meter></label>`).join('') || '<p>No data in this view.</p>';
  }
  const group = key => Object.fromEntries([...new Set(rows.map(key))].sort().map(name=>[name,rows.filter(row=>key(row)===name).length]));
  const staffNames = new Map(state.officers.map(officer=>[officer.id,officer.name]));
  return `<div class="grid"><div class="panel"><h2>Reports by ward</h2><div class="bars">${bars(group(row=>row.ward||'Unassigned'))}</div></div>
    <div class="panel"><h2>Resolved by officer</h2><div class="bars">${bars(Object.fromEntries(
      [...staffNames].map(([id,name]) => [name+' · '+id.slice(0,4), rows.filter(row=>row.officer===id && row.status==='Resolved').length])
    ))}</div></div>
    <div class="panel"><h2>Daily trend</h2><div class="bars">${bars(group(row=>new Date(row.created*1000).toISOString().slice(0,10)))}</div></div>
    <div class="panel"><h2>Monthly trend</h2><div class="bars">${bars(group(row=>new Date(row.created*1000).toISOString().slice(0,7)))}</div></div>
    <div class="panel"><h2>Priority</h2><div class="bars">${bars(group(row=>row.priority))}</div></div></div>
    <section class="panel"><h2>Complaint locations</h2><p class="quiet">Relative GPS positions of filtered cases. Large shaded circles indicate nearby clusters. Select a point to open its complaint.</p>${plot(rows)}</section>`;
}
function plot(rows) {
  const points = rows.filter(row=>row.lat!==null);
  if (!points.length) return '<p>No GPS-tagged complaints in this view.</p>';
  const bounds = points.reduce(([minY,maxY,minX,maxX],row)=>[
    Math.min(minY,row.lat),Math.max(maxY,row.lat),Math.min(minX,row.lon),Math.max(maxX,row.lon)
  ],[Infinity,-Infinity,Infinity,-Infinity]);
  const [minY,maxY,minX,maxX] = bounds;
  const plotted = points.map(row=>({
    row, x:maxX===minX?250:25+450*(row.lon-minX)/(maxX-minX),
    y:maxY===minY?110:195-170*(row.lat-minY)/(maxY-minY),
  }));
  const density = new Map();
  for (const {x,y} of plotted) {
    const cx = Math.round(x/26)*26, cy = Math.round(y/26)*26;
    const group = [cx,cy].join(',');
    density.set(group, (density.get(group)||0)+1);
  }
  const clusters = [...density].filter(([,count])=>count>1).map(([group,count])=>{
    const [x,y] = group.split(',');
    return `<circle class="density" cx="${x}" cy="${y}" r="${Math.min(58,13+3*count)}"><title>${count} complaints in this cluster</title></circle>`;
  }).join('');
  return `<div class="map"><svg viewBox="0 0 500 220" aria-label="Complaint location plot">${clusters}${plotted.map(({row,x,y})=>{
    return `<a href="#${escape(row.id)}" aria-label="${escape(row.issue)}"><circle cx="${x}" cy="${y}" r="7"><title>${escape(row.issue+' · '+row.location)}</title></circle></a>`;
  }).join('')}</svg></div>`;
}

function complaintCard(row) {
  const role = state.user.role;
  const actions = routes[role][row.status] || [];
  const overdue = !['Resolved','Rejected'].includes(row.status) && Date.now()/1000-row.created>state.sla_hours*3600;
  const coords = row.lat===null ? row.location : row.lat+','+row.lon;
  return `<article class="panel stack case-card" id="${escape(row.id)}" data-case-status="${escape(row.status)}">
    <div><p class="pill">${escape(row.status)}</p> <span class="pill">${escape(row.priority)} priority</span>
    ${overdue?'<span class="warn">Pilot SLA exceeded</span>':''}<h3>${escape(row.issue)}</h3>
    <p>${escape(row.description)}</p><p class="quiet">${escape(row.location)} · ${escape(row.ward||'Ward pending')} · ${row.support} supporters</p>
    <small><code>${escape(row.id)}</code> · ${date(row.created)}</small></div>
    <div class="actions"><a class="action" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}" target="_blank" rel="noopener noreferrer">Open location ↗</a></div>
    ${row.photos.length?`<div class="photos">${row.photos.map(photo=>`<figure><a href="/api/photo/${photo.id}"><img loading="lazy" src="/api/photo/${photo.id}" alt="${escape(photo.phase)} cleanup evidence"></a><figcaption>${escape(photo.phase)}</figcaption></figure>`).join('')}</div>`:''}
    <details><summary>Complaint timeline</summary><ol>${row.events.map(event=>`<li>${escape(event.action)} · ${date(event.created)}${event.note?' · '+escape(event.note):''}</li>`).join('')}</ol></details>
    ${actions.length?transitionForm(row, actions):''}</article>`;
}
function transitionForm(row, actions) {
  return `<form class="stack" data-form="transition" data-id="${row.id}">
  <label>Next action<select name="status">${options(actions)}</select></label>
  ${actions.includes('Assigned')?`<div data-fields="Assigned" ${actions[0]!=='Assigned'?'hidden':''}>
  <label>Ward<input name="ward" value="${escape(row.ward)}" maxlength="80"></label><label>Officer<select name="officer">
  <option value="">Select officer</option>${state.officers.map(person=>`<option value="${person.id}" ${person.id===row.officer?'selected':''}>${escape(person.name)}</option>`).join('')}</select></label></div>`:''}
  ${actions.includes('Awaiting Verification')?'<label>After-cleaning photos (1–3 required)<input name="photos" type="file" accept="image/*" multiple required></label>':''}
  <label>Remark<input name="note" maxlength="500"></label><button class="primary">Update complaint</button></form>`;
}

function gps() {
  return new Promise((resolve,reject)=>{
    if (!navigator.geolocation) return reject(new Error('Location is unavailable here.'));
    navigator.geolocation.getCurrentPosition(position=>resolve({
      lat:position.coords.latitude, lon:position.coords.longitude,
    }),()=>reject(new Error('Location unavailable. You can enter coordinates manually.')), {timeout:10000});
  });
}

async function jpeg(file) {
  if (!file || !file.size || !file.type.startsWith('image/') || file.size>12_000_000) {
    throw new Error('Choose an image smaller than 12 MB.');
  }
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1,1200/Math.max(image.width,image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(image.width*scale));
    canvas.height = Math.max(1,Math.round(image.height*scale));
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const data = canvas.toDataURL('image/jpeg',0.76);
    if (data.length>1_000_000) throw new Error('Choose a smaller photo.');
    return data;
  } finally { image.close(); }
}

async function photoInputs(input) {
  const files = Array.from(input?.files || []);
  if (files.length>3) throw new Error('Choose at most three photos.');
  const pictures = [];
  for (const file of files) pictures.push(await jpeg(file));
  return pictures;
}

function coordinates(data) {
  if (!data.lat && !data.lon) return {lat:null,lon:null};
  if (!data.lat || !data.lon) throw new Error('Enter both latitude and longitude.');
  return {lat:Number(data.lat),lon:Number(data.lon)};
}

async function sendComplaint(form, data, separately) {
  const payload = {...data,...coordinates(data),photos:await photoInputs(form.elements.photos),submit_separately:separately};
  const result = await api('complaint',payload);
  if (result.matches) {
    form.querySelector('#matches').innerHTML = `<div class="panel stack"><h2>Possible nearby matches</h2>
    ${result.matches.map(match=>`<div><p>${match.meters} m away · ${escape(match.status)}${match.own?' · Your complaint':''}</p>
    ${match.own?'':`<button class="btn outline" type="button" data-action="support" data-id="${match.id}">Support this report</button>`}</div>`).join('')}
    <button class="btn outline" type="button" data-action="separate">Submit as a separate report</button></div>`;
    status('Review nearby reports or submit separately.');
    return;
  }
  clearDraft();
  page = 'Dashboard';
  await load();
  status('Complaint submitted. Reference '+result.id);
}

view.addEventListener('input', event=>{
  const form = event.target.closest('form[data-form="complaint"]');
  if (form) saveDraft(form);
});
view.addEventListener('change', event=>{
  const scanner = event.target.closest('form[data-form="scanner"]');
  if (scanner && event.target.name==='photo') {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const photo = event.target.files[0];
    const preview = scanner.querySelector('[data-photo-preview]');
    previewUrl = photo?.type.startsWith('image/') && photo.size<=12_000_000 ? URL.createObjectURL(photo) : undefined;
    preview.hidden = !previewUrl;
    if (previewUrl) preview.src = previewUrl;
    else preview.removeAttribute('src');
  }
  if (event.target.matches('form[data-form="confirm"] select[name="category"]')) {
    document.querySelector('[data-scan-advice]').textContent = advice[event.target.value];
    document.querySelector('[data-action="facility-category"]').dataset.category = event.target.value;
  }
  if (event.target.id==='facility-category') { facilityCategory=event.target.value; render(); }
  const form = event.target.closest('form[data-form="transition"]');
  if (form && event.target.name==='status') {
    for (const fields of form.querySelectorAll('[data-fields]')) fields.hidden=fields.dataset.fields!==event.target.value;
  }
});
view.addEventListener('submit', async event=>{
  event.preventDefault();
  const form = event.target;
  const submit = event.submitter;
  const data = Object.fromEntries(new FormData(form,submit));
  const type = form.dataset.form;
  if (form.dataset.busy) return;
  form.dataset.busy='1';
  if (submit) submit.disabled=true;
  status('Working…');
  try {
    if (['login','signup','profile'].includes(type)) {
      await api(type,data);
      if (type!=='profile') page='Overview';
      await load();
      status(type==='profile'?'Profile saved.':'Signed in.');
    } else if (type==='complaint') {
      await sendComplaint(form,data,false);
    } else if (type==='transition') {
      await api('transition',{...data,id:form.dataset.id,photos:await photoInputs(form.elements.photos)});
      await load();
      status('Complaint updated.');
    } else if (type==='scanner') {
      scan = await api('scanner',{mode:data.mode||'gemini',category:data.category,
        photo:data.mode==='manual'||data.mode==='sample'?undefined:await jpeg(data.photo)});
      await load();
      status('Classification ready.');
    } else if (type==='confirm') {
      const result = await api('scan/confirm',{...data,id:form.dataset.id});
      scan = null;
      await load();
      status(result.earned?`Scan confirmed. +${result.earned} points.`:'Scan confirmed.');
    } else if (type==='filters') {
      adminFilter=data; render(); status('Filters applied.');
    }
  } catch (error) { status(error.message); }
  finally { delete form.dataset.busy; if (submit) submit.disabled=false; }
});

document.addEventListener('click', async event=>{
  const button = event.target.closest('button[data-page],button[data-action]');
  if (!button) return;
  if (button.dataset.page) {
    page=button.dataset.page; status(''); render(); window.scrollTo(0,0);
    const title = view.querySelector('h1');
    if (title) { title.tabIndex=-1; title.focus({preventScroll:true}); }
    return;
  }
  button.disabled = true;
  try {
    const {action,id} = button.dataset;
    if (action==='demo-login') {
      await api('demo/login',{role:id});
      page = id==='citizen' ? 'Overview' : 'Dashboard';
      await load();
      status('Signed in to the demo.');
    } else if (action==='logout') {
      await api('logout',{}); state=null; scan=null; adminFilter={}; page='Sign in'; render(); status('Signed out.');
    } else if (action==='gps') {
      status('Getting your location…');
      const point = await gps();
      const form = button.form;
      form.elements.lat.value = point.lat.toFixed(6);
      form.elements.lon.value = point.lon.toFixed(6);
      saveDraft(form);
      status('Coordinates added.');
    } else if (action==='facility-gps') {
      facilityLocation=await gps(); render(); status('Sample directory sorted by estimated distance.');
    } else if (action==='facility-category') {
      facilityCategory=button.dataset.category; page='Facilities'; render();
    } else if (action==='redeem') {
      await api('redeem',{id,request:crypto.randomUUID()}); await load(); status('Demo redemption recorded.');
    } else if (action==='review') {
      const item=state.scans.find(row=>row.id===id && !row.confirmed);
      if (item) { scan={...item.result,id}; render(); document.querySelector('#scan-result').scrollIntoView(); }
    } else if (action==='support' || action==='separate') {
      const form = button.form;
      if (form.dataset.busy || !form.reportValidity()) return;
      form.dataset.busy='1';
      try {
        const data = Object.fromEntries(new FormData(form));
        if (action==='separate') await sendComplaint(form,data,true);
        else {
          await api('support',{id,issue:data.issue,...coordinates(data)});
          clearDraft(); page='Dashboard'; await load(); status('Support recorded for the existing report.');
        }
      } finally { delete form.dataset.busy; }
    }
  } catch (error) { status(error.message); }
  finally { button.disabled=false; }
});

async function boot() {
  if (location.protocol==='file:') {
    view.setAttribute('aria-busy','false');
    view.innerHTML='<section class="panel"><h1>Start SwachhSetu</h1><p>Extract the full ZIP and double-click <strong>Start_SwachhSetu.bat</strong> in the project folder. The launcher opens the correct browser address.</p></section>';
    return;
  }
  try {
    const info = await api('demo');
    demoEnabled = info.enabled === true;
  } catch {
    demoEnabled = false;
  }
  await load();
}
boot().catch(error=>{
  view.setAttribute('aria-busy','false');
  view.innerHTML='<p>Unable to load the workspace. Reload to retry.</p>';
  status(error.message);
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
