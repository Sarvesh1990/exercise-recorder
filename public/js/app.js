/**
 * Main application logic.
 * Handles form interaction, voice input, tabs, sync, and rendering.
 */
(async () => {
  // --- Elements ---
  const form = document.getElementById('exercise-form');
  const nameInput = document.getElementById('exercise-name');
  const weightInput = document.getElementById('weight');
  const setsInput = document.getElementById('sets');
  const repsInput = document.getElementById('reps');
  const unitSelect = document.getElementById('unit');
  const notesInput = document.getElementById('notes');
  const voiceBtn = document.getElementById('voice-btn');
  const suggestions = document.getElementById('exercise-suggestions');
  const recentDiv = document.getElementById('recent-entries');
  const historyList = document.getElementById('history-list');
  const historySearch = document.getElementById('history-search');
  const chartSelect = document.getElementById('chart-exercise');
  const chartCanvas = document.getElementById('progression-chart');
  const chartStatsDiv = document.getElementById('chart-stats');
  const syncStatus = document.getElementById('sync-status');
  const toastEl = document.getElementById('toast');

  // --- Init ---
  await ExerciseDB.open();
  loadSuggestions();
  renderRecent();
  updateSyncBadge();
  attemptSync();

  // --- Tabs ---
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

      if (tab.dataset.tab === 'history') loadHistory();
      if (tab.dataset.tab === 'charts') loadChartExercises();
    });
  });

  // --- Form Submit ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entry = {
      name: nameInput.value.trim(),
      weight: weightInput.value,
      sets: setsInput.value,
      reps: repsInput.value,
      unit: unitSelect.value,
      notes: notesInput.value.trim()
    };

    if (!entry.name || !entry.weight) return;

    await ExerciseDB.add(entry);
    toast('Exercise saved! 💪', 'success');

    nameInput.value = '';
    weightInput.value = '';
    setsInput.value = '';
    repsInput.value = '';
    notesInput.value = '';
    nameInput.focus();

    loadSuggestions();
    renderRecent();
    attemptSync();
  });

  // --- Voice Input (Web Speech API) ---
  let recognition = null;
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const parsed = parseVoiceInput(transcript);
      if (parsed.name) nameInput.value = parsed.name;
      if (parsed.weight) weightInput.value = parsed.weight;
      if (parsed.unit) unitSelect.value = parsed.unit;
      if (parsed.reps) repsInput.value = parsed.reps;
      if (parsed.sets) setsInput.value = parsed.sets;
      voiceBtn.classList.remove('listening');
      toast(`Heard: "${transcript}"`, 'info');
    };

    recognition.onerror = () => {
      voiceBtn.classList.remove('listening');
      toast('Voice recognition failed. Try again.', 'error');
    };

    recognition.onend = () => voiceBtn.classList.remove('listening');
  } else {
    voiceBtn.style.display = 'none';
  }

  voiceBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (voiceBtn.classList.contains('listening')) {
      recognition.stop();
    } else {
      recognition.start();
      voiceBtn.classList.add('listening');
    }
  });

  function parseVoiceInput(text) {
    const result = {};
    const lower = text.toLowerCase().trim();

    // Extract weight + unit: "80 kg", "135 lbs", "100 pounds"
    const weightMatch = lower.match(/(\d+\.?\d*)\s*(kg|kgs|kilograms?|lbs?|pounds?)/);
    if (weightMatch) {
      result.weight = parseFloat(weightMatch[1]);
      result.unit = weightMatch[2].startsWith('lb') || weightMatch[2].startsWith('pound') ? 'lbs' : 'kg';
    }

    // Extract reps: "10 reps"
    const repMatch = lower.match(/(\d+)\s*reps?/);
    if (repMatch) result.reps = parseInt(repMatch[1]);

    // Extract sets: "3 sets"
    const setMatch = lower.match(/(\d+)\s*sets?/);
    if (setMatch) result.sets = parseInt(setMatch[1]);

    // Exercise name: everything remaining after removing matched fragments
    let name = lower;
    if (weightMatch) name = name.replace(weightMatch[0], '');
    if (repMatch) name = name.replace(repMatch[0], '');
    if (setMatch) name = name.replace(setMatch[0], '');
    name = name.replace(/\b(for|at|with|of|and|times?|x)\b/g, '').trim();
    name = name.replace(/\s+/g, ' ').trim();
    if (name) result.name = name;

    // Bare number fallback
    if (!result.weight) {
      const bareNum = lower.match(/(\d+\.?\d*)/);
      if (bareNum) result.weight = parseFloat(bareNum[1]);
    }

    return result;
  }

  // --- Autocomplete Suggestions ---
  async function loadSuggestions() {
    const names = await ExerciseDB.getNames();
    suggestions.innerHTML = '';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      suggestions.appendChild(opt);
    });
  }

  // --- Recent Entries ---
  async function renderRecent() {
    const all = await ExerciseDB.getAll();
    const recent = all.slice(0, 10);

    if (recent.length === 0) {
      recentDiv.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🏋️</div>
          <p>No exercises recorded yet.<br>Add your first one above!</p>
        </div>`;
      return;
    }

    recentDiv.innerHTML = recent.map(e => `
      <div class="entry-card" data-id="${e.id}">
        <div class="entry-info">
          <h4>${esc(e.name)}</h4>
          <span class="meta">
            ${e.sets ? e.sets + ' × ' : ''}${e.reps ? e.reps + ' reps' : ''}
            ${e.notes ? ' · ' + esc(e.notes) : ''}
            <br>${timeAgo(e.created_at)}
            ${e.synced ? '' : ' · <em>pending sync</em>'}
          </span>
        </div>
        <div class="entry-actions">
          <span class="entry-weight">${e.weight}<span class="unit-label"> ${e.unit}</span></span>
          <button class="delete-btn" data-id="${e.id}">✕ Delete</button>
        </div>
      </div>
    `).join('');

    recentDiv.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await ExerciseDB.remove(btn.dataset.id);
        toast('Entry deleted', 'info');
        renderRecent();
        loadSuggestions();
      });
    });
  }

  // --- History Tab ---
  async function loadHistory() {
    const all = await ExerciseDB.getAll();
    const search = historySearch.value.toLowerCase();
    const filtered = search ? all.filter(e => e.name.includes(search)) : all;

    if (filtered.length === 0) {
      historyList.innerHTML = `<div class="empty-state"><div class="emoji">📋</div><p>No entries found.</p></div>`;
      return;
    }

    const groups = {};
    filtered.forEach(e => {
      const day = new Date(e.created_at).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      });
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    });

    historyList.innerHTML = Object.entries(groups).map(([day, entries]) => `
      <div class="date-group">
        <div class="date-label">${day}</div>
        ${entries.map(e => `
          <div class="entry-card">
            <div class="entry-info">
              <h4>${esc(e.name)}</h4>
              <span class="meta">
                ${e.sets ? e.sets + ' × ' : ''}${e.reps ? e.reps + ' reps' : ''}
                ${e.notes ? ' · ' + esc(e.notes) : ''}
              </span>
            </div>
            <span class="entry-weight">${e.weight}<span class="unit-label"> ${e.unit}</span></span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  historySearch.addEventListener('input', loadHistory);

  // --- Charts Tab ---
  async function loadChartExercises() {
    const names = await ExerciseDB.getNames();
    chartSelect.innerHTML = '<option value="">-- Choose an exercise --</option>';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      chartSelect.appendChild(opt);
    });
  }

  chartSelect.addEventListener('change', async () => {
    const name = chartSelect.value;
    if (!name) {
      const ctx = chartCanvas.getContext('2d');
      ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
      chartStatsDiv.innerHTML = '';
      return;
    }

    const data = await ExerciseDB.getByName(name);
    ExerciseChart.draw(chartCanvas, data);

    const stats = ExerciseChart.calcStats(data);
    if (stats) {
      chartStatsDiv.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${stats.max}</div>
          <div class="stat-label">Max Weight</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.latest}</div>
          <div class="stat-label">Latest</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.change}</div>
          <div class="stat-label">Progress</div>
        </div>
      `;
    }
  });

  // Redraw chart on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (chartSelect.value) chartSelect.dispatchEvent(new Event('change'));
    }, 200);
  });

  // --- Online/Offline Sync ---
  async function attemptSync() {
    if (!navigator.onLine) return;
    updateSyncBadge('syncing');
    try {
      const result = await ExerciseDB.sync();
      if (result.synced > 0) {
        toast(`Synced ${result.synced} entries to server`, 'success');
        renderRecent();
      }
    } catch (e) {
      console.warn('Sync error:', e);
    }
    updateSyncBadge();
  }

  function updateSyncBadge(state) {
    const label = syncStatus.querySelector('.label');
    syncStatus.classList.remove('offline', 'syncing');

    if (state === 'syncing') {
      syncStatus.classList.add('syncing');
      label.textContent = 'Syncing...';
    } else if (!navigator.onLine) {
      syncStatus.classList.add('offline');
      label.textContent = 'Offline';
    } else {
      label.textContent = 'Online';
    }
  }

  window.addEventListener('online', () => {
    updateSyncBadge();
    toast('Back online! Syncing...', 'info');
    attemptSync();
  });

  window.addEventListener('offline', () => {
    updateSyncBadge();
    toast("You're offline. Data saved locally.", 'info');
  });

  // Periodic sync every 60s
  setInterval(() => {
    if (navigator.onLine) attemptSync();
  }, 60000);

  // --- Utilities ---
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function timeAgo(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toast(msg, type = 'info') {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + type;
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.add('hidden'), 2500);
  }
})();
