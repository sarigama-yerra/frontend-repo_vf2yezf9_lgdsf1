/* Shared utilities for AJAX calls to Google Apps Script web app */
const GAS_BASE = localStorage.getItem('GAS_WEB_APP_URL') || '';

async function api(action, payload = {}){
  if(!GAS_BASE){
    throw new Error('Set your Apps Script Web App URL. Open any page and paste it when prompted.');
  }
  const res = await fetch(GAS_BASE, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action, payload })
  });
  const data = await res.json().catch(()=>({ ok:false, message:'Invalid JSON from Apps Script'}));
  if(!res.ok || data.ok === false){
    throw new Error(data.message || 'Request failed');
  }
  return data; // expects { ok:true, data:... }
}

function saveWebAppUrl(){
  const url = prompt('Enter Google Apps Script Web App URL (ends with /exec):', GAS_BASE || '');
  if(url){ localStorage.setItem('GAS_WEB_APP_URL', url.trim()); alert('Saved!'); }
}

function qs(s, scope=document){return scope.querySelector(s)}
function qsa(s, scope=document){return Array.from(scope.querySelectorAll(s))}
function param(name){return new URLSearchParams(location.search).get(name)}
function fmtDate(s){try{ return new Date(s).toLocaleString() }catch(e){ return s }}

function setSession(role, token, profile){
  localStorage.setItem(`${role}_token`, token);
  localStorage.setItem(`${role}_profile`, JSON.stringify(profile||{}));
}
function getSession(role){
  return { token: localStorage.getItem(`${role}_token`), profile: JSON.parse(localStorage.getItem(`${role}_profile`)||'{}') };
}
function clearSession(role){
  localStorage.removeItem(`${role}_token`);
  localStorage.removeItem(`${role}_profile`);
}

/* CSV export helper */
function exportCSV(filename, rows){
  const csv = rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

/* Page init hook */
window.addEventListener('DOMContentLoaded',()=>{
  // Add gear icon to set GAS url
  const gear = document.createElement('button');
  gear.className='btn secondary';
  gear.style.position='fixed'; gear.style.bottom='18px'; gear.style.right='18px'; gear.style.zIndex='9999';
  gear.textContent='Set Backend URL';
  gear.onclick=saveWebAppUrl; document.body.appendChild(gear);
});
