/* ===================================================
   CGPA Calculator — Application Logic
   =================================================== */

// ──────────────────────────────────────────────
// Grading Policy
// ──────────────────────────────────────────────
const GRADING_SCALE = [
  { min: 86, max: 100, letter: 'A',  points: 4.00 },
  { min: 82, max: 85,  letter: 'A-', points: 3.67 },
  { min: 78, max: 81,  letter: 'B+', points: 3.33 },
  { min: 74, max: 77,  letter: 'B',  points: 3.00 },
  { min: 70, max: 73,  letter: 'B-', points: 2.67 },
  { min: 66, max: 69,  letter: 'C+', points: 2.33 },
  { min: 62, max: 65,  letter: 'C',  points: 2.00 },
  { min: 58, max: 61,  letter: 'C-', points: 1.67 },
  { min: 54, max: 57,  letter: 'D+', points: 1.33 },
  { min: 50, max: 53,  letter: 'D',  points: 1.00 },
  { min: 0,  max: 49,  letter: 'F',  points: 0.00 },
];

function getGradeFromMarks(marks) {
  const m = Math.round(Number(marks));
  if (isNaN(m) || m < 0) return { letter: '—', points: 0, badgeClass: 'na' };
  const clamped = Math.min(m, 100);
  for (const g of GRADING_SCALE) {
    if (clamped >= g.min && clamped <= g.max) {
      return { letter: g.letter, points: g.points, badgeClass: getBadgeClass(g.letter) };
    }
  }
  return { letter: '—', points: 0, badgeClass: 'na' };
}

function getGradeFromLetter(letter) {
  const entry = GRADING_SCALE.find(g => g.letter === letter);
  return entry
    ? { letter: entry.letter, points: entry.points, badgeClass: getBadgeClass(entry.letter) }
    : { letter: '—', points: 0, badgeClass: 'na' };
}

function getBadgeClass(letter) {
  if (letter.startsWith('A')) return 'a';
  if (letter.startsWith('B')) return 'b';
  if (letter.startsWith('C')) return 'c';
  if (letter.startsWith('D')) return 'd';
  if (letter === 'F') return 'f';
  return 'na';
}

// ──────────────────────────────────────────────
// State Management
// ──────────────────────────────────────────────
const STORAGE_KEY = 'cgpa_calculator_data';
const SETTINGS_KEY = 'cgpa_calculator_settings';

let state = {
  semesters: [],
};

let settings = {
  gradingMode: 'marks', // 'marks' | 'manual'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createCourse() {
  return {
    id: generateId(),
    name: '',
    code: '',
    credits: 3,
    marks: '',
    manualGrade: 'A',
  };
}

function createSemester(index) {
  return {
    id: generateId(),
    name: `Semester ${index}`,
    courses: [createCourse()],
    open: true,
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* quota exceeded — silently fail */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) settings = JSON.parse(rawSettings);
  } catch (e) { /* corrupted — use defaults */ }
}

// ──────────────────────────────────────────────
// Computation Helpers
// ──────────────────────────────────────────────
function computeCourse(course) {
  let grade;
  if (settings.gradingMode === 'marks') {
    grade = getGradeFromMarks(course.marks);
  } else {
    grade = getGradeFromLetter(course.manualGrade);
  }
  const credits = Number(course.credits) || 0;
  const qualityPoints = credits * grade.points;
  return { ...grade, qualityPoints, credits };
}

function computeSemester(semester) {
  let totalQP = 0, totalCr = 0, courseCount = 0;
  for (const c of semester.courses) {
    const comp = computeCourse(c);
    const cr = comp.credits;
    if (cr > 0) {
      totalQP += comp.qualityPoints;
      totalCr += cr;
      courseCount++;
    }
  }
  const gpa = totalCr > 0 ? totalQP / totalCr : 0;
  return { gpa, totalQP, totalCr, courseCount };
}

function computeOverall() {
  let totalQP = 0, totalCr = 0, totalCourses = 0;
  for (const sem of state.semesters) {
    const comp = computeSemester(sem);
    totalQP += comp.totalQP;
    totalCr += comp.totalCr;
    totalCourses += comp.courseCount;
  }
  const cgpa = totalCr > 0 ? totalQP / totalCr : 0;
  return { cgpa, totalQP, totalCr, totalCourses };
}

// ──────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast toast--${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ──────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────
function render() {
  renderDashboard();
  renderSemesters();
  saveState();
}

// Lightweight update — patches only computed cells without rebuilding DOM
function updateComputedValues() {
  // Update each course's computed cells in-place
  for (const sem of state.semesters) {
    const semComp = computeSemester(sem);

    for (const c of sem.courses) {
      const comp = computeCourse(c);

      // Update grade badge
      const badge = document.getElementById(`badge-${sem.id}-${c.id}`);
      if (badge) {
        badge.textContent = comp.letter;
        badge.className = `grade-badge grade-badge--${comp.badgeClass}`;
      }

      // Update grade points cell
      const gpCell = document.getElementById(`gp-${sem.id}-${c.id}`);
      if (gpCell) gpCell.textContent = comp.points.toFixed(2);

      // Update quality points cell
      const qpCell = document.getElementById(`qp-${sem.id}-${c.id}`);
      if (qpCell) qpCell.textContent = comp.qualityPoints.toFixed(2);
    }

    // Update semester header stats
    const semGPA = document.getElementById(`sem-gpa-${sem.id}`);
    const semCr  = document.getElementById(`sem-cr-${sem.id}`);
    const semCnt = document.getElementById(`sem-cnt-${sem.id}`);
    if (semGPA) semGPA.textContent = semComp.gpa.toFixed(2);
    if (semCr)  semCr.textContent = semComp.totalCr;
    if (semCnt) semCnt.textContent = sem.courses.length;
  }

  renderDashboard();
  saveState();
}

function renderDashboard() {
  const overall = computeOverall();
  animateValue('dash-cgpa', overall.cgpa.toFixed(2));
  // Show the latest semester GPA
  let latestGPA = '0.00';
  if (state.semesters.length > 0) {
    const last = state.semesters[state.semesters.length - 1];
    latestGPA = computeSemester(last).gpa.toFixed(2);
  }
  animateValue('dash-gpa', latestGPA);
  document.getElementById('dash-credits').textContent = overall.totalCr;
  document.getElementById('dash-courses').textContent = overall.totalCourses;
  // Sub-text
  document.getElementById('dash-cgpa-sub').textContent = overall.totalCr > 0
    ? `${overall.totalQP.toFixed(1)} quality pts / ${overall.totalCr} credits`
    : 'Add courses to begin';
  document.getElementById('dash-gpa-sub').textContent = state.semesters.length > 0
    ? `${state.semesters[state.semesters.length - 1].name}`
    : 'No semesters yet';
}

function animateValue(elementId, newVal) {
  const el = document.getElementById(elementId);
  if (el.textContent !== newVal) {
    el.textContent = newVal;
    el.style.transform = 'scale(1.12)';
    setTimeout(() => el.style.transform = 'scale(1)', 250);
  }
}

function renderSemesters() {
  const container = document.getElementById('semesters-list');

  if (state.semesters.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📚</div>
        <div class="empty-state__title">No semesters yet</div>
        <div class="empty-state__desc">Click "Add Semester" to start tracking your grades.</div>
      </div>`;
    return;
  }

  container.innerHTML = state.semesters.map((sem, si) => {
    const comp = computeSemester(sem);
    return `
    <div class="semester-block ${sem.open ? 'open' : ''}" data-sid="${sem.id}">
      <div class="semester-header" onclick="toggleSemester('${sem.id}')">
        <div class="semester-header__left">
          <span class="semester-header__chevron">▶</span>
          <div class="semester-header__name">
            <input type="text" value="${escHtml(sem.name)}" 
                   onclick="event.stopPropagation()" 
                   oninput="renameSemester('${sem.id}', this.value)"
                   aria-label="Semester name" />
          </div>
        </div>
        <div class="semester-header__stats">
          <div class="semester-stat">
            <div class="semester-stat__value" id="sem-gpa-${sem.id}">${comp.gpa.toFixed(2)}</div>
            <div class="semester-stat__label">GPA</div>
          </div>
          <div class="semester-stat">
            <div class="semester-stat__value" id="sem-cr-${sem.id}">${comp.totalCr}</div>
            <div class="semester-stat__label">Credits</div>
          </div>
          <div class="semester-stat">
            <div class="semester-stat__value" id="sem-cnt-${sem.id}">${sem.courses.length}</div>
            <div class="semester-stat__label">Courses</div>
          </div>
        </div>
        <div class="semester-header__actions">
          <button class="btn btn--danger btn--sm" onclick="event.stopPropagation(); removeSemester('${sem.id}')" title="Delete semester">✕</button>
        </div>
      </div>
      <div class="semester-body">
        <div class="semester-body__inner">
          ${renderCourseTable(sem)}
          <div class="add-course-row">
            <button class="btn btn--ghost btn--sm" onclick="addCourse('${sem.id}')">＋ Add Course</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderCourseTable(sem) {
  const isMarks = settings.gradingMode === 'marks';

  const headerMarks = isMarks ? `<th>Marks</th>` : '';
  const headerGrade = `<th>Grade</th>`;

  const rows = sem.courses.map((c, ci) => {
    const comp = computeCourse(c);
    const gradeCell = isMarks
      ? `<td data-label="Grade"><span class="grade-badge grade-badge--${comp.badgeClass}" id="badge-${sem.id}-${c.id}">${comp.letter}</span></td>`
      : `<td data-label="Grade">
          <select id="input-${sem.id}-${c.id}-grade" onchange="setCourseField('${sem.id}','${c.id}','manualGrade',this.value)">
            ${GRADING_SCALE.map(g => `<option value="${g.letter}" ${c.manualGrade === g.letter ? 'selected' : ''}>${g.letter}</option>`).join('')}
          </select>
        </td>`;

    const marksCell = isMarks
      ? `<td data-label="Marks">
          <input type="number" id="input-${sem.id}-${c.id}-marks" min="0" max="100" value="${c.marks}" placeholder="0–100"
                 oninput="setCourseField('${sem.id}','${c.id}','marks',this.value)" />
        </td>`
      : '';

    return `
    <tr>
      <td data-label="Course Name">
        <input type="text" class="input--name" id="input-${sem.id}-${c.id}-name" value="${escHtml(c.name)}" placeholder="Course Name"
               oninput="setCourseField('${sem.id}','${c.id}','name',this.value)" />
      </td>
      <td data-label="Credits">
        <input type="number" id="input-${sem.id}-${c.id}-credits" min="1" max="6" value="${c.credits}"
               oninput="setCourseField('${sem.id}','${c.id}','credits',this.value)" />
      </td>
      ${marksCell}
      ${gradeCell}
      <td class="cell-computed" data-label="Grade Pts" id="gp-${sem.id}-${c.id}">${comp.points.toFixed(2)}</td>
      <td class="cell-computed" data-label="Quality Pts" id="qp-${sem.id}-${c.id}">${comp.qualityPoints.toFixed(2)}</td>
      <td>
        <button class="btn-delete-course" onclick="removeCourse('${sem.id}','${c.id}')" title="Delete course">✕</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="course-table-wrap">
    <table class="course-table">
      <thead>
        <tr>
          <th>Course Name</th>
          <th>Credits</th>
          ${headerMarks}
          ${headerGrade}
          <th>Grade Pts</th>
          <th>Quality Pts</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderSettingsModal() {
  const marksChecked = settings.gradingMode === 'marks' ? 'checked' : '';
  const manualChecked = settings.gradingMode === 'manual' ? 'checked' : '';
  const marksSelected = settings.gradingMode === 'marks' ? 'selected' : '';
  const manualSelected = settings.gradingMode === 'manual' ? 'selected' : '';

  document.getElementById('settings-content').innerHTML = `
    <div class="setting-group">
      <div class="setting-group__label">Grading Mode</div>
      <div class="radio-group">
        <label class="radio-option ${marksSelected}" onclick="setGradingMode('marks')">
          <input type="radio" name="gradingMode" value="marks" ${marksChecked} />
          <div class="radio-option__text">
            <span class="radio-option__title">Marks Based</span>
            <span class="radio-option__desc">Grade is auto-calculated from obtained marks (default)</span>
          </div>
        </label>
        <label class="radio-option ${manualSelected}" onclick="setGradingMode('manual')">
          <input type="radio" name="gradingMode" value="manual" ${manualChecked} />
          <div class="radio-option__text">
            <span class="radio-option__title">Manual Grade Selection</span>
            <span class="radio-option__desc">Manually choose the letter grade from a dropdown</span>
          </div>
        </label>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-group__label">Grading Policy</div>
      <table class="grading-table">
        <thead>
          <tr><th>Marks (%)</th><th>Grade</th><th>Points</th></tr>
        </thead>
        <tbody>
          ${GRADING_SCALE.map(g => `
            <tr>
              <td>${g.min === 0 ? 'Below 50' : g.min + '–' + g.max}</td>
              <td><span class="grade-badge grade-badge--${getBadgeClass(g.letter)}">${g.letter}</span></td>
              <td>${g.points.toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ──────────────────────────────────────────────
// Event Handlers
// ──────────────────────────────────────────────
function addSemester() {
  const sem = createSemester(state.semesters.length + 1);
  state.semesters.push(sem);
  render();
  showToast(`${sem.name} added`);
}

function removeSemester(id) {
  const sem = state.semesters.find(s => s.id === id);
  if (!sem) return;
  if (sem.courses.some(c => c.name || c.code || c.marks)) {
    if (!confirm(`Delete "${sem.name}" and all its courses?`)) return;
  }
  state.semesters = state.semesters.filter(s => s.id !== id);
  render();
  showToast('Semester removed', 'error');
}

function renameSemester(id, name) {
  const sem = state.semesters.find(s => s.id === id);
  if (sem) { sem.name = name; saveState(); }
  // Update the dashboard subtitle for latest semester
  renderDashboard();
}

function toggleSemester(id) {
  const sem = state.semesters.find(s => s.id === id);
  if (sem) { sem.open = !sem.open; }
  // Only re-render the specific block's class — for performance we re-render all
  renderSemesters();
  saveState();
}

function addCourse(semId) {
  const sem = state.semesters.find(s => s.id === semId);
  if (sem) {
    sem.courses.push(createCourse());
    render();
  }
}

function removeCourse(semId, courseId) {
  const sem = state.semesters.find(s => s.id === semId);
  if (!sem) return;
  if (sem.courses.length <= 1) {
    showToast('Semester must have at least one course', 'error');
    return;
  }
  sem.courses = sem.courses.filter(c => c.id !== courseId);
  render();
}

function setCourseField(semId, courseId, field, value) {
  const sem = state.semesters.find(s => s.id === semId);
  if (!sem) return;
  const course = sem.courses.find(c => c.id === courseId);
  if (!course) return;

  // Validation
  if (field === 'marks') {
    let v = Number(value);
    if (value === '') { course.marks = ''; }
    else {
      if (v < 0) v = 0;
      if (v > 100) v = 100;
      course.marks = v;
    }
  } else if (field === 'credits') {
    let v = Number(value);
    if (v < 1) v = 1;
    if (v > 6) v = 6;
    course.credits = v;
  } else {
    course[field] = value;
  }

  // Lightweight update — no DOM rebuild, keeps focus
  updateComputedValues();
}

function setGradingMode(mode) {
  settings.gradingMode = mode;
  render();
  showToast(`Grading mode: ${mode === 'marks' ? 'Marks Based' : 'Manual Selection'}`);
}

// Settings Modal
function openSettings() {
  document.getElementById('modal-overlay').classList.add('active');
  renderSettingsModal();
}

function closeSettings() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeSettings();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettings();
});

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  render();
});
