/* =========================
   Football Rating · 5v5
   Single-file vanilla JS
   ========================= */

const STORAGE_KEY = 'football-rating-v1';
const DEFAULT_STATS = ['Pace', 'Shooting', 'Passing', 'Defense'];

// ----- STATE -----
let state = loadState() || createInitialState();
let currentEditingId = null;
let sortConfig = { key: 'rating', dir: 'desc' };
let hiddenCols = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY + '_hiddenCols') || '[]'));
let customColOrder = JSON.parse(localStorage.getItem(STORAGE_KEY + '_colOrder') || 'null');
let isUnlocked = localStorage.getItem(STORAGE_KEY + '_unlocked') === 'true';

function saveHiddenCols() { localStorage.setItem(STORAGE_KEY + '_hiddenCols', JSON.stringify([...hiddenCols])); }
function saveColOrder() { localStorage.setItem(STORAGE_KEY + '_colOrder', JSON.stringify(customColOrder)); }

document.getElementById('btnToggleCols')?.addEventListener('click', () => {
  const el = document.getElementById('colToggles');
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
});

function createInitialState() {
  return {
    players: [
      // Team A
      mkPlayer({ name: 'Songkran',  team: 'A', position: 'GK',  index: 0, rating: 8.5, stats: { Pace: 6, Shooting: 4, Passing: 6, Defense: 9 } }),
      mkPlayer({ name: 'Phukan',    team: 'A', position: 'DEF', index: 0, rating: 7.5, stats: { Pace: 6, Shooting: 5, Passing: 7, Defense: 8 } }),
      mkPlayer({ name: 'Tawan',     team: 'A', position: 'DEF', index: 1, rating: 7.0, stats: { Pace: 7, Shooting: 4, Passing: 7, Defense: 8 } }),
      mkPlayer({ name: 'Chanon',    team: 'A', position: 'FWD', index: 0, rating: 8.0, stats: { Pace: 9, Shooting: 8, Passing: 7, Defense: 4 } }),
      mkPlayer({ name: 'Mek',       team: 'A', position: 'FWD', index: 1, rating: 7.5, stats: { Pace: 8, Shooting: 8, Passing: 6, Defense: 4 } }),
      // Team B
      mkPlayer({ name: 'Pongsak',   team: 'B', position: 'GK',  index: 0, rating: 8.0, stats: { Pace: 5, Shooting: 4, Passing: 6, Defense: 9 } }),
      mkPlayer({ name: 'Komsan',    team: 'B', position: 'DEF', index: 0, rating: 7.0, stats: { Pace: 6, Shooting: 4, Passing: 7, Defense: 8 } }),
      mkPlayer({ name: 'Beam',      team: 'B', position: 'DEF', index: 1, rating: 7.5, stats: { Pace: 7, Shooting: 5, Passing: 7, Defense: 8 } }),
      mkPlayer({ name: 'Nat',       team: 'B', position: 'FWD', index: 0, rating: 9.0, stats: { Pace: 9, Shooting: 9, Passing: 7, Defense: 4 } }),
      mkPlayer({ name: 'Boss',      team: 'B', position: 'FWD', index: 1, rating: 7.0, stats: { Pace: 7, Shooting: 7, Passing: 6, Defense: 5 } }),
      // Bench
      mkPlayer({ name: 'Aof',  team: null, position: 'SUB', index: null, rating: 6.5, stats: { Pace: 7, Shooting: 6, Passing: 6, Defense: 5 } }),
      mkPlayer({ name: 'Ice',  team: null, position: 'SUB', index: null, rating: 6.0, stats: { Pace: 6, Shooting: 5, Passing: 5, Defense: 6 } }),
    ]
  };
}

function mkPlayer({ name, team = null, position = 'SUB', index = null, rating = 5.0, stats = {} }) {
  // Fill missing default stats with 5
  const filledStats = {};
  DEFAULT_STATS.forEach(s => { filledStats[s] = (s in stats) ? stats[s] : 5; });
  Object.keys(stats).forEach(k => filledStats[k] = stats[k]);
  return {
    id: 'p_' + Math.random().toString(36).slice(2, 10),
    name,
    team,
    position,
    index,
    rating,
    image: null,
    stats: filledStats,
  };
}

// ----- PERSISTENCE -----
let isSyncing = false; // ป้องกันการเซฟลูปกลับไปตอนรับข้อมูล

function saveState() {
  const jsonStr = JSON.stringify(state);
  
  try {
    localStorage.setItem(STORAGE_KEY, jsonStr);
  } catch (e) {
    console.warn('localStorage saveState failed', e);
  }
  
  try {
    // ถ้าเชื่อมต่อ Firebase แล้ว ให้ส่งข้อมูลขึ้น Server ด้วย
    if (window.firebaseDB && !isSyncing) {
      const { db, ref, set } = window.firebaseDB;
      set(ref(db, 'football-rating/state'), state);
    }
  } catch (e) {
    console.warn('firebase saveState failed', e);
  }
}

// รับข้อมูลอัปเดตแบบ Real-time จาก Firebase
window.addEventListener('firebase-ready', () => {
  if (!window.firebaseDB) return;
  const { db, ref, onValue } = window.firebaseDB;
  
  onValue(ref(db, 'football-rating/state'), (snapshot) => {
    const data = snapshot.val();
    if (data && Array.isArray(data.players)) {
      isSyncing = true;
      state = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderField();
      if (document.getElementById('view-summary').classList.contains('active')) {
        renderSummary();
      }
      isSyncing = false;
    }
  });
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.players)) return null;
    return parsed;
  } catch (e) { return null; }
}

// ----- HELPERS -----
function initials(name) {
  const parts = (name || '?').trim().split(/\s+/);
  if (!parts[0]) return '??';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function getPlayer(id) {
  return state.players.find(p => p.id === id);
}
function getAllStatKeys() {
  const set = new Set(DEFAULT_STATS);
  state.players.forEach(p => Object.keys(p.stats || {}).forEach(k => set.add(k)));
  return Array.from(set);
}

// ----- RENDER: FIELD -----
function renderField() {
  // Clear all slots and bench
  document.querySelectorAll('.slot').forEach(s => s.innerHTML = '');
  document.querySelectorAll('.pitch > .player-card').forEach(s => s.remove());
  const bench = document.getElementById('bench');
  bench.innerHTML = '';
  
  const pitch = document.getElementById('pitch');
  if (isUnlocked) pitch.classList.add('unlocked');
  else pitch.classList.remove('unlocked');

  // Group players
  state.players.forEach(p => {
    const card = renderPlayerCard(p);
    
    if (isUnlocked && p.position !== 'SUB' && p.x !== undefined && p.y !== undefined) {
      card.style.position = 'absolute';
      card.style.left = p.x + '%';
      card.style.top = p.y + '%';
      card.style.translate = '-50% -50%';
      card.style.margin = '0';
      card.style.zIndex = '10';
      pitch.appendChild(card);
    } else if (!isUnlocked && p.team && p.position !== 'SUB' && p.index !== null) {
      const slot = document.querySelector(
        `.slot[data-team="${p.team}"][data-position="${p.position}"][data-index="${p.index}"]`
      );
      if (slot) slot.appendChild(card);
      else bench.appendChild(card); // fallback if slot missing
    } else {
      bench.appendChild(card);
    }
  });

  document.getElementById('benchCount').textContent =
    state.players.filter(p => !p.team || p.position === 'SUB').length;
}

function renderPlayerCard(p) {
  const card = document.createElement('div');
  card.className = 'player-card';
  card.draggable = true;
  card.dataset.playerId = p.id;
  if (p.team) card.dataset.team = p.team;

  const posTag = (p.team) ? p.position : 'SUB';
  const avatarHtml = p.image 
    ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
    : initials(p.name);

  // Create Stats HTML for the back
  let statsHtml = '';
  const statKeys = Object.keys(p.stats).slice(0, 6);
  statKeys.forEach(k => {
    statsHtml += `
      <div class="card-stat-row">
        <span class="card-stat-name">${k.substring(0,3).toUpperCase()}</span>
        <span class="card-stat-val">${p.stats[k]}</span>
      </div>
    `;
  });

  const posTagHtml = `<span class="player-pos-tag">${posTag}</span>`;

  card.innerHTML = `
    <div class="card-inner">
      <!-- FRONT -->
      <div class="card-front">
        ${posTagHtml}
        <div class="player-avatar">${avatarHtml}</div>
        <div class="player-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="player-rating-mini">${p.rating.toFixed(1)}</div>
      </div>
      <!-- BACK -->
      <div class="card-back">
        <div class="card-back-bg">${avatarHtml}</div>
        <div class="card-back-overlay">
          <div class="card-back-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="card-back-rating-large">${p.rating.toFixed(1)}</div>
          <div class="card-stats-grid">
            ${statsHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openPlayerModal(p.id));
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', p.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ----- DRAG & DROP -----
function setupDnD() {
  // Slots
  document.querySelectorAll('.slot').forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const moving = getPlayer(id);
      if (!moving) return;

      const team = slot.dataset.team;
      const position = slot.dataset.position;
      const index = parseInt(slot.dataset.index, 10);

      // Player currently in that slot
      const existing = state.players.find(p => p.team === team && p.position === position && p.index === index && p.id !== id);

      if (existing) {
        // Swap positions
        existing.team = moving.team;
        existing.position = moving.position;
        existing.index = moving.index;
      }
      moving.team = team;
      moving.position = position;
      moving.index = index;

      saveState();
      renderField();
    });
  });

  // Bench
  const bench = document.getElementById('bench');
  bench.addEventListener('dragover', (e) => {
    e.preventDefault();
    bench.classList.add('drag-over');
  });
  bench.addEventListener('dragleave', () => bench.classList.remove('drag-over'));
  bench.addEventListener('drop', (e) => {
    e.preventDefault();
    bench.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    const moving = getPlayer(id);
    if (!moving) return;
    moving.team = null;
    moving.position = 'SUB';
    moving.index = null;
    moving.x = undefined;
    moving.y = undefined;
    saveState();
    renderField();
  });
  
  // Pitch free placement
  const pitch = document.getElementById('pitch');
  pitch.addEventListener('dragover', e => {
    if (isUnlocked) {
      e.preventDefault();
    }
  });
  pitch.addEventListener('drop', e => {
    if (!isUnlocked) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const moving = getPlayer(id);
    if (!moving) return;

    const rect = pitch.getBoundingClientRect();
    moving.x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    moving.y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    
    if (moving.position === 'SUB') {
      moving.team = 'FREE';
      moving.position = 'FREE';
    }
    saveState();
    renderField();
  });
}

// ----- PLAYER MODAL -----
const modal = document.getElementById('modal');
const modalName = document.getElementById('modalName');
const modalPosition = document.getElementById('modalPosition');
const modalOverall = document.getElementById('modalOverall');
const modalStars = document.getElementById('modalStars');
const modalAvatar = document.getElementById('modalAvatar');
const modalInitials = document.getElementById('modalInitials');
const statsList = document.getElementById('statsList');

function openPlayerModal(id) {
  currentEditingId = id;
  const p = getPlayer(id);
  if (!p) return;

  modalName.value = p.name;
  modalPosition.textContent = p.team ? `TEAM ${p.team} · ${p.position}` : 'SUB';
  modalOverall.value = p.rating.toFixed(1);
  modalInitials.textContent = initials(p.name);

  // Set avatar color based on team
  modalAvatar.style.background = p.team === 'A'
    ? 'linear-gradient(135deg, var(--neon), var(--neon-purple))'
    : p.team === 'B'
    ? 'linear-gradient(135deg, var(--neon-pink), var(--neon-yellow))'
    : 'linear-gradient(135deg, var(--neon-yellow), var(--neon-2))';

  const modalImg = document.getElementById('modalImg');
  if (p.image) {
    modalImg.src = p.image;
    modalImg.style.display = 'block';
    modalInitials.style.display = 'none';
  } else {
    modalImg.src = '';
    modalImg.style.display = 'none';
    modalInitials.style.display = 'block';
  }

  renderStars(modalStars, p.rating, 10, (val) => {
    const currentP = getPlayer(p.id);
    if (!currentP) return;
    currentP.rating = val;
    modalOverall.value = val.toFixed(1);
    saveState();
    // Update card in field
    const cardFront = document.querySelector(`.player-card[data-player-id="${currentP.id}"] .card-front .player-rating-mini`);
    if (cardFront) cardFront.textContent = val.toFixed(1);
    const cardBack = document.querySelector(`.player-card[data-player-id="${currentP.id}"] .card-back-rating-large`);
    if (cardBack) cardBack.textContent = val.toFixed(1);
  });

  renderStatsList(p);
  modal.hidden = false;
}

document.getElementById('modalAvatar').addEventListener('click', () => {
  document.getElementById('modalImageInput').click();
});
document.getElementById('modalImageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Compress image
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 250; // Resize to max 250px
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85); // 85% quality JPEG
      
      const p = getPlayer(currentEditingId);
      if (!p) return;
      p.image = compressedBase64;
      saveState();
      
      const modalImg = document.getElementById('modalImg');
      modalImg.src = p.image;
      modalImg.style.display = 'block';
      document.getElementById('modalInitials').style.display = 'none';
      
      // Update field avatar instantly
      const fieldCardAvatar = document.querySelector(`.player-card[data-player-id="${p.id}"] .player-avatar`);
      if (fieldCardAvatar) {
        fieldCardAvatar.innerHTML = `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

function closeModal() {
  modal.hidden = true;
  currentEditingId = null;
  renderField();
  if (document.getElementById('view-summary').classList.contains('active')) {
    renderSummary();
  }
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnSavePlayer').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

modalName.addEventListener('input', () => {
  const p = getPlayer(currentEditingId);
  if (!p) return;
  p.name = modalName.value || 'Unknown';
  modalInitials.textContent = initials(p.name);
  saveState();
});

modalOverall.addEventListener('input', (e) => {
  const p = getPlayer(currentEditingId);
  if (!p) return;
  let val = parseFloat(e.target.value);
  if (isNaN(val)) val = 0;
  if (val > 10) val = 10;
  if (val < 0) val = 0;
  
  p.rating = val;
  saveState();
  
  // Re-render stars to match input
  renderStars(modalStars, p.rating, 10, (v) => {
    const currentP = getPlayer(p.id);
    if (!currentP) return;
    currentP.rating = v;
    modalOverall.value = v.toFixed(1);
    saveState();
    const cardFront = document.querySelector(`.player-card[data-player-id="${currentP.id}"] .card-front .player-rating-mini`);
    if (cardFront) cardFront.textContent = v.toFixed(1);
    const cardBack = document.querySelector(`.player-card[data-player-id="${currentP.id}"] .card-back-rating-large`);
    if (cardBack) cardBack.textContent = v.toFixed(1);
  });
  
  // Update card in field
  const cardFront = document.querySelector(`.player-card[data-player-id="${p.id}"] .card-front .player-rating-mini`);
  if (cardFront) cardFront.textContent = val.toFixed(1);
  const cardBack = document.querySelector(`.player-card[data-player-id="${p.id}"] .card-back-rating-large`);
  if (cardBack) cardBack.textContent = val.toFixed(1);
});

document.getElementById('btnDeletePlayer').addEventListener('click', () => {
  const p = getPlayer(currentEditingId);
  if (!p) return;
  if (!confirm(`ลบผู้เล่น "${p.name}" หรือไม่?`)) return;
  state.players = state.players.filter(x => x.id !== p.id);
  saveState();
  closeModal();
  toast(`ลบ ${p.name} แล้ว`);
});

// ----- STARS -----
function renderStars(container, value, maxStars = 10, onChange) {
  container.innerHTML = '';
  // value is 0-10 (we map to 10 stars, each = 1.0; supports halves)
  for (let i = 1; i <= maxStars; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.textContent = '★';
    if (value >= i) star.classList.add('full');
    else if (value >= i - 0.5) star.classList.add('half');

    star.addEventListener('click', (e) => {
      const rect = star.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const isHalf = x < rect.width / 2;
      const newVal = isHalf ? i - 0.5 : i;
      onChange(newVal);
      renderStars(container, newVal, maxStars, onChange);
    });
    container.appendChild(star);
  }
}

// ----- STATS LIST -----
function renderStatsList(p) {
  statsList.innerHTML = '';
  const keys = Object.keys(p.stats);
  keys.forEach((key, i) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.style.animationDelay = (i * 0.05) + 's';
    const val = p.stats[key];
    const tier = val >= 9 ? 'elite' : val >= 7 ? 'high' : val >= 5 ? 'mid' : 'low';
    row.innerHTML = `
      <div class="stat-name">${escapeHtml(key)}</div>
      <div class="stat-bar-wrap">
        <div class="stat-bar-fill ${tier}" style="width: 0%"></div>
      </div>
      <div class="stat-value">${val.toFixed(1)}</div>
      <button class="stat-delete" title="ลบ stat">✕</button>
    `;
    const fill = row.querySelector('.stat-bar-fill');
    const valueEl = row.querySelector('.stat-value');
    const barWrap = row.querySelector('.stat-bar-wrap');

    // Animate fill in
    requestAnimationFrame(() => {
      fill.style.width = (val * 10) + '%';
    });

    // Click bar to set value
    barWrap.addEventListener('click', (e) => {
      const rect = barWrap.getBoundingClientRect();
      const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      // Snap to nearest 0.5
      const newVal = Math.round(pct * 20) / 2;
      const currentP = getPlayer(p.id);
      if (!currentP) return;
      currentP.stats[key] = newVal;
      saveState();
      // Update tier and width
      const t = newVal >= 9 ? 'elite' : newVal >= 7 ? 'high' : newVal >= 5 ? 'mid' : 'low';
      fill.className = 'stat-bar-fill ' + t;
      fill.style.width = (newVal * 10) + '%';
      valueEl.textContent = newVal.toFixed(1);
    });

    row.querySelector('.stat-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (DEFAULT_STATS.includes(key)) {
        if (!confirm(`"${key}" เป็น stat หลัก จะลบจริงๆ?`)) return;
      }
      const currentP = getPlayer(p.id);
      if (!currentP) return;
      delete currentP.stats[key];
      saveState();
      renderStatsList(currentP);
    });

    statsList.appendChild(row);
  });
}

// ----- ADD STAT MODAL -----
const addStatModal = document.getElementById('addStatModal');
document.getElementById('btnAddStat').addEventListener('click', () => {
  document.getElementById('newStatName').value = '';
  addStatModal.hidden = false;
  setTimeout(() => document.getElementById('newStatName').focus(), 50);
});
document.getElementById('cancelAddStat').addEventListener('click', () => addStatModal.hidden = true);
addStatModal.addEventListener('click', (e) => { if (e.target === addStatModal) addStatModal.hidden = true; });
document.getElementById('confirmAddStat').addEventListener('click', addStatToPlayer);
document.getElementById('newStatName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addStatToPlayer();
});

function addStatToPlayer() {
  const name = document.getElementById('newStatName').value.trim();
  if (!name) return;
  const p = getPlayer(currentEditingId);
  if (!p) return;
  if (p.stats[name] !== undefined) {
    toast('Stat นี้มีอยู่แล้ว');
    return;
  }
  p.stats[name] = 5;
  saveState();
  addStatModal.hidden = true;
  renderStatsList(p);
  toast(`เพิ่ม stat "${name}"`);
}

// ----- ADD PLAYER -----
document.getElementById('btnAddPlayer').addEventListener('click', () => {
  const name = prompt('ชื่อผู้เล่นใหม่:');
  if (!name) return;
  const np = mkPlayer({ name: name.trim(), team: null, position: 'SUB', index: null, rating: 5.0 });
  state.players.push(np);
  saveState();
  renderField();
  toast(`เพิ่ม ${np.name} แล้ว`);
});

// ----- TABS -----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('view-' + target).classList.add('active');
    if (target === 'summary') renderSummary();
    if (target === 'field') renderField();
  });
});

// ----- SUMMARY -----
function renderSummary() {
  const allStats = getAllStatKeys();
  const head = document.getElementById('summaryHead');
  const body = document.getElementById('summaryBody');
  head.innerHTML = '';
  body.innerHTML = '';

  const baseCols = [
    { key: 'name',     label: 'ผู้เล่น',  type: 'str' },
    { key: 'rating',   label: '⭐ OVERALL', type: 'num' },
    { key: 'team',     label: 'ทีม',   type: 'str' },
    { key: 'position', label: 'ตำแหน่ง', type: 'str' },
    ...allStats.map(s => ({ key: 'stat:' + s, label: s.toUpperCase(), type: 'num' }))
  ];

  if (!customColOrder) {
    customColOrder = baseCols.map(c => c.key);
  } else {
    const newKeys = baseCols.map(c => c.key).filter(k => !customColOrder.includes(k));
    customColOrder.push(...newKeys);
    customColOrder = customColOrder.filter(k => baseCols.some(c => c.key === k));
  }
  
  const columns = customColOrder.map(k => baseCols.find(c => c.key === k));

  // Toggles render
  const colToggles = document.getElementById('colToggles');
  if (colToggles) {
    colToggles.innerHTML = '';
    columns.forEach(col => {
      const lbl = document.createElement('label');
      lbl.style.display = 'flex';
      lbl.style.alignItems = 'center';
      lbl.style.gap = '4px';
      lbl.style.fontSize = '13px';
      lbl.style.cursor = 'pointer';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !hiddenCols.has(col.key);
      cb.addEventListener('change', () => {
        if (cb.checked) hiddenCols.delete(col.key);
        else hiddenCols.add(col.key);
        saveHiddenCols();
        renderSummary();
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(col.label));
      colToggles.appendChild(lbl);
    });
  }

  const activeCols = columns.filter(c => !hiddenCols.has(c.key));

  activeCols.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.dataset.key = col.key;
    th.title = "ลากเพื่อสลับตำแหน่ง / คลิกเพื่อ Sort";
    th.draggable = true;
    
    if (sortConfig.key === col.key) th.classList.add(sortConfig.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    th.addEventListener('click', () => {
      if (sortConfig.key === col.key) {
        sortConfig.dir = sortConfig.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortConfig.key = col.key;
        sortConfig.dir = col.type === 'num' ? 'desc' : 'asc';
      }
      renderSummary();
    });

    // Drag and drop logic
    th.addEventListener('dragstart', e => {
      e.dataTransfer.setData('colKey', col.key);
      th.style.opacity = '0.5';
    });
    th.addEventListener('dragend', () => th.style.opacity = '1');
    th.addEventListener('dragover', e => { e.preventDefault(); th.style.background = 'rgba(0,240,255,0.15)'; });
    th.addEventListener('dragleave', () => th.style.background = '');
    th.addEventListener('drop', e => {
      e.preventDefault();
      th.style.background = '';
      const dragKey = e.dataTransfer.getData('colKey');
      if (dragKey && dragKey !== col.key) {
        const fromIdx = customColOrder.indexOf(dragKey);
        const toIdx = customColOrder.indexOf(col.key);
        customColOrder.splice(fromIdx, 1);
        customColOrder.splice(toIdx, 0, dragKey);
        saveColOrder();
        renderSummary();
      }
    });

    head.appendChild(th);
  });

  // Sort
  const getVal = (p, key) => {
    if (key === 'name') return p.name?.toLowerCase() || '';
    if (key === 'team') return p.team || 'Z'; 
    if (key === 'position') return p.position;
    if (key === 'rating') return p.rating;
    if (key.startsWith('stat:')) return p.stats[key.slice(5)] ?? 0;
    return '';
  };

  const sorted = [...state.players].sort((a, b) => {
    const va = getVal(a, sortConfig.key);
    const vb = getVal(b, sortConfig.key);
    let cmp;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb));
    return sortConfig.dir === 'asc' ? cmp : -cmp;
  });

  document.getElementById('totalCount').textContent = sorted.length;

  sorted.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = (i * 0.025) + 's';
    tr.dataset.id = p.id;

    const teamPill = p.team
      ? `<span class="pill pill-${p.team}">TEAM ${p.team}</span>`
      : `<span class="pill pill-SUB">SUB</span>`;
      
    const avatarContent = p.image 
      ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;" />`
      : initials(p.name);

    activeCols.forEach(col => {
      const td = document.createElement('td');
      if (col.key === 'name') {
        td.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, var(--neon), var(--neon-purple)); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; flex-shrink: 0; color: #fff;">
              ${avatarContent}
            </div>
            ${escapeHtml(p.name)}
          </div>
        `;
      } else if (col.key === 'team') {
        td.innerHTML = teamPill;
      } else if (col.key === 'position') {
        td.innerHTML = `<span class="pill pill-pos">${p.position}</span>`;
      } else if (col.key === 'rating') {
        td.innerHTML = `<span class="rating-cell">${p.rating.toFixed(1)}</span>`;
      } else if (col.key.startsWith('stat:')) {
        const v = p.stats[col.key.slice(5)];
        td.innerHTML = v === undefined ? '<span style="color:#5f6c8a">—</span>' : v.toFixed(1);
      }
      tr.appendChild(td);
    });

    tr.addEventListener('click', () => openPlayerModal(p.id));
    body.appendChild(tr);
  });
}

// ----- IMPORT / EXPORT -----
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `football-rating-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export สำเร็จ');
});

document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.players)) throw new Error('format');
    state = parsed;
    saveState();
    renderField();
    if (document.getElementById('view-summary').classList.contains('active')) renderSummary();
    toast('Import สำเร็จ');
  } catch (err) {
    toast('ไฟล์ไม่ถูกต้อง');
  }
  e.target.value = '';
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm('ล้างข้อมูลทั้งหมดและกลับไปใช้ค่าเริ่มต้น?')) return;
  state = createInitialState();
  saveState();
  renderField();
  if (document.getElementById('view-summary').classList.contains('active')) renderSummary();
  toast('Reset เรียบร้อย');
});

// ----- TOAST -----
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ----- INIT -----
function init() {
  let currentTheme = localStorage.getItem(STORAGE_KEY + '_theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.dataset.theme = 'light';
    const btn = document.getElementById('btnTheme');
    if (btn) btn.textContent = '🌙 Dark';
  }

  const btnTheme = document.getElementById('btnTheme');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      if (currentTheme === 'dark') {
        currentTheme = 'light';
        document.body.dataset.theme = 'light';
        btnTheme.textContent = '🌙 Dark';
      } else {
        currentTheme = 'dark';
        delete document.body.dataset.theme;
        btnTheme.textContent = '☀️ Light';
      }
      localStorage.setItem(STORAGE_KEY + '_theme', currentTheme);
    });
  }

  const btnUnlock = document.getElementById('btnUnlock');
  if (btnUnlock) {
    btnUnlock.textContent = isUnlocked ? '🔒 Lock' : '🔓 Unlock';
    btnUnlock.addEventListener('click', () => {
      isUnlocked = !isUnlocked;
      btnUnlock.textContent = isUnlocked ? '🔒 Lock' : '🔓 Unlock';
      localStorage.setItem(STORAGE_KEY + '_unlocked', isUnlocked);
      
      if (isUnlocked) {
        const pitchRect = document.getElementById('pitch').getBoundingClientRect();
        state.players.forEach(p => {
          if (p.team && p.position !== 'SUB' && p.index !== null && (p.x === undefined || p.y === undefined)) {
            const slot = document.querySelector(`.slot[data-team="${p.team}"][data-position="${p.position}"][data-index="${p.index}"]`);
            if (slot) {
              const rect = slot.getBoundingClientRect();
              p.x = ((rect.left + rect.width/2 - pitchRect.left) / pitchRect.width) * 100;
              p.y = ((rect.top + rect.height/2 - pitchRect.top) / pitchRect.height) * 100;
            }
          }
        });
        saveState();
      }
      
      renderField();
    });
  }

  renderField();
  setupDnD();
  // ESC closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!addStatModal.hidden) addStatModal.hidden = true;
      else if (!modal.hidden) closeModal();
    }
  });
}
init();
