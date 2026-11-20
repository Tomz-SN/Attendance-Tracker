/**
 * Attendance Tracker — Main Interactive Client Application
 * Credits: Tom Sanson | GitHub: Tomz-SN
 * Built with HTML, CSS, JavaScript, Python, Flask
 */

// Global State
const state = {
  user: null,
  subjects: [],
  attendanceRecords: [],
  stats: null,
  activeTab: 'tab-subjects',
  sliderTarget: 75.0,
  charts: {
    subjectBars: null,
    doughnut: null,
    dow: null,
    timeline: null
  }
};

// DOM References
const DOM = {
  // Navigation & Auth Views
  userNavBar: document.getElementById('user-nav-bar'),
  guestNavBar: document.getElementById('guest-nav-bar'),
  authHeroView: document.getElementById('auth-hero-view'),
  appMainHub: document.getElementById('app-main-hub'),
  navUserName: document.getElementById('nav-user-name'),
  navTargetBadge: document.getElementById('nav-target-badge'),

  // Buttons
  btnNavLogin: document.getElementById('btn-nav-login'),
  btnNavRegister: document.getElementById('btn-nav-register'),
  btnHeroLogin: document.getElementById('btn-hero-login'),
  btnHeroRegister: document.getElementById('btn-hero-register'),
  btnLogout: document.getElementById('btn-logout'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnAddSubjectModal: document.getElementById('btn-add-subject-modal'),
  btnEmptyAddSubject: document.getElementById('btn-empty-add-subject'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnPrintReport: document.getElementById('btn-print-report'),

  // HUD
  hudOverallPct: document.getElementById('hud-overall-pct'),
  hudTargetSub: document.getElementById('hud-target-sub'),
  hudHoursRatio: document.getElementById('hud-hours-ratio'),
  hudMissedSub: document.getElementById('hud-missed-sub'),
  hudBunkVal: document.getElementById('hud-bunk-val'),
  hudBunkSub: document.getElementById('hud-bunk-sub'),
  hudBunkIcon: document.getElementById('hud-bunk-icon'),
  hudOrbitRank: document.getElementById('hud-orbit-rank'),
  hudSubjectsCount: document.getElementById('hud-subjects-count'),

  // Subjects View
  subjectsContainer: document.getElementById('subjects-container'),
  subjectsEmptyState: document.getElementById('subjects-empty-state'),

  // Manual Log Form
  formLogAttendance: document.getElementById('form-log-attendance'),
  logSubjectSelect: document.getElementById('log-subject-select'),
  logDateInput: document.getElementById('log-date-input'),
  logStatusSelect: document.getElementById('log-status-select'),
  logHoursConducted: document.getElementById('log-hours-conducted'),
  logHoursAttended: document.getElementById('log-hours-attended'),
  logNotesInput: document.getElementById('log-notes-input'),

  // Bunk Calculator View
  calcTargetSlider: document.getElementById('calc-target-slider'),
  calcSliderVal: document.getElementById('calc-slider-val'),
  calcOverallBanner: document.getElementById('calc-overall-banner'),
  calcBannerIcon: document.getElementById('calc-banner-icon'),
  calcBannerTitle: document.getElementById('calc-banner-title'),
  calcBannerDesc: document.getElementById('calc-banner-desc'),
  calcBreakdownTbody: document.getElementById('calc-breakdown-tbody'),
  simFutureAttend: document.getElementById('sim-future-attend'),
  simFutureMiss: document.getElementById('sim-future-miss'),
  btnRunSimulation: document.getElementById('btn-run-simulation'),
  simProjectedPct: document.getElementById('sim-projected-pct'),

  // History View
  historyFilterSubject: document.getElementById('history-filter-subject'),
  historyFilterStatus: document.getElementById('history-filter-status'),
  historyTableTbody: document.getElementById('history-table-tbody'),

  // Modals
  modalAuth: document.getElementById('modal-auth'),
  formAuth: document.getElementById('form-auth'),
  authTabLogin: document.getElementById('auth-tab-login'),
  authTabRegister: document.getElementById('auth-tab-register'),
  authModalTitle: document.getElementById('auth-modal-title'),
  groupFullname: document.getElementById('group-fullname'),
  groupTargetPct: document.getElementById('group-target-pct'),
  btnSubmitAuth: document.getElementById('btn-submit-auth'),

  modalSubject: document.getElementById('modal-subject'),
  formSubject: document.getElementById('form-subject'),
  subjectModalTitle: document.getElementById('subject-modal-title'),
  subjectEditId: document.getElementById('subject-edit-id'),
  subjectNameInput: document.getElementById('subject-name-input'),
  subjectCodeInput: document.getElementById('subject-code-input'),
  subjectTargetInput: document.getElementById('subject-target-input'),
  subjectColorInput: document.getElementById('subject-color-input'),
  subjectColorPresets: document.getElementById('subject-color-presets'),

  modalSettings: document.getElementById('modal-settings'),
  formSettings: document.getElementById('form-settings'),
  settingsFullname: document.getElementById('settings-fullname'),
  settingsTarget: document.getElementById('settings-target'),
  settingsNewPassword: document.getElementById('settings-new-password'),

  toastContainer: document.getElementById('toast-container')
};

// ================= Utility Functions =================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(modalEl) {
  if (modalEl) modalEl.classList.add('open');
}

function closeModal(modalEl) {
  if (modalEl) modalEl.classList.remove('open');
}

// Setup universal close buttons for modals
document.querySelectorAll('.close-modal-btn, [data-close]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetId = btn.getAttribute('data-close');
    if (targetId) {
      closeModal(document.getElementById(targetId));
    } else {
      const modal = btn.closest('.modal-overlay');
      if (modal) closeModal(modal);
    }
  });
});

// Close modal when clicking on overlay background
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// Format ISO date (YYYY-MM-DD)
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ================= Authentication & Initialization =================

async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      handleUserLoggedIn(data.user);
    } else {
      handleUserLoggedOut();
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    handleUserLoggedOut();
  }
}

function handleUserLoggedIn(user) {
  state.user = user;
  state.sliderTarget = user.desired_percentage || 75.0;

  DOM.userNavBar.style.display = 'flex';
  DOM.guestNavBar.style.display = 'none';
  DOM.authHeroView.style.display = 'none';
  DOM.appMainHub.style.display = 'block';

  DOM.navUserName.textContent = user.full_name || user.username;
  DOM.navTargetBadge.textContent = `Aim: ${user.desired_percentage}%`;
  DOM.calcTargetSlider.value = user.desired_percentage;
  DOM.calcSliderVal.textContent = `${user.desired_percentage}%`;

  // Set default date in manual logger
  DOM.logDateInput.value = getTodayDateString();

  // Load all user data
  loadAllData();
}

function handleUserLoggedOut() {
  state.user = null;
  DOM.userNavBar.style.display = 'none';
  DOM.guestNavBar.style.display = 'flex';
  DOM.authHeroView.style.display = 'block';
  DOM.appMainHub.style.display = 'none';
  destroyAllCharts();
}

async function loadAllData() {
  await Promise.all([
    fetchSubjects(),
    fetchAttendanceHistory(),
    fetchStatistics()
  ]);
  populateSubjectDropdowns();
  updateSimulationResult();
}

// ================= Tab Navigation =================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    switchTab(targetTab);
  });
});

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === tabId);
  });

  // Re-render charts if switching to statistics tab to ensure proper canvas sizing
  if (tabId === 'tab-statistics' && state.stats) {
    setTimeout(renderAllCharts, 100);
  }
}

// ================= Subjects & Quick Log =================

async function fetchSubjects() {
  try {
    const res = await fetch('/api/subjects');
    const data = await res.json();
    state.subjects = data.subjects || [];
    renderSubjectsGrid();
  } catch (err) {
    console.error("Failed to load subjects:", err);
  }
}

function renderSubjectsGrid() {
  const container = DOM.subjectsContainer;
  container.innerHTML = '';

  if (state.subjects.length === 0) {
    DOM.subjectsEmptyState.style.display = 'block';
    DOM.hudSubjectsCount.textContent = '0 Subjects Registered';
    return;
  }

  DOM.subjectsEmptyState.style.display = 'none';
  DOM.hudSubjectsCount.textContent = `${state.subjects.length} Subject${state.subjects.length > 1 ? 's' : ''} in Orbit`;

  state.subjects.forEach(subject => {
    const card = document.createElement('div');
    card.className = 'subject-card';

    // SVG radial meter calculation
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(100, Math.max(0, subject.percentage));
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    let meterColor = '#10b981'; // Green
    if (pct < subject.target_percentage - 10) {
      meterColor = '#ef4444'; // Red
    } else if (pct < subject.target_percentage) {
      meterColor = '#f59e0b'; // Amber
    }

    // Bunk badge
    const bunk = subject.bunk_status;
    let badgeClass = 'neutral';
    let badgeIcon = '🛸';
    if (bunk.status === 'safe') {
      badgeClass = 'safe';
      badgeIcon = '🚀';
    } else if (bunk.status === 'warning') {
      badgeClass = 'warning';
      badgeIcon = '⚠️';
    }

    card.innerHTML = `
      <div class="subject-color-strip" style="background: ${subject.color};"></div>
      
      <div class="subject-header">
        <div class="subject-title-area">
          ${subject.code ? `<span class="subject-code-tag">${escapeHtml(subject.code)}</span>` : ''}
          <h3 class="subject-name">${escapeHtml(subject.name)}</h3>
        </div>
        <div class="subject-actions-menu">
          <button class="icon-btn edit-subject-btn" title="Edit Subject" data-id="${subject.id}">
            ✏️
          </button>
          <button class="icon-btn delete delete-subject-btn" title="Delete Subject" data-id="${subject.id}" data-name="${escapeHtml(subject.name)}">
            🗑️
          </button>
        </div>
      </div>

      <div class="subject-meter-wrap">
        <div class="radial-progress-box">
          <svg class="radial-progress-svg" viewBox="0 0 72 72">
            <circle class="radial-bg" cx="36" cy="36" r="${radius}"></circle>
            <circle class="radial-meter" cx="36" cy="36" r="${radius}" 
                    stroke="${meterColor}" 
                    stroke-dasharray="${circumference}" 
                    stroke-dashoffset="${strokeDashoffset}"></circle>
          </svg>
          <div class="radial-label" style="color: ${meterColor};">${subject.percentage}%</div>
        </div>

        <div class="subject-hours-meta">
          <div class="hours-conducted-text">
            <span>${subject.total_attended}</span> / ${subject.total_conducted} Hours Attended
          </div>
          <div class="target-aim-text">
            Target Goal: ${subject.target_percentage}%
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            ${subject.total_missed} hours missed
          </div>
        </div>
      </div>

      <div class="bunk-badge ${badgeClass}">
        <span>${badgeIcon}</span>
        <span>${bunk.message}</span>
      </div>

      <div class="quick-log-actions">
        <button class="cosmic-btn btn-present btn-sm quick-log-btn" data-id="${subject.id}" data-action="present">
          +1 Attended
        </button>
        <button class="cosmic-btn btn-absent btn-sm quick-log-btn" data-id="${subject.id}" data-action="absent">
          +1 Missed
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach event listeners to card buttons
  container.querySelectorAll('.quick-log-btn').forEach(btn => {
    btn.addEventListener('click', handleQuickLog);
  });

  container.querySelectorAll('.edit-subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subjectId = parseInt(btn.getAttribute('data-id'));
      openEditSubjectModal(subjectId);
    });
  });

  container.querySelectorAll('.delete-subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subjectId = parseInt(btn.getAttribute('data-id'));
      const subjectName = btn.getAttribute('data-name');
      confirmDeleteSubject(subjectId, subjectName);
    });
  });
}

async function handleQuickLog(e) {
  const btn = e.currentTarget;
  const subjectId = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');

  btn.disabled = true;
  try {
    const res = await fetch('/api/attendance/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: subjectId, action: action })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      await Promise.all([
        fetchSubjects(),
        fetchAttendanceHistory(),
        fetchStatistics()
      ]);
    } else {
      showToast(data.message || 'Quick log failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to orbit', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ================= Add & Edit Subject Modal =================

function openAddSubjectModal() {
  DOM.subjectModalTitle.textContent = '✨ Add New Subject';
  DOM.subjectEditId.value = '';
  DOM.subjectNameInput.value = '';
  DOM.subjectCodeInput.value = '';
  DOM.subjectTargetInput.value = state.user ? state.user.desired_percentage : 75;
  setSelectedColor('#8b5cf6');
  openModal(DOM.modalSubject);
  DOM.subjectNameInput.focus();
}

function openEditSubjectModal(subjectId) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  DOM.subjectModalTitle.textContent = '✏️ Edit Subject';
  DOM.subjectEditId.value = subject.id;
  DOM.subjectNameInput.value = subject.name;
  DOM.subjectCodeInput.value = subject.code;
  DOM.subjectTargetInput.value = subject.target_percentage;
  setSelectedColor(subject.color || '#8b5cf6');
  openModal(DOM.modalSubject);
  DOM.subjectNameInput.focus();
}

function setSelectedColor(color) {
  DOM.subjectColorInput.value = color;
  DOM.subjectColorPresets.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.classList.toggle('selected', swatch.getAttribute('data-color') === color);
  });
}

DOM.subjectColorPresets.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    setSelectedColor(swatch.getAttribute('data-color'));
  });
});

DOM.formSubject.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = DOM.subjectEditId.value;
  const name = DOM.subjectNameInput.value.trim();
  const code = DOM.subjectCodeInput.value.trim();
  const color = DOM.subjectColorInput.value;
  const target = parseFloat(DOM.subjectTargetInput.value) || 75.0;

  if (!name) {
    showToast('Subject name cannot be empty', 'error');
    return;
  }

  const isEdit = Boolean(id);
  const endpoint = isEdit ? `/api/subjects/${id}` : '/api/subjects';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, color, target_percentage: target })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(isEdit ? 'Subject updated!' : 'Subject added to orbit!', 'success');
      closeModal(DOM.modalSubject);
      await Promise.all([
        fetchSubjects(),
        fetchStatistics()
      ]);
      populateSubjectDropdowns();
    } else {
      showToast(data.message || 'Operation failed', 'error');
    }
  } catch (err) {
    showToast('Network error updating subject', 'error');
  }
});

async function confirmDeleteSubject(subjectId, subjectName) {
  const confirmed = window.confirm(`Are you sure you want to delete "${subjectName}" and remove all its attendance records from your isolated table?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/subjects/${subjectId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast('Subject deleted from orbit', 'success');
      await Promise.all([
        fetchSubjects(),
        fetchAttendanceHistory(),
        fetchStatistics()
      ]);
      populateSubjectDropdowns();
    } else {
      showToast(data.message || 'Delete failed', 'error');
    }
  } catch (err) {
    showToast('Failed to delete subject', 'error');
  }
}

// ================= Manual Hours Logger =================

function populateSubjectDropdowns() {
  const selects = [DOM.logSubjectSelect, DOM.historyFilterSubject];
  selects.forEach(select => {
    if (!select) return;
    const isFilter = select === DOM.historyFilterSubject;
    const currentVal = select.value;
    select.innerHTML = isFilter ? '<option value="">All Subjects</option>' : '';

    state.subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.code ? `[${sub.code}] ${sub.name}` : sub.name;
      select.appendChild(opt);
    });

    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
      select.value = currentVal;
    }
  });
}

// Auto-adjust hours attended when status or hours conducted changes
DOM.logStatusSelect.addEventListener('change', () => {
  const status = DOM.logStatusSelect.value;
  const cond = parseFloat(DOM.logHoursConducted.value) || 1.0;
  if (status === 'absent' || status === 'cancelled') {
    DOM.logHoursAttended.value = '0';
  } else if (status === 'present' || status === 'duty') {
    DOM.logHoursAttended.value = cond.toString();
  }
});

DOM.logHoursConducted.addEventListener('input', () => {
  const status = DOM.logStatusSelect.value;
  const cond = parseFloat(DOM.logHoursConducted.value) || 1.0;
  if (status === 'present') {
    DOM.logHoursAttended.value = cond.toString();
  }
});

DOM.formLogAttendance.addEventListener('submit', async (e) => {
  e.preventDefault();
  const subjectId = DOM.logSubjectSelect.value;
  const dateStr = DOM.logDateInput.value;
  const status = DOM.logStatusSelect.value;
  const conducted = parseFloat(DOM.logHoursConducted.value) || 1.0;
  const attended = parseFloat(DOM.logHoursAttended.value) || 0.0;
  const note = DOM.logNotesInput.value.trim();

  if (!subjectId) {
    showToast('Please select a subject', 'error');
    return;
  }

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject_id: subjectId,
        date: dateStr,
        hours_conducted: conducted,
        hours_attended: attended,
        status: status,
        note: note
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Hours logged successfully!', 'success');
      DOM.logNotesInput.value = '';
      await Promise.all([
        fetchSubjects(),
        fetchAttendanceHistory(),
        fetchStatistics()
      ]);
      // Switch back to subjects tab to show updated numbers
      switchTab('tab-subjects');
    } else {
      showToast(data.message || 'Failed to log hours', 'error');
    }
  } catch (err) {
    showToast('Network error while logging hours', 'error');
  }
});

// ================= Attendance History & Removal =================

async function fetchAttendanceHistory() {
  try {
    const subjectId = DOM.historyFilterSubject ? DOM.historyFilterSubject.value : '';
    let url = '/api/attendance?limit=300';
    if (subjectId) url += `&subject_id=${subjectId}`;

    const res = await fetch(url);
    const data = await res.json();
    state.attendanceRecords = data.records || [];
    renderAttendanceHistory();
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}

function renderAttendanceHistory() {
  const tbody = DOM.historyTableTbody;
  tbody.innerHTML = '';

  const filterStatus = DOM.historyFilterStatus ? DOM.historyFilterStatus.value : '';
  const filterSub = DOM.historyFilterSubject ? DOM.historyFilterSubject.value : '';

  let records = state.attendanceRecords;
  if (filterSub) {
    records = records.filter(r => r.subject_id.toString() === filterSub);
  }
  if (filterStatus) {
    records = records.filter(r => r.status === filterStatus);
  }

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No attendance records found matching filters.
        </td>
      </tr>
    `;
    return;
  }

  records.forEach(rec => {
    const tr = document.createElement('tr');

    let statusBadge = '<span style="color: #6ee7b7;">✅ Present</span>';
    if (rec.status === 'absent') {
      statusBadge = '<span style="color: #fca5a5;">❌ Absent</span>';
    } else if (rec.status === 'duty') {
      statusBadge = '<span style="color: #c4b5fd;">🎖️ Duty/Med</span>';
    } else if (rec.status === 'cancelled') {
      statusBadge = '<span style="color: var(--text-muted);">🚫 Cancelled</span>';
    }

    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${rec.date}</td>
      <td>
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${rec.subject_color || '#8b5cf6'}; margin-right: 6px;"></span>
        <strong>${escapeHtml(rec.subject_name)}</strong> 
        ${rec.subject_code ? `<span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 4px;">(${escapeHtml(rec.subject_code)})</span>` : ''}
      </td>
      <td>${rec.hours_conducted} hr${rec.hours_conducted != 1 ? 's' : ''}</td>
      <td><strong>${rec.hours_attended} hr${rec.hours_attended != 1 ? 's' : ''}</strong></td>
      <td>${statusBadge}</td>
      <td style="color: var(--text-secondary); max-width: 220px; word-break: break-word;">${escapeHtml(rec.note || '—')}</td>
      <td style="text-align: right;">
        <button class="cosmic-btn btn-danger btn-sm remove-log-btn" data-id="${rec.id}">
          🗑️ Remove
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.remove-log-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recId = btn.getAttribute('data-id');
      const confirmed = window.confirm("Remove this hours entry? This will adjust your attendance count immediately.");
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/attendance/${recId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          showToast('Hours removed from your table', 'success');
          await Promise.all([
            fetchSubjects(),
            fetchAttendanceHistory(),
            fetchStatistics()
          ]);
        } else {
          showToast(data.message || 'Failed to remove', 'error');
        }
      } catch (err) {
        showToast('Network error removing record', 'error');
      }
    });
  });
}

DOM.historyFilterSubject.addEventListener('change', renderAttendanceHistory);
DOM.historyFilterStatus.addEventListener('change', renderAttendanceHistory);

// ================= Bunk Calculator & Simulator =================

DOM.calcTargetSlider.addEventListener('input', () => {
  const val = parseFloat(DOM.calcTargetSlider.value);
  state.sliderTarget = val;
  DOM.calcSliderVal.textContent = `${val}%`;
  recalculateBunkWithTarget(val);
});

async function recalculateBunkWithTarget(targetPct) {
  try {
    const res = await fetch(`/api/statistics?target=${targetPct}`);
    const data = await res.json();
    updateBunkCalculatorView(data, targetPct);
  } catch (err) {
    console.error("Recalculation error:", err);
  }
}

function updateBunkCalculatorView(statsData, targetPct) {
  const bunk = statsData.overall_bunk;
  const banner = DOM.calcOverallBanner;
  banner.className = `calc-summary-banner ${bunk.status}`;
  
  DOM.calcBannerIcon.textContent = bunk.status === 'safe' ? '🚀' : bunk.status === 'warning' ? '⚠️' : '🛸';
  DOM.calcBannerTitle.textContent = bunk.status === 'safe' ? 'Safe Orbital Trajectory' : 'Orbital Decay Alert';
  DOM.calcBannerDesc.textContent = bunk.message;

  // Breakdown table
  const tbody = DOM.calcBreakdownTbody;
  tbody.innerHTML = '';

  if (!statsData.subjects || statsData.subjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No subjects registered yet.</td></tr>`;
    return;
  }

  statsData.subjects.forEach(sub => {
    const tr = document.createElement('tr');
    const sBunk = sub.bunk_status;

    let actionText = '';
    let statusPill = '';
    if (sBunk.status === 'safe') {
      actionText = `<span style="color: #6ee7b7; font-weight: 700;">Can miss ${sBunk.can_bunk} class${sBunk.can_bunk !== 1 ? 'es' : ''}</span>`;
      statusPill = `<span class="bunk-badge safe" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">🟢 Safe</span>`;
    } else if (sBunk.status === 'warning') {
      actionText = `<span style="color: #fca5a5; font-weight: 700;">Attend next ${sBunk.need_attend} class${sBunk.need_attend !== 1 ? 'es' : ''}</span>`;
      statusPill = `<span class="bunk-badge warning" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">🔴 Shortage</span>`;
    } else {
      actionText = `<span style="color: var(--text-muted);">No logs yet</span>`;
      statusPill = `<span class="bunk-badge neutral" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">⚪ Neutral</span>`;
    }

    tr.innerHTML = `
      <td>
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${sub.color || '#8b5cf6'}; margin-right: 6px;"></span>
        <strong>${escapeHtml(sub.name)}</strong>
        ${sub.code ? `<span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 4px;">(${escapeHtml(sub.code)})</span>` : ''}
      </td>
      <td>${sub.total_conducted} hrs</td>
      <td>${sub.total_attended} hrs</td>
      <td><strong>${sub.percentage}%</strong></td>
      <td>${sub.target_percentage}%</td>
      <td>${actionText}</td>
      <td>${statusPill}</td>
    `;
    tbody.appendChild(tr);
  });
}

// What-If Simulation
DOM.btnRunSimulation.addEventListener('click', updateSimulationResult);

function updateSimulationResult() {
  if (!state.stats) return;

  const currentAttended = state.stats.total_attended || 0;
  const currentConducted = state.stats.total_conducted || 0;

  const futureAttend = Math.max(0, parseFloat(DOM.simFutureAttend.value) || 0);
  const futureMiss = Math.max(0, parseFloat(DOM.simFutureMiss.value) || 0);

  const newAttended = currentAttended + futureAttend;
  const newConducted = currentConducted + futureAttend + futureMiss;

  if (newConducted === 0) {
    DOM.simProjectedPct.textContent = '100%';
    return;
  }

  const projectedPct = Math.round((newAttended / newConducted) * 1000) / 10;
  DOM.simProjectedPct.textContent = `${projectedPct}%`;

  const target = state.user ? state.user.desired_percentage : 75;
  if (projectedPct >= target) {
    DOM.simProjectedPct.style.color = '#10b981'; // Safe green
  } else {
    DOM.simProjectedPct.style.color = '#ef4444'; // Deficit red
  }
}

// ================= Statistics & Charts =================

async function fetchStatistics() {
  try {
    const res = await fetch(`/api/statistics?target=${state.sliderTarget}`);
    const data = await res.json();
    state.stats = data;
    updateHUD(data);
    updateBunkCalculatorView(data, state.sliderTarget);
    if (state.activeTab === 'tab-statistics') {
      renderAllCharts();
    }
  } catch (err) {
    console.error("Failed to load statistics:", err);
  }
}

function updateHUD(stats) {
  DOM.hudOverallPct.textContent = `${stats.overall_percentage}%`;
  DOM.hudTargetSub.textContent = `Aiming for ${stats.desired_percentage}%`;

  const target = stats.desired_percentage;
  if (stats.overall_percentage >= target) {
    DOM.hudOverallPct.style.color = '#10b981'; // Green
  } else if (stats.overall_percentage >= target - 10) {
    DOM.hudOverallPct.style.color = '#f59e0b'; // Amber
  } else {
    DOM.hudOverallPct.style.color = '#ef4444'; // Red
  }

  DOM.hudHoursRatio.textContent = `${stats.total_attended} / ${stats.total_conducted}`;
  DOM.hudMissedSub.textContent = `${stats.total_missed} hours missed`;

  const bunk = stats.overall_bunk;
  if (bunk.status === 'safe') {
    DOM.hudBunkVal.textContent = `${bunk.can_bunk} hrs`;
    DOM.hudBunkSub.textContent = `Safe to bunk overall`;
    DOM.hudBunkIcon.style.color = '#10b981';
  } else if (bunk.status === 'warning') {
    DOM.hudBunkVal.textContent = `-${bunk.need_attend} hrs`;
    DOM.hudBunkSub.textContent = `Need to attend consecutively`;
    DOM.hudBunkIcon.style.color = '#ef4444';
  } else {
    DOM.hudBunkVal.textContent = `0 hrs`;
    DOM.hudBunkSub.textContent = `No classes logged yet`;
    DOM.hudBunkIcon.style.color = 'var(--text-muted)';
  }

  DOM.hudOrbitRank.textContent = stats.cosmic_badge;
  DOM.hudOrbitRank.style.color = stats.badge_color;
}

function destroyAllCharts() {
  Object.keys(state.charts).forEach(key => {
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
  });
}

function renderAllCharts() {
  if (!state.stats || typeof Chart === 'undefined') return;

  destroyAllCharts();

  const cosmicTextColor = '#536176';
  const cosmicGridColor = 'rgba(41, 54, 74, 0.12)';

  // Chart 1: Subject Bars (Attended vs Conducted)
  const barCanvas = document.getElementById('chart-subject-bars');
  if (barCanvas) {
    const subjects = state.stats.subjects || [];
    const labels = subjects.map(s => s.code || s.name);
    const attendedData = subjects.map(s => s.total_attended);
    const conductedData = subjects.map(s => s.total_conducted);
    const colors = subjects.map(s => s.color || '#8b5cf6');

    state.charts.subjectBars = new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Hours Attended',
            data: attendedData,
            backgroundColor: colors.map(c => c + 'cc'),
            borderColor: colors,
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'Hours Conducted',
            data: conductedData,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: cosmicTextColor, font: { family: 'Inter' } } }
        },
        scales: {
          x: { ticks: { color: cosmicTextColor }, grid: { display: false } },
          y: { ticks: { color: cosmicTextColor }, grid: { color: cosmicGridColor } }
        }
      }
    });
  }

  // Chart 2: Doughnut (Overall Attended vs Missed)
  const doughnutCanvas = document.getElementById('chart-doughnut');
  if (doughnutCanvas) {
    const attended = state.stats.total_attended || 0;
    const missed = state.stats.total_missed || 0;

    state.charts.doughnut = new Chart(doughnutCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Attended Hours', 'Missed Hours'],
        datasets: [{
          data: [attended, missed],
          backgroundColor: ['#10b981', '#ef4444'],
          borderColor: '#0f172a',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: cosmicTextColor, font: { family: 'Inter' } } }
        },
        cutout: '70%'
      }
    });
  }

  // Chart 3: Day of Week Breakdown
  const dowCanvas = document.getElementById('chart-dow');
  if (dowCanvas) {
    const dowData = state.stats.dow_chart_data || [];
    state.charts.dow = new Chart(dowCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: dowData.map(d => d.day),
        datasets: [{
          label: 'Attendance Rate (%)',
          data: dowData.map(d => d.percentage),
          backgroundColor: 'rgba(6, 182, 212, 0.65)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: cosmicTextColor }, grid: { display: false } },
          y: { 
            min: 0, 
            max: 100, 
            ticks: { color: cosmicTextColor, callback: val => `${val}%` }, 
            grid: { color: cosmicGridColor } 
          }
        }
      }
    });
  }

  // Chart 4: Timeline Trend
  const timelineCanvas = document.getElementById('chart-timeline');
  if (timelineCanvas) {
    const timelineData = state.stats.timeline || [];
    state.charts.timeline = new Chart(timelineCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: timelineData.map(t => t.date.slice(5)), // MM-DD
        datasets: [{
          label: 'Cumulative Attendance (%)',
          data: timelineData.map(t => t.cumulative_percentage),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#c4b5fd',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: cosmicTextColor, font: { family: 'Inter' } } }
        },
        scales: {
          x: { ticks: { color: cosmicTextColor }, grid: { display: false } },
          y: { 
            min: 0, 
            max: 100, 
            ticks: { color: cosmicTextColor, callback: val => `${val}%` }, 
            grid: { color: cosmicGridColor } 
          }
        }
      }
    });
  }
}

// Export CSV & Print Report
DOM.btnExportCsv.addEventListener('click', () => {
  window.location.href = '/api/export-csv';
  showToast('Cosmic attendance data exported to CSV!', 'success');
});

DOM.btnPrintReport.addEventListener('click', () => {
  window.print();
});

// ================= Modal Events & Auth Forms =================

// Open Auth Modal
DOM.btnNavLogin.addEventListener('click', () => setAuthMode('login'));
if (DOM.btnNavRegister) DOM.btnNavRegister.addEventListener('click', () => setAuthMode('register'));
DOM.btnHeroLogin.addEventListener('click', () => setAuthMode('login'));
DOM.btnHeroRegister.addEventListener('click', () => setAuthMode('register'));

DOM.authTabLogin.addEventListener('click', () => setAuthMode('login'));
DOM.authTabRegister.addEventListener('click', () => setAuthMode('register'));

function setAuthMode(mode) {
  const isReg = mode === 'register';
  DOM.authTabLogin.classList.toggle('active', !isReg);
  DOM.authTabRegister.classList.toggle('active', isReg);
  DOM.groupFullname.style.display = isReg ? 'flex' : 'none';
  DOM.groupTargetPct.style.display = isReg ? 'flex' : 'none';
  DOM.authModalTitle.textContent = isReg ? '✨ Register Student Account' : '🚀 Student Sign In';
  DOM.btnSubmitAuth.textContent = isReg ? '✨ Create Account' : '🚀 Sign In';
  openModal(DOM.modalAuth);
}

// Handle Auth Form Submission
DOM.formAuth.addEventListener('submit', async (e) => {
  e.preventDefault();
  const isReg = DOM.authTabRegister.classList.contains('active');
  const endpoint = isReg ? '/api/auth/register' : '/api/auth/login';

  const payload = {
    username: document.getElementById('auth-username').value.trim(),
    password: document.getElementById('auth-password').value
  };

  if (isReg) {
    payload.full_name = document.getElementById('auth-fullname').value.trim();
    payload.desired_percentage = parseFloat(document.getElementById('auth-target-pct').value) || 75.0;
  }

  DOM.btnSubmitAuth.disabled = true;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(isReg ? 'Account registered successfully!' : 'Welcome back to orbit!', 'success');
      closeModal(DOM.modalAuth);
      handleUserLoggedIn(data.user);
    } else {
      showToast(data.message || 'Authentication failed', 'error');
    }
  } catch (err) {
    showToast('Network connection failed', 'error');
  } finally {
    DOM.btnSubmitAuth.disabled = false;
  }
});

// Logout
DOM.btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    showToast('Logged out of orbit', 'info');
    handleUserLoggedOut();
  } catch (err) {
    showToast('Failed to log out cleanly', 'error');
  }
});

// Settings Modal
DOM.btnOpenSettings.addEventListener('click', () => {
  if (!state.user) return;
  DOM.settingsFullname.value = state.user.full_name || '';
  DOM.settingsTarget.value = state.user.desired_percentage || 75.0;
  DOM.settingsNewPassword.value = '';
  openModal(DOM.modalSettings);
});

DOM.formSettings.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fullName = DOM.settingsFullname.value.trim();
  const targetPct = parseFloat(DOM.settingsTarget.value) || 75.0;
  const newPassword = DOM.settingsNewPassword.value;

  try {
    const res = await fetch('/api/auth/update-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        desired_percentage: targetPct,
        new_password: newPassword || undefined
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Profile and target percentage updated!', 'success');
      closeModal(DOM.modalSettings);
      state.user = data.user;
      DOM.navUserName.textContent = data.user.full_name;
      DOM.navTargetBadge.textContent = `Aim: ${data.user.desired_percentage}%`;
      state.sliderTarget = data.user.desired_percentage;
      DOM.calcTargetSlider.value = data.user.desired_percentage;
      DOM.calcSliderVal.textContent = `${data.user.desired_percentage}%`;
      await Promise.all([
        fetchSubjects(),
        fetchStatistics()
      ]);
    } else {
      showToast(data.message || 'Settings update failed', 'error');
    }
  } catch (err) {
    showToast('Failed to update settings', 'error');
  }
});

// Add Subject Modal buttons
DOM.btnAddSubjectModal.addEventListener('click', openAddSubjectModal);
DOM.btnEmptyAddSubject.addEventListener('click', openAddSubjectModal);

// Helper for XSS safety
function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
});
