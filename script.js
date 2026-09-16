// ==============================================================
// STUDY DOJO — SYSTEM v3.1
// ==============================================================
// Intelligent scheduling · Mon–Sat timetable (Sunday rest) ·
// offline colour-PDF generator · history · modal confirmations ·
// accessible focus + announcements · guarded localStorage.
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
const SATURDAY_BOOST = 1.5;   // Saturday gets 1.5× the weekday rate

// Six study days. Sunday is intentionally excluded — it's rest day.
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ==============================================================
// 2. GUARDED STORAGE WRAPPER
// --------------------------------------------------------------
// Safari private mode and quota limits can throw on setItem.
// Every read/write goes through here so the UI never breaks.
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
// 3. DOM REFERENCES (queried once)
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

// Populated in buildSubjectGrid() — cached so we never re-query in a loop.
let subjectInputs = [];
let gradeInputs   = [];

// Holds the most recent analysis so PDF export can rebuild it on demand.
let lastAnalysis = null;

// ==============================================================
// 4. UTILITIES
// ==============================================================

/** Escape a string for safe HTML injection. */
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Format a minute count as "1h 30m" / "45m" / "2h". */
function formatMinutes(min) {
  if (!Number.isFinite(min) || min <= 0) return '0m';
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Convert "#rrggbb" to a PDF-friendly "r g b" (0–1 floats). */
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

/** Title-case a subject name while preserving all-caps acronyms. */
function titleCase(str) {
  return String(str).split(/\s+/).map(w => {
    if (!w) return w;
    if (w === w.toUpperCase() && w.length <= 4) return w; // keep "ICT", "PE"
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

/** Announce a short message to screen readers via the live region. */
function announce(msg) {
  if (!srStatus) return;
  // Clearing first guarantees the SR re-announces even if the text repeats.
  srStatus.textContent = '';
  setTimeout(() => { srStatus.textContent = msg; }, 30);
}

// ==============================================================
// 5. LOADING SCREEN
// --------------------------------------------------------------
// Dismissed on `load`, but a 4 s failsafe also clears it so a
// stalled font request can never lock the UI behind z-index 9999.
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
// 6. TOAST NOTIFICATIONS (max 3 visible)
// ==============================================================
function showToast(message, type = 'info', duration = 3000) {
  // Enforce cap by evicting the oldest toast.
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
// 7. MODAL CONFIRMATION DIALOG
// --------------------------------------------------------------
// Promise-based replacement for window.confirm() with focus
// trapping, Escape-to-cancel, and click-outside-to-cancel.
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
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Tab') {
        // Two-element focus loop.
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
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}

// ==============================================================
// 8. THEME TOGGLE
// ==============================================================
function initTheme() {
  const saved = store.get(`${STORAGE_PREFIX}theme`);
  // Default to the OS preference when the user hasn't chosen yet.
  const prefersLight = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
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
  const sun = document.querySelector('.icon-sun');
  const moon = document.querySelector('.icon-moon');
  if (sun)  sun.style.display  = isDark ? 'none'  : 'block';
  if (moon) moon.style.display = isDark ? 'block' : 'none';

  // aria-pressed = true means the button's "on" state is active (dark mode).
  themeToggleBtn.setAttribute('aria-pressed', String(isDark));
  themeToggleBtn.setAttribute('aria-label', isDark
    ? 'Switch to light theme'
    : 'Switch to dark theme');
}

themeToggleBtn.addEventListener('click', toggleTheme);

// ==============================================================
// 9. SUBJECT AUTO-CORRECT (rewritten)
// --------------------------------------------------------------
// The old version truncated "English Literature" → "English"
// because it matched any prefix. The new version is guarded:
// it never shortens a name the user typed, only expands short
// abbreviations and fixes typos within a similar length window.
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
  'bus': 'Business Studies', 'business': 'Business Studies', 'business studies': 'Business Studies',
  'eco': 'Economics', 'economics': 'Economics',
  'acc': 'Accounting', 'accounting': 'Accounting',
  'art': 'Art', 'art & design': 'Art & Design',
  'music': 'Music', 'pe': 'Physical Education', 'physical education': 'Physical Education',
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

// Distinct canonical names, lowercased — used to detect that the user
// already typed something we recognise but with different casing.
const CANONICAL_LOWER = new Set(
  Object.values(corrections).map(v => v.toLowerCase())
);

/** Standard Levenshtein edit distance. */
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

/**
 * Suggest a canonical subject name. Never shortens what the user typed —
 * only expands abbreviations or fixes typos within a length window.
 */
function autoCorrectSubject(raw) {
  const name = String(raw).trim().replace(/\s+/g, ' ');
  if (!name) return '';
  const lower = name.toLowerCase();

  // 1. Exact match against the correction map (e.g. "chem" → "Chemistry").
  if (corrections[lower]) return corrections[lower];

  // 2. User typed a full canonical name already — normalise its casing.
  if (CANONICAL_LOWER.has(lower)) {
    return Object.values(corrections).find(v => v.toLowerCase() === lower) || name;
  }

  // 3. User typed a longer name that STARTS with a canonical name
  //    ("English Literature", "Physics HL"). Leave it alone; just tidy case.
  for (const canon of CANONICAL_LOWER) {
    if (lower.startsWith(canon + ' ')) return titleCase(name);
  }

  // 4. Short abbreviation (3–6 chars) — expand only if a key matches.
  if (lower.length >= 3 && lower.length <= 6) {
    for (const [key, value] of Object.entries(corrections)) {
      if (key === lower) return value;
    }
  }

  // 5. Fuzzy match — only against keys of a similar length so we never
  //    replace a long custom name with a short common one.
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

  // 6. Fallback — just tidy capitalisation.
  return titleCase(name);
}

// ==============================================================
// 10. MOTIVATION QUOTES (deduped at module load)
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

// Set dedupes automatically; spread restores array semantics.
const motivationQuotes = [...new Set(rawQuotes)];

function getRandomQuotes(n = 3) {
  // Fisher–Yates partial shuffle — unbiased and cheap.
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
// 12. BUILD SUBJECT GRID + INLINE SUGGESTION CHIPS
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

// Input handler: debounced counter + inline suggestion chip.
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

// Click handler: accept suggestion OR clear slot.
subjectGrid.addEventListener('click', (e) => {
  // 1. Accept suggestion
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

  // 2. Clear slot
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

// Keydown: accept suggestion on Tab.
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
  // Let Tab proceed naturally — do NOT preventDefault.
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
  if (d === 0)       { examHint.textContent = 'Exam is TODAY! Maximum focus!';         examHint.className = 'exam-hint urgent'; }
  else if (d <= 3)   { examHint.textContent = `${d} days — ULTRA URGENT`;             examHint.className = 'exam-hint urgent'; }
  else if (d <= 7)   { examHint.textContent = `${d} days — Critical week`;            examHint.className = 'exam-hint warning'; }
  else if (d <= 14)  { examHint.textContent = `${d} days — Two weeks, build habits`;  examHint.className = 'exam-hint caution'; }
  else if (d <= 30)  { examHint.textContent = `${d} days — About a month, good time`; examHint.className = 'exam-hint normal'; }
  else               { examHint.textContent = `${d} days — Plenty of time, build foundations`; examHint.className = 'exam-hint relaxed'; }
}

function updateWeeklyCapacity() {
  const h = parseFloat(hoursPerDayInput.value);
  if (isNaN(h) || h < 0.5) {
    weeklyCapacityEl.textContent = 'Enter hours to see weekly capacity.';
    hoursHint.textContent = 'Mon–Fri at this rate · Saturday +50%';
    hoursHint.className = 'exam-hint';
    return;
  }

  const base = h * 60;                             // minutes per weekday
  const sat  = base * SATURDAY_BOOST;              // Saturday bonus
  const weeklyHours = ((base * 5) + sat) / 60;     // Mon–Fri + Sat

  weeklyCapacityEl.textContent =
    `Estimated weekly capacity: ${weeklyHours.toFixed(1)} hours · Sunday is a rest day.`;

  // Live feedback on the hint line
  if (h > 10) {
    hoursHint.textContent = 'Intense schedule — remember to rest.';
    hoursHint.className = 'exam-hint warning';
  } else if (h < 1) {
    hoursHint.textContent = 'Very light — results may be slow.';
    hoursHint.className = 'exam-hint caution';
  } else {
    hoursHint.textContent = 'Mon–Fri at this rate · Saturday +50%';
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
// 15. SCHEDULER — Mon → Sat, Sunday rest
// --------------------------------------------------------------
// Capacities: Mon–Fri at base rate; Saturday at 1.5×. Sunday is
// deliberately excluded from the timetable.
// ==============================================================
const PRIORITY_ORDER = {
  'priority-critical': 0,
  'priority-high':     1,
  'priority-medium':   2,
  'priority-low':      3
};

function generateWeeklySchedule(subjects, days, hoursPerDay) {
  const subjectData = Object.entries(subjects).map(([name, mark]) => ({
    name, mark, ...getPriority(mark, days)
  }));

  const baseMinutes = Math.round(hoursPerDay * 60);
  const satMinutes  = Math.round(baseMinutes * SATURDAY_BOOST);
  const capacities  = [
    baseMinutes, baseMinutes, baseMinutes, baseMinutes, baseMinutes,
    satMinutes
  ];

  const totalWeeklyDemand = subjectData.reduce((s, d) => s + d.weeklyMinutes, 0);
  const totalCapacity     = capacities.reduce((a, b) => a + b, 0);

  // If we can't fit the ideal load, scale proportionally. This keeps the
  // plan realistic instead of silently dropping minutes.
  const scale = totalWeeklyDemand > totalCapacity
    ? totalCapacity / totalWeeklyDemand
    : 1;

  // Queue subjects by priority (hardest first).
  const queue = [...subjectData]
    .sort((a, b) => b.urgency - a.urgency || a.mark - b.mark)
    .map(s => ({
      name:       s.name,
      grade:      s.grade,
      level:      s.level,
      colorClass: s.colorClass,
      urgency:    s.urgency,
      target:     Math.max(20, Math.round(s.weeklyMinutes * scale))
    }));

  const schedule = Array.from({ length: 6 }, () => []);
  const dayLoad  = capacities.map(() => 0);

  // Spread each subject across 2–6 days in roughly equal chunks.
  queue.forEach((subj, idx) => {
    const spreadDays = Math.min(6, Math.max(2, Math.ceil(subj.target / 60)));
    const chunk = Math.round(subj.target / spreadDays);
    let remaining = subj.target;
    const startDay = idx % 6;

    for (let i = 0; i < spreadDays && remaining > 0; i++) {
      const dayIdx = (startDay + i) % 6;
      const free = capacities[dayIdx] - dayLoad[dayIdx];
      if (free < 15) continue;
      const alloc = Math.min(free, remaining, chunk);
      if (alloc < 10) continue;

      schedule[dayIdx].push({
        subject:    subj.name,
        minutes:    alloc,
        level:      subj.level,
        colorClass: subj.colorClass,
        urgency:    subj.urgency
      });
      dayLoad[dayIdx] += alloc;
      remaining -= alloc;
    }

    // Overflow pass: any leftover target goes wherever there's space.
    if (remaining > 0) {
      for (let d = 0; d < 6 && remaining > 0; d++) {
        const free = capacities[d] - dayLoad[d];
        if (free < 10) continue;
        const alloc = Math.min(free, remaining);
        const existing = schedule[d].find(b => b.subject === subj.name);
        if (existing) {
          existing.minutes += alloc;
        } else {
          schedule[d].push({
            subject:    subj.name,
            minutes:    alloc,
            level:      subj.level,
            colorClass: subj.colorClass,
            urgency:    subj.urgency
          });
        }
        dayLoad[d] += alloc;
        remaining -= alloc;
      }
    }
  });

  // Sort each day by urgency so the hardest work leads the list.
  for (const day of schedule) {
    day.sort((a, b) =>
      (PRIORITY_ORDER[a.colorClass] ?? 9) - (PRIORITY_ORDER[b.colorClass] ?? 9)
    );
  }

  const scheduled = schedule.flat().reduce((s, b) => s + b.minutes, 0);

  return {
    schedule,
    dayNames: DAY_NAMES,
    capacities,
    totalWeeklyDemand,
    totalCapacity,
    scheduled,
    shortfall: Math.max(0, totalWeeklyDemand - scheduled),
    scaled: scale < 1
  };
}

// ==============================================================
// 16. ANALYZER — validate, then render
// ==============================================================
function analyze(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  // Clear stale errors
  for (let i = 1; i <= SUBJECT_SLOTS; i++) clearFieldError(i);
  daysInput.classList.remove('input-error');
  hoursPerDayInput.classList.remove('input-error');

  // --- Days ---
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

  // --- Hours per day ---
  const hoursPerDay = parseFloat(hoursPerDayInput.value);
  if (isNaN(hoursPerDay) || hoursPerDay < 0.5 || hoursPerDay > 16) {
    showToast('Hours per day must be between 0.5 and 16', 'error');
    hoursPerDayInput.classList.add('input-error');
    hoursPerDayInput.focus();
    return;
  }

  // --- Name ---
  const name = nameInput.value.trim() || 'Hunter';

  // --- Subjects ---
  const subjects = {};
  const errors = [];
  const seen = new Set();

  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    const subjInput  = subjectInputs[i - 1];
    const gradeInput = gradeInputs[i - 1];
    let subjectName = subjInput.value.trim();
    const gradeRaw  = gradeInput.value.trim();

    // Canonicalise on submit — new auto-correct is safe (never truncates).
    if (subjectName) {
      const corrected = autoCorrectSubject(subjectName);
      if (corrected && corrected !== subjectName) {
        subjInput.value = corrected;
        subjectName = corrected;
      }
    }

    // Pair-completeness checks
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

    // Grade bounds
    const grade = Number(gradeRaw);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      errors.push({ slot: i, field: 'grade' });
      document.getElementById(`err-grade-${i}`).textContent = 'Must be 0–100';
      gradeInput.classList.add('input-error');
      continue;
    }

    // Duplicate detection
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

  // Block analysis when anything is broken — do not show a misleading plan.
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

  // Persist the current form
  saveCurrentData(name, days, hoursPerDay);

  // Brief loading state
  resultsDiv.classList.add('results-loading');
  setTimeout(() => {
    renderResults(name, days, hoursPerDay, subjects);
    resultsDiv.classList.remove('results-loading');
  }, 250);
}

// ==============================================================
// 17. RESULTS RENDERER (HTML)
// ==============================================================
function renderResults(name, days, hoursPerDay, subjects) {
  const subjectData = Object.entries(subjects).map(([n, mark]) => ({
    name: n, mark, ...getPriority(mark, days)
  }));

  const totalWeekly = subjectData.reduce((s, d) => s + d.weeklyMinutes, 0);
  const avgMark = Math.round(
    subjectData.reduce((s, d) => s + d.mark, 0) / subjectData.length
  );
  const sortedByMark = [...subjectData].sort((a, b) => a.mark - b.mark);
  const weakest  = sortedByMark[0];
  const strongest = sortedByMark[sortedByMark.length - 1];
  const quotes = getRandomQuotes(3);

  const scheduleResult = generateWeeklySchedule(subjects, days, hoursPerDay);
  const {
    schedule, capacities, totalCapacity, shortfall, scaled
  } = scheduleResult;

  // Urgency message
  let urgencyMsg, urgencyClass;
  if (days === 0)      { urgencyMsg = 'EXAM IS TODAY! Final sprint — focus on key formulas and summaries.'; urgencyClass = 'critical'; }
  else if (days <= 3)  { urgencyMsg = 'ULTRA URGENT: Focus on weakest subjects and key concepts.';            urgencyClass = 'critical'; }
  else if (days <= 7)  { urgencyMsg = 'One week left. Prioritise high-impact revision on weak areas.';        urgencyClass = 'high'; }
  else if (days <= 14) { urgencyMsg = 'Two weeks — build a daily revision habit. Stay consistent.';           urgencyClass = 'medium'; }
  else if (days <= 30) { urgencyMsg = 'About a month. Perfect time for a structured weekly schedule.';        urgencyClass = 'normal'; }
  else if (days <= 60) { urgencyMsg = 'Good time buffer. Build strong foundations and practice regularly.';   urgencyClass = 'normal'; }
  else                 { urgencyMsg = 'Plenty of time. Master each topic deeply — a great advantage.';        urgencyClass = 'relaxed'; }

  let html = '';

  // ---- Header ----
  html += `<div class="result-header">`;
  html += `<h2>HELLO, ${escHtml(name.toUpperCase())}!</h2>`;
  html += `<div class="result-stats">`;
  html += `<div class="stat-chip"><span class="stat-value">${subjectData.length}</span><span class="stat-label">Subjects</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${avgMark}%</span><span class="stat-label">Average</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${formatMinutes(totalWeekly)}</span><span class="stat-label">/week</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${days}</span><span class="stat-label">days left</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${hoursPerDay}h</span><span class="stat-label">/day</span></div>`;
  html += `</div></div>`;

  // ---- Urgency banner ----
  const urgencyIcon = days <= 3 ? '⚠️' : days <= 14 ? '📅' : '✅';
  html += `<div class="urgency-banner urgency-${urgencyClass}">`
        + `<span class="urgency-icon" aria-hidden="true">${urgencyIcon}</span> `
        + `<span>${escHtml(urgencyMsg)}</span></div>`;

  // ---- Shortfall warning ----
  if (shortfall > 0) {
    const message = scaled
      ? `Your ideal weekly load (${formatMinutes(totalWeekly)}) exceeds what fits in your schedule (${formatMinutes(totalCapacity)}). The plan has been scaled to match — trim low-priority subjects to free up time.`
      : `We couldn't fit ${formatMinutes(shortfall)} of your ideal plan. Increase hours or trim low-priority subjects.`;
    html += `<div class="urgency-banner urgency-high">
      <span class="urgency-icon" aria-hidden="true">⚠️</span>
      <span>${escHtml(message)}</span>
    </div>`;
  }

  // ---- Grade overview ----
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

  // ---- Weekly plan table ----
  const byPriority = [...subjectData].sort(
    (a, b) => b.urgency - a.urgency || a.mark - b.mark
  );
  html += `<h3>WEEKLY STUDY PLAN</h3>`;
  html += `<div class="plan-table-wrap"><table class="plan-table">
    <thead><tr>
      <th>Subject</th><th>Grade</th><th>Priority</th><th>Weekly</th><th>Sessions</th>
    </tr></thead><tbody>`;
  for (const s of byPriority) {
    html += `<tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${s.mark}%</td>
      <td><span class="${s.colorClass} badge">${s.level}</span></td>
      <td><strong>${formatMinutes(s.weeklyMinutes)}</strong></td>
      <td>${s.pomodoroSessions} × 25min</td>
    </tr>`;
  }
  html += `</tbody></table></div>`;

  // ---- Daily timetable (Mon–Sat) ----
  html += `<h3>DAILY TIMETABLE (MON–SAT)</h3>`;
  html += `<div class="timetable-wrap"><table class="timetable">
    <thead><tr><th>Day</th><th>Subjects &amp; Sessions</th><th>Total</th></tr></thead><tbody>`;
  for (let d = 0; d < 6; d++) {
    const dayItems = schedule[d];
    const dayTotal = dayItems.reduce((s, b) => s + b.minutes, 0);
    const cap = capacities[d];

    html += `<tr><td class="day-name">${DAY_NAMES[d]}</td><td class="day-sessions">`;
    if (dayItems.length === 0) {
      html += `<span class="rest-day">Rest / Light review</span>`;
    } else {
      html += dayItems.map(item =>
        `<span class="session-chip ${item.colorClass}">${escHtml(item.subject)} · ${formatMinutes(item.minutes)}</span>`
      ).join('');
    }
    html += `</td><td class="day-total">${formatMinutes(dayTotal)}<br><small style="font-weight:400;color:var(--text-muted)">of ${formatMinutes(cap)}</small></td></tr>`;
  }
  // Sunday rest row
  html += `<tr><td class="day-name">Sunday</td><td class="day-sessions">`
        + `<span class="rest-day">Rest day — sleep, light review, recharge.</span>`
        + `</td><td class="day-total">0m</td></tr>`;
  html += `</tbody></table></div>`;

  // ---- Techniques ----
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

  // ---- Motivation ----
  html += `<div class="motivation-block">
    <h3>MOTIVATION BOOST</h3>
    <p class="weak-link">Your biggest growth area: <strong>${escHtml(weakest.name)}</strong> (${weakest.mark}%). That's where the most points are waiting!</p>
    <p class="strong-link">Your strongest weapon: <strong>${escHtml(strongest.name)}</strong> (${strongest.mark}%). Keep it sharp!</p>`;
  const markers = ['🔴', '🔥', '🌟'];
  html += quotes.map((q, i) =>
    `<p class="quote"><span class="quote-marker">${markers[i]}</span> <em>"${escHtml(q)}"</em></p>`
  ).join('');
  html += `</div>`;

  // ---- Revision order ----
  html += `<div class="revision-order">
    <h3>RECOMMENDED REVISION ORDER</h3>
    <p>${sortedByMark.map(s =>
      `<span class="order-chip ${s.colorClass}">${escHtml(s.name)} (${s.mark}%)</span>`
    ).join(' → ')}</p>
  </div>`;

  // ---- Tips ----
  html += `<div class="tips-block"><h3>SYSTEM TIPS</h3><ul>`;
  if (days <= 7)       html += `<li>Use the Pomodoro technique: 25 min focused + 5 min break.</li>`;
  if (days <= 14)      html += `<li>Focus on past papers — they reveal exam patterns.</li>`;
  if (avgMark < 50)    html += `<li>Start with the basics. Don't skip foundational topics.</li>`;
  if (subjectData.length >= 6) html += `<li>With ${subjectData.length} subjects, cluster similar ones on the same day.</li>`;
  html += `<li>Review each session's material within 24 hours for best retention.</li>`;
  if (days > 30)       html += `<li>You have time — explore active recall and spaced repetition apps.</li>`;
  if (shortfall > 0)   html += `<li>Consider trimming a low-priority subject to close the shortfall.</li>`;
  html += `<li>Sleep 7–8 hours. Your brain consolidates memory during sleep.</li>`;
  html += `</ul></div>`;

  resultsDiv.innerHTML = html;
  resultsDiv.classList.add('has-results');
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Cache analysis for PDF export
  lastAnalysis = {
    name, days, hoursPerDay,
    subjects: { ...subjects },
    subjectData: byPriority,
    sortedByMark,
    avgMark,
    totalWeekly,
    weakest,
    strongest,
    quotes,
    schedule,
    dayNames: DAY_NAMES,
    capacities,
    totalCapacity,
    shortfall,
    scaled,
    urgencyMsg,
    urgencyClass
  };

  saveToHistory(name, days, hoursPerDay, subjects, avgMark, totalWeekly);

  // Announce completion (terse — the panel itself is aria-live="polite").
  announce(`Analysis complete. Plan for ${subjectData.length} subjects ready.`);
  showToast('Analysis complete!', 'success');
}

// ==============================================================
// 18. LOCAL STORAGE — current form
// ==============================================================
function saveCurrentData(name, days, hoursPerDay) {
  store.set(`${STORAGE_PREFIX}name`, name);
  store.set(`${STORAGE_PREFIX}days`, days);
  store.set(`${STORAGE_PREFIX}hoursPerDay`, hoursPerDay);
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

function saveToHistory(name, days, hoursPerDay, subjects, avg, totalMin) {
  const history = getHistory();
  history.unshift({
    date: new Date().toISOString(),
    name, days, hoursPerDay,
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

    return `<div class="history-item" data-index="${i}"
                 role="button" tabindex="0"
                 aria-label="Restore ${escHtml(h.name || 'plan')} from ${dateStr}">
      <div class="history-meta">
        <span class="history-date">${dateStr} ${timeStr}</span>
        <span class="history-avg ${avgClass}">${h.average}%</span>
      </div>
      <div class="history-subjects">${escHtml(subjectNames)}</div>
      <div class="history-details">${h.count} subjects · ${formatMinutes(h.totalWeekly)}/week · ${h.days} days${hoursNote}</div>
    </div>`;
  }).join('');

  // Wire click + keyboard activation on each entry
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

  // Clear every slot first
  for (let i = 0; i < SUBJECT_SLOTS; i++) {
    subjectInputs[i].value = '';
    gradeInputs[i].value = '';
    clearFieldError(i + 1);
    const hint = subjectInputs[i].parentElement.querySelector('.field-hint');
    if (hint) { hint.classList.remove('show'); hint.textContent = ''; }
    subjectInputs[i].removeAttribute('data-suggestion');
  }

  // Refill from the snapshot
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

  // Re-run analysis so the results panel matches the restored form.
  analyze();
  showToast('History entry restored', 'info', 2000);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==============================================================
// 20. HISTORY PANEL OPEN/CLOSE + ARIA SYNC
// ==============================================================
function syncHistoryAria() {
  historyBtn.setAttribute('aria-expanded', String(!historyPanel.hidden));
}

function openHistoryPanel() {
  renderHistory();
  historyPanel.hidden = false;
  syncHistoryAria();
  // Move focus into the panel for keyboard users.
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
// 21. CLEAR ALL
// ==============================================================
async function clearAll() {
  const ok = await confirmDialog(
    'Reset the System? All saved data and the current results will be lost.',
    { confirmLabel: 'Reset', danger: true }
  );
  if (!ok) return;

  nameInput.value = '';
  daysInput.value = '';
  hoursPerDayInput.value = '3';

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

  // Wipe persisted state (keep theme and history — those are separate).
  store.remove(`${STORAGE_PREFIX}name`);
  store.remove(`${STORAGE_PREFIX}days`);
  store.remove(`${STORAGE_PREFIX}hoursPerDay`);
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    store.remove(`${STORAGE_PREFIX}subj_${i}`);
    store.remove(`${STORAGE_PREFIX}grade_${i}`);
  }

  showToast('System reset. Ready for a new journey.', 'info');
  announce('System reset.');
}

// ==============================================================
// 22. OFFLINE PDF GENERATOR
// --------------------------------------------------------------
// A from-scratch PDF 1.4 writer. No libraries, no network.
// Supports: custom page size, RGB colours, text (Helvetica),
// filled + stroked rectangles, horizontal rules, and multi-page
// content with automatic pagination.
// ==============================================================
const PDF_THEMES = {
  midnight: {
    pageBg:  '#0a0c18',
    card:    '#12142a',
    accent:  '#00f0ff',
    heading: '#d4af37',
    text:    '#d0dff0',
    subtext: '#8899bb',
    border:  '#1a1a2e',
    critical:'#ff2a75',
    high:    '#ff6b4a',
    medium:  '#d4af37',
    low:     '#00f0ff',
    success: '#2ecc71'
  },
  solar: {
    pageBg:  '#1a0f08',
    card:    '#2a1810',
    accent:  '#ff9f43',
    heading: '#ffd166',
    text:    '#fff5e6',
    subtext: '#c9a980',
    border:  '#3a2418',
    critical:'#ff5252',
    high:    '#ff8a3d',
    medium:  '#ffd166',
    low:     '#7ed6df',
    success: '#6ab04c'
  },
  forest: {
    pageBg:  '#0f1a12',
    card:    '#16241a',
    accent:  '#7bd389',
    heading: '#f2e9c7',
    text:    '#e6f2e6',
    subtext: '#8fa99a',
    border:  '#1e3325',
    critical:'#e5534b',
    high:    '#e8a250',
    medium:  '#d4c66b',
    low:     '#7bd389',
    success: '#7bd389'
  },
  mono: {
    pageBg:  '#ffffff',
    card:    '#f5f5f5',
    accent:  '#000000',
    heading: '#111111',
    text:    '#222222',
    subtext: '#555555',
    border:  '#cccccc',
    critical:'#000000',
    high:    '#333333',
    medium:  '#666666',
    low:     '#999999',
    success: '#000000'
  }
};

function priorityColor(theme, colorClass) {
  switch (colorClass) {
    case 'priority-critical': return theme.critical;
    case 'priority-high':     return theme.high;
    case 'priority-medium':   return theme.medium;
    case 'priority-low':      return theme.low;
    default:                  return theme.text;
  }
}

class OfflinePDF {
  constructor({ paper = 'a4', theme = 'midnight' } = {}) {
    const sizes = {
      a4:     [595.28, 841.89],
      letter: [612,    792]
    };
    const size = sizes[paper] || sizes.a4;

    this.pageW = size[0];
    this.pageH = size[1];
    this.marginX = 44;
    this.marginTop = 56;
    this.marginBottom = 48;

    this.theme = PDF_THEMES[theme] || PDF_THEMES.midnight;
    this.pages = [];   // finished content streams
    this.buf   = [];   // current page ops
    this.cursorY = 0;

    this.startPage();
  }

  /** Begin a new page (finishing the previous one if any). */
  startPage() {
    if (this.buf.length) this.pages.push(this.buf.join('\n'));
    this.buf = [];
    this.cursorY = this.pageH - this.marginTop;

    // Page background fill
    const [r, g, b] = hexToRgb01(this.theme.pageBg);
    this.buf.push(`${r} ${g} ${b} rg`);
    this.buf.push(`0 0 ${this.pageW.toFixed(2)} ${this.pageH.toFixed(2)} re f`);
  }

  /** Ensure `h` points of vertical space remain, else start a page. */
  ensureSpace(h) {
    if (this.cursorY - h < this.marginBottom) this.startPage();
  }

  /** Escape a string for the PDF text operator (ASCII-safe). */
  esc(str) {
    return String(str)
      // Smart punctuation → ASCII equivalents
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      // Strip anything still outside printable ASCII
      .replace(/[^\x20-\x7E]/g, '?')
      // Escape PDF delimiters
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  /** Draw text at (x, y) — y is the baseline. */
  text(str, x, y, { font = 'F1', size = 11, color = '#000000' } = {}) {
    const [r, g, b] = hexToRgb01(color);
    this.buf.push('BT');
    this.buf.push(`${r} ${g} ${b} rg`);
    this.buf.push(`/${font} ${size} Tf`);
    this.buf.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    this.buf.push(`(${this.esc(str)}) Tj`);
    this.buf.push('ET');
  }

  /** Fill a rectangle (optionally with a stroke border). */
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

  /** Approximate text width in PDF points. */
  measure(str, size, bold = false) {
    const factor = bold ? 0.575 : 0.52;
    return String(str).length * size * factor;
  }

  /** Wrap text into lines that fit within maxWidth. */
  wrap(str, size, maxWidth, bold = false) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (this.measure(test, size, bold) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Horizontal rule across the content area. */
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

  spacer(h = 8) { this.cursorY -= h; }

  /** Large coloured title with underline. */
  title(str) {
    this.ensureSpace(34);
    const size = 22;
    this.text(str, this.marginX, this.cursorY - size, {
      font: 'F2', size, color: this.theme.heading
    });
    this.cursorY -= size + 6;

    const [r, g, b] = hexToRgb01(this.theme.heading);
    this.buf.push(`${r} ${g} ${b} RG 1.4 w`);
    this.buf.push(
      `${this.marginX} ${this.cursorY.toFixed(2)} m ` +
      `${this.marginX + 90} ${this.cursorY.toFixed(2)} l S`
    );
    this.cursorY -= 14;
  }

  /** Cyan section heading. */
  heading(str) {
    this.ensureSpace(26);
    const size = 12;
    this.text(str.toUpperCase(), this.marginX, this.cursorY - size, {
      font: 'F2', size, color: this.theme.accent
    });
    this.cursorY -= size + 10;
  }

  /** Wrapped paragraph with configurable colour and indent. */
  paragraph(str, { size = 10.5, color = null, indent = 0, gap = 6, bold = false } = {}) {
    const c = color || this.theme.text;
    const maxW = this.pageW - this.marginX * 2 - indent;
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

  /** Single bullet point with wrapping for long lines. */
  bullet(str, { size = 10, color = null, indent = 12, gap = 3 } = {}) {
    const c = color || this.theme.subtext;
    const maxW = this.pageW - this.marginX * 2 - indent - 10;
    const lines = this.wrap(str, size, maxW);
    const lineH = size * 1.35;

    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(lineH);
      if (i === 0) {
        this.text('*', this.marginX + indent - 8, this.cursorY - size, {
          size, color: this.theme.accent
        });
      }
      this.text(lines[i], this.marginX + indent, this.cursorY - size, {
        size, color: c
      });
      this.cursorY -= lineH;
    }
    this.cursorY -= gap;
  }

  /** Serialise the whole PDF into a Uint8Array. */
  build() {
    if (this.buf.length) this.pages.push(this.buf.join('\n'));
    const totalPages = this.pages.length;

    // Object layout:
    //   1 → Catalog
    //   2 → Pages
    //   3 → Font Helvetica
    //   4 → Font Helvetica-Bold
    //   5.. → Page + content stream pairs
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

    // Serialise the PDF as a byte-string. Each JS char is one byte.
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

    // Convert to bytes (charCode & 0xff gives us the raw byte).
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) {
      bytes[i] = pdf.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}

// ==============================================================
// 23. PDF RENDERING — the plan
// ==============================================================
function renderPDF(state) {
  const {
    name, days, hoursPerDay, subjectData, sortedByMark, avgMark,
    totalWeekly, schedule, dayNames, capacities, totalCapacity,
    shortfall, scaled, quotes, urgencyMsg
  } = state;

  const pdf = new OfflinePDF({
    paper: pdfPaperSelect.value,
    theme: pdfThemeSelect.value
  });
  const t = pdf.theme;

  // ---- Header ----
  pdf.title('STUDY DOJO');
  pdf.paragraph(`Training Plan for ${name}`, {
    size: 14, color: t.heading, bold: true, gap: 2
  });
  pdf.paragraph(
    `${days} day${days === 1 ? '' : 's'} until exam  ·  ${hoursPerDay}h per weekday  ·  Saturday 1.5x bonus  ·  Sunday rest`,
    { size: 9.5, color: t.subtext, gap: 4 }
  );
  pdf.paragraph(
    `Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`,
    { size: 8.5, color: t.subtext, gap: 12 }
  );
  pdf.hr();

  // ---- At a glance (chips) ----
  pdf.heading('AT A GLANCE');
  pdf.ensureSpace(50);
  const statY = pdf.cursorY;
  const stats = [
    { v: String(subjectData.length), l: 'SUBJECTS' },
    { v: `${avgMark}%`,              l: 'AVERAGE' },
    { v: formatMinutes(totalWeekly), l: 'PER WEEK' },
    { v: `${days}`,                  l: 'DAYS LEFT' }
  ];
  const chipGap = 6;
  const chipW = (pdf.pageW - pdf.marginX * 2 - chipGap * (stats.length - 1)) / stats.length;
  const chipH = 40;
  let chipX = pdf.marginX;
  for (const s of stats) {
    pdf.rect(chipX, statY - chipH, chipW, chipH, t.card, { stroke: t.border });
    pdf.text(s.v, chipX + 10, statY - 20, { font: 'F2', size: 14, color: t.heading });
    pdf.text(s.l, chipX + 10, statY - 33, { size: 7.5, color: t.subtext });
    chipX += chipW + chipGap;
  }
  pdf.cursorY = statY - chipH - 12;

  // ---- Urgency ----
  pdf.paragraph(urgencyMsg, { size: 10, color: t.accent, gap: 10 });

  // ---- Shortfall banner ----
  if (shortfall > 0) {
    const msg = scaled
      ? `Weekly demand (${formatMinutes(totalWeekly)}) exceeds capacity (${formatMinutes(totalCapacity)}). Plan scaled to fit.`
      : `Shortfall of ${formatMinutes(shortfall)} — some sessions were trimmed to fit.`;
    pdf.ensureSpace(30);
    const y = pdf.cursorY;
    pdf.rect(pdf.marginX, y - 24, pdf.pageW - pdf.marginX * 2, 24, t.card, { stroke: t.high });
    pdf.text(msg, pdf.marginX + 10, y - 16, { size: 9, color: t.high, font: 'F2' });
    pdf.cursorY = y - 32;
  }

  // ---- Grade overview ----
  pdf.heading('GRADE OVERVIEW');
  for (const s of sortedByMark) {
    pdf.ensureSpace(18);
    const barY = pdf.cursorY - 12;
    const labelW = 120;
    const valueW = 34;
    const barW = pdf.pageW - pdf.marginX * 2 - labelW - valueW - 6;

    pdf.text(s.name.length > 22 ? s.name.slice(0, 21) + '.' : s.name,
             pdf.marginX, barY + 2, { size: 9, color: t.text });

    pdf.rect(pdf.marginX + labelW, barY, barW, 10, t.card);
    const w = Math.max(4, (s.mark / 100) * barW);
    pdf.rect(pdf.marginX + labelW, barY, w, 10, priorityColor(t, s.colorClass));

    pdf.text(`${s.mark}%`,
             pdf.marginX + labelW + barW + 6, barY + 2,
             { size: 8.5, color: t.subtext });

    pdf.cursorY -= 16;
  }
  pdf.spacer(8);

  // ---- Weekly plan table ----
  pdf.heading('WEEKLY STUDY PLAN');
  const colW = [175, 48, 82, 74, 88];
  const headers = ['SUBJECT', 'GRADE', 'PRIORITY', 'WEEKLY', 'SESSIONS'];

  pdf.ensureSpace(20);
  let hx = pdf.marginX;
  const headerY = pdf.cursorY;
  for (let i = 0; i < headers.length; i++) {
    pdf.text(headers[i], hx, headerY - 10, { font: 'F2', size: 8, color: t.subtext });
    hx += colW[i];
  }
  pdf.cursorY -= 14;
  pdf.hr();

  for (const s of subjectData) {
    pdf.ensureSpace(16);
    let cx = pdf.marginX;
    const rowY = pdf.cursorY;

    pdf.text(s.name.length > 24 ? s.name.slice(0, 23) + '.' : s.name,
             cx, rowY - 10, { size: 9.5, color: t.text, font: 'F2' });
    cx += colW[0];

    pdf.text(`${s.mark}%`, cx, rowY - 10, { size: 9.5, color: t.text });
    cx += colW[1];

    pdf.text(s.level, cx, rowY - 10, {
      size: 8.5, color: priorityColor(t, s.colorClass), font: 'F2'
    });
    cx += colW[2];

    pdf.text(formatMinutes(s.weeklyMinutes), cx, rowY - 10, {
      size: 9.5, color: t.heading, font: 'F2'
    });
    cx += colW[3];

    pdf.text(`${s.pomodoroSessions} x 25min`, cx, rowY - 10, {
      size: 8.5, color: t.subtext
    });

    pdf.cursorY -= 15;
  }
  pdf.spacer(8);

  // ---- Daily timetable (Mon–Sat) ----
  pdf.heading('DAILY TIMETABLE (MON-SAT)');
  for (let d = 0; d < 6; d++) {
    const day = schedule[d];
    const dayTotal = day.reduce((s, b) => s + b.minutes, 0);
    const cap = capacities[d];

    pdf.ensureSpace(24);
    pdf.text(dayNames[d].toUpperCase(),
             pdf.marginX, pdf.cursorY - 10,
             { font: 'F2', size: 10, color: t.heading });

    const totalLabel = `${formatMinutes(dayTotal)} of ${formatMinutes(cap)}`;
    pdf.text(totalLabel,
             pdf.pageW - pdf.marginX - 100, pdf.cursorY - 10,
             { size: 8.5, color: t.subtext });
    pdf.cursorY -= 15;

    if (day.length === 0) {
      pdf.text('Rest day', pdf.marginX + 12, pdf.cursorY - 9, { size: 9, color: t.subtext });
      pdf.cursorY -= 14;
    } else {
      for (const block of day) {
        pdf.ensureSpace(13);
        pdf.text('*', pdf.marginX + 4, pdf.cursorY - 9, { size: 10, color: t.accent });
        pdf.text(block.subject, pdf.marginX + 16, pdf.cursorY - 9, {
          size: 9.5, color: t.text
        });
        pdf.text(formatMinutes(block.minutes),
                 pdf.pageW - pdf.marginX - 40, pdf.cursorY - 9,
                 { size: 9, color: t.subtext });
        pdf.cursorY -= 12;
      }
    }
    pdf.cursorY -= 5;
  }
  pdf.spacer(4);
  pdf.paragraph('Sunday is a rest day - sleep, light review, recharge.',
                { size: 9.5, color: t.subtext, gap: 12 });

  // ---- Techniques ----
  pdf.heading('RECOMMENDED TECHNIQUES');
  for (const s of sortedByMark.slice(0, 4)) {
    pdf.ensureSpace(50);
    pdf.text(`${s.name}  (${s.grade}  ${s.mark}%)`,
             pdf.marginX, pdf.cursorY - 11,
             { font: 'F2', size: 10, color: t.heading });
    pdf.cursorY -= 15;

    const techniques = getTechniquesFor(s.name);
    for (const tech of techniques.slice(0, 3)) {
      pdf.bullet(tech, { size: 9, color: t.subtext });
    }
    pdf.cursorY -= 4;
  }

  // ---- Motivation ----
  pdf.heading('MOTIVATION');
  for (const q of quotes) {
    pdf.paragraph(`"${q}"`, { size: 9.5, color: t.text, indent: 8, gap: 4 });
  }

  pdf.spacer(12);
  pdf.hr();
  pdf.paragraph('Generated by Study Dojo System v3.1 - offline PDF export.',
                { size: 8, color: t.subtext, gap: 0 });

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

    // Give the browser a moment before revoking the object URL.
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
  const footer = '\n\nGenerated by Study Dojo System v3.1\n';

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
  // Ctrl+Enter (or Cmd+Enter on macOS) → submit analysis
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (typeof studyForm.requestSubmit === 'function') {
      studyForm.requestSubmit();
    } else {
      studyForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    return;
  }

  // Ctrl+Shift+H → toggle history
  if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
    e.preventDefault();
    toggleHistoryPanel();
    return;
  }

  // Escape → close history if open
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

// Welcome
setTimeout(() => {
  showToast('System online. Ready, Hunter.', 'info', 2200);
  announce('Study Dojo system ready.');
}, 900);