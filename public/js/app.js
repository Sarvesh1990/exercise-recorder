(async () => {

  // --- Elements ---
  const headerMain    = document.getElementById('header-main');
  const headerBack    = document.getElementById('header-back');
  const backBtn       = document.getElementById('back-btn');
  const headerCatName = document.getElementById('header-cat-name');
  const catGrid       = document.getElementById('cat-grid');
  const viewCats      = document.getElementById('view-cats');
  const viewExs       = document.getElementById('view-exs');
  const exList        = document.getElementById('ex-list');

  // Log sheet
  const backdrop    = document.getElementById('sheet-backdrop');
  const logSheet    = document.getElementById('log-sheet');
  const sheetExName = document.getElementById('sheet-ex-name');
  const sheetExLast = document.getElementById('sheet-ex-last');
  const sheetWeight = document.getElementById('sheet-weight');
  const sheetSets   = document.getElementById('sheet-sets');
  const sheetReps   = document.getElementById('sheet-reps');
  const sheetSave   = document.getElementById('sheet-save');

  // Add exercise sheet
  const addSheet    = document.getElementById('add-sheet');
  const addSheetSub = document.getElementById('add-sheet-sub');
  const addCatPicker= document.getElementById('add-cat-picker');
  const addExInput  = document.getElementById('add-ex-input');
  const addExSave   = document.getElementById('add-ex-save');

  // History / Charts
  const historyList   = document.getElementById('history-list');
  const historySearch = document.getElementById('history-search');
  const chartSelect   = document.getElementById('chart-exercise');
  const chartCanvas   = document.getElementById('progression-chart');
  const chartStatsDiv = document.getElementById('chart-stats');
  const syncStatus    = document.getElementById('sync-status');
  const toastEl       = document.getElementById('toast');

  // --- Exercise Library ---
  const DEFAULT_EXERCISES = {
    'Chest':     ['Bench Press','Incline Bench','Decline Bench','DB Fly','Cable Fly','Push-Up','Dips','Chest Press'],
    'Back':      ['Deadlift','Pull-Up','Lat Pulldown','Seated Row','Bent Over Row','T-Bar Row','Single Arm Row','Face Pull','Hyperextension'],
    'Shoulders': ['Overhead Press','DB Shoulder Press','Lateral Raise','Front Raise','Rear Delt Fly','Arnold Press','Shrugs','Upright Row'],
    'Legs':      ['Squat','Leg Press','Romanian Deadlift','Leg Extension','Leg Curl','Lunges','Calf Raise','Hack Squat','Bulgarian Split Squat'],
    'Arms':      ['Barbell Curl','Dumbbell Curl','Hammer Curl','Preacher Curl','Tricep Pushdown','Skull Crusher','Overhead Tricep','Close Grip Bench'],
    'Core':      ['Plank','Crunch','Cable Crunch','Leg Raise','Russian Twist','Ab Rollout','Side Plank'],
  };

  const CAT_META = {
    'Chest':     { emoji: '🫁', color: '#ff5c7a' },
    'Back':      { emoji: '🏹', color: '#4895ef' },
    'Shoulders': { emoji: '🏋️', color: '#a78bfa' },
    'Legs':      { emoji: '🦵', color: '#34d399' },
    'Arms':      { emoji: '💪', color: '#fb923c' },
    'Core':      { emoji: '⚡', color: '#fbbf24' },
  };

  // Custom exercises stored in localStorage: { Chest: ['My Ex'], ... }
  function loadCustomExercises() {
    try { return JSON.parse(localStorage.getItem('customExercises') || '{}'); } catch { return {}; }
  }
  function saveCustomExercises(obj) {
    localStorage.setItem('customExercises', JSON.stringify(obj));
  }
  function getExercisesForCat(cat) {
    const custom = loadCustomExercises();
    return [...DEFAULT_EXERCISES[cat], ...(custom[cat] || [])];
  }
  function addCustomExercise(cat, name) {
    const custom = loadCustomExercises();
    if (!custom[cat]) custom[cat] = [];
    if (!custom[cat].includes(name)) custom[cat].push(name);
    saveCustomExercises(custom);
  }

  // --- State ---
  let currentCategory = null;
  let currentExercise = null;
  let selectedUnit    = 'kg';
  let addingForCat    = null; // which cat the add-sheet is for (null = from home)

  // --- Init ---
  await ExerciseDB.open();
  renderCategories();
  updateSyncBadge();
  attemptSync();

  // --- Tabs ---
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'record') updateHeader();
      else { headerMain.classList.remove('hidden'); headerBack.classList.add('hidden'); }
      if (tab.dataset.tab === 'history') loadHistory();
      if (tab.dataset.tab === 'charts')  loadChartExercises();
    });
  });

  function updateHeader() {
    const inEx = viewExs.classList.contains('active');
    headerMain.classList.toggle('hidden', inEx);
    headerBack.classList.toggle('hidden', !inEx);
    if (inEx) headerCatName.textContent = currentCategory;
  }

  // ─────────────────────────────────
  //  Screen 1 — Category Grid
  // ─────────────────────────────────
  async function renderCategories() {
    catGrid.innerHTML = Object.entries(DEFAULT_EXERCISES).map(([cat]) => {
      const m = CAT_META[cat];
      return `
        <button class="cat-card" data-cat="${cat}" style="--cat-color:${m.color}">
          <span class="cat-emoji">${m.emoji}</span>
          <span class="cat-name">${cat}</span>
          <span class="cat-sub">${getExercisesForCat(cat).length} exercises</span>
        </button>`;
    }).join('') + `
      <button class="cat-card cat-custom" id="custom-ex-btn">
        <span class="cat-plus-icon">+</span>
        <span class="cat-name">Custom Exercise</span>
      </button>`;

    catGrid.querySelectorAll('.cat-card:not(.cat-custom)').forEach(btn => {
      btn.addEventListener('click', () => openCategory(btn.dataset.cat));
    });
    document.getElementById('custom-ex-btn').addEventListener('click', () => openAddSheet(null));
  }

  // ─────────────────────────────────
  //  Screen 2 — Exercise List
  // ─────────────────────────────────
  async function openCategory(cat) {
    currentCategory = cat;

    const all    = await ExerciseDB.getAll();
    const lastMap = {};
    all.forEach(e => {
      const n = e.name;
      if (!lastMap[n] || new Date(e.created_at) > new Date(lastMap[n].created_at)) lastMap[n] = e;
    });

    const exercises = getExercisesForCat(cat);
    exList.innerHTML = exercises.map(ex => {
      const last    = lastMap[ex.toLowerCase()];
      const lastStr = last
        ? `${last.weight}${last.unit}${last.sets ? ' · ' + last.sets + '×' + (last.reps || '?') : ''}`
        : 'No history';
      return `
        <button class="ex-row" data-name="${ex}">
          <div class="ex-row-info">
            <span class="ex-row-name">${ex}</span>
            <span class="ex-row-last">${lastStr}</span>
          </div>
          <span class="ex-chevron">›</span>
        </button>`;
    }).join('') + `
      <button class="ex-add-row" id="add-to-cat-btn">
        <span class="ex-add-icon">+</span>
        Add exercise to ${cat}
      </button>`;

    exList.querySelectorAll('.ex-row').forEach(row => {
      row.addEventListener('click', () => openLogSheet(row.dataset.name));
    });
    document.getElementById('add-to-cat-btn').addEventListener('click', () => openAddSheet(cat));

    viewCats.classList.remove('active');
    viewExs.classList.add('active');
    updateHeader();
  }

  backBtn.addEventListener('click', () => {
    closeLogSheet();
    closeAddSheet();
    viewExs.classList.remove('active');
    viewCats.classList.add('active');
    currentCategory = null;
    updateHeader();
    renderCategories();
  });

  // ─────────────────────────────────
  //  Log Sheet
  // ─────────────────────────────────
  async function openLogSheet(exerciseName) {
    currentExercise = exerciseName;
    const last = await ExerciseDB.getLastByName(exerciseName);

    sheetExName.textContent = exerciseName;

    if (last) {
      const d = new Date(last.created_at);
      const ds = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      sheetExLast.textContent = `Last: ${ds} · ${last.weight}${last.unit}${last.sets ? ' · ' + last.sets + '×' + (last.reps || '?') : ''}`;
      sheetWeight.value = last.weight;
      sheetSets.value   = last.sets || '';
      sheetReps.value   = last.reps || '';
      setUnit(last.unit);
    } else {
      sheetExLast.textContent = 'First time — enter your weight';
      sheetWeight.value = '';
      sheetSets.value   = '';
      sheetReps.value   = '';
      setUnit('kg');
    }

    backdrop.classList.add('open');
    logSheet.classList.add('open');
    setTimeout(() => { sheetWeight.focus(); sheetWeight.select(); }, 320);
  }

  function closeLogSheet() {
    logSheet.classList.remove('open');
    if (!addSheet.classList.contains('open')) backdrop.classList.remove('open');
    currentExercise = null;
  }

  // Unit toggle
  function setUnit(unit) {
    selectedUnit = unit;
    document.querySelectorAll('.unit-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.unit === unit);
    });
  }
  document.querySelectorAll('.unit-opt').forEach(btn => {
    btn.addEventListener('click', () => setUnit(btn.dataset.unit));
  });

  // Adjust chips
  document.querySelectorAll('.adj-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const delta = parseFloat(chip.dataset.delta);
      const cur   = parseFloat(sheetWeight.value) || 0;
      const next  = Math.max(0, cur + delta);
      sheetWeight.value = +next.toFixed(2);
    });
  });

  // Steppers for sets/reps
  document.querySelectorAll('.sr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const delta = parseInt(btn.dataset.delta);
      const cur   = parseInt(input.value) || 0;
      input.value = Math.max(1, cur + delta);
    });
  });

  // Save
  sheetSave.addEventListener('click', async () => {
    if (!sheetWeight.value) { sheetWeight.focus(); return; }
    const name = currentExercise;
    await ExerciseDB.add({
      name, weight: sheetWeight.value,
      sets: sheetSets.value, reps: sheetReps.value,
      unit: selectedUnit, notes: '',
    });
    toast('Saved 💪', 'success');
    closeLogSheet();
    openCategory(currentCategory);
    attemptSync();
  });

  backdrop.addEventListener('click', () => {
    closeLogSheet();
    closeAddSheet();
  });

  // ─────────────────────────────────
  //  Add Exercise Sheet
  // ─────────────────────────────────
  function openAddSheet(cat) {
    addingForCat = cat;
    addExInput.value = '';

    // Build category picker (shown only when coming from home, not from a specific cat)
    if (cat === null) {
      addSheetSub.textContent = 'Choose a category';
      addCatPicker.style.display = 'flex';
      addCatPicker.innerHTML = Object.keys(DEFAULT_EXERCISES).map(c => `
        <button class="add-cat-pill${addingForCat === c ? ' active' : ''}" data-cat="${c}">${c}</button>
      `).join('');
      addCatPicker.querySelectorAll('.add-cat-pill').forEach(p => {
        p.addEventListener('click', () => {
          addingForCat = p.dataset.cat;
          addCatPicker.querySelectorAll('.add-cat-pill').forEach(x => x.classList.remove('active'));
          p.classList.add('active');
          addSheetSub.textContent = `Adding to ${addingForCat}`;
        });
      });
    } else {
      addSheetSub.textContent = `Adding to ${cat}`;
      addCatPicker.style.display = 'none';
    }

    backdrop.classList.add('open');
    addSheet.classList.add('open');
    setTimeout(() => addExInput.focus(), 320);
  }

  function closeAddSheet() {
    addSheet.classList.remove('open');
    if (!logSheet.classList.contains('open')) backdrop.classList.remove('open');
  }

  addExSave.addEventListener('click', async () => {
    const name = addExInput.value.trim();
    if (!name) { addExInput.focus(); return; }
    if (!addingForCat) { toast('Pick a category first', 'error'); return; }

    addCustomExercise(addingForCat, name);
    closeAddSheet();

    // Navigate to that category and open the log sheet
    await openCategory(addingForCat);
    openLogSheet(name);
  });

  addExInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addExSave.click();
  });

  // ─────────────────────────────────
  //  History Tab
  // ─────────────────────────────────
  async function loadHistory() {
    const all    = await ExerciseDB.getAll();
    const search = historySearch.value.toLowerCase();
    const list   = search ? all.filter(e => e.name.includes(search)) : all;

    if (list.length === 0) {
      historyList.innerHTML = `<div class="empty-state"><div class="emoji">📋</div><p>No entries found.</p></div>`;
      return;
    }
    const groups = {};
    list.forEach(e => {
      const day = new Date(e.created_at).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      });
      (groups[day] = groups[day] || []).push(e);
    });
    historyList.innerHTML = Object.entries(groups).map(([day, entries]) => `
      <div class="date-group">
        <div class="date-label">${day}</div>
        ${entries.map(e => `
          <div class="entry-card">
            <div class="entry-info">
              <h4>${esc(e.name)}</h4>
              <span class="meta">${e.sets ? e.sets + ' × ' : ''}${e.reps ? e.reps + ' reps' : ''}${e.notes ? ' · ' + esc(e.notes) : ''}</span>
            </div>
            <span class="entry-weight">${e.weight}<span class="unit-label"> ${e.unit}</span></span>
          </div>`).join('')}
      </div>`).join('');
  }
  historySearch.addEventListener('input', loadHistory);

  // ─────────────────────────────────
  //  Charts Tab
  // ─────────────────────────────────
  async function loadChartExercises() {
    const names = await ExerciseDB.getNames();
    chartSelect.innerHTML = '<option value="">— choose —</option>';
    names.forEach(n => {
      const o = document.createElement('option');
      o.value = o.textContent = n;
      chartSelect.appendChild(o);
    });
  }
  chartSelect.addEventListener('change', async () => {
    const name = chartSelect.value;
    if (!name) { chartCanvas.getContext('2d').clearRect(0,0,chartCanvas.width,chartCanvas.height); chartStatsDiv.innerHTML=''; return; }
    const data  = await ExerciseDB.getByName(name);
    ExerciseChart.draw(chartCanvas, data);
    const stats = ExerciseChart.calcStats(data);
    if (stats) {
      chartStatsDiv.innerHTML = `
        <div class="stat-card"><div class="stat-value">${stats.max}</div><div class="stat-label">Max</div></div>
        <div class="stat-card"><div class="stat-value">${stats.latest}</div><div class="stat-label">Latest</div></div>
        <div class="stat-card"><div class="stat-value">${stats.change}</div><div class="stat-label">Change</div></div>`;
    }
  });
  let _rt;
  window.addEventListener('resize', () => {
    clearTimeout(_rt);
    _rt = setTimeout(() => { if (chartSelect.value) chartSelect.dispatchEvent(new Event('change')); }, 200);
  });

  // ─────────────────────────────────
  //  Sync
  // ─────────────────────────────────
  async function attemptSync() {
    if (!navigator.onLine) return;
    updateSyncBadge('syncing');
    try {
      const r = await ExerciseDB.sync();
      if (r.synced > 0) toast(`Synced ${r.synced} entries`, 'success');
    } catch(e) { console.warn('Sync error:', e); }
    updateSyncBadge();
  }
  function updateSyncBadge(state) {
    const lbl = syncStatus.querySelector('.label');
    syncStatus.classList.remove('offline','syncing');
    if (state === 'syncing')    { syncStatus.classList.add('syncing'); lbl.textContent = 'Syncing'; }
    else if (!navigator.onLine) { syncStatus.classList.add('offline'); lbl.textContent = 'Offline'; }
    else                        { lbl.textContent = 'Online'; }
  }
  window.addEventListener('online',  () => { updateSyncBadge(); attemptSync(); });
  window.addEventListener('offline', () => updateSyncBadge());
  setInterval(() => { if (navigator.onLine) attemptSync(); }, 60000);

  // ─────────────────────────────────
  //  Utils
  // ─────────────────────────────────
  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  function toast(msg, type = 'info') {
    toastEl.textContent = msg;
    toastEl.className   = 'toast ' + type;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.add('hidden'), 2500);
  }

})();
