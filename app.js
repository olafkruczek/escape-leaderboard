// app.js - vollständiges Frontend-Skript (inkl. verbesserter Suche)
// Erwartet: API_URL und ROOMS in config.js

let session = {
  token: localStorage.getItem('er_token') || null,
  user: localStorage.getItem('er_user') || null,
  role: localStorage.getItem('er_role') || null
};

document.addEventListener('DOMContentLoaded', init);

function init(){
  const selEntry = document.getElementById('roomSelectEntry');
  const selBoard = document.getElementById('roomSelectBoard');
  ROOMS.forEach(r=>{
    const o1 = document.createElement('option'); o1.value = r; o1.textContent = r; selEntry.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = r; o2.textContent = r; selBoard.appendChild(o2);
  });

  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('submitEntryBtn').addEventListener('click', submitEntry);
  document.getElementById('refreshBoardBtn').addEventListener('click', () => loadLeaderboard(document.getElementById('roomSelectBoard').value));
  document.getElementById('generateImageBtn').addEventListener('click', generateAdminImage);
  document.querySelectorAll('.tabBtn').forEach(b=>b.addEventListener('click', onTabClick));
  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('searchGroupInput').addEventListener('keydown', (e)=>{ if(e.key === 'Enter') doSearch(); });

  if(session.token){
    showMainForSession();
  } else {
    document.getElementById('loginArea').style.display='block';
  }
}

function onTabClick(e){
  document.querySelectorAll('.tabBtn').forEach(b=>b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  const tab= e.currentTarget.dataset.tab;
  document.querySelectorAll('.tabContent').forEach(t=>t.style.display='none');
  document.getElementById(tab).style.display='block';

  if(tab==='leaderboard'){
    loadLeaderboard(document.getElementById('roomSelectBoard').value);
  } else if(tab==='uebersicht'){
    loadOverview();
  } else if(tab==='suche'){
    document.getElementById('searchMessage').textContent='';
    document.getElementById('searchResultsWrap').innerHTML='';
  }
}

async function doLogin(){
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  if(!user || !pass){ setMessage('loginMessage','Bitte Benutzername und Passwort eingeben'); return; }
  try{
    const res = await apiPost({action:'login', username:user, password:pass});
    if(res && res.ok && res.role){
      session.token = res.token;
      session.user = user;
      session.role = res.role;
      localStorage.setItem('er_token', res.token);
      localStorage.setItem('er_user', user);
      localStorage.setItem('er_role', res.role);
      showMainForSession();
    } else {
      setMessage('loginMessage', (res && res.message) ? res.message : 'Login fehlgeschlagen');
    }
  }catch(err){
    console.error('doLogin error', err); setMessage('loginMessage','Fehler beim Login');
  }
}

function doLogout(){
  session.token = null; session.user = null; session.role = null;
  localStorage.removeItem('er_token'); localStorage.removeItem('er_user'); localStorage.removeItem('er_role');
  document.getElementById('mainContent').style.display='none';
  document.getElementById('loginArea').style.display='block';
  document.getElementById('welcomeText').textContent='';
  document.getElementById('logoutBtn').style.display='none';
}

function showMainForSession(){
  document.getElementById('loginArea').style.display='none';
  document.getElementById('mainContent').style.display='block';
  document.getElementById('welcomeText').textContent = `Eingeloggt als ${session.user} (${session.role})`;
  document.getElementById('logoutBtn').style.display='inline-block';
  if(session.role==='admin'){
    document.getElementById('adminTabBtn').style.display='inline-block';
  } else {
    document.getElementById('adminTabBtn').style.display='none';
  }
  document.querySelectorAll('.tabBtn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.tabBtn[data-tab="eintragung"]').classList.add('active');
  document.querySelectorAll('.tabContent').forEach(t=>t.style.display='none');
  document.getElementById('eintragung').style.display='block';
}

async function submitEntry(){
  const group = document.getElementById('groupName').value.trim();
  const room = document.getElementById('roomSelectEntry').value;
  const min = parseInt(document.getElementById('timeMin').value,10) || 0;
  const sec = parseInt(document.getElementById('timeSec').value,10) || 0;
  if(!group){ setMessage('entryMessage','Bitte Gruppennamen eingeben'); return; }
  if(sec<0 || sec>59){ setMessage('entryMessage','Sekunden müssen zwischen 0 und 59 liegen'); return; }
  const totalSec = min*60 + sec;
  try{
    const payload = {
      action:'addEntry',
      token: session.token,
      groupName: group,
      room: room,
      timeSeconds: totalSec
    };
    const res = await apiPost(payload);
    if(res && res.ok){
      setMessage('entryMessage','Eintrag gespeichert', true);
      document.getElementById('groupName').value='';
      document.getElementById('timeMin').value='0';
      document.getElementById('timeSec').value='0';
    } else {
      setMessage('entryMessage', (res && res.message) ? res.message : 'Fehler beim Speichern');
    }
  }catch(err){
    console.error('submitEntry error', err); setMessage('entryMessage','Fehler beim Senden');
  }
}

async function loadLeaderboard(room){
  const wrap = document.getElementById('boardTableWrap');
  wrap.innerHTML = 'Lade...';
  try{
    const res = await apiGet(`action=getLeaderboard&room=${encodeURIComponent(room)}`);
    if(res && res.ok){
      const rows = res.data || [];
      wrap.innerHTML = renderLeaderboardTable(rows, room);
    } else {
      wrap.innerHTML = `<div class="message">Fehler: ${(res && res.message) ? res.message : 'k.A.'}</div>`;
    }
  }catch(err){
    console.error('loadLeaderboard error', err); wrap.innerHTML = '<div class="message">Fehler beim Laden</div>';
  }
}

function renderLeaderboardTable(rows, room){
  if(!rows.length) return `<div class="message">Keine Einträge für "${room}".</div>`;
  let html = `<table><thead><tr><th>Platz</th><th>Gruppe</th><th>Zeit</th></tr></thead><tbody>`;
  rows.sort((a,b)=>a.timeSeconds - b.timeSeconds);
  rows.forEach((r,i)=>{
    html += `<tr><td>${i+1}</td><td>${escapeHtml(r.groupName)}</td><td>${formatTime(r.timeSeconds)}</td></tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

async function loadOverview(){
  const wrap = document.getElementById('overviewWrap');
  wrap.innerHTML = 'Lade...';
  try{
    const res = await apiGet(`action=getOverview`);
    if(res && res.ok){
      const data = res.data || {};
      wrap.innerHTML = '';
      ROOMS.forEach(room=>{
        const arr = (data[room] || []).slice(0,10);
        const block = document.createElement('div');
        block.className = 'roomBlock';
        block.innerHTML = `<h3>${escapeHtml(room)}</h3>` + renderTinyTable(arr);
        wrap.appendChild(block);
      });
    } else {
      wrap.innerHTML = `<div class="message">Fehler: ${(res && res.message) ? res.message : 'k.A.'}</div>`;
    }
  }catch(err){
    console.error('loadOverview error', err); wrap.innerHTML = '<div class="message">Fehler beim Laden</div>';
  }
}

function renderTinyTable(rows){
  if(!rows.length) return '<div class="message">Keine Einträge</div>';
  let html = `<table><thead><tr><th>#</th><th>Gruppe</th><th>Zeit</th></tr></thead><tbody>`;
  rows.forEach((r,i)=>{
    html += `<tr><td>${i+1}</td><td>${escapeHtml(r.groupName)}</td><td>${formatTime(r.timeSeconds)}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// --- Suche (partial/exact + gruppierte Darstellung) ---
async function doSearch(){
  const q = document.getElementById('searchGroupInput').value.trim();
  const wrap = document.getElementById('searchResultsWrap');
  const msg = document.getElementById('searchMessage');
  wrap.innerHTML = '';
  msg.textContent = '';
  if(!q){ msg.textContent = 'Bitte Gruppenname eingeben'; return; }
  msg.textContent = 'Suche...';
  const partial = document.getElementById('searchPartial').checked ? 'true' : 'false';
  try{
    const res = await apiGet(`action=searchGroup&group=${encodeURIComponent(q)}&partial=${partial}&n=200`);
    if(res && res.ok){
      const data = res.data || {};
      // data is an object mapping room => [matches]
      const roomsWithMatches = Object.keys(data).filter(r => data[r] && data[r].length);
      if(!roomsWithMatches.length){
        wrap.innerHTML = `<div class="message">Keine Treffer für "${escapeHtml(q)}"</div>`;
      } else {
        wrap.innerHTML = renderSearchGroupedResults(data, q);
      }
      msg.textContent = '';
    } else {
      msg.textContent = (res && res.message) ? res.message : 'Fehler bei der Suche';
    }
  }catch(err){
    console.error('doSearch error', err);
    msg.textContent = 'Fehler bei der Suche';
  }
}

function renderSearchGroupedResults(data, query){
  // data: { roomName: [ {rank, groupName, timeSeconds, timeDisplay}, ... ] }
  let html = '';
  ROOMS.forEach(room=>{
    const arr = data[room] || [];
    if(!arr || !arr.length) return;
    html += `<div class="roomBlock" style="margin-bottom:12px"><h3>${escapeHtml(room)}</h3>`;
    html += `<table><thead><tr><th>Platz</th><th>Gruppe</th><th>Zeit</th></tr></thead><tbody>`;
    arr.forEach(item=>{
      html += `<tr><td>${item.rank}</td><td>${escapeHtml(item.groupName)}</td><td>${formatTime(item.timeSeconds)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  });
  return html;
}
// --- Ende Suche ---

async function generateAdminImage(){
  if(session.role !== 'admin'){ alert('Nur Admins dürfen das ausführen'); return; }
  const exportArea = document.getElementById('exportArea');
  exportArea.style.display='block';
  exportArea.innerHTML = '';
  try{
    const needed = [
      "The Saw Massacre","Nightmare Hotel",
      "Der Heilige Gral",
      "Der Erbe Draculas","666 Passagiere"
    ];
    const promises = needed.map(r=>apiGet(`action=getTopN&room=${encodeURIComponent(r)}&n=5`));
    const results = await Promise.all(promises);
    const data = {};
    for(let i=0;i<needed.length;i++){
      const r = needed[i];
      if(results[i] && results[i].ok) data[r] = results[i].data || [];
      else data[r] = [];
    }

    function makeBlockHTML(roomName, arr){
      let html = `<div class="exportBlock"><h4>${escapeHtml(roomName)}</h4>`;
      html += `<table><thead><tr><th>#</th><th>Gruppe</th><th>Zeit</th></tr></thead><tbody>`;
      for(let i=0;i<5;i++){
        const row = arr[i];
        if(row) html += `<tr><td>${i+1}</td><td>${escapeHtml(row.groupName)}</td><td>${formatTime(row.timeSeconds)}</td></tr>`;
        else html += `<tr><td>${i+1}</td><td>-</td><td>-</td></tr>`;
      }
      html += `</tbody></table></div>`;
      return html;
    }

    const row1 = document.createElement('div');
    row1.style.display='flex'; row1.style.gap='12px';
    row1.innerHTML = makeBlockHTML("The Saw Massacre", data["The Saw Massacre"]) + makeBlockHTML("Nightmare Hotel", data["Nightmare Hotel"]);
    exportArea.appendChild(row1);

    const row2 = document.createElement('div');
    row2.style.marginTop='12px';
    row2.innerHTML = makeBlockHTML("Der Heilige Gral", data["Der Heilige Gral"]);
    exportArea.appendChild(row2);

    const row3 = document.createElement('div');
    row3.style.display='flex'; row3.style.gap='12px'; row3.style.marginTop='12px';
    row3.innerHTML = makeBlockHTML("Der Erbe Draculas", data["Der Erbe Draculas"]) + makeBlockHTML("666 Passagiere", data["666 Passagiere"]);
    exportArea.appendChild(row3);

    const style = document.createElement('style');
    style.innerHTML = `.exportBlock{background:#fff;padding:8px;border-radius:6px;width:100%} .exportBlock table{width:100%;border-collapse:collapse} .exportBlock th,.exportBlock td{border:1px solid #ccc;padding:4px}`;
    exportArea.appendChild(style);

    const canvas = await html2canvas(exportArea, {scale:2, backgroundColor:'#f6f8fb'});
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'uebersicht_leaderboard.jpg';
    a.textContent = 'JPEG herunterladen';
    a.style.display='inline-block';
    a.style.marginTop='10px';
    exportArea.appendChild(a);
    a.click();
  }catch(err){
    console.error('generateAdminImage error', err);
    alert('Fehler beim Erzeugen des Bildes');
  }
}

function formatTime(totalSec){
  const m = Math.floor(totalSec/60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2,'0')}s`;
}

function escapeHtml(s){
  if(!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setMessage(id, text, ok=false){
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = ok ? 'green' : '';
  setTimeout(()=>{ if(el.textContent===text) el.textContent=''; }, 5000);
}

// API helpers
async function apiGet(query){
  const url = `${API_URL}?${query}`;
  const resp = await fetch(url, {method:'GET', headers:{'Accept':'application/json'}});
  const text = await resp.text();
  try{
    return JSON.parse(text);
  }catch(e){
    return { ok: false, message: 'Ungültige Serverantwort', raw: text };
  }
}

async function apiPost(obj){
  const params = new URLSearchParams();
  for(const k in obj){
    if(obj[k] === undefined || obj[k] === null) continue;
    params.append(k, String(obj[k]));
  }
  const resp = await fetch(API_URL, {
    method:'POST',
    body: params
  });
  const text = await resp.text();
  try{
    return JSON.parse(text);
  }catch(e){
    return { ok: false, message: 'Ungültige Serverantwort', raw: text };
  }
}
