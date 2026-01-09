// Haupt-Frontend-Logik
// Erwartet API_URL in config.js

let session = {
  token: localStorage.getItem('er_token') || null,
  user: localStorage.getItem('er_user') || null,
  role: localStorage.getItem('er_role') || null
};

document.addEventListener('DOMContentLoaded', init);

function init(){
  // populate room dropdowns
  const selEntry = document.getElementById('roomSelectEntry');
  const selBoard = document.getElementById('roomSelectBoard');
  ROOMS.forEach(r=>{
    const o1 = document.createElement('option'); o1.value = r; o1.textContent = r; selEntry.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = r; o2.textContent = r; selBoard.appendChild(o2);
  });

  // events
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('submitEntryBtn').addEventListener('click', submitEntry);
  document.getElementById('refreshBoardBtn').addEventListener('click', () => loadLeaderboard(document.getElementById('roomSelectBoard').value));
  document.getElementById('generateImageBtn').addEventListener('click', generateAdminImage);
  document.querySelectorAll('.tabBtn').forEach(b=>b.addEventListener('click', onTabClick));

  // initial UI
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

  // load content when switching
  if(tab==='leaderboard'){
    loadLeaderboard(document.getElementById('roomSelectBoard').value);
  } else if(tab==='uebersicht'){
    loadOverview();
  }
}

async function doLogin(){
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  if(!user || !pass){ setMessage('loginMessage','Bitte Benutzername und Passwort eingeben'); return; }
  try{
    const res = await apiPost({action:'login', username:user, password:pass});
    if(res.ok && res.role){
      session.token = res.token;
      session.user = user;
      session.role = res.role;
      localStorage.setItem('er_token', res.token);
      localStorage.setItem('er_user', user);
      localStorage.setItem('er_role', res.role);
      showMainForSession();
    } else {
      setMessage('loginMessage', res.message || 'Login fehlgeschlagen');
    }
  }catch(err){
    console.error(err); setMessage('loginMessage','Fehler beim Login');
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
  // admin tab visibility
  if(session.role==='admin'){
    document.getElementById('adminTabBtn').style.display='inline-block';
  } else {
    document.getElementById('adminTabBtn').style.display='none';
  }
  // show default tab Eintragung
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
    if(res.ok){
      setMessage('entryMessage','Eintrag gespeichert', true);
      // clear inputs
      document.getElementById('groupName').value='';
      document.getElementById('timeMin').value='0';
      document.getElementById('timeSec').value='0';
    } else {
      setMessage('entryMessage', res.message || 'Fehler beim Speichern');
    }
  }catch(err){
    console.error(err); setMessage('entryMessage','Fehler beim Senden');
  }
}

async function loadLeaderboard(room){
  const wrap = document.getElementById('boardTableWrap');
  wrap.innerHTML = 'Lade...';
  try{
    const res = await apiGet(`action=getLeaderboard&room=${encodeURIComponent(room)}`);
    if(res.ok){
      const rows = res.data || [];
      wrap.innerHTML = renderLeaderboardTable(rows, room);
    } else {
      wrap.innerHTML = `<div class="message">Fehler: ${res.message || 'k.A.'}</div>`;
    }
  }catch(err){
    console.error(err); wrap.innerHTML = '<div class="message">Fehler beim Laden</div>';
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
    if(res.ok){
      const data = res.data || {}; // { room: [entries...] }
      // Render each room with top 10
      wrap.innerHTML = '';
      ROOMS.forEach(room=>{
        const arr = (data[room] || []).slice(0,10);
        const block = document.createElement('div');
        block.className = 'roomBlock';
        block.innerHTML = `<h3>${escapeHtml(room)}</h3>` + renderTinyTable(arr);
        wrap.appendChild(block);
      });
    } else {
      wrap.innerHTML = `<div class="message">Fehler: ${res.message || 'k.A.'}</div>`;
    }
  }catch(err){
    console.error(err); wrap.innerHTML = '<div class="message">Fehler beim Laden</div>';
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

async function generateAdminImage(){
  if(session.role !== 'admin'){ alert('Nur Admins dürfen das ausführen'); return; }
  // Build exportArea DOM as specified:
  // 1st row: side-by-side the 5 best placements of "The Saw Massacre" and "Nightmare Hotel"
  // 2nd row: 5 best of "Der Heilige Gral"
  // 3rd row: side-by-side 5 best of "Der Erbe Draculas" and "666 Passagiere"
  const exportArea = document.getElementById('exportArea');
  exportArea.style.display='block';
  exportArea.innerHTML = ''; // compose
  try{
    // fetch top 5 for each needed room
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
      if(results[i].ok) data[r] = results[i].data || [];
      else data[r] = [];
    }

    // Helper to create table HTML
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

    // Row 1: two blocks side-by-side
    const row1 = document.createElement('div');
    row1.style.display='flex'; row1.style.gap='12px';
    row1.innerHTML = makeBlockHTML("The Saw Massacre", data["The Saw Massacre"]) + makeBlockHTML("Nightmare Hotel", data["Nightmare Hotel"]);
    exportArea.appendChild(row1);

    // Row 2: single wide block (centered)
    const row2 = document.createElement('div');
    row2.style.marginTop='12px';
    row2.innerHTML = makeBlockHTML("Der Heilige Gral", data["Der Heilige Gral"]);
    exportArea.appendChild(row2);

    // Row 3: two blocks side-by-side
    const row3 = document.createElement('div');
    row3.style.display='flex'; row3.style.gap='12px'; row3.style.marginTop='12px';
    row3.innerHTML = makeBlockHTML("Der Erbe Draculas", data["Der Erbe Draculas"]) + makeBlockHTML("666 Passagiere", data["666 Passagiere"]);
    exportArea.appendChild(row3);

    // add some styles for export blocks
    const style = document.createElement('style');
    style.innerHTML = `.exportBlock{background:#fff;padding:8px;border-radius:6px;width:100%} .exportBlock table{width:100%;border-collapse:collapse} .exportBlock th,.exportBlock td{border:1px solid #ccc;padding:4px}`;
    exportArea.appendChild(style);

    // render to canvas via html2canvas
    const canvas = await html2canvas(exportArea, {scale:2, backgroundColor:'#f6f8fb'});
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    // create download link
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'uebersicht_leaderboard.jpg';
    a.textContent = 'JPEG herunterladen';
    a.style.display='inline-block';
    a.style.marginTop='10px';
    exportArea.appendChild(a);
    // optional: auto-click
    a.click();
  }catch(err){
    console.error(err);
    alert('Fehler beim Erzeugen des Bildes');
  }
}

// helper: format time seconds -> mm:ss
function formatTime(totalSec){
  const m = Math.floor(totalSec/60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2,'0')}s`;
}

// helper: escape html
function escapeHtml(s){
  if(!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// small UI helper
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
  const data = await resp.json();
  return data;
}
async function apiPost(obj){
  const resp = await fetch(API_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(obj)
  });
  const data = await resp.json();
  return data;
}