/* Same-origin Node API adapter; original UI and AI functions remain in app.js. */
(() => {
  'use strict';
  const STORAGE_KEY = 'swachhsetu_server_session_v1';
  const $ = id => document.getElementById(id);
  let token = '';
  try {token=localStorage.getItem(STORAGE_KEY)||''} catch (_) {token=''}
  let enabled = false;
  const original = {submitAuth: window.submitAuth, logout: window.logout, report: window.report, scan: window.scan, changeStatus: window.changeStatus};
  async function api(path, options = {}) {
    const headers = {'Content-Type': 'application/json', ...options.headers};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch('/api' + path, {...options, headers});
    let body;
    try {body = await response.json()} catch {throw Error('Invalid server response')}
    if (!response.ok) throw Error(body.error || 'Request failed');
    return body;
  }
  function replaceSession(data) {
    token = data.token || '';
    try{if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY)}catch(e){console.warn('Session storage unavailable',e)}
    state.session = data.user ? data.user.id : null;
    if (data.user) {
      state.users = state.users.filter(u => u.id !== data.user.id);
      // Never store the server-side password hash or password in browser data.
      state.users.push({...data.user});
    }
    save();
    updateAuth();
  }
  async function refresh() {
    if (!token) { state.session=null; save(); updateAuth(); homeStats(); return; }
    try {
      const info = await api('/bootstrap');
      replaceSession({token,user:info.user});
      state.complaints = info.complaints;
      state.scans = info.scans;
      save(); homeStats();
      if ($('dashboard').classList.contains('active')) dashboard();
      if ($('track').classList.contains('active')) track();
      scanHistory();
    } catch (error) {
      if (/Authentication required|Invalid session/.test(error.message)) {
        token = '';try{localStorage.removeItem(STORAGE_KEY)}catch(_){}state.session=null;state.complaints=[];state.scans=[];save();updateAuth();
      }
      integrationStatus('Local API: '+error.message);
    }
  }
  async function login() {
    const email=$('email').value.trim().toLowerCase(),password=$('password').value,name=$('name').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Enter a valid email');
    if (password.length<8) return toast('Password must be at least 8 characters');
    if (mode==='signup' && name.length<2) return toast('Enter your full name');
    try {
      const data=await api('/auth/'+(mode==='signup'?'signup':'login'),{method:'POST',body:JSON.stringify({name,email,password})});
      replaceSession(data);
      await refresh();
      show('dashboard');toast(mode==='signup'?'Account created successfully!':'Welcome back!');
      $('password').value='';
    } catch (e) {toast('Login: '+e.message)}
  }
  async function logoutServer() {
    try { if (token) await api('/auth/logout',{method:'POST'}); } catch(e) {console.warn(e)}
    replaceSession({user:null,token:''});
    state.complaints=[];state.scans=[];save();updateAuth();homeStats();show('home');toast('Logged out');
  }
  async function reportServer() {
    if (!token) {toast('Please login first');show('auth');return}
    const description=$('description').value.trim(),location=$('location').value.trim(),issue=$('issue').value;
    if (description.length<8||location.length<3) return toast('Add a description (8+ chars) and location');
    try {
      const item=await api('/complaints',{method:'POST',body:JSON.stringify({issue,description,location})});
      $('description').value='';$('location').value='';await refresh();show('track');toast('Complaint '+item.id+' submitted');
    } catch(e) {toast('Complaint: '+e.message)}
  }
  async function scanServer() {
    const cat=$('wasteCategory').value,[title,info,emoji]=advice[cat];
    $('scanResult').innerHTML=`<div class="result"><h3>${emoji} ${title}</h3><p>${info}</p><small>Manually selected category.</small></div>`;
    if (!token) {toast('Login to save your scan');show('auth');return}
    try {await api('/scans',{method:'POST',body:JSON.stringify({category:cat})});await refresh();scanHistory();toast('Scan saved · +10 demo green points')}
    catch(e) {toast('Scan: '+e.message)}
  }
  async function statusServer(id,status) {
    if (current()?.role!=='admin')return toast('Admin access required');
    try {await api('/complaints/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status})});await refresh();track();dashboard();toast('Status updated')}
    catch(e) {toast('Status: '+e.message)}
  }
  async function activate() {
    try {
      const res=await fetch('/api/health',{cache:'no-store'});
      if (!res.ok || !(res.headers.get('content-type')||'').includes('application/json')) return;
      const body=await res.json();
      if (body.app!=='SwachhSetu')return;
      enabled=true;
      // Keep optional Supabase mode available when intentionally configured.
      if (config.url && config.key) {
        integrationStatus('Supabase mode configured. Clear Supabase settings to use local Node backend.');
        return;
      }
      // Remove legacy browser-only credentials when using the authenticated server.
      state.users=state.users.filter(u=>!Object.prototype.hasOwnProperty.call(u,'password'));
      state.session=null;state.complaints=[];state.scans=[];save();
      const demoHint=$('demoLoginNote');if(demoHint)demoHint.textContent='Server mode: create an account using Sign Up. Admin credentials are configured on the server, not shown here.';
      const reportHint=$('reportStorageNote');if(reportHint)reportHint.textContent='In server mode, complaints are saved in the Node.js backend database. This hackathon demo does not notify a municipality.';
      window.submitAuth=login;
      window.logout=logoutServer;
      window.report=reportServer;
      window.scan=scanServer;
      window.changeStatus=statusServer;
      await refresh();
      integrationStatus('Local Node backend connected ✓');
      $('aiStatus').textContent='AI image model available online; manual fallback saves to server.';
    } catch(e) {console.warn('Server API unavailable; local demo mode used',e)}
  }
  if (location.protocol === 'http:' || location.protocol === 'https:') activate();
})();
