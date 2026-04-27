/* ===========================
   PIXEL DASHBOARD — app.js
   (Google Sheets via JSONP)
   =========================== */

const API_URL = 'https://script.google.com/macros/s/AKfycbzgxxfQhBVF-kbaHnOQSxSp6QIlF4SrdUk0ifYN0YrDKz21QKx2CMmhA-olRM9tSgAL/exec';

/* ════ STATE ════ */
let tasks    = [];
let filter   = 'all';
let editId   = null;
let selPrio  = 'high';
let selColor = '#00ff9f';
let calYear, calMonth;

const PRIO_ORDER  = { special: 0, high: 1, medium: 2, low: 3 };
const PRIO_LABELS = { special: '⚡ ด่วนพิเศษ', high: '🔴 ด่วนมาก', medium: '🟡 ด่วน', low: '🟢 ไม่ด่วน' };
const PRIO_VARS   = { special: '#ff3366', high: '#ff6b35', medium: '#ffcc00', low: '#00ff9f' };

/* ════ INIT ════ */
window.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  calYear   = now.getFullYear();
  calMonth  = now.getMonth();
  startClock();
  loadTasks();
});

/* ════ CLOCK ════ */
function startClock() {
  function tick() {
    const d = new Date();
    document.getElementById('clock').textContent =
      d.toLocaleTimeString('th-TH', { hour12: false });
    document.getElementById('datestr').textContent =
      d.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

/* ════ JSONP HELPER ════ */
// ใช้ JSONP แทน fetch เพื่อหลีกเลี่ยง CORS ทั้งหมด
function jsonp(params) {
  return new Promise((resolve, reject) => {
    const cbName = '_cb_' + Date.now();
    const qs = Object.entries(params)
      .map(([k,v]) => `${k}=${encodeURIComponent(typeof v==='object'?JSON.stringify(v):v)}`)
      .join('&');
    const url = `${API_URL}?callback=${cbName}&${qs}`;

    window[cbName] = (data) => {
      delete window[cbName];
      document.head.removeChild(script);
      resolve(data);
    };

    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => {
      delete window[cbName];
      document.head.removeChild(script);
      reject(new Error('JSONP failed'));
    };
    document.head.appendChild(script);
  });
}

/* ════ LOAD TASKS ════ */
async function loadTasks() {
  setLoading(true);
  try {
    const data = await jsonp({ action: 'get' });
    if (data.status === 'ok') {
      tasks = data.tasks;
      render();
    } else {
      showToast('ERROR: ' + data.message, 'error');
    }
  } catch (e) {
    showToast('ERROR: เชื่อมต่อ API ไม่ได้', 'error');
    console.error(e);
  }
  setLoading(false);
}

/* ════ SORT ════ */
function sorted(arr) {
  return [...arr].sort((a, b) => {
    const po = PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
    if (po !== 0) return po;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
}

/* ════ RENDER ════ */
function render() {
  renderSpotlight();
  renderList();
  renderHeader();
  renderCalendar();
}

function renderHeader() {
  const active = tasks.filter(t => !t.done);
  document.getElementById('hdr-total').textContent  = tasks.length;
  document.getElementById('hdr-urgent').textContent = active.filter(t => t.priority === 'special').length;
}

function renderSpotlight() {
  const active = sorted(tasks.filter(t => !t.done));
  const top    = active[0];
  const queue  = active.slice(1, 6);
  const body   = document.getElementById('spotlight-body');
  const badge  = document.getElementById('sp-badge');
  const nqList = document.getElementById('nq-list');
  nqList.innerHTML = '';

  if (queue.length === 0) {
    document.getElementById('next-queue').style.display = 'none';
  } else {
    document.getElementById('next-queue').style.display = 'block';
    queue.forEach(t => {
      const el = document.createElement('div');
      el.className = 'nq-item';
      el.onclick = () => openModal(t.id);
      el.innerHTML = `
        <div class="nq-dot" style="background:${t.color}"></div>
        <span class="nq-name">${esc(t.name)}</span>
        <span class="nq-date">${fmtDate(t.dueDate)}</span>
      `;
      nqList.appendChild(el);
    });
  }

  if (!top) {
    body.innerHTML = `<div class="no-task-msg">NO URGENT TASKS<br><span>ADD A TASK TO BEGIN</span></div>`;
    badge.textContent = '—';
    return;
  }

  badge.textContent = PRIO_LABELS[top.priority];
  const pcolor  = PRIO_VARS[top.priority];
  const overdue = top.dueDate && new Date(top.dueDate) < new Date() ? '⚠ OVERDUE' : '';

  body.innerHTML = `
    <div class="sp-priority-tag" style="color:${pcolor};border-color:${pcolor}">${PRIO_LABELS[top.priority]}</div>
    <div class="sp-color-bar" style="background:${top.color}"></div>
    <div class="sp-name">${esc(top.name)}</div>
    <div class="sp-due">DUE: <span>${top.dueDate ? fmtDate(top.dueDate) : 'ไม่ระบุ'}</span>
      ${overdue ? `<span style="color:var(--danger);margin-left:12px">${overdue}</span>` : ''}
    </div>
    <div class="sp-actions">
      <button class="sp-btn sp-btn-done" onclick="toggleDone(${top.id})">
        ${top.done ? '[ ✓ DONE ]' : '[ MARK DONE ]'}
      </button>
      <button class="sp-btn sp-btn-edit" onclick="openModal(${top.id})">[ EDIT ]</button>
    </div>
    ${top.done ? '<div class="sp-done-stamp">✓✓✓</div>' : ''}
  `;
}

function renderList() {
  const list  = document.getElementById('task-list');
  const empty = document.getElementById('empty-list');
  const visible = sorted(tasks).filter(t => filter === 'all' || t.priority === filter);
  list.innerHTML = '';
  if (visible.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  visible.forEach(t => {
    const li = document.createElement('li');
    li.className = `task-row${t.done ? ' done' : ''}`;
    li.dataset.p = t.priority;
    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && !t.done;
    li.innerHTML = `
      <div class="tr-color" style="background:${t.color}"></div>
      <span class="tr-prio">${PRIO_LABELS[t.priority]}</span>
      <span class="tr-name">${esc(t.name)}</span>
      <span class="tr-date ${isOverdue ? 'tr-overdue' : ''}">${fmtDate(t.dueDate)}</span>
      <button class="tr-edit" onclick="openModal(${t.id})">EDIT</button>
      <span class="tr-check" onclick="toggleDone(${t.id})">${t.done ? '☑' : '☐'}</span>
    `;
    list.appendChild(li);
  });
}

function renderCalendar() {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  document.getElementById('cal-title').textContent = `${months[calMonth]} ${calYear}`;
  const header = document.getElementById('cal-days-header');
  header.innerHTML = '';
  ['SUN','MON','TUE','WED','THU','FRI','SAT'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-name';
    el.textContent = d;
    header.appendChild(el);
  });
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  const today    = new Date();
  const first    = new Date(calYear, calMonth, 1);
  const last     = new Date(calYear, calMonth + 1, 0);
  const offset   = first.getDay();
  const prevLast = new Date(calYear, calMonth, 0).getDate();
  for (let i = offset - 1; i >= 0; i--) addCell(grid, prevLast - i, true, false, null);
  for (let d = 1; d <= last.getDate(); d++) {
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    addCell(grid, d, false, isToday, tasks.filter(t => t.dueDate===dateStr && !t.done));
  }
  const rem = (offset + last.getDate()) % 7;
  if (rem > 0) for (let i = 1; i <= 7 - rem; i++) addCell(grid, i, true, false, null);
}

function addCell(grid, num, otherMonth, isToday, dayTasks) {
  const cell = document.createElement('div');
  cell.className = `cal-cell${otherMonth?' other-month':''}${isToday?' today':''}`;
  const numEl = document.createElement('div');
  numEl.className = 'cal-num';
  numEl.textContent = num;
  cell.appendChild(numEl);
  if (dayTasks && dayTasks.length > 0) {
    const dots = document.createElement('div');
    dots.className = 'cal-dots';
    dayTasks.forEach(t => {
      const dot = document.createElement('div');
      dot.className = 'cal-dot';
      dot.style.background = PRIO_VARS[t.priority];
      if (t.priority === 'special') dot.style.boxShadow = `0 0 4px ${PRIO_VARS.special}`;
      dot.title = t.name;
      dots.appendChild(dot);
    });
    cell.appendChild(dots);
  }
  grid.appendChild(cell);
}

function prevMonth() { calMonth--; if (calMonth<0){calMonth=11;calYear--;} renderCalendar(); }
function nextMonth() { calMonth++; if (calMonth>11){calMonth=0;calYear++;} renderCalendar(); }

/* ════ TOGGLE DONE ════ */
async function toggleDone(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  const updated = { ...t, done: !t.done };
  tasks = tasks.map(x => x.id === id ? updated : x);
  render();
  try {
    await jsonp({ action: 'update', task: updated });
  } catch (e) {
    showToast('ERROR: บันทึกไม่สำเร็จ', 'error');
    await loadTasks();
  }
}

/* ════ FILTER ════ */
function setFilter(f, btn) {
  filter = f;
  document.querySelectorAll('.flt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}

/* ════ MODAL ════ */
function openModal(id = null) {
  editId = id;
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title-text');
  const delBtn  = document.getElementById('btn-delete');
  if (id !== null) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    titleEl.textContent = '[ EDIT TASK ]';
    document.getElementById('m-name').value = t.name;
    document.getElementById('m-date').value = t.dueDate || '';
    selectPrioByVal(t.priority);
    selectColorByVal(t.color);
    delBtn.style.display = 'inline-block';
  } else {
    titleEl.textContent = '[ + NEW TASK ]';
    document.getElementById('m-name').value = '';
    document.getElementById('m-date').value = '';
    selectPrioByVal('high');
    selectColorByVal('#00ff9f');
    delBtn.style.display = 'none';
  }
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('m-name').focus(), 100);
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
  editId = null;
}

function selectPrio(btn) {
  document.querySelectorAll('.prio-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selPrio = btn.dataset.p;
}
function selectPrioByVal(val) {
  selPrio = val;
  document.querySelectorAll('.prio-opt').forEach(b => b.classList.toggle('active', b.dataset.p === val));
}
function selectColor(btn) {
  document.querySelectorAll('.col-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selColor = btn.dataset.c;
}
function selectColorByVal(val) {
  selColor = val;
  document.querySelectorAll('.col-opt').forEach(b => b.classList.toggle('active', b.dataset.c === val));
}

/* ════ SAVE TASK ════ */
async function saveTask() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) {
    document.getElementById('m-name').style.borderColor = 'var(--danger)';
    setTimeout(() => document.getElementById('m-name').style.borderColor = '', 700);
    return;
  }
  const dueDate = document.getElementById('m-date').value || '';
  setLoading(true);
  document.getElementById('modal-overlay').classList.remove('open');
  try {
    if (editId !== null) {
      const updated = { ...tasks.find(t => t.id === editId), name, dueDate, priority: selPrio, color: selColor };
      tasks = tasks.map(t => t.id === editId ? updated : t);
      render();
      await jsonp({ action: 'update', task: updated });
      showToast('✓ UPDATED');
    } else {
      const newTask = { id: Date.now(), name, dueDate, priority: selPrio, color: selColor, done: false };
      tasks.push(newTask);
      render();
      await jsonp({ action: 'add', task: newTask });
      showToast('✓ TASK ADDED');
    }
  } catch (e) {
    showToast('ERROR: บันทึกไม่สำเร็จ', 'error');
    await loadTasks();
  }
  setLoading(false);
  editId = null;
}

/* ════ DELETE TASK ════ */
async function deleteTask() {
  if (editId === null) return;
  const id = editId;
  tasks = tasks.filter(t => t.id !== id);
  render();
  document.getElementById('modal-overlay').classList.remove('open');
  editId = null;
  try {
    await jsonp({ action: 'delete', id });
    showToast('✓ DELETED');
  } catch (e) {
    showToast('ERROR: ลบไม่สำเร็จ', 'error');
    await loadTasks();
  }
}

/* ════ KEYBOARD ════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { document.getElementById('modal-overlay').classList.remove('open'); editId = null; }
  if (e.key === 'Enter' && document.getElementById('modal-overlay').classList.contains('open')) saveTask();
});

/* ════ LOADING BAR ════ */
function setLoading(state) {
  let el = document.getElementById('loading-bar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-bar';
    el.style.cssText = 'position:fixed;top:48px;left:0;height:3px;z-index:9998;background:var(--accent);transition:width .3s;box-shadow:0 0 8px var(--accent);width:0';
    document.body.appendChild(el);
  }
  el.style.width = state ? '70%' : '100%';
  if (!state) setTimeout(() => { el.style.width = '0'; }, 400);
}

/* ════ TOAST ════ */
function showToast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;font-family:var(--pixel);font-size:9px;padding:10px 16px;background:var(--surface);border:2px solid ${type==='error'?'var(--danger)':'var(--accent)'};color:${type==='error'?'var(--danger)':'var(--accent)'};box-shadow:4px 4px 0 ${type==='error'?'#660022':'#006644'}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ════ HELPERS ════ */
function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}
