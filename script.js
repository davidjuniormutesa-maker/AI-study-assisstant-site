// ==============================================================
// STUDY DOJO — SYSTEM v3.6
// ==============================================================
// Evidence-based study scheduler with subject rotation.
//   · Mon–Fri: max 2 subjects per day
//   · Saturday: max 3 subjects per day
//   · Sunday: rest day
//   · Sessions capped at 90 min (cognitive fatigue threshold)
//   · 10-min Pomodoro breaks between subjects
//   · Rotation across the week for spaced repetition
//
// Offline colour-PDF generator now mirrors the on-screen
// results page: rounded chips, gradient grade bars, tinted
// banners, dashed motivation box, emoji → ASCII mapping.
// ==============================================================

'use strict';

// ==============================================================
// 1. CONSTANTS
// ==============================================================
const STORAGE_PREFIX = 'dojo_';
const HISTORY_KEY    = `${STORAGE_PREFIX}history`;
const MAX_HISTORY    = 20;
const SUBJECT_SLOTS  = 8;
const MIN_SUBJECTS   = 3;
const MAX_DAYS       = 730;
const MAX_TOASTS     = 3;
const SATURDAY_BOOST = 1.5;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ==============================================================
// 2. GUARDED STORAGE WRAPPER
// ==============================================================
const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, String(value)); return true; }
    catch { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
  getJSON(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  setJSON(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; }
    catch { return false; }
  }
};

// ==============================================================
// 3. DOM REFERENCES
// ==============================================================
const nameInput         = document.getElementById('name');
const daysInput         = document.getElementById('days');
const hoursPerDayInput  = document.getElementById('hoursPerDay');
const hoursHint         = document.getElementById('hoursHint');
const weeklyCapacityEl  = document.getElementById('weeklyCapacity');
const examHint          = document.getElementById('examHint');
const subjectGrid       = document.getElementById('subjectGrid');
const subjectCountEl    = document.getElementById('subjectCount');
const counterFill       = document.getElementById('counterFill');
const resultsDiv        = document.getElementById('results');
const studyForm         = document.getElementById('studyForm');
const historyPanel      = document.getElementById('historyPanel');
const historyList       = document.getElementById('historyList');
const historyBtn        = document.getElementById('historyBtn');
const closeHistoryBtn   = document.getElementById('closeHistory');
const clearHistoryBtn   = document.getElementById('clearHistory');
const themeToggleBtn    = document.getElementById('themeToggle');
const loadingScreen     = document.getElementById('loadingScreen');
const toastContainer    = document.getElementById('toastContainer');
const srStatus          = document.getElementById('srStatus');
const pdfThemeSelect    = document.getElementById('pdfTheme');
const pdfPaperSelect    = document.getElementById('pdfPaper');

let subjectInputs = [];
let gradeInputs   = [];
let lastAnalysis  = null;

// ==============================================================
// 4. UTILITIES
// ==============================================================
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatMinutes(min) {
  if (!Number.isFinite(min) || min <= 0) return '0m';
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function hexToRgb01(hex) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r.toFixed(4) : 0,
    Number.isFinite(g) ? g.toFixed(4) : 0,
    Number.isFinite(b) ? b.toFixed(4) : 0
  ];
}

function titleCase(str) {
  return String(str).split(/\s+/).map(w => {
    if (!w) return w;
    if (w === w.toUpperCase() && w.length <= 4) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function announce(msg) {
  if (!srStatus) return;
  srStatus.textContent = '';
  setTimeout(() => { srStatus.textContent = msg; }, 30);
}

function getSplitMode() {
  const el = document.querySelector('input[name="splitMode"]:checked');
  return el ? el.value : 'need';
}

// ==============================================================
// 5. LOADING SCREEN
// ==============================================================
let loaderDismissed = false;
function dismissLoader() {
  if (loaderDismissed) return;
  loaderDismissed = true;
  const el = loadingScreen || document.getElementById('loadingScreen');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 600);
}
window.addEventListener('load', () => setTimeout(dismissLoader, 800));
setTimeout(dismissLoader, 4000);
window.addEventListener('error', dismissLoader);

// ==============================================================
// 6. TOASTS
// ==============================================================
function showToast(message, type = 'info', duration = 3000) {
  while (toastContainer.children.length >= MAX_TOASTS) {
    toastContainer.firstElementChild.remove();
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ==============================================================
// 7. MODAL CONFIRM
// ==============================================================
function confirmDialog(message, { confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-describedby="modalMsg">
        <p id="modalMsg">${escHtml(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-act="cancel">Cancel</button>
          <button type="button" class="${danger ? 'btn-danger' : 'btn-accent'}" data-act="ok">
            ${escHtml(confirmLabel)}
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const okBtn     = overlay.querySelector('[data-act="ok"]');
    const cancelBtn = overlay.querySelector('[data-act="cancel"]');
    const previousFocus = document.activeElement;

    function close(result) {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 200);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        try { previousFocus.focus(); } catch { /* ignore */ }
      }
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Tab') {
        const focusables = [cancelBtn, okBtn];
        const idx = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const nextIdx = e.shiftKey
          ? (idx - 1 + focusables.length) % focusables.length
          : (idx + 1) % focusables.length;
        focusables[nextIdx].focus();
      }
    }
    okBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}

// ==============================================================
// 8. THEME
// ==============================================================
function initTheme() {
  const saved = store.get(`${STORAGE_PREFIX}theme`);
  const prefersLight = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute(
    'data-theme', saved || (prefersLight ? 'light' : 'dark')
  );
  updateThemeIcon();
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  store.set(`${STORAGE_PREFIX}theme`, next);
  updateThemeIcon();
  showToast(`Switched to ${next} mode`, 'info', 1500);
}
function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const sun  = document.querySelector('.icon-sun');
  const moon = document.querySelector('.icon-moon');
  if (sun)  sun.style.display  = isDark ? 'none'  : 'block';
  if (moon) moon.style.display = isDark ? 'block' : 'none';
  themeToggleBtn.setAttribute('aria-pressed', String(isDark));
  themeToggleBtn.setAttribute('aria-label',
    isDark ? 'Switch to light theme' : 'Switch to dark theme');
}
themeToggleBtn.addEventListener('click', toggleTheme);

// ==============================================================
// 9. AUTO-CORRECT SUBJECTS
// ==============================================================
const corrections = {
  'math': 'Mathematics', 'maths': 'Mathematics', 'mathematics': 'Mathematics',
  'physic': 'Physics', 'physics': 'Physics',
  'chem': 'Chemistry', 'chemistry': 'Chemistry',
  'bio': 'Biology', 'biology': 'Biology',
  'hist': 'History', 'history': 'History',
  'geo': 'Geography', 'geography': 'Geography',
  'eng': 'English', 'english': 'English',
  'lit': 'Literature', 'literature': 'Literature',
  'ict': 'Computer Studies', 'comp': 'Computer Studies', 'cs': 'Computer Studies',
  'computer studies': 'Computer Studies', 'computer science': 'Computer Science',
  'bus': 'Business Studies', 'business': 'Business Studies',
  'business studies': 'Business Studies',
  'eco': 'Economics', 'economics': 'Economics',
  'acc': 'Accounting', 'accounting': 'Accounting',
  'art': 'Art', 'art & design': 'Art & Design',
  'music': 'Music', 'pe': 'Physical Education',
  'physical education': 'Physical Education',
  'psych': 'Psychology', 'psychology': 'Psychology',
  'soc': 'Sociology', 'sociology': 'Sociology',
  'stat': 'Statistics', 'statistics': 'Statistics',
  'calc': 'Calculus', 'calculus': 'Calculus',
  'alg': 'Algebra', 'algebra': 'Algebra',
  'trig': 'Trigonometry', 'trigonometry': 'Trigonometry',
  'french': 'French', 'spanish': 'Spanish', 'german': 'German',
  'latin': 'Latin', 'greek': 'Greek',
  'phil': 'Philosophy', 'philosophy': 'Philosophy',
  'poli sci': 'Political Science', 'political science': 'Political Science',
  'law': 'Law', 'legal': 'Law',
  'rel': 'Religious Studies', 'religious studies': 'Religious Studies',
  'agric': 'Agriculture', 'agriculture': 'Agriculture',
  'tech': 'Technical Drawing', 'technical drawing': 'Technical Drawing',
  'entre': 'Entrepreneurship', 'entrepreneurship': 'Entrepreneurship'
};

const CANONICAL_LOWER = new Set(
  Object.values(corrections).map(v => v.toLowerCase())
);

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function autoCorrectSubject(raw) {
  const name = String(raw).trim().replace(/\s+/g, ' ');
  if (!name) return '';
  const lower = name.toLowerCase();

  if (corrections[lower]) return corrections[lower];

  if (CANONICAL_LOWER.has(lower)) {
    return Object.values(corrections).find(v => v.toLowerCase() === lower) || name;
  }

  for (const canon of CANONICAL_LOWER) {
    if (lower.startsWith(canon + ' ')) return titleCase(name);
  }

  if (lower.length >= 3 && lower.length <= 6) {
    for (const [key, value] of Object.entries(corrections)) {
      if (key === lower) return value;
    }
  }

  let best = null;
  let bestDist = Infinity;
  for (const [key, value] of Object.entries(corrections)) {
    if (Math.abs(key.length - lower.length) > 3) continue;
    const dist = levenshtein(lower, key);
    const tolerance = key.length <= 4 ? 1 : key.length <= 8 ? 2 : 3;
    if (dist < bestDist && dist <= tolerance) {
      bestDist = dist;
      best = value;
    }
  }
  if (best) return best;

  return titleCase(name);
}

// ==============================================================
// 10. QUOTES (deduped)
// ==============================================================
const rawQuotes = [
  "Believe in the me that believes in you! – Kamina (Gurren Lagann)",
  "A dropout will beat a genius through hard work. – Rock Lee (Naruto)",
  "If you don't like your destiny, don't accept it. – Naruto Uzumaki",
  "I never go back on my word, that's my ninja way! – Naruto Uzumaki",
  "Power comes in response to a need, not a desire. – Goku (Dragon Ball)",
  "It's not about the pain, it's about the lesson. – Erza Scarlet (Fairy Tail)",
  "The moment you think of giving up, think of why you held on so long. – Eren Yeager (AOT)",
  "I don't know what the future holds, but I know that I won't give up. – Luffy (One Piece)",
  "Give up on giving up. – Rock Lee",
  "You are the protagonist of your own story. Act like it!",
  "Rest if you must, but don't you ever quit.",
  "Your future is created by what you do today, not tomorrow.",
  "Plus Ultra! – All Might",
  "Even the smallest person can change the course of the future.",
  "It's not the strength of the body, but the strength of the spirit.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Don't study until you get it right. Study until you can't get it wrong.",
  "The secret of getting ahead is getting started.",
  "Your only limit is the one you set for yourself.",
  "Every expert was once a beginner.",
  "The best time to start was yesterday. The next best time is now.",
  "It's not about having time. It's about making time.",
  "Small steps lead to big achievements.",
  "You are braver than you believe, stronger than you seem, and smarter than you think.",
  "Discipline equals freedom.",
  "Push yourself, because no one else will do it for you.",
  "Great things never come from comfort zones.",
  "Dream big. Work hard. Stay focused.",
  "Don't fear failure. Fear being in the same place next year.",
  "The harder you work, the luckier you get.",
  "Success is not final; failure is not fatal: it is the courage to continue that counts.",
  "You don't have to be great to start, but you have to start to be great.",
  "Focus on being productive instead of busy.",
  "Study smart, not just hard.",
  "Consistency is what transforms average into excellence.",
  "Don't let what you cannot do interfere with what you can do.",
  "The pain of study is temporary, but the feeling of success lasts forever.",
  "Believe you can and you're halfway there.",
  "The only person you should try to be better than is the person you were yesterday.",
  "Your education is the most powerful weapon you can use to change the world.",
  "Study because knowledge is power. Study because understanding is freedom.",
  "The more you learn, the more you realize how much you don't know – and that's a good thing.",
  "There is no elevator to success. You have to take the stairs.",
  "Success usually comes to those who are too busy to be looking for it.",
  "Champions are made in the hours that no one is watching.",
  "The only way to do great work is to love what you do.",
  "Your future depends on what you do today.",
  "The best way to predict the future is to create it.",
  "Hard work beats talent when talent doesn't work hard.",
  "Never give up on something you can't go a day without thinking about.",
  "It's not about perfect. It's about effort.",
  "If you want to fly, you have to give up the things that weigh you down.",
  "Every day is a new opportunity to improve.",
  "The key to success is to focus on goals, not obstacles.",
  "You are the master of your fate. You are the captain of your soul.",
  "Start where you are. Use what you have. Do what you can.",
  "The only limit to our realization of tomorrow is our doubts of today.",
  "Action is the foundational key to all success.",
  "Don't watch the clock; do what it does. Keep going.",
  "The secret of success is constancy to purpose.",
  "It always seems impossible until it's done.",
  "Success is not in what you have, but who you are.",
  "Believe in yourself and all that you are.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "You are enough just as you are. Keep growing, keep glowing.",
  "Small daily improvements over time lead to stunning results.",
  "Don't give up on your dreams, or your dreams will give up on you.",
  "The struggle you're in today is developing the strength you need for tomorrow.",
  "Make today so awesome that yesterday gets jealous.",
  "Your only competition is the person you were yesterday.",
  "No matter how slow you go, you are still lapping everyone on the couch.",
  "Be so good they can't ignore you.",
  "Great minds discuss ideas; average minds discuss events; small minds discuss people.",
  "Fall seven times, stand up eight.",
  "Success is not for the lazy.",
  "The road to success is always under construction.",
  "Keep your face always toward the sunshine, and shadows will fall behind you.",
  "You are never too old to set another goal or to dream a new dream.",
  "The best revenge is massive success.",
  "Stay hungry, stay foolish.",
  "The difference between who you are and who you want to be is what you do.",
  "Don't count the days, make the days count.",
  "Prove them wrong. Prove yourself right.",
  "It's okay to not know everything. It's not okay to not try.",
  "Desire is the key to motivation.",
  "Without hard work, nothing grows but weeds.",
  "The best preparation for tomorrow is doing your best today.",
  "Your limitation – it's only your imagination.",
  "Sometimes later becomes never. Do it now.",
  "Great things take time.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Little things make big days.",
  "It's going to be hard, but hard does not mean impossible.",
  "There is no substitute for hard work.",
  "The way to get started is to quit talking and begin doing.",
  "Don't be pushed around by the problems in your life. Be pushed by your dreams.",
  "Success doesn't come to you. You go to it.",
  "If you can dream it, you can do it.",
  "Strive for progress, not perfection.",
  "A year from now you may wish you had started today.",
  "It's never too late to be what you might have been.",
  "You are capable of more than you know.",
  "The beautiful thing about learning is that no one can take it away from you.",
  "Knowledge is power. Knowledge is freedom. Knowledge is the key to your future.",
  "One book, one pen, one child, and one teacher can change the world.",
  "Today's learners are tomorrow's leaders.",
  "Learning is a treasure that will follow its owner everywhere.",
  "Education is not preparation for life; education is life itself."
];
const motivationQuotes = [...new Set(rawQuotes)];

function getRandomQuotes(n = 3) {
  const pool = [...motivationQuotes];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// ==============================================================
// 11. STUDY TECHNIQUES
// ==============================================================
const studyTechniques = {
  'Mathematics': ['Practice problem sets daily', 'Work through proofs step-by-step', 'Use visual diagrams for concepts', 'Teach formulas to someone else', 'Focus on weak topic areas first'],
  'Physics': ['Solve numerical problems', 'Draw free-body diagrams', 'Memorize key formulas with derivations', 'Watch experiment demonstrations', 'Connect theory to real-world examples'],
  'Chemistry': ['Balance equations repeatedly', 'Create flashcards for reactions', 'Practice naming compounds', 'Draw molecular structures', 'Review periodic table trends'],
  'Biology': ['Use diagrams and flowcharts', 'Create mind maps for processes', 'Practice labeling diagrams', 'Summarize chapters in your own words', 'Use mnemonics for classification'],
  'History': ['Create timelines of events', 'Use cause-and-effect charts', 'Write summary paragraphs', 'Connect events to modern parallels', 'Review primary source excerpts'],
  'Geography': ['Practice map reading', 'Draw maps from memory', 'Use case studies for concepts', 'Create comparison tables', 'Review data interpretation skills'],
  'English': ['Read widely — fiction and non-fiction', 'Practice essay writing weekly', 'Analyze passage structure', 'Expand vocabulary with flashcards', 'Practice comprehension questions'],
  'Literature': ['Analyze themes and motifs', 'Memorize key quotes', 'Practice essay planning', 'Compare different works', 'Study author context and background'],
  'Computer Studies': ['Write code daily', 'Trace through programs by hand', 'Create revision notes for theory', 'Practice past exam questions', 'Build small projects for understanding'],
  'Computer Science': ['Write code daily', 'Trace through algorithms by hand', 'Create revision notes for theory', 'Practice past exam questions', 'Build small projects for understanding'],
  'Economics': ['Draw supply/demand diagrams', 'Practice calculation questions', 'Relate concepts to current news', 'Create summary cards for definitions', 'Solve past paper data responses'],
  'Accounting': ['Practice journal entries', 'Work through full accounting cycles', 'Memorize key formulas', 'Practice financial statement prep', 'Review common errors and corrections'],
  'Business Studies': ['Create case study summaries', 'Use SWOT analysis frameworks', 'Memorize key theories', 'Practice essay-style answers', 'Review real business examples'],
  'default': ['Active recall — test yourself', 'Spaced repetition scheduling', 'Teach concepts to someone else', 'Create mind maps and summaries', 'Practice past exam papers under timed conditions']
};
function getTechniquesFor(subject) {
  return studyTechniques[subject] || studyTechniques['default'];
}

// ==============================================================
// 12. SUBJECT GRID + INLINE SUGGESTIONS
// ==============================================================
let counterTimer = null;

function buildSubjectGrid() {
  subjectGrid.innerHTML = '';
  subjectInputs = [];
  gradeInputs = [];
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.innerHTML = `
      <div class="field-group">
        <label for="subject-${i}">Subject ${i}</label>
        <input type="text" id="subject-${i}" placeholder="e.g., Physics"
               data-subject autocomplete="off" spellcheck="false">
        <span class="field-hint" data-hint-for="subject-${i}"></span>
        <span class="field-error" id="err-subj-${i}"></span>
      </div>
      <div class="field-group">
        <label for="grade-${i}">Grade (0-100)</label>
        <input type="number" id="grade-${i}" min="0" max="100"
               placeholder="85" data-grade>
        <span class="field-error" id="err-grade-${i}"></span>
      </div>
      <button type="button" class="row-remove" data-slot="${i}"
              aria-label="Clear slot ${i}" title="Clear slot">&times;</button>
    `;
    subjectGrid.appendChild(row);
    subjectInputs.push(row.querySelector('[data-subject]'));
    gradeInputs.push(row.querySelector('[data-grade]'));
  }
}

function clearFieldError(slot) {
  const subjErr = document.getElementById(`err-subj-${slot}`);
  const gradeErr = document.getElementById(`err-grade-${slot}`);
  if (subjErr) subjErr.textContent = '';
  if (gradeErr) gradeErr.textContent = '';
  const subjInput = document.getElementById(`subject-${slot}`);
  const gradeInput = document.getElementById(`grade-${slot}`);
  if (subjInput) subjInput.classList.remove('input-error');
  if (gradeInput) gradeInput.classList.remove('input-error');
}

function updateSubjectCounter() {
  let count = 0;
  for (let i = 0; i < SUBJECT_SLOTS; i++) {
    if (subjectInputs[i].value.trim() && gradeInputs[i].value.trim() !== '') count++;
  }
  subjectCountEl.textContent = count;
  const pct = (count / SUBJECT_SLOTS) * 100;
  counterFill.style.width = pct + '%';
  counterFill.className = 'counter-fill' + (count >= MIN_SUBJECTS ? ' ready' : '');
}

subjectGrid.addEventListener('input', (e) => {
  const input = e.target;
  clearTimeout(counterTimer);
  counterTimer = setTimeout(updateSubjectCounter, 150);
  if (!input.dataset || !input.dataset.subject) return;

  const hintEl = input.parentElement.querySelector('.field-hint');
  if (!hintEl) return;

  const trimmed = input.value.trim();
  if (!trimmed) {
    hintEl.classList.remove('show');
    hintEl.textContent = '';
    input.removeAttribute('data-suggestion');
    return;
  }
  const corrected = autoCorrectSubject(trimmed);
  if (corrected && corrected.toLowerCase() !== trimmed.toLowerCase()) {
    hintEl.textContent = `Use "${corrected}" — click or press Tab`;
    hintEl.classList.add('show');
    input.setAttribute('data-suggestion', corrected);
  } else {
    hintEl.classList.remove('show');
    hintEl.textContent = '';
    input.removeAttribute('data-suggestion');
  }
});

subjectGrid.addEventListener('click', (e) => {
  const hint = e.target.closest('.field-hint');
  if (hint) {
    const input = hint.parentElement.querySelector('[data-subject]');
    const suggestion = input && input.getAttribute('data-suggestion');
    if (suggestion) {
      input.value = suggestion;
      input.removeAttribute('data-suggestion');
      hint.classList.remove('show');
      hint.textContent = '';
      updateSubjectCounter();
    }
    return;
  }
  const btn = e.target.closest('.row-remove');
  if (!btn) return;
  const slot = btn.dataset.slot;
  const subjInput = document.getElementById(`subject-${slot}`);
  const gradeInput = document.getElementById(`grade-${slot}`);
  if (subjInput) {
    subjInput.value = '';
    subjInput.removeAttribute('data-suggestion');
    const h = subjInput.parentElement.querySelector('.field-hint');
    if (h) { h.classList.remove('show'); h.textContent = ''; }
  }
  if (gradeInput) gradeInput.value = '';
  clearFieldError(slot);
  updateSubjectCounter();
});

subjectGrid.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const input = e.target;
  if (!input.dataset || !input.dataset.subject) return;
  const suggestion = input.getAttribute('data-suggestion');
  if (!suggestion) return;
  input.value = suggestion;
  input.removeAttribute('data-suggestion');
  const hint = input.parentElement.querySelector('.field-hint');
  if (hint) { hint.classList.remove('show'); hint.textContent = ''; }
  updateSubjectCounter();
});

buildSubjectGrid();

// ==============================================================
// 13. DAYS + HOURS HINTS
// ==============================================================
function updateDaysHint() {
  const d = parseInt(daysInput.value, 10);
  if (isNaN(d) || d < 0) {
    examHint.textContent = 'Enter days remaining';
    examHint.className = 'exam-hint';
    return;
  }
  if (d === 0)      { examHint.textContent = 'Exam is TODAY! Maximum focus!';         examHint.className = 'exam-hint urgent'; }
  else if (d <= 3)  { examHint.textContent = `${d} days — ULTRA URGENT`;             examHint.className = 'exam-hint urgent'; }
  else if (d <= 7)  { examHint.textContent = `${d} days — Critical week`;            examHint.className = 'exam-hint warning'; }
  else if (d <= 14) { examHint.textContent = `${d} days — Two weeks, build habits`;  examHint.className = 'exam-hint caution'; }
  else if (d <= 30) { examHint.textContent = `${d} days — About a month, good time`; examHint.className = 'exam-hint normal'; }
  else              { examHint.textContent = `${d} days — Plenty of time, build foundations`; examHint.className = 'exam-hint relaxed'; }
}

function updateWeeklyCapacity() {
  const h = parseFloat(hoursPerDayInput.value);
  if (isNaN(h) || h < 0.5) {
    weeklyCapacityEl.textContent = 'Enter hours to see weekly capacity.';
    hoursHint.textContent = 'Saturday gets +50% automatically';
    hoursHint.className = 'exam-hint';
    return;
  }
  const base = h * 60;
  const sat  = base * SATURDAY_BOOST;
  const weeklyHours = ((base * 5) + sat) / 60;
  weeklyCapacityEl.textContent =
    `Estimated weekly capacity: ${weeklyHours.toFixed(1)} hours · Sunday is a rest day.`;

  if (h > 8) {
    hoursHint.textContent = 'Very intense — 90 min blocks max, take 10–20 min breaks.';
    hoursHint.className = 'exam-hint warning';
  } else if (h > 6) {
    hoursHint.textContent = 'Intense but workable — ensure proper breaks.';
    hoursHint.className = 'exam-hint caution';
  } else if (h < 0.5) {
    hoursHint.textContent = 'Very light — results may be slow.';
    hoursHint.className = 'exam-hint caution';
  } else {
    hoursHint.textContent = 'Saturday gets +50% · sessions capped at 90 min';
    hoursHint.className = 'exam-hint normal';
  }
}

daysInput.addEventListener('input', updateDaysHint);
hoursPerDayInput.addEventListener('input', () => {
  hoursPerDayInput.classList.remove('input-error');
  updateWeeklyCapacity();
});

// ==============================================================
// 14. PRIORITY ENGINE
// ==============================================================
function getPriority(mark, days) {
  let baseWeekly;
  if (mark < 30)      baseWeekly = 180;
  else if (mark < 40) baseWeekly = 150;
  else if (mark < 50) baseWeekly = 120;
  else if (mark < 60) baseWeekly = 100;
  else if (mark < 70) baseWeekly = 75;
  else if (mark < 80) baseWeekly = 55;
  else if (mark < 90) baseWeekly = 40;
  else                baseWeekly = 30;

  let multiplier;
  if (days <= 1)       multiplier = 2.5;
  else if (days <= 3)  multiplier = 2.2;
  else if (days <= 7)  multiplier = 1.8;
  else if (days <= 14) multiplier = 1.5;
  else if (days <= 21) multiplier = 1.3;
  else if (days <= 30) multiplier = 1.15;
  else if (days <= 60) multiplier = 1.0;
  else if (days <= 90) multiplier = 0.85;
  else                 multiplier = 0.7;

  const weeklyMinutes = Math.round(baseWeekly * multiplier);

  let level, colorClass, urgency;
  if (mark < 40)      { level = 'CRITICAL'; colorClass = 'priority-critical'; urgency = 4; }
  else if (mark < 60) { level = 'HIGH';     colorClass = 'priority-high';     urgency = 3; }
  else if (mark < 75) { level = 'MEDIUM';   colorClass = 'priority-medium';   urgency = 2; }
  else                { level = 'MAINTAIN'; colorClass = 'priority-low';      urgency = 1; }

  let grade;
  if (mark >= 90)      grade = 'A+';
  else if (mark >= 80) grade = 'A';
  else if (mark >= 70) grade = 'B';
  else if (mark >= 60) grade = 'C';
  else if (mark >= 50) grade = 'D';
  else                 grade = 'F';

  const pomodoroSessions = Math.max(1, Math.round(weeklyMinutes / 30));

  return { level, colorClass, urgency, weeklyMinutes, grade, pomodoroSessions };
}

// ==============================================================
// 15. SCHEDULER — evidence-based study times + rotation
// ==============================================================
const MIN_SESSION_MINUTES     = 25;
const PREFERRED_SESSION_MIN   = 30;
const MAX_SESSION_MINUTES     = 90;
const BREAK_MINUTES           = 10;
const LONG_BREAK_MINUTES      = 20;
const MAX_SUBJECTS_WEEKDAY    = 2;
const MAX_SUBJECTS_SATURDAY   = 3;

const PRIORITY_ORDER = {
  'priority-critical': 0,
  'priority-high':     1,
  'priority-medium':   2,
  'priority-low':      3
};

function determineSubjectsPerDay(dailyBudgetMinutes, totalSubjects, isSaturday) {
  const cap = isSaturday ? MAX_SUBJECTS_SATURDAY : MAX_SUBJECTS_WEEKDAY;
  if (totalSubjects <= cap) return totalSubjects;
  const byBudget = Math.floor(dailyBudgetMinutes / MIN_SESSION_MINUTES);
  return Math.max(1, Math.min(cap, byBudget, totalSubjects));
}

function buildRotation(subjectData, weekdaySubjects, saturdaySubjects) {
  const N = subjectData.length;
  const slotsPerDay = [
    weekdaySubjects, weekdaySubjects, weekdaySubjects,
    weekdaySubjects, weekdaySubjects, saturdaySubjects
  ];
  const rotation = [];
  let cursor = 0;

  for (let d = 0; d < 6; d++) {
    const slots = Math.min(slotsPerDay[d], N);
    const daySubjects = [];
    const used = new Set();
    let attempts = 0;

    while (daySubjects.length < slots && attempts < N * 2) {
      const idx = cursor % N;
      cursor++;
      attempts++;
      if (!used.has(idx)) {
        used.add(idx);
        daySubjects.push(subjectData[idx]);
      }
    }
    rotation.push(daySubjects);
  }
  return rotation;
}

function apportion(shares, capacity) {
  const floors = shares.map(v => Math.floor(v));
  let rem = capacity - floors.reduce((a, b) => a + b, 0);
  if (rem > 0) {
    const order = shares
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < rem; k++) {
      floors[order[k % order.length].i]++;
    }
  }
  return floors;
}

function calculateBreaks(totalMinutes, subjectCount) {
  if (subjectCount <= 1) {
    return { breakMinutes: 0, shortBreaks: 0, longBreaks: 0, notes: [] };
  }
  const gapsBetween = subjectCount - 1;
  const notes = [];
  let breakMinutes = 0;
  let shortBreaks = 0;
  let longBreaks = 0;

  if (totalMinutes <= MAX_SESSION_MINUTES) {
    shortBreaks = gapsBetween;
    breakMinutes = shortBreaks * BREAK_MINUTES;
  } else {
    longBreaks = 1;
    shortBreaks = Math.max(0, gapsBetween - 1);
    breakMinutes = shortBreaks * BREAK_MINUTES + longBreaks * LONG_BREAK_MINUTES;
    notes.push(`${LONG_BREAK_MINUTES}-min long break recommended.`);
  }

  return { breakMinutes, shortBreaks, longBreaks, notes };
}

function generateWeeklySchedule(subjects, days, hoursPerDay, splitMode = 'need') {
  const subjectData = Object.entries(subjects).map(([name, mark]) => ({
    name, mark, ...getPriority(mark, days)
  }));
  const N = subjectData.length;

  const emptyResult = {
    schedule: [[], [], [], [], [], []],
    dayNames: DAY_NAMES,
    capacities: [0, 0, 0, 0, 0, 0],
    totalWeeklyDemand: 0,
    totalCapacity: 0,
    scheduled: 0,
    overCapacity: false,
    fragmented: false,
    minDailyShare: 0,
    weeklyPerSubject: {},
    dailyPerSubject: {},
    sessionCount: {},
    subjectsPerDay: 0,
    weekdaySubjects: 0,
    saturdaySubjects: 0,
    rotation: 'none',
    breakSummary: {},
    spareSummary: {},
    splitMode
  };
  if (N === 0) return emptyResult;

  const baseMinutes = Math.round(hoursPerDay * 60);
  const satMinutes  = Math.round(baseMinutes * SATURDAY_BOOST);
  const capacities  = [
    baseMinutes, baseMinutes, baseMinutes, baseMinutes, baseMinutes, satMinutes
  ];

  const weekdaySubjects  = determineSubjectsPerDay(baseMinutes, N, false);
  const saturdaySubjects = determineSubjectsPerDay(satMinutes,  N, true);

  const sortedByPriority = [...subjectData].sort(
    (a, b) => b.urgency - a.urgency || a.mark - b.mark
  );
  const rotation = buildRotation(sortedByPriority, weekdaySubjects, saturdaySubjects);

  const breakSummary = {};
  const spareSummary = {};

  const schedule = rotation.map((daySubjects, d) => {
    const cap = capacities[d];
    const breaks = calculateBreaks(cap, daySubjects.length);
    breakSummary[d] = breaks;

    const studyBudget = Math.max(0, cap - breaks.breakMinutes);

    let shares;
    if (splitMode === 'equal') {
      shares = daySubjects.map(() => studyBudget / daySubjects.length);
    } else {
      const totalWeight = daySubjects.reduce((s, x) => s + x.weeklyMinutes, 0) || 1;
      shares = daySubjects.map(x => studyBudget * (x.weeklyMinutes / totalWeight));
    }

    let minutes = apportion(shares, studyBudget);
    minutes = minutes.map(m => Math.min(m, MAX_SESSION_MINUTES));

    const afterCap = minutes.reduce((a, b) => a + b, 0);
    spareSummary[d] = Math.max(0, studyBudget - afterCap);

    if (spareSummary[d] > 0 && minutes.length > 0) {
      const maxRoom = MAX_SESSION_MINUTES - Math.max(...minutes);
      const canAbsorb = Math.min(spareSummary[d], Math.max(0, maxRoom));
      if (canAbsorb > 0) {
        const idx = minutes.indexOf(Math.max(...minutes));
        minutes[idx] += canAbsorb;
        spareSummary[d] -= canAbsorb;
      }
    }

    return daySubjects
      .map((s, i) => ({
        subject:    s.name,
        minutes:    minutes[i],
        level:      s.level,
        colorClass: s.colorClass,
        urgency:    s.urgency
      }))
      .filter(b => b.minutes > 0)
      .sort((a, b) =>
        (PRIORITY_ORDER[a.colorClass] ?? 9) - (PRIORITY_ORDER[b.colorClass] ?? 9)
      );
  });

  const weeklyPerSubject = {};
  const sessionCount     = {};
  for (const day of schedule) {
    for (const b of day) {
      weeklyPerSubject[b.subject] = (weeklyPerSubject[b.subject] || 0) + b.minutes;
      sessionCount[b.subject]     = (sessionCount[b.subject] || 0) + 1;
    }
  }

  const dailyPerSubject = {};
  for (const name of Object.keys(weeklyPerSubject)) {
    const sessions = sessionCount[name] || 1;
    dailyPerSubject[name] = Math.round(weeklyPerSubject[name] / sessions);
  }

  const totalCapacity     = capacities.reduce((a, b) => a + b, 0);
  const scheduled         = schedule.flat().reduce((s, b) => s + b.minutes, 0);
  const totalWeeklyDemand = subjectData.reduce((s, d) => s + d.weeklyMinutes, 0);
  const allMinutes        = schedule.flat().map(b => b.minutes);
  const minDailyShare     = allMinutes.length ? Math.min(...allMinutes) : 0;

  return {
    schedule,
    dayNames: DAY_NAMES,
    capacities,
    totalWeeklyDemand,
    totalCapacity,
    scheduled,
    overCapacity: totalWeeklyDemand > totalCapacity,
    fragmented:   minDailyShare > 0 && minDailyShare < MIN_SESSION_MINUTES,
    minDailyShare,
    weeklyPerSubject,
    dailyPerSubject,
    sessionCount,
    subjectsPerDay: weekdaySubjects,
    weekdaySubjects,
    saturdaySubjects,
    rotation: N <= 2 ? 'all-daily' : 'rotating',
    breakSummary,
    spareSummary,
    splitMode
  };
}

// ==============================================================
// 16. ANALYZE
// ==============================================================
function analyze(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  for (let i = 1; i <= SUBJECT_SLOTS; i++) clearFieldError(i);
  daysInput.classList.remove('input-error');
  hoursPerDayInput.classList.remove('input-error');

  const days = parseInt(daysInput.value, 10);
  if (isNaN(days) || days < 0) {
    showToast('Enter valid days until exam', 'error');
    daysInput.classList.add('input-error');
    daysInput.focus();
    return;
  }
  if (days > MAX_DAYS) {
    showToast(`Maximum ${MAX_DAYS} days (2 years)`, 'error');
    daysInput.classList.add('input-error');
    daysInput.focus();
    return;
  }

  const hoursPerDay = parseFloat(hoursPerDayInput.value);
  if (isNaN(hoursPerDay) || hoursPerDay < 0.5 || hoursPerDay > 16) {
    showToast('Hours per day must be between 0.5 and 16', 'error');
    hoursPerDayInput.classList.add('input-error');
    hoursPerDayInput.focus();
    return;
  }

  const name = nameInput.value.trim() || 'Hunter';
  const splitMode = getSplitMode();

  const subjects = {};
  const errors = [];
  const seen = new Set();

  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    const subjInput  = subjectInputs[i - 1];
    const gradeInput = gradeInputs[i - 1];
    let subjectName = subjInput.value.trim();
    const gradeRaw  = gradeInput.value.trim();

    if (subjectName) {
      const corrected = autoCorrectSubject(subjectName);
      if (corrected && corrected !== subjectName) {
        subjInput.value = corrected;
        subjectName = corrected;
      }
    }

    if (subjectName && !gradeRaw) {
      errors.push({ slot: i, field: 'grade' });
      document.getElementById(`err-grade-${i}`).textContent = 'Grade required';
      gradeInput.classList.add('input-error');
      continue;
    }
    if (!subjectName && gradeRaw) {
      errors.push({ slot: i, field: 'subj' });
      document.getElementById(`err-subj-${i}`).textContent = 'Subject required';
      subjInput.classList.add('input-error');
      continue;
    }
    if (!subjectName && !gradeRaw) continue;

    const grade = Number(gradeRaw);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      errors.push({ slot: i, field: 'grade' });
      document.getElementById(`err-grade-${i}`).textContent = 'Must be 0–100';
      gradeInput.classList.add('input-error');
      continue;
    }

    const key = subjectName.toLowerCase();
    if (seen.has(key)) {
      errors.push({ slot: i, field: 'subj' });
      document.getElementById(`err-subj-${i}`).textContent = 'Duplicate';
      subjInput.classList.add('input-error');
      continue;
    }
    seen.add(key);

    subjects[subjectName] = grade;
  }

  if (errors.length) {
    showToast(
      `Fix ${errors.length} issue${errors.length > 1 ? 's' : ''} before analysing`,
      'error'
    );
    const first = errors[0];
    const el = first.field === 'subj'
      ? subjectInputs[first.slot - 1]
      : gradeInputs[first.slot - 1];
    el.focus();
    return;
  }

  const filledCount = Object.keys(subjects).length;
  if (filledCount < MIN_SUBJECTS) {
    showToast(`Need at least ${MIN_SUBJECTS} subjects (have ${filledCount})`, 'warning');
    return;
  }

  saveCurrentData(name, days, hoursPerDay, splitMode);

  resultsDiv.classList.add('results-loading');
  setTimeout(() => {
    renderResults(name, days, hoursPerDay, subjects, splitMode);
    resultsDiv.classList.remove('results-loading');
  }, 250);
}

// ==============================================================
// 17. RESULTS RENDERER
// ==============================================================
function renderResults(name, days, hoursPerDay, subjects, splitMode) {
  const subjectData = Object.entries(subjects).map(([n, mark]) => ({
    name: n, mark, ...getPriority(mark, days)
  }));

  const avgMark = Math.round(
    subjectData.reduce((s, d) => s + d.mark, 0) / subjectData.length
  );
  const sortedByMark = [...subjectData].sort((a, b) => a.mark - b.mark);
  const weakest   = sortedByMark[0];
  const strongest = sortedByMark[sortedByMark.length - 1];
  const quotes = getRandomQuotes(3);

  const sched = generateWeeklySchedule(subjects, days, hoursPerDay, splitMode);
  const {
    schedule, capacities, totalCapacity, scheduled,
    overCapacity, fragmented, minDailyShare,
    weeklyPerSubject, dailyPerSubject,
    sessionCount, weekdaySubjects, saturdaySubjects, rotation,
    breakSummary, spareSummary
  } = sched;

  let urgencyMsg, urgencyClass;
  if (days === 0)      { urgencyMsg = 'EXAM IS TODAY! Final sprint — focus on key formulas and summaries.'; urgencyClass = 'critical'; }
  else if (days <= 3)  { urgencyMsg = 'ULTRA URGENT: Focus on weakest subjects and key concepts.';            urgencyClass = 'critical'; }
  else if (days <= 7)  { urgencyMsg = 'One week left. Prioritise high-impact revision on weak areas.';        urgencyClass = 'high'; }
  else if (days <= 14) { urgencyMsg = 'Two weeks — build a daily revision habit. Stay consistent.';           urgencyClass = 'medium'; }
  else if (days <= 30) { urgencyMsg = 'About a month. Perfect time for a structured weekly schedule.';        urgencyClass = 'normal'; }
  else if (days <= 60) { urgencyMsg = 'Good time buffer. Build strong foundations and practice regularly.';   urgencyClass = 'normal'; }
  else                 { urgencyMsg = 'Plenty of time. Master each topic deeply — a great advantage.';        urgencyClass = 'relaxed'; }

  const splitLabel = splitMode === 'equal' ? 'Equally' : 'By Need';

  let html = '';

  html += `<div class="result-header">`;
  html += `<h2>HELLO, ${escHtml(name.toUpperCase())}!</h2>`;
  html += `<div class="result-stats">`;
  html += `<div class="stat-chip"><span class="stat-value">${subjectData.length}</span><span class="stat-label">Subjects</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${avgMark}%</span><span class="stat-label">Average</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${formatMinutes(scheduled)}</span><span class="stat-label">/week</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${days}</span><span class="stat-label">days left</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${hoursPerDay}h</span><span class="stat-label">/day</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${splitLabel}</span><span class="stat-label">split</span></div>`;
  html += `</div></div>`;

  const urgencyIcon = days <= 3 ? '⚠️' : days <= 14 ? '📅' : '✅';
  html += `<div class="urgency-banner urgency-${urgencyClass}">`
        + `<span class="urgency-icon" aria-hidden="true">${urgencyIcon}</span> `
        + `<span>${escHtml(urgencyMsg)}</span></div>`;

  if (fragmented) {
    html += `<div class="urgency-banner urgency-medium">
      <span class="urgency-icon" aria-hidden="true">⚠️</span>
      <span>Some sessions are only ${minDailyShare} min — below the ${MIN_SESSION_MINUTES}-min Pomodoro floor. `
      + `Consider fewer subjects or more daily hours for effective focus.</span>
    </div>`;
  }

  if (overCapacity) {
    html += `<div class="urgency-banner urgency-high">
      <span class="urgency-icon" aria-hidden="true">⚠️</span>
      <span>Your priority engine suggests ${formatMinutes(sched.totalWeeklyDemand)}/week, but your schedule fits ${formatMinutes(totalCapacity)}. Weak subjects will get less than ideal — consider more hours.</span>
    </div>`;
  }

  html += `<h3>GRADE OVERVIEW</h3>`;
  html += `<div class="grade-chart">`;
  for (const s of sortedByMark) {
    const pct = Math.max(2, s.mark);
    html += `<div class="grade-row">
      <div class="grade-label">${escHtml(s.name)}</div>
      <div class="grade-bar-wrap">
        <div class="grade-bar ${s.colorClass}" style="--w:${pct}%">
          <span class="grade-bar-text">${s.mark}%</span>
        </div>
      </div>
      <span class="grade-badge ${s.colorClass}">${s.grade}</span>
    </div>`;
  }
  html += `</div>`;

  const byPriority = [...subjectData].sort(
    (a, b) => b.urgency - a.urgency || a.mark - b.mark
  );
  html += `<h3>WEEKLY STUDY PLAN</h3>`;
  if (rotation === 'rotating') {
    html += `<p class="subtext" style="margin-top:-4px;margin-bottom:10px">`
          + `Subjects rotate — max ${weekdaySubjects} per weekday, `
          + `${saturdaySubjects} on Saturday. Sessions capped at ${MAX_SESSION_MINUTES} min `
          + `with ${BREAK_MINUTES}-min breaks between subjects (Pomodoro-based).`
          + `</p>`;
  } else {
    html += `<p class="subtext" style="margin-top:-4px;margin-bottom:10px">`
          + `You have ${subjectData.length} subject${subjectData.length === 1 ? '' : 's'}, `
          + `so they are studied every day.`
          + `</p>`;
  }
  html += `<div class="plan-table-wrap"><table class="plan-table">
    <thead><tr>
      <th>Subject</th><th>Grade</th><th>Priority</th>
      <th>Sessions/Wk</th><th>Per Session</th><th>Weekly</th>
    </tr></thead><tbody>`;
  for (const s of byPriority) {
    const sessions = sessionCount[s.name] || 0;
    const perSess  = dailyPerSubject[s.name] || 0;
    const weekly   = weeklyPerSubject[s.name] || 0;
    html += `<tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${s.mark}%</td>
      <td><span class="${s.colorClass} badge">${s.level}</span></td>
      <td>${sessions}×</td>
      <td class="col-daily">${formatMinutes(perSess)}</td>
      <td><strong>${formatMinutes(weekly)}</strong></td>
    </tr>`;
  }
  html += `</tbody></table></div>`;

  html += `<h3>DAILY TIMETABLE (MON–SAT)</h3>`;
  html += `<p class="subtext" style="margin-top:-4px;margin-bottom:10px">`
        + `Each session is capped at ${MAX_SESSION_MINUTES} min. `
        + `${BREAK_MINUTES}-min breaks sit between subjects — evidence-based Pomodoro timing.`
        + `</p>`;
  html += `<div class="timetable-wrap"><table class="timetable">
    <thead><tr><th>Day</th><th>Subjects &amp; Sessions</th><th>Total</th></tr></thead><tbody>`;
  for (let d = 0; d < 6; d++) {
    const dayItems = schedule[d];
    const dayTotal = dayItems.reduce((s, b) => s + b.minutes, 0);
    const cap = capacities[d];
    const breaks = breakSummary[d] || { breakMinutes: 0 };
    const spare = spareSummary[d] || 0;

    html += `<tr><td class="day-name">${DAY_NAMES[d]}</td><td class="day-sessions">`;
    if (dayItems.length === 0) {
      html += `<span class="rest-day">Rest / Light review</span>`;
    } else {
      dayItems.forEach((item, i) => {
        html += `<span class="session-chip ${item.colorClass}">`
              + `${escHtml(item.subject)} · ${formatMinutes(item.minutes)}`
              + `</span>`;
        if (i < dayItems.length - 1) {
          const breakLabel = breaks.longBreaks > 0 && i === Math.floor(dayItems.length / 2) - 1
            ? `☕ ${LONG_BREAK_MINUTES}m break`
            : `☕ ${BREAK_MINUTES}m break`;
          html += `<span class="break-chip">${breakLabel}</span>`;
        }
      });
      if (spare > 0) {
        html += `<span class="spare-chip">＋ ${formatMinutes(spare)} spare</span>`;
      }
    }
    const breakTotal = breaks.breakMinutes || 0;
    const totalSpent = dayTotal + breakTotal + spare;
    html += `</td><td class="day-total">${formatMinutes(totalSpent)}<br>`
          + `<small style="font-weight:400;color:var(--text-muted)">`
          + `${formatMinutes(dayTotal)} study + ${formatMinutes(breakTotal)} break`
          + (spare > 0 ? ` + ${formatMinutes(spare)} spare` : '')
          + `</small></td></tr>`;
  }
  html += `<tr><td class="day-name">Sunday</td><td class="day-sessions">`
        + `<span class="rest-day">Rest day — sleep, light review, recharge.</span>`
        + `</td><td class="day-total">0m</td></tr>`;
  html += `</tbody></table></div>`;

  html += `<h3>RECOMMENDED TECHNIQUES</h3>`;
  html += `<div class="techniques-grid">`;
  for (const s of sortedByMark.slice(0, 4)) {
    const techniques = getTechniquesFor(s.name);
    html += `<div class="technique-card">
      <h4>${escHtml(s.name)} <span class="${s.colorClass}">${s.grade}</span></h4>
      <ul>${techniques.slice(0, 3).map(t => `<li>${escHtml(t)}</li>`).join('')}</ul>
    </div>`;
  }
  html += `</div>`;

  html += `<div class="motivation-block">
    <h3>MOTIVATION BOOST</h3>
    <p class="weak-link">Your biggest growth area: <strong>${escHtml(weakest.name)}</strong> (${weakest.mark}%). That's where the most points are waiting!</p>
    <p class="strong-link">Your strongest weapon: <strong>${escHtml(strongest.name)}</strong> (${strongest.mark}%). Keep it sharp!</p>`;
  const markers = ['🔴', '🔥', '🌟'];
  html += quotes.map((q, i) =>
    `<p class="quote"><span class="quote-marker">${markers[i]}</span> <em>"${escHtml(q)}"</em></p>`
  ).join('');
  html += `</div>`;

  html += `<div class="revision-order">
    <h3>RECOMMENDED REVISION ORDER</h3>
    <p>${sortedByMark.map(s =>
      `<span class="order-chip ${s.colorClass}">${escHtml(s.name)} (${s.mark}%)</span>`
    ).join(' → ')}</p>
  </div>`;

  html += `<div class="tips-block"><h3>SYSTEM TIPS (EVIDENCE-BASED)</h3><ul>`;
  html += `<li>Sessions are capped at ${MAX_SESSION_MINUTES} min — cognitive fatigue sets in beyond that.</li>`;
  html += `<li>${BREAK_MINUTES}-min breaks between subjects follow the Pomodoro evidence (BMC 2025 review, N=5,270).</li>`;
  html += `<li>30–45 min per subject matches the optimal learning/recall window (Buzan research).</li>`;
  if (days <= 7)    html += `<li>Final week: use past papers under timed conditions — closest to the real thing.</li>`;
  if (days <= 14)   html += `<li>Focus on past papers — they reveal exam patterns.</li>`;
  if (avgMark < 50) html += `<li>Start with the basics. Don't skip foundational topics.</li>`;
  if (subjectData.length >= 5 && rotation === 'rotating')
    html += `<li>With ${subjectData.length} subjects, the rotation keeps each day focused — don't try to squeeze in extra subjects.</li>`;
  html += `<li>Review each session's material within 24 hours for best retention (spaced repetition).</li>`;
  if (days > 30)    html += `<li>You have time — explore active recall and spaced repetition apps.</li>`;
  html += `<li>Sleep 7–8 hours. Your brain consolidates memory during sleep (Cambridge student guidance).</li>`;
  html += `</ul></div>`;

  resultsDiv.innerHTML = html;
  resultsDiv.classList.add('has-results');
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  lastAnalysis = {
    name, days, hoursPerDay, splitMode,
    subjects: { ...subjects },
    subjectData: byPriority,
    sortedByMark,
    avgMark,
    scheduled,
    totalCapacity,
    weakest,
    strongest,
    quotes,
    schedule,
    dayNames: DAY_NAMES,
    capacities,
    weeklyPerSubject,
    dailyPerSubject,
    sessionCount,
    weekdaySubjects,
    saturdaySubjects,
    rotation,
    breakSummary,
    spareSummary,
    fragmented,
    minDailyShare,
    overCapacity,
    urgencyMsg,
    urgencyClass
  };

  saveToHistory(name, days, hoursPerDay, splitMode, subjects, avgMark, scheduled);

  announce(`Analysis complete. Plan for ${subjectData.length} subjects ready.`);
  showToast('Analysis complete!', 'success');
}

// ==============================================================
// 18. LOCAL STORAGE
// ==============================================================
function saveCurrentData(name, days, hoursPerDay, splitMode) {
  store.set(`${STORAGE_PREFIX}name`, name);
  store.set(`${STORAGE_PREFIX}days`, days);
  store.set(`${STORAGE_PREFIX}hoursPerDay`, hoursPerDay);
  store.set(`${STORAGE_PREFIX}splitMode`, splitMode);
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    store.set(`${STORAGE_PREFIX}subj_${i}`, subjectInputs[i - 1].value);
    store.set(`${STORAGE_PREFIX}grade_${i}`, gradeInputs[i - 1].value);
  }
}

function loadSavedData() {
  const n = store.get(`${STORAGE_PREFIX}name`);
  if (n) nameInput.value = n;

  const d = store.get(`${STORAGE_PREFIX}days`);
  if (d) daysInput.value = d;

  const h = store.get(`${STORAGE_PREFIX}hoursPerDay`);
  if (h) hoursPerDayInput.value = h;

  const sm = store.get(`${STORAGE_PREFIX}splitMode`);
  if (sm === 'need' || sm === 'equal') {
    const radio = document.querySelector(`input[name="splitMode"][value="${sm}"]`);
    if (radio) radio.checked = true;
  }

  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    const s = store.get(`${STORAGE_PREFIX}subj_${i}`);
    const g = store.get(`${STORAGE_PREFIX}grade_${i}`);
    if (s) subjectInputs[i - 1].value = s;
    if (g) gradeInputs[i - 1].value = g;
  }

  updateSubjectCounter();
  updateDaysHint();
  updateWeeklyCapacity();
}

// ==============================================================
// 19. HISTORY
// ==============================================================
function getHistory() {
  const h = store.getJSON(HISTORY_KEY, []);
  return Array.isArray(h) ? h : [];
}

function saveToHistory(name, days, hoursPerDay, splitMode, subjects, avg, totalMin) {
  const history = getHistory();
  history.unshift({
    date: new Date().toISOString(),
    name, days, hoursPerDay, splitMode,
    subjects: { ...subjects },
    average: avg,
    totalWeekly: totalMin,
    count: Object.keys(subjects).length
  });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  store.setJSON(HISTORY_KEY, history);
}

function renderHistory() {
  const history = getHistory();
  if (history.length === 0) {
    historyList.innerHTML =
      '<p class="history-empty">No analysis history yet. Run your first analysis!</p>';
    return;
  }

  historyList.innerHTML = history.map((h, i) => {
    const date = new Date(h.date);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    });
    const subjectNames = Object.keys(h.subjects).join(', ');
    const avgClass = h.average < 50 ? 'priority-critical'
                   : h.average < 70 ? 'priority-medium'
                   : 'priority-low';
    const hoursNote = h.hoursPerDay ? ` · ${h.hoursPerDay}h/day` : '';
    const splitNote = h.splitMode === 'equal' ? ' · Equal split' : ' · By need';

    return `<div class="history-item" data-index="${i}"
                 role="button" tabindex="0"
                 aria-label="Restore ${escHtml(h.name || 'plan')} from ${dateStr}">
      <div class="history-meta">
        <span class="history-date">${dateStr} ${timeStr}</span>
        <span class="history-avg ${avgClass}">${h.average}%</span>
      </div>
      <div class="history-subjects">${escHtml(subjectNames)}</div>
      <div class="history-details">${h.count} subjects · ${formatMinutes(h.totalWeekly)}/week · ${h.days} days${hoursNote}${splitNote}</div>
    </div>`;
  }).join('');

  historyList.querySelectorAll('.history-item').forEach(item => {
    const restore = () => restoreFromHistory(history[parseInt(item.dataset.index, 10)]);
    item.addEventListener('click', restore);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        restore();
      }
    });
  });
}

function restoreFromHistory(h) {
  if (!h) return;
  nameInput.value = h.name || '';
  daysInput.value = h.days != null ? h.days : '';
  if (h.hoursPerDay != null) hoursPerDayInput.value = h.hoursPerDay;

  if (h.splitMode === 'need' || h.splitMode === 'equal') {
    const radio = document.querySelector(`input[name="splitMode"][value="${h.splitMode}"]`);
    if (radio) radio.checked = true;
  }

  for (let i = 0; i < SUBJECT_SLOTS; i++) {
    subjectInputs[i].value = '';
    gradeInputs[i].value = '';
    clearFieldError(i + 1);
    const hint = subjectInputs[i].parentElement.querySelector('.field-hint');
    if (hint) { hint.classList.remove('show'); hint.textContent = ''; }
    subjectInputs[i].removeAttribute('data-suggestion');
  }

  let slot = 0;
  for (const [subj, grade] of Object.entries(h.subjects || {})) {
    if (slot >= SUBJECT_SLOTS) break;
    subjectInputs[slot].value = subj;
    gradeInputs[slot].value = grade;
    slot++;
  }

  updateSubjectCounter();
  updateDaysHint();
  updateWeeklyCapacity();
  closeHistoryPanel();
  analyze();
  showToast('History entry restored', 'info', 2000);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==============================================================
// 20. HISTORY PANEL
// ==============================================================
function syncHistoryAria() {
  historyBtn.setAttribute('aria-expanded', String(!historyPanel.hidden));
}
function openHistoryPanel() {
  renderHistory();
  historyPanel.hidden = false;
  syncHistoryAria();
  if (closeHistoryBtn) closeHistoryBtn.focus();
}
function closeHistoryPanel() {
  const wasOpen = !historyPanel.hidden;
  historyPanel.hidden = true;
  syncHistoryAria();
  if (wasOpen) historyBtn.focus();
}
function toggleHistoryPanel() {
  if (historyPanel.hidden) openHistoryPanel();
  else closeHistoryPanel();
}

// ==============================================================
// 21. CLEAR
// ==============================================================
async function clearAll() {
  const ok = await confirmDialog(
    'Reset the System? All saved data and the current results will be lost.',
    { confirmLabel: 'Reset', danger: true }
  );
  if (!ok) return;

  nameInput.value = '';
  daysInput.value = '';
  hoursPerDayInput.value = '2';

  const defaultRadio = document.querySelector('input[name="splitMode"][value="need"]');
  if (defaultRadio) defaultRadio.checked = true;

  for (let i = 0; i < SUBJECT_SLOTS; i++) {
    subjectInputs[i].value = '';
    gradeInputs[i].value = '';
    subjectInputs[i].removeAttribute('data-suggestion');
    const hint = subjectInputs[i].parentElement.querySelector('.field-hint');
    if (hint) { hint.classList.remove('show'); hint.textContent = ''; }
  }
  for (let i = 1; i <= SUBJECT_SLOTS; i++) clearFieldError(i);

  examHint.textContent = 'Enter days remaining';
  examHint.className = 'exam-hint';

  resultsDiv.innerHTML = `<div class="results-placeholder">
    <div class="placeholder-icon" aria-hidden="true">💪</div>
    <p>Enter your stats and hit <strong>Run Analysis</strong> to get your personalized training plan.</p>
  </div>`;
  resultsDiv.classList.remove('has-results');
  lastAnalysis = null;

  updateSubjectCounter();
  updateWeeklyCapacity();

  store.remove(`${STORAGE_PREFIX}name`);
  store.remove(`${STORAGE_PREFIX}days`);
  store.remove(`${STORAGE_PREFIX}hoursPerDay`);
  store.remove(`${STORAGE_PREFIX}splitMode`);
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    store.remove(`${STORAGE_PREFIX}subj_${i}`);
    store.remove(`${STORAGE_PREFIX}grade_${i}`);
  }

  showToast('System reset. Ready for a new journey.', 'info');
  announce('System reset.');
}

// ==============================================================
// 22. OFFLINE PDF GENERATOR — HTML-matched primitives
// ==============================================================
const PDF_THEMES = {
  midnight: {
    pageBg:  '#0a0c18',
    card:    '#0d0d1a',
    accent:  '#00f0ff',
    heading: '#d4af37',
    text:    '#d0dff0',
    subtext: '#8899bb',
    muted:   '#556677',
    border:  '#1a1a2e',
    critical:'#ff2a75',
    high:    '#ff6b4a',
    medium:  '#d4af37',
    low:     '#00f0ff',
    success: '#2ecc71',
    critical2:'#ff5090',
    high2:    '#ff9060',
    medium2:  '#f0d060',
    low2:     '#60f0ff'
  },
  solar: {
    pageBg:  '#1a0f08',
    card:    '#2a1810',
    accent:  '#ff9f43',
    heading: '#ffd166',
    text:    '#fff5e6',
    subtext: '#c9a980',
    muted:   '#8a6b48',
    border:  '#3a2418',
    critical:'#ff5252',
    high:    '#ff8a3d',
    medium:  '#ffd166',
    low:     '#7ed6df',
    success: '#6ab04c',
    critical2:'#ff7777',
    high2:    '#ffb07a',
    medium2:  '#ffe89a',
    low2:     '#b3e8ee'
  },
  forest: {
    pageBg:  '#0f1a12',
    card:    '#16241a',
    accent:  '#7bd389',
    heading: '#f2e9c7',
    text:    '#e6f2e6',
    subtext: '#8fa99a',
    muted:   '#5f7268',
    border:  '#1e3325',
    critical:'#e5534b',
    high:    '#e8a250',
    medium:  '#d4c66b',
    low:     '#7bd389',
    success: '#7bd389',
    critical2:'#ff7a70',
    high2:    '#ffc178',
    medium2:  '#efe0a0',
    low2:     '#a8e5b3'
  },
  mono: {
    pageBg:  '#ffffff',
    card:    '#f5f5f5',
    accent:  '#000000',
    heading: '#111111',
    text:    '#222222',
    subtext: '#555555',
    muted:   '#777777',
    border:  '#cccccc',
    critical:'#000000',
    high:    '#333333',
    medium:  '#666666',
    low:     '#999999',
    success: '#000000',
    critical2:'#333333',
    high2:    '#555555',
    medium2:  '#888888',
    low2:     '#bbbbbb'
  }
};

function hexToRgbRaw(hex) {
  const h = String(hex).replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0
  ];
}

function priorityColor(theme, colorClass) {
  switch (colorClass) {
    case 'priority-critical': return theme.critical;
    case 'priority-high':     return theme.high;
    case 'priority-medium':   return theme.medium;
    case 'priority-low':      return theme.low;
    default:                  return theme.text;
  }
}

function priorityGradient(theme, colorClass) {
  switch (colorClass) {
    case 'priority-critical': return [theme.critical, theme.critical2];
    case 'priority-high':     return [theme.high,     theme.high2];
    case 'priority-medium':   return [theme.medium,   theme.medium2];
    case 'priority-low':      return [theme.low,      theme.low2];
    default:                  return [theme.text,     theme.text];
  }
}

function tint(hex, alpha = 0.14) {
  const [r, g, b] = hexToRgbRaw(hex);
  return `#${[
    Math.round(r * alpha).toString(16).padStart(2, '0'),
    Math.round(g * alpha).toString(16).padStart(2, '0'),
    Math.round(b * alpha).toString(16).padStart(2, '0')
  ].join('')}`;
}

class OfflinePDF {
  constructor({ paper = 'a4', theme = 'midnight' } = {}) {
    const sizes = { a4: [595.28, 841.89], letter: [612, 792] };
    const size = sizes[paper] || sizes.a4;
    this.pageW = size[0];
    this.pageH = size[1];
    this.marginX = 40;
    this.marginTop = 44;
    this.marginBottom = 40;
    this.contentW = this.pageW - this.marginX * 2;
    this.theme = PDF_THEMES[theme] || PDF_THEMES.midnight;
    this.pages = [];
    this.buf = [];
    this.cursorY = 0;
    this.startPage();
  }

  startPage() {
    if (this.buf.length) this.pages.push(this.buf.join('\n'));
    this.buf = [];
    this.cursorY = this.pageH - this.marginTop;
    const [r, g, b] = hexToRgb01(this.theme.pageBg);
    this.buf.push(`${r} ${g} ${b} rg`);
    this.buf.push(`0 0 ${this.pageW.toFixed(2)} ${this.pageH.toFixed(2)} re f`);
  }

  ensureSpace(h) {
    if (this.cursorY - h < this.marginBottom) this.startPage();
  }

  esc(str) {
    return String(str)
      .replace(/\u2192/g, '->')
      .replace(/\u2190/g, '<-')
      .replace(/\u26A0\uFE0F?/g, '!')
      .replace(/\u2705/g, '+')
      .replace(/\u2615/g, '~')
      .replace(/[\u{1F4C5}]/gu, '#')
      .replace(/[\u{1F4A1}\u{1F534}\u{1F525}\u{1F31F}\u{1F4AA}]/gu, '*')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  text(str, x, y, { font = 'F1', size = 11, color = '#000000' } = {}) {
    const [r, g, b] = hexToRgb01(color);
    this.buf.push('BT');
    this.buf.push(`${r} ${g} ${b} rg`);
    this.buf.push(`/${font} ${size} Tf`);
    this.buf.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    this.buf.push(`(${this.esc(str)}) Tj`);
    this.buf.push('ET');
  }

  measure(str, size, bold = false) {
    return String(str).length * size * (bold ? 0.575 : 0.52);
  }

  wrap(str, size, maxWidth, bold = false) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (this.measure(test, size, bold) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  centeredText(str, x, w, y, opts = {}) {
    const size = opts.size || 11;
    const bold = !!opts.bold;
    const tw = this.measure(str, size, bold);
    this.text(str, x + (w - tw) / 2, y, {
      ...opts,
      font: bold ? 'F2' : 'F1'
    });
  }

  rect(x, y, w, h, fill, { stroke = null, strokeW = 0.5 } = {}) {
    const [r, g, b] = hexToRgb01(fill);
    this.buf.push(`${r} ${g} ${b} rg`);
    this.buf.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    if (stroke) {
      const [sr, sg, sb] = hexToRgb01(stroke);
      this.buf.push(`${sr} ${sg} ${sb} RG ${strokeW} w`);
      this.buf.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    }
  }

  roundedRect(x, y, w, h, r, fill, { stroke = null, strokeW = 0.5, dashed = false } = {}) {
    const rad = Math.min(r, w / 2, h / 2);
    const k = 0.5522847498 * rad;

    this.buf.push('q');
    this.buf.push(`${(x + rad).toFixed(2)} ${y.toFixed(2)} m`);
    this.buf.push(`${(x + w - rad).toFixed(2)} ${y.toFixed(2)} l`);
    this.buf.push(
      `${(x + w - rad + k).toFixed(2)} ${y.toFixed(2)} ` +
      `${(x + w).toFixed(2)} ${(y + rad - k).toFixed(2)} ` +
      `${(x + w).toFixed(2)} ${(y + rad).toFixed(2)} c`
    );
    this.buf.push(`${(x + w).toFixed(2)} ${(y + h - rad).toFixed(2)} l`);
    this.buf.push(
      `${(x + w).toFixed(2)} ${(y + h - rad + k).toFixed(2)} ` +
      `${(x + w - rad + k).toFixed(2)} ${(y + h).toFixed(2)} ` +
      `${(x + w - rad).toFixed(2)} ${(y + h).toFixed(2)} c`
    );
    this.buf.push(`${(x + rad).toFixed(2)} ${(y + h).toFixed(2)} l`);
    this.buf.push(
      `${(x + rad - k).toFixed(2)} ${(y + h).toFixed(2)} ` +
      `${x.toFixed(2)} ${(y + h - rad + k).toFixed(2)} ` +
      `${x.toFixed(2)} ${(y + h - rad).toFixed(2)} c`
    );
    this.buf.push(`${x.toFixed(2)} ${(y + rad).toFixed(2)} l`);
    this.buf.push(
      `${x.toFixed(2)} ${(y + rad - k).toFixed(2)} ` +
      `${(x + rad - k).toFixed(2)} ${y.toFixed(2)} ` +
      `${(x + rad).toFixed(2)} ${y.toFixed(2)} c`
    );

    if (fill) {
      const [r2, g2, b2] = hexToRgb01(fill);
      this.buf.push(`${r2} ${g2} ${b2} rg`);
      this.buf.push('f');
    }
    if (stroke) {
      const [sr, sg, sb] = hexToRgb01(stroke);
      this.buf.push(`${sr} ${sg} ${sb} RG ${strokeW} w`);
      if (dashed) this.buf.push('[3 2] 0 d');
      this.buf.push('S');
      if (dashed) this.buf.push('[] 0 d');
    }
    this.buf.push('Q');
  }

  linearGradientRect(x, y, w, h, c1, c2, steps = 48) {
    const rgb1 = hexToRgbRaw(c1);
    const rgb2 = hexToRgbRaw(c2);
    const stripW = w / steps;
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
      const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
      const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
      const sx = x + i * stripW;
      this.buf.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
      this.buf.push(`${sx.toFixed(2)} ${y.toFixed(2)} ${(stripW + 0.4).toFixed(2)} ${h.toFixed(2)} re f`);
    }
  }

  hr() {
    this.ensureSpace(10);
    const [r, g, b] = hexToRgb01(this.theme.border);
    this.buf.push(`${r} ${g} ${b} RG 0.5 w`);
    this.buf.push(
      `${this.marginX} ${this.cursorY.toFixed(2)} m ` +
      `${(this.pageW - this.marginX).toFixed(2)} ${this.cursorY.toFixed(2)} l S`
    );
    this.cursorY -= 10;
  }

  chip(x, y, h, text, {
    bg = null, fg = null, border = null,
    size = 8, padding = 8, dashed = false
  } = {}) {
    const tw = this.measure(text, size, false);
    const w = tw + padding * 2;
    this.roundedRect(x, y, w, h, h / 2, bg || this.theme.card, {
      stroke: border, strokeW: 0.5, dashed
    });
    this.text(text, x + padding, y + h / 2 - size * 0.35, {
      size,
      color: fg || this.theme.text
    });
    return w;
  }

  spacer(h = 8) { this.cursorY -= h; }

  pageTitle(str) {
    this.ensureSpace(40);
    const size = 26;
    this.centeredText(str, this.marginX, this.contentW, this.cursorY - size, {
      size, bold: true, color: this.theme.heading
    });
    this.cursorY -= size + 6;
    const [r, g, b] = hexToRgb01(this.theme.heading);
    this.buf.push(`${r} ${g} ${b} RG 1.6 w`);
    const underlineW = 100;
    const ux = this.pageW / 2 - underlineW / 2;
    this.buf.push(
      `${ux.toFixed(2)} ${this.cursorY.toFixed(2)} m ` +
      `${(ux + underlineW).toFixed(2)} ${this.cursorY.toFixed(2)} l S`
    );
    this.cursorY -= 12;
  }

  sectionHeading(str) {
    this.ensureSpace(28);
    const size = 10.5;
    this.text(str.toUpperCase(), this.marginX, this.cursorY - size, {
      font: 'F2', size, color: this.theme.accent
    });
    this.cursorY -= size + 8;
  }

  mainHeading(str) {
    this.ensureSpace(30);
    const size = 16;
    this.centeredText(str, this.marginX, this.contentW, this.cursorY - size, {
      size, bold: true, color: this.theme.heading
    });
    this.cursorY -= size + 10;
  }

  paragraph(str, { size = 10, color = null, indent = 0, gap = 6, bold = false } = {}) {
    const c = color || this.theme.text;
    const maxW = this.contentW - indent;
    const lines = this.wrap(str, size, maxW, bold);
    const lineH = size * 1.35;
    for (const ln of lines) {
      this.ensureSpace(lineH);
      this.text(ln, this.marginX + indent, this.cursorY - size, {
        font: bold ? 'F2' : 'F1', size, color: c
      });
      this.cursorY -= lineH;
    }
    this.cursorY -= gap;
  }

  paragraphCentered(str, { size = 10, color = null, gap = 6, bold = false } = {}) {
    const c = color || this.theme.text;
    const lines = this.wrap(str, size, this.contentW, bold);
    const lineH = size * 1.35;
    for (const ln of lines) {
      this.ensureSpace(lineH);
      this.centeredText(ln, this.marginX, this.contentW, this.cursorY - size, {
        size, color: c, bold
      });
      this.cursorY -= lineH;
    }
    this.cursorY -= gap;
  }

  bullet(str, { size = 9.5, color = null, indent = 12, gap = 3 } = {}) {
    const c = color || this.theme.subtext;
    const maxW = this.contentW - indent - 10;
    const lines = this.wrap(str, size, maxW);
    const lineH = size * 1.35;
    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(lineH);
      if (i === 0) {
        this.text('>', this.marginX + indent - 8, this.cursorY - size, {
          size, color: this.theme.accent, font: 'F2'
        });
      }
      this.text(lines[i], this.marginX + indent, this.cursorY - size, { size, color: c });
      this.cursorY -= lineH;
    }
    this.cursorY -= gap;
  }

  build() {
    if (this.buf.length) this.pages.push(this.buf.join('\n'));
    const totalPages = this.pages.length;

    const objects = [];
    const pageObjIds = [];
    for (let i = 0; i < totalPages; i++) pageObjIds.push(5 + i * 2);

    objects.push({ id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` });
    objects.push({
      id: 2,
      body: `<< /Type /Pages /Kids [${pageObjIds.map(n => `${n} 0 R`).join(' ')}] /Count ${totalPages} >>`
    });
    objects.push({
      id: 3,
      body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
    });
    objects.push({
      id: 4,
      body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`
    });

    for (let i = 0; i < totalPages; i++) {
      const pageId = 5 + i * 2;
      const contentId = pageId + 1;
      objects.push({
        id: pageId,
        body: `<< /Type /Page /Parent 2 0 R ` +
              `/MediaBox [0 0 ${this.pageW.toFixed(2)} ${this.pageH.toFixed(2)}] ` +
              `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
              `/Contents ${contentId} 0 R >>`
      });
      const stream = this.pages[i];
      objects.push({
        id: contentId,
        body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
      });
    }

    objects.sort((a, b) => a.id - b.id);

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [0];
    for (const obj of objects) {
      offsets[obj.id] = pdf.length;
      pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
    }

    const xrefPos = pdf.length;
    const maxId = objects.reduce((m, o) => Math.max(m, o.id), 0);

    pdf += `xref\n0 ${maxId + 1}\n`;
    pdf += `0000000000 65535 f \n`;
    for (let i = 1; i <= maxId; i++) {
      const off = offsets[i] || 0;
      pdf += String(off).padStart(10, '0') + ' 00000 n \n';
    }
    pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) {
      bytes[i] = pdf.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}

// ==============================================================
// 23. PDF RENDERING — mirrors the on-screen results layout
// ==============================================================
function renderPDF(state) {
  const {
    name, days, hoursPerDay, splitMode, subjectData, sortedByMark, avgMark,
    scheduled, schedule, dayNames, capacities,
    weeklyPerSubject, dailyPerSubject, sessionCount,
    weekdaySubjects, saturdaySubjects, rotation,
    breakSummary, spareSummary,
    fragmented, minDailyShare,
    quotes, urgencyMsg, urgencyClass
  } = state;

  const pdf = new OfflinePDF({
    paper: pdfPaperSelect.value,
    theme: pdfThemeSelect.value
  });
  const t = pdf.theme;
  const splitLabel = splitMode === 'equal' ? 'Equally' : 'By Need';
  const colW = pdf.contentW;

  // Page title
  pdf.spacer(4);
  pdf.pageTitle('STUDY DOJO');
  pdf.paragraphCentered(
    `System v3.6  ·  personalised training plan  ·  ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    { size: 9, color: t.subtext, gap: 2 }
  );
  pdf.spacer(6);
  pdf.hr();
  pdf.spacer(10);

  // HELLO, NAME
  pdf.mainHeading(`HELLO, ${name.toUpperCase()}!`);
  pdf.paragraphCentered(
    `${days} day${days === 1 ? '' : 's'} until exam  ·  ${hoursPerDay}h Mon-Fri  ·  Sat 1.5x  ·  Sunday rest  ·  ${splitLabel} split`,
    { size: 9.5, color: t.subtext, gap: 10 }
  );

  // Stat chip row
  const stats = [
    { v: String(subjectData.length), l: 'SUBJECTS' },
    { v: `${avgMark}%`,              l: 'AVERAGE' },
    { v: formatMinutes(scheduled),   l: '/WEEK' },
    { v: `${days}`,                  l: 'DAYS LEFT' },
    { v: `${hoursPerDay}h`,          l: '/DAY' },
    { v: splitLabel,                 l: 'SPLIT' }
  ];
  const chipGap = 6;
  const chipH = 44;
  const chipW = (colW - chipGap * (stats.length - 1)) / stats.length;
  pdf.ensureSpace(chipH + 14);
  const chipTop = pdf.cursorY;
  for (let i = 0; i < stats.length; i++) {
    const cx = pdf.marginX + i * (chipW + chipGap);
    const cy = chipTop - chipH;
    pdf.roundedRect(cx, cy, chipW, chipH, 8, t.card, { stroke: t.border, strokeW: 0.6 });
    pdf.centeredText(stats[i].v, cx, chipW, cy + chipH - 17, {
      size: 13, bold: true, color: t.heading
    });
    pdf.centeredText(stats[i].l, cx, chipW, cy + 9, {
      size: 6.5, color: t.muted
    });
  }
  pdf.cursorY = chipTop - chipH - 14;

  // Urgency banner
  const bannerColor = (
    urgencyClass === 'critical' ? t.critical :
    urgencyClass === 'high'     ? t.high :
    urgencyClass === 'medium'   ? t.medium :
    urgencyClass === 'normal'   ? t.success :
                                  t.low
  );
  const bannerBG = tint(bannerColor, 0.14);
  const bannerLines = pdf.wrap(urgencyMsg, 9.5, colW - 26);
  const bannerH = Math.max(28, bannerLines.length * 13 + 14);
  pdf.ensureSpace(bannerH + 10);
  const bannerTop = pdf.cursorY;
  pdf.roundedRect(
    pdf.marginX, bannerTop - bannerH, colW, bannerH, 8,
    bannerBG, { stroke: bannerColor, strokeW: 0.6 }
  );
  pdf.rect(pdf.marginX, bannerTop - bannerH, 3.5, bannerH, bannerColor);
  for (let i = 0; i < bannerLines.length; i++) {
    pdf.text(bannerLines[i], pdf.marginX + 14, bannerTop - 16 - i * 13, {
      size: 9.5, color: bannerColor, font: 'F2'
    });
  }
  pdf.cursorY = bannerTop - bannerH - 12;

  // Fragmentation warning
  if (fragmented) {
    const msg = `Some sessions are only ${minDailyShare} min — below the ${MIN_SESSION_MINUTES}-min Pomodoro floor. Consider fewer subjects or more daily hours.`;
    const lines = pdf.wrap(msg, 9, colW - 26);
    const h = Math.max(26, lines.length * 12 + 12);
    pdf.ensureSpace(h + 8);
    const top = pdf.cursorY;
    pdf.roundedRect(
      pdf.marginX, top - h, colW, h, 8,
      tint(t.medium, 0.12), { stroke: t.medium, strokeW: 0.6 }
    );
    pdf.rect(pdf.marginX, top - h, 3.5, h, t.medium);
    for (let i = 0; i < lines.length; i++) {
      pdf.text(lines[i], pdf.marginX + 14, top - 15 - i * 12, {
        size: 9, color: t.medium, font: 'F2'
      });
    }
    pdf.cursorY = top - h - 10;
  }

  // Over-capacity warning
  if (state.overCapacity) {
    const msg = `Priority engine suggests ${formatMinutes(state.totalWeeklyDemand || scheduled)}/week, but your schedule fits ${formatMinutes(state.totalCapacity)}. Consider more hours.`;
    const lines = pdf.wrap(msg, 9, colW - 26);
    const h = Math.max(26, lines.length * 12 + 12);
    pdf.ensureSpace(h + 8);
    const top = pdf.cursorY;
    pdf.roundedRect(
      pdf.marginX, top - h, colW, h, 8,
      tint(t.high, 0.12), { stroke: t.high, strokeW: 0.6 }
    );
    pdf.rect(pdf.marginX, top - h, 3.5, h, t.high);
    for (let i = 0; i < lines.length; i++) {
      pdf.text(lines[i], pdf.marginX + 14, top - 15 - i * 12, {
        size: 9, color: t.high, font: 'F2'
      });
    }
    pdf.cursorY = top - h - 10;
  }

  // GRADE OVERVIEW
  pdf.sectionHeading('GRADE OVERVIEW');
  const labelW = 130;
  const badgeW = 32;
  const barTrackW = colW - labelW - badgeW - 12;
  const barH = 14;

  for (const s of sortedByMark) {
    pdf.ensureSpace(barH + 6);
    const rowY = pdf.cursorY - barH;

    const nameText = s.name.length > 22 ? s.name.slice(0, 21) + '.' : s.name;
    pdf.text(nameText, pdf.marginX, rowY + 4, { size: 9.5, color: t.text });

    const trackX = pdf.marginX + labelW;
    pdf.roundedRect(trackX, rowY, barTrackW, barH, barH / 2, t.card, {
      stroke: t.border, strokeW: 0.4
    });

    const fillW = Math.max(barH, (Math.max(2, s.mark) / 100) * barTrackW);
    const [c1, c2] = priorityGradient(t, s.colorClass);
    pdf.linearGradientRect(trackX, rowY, fillW, barH, c1, c2, 40);

    const pctX = trackX + fillW - 26;
    pdf.text(`${s.mark}%`, pctX, rowY + 4, {
      size: 7.5, bold: true, color: '#ffffff'
    });

    const bx = pdf.marginX + labelW + barTrackW + 6;
    pdf.roundedRect(bx, rowY, badgeW, barH, 4,
      tint(priorityColor(t, s.colorClass), 0.22),
      { stroke: priorityColor(t, s.colorClass), strokeW: 0.4 }
    );
    pdf.centeredText(s.grade, bx, badgeW, rowY + 4, {
      size: 8, bold: true, color: priorityColor(t, s.colorClass)
    });

    pdf.cursorY -= barH + 5;
  }
  pdf.spacer(8);

  // WEEKLY STUDY PLAN
  pdf.sectionHeading('WEEKLY STUDY PLAN');
  if (rotation === 'rotating') {
    pdf.paragraph(
      `Subjects rotate — max ${weekdaySubjects} per weekday, ${saturdaySubjects} on Saturday. ` +
      `Sessions capped at ${MAX_SESSION_MINUTES} min with ${BREAK_MINUTES}-min breaks.`,
      { size: 8.5, color: t.subtext, gap: 8 }
    );
  }

  const planCols = [148, 42, 78, 54, 76, 66];
  pdf.ensureSpace(20);
  const headerY = pdf.cursorY - 10;
  let px = pdf.marginX;
  const headerLabels = ['SUBJECT', 'GRADE', 'PRIORITY', 'SESSIONS', 'PER SESSION', 'WEEKLY'];
  for (let i = 0; i < headerLabels.length; i++) {
    pdf.text(headerLabels[i], px, headerY, { size: 7.5, bold: true, color: t.muted });
    px += planCols[i];
  }
  pdf.cursorY = headerY - 6;
  pdf.hr();
  pdf.spacer(2);

  for (let idx = 0; idx < subjectData.length; idx++) {
    const s = subjectData[idx];
    pdf.ensureSpace(20);
    const rowH = 18;
    const rowY = pdf.cursorY - rowH;

    if (idx % 2 === 0) {
      pdf.rect(pdf.marginX - 4, rowY + 1, colW + 8, rowH - 2, tint(t.card, 0.7));
    }

    const sessions = sessionCount[s.name] || 0;
    const perSess  = dailyPerSubject[s.name] || 0;
    const weekly   = weeklyPerSubject[s.name] || 0;

    let rx = pdf.marginX;
    const baseline = rowY + 6;

    pdf.text(s.name.length > 22 ? s.name.slice(0, 21) + '.' : s.name,
             rx, baseline, { size: 9.5, bold: true, color: t.text });
    rx += planCols[0];

    pdf.text(`${s.mark}%`, rx, baseline, { size: 9.5, color: t.text });
    rx += planCols[1];

    const chipText = s.level;
    const chipTextW = pdf.measure(chipText, 7.5, true);
    const chipWid = chipTextW + 12;
    pdf.roundedRect(rx, baseline - 3, chipWid, 12, 6,
      tint(priorityColor(t, s.colorClass), 0.22),
      { stroke: priorityColor(t, s.colorClass), strokeW: 0.4 }
    );
    pdf.text(chipText, rx + 6, baseline + 0.5, {
      size: 7.5, bold: true, color: priorityColor(t, s.colorClass)
    });
    rx += planCols[2];

    pdf.text(`${sessions}x`, rx, baseline, { size: 9.5, color: t.text });
    rx += planCols[3];

    pdf.text(formatMinutes(perSess), rx, baseline, {
      size: 9.5, bold: true, color: t.accent
    });
    rx += planCols[4];

    pdf.text(formatMinutes(weekly), rx, baseline, {
      size: 9.5, bold: true, color: t.heading
    });

    pdf.cursorY = rowY - 1;
  }
  pdf.spacer(10);

  // DAILY TIMETABLE
  pdf.sectionHeading('DAILY TIMETABLE (MON-SAT)');
  pdf.paragraph(
    `Each session is capped at ${MAX_SESSION_MINUTES} min. ` +
    `${BREAK_MINUTES}-min breaks sit between subjects — evidence-based Pomodoro timing.`,
    { size: 8.5, color: t.subtext, gap: 8 }
  );

  const sessionH = 16;
  const sessionGapX = 5;
  const sessionGapY = 3;

  for (let d = 0; d < 6; d++) {
    const dayBlocks = schedule[d];
    const dayTotal = dayBlocks.reduce((s, b) => s + b.minutes, 0);
    const cap = capacities[d];
    const brk = (breakSummary && breakSummary[d]) || { breakMinutes: 0, longBreaks: 0 };
    const spare = (spareSummary && spareSummary[d]) || 0;

    pdf.ensureSpace(sessionH * 3 + 20);

    const dayY = pdf.cursorY - 10;
    pdf.text(dayNames[d].toUpperCase(), pdf.marginX, dayY, {
      size: 9.5, bold: true, color: t.heading
    });
    const totalLabel = `${formatMinutes(dayTotal + brk.breakMinutes + spare)} of ${formatMinutes(cap)}`;
    const totalW = pdf.measure(totalLabel, 8);
    pdf.text(totalLabel, pdf.marginX + colW - totalW, dayY, {
      size: 8, color: t.muted
    });
    pdf.cursorY = dayY - 4;

    if (dayBlocks.length === 0) {
      pdf.paragraph('Rest / Light review', {
        size: 9, color: t.muted, indent: 8, gap: 6
      });
    } else {
      let lineY = pdf.cursorY - sessionH;
      const lineStartX = pdf.marginX + 4;
      let cx = lineStartX;
      const maxX = pdf.marginX + colW - 4;

      for (let i = 0; i < dayBlocks.length; i++) {
        const block = dayBlocks[i];
        const chipText = `${block.subject} · ${formatMinutes(block.minutes)}`;
        const chipTextW = pdf.measure(chipText, 8);
        const chipWid = chipTextW + 14;

        if (cx + chipWid > maxX && cx > lineStartX) {
          cx = lineStartX;
          lineY -= sessionH + sessionGapY;
          pdf.ensureSpace(sessionH + 6);
        }

        pdf.roundedRect(cx, lineY, chipWid, sessionH, sessionH / 2,
          tint(priorityColor(t, block.colorClass), 0.18),
          { stroke: priorityColor(t, block.colorClass), strokeW: 0.4 }
        );
        pdf.text(chipText, cx + 7, lineY + sessionH / 2 - 3, {
          size: 8, color: priorityColor(t, block.colorClass)
        });

        cx += chipWid + sessionGapX;

        if (i < dayBlocks.length - 1) {
          const breakIsLong = brk.longBreaks > 0 && i === Math.floor(dayBlocks.length / 2) - 1;
          const breakLabel = breakIsLong
            ? `${LONG_BREAK_MINUTES}m break`
            : `${BREAK_MINUTES}m break`;
          const breakTextW = pdf.measure(breakLabel, 7.5);
          const breakWid = breakTextW + 14;

          if (cx + breakWid > maxX) {
            cx = lineStartX;
            lineY -= sessionH + sessionGapY;
            pdf.ensureSpace(sessionH + 6);
          }

          pdf.roundedRect(cx, lineY + 2, breakWid, sessionH - 4, (sessionH - 4) / 2,
            tint(t.success, 0.14),
            { stroke: t.success, strokeW: 0.4, dashed: true }
          );
          pdf.text(breakLabel, cx + 7, lineY + sessionH / 2 - 3, {
            size: 7.5, color: t.success
          });
          cx += breakWid + sessionGapX;
        }
      }

      if (spare > 0) {
        const spareLabel = `+ ${formatMinutes(spare)} spare`;
        const spareTextW = pdf.measure(spareLabel, 7.5);
        const spareWid = spareTextW + 14;
        if (cx + spareWid > maxX) {
          cx = lineStartX;
          lineY -= sessionH + sessionGapY;
          pdf.ensureSpace(sessionH + 6);
        }
        pdf.roundedRect(cx, lineY + 2, spareWid, sessionH - 4, (sessionH - 4) / 2,
          tint(t.muted, 0.14),
          { stroke: t.muted, strokeW: 0.4, dashed: true }
        );
        pdf.text(spareLabel, cx + 7, lineY + sessionH / 2 - 3, {
          size: 7.5, color: t.muted
        });
      }

      pdf.cursorY = lineY - 6;
    }
    pdf.spacer(2);
  }

  pdf.ensureSpace(20);
  const sunY = pdf.cursorY - 10;
  pdf.text('SUNDAY', pdf.marginX, sunY, { size: 9.5, bold: true, color: t.heading });
  pdf.cursorY = sunY - 4;
  pdf.paragraph('Rest day — sleep, light review, recharge.', {
    size: 9, color: t.muted, indent: 8, gap: 10
  });

  // RECOMMENDED TECHNIQUES
  pdf.sectionHeading('RECOMMENDED TECHNIQUES');
  const techList = sortedByMark.slice(0, 4);
  const colGap = 8;
  const cardW = (colW - colGap) / 2;

  for (let i = 0; i < techList.length; i += 2) {
    pdf.ensureSpace(72);
    const rowTop = pdf.cursorY;
    const cardH = 66;

    for (let j = 0; j < 2 && i + j < techList.length; j++) {
      const s = techList[i + j];
      const cx = pdf.marginX + j * (cardW + colGap);
      const cy = rowTop - cardH;

      pdf.roundedRect(cx, cy, cardW, cardH, 8, t.card, {
        stroke: t.border, strokeW: 0.5
      });

      pdf.text(`${s.name}  ${s.grade}`, cx + 10, cy + cardH - 14, {
        size: 10, bold: true, color: t.heading
      });

      const techniques = getTechniquesFor(s.name).slice(0, 3);
      for (let k = 0; k < techniques.length; k++) {
        const lineY = cy + cardH - 28 - k * 12;
        pdf.text('>', cx + 10, lineY, { size: 8, color: t.accent, font: 'F2' });
        let text = techniques[k];
        const maxTextW = cardW - 30;
        if (pdf.measure(text, 8.5) > maxTextW) {
          const maxChars = Math.floor(maxTextW / (8.5 * 0.52));
          text = text.slice(0, maxChars - 1) + '...';
        }
        pdf.text(text, cx + 20, lineY, { size: 8.5, color: t.subtext });
      }
    }

    pdf.cursorY = rowTop - cardH - 6;
  }
  pdf.spacer(6);

  // MOTIVATION BOOST
  pdf.sectionHeading('MOTIVATION BOOST');

  const weakSubj = sortedByMark[0];
  const strongSubj = sortedByMark[sortedByMark.length - 1];
  const weakLine    = `Your biggest growth area: ${weakSubj.name} (${weakSubj.mark}%).`;
  const strongLine  = `Your strongest weapon: ${strongSubj.name} (${strongSubj.mark}%).`;
  const weakLines   = pdf.wrap(weakLine, 9.5, colW - 24);
  const strongLines = pdf.wrap(strongLine, 9.5, colW - 24);
  const quoteLines  = quotes.map(q => pdf.wrap(`"${q}"`, 9, colW - 24));
  const totalQuoteLines = quoteLines.reduce((s, arr) => s + arr.length, 0);
  const boxH = 14 + weakLines.length * 12 + 6 + strongLines.length * 12 + 6
             + totalQuoteLines * 12 + quotes.length * 4 + 12;

  pdf.ensureSpace(boxH + 8);
  const boxTop = pdf.cursorY;
  const boxY = boxTop - boxH;

  pdf.roundedRect(pdf.marginX, boxY, colW, boxH, 10, t.card, {
    stroke: t.heading, strokeW: 0.7, dashed: true
  });

  let ty = boxTop - 16;
  for (const ln of weakLines) {
    pdf.text(ln, pdf.marginX + 12, ty, { size: 9.5, color: t.text });
    ty -= 12;
  }
  ty -= 4;
  for (const ln of strongLines) {
    pdf.text(ln, pdf.marginX + 12, ty, { size: 9.5, color: t.subtext });
    ty -= 12;
  }
  ty -= 4;
  for (let qi = 0; qi < quoteLines.length; qi++) {
    for (const ln of quoteLines[qi]) {
      pdf.text(ln, pdf.marginX + 12, ty, { size: 9, color: t.text });
      ty -= 12;
    }
    ty -= 4;
  }
  pdf.cursorY = boxY - 12;

  // RECOMMENDED REVISION ORDER
  pdf.sectionHeading('RECOMMENDED REVISION ORDER');
  pdf.ensureSpace(24);

  let rx = pdf.marginX;
  let ry = pdf.cursorY - 18;
  const maxX = pdf.marginX + colW;

  for (let i = 0; i < sortedByMark.length; i++) {
    const s = sortedByMark[i];
    const label = `${s.name} (${s.mark}%)`;
    const labelW = pdf.measure(label, 8.5, true);
    const chipWid = labelW + 16;

    if (rx + chipWid > maxX && rx > pdf.marginX) {
      rx = pdf.marginX;
      ry -= 22;
      pdf.ensureSpace(22);
    }

    pdf.roundedRect(rx, ry, chipWid, 16, 8,
      tint(priorityColor(t, s.colorClass), 0.20),
      { stroke: priorityColor(t, s.colorClass), strokeW: 0.4 }
    );
    pdf.text(label, rx + 8, ry + 5, {
      size: 8.5, bold: true, color: priorityColor(t, s.colorClass)
    });
    rx += chipWid;

    if (i < sortedByMark.length - 1) {
      pdf.text('->', rx + 3, ry + 5, { size: 9, color: t.muted });
      rx += 16;
    }
  }
  pdf.cursorY = ry - 12;

  // SYSTEM TIPS
  pdf.sectionHeading('SYSTEM TIPS (EVIDENCE-BASED)');
  const tips = [];
  tips.push(`Sessions are capped at ${MAX_SESSION_MINUTES} min — cognitive fatigue sets in beyond that.`);
  tips.push(`${BREAK_MINUTES}-min breaks between subjects follow the Pomodoro evidence (BMC 2025, N=5,270).`);
  tips.push(`30-45 min per subject matches the optimal learning/recall window (Buzan research).`);
  if (days <= 7)    tips.push('Final week: use past papers under timed conditions — closest to the real thing.');
  if (days <= 14)   tips.push('Focus on past papers — they reveal exam patterns.');
  if (avgMark < 50) tips.push("Start with the basics. Don't skip foundational topics.");
  if (subjectData.length >= 5 && rotation === 'rotating')
    tips.push(`With ${subjectData.length} subjects, the rotation keeps each day focused.`);
  tips.push("Review each session's material within 24 hours for best retention (spaced repetition).");
  if (days > 30)    tips.push('You have time — explore active recall and spaced repetition apps.');
  tips.push('Sleep 7-8 hours. Your brain consolidates memory during sleep.');

  for (const tip of tips) {
    pdf.bullet(tip, { size: 9, color: t.subtext });
  }

  // Footer
  pdf.spacer(8);
  pdf.hr();
  pdf.paragraphCentered(
    'Generated by Study Dojo System v3.6 — offline PDF export',
    { size: 8, color: t.muted, gap: 0 }
  );

  return pdf.build();
}

// ==============================================================
// 24. SAVE AS PDF
// ==============================================================
function saveAsPDF() {
  if (!lastAnalysis) {
    showToast('Run the analysis first!', 'warning');
    return;
  }
  try {
    const bytes = renderPDF(lastAnalysis);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-dojo-plan-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    announce('PDF saved.');
    showToast('PDF saved!', 'success');
  } catch (err) {
    console.error('[Study Dojo] PDF generation failed:', err);
    showToast('PDF generation failed. Try TXT export.', 'error');
  }
}

// ==============================================================
// 25. EXPORT TXT
// ==============================================================
function exportTXT() {
  if (!lastAnalysis) {
    showToast('Run the analysis first!', 'warning');
    return;
  }
  const text = resultsDiv.innerText;
  const header = 'STUDY DOJO - ANALYSIS REPORT\n' + '='.repeat(52) + '\n\n';
  const footer = '\n\nGenerated by Study Dojo System v3.6\n';
  const blob = new Blob([header + text + footer], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `study-dojo-plan-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast('Plan exported!', 'success');
}

// ==============================================================
// 26. EVENT WIRING
// ==============================================================
studyForm.addEventListener('submit', analyze);
document.getElementById('clearBtn').addEventListener('click', clearAll);
document.getElementById('pdfBtn').addEventListener('click', saveAsPDF);
document.getElementById('exportBtn').addEventListener('click', exportTXT);

historyBtn.addEventListener('click', toggleHistoryPanel);
closeHistoryBtn.addEventListener('click', closeHistoryPanel);

clearHistoryBtn.addEventListener('click', async () => {
  const ok = await confirmDialog(
    'Clear all analysis history? This cannot be undone.',
    { confirmLabel: 'Clear', danger: true }
  );
  if (!ok) return;
  store.remove(HISTORY_KEY);
  renderHistory();
  showToast('History cleared', 'info');
});

// ==============================================================
// 27. KEYBOARD SHORTCUTS
// ==============================================================
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (typeof studyForm.requestSubmit === 'function') {
      studyForm.requestSubmit();
    } else {
      studyForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    return;
  }
  if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
    e.preventDefault();
    toggleHistoryPanel();
    return;
  }
  if (e.key === 'Escape' && !historyPanel.hidden) {
    closeHistoryPanel();
  }
});

// ==============================================================
// 28. INIT
// ==============================================================
initTheme();
loadSavedData();
syncHistoryAria();

setTimeout(() => {
  showToast('System online. Ready, Hunter.', 'info', 2200);
  announce('Study Dojo system ready.');
}, 900);