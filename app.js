// Ersetze die bestehende generateAdminImage-Funktion in app.js durch diese Version (ohne Avatar)
async function generateAdminImage(){
  if(session.role !== 'admin'){ alert('Nur Admins dürfen das ausführen'); return; }
  const exportArea = document.getElementById('exportArea');
  exportArea.style.display = 'block';
  exportArea.innerHTML = ''; // clear

  try{
    const rooms = [
      "The Saw Massacre","Nightmare Hotel",
      "Der Heilige Gral","Der Erbe Draculas","666 Passagiere"
    ];

    // hole Top-5 pro Raum
    const promises = rooms.map(r=>apiGet(`action=getTopN&room=${encodeURIComponent(r)}&n=5`));
    const results = await Promise.all(promises);
    const dataMap = {};
    for(let i=0;i<rooms.length;i++){
      const r = rooms[i];
      dataMap[r] = (results[i] && results[i].ok) ? results[i].data || [] : [];
    }

    // export container
    const container = document.createElement('div');
    container.className = 'exportCanvas';

    // helper: medal SVGs
    function medalSVG(type){
      let fill = '#ffd14d'; // gold
      let ribbon1 = '#e74c3c', ribbon2 = '#c0392b';
      if(type === 'silver'){ fill = '#dfe6ee'; ribbon1 = '#9aa6b8'; ribbon2 = '#6f7c8b'; }
      if(type === 'bronze'){ fill = '#d9a17a'; ribbon1 = '#b76b3a'; ribbon2 = '#7f4523'; }
      const svg = `
        <svg width="46" height="46" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg" role="img">
          <rect x="9" y="0" width="8" height="16" fill="${ribbon1}" transform="rotate(-20 13 8)"></rect>
          <rect x="29" y="0" width="8" height="16" fill="${ribbon2}" transform="rotate(20 33 8)"></rect>
          <circle cx="23" cy="26" r="14" fill="${fill}" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
          <circle cx="19" cy="22" r="5.5" fill="rgba(255,255,255,0.18)"/>
        </svg>
      `;
      return svg;
    }

    // Für jeden Raum eine stilisierte Board-Karte (ohne Avatar)
    rooms.forEach(roomName=>{
      const arr = dataMap[roomName] || [];
      const board = document.createElement('div');
      board.className = 'exportBoard';

      // optional glow decor
      const glow = document.createElement('div'); glow.className = 'glow';
      board.appendChild(glow);

      // header
      const header = document.createElement('div'); header.className = 'boardHeader';
      const title = document.createElement('div'); title.className = 'boardTitle';
      title.textContent = roomName.toUpperCase();
      header.appendChild(title);
      board.appendChild(header);

      // rows container
      const rowsWrap = document.createElement('div'); rowsWrap.className = 'rows';

      // ensure at least 5 rows for visual consistency
      for(let i=0;i<5;i++){
        const rowData = arr[i] || null;
        const row = document.createElement('div'); row.className = 'row';

        // medal/rank circle (left)
        const medal = document.createElement('div');
        medal.className = 'medal';
        if(i === 0) {
          medal.classList.add('gold');
          medal.innerHTML = medalSVG('gold');
        } else if(i === 1) {
          medal.classList.add('silver');
          medal.innerHTML = medalSVG('silver');
        } else if(i === 2) {
          medal.classList.add('bronze');
          medal.innerHTML = medalSVG('bronze');
        } else {
          medal.classList.add('rankNum');
          medal.textContent = (i+1).toString();
        }
        row.appendChild(medal);

        // name block (wider since no avatar)
        const nameBlock = document.createElement('div'); nameBlock.className = 'nameBlock';
        const namePill = document.createElement('div'); namePill.className = 'namePill';
        namePill.style.minWidth = '420px'; // etwas breiter ohne Avatar

        const nameText = document.createElement('div');
        nameText.textContent = rowData && rowData.groupName ? rowData.groupName : '-';
        namePill.appendChild(nameText);
        nameBlock.appendChild(namePill);

        // score badge (use timeDisplay if present, else timeSeconds formatted)
        const scoreBadge = document.createElement('div'); scoreBadge.className = 'scoreBadge';
        const timeText = (rowData && rowData.timeDisplay) ? rowData.timeDisplay : (rowData && rowData.timeSeconds ? formatTime(Number(rowData.timeSeconds)) : '-');
        scoreBadge.textContent = timeText;
        nameBlock.appendChild(scoreBadge);

        row.appendChild(nameBlock);
        rowsWrap.appendChild(row);
      }

      board.appendChild(rowsWrap);
      container.appendChild(board);
    });

    exportArea.appendChild(container);

    // render with html2canvas (scale=2 for higher DPI). use backgroundColor:null to keep gradient
    const canvas = await html2canvas(container, {scale:2, backgroundColor: null});
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'leaderboard_overview.jpg';
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch(err){
    console.error('generateAdminImage error', err);
    alert('Fehler beim Erzeugen des Bildes: ' + String(err));
  }
}
