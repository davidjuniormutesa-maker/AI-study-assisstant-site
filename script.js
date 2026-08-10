// ======================================================
// STUDY DOJO - SYSTEM v3.0 LOGIC
// Intelligent scheduling, daily timetable, study techniques,
// history tracking, progress visualization, and more.
// ======================================================

// ===== CONSTANTS =====
const STORAGE_PREFIX = 'dojo_';
const HISTORY_KEY = `${STORAGE_PREFIX}history`;
const MAX_HISTORY = 20;
const SUBJECT_SLOTS = 8;
const MIN_SUBJECTS = 3;

// ===== DOM REFERENCES =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const nameInput = $('#name');
const daysInput = $('#days');
const resultsDiv = $('#results');
const subjectGrid = $('#subjectGrid');
const subjectCountEl = $('#subjectCount');
const counterFill = $('#counterFill');
const examHint = $('#examHint');
const studyForm = $('#studyForm');
const historyPanel = $('#historyPanel');
const historyList = $('#historyList');
const loadingScreen = $('#loadingScreen');
const toastContainer = $('#toastContainer');

// ===== LOADING SCREEN =====
window.addEventListener('load', () => {
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.remove(), 600);
  }, 800);
});

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info', duration = 3000) {
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

// ===== THEME TOGGLE =====
function initTheme() {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}theme`);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(`${STORAGE_PREFIX}theme`, next);
  updateThemeIcon();
  showToast(`Switched to ${next} mode`, 'info', 1500);
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelector('.icon-sun').style.display = isDark ? 'none' : 'block';
  document.querySelector('.icon-moon').style.display = isDark ? 'block' : 'none';
}

$('#themeToggle').addEventListener('click', toggleTheme);

// ===== BUILD SUBJECT SLOTS =====
function buildSubjectGrid() {
  subjectGrid.innerHTML = '';
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <div class="field-group">
        <label for="subject-${i}">Subject ${i}</label>
        <input type="text" id="subject-${i}" placeholder="e.g., Physics" data-subject autocomplete="off">
        <span class="field-error" id="err-subj-${i}"></span>
      </div>
      <div class="field-group">
        <label for="grade-${i}">Grade (0-100)</label>
        <input type="number" id="grade-${i}" min="0" max="100" placeholder="85" data-grade>
        <span class="field-error" id="err-grade-${i}"></span>
      </div>
      <button type="button" class="row-remove" data-slot="${i}" aria-label="Clear slot ${i}" title="Clear slot">&times;</button>
    `;
    subjectGrid.appendChild(row);
  }

  // Remove buttons
  subjectGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-remove');
    if (!btn) return;
    const slot = btn.dataset.slot;
    $(`#subject-${slot}`).value = '';
    $(`#grade-${slot}`).value = '';
    clearFieldError(slot);
    updateSubjectCounter();
  });
}

function clearFieldError(slot) {
  $(`#err-subj-${slot}`).textContent = '';
  $(`#err-grade-${slot}`).textContent = '';
  $(`#subject-${slot}`).classList.remove('input-error');
  $(`#grade-${slot}`).classList.remove('input-error');
}

function updateSubjectCounter() {
  let count = 0;
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    if ($(`#subject-${i}`).value.trim() && $(`#grade-${i}`).value.trim() !== '') count++;
  }
  subjectCountEl.textContent = count;
  const pct = (count / SUBJECT_SLOTS) * 100;
  counterFill.style.width = pct + '%';
  counterFill.className = 'counter-fill' + (count >= MIN_SUBJECTS ? ' ready' : '');
}

// Debounced counter update
let counterTimer;
subjectGrid.addEventListener('input', () => {
  clearTimeout(counterTimer);
  counterTimer = setTimeout(updateSubjectCounter, 200);
  // Live auto-correct preview
  const active = document.activeElement;
  if (active && active.dataset.subject) {
    const corrected = autoCorrectSubject(active.value);
    if (corrected !== active.value.trim()) {
      active.setAttribute('data-suggestion', corrected);
    } else {
      active.removeAttribute('data-suggestion');
    }
  }
});

buildSubjectGrid();

// ===== DAYS INPUT HINT =====
daysInput.addEventListener('input', () => {
  const d = parseInt(daysInput.value);
  if (isNaN(d) || d < 0) { examHint.textContent = 'Enter days remaining'; examHint.className = 'exam-hint'; return; }
  if (d === 0) { examHint.textContent = 'Exam is TODAY! Maximum focus!'; examHint.className = 'exam-hint urgent'; }
  else if (d <= 3) { examHint.textContent = `${d} days — ULTRA URGENT`; examHint.className = 'exam-hint urgent'; }
  else if (d <= 7) { examHint.textContent = `${d} days — Critical week`; examHint.className = 'exam-hint warning'; }
  else if (d <= 14) { examHint.textContent = `${d} days — Two weeks, build habits`; examHint.className = 'exam-hint caution'; }
  else if (d <= 30) { examHint.textContent = `${d} days — About a month, good time`; examHint.className = 'exam-hint normal'; }
  else { examHint.textContent = `${d} days — Plenty of time, build foundations`; examHint.className = 'exam-hint relaxed'; }
});

// ===== AUTO-CORRECT (fuzzy matching) =====
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
  'entre': 'Entrepreneurship', 'entrepreneurship': 'Entrepreneurship',
};

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
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
  const name = raw.trim();
  if (!name) return '';
  const lower = name.toLowerCase();

  // Exact match
  if (corrections[lower]) return corrections[lower];

  // Prefix match
  for (const [key, value] of Object.entries(corrections)) {
    if (lower.startsWith(key) && key.length >= 3) return value;
  }

  // Fuzzy match (Levenshtein distance)
  let bestMatch = null;
  let bestDist = Infinity;
  for (const [key, value] of Object.entries(corrections)) {
    const dist = levenshtein(lower, key);
    if (dist < bestDist && dist <= Math.max(2, Math.floor(key.length * 0.35))) {
      bestDist = dist;
      bestMatch = value;
    }
  }
  if (bestMatch) return bestMatch;

  // Title case fallback
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ===== MOTIVATIONAL QUOTES (100+) =====
const motivationQuotes = [
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
  "Your limitation—it's only your imagination.",
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
  "Education is the most powerful weapon you can use to change the world.",
  "Today's learners are tomorrow's leaders.",
  "Learning is a treasure that will follow its owner everywhere.",
  "Education is not preparation for life; education is life itself."
];

function getRandomQuotes(n = 3) {
  const shuffled = [...motivationQuotes].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ===== STUDY TECHNIQUES DATABASE =====
const studyTechniques = {
  'Mathematics': ['Practice problem sets daily', 'Work through proofs step-by-step', 'Use visual diagrams for concepts', 'Teach formulas to someone else', 'Focus on weak topic areas first'],
  'Physics': ['Solve numerical problems', 'Draw free-body diagrams', 'Memorize key formulas with derivations', 'Watch experiment demonstrations', 'Connect theory to real-world examples'],
  'Chemistry': ['Balance equations repeatedly', 'Create flashcards for reactions', 'Practice naming compounds', 'Draw molecular structures', 'Review periodic table trends'],
  'Biology': ['Use diagrams and flowcharts', 'Create mind maps for processes', 'Practice labeling diagrams', 'Summarize chapters in own words', 'Use mnemonics for classification'],
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

// ===== PRIORITY ENGINE (intelligent) =====
function getPriority(mark, days) {
  // Base weekly minutes — inversely proportional to grade
  let baseWeekly;
  if (mark < 30) baseWeekly = 180;
  else if (mark < 40) baseWeekly = 150;
  else if (mark < 50) baseWeekly = 120;
  else if (mark < 60) baseWeekly = 100;
  else if (mark < 70) baseWeekly = 75;
  else if (mark < 80) baseWeekly = 55;
  else if (mark < 90) baseWeekly = 40;
  else baseWeekly = 30;

  // Time-pressure multiplier — closer exam = more study
  let multiplier;
  if (days <= 1) multiplier = 2.5;
  else if (days <= 3) multiplier = 2.2;
  else if (days <= 7) multiplier = 1.8;
  else if (days <= 14) multiplier = 1.5;
  else if (days <= 21) multiplier = 1.3;
  else if (days <= 30) multiplier = 1.15;
  else if (days <= 60) multiplier = 1.0;
  else if (days <= 90) multiplier = 0.85;
  else multiplier = 0.7;

  const weeklyMinutes = Math.round(baseWeekly * multiplier);

  // Classification
  let level, colorClass, urgency;
  if (mark < 40) { level = 'CRITICAL'; colorClass = 'priority-critical'; urgency = 4; }
  else if (mark < 60) { level = 'HIGH'; colorClass = 'priority-high'; urgency = 3; }
  else if (mark < 75) { level = 'MEDIUM'; colorClass = 'priority-medium'; urgency = 2; }
  else { level = 'MAINTAIN'; colorClass = 'priority-low'; urgency = 1; }

  // Performance grade
  let grade;
  if (mark >= 90) grade = 'A+';
  else if (mark >= 80) grade = 'A';
  else if (mark >= 70) grade = 'B';
  else if (mark >= 60) grade = 'C';
  else if (mark >= 50) grade = 'D';
  else grade = 'F';

  // Pomodoro suggestion
  const pomodoroSessions = Math.max(1, Math.round(weeklyMinutes / 30));

  return { level, colorClass, urgency, weeklyMinutes, grade, pomodoroSessions };
}

// ===== SMART WEEKLY SCHEDULER =====
function generateWeeklySchedule(subjects, days) {
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Build subject data with priorities
  const subjectData = Object.entries(subjects).map(([name, mark]) => ({
    name, mark, ...getPriority(mark, days)
  }));

  // Calculate total weekly minutes
  const totalWeekly = subjectData.reduce((sum, s) => sum + s.weeklyMinutes, 0);

  // Distribute across 7 days, prioritizing weaker subjects on earlier days
  // and maintaining variety
  const schedule = DAY_NAMES.map(() => []);

  // Sort by urgency (highest first) for initial placement
  const sorted = [...subjectData].sort((a, b) => b.urgency - a.urgency || a.weeklyMinutes - b.weeklyMinutes);

  // Daily study hours available (adjust based on days remaining)
  const dailyMinutesCap = days <= 7 ? 480 : days <= 14 ? 360 : days <= 30 ? 300 : 240;

  // Create a round-robin distribution weighted by priority
  for (const subj of sorted) {
    let remaining = subj.weeklyMinutes;
    // Start from a different day for each subject to avoid clustering
    const startDay = sorted.indexOf(subj) % 7;

    for (let offset = 0; remaining > 0 && offset < 7; offset++) {
      const dayIdx = (startDay + offset) % 7;
      const dayCurrentTotal = schedule[dayIdx].reduce((s, b) => s + b.minutes, 0);

      if (dayCurrentTotal >= dailyMinutesCap) continue;

      // Allocate proportionally — spread evenly with some variation
      const idealPerDay = Math.ceil(subj.weeklyMinutes / Math.min(7, Math.max(3, Math.ceil(days / 7))));
      const available = Math.min(remaining, idealPerDay, dailyMinutesCap - dayCurrentTotal);

      if (available > 0) {
        schedule[dayIdx].push({
          subject: subj.name,
          minutes: available,
          grade: subj.grade,
          level: subj.level,
          colorClass: subj.colorClass
        });
        remaining -= available;
      }
    }

    // If still has remaining minutes (rare), add to least-loaded days
    if (remaining > 0) {
      for (let d = 0; remaining > 0 && d < 7; d++) {
        const dayTotal = schedule[d].reduce((s, b) => s + b.minutes, 0);
        if (dayTotal < dailyMinutesCap) {
          const add = Math.min(remaining, dailyMinutesCap - dayTotal);
          schedule[d].push({
            subject: subj.name, minutes: add, grade: subj.grade,
            level: subj.level, colorClass: subj.colorClass
          });
          remaining -= add;
        }
      }
    }
  }

  return { schedule, DAY_NAMES, totalWeekly, dailyMinutesCap };
}

// ===== FORMAT HELPERS =====
function formatMinutes(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getGradeColor(mark) {
  if (mark < 40) return 'var(--color-critical)';
  if (mark < 60) return 'var(--color-high)';
  if (mark < 75) return 'var(--color-medium)';
  return 'var(--color-low)';
}

// ===== MAIN ANALYSIS =====
function analyze(e) {
  if (e) e.preventDefault();

  // Clear previous field errors
  for (let i = 1; i <= SUBJECT_SLOTS; i++) clearFieldError(i);

  const name = nameInput.value.trim() || 'Hunter';
  const days = parseInt(daysInput.value);

  // Validate days
  if (isNaN(days) || days < 0) {
    showToast('Please enter valid days until exam', 'error');
    daysInput.classList.add('input-error');
    daysInput.focus();
    return;
  }
  if (days > 730) {
    showToast('Maximum 730 days (2 years)', 'error');
    daysInput.classList.add('input-error');
    daysInput.focus();
    return;
  }

  // Collect and validate subjects
  const subjects = {};
  let filledSlots = 0;
  let errors = [];
  let duplicateCheck = new Set();

  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    const subjInput = $(`#subject-${i}`);
    const gradeInput = $(`#grade-${i}`);
    let subjectName = subjInput.value.trim();
    const gradeVal = gradeInput.value.trim();

    // Auto-correct subject name
    if (subjectName) {
      const corrected = autoCorrectSubject(subjectName);
      subjInput.value = corrected;
      subjectName = corrected;
    }

    // Validation
    if (subjectName && !gradeVal) {
      errors.push(`"${subjectName}" needs a grade.`);
      $(`#err-grade-${i}`).textContent = 'Grade required';
      gradeInput.classList.add('input-error');
      continue;
    }
    if (!subjectName && gradeVal) {
      errors.push(`Slot ${i} has a grade but no subject.`);
      $(`#err-subj-${i}`).textContent = 'Subject required';
      subjInput.classList.add('input-error');
      continue;
    }
    if (!subjectName && !gradeVal) continue;

    const grade = Number(gradeVal);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      errors.push(`"${subjectName}" has invalid grade (0–100).`);
      $(`#err-grade-${i}`).textContent = 'Must be 0–100';
      gradeInput.classList.add('input-error');
      continue;
    }

    // Duplicate check
    if (duplicateCheck.has(subjectName.toLowerCase())) {
      errors.push(`Duplicate subject: "${subjectName}".`);
      $(`#err-subj-${i}`).textContent = 'Duplicate';
      subjInput.classList.add('input-error');
      continue;
    }
    duplicateCheck.add(subjectName.toLowerCase());

    filledSlots++;
    subjects[subjectName] = grade;
  }

  if (filledSlots < MIN_SUBJECTS) {
    showToast(`Need at least ${MIN_SUBJECTS} subjects (have ${filledSlots})`, 'warning');
    return;
  }

  if (errors.length) {
    showToast(`Fixed ${errors.length} issue${errors.length > 1 ? 's' : ''}`, 'warning');
  }

  // Show brief loading state
  resultsDiv.classList.add('results-loading');

  setTimeout(() => {
 renderResults(name, days, subjects);
    resultsDiv.classList.remove('results-loading');
  }, 300);
}

function renderResults(name, days, subjects) {
  const subjectData = Object.entries(subjects).map(([name, mark]) => ({
    name, mark, ...getPriority(mark, days)
  }));

  const totalWeekly = subjectData.reduce((s, d) => s + d.weeklyMinutes, 0);
  const avgMark = Math.round(subjectData.reduce((s, d) => s + d.mark, 0) / subjectData.length);
  const sorted = [...subjectData].sort((a, b) => a.mark - b.mark);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const quotes = getRandomQuotes(3);
  const { schedule, DAY_NAMES, dailyMinutesCap } = generateWeeklySchedule(subjects, days);

  // Exam urgency message
  let urgencyMsg, urgencyClass;
  if (days === 0) { urgencyMsg = 'EXAM IS TODAY! Final sprint — focus on key formulas and summaries.'; urgencyClass = 'critical'; }
  else if (days <= 3) { urgencyMsg = 'ULTRA URGENT: Final stretch! Focus on weakest subjects and key concepts.'; urgencyClass = 'critical'; }
  else if (days <= 7) { urgencyMsg = 'One week left. Prioritize high-impact revision on weak areas.'; urgencyClass = 'high'; }
  else if (days <= 14) { urgencyMsg = 'Two weeks — time to build a daily revision habit. Stay consistent.'; urgencyClass = 'medium'; }
  else if (days <= 30) { urgencyMsg = 'About a month. Perfect time to start a structured weekly schedule.'; urgencyClass = 'normal'; }
  else if (days <= 60) { urgencyMsg = 'Good time buffer. Build strong foundations and practice regularly.'; urgencyClass = 'normal'; }
  else { urgencyMsg = 'Plenty of time. Master each topic deeply — you have a great advantage.'; urgencyClass = 'relaxed'; }

  let html = '';

  // === HEADER ===
  html += `<div class="result-header">`;
  html += `<h2>HELLO, ${escHtml(name.toUpperCase())}!</h2>`;
  html += `<div class="result-stats">`;
  html += `<div class="stat-chip"><span class="stat-value">${subjectData.length}</span><span class="stat-label">Subjects</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${avgMark}%</span><span class="stat-label">Average</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${formatMinutes(totalWeekly)}</span><span class="stat-label">/week</span></div>`;
  html += `<div class="stat-chip"><span class="stat-value">${days}</span><span class="stat-label">days left</span></div>`;
  html += `</div></div>`;

  // === URGENCY ===
  html += `<div class="urgency-banner urgency-${urgencyClass}">`
    + `<span class="urgency-icon">${days <= 3 ? '⚠️' : days <= 14 ? '📅' : '✅'}</span> `
    + `<span>${urgencyMsg}</span></div>`;

  // === GRADE CHART ===
  html += `<h3>GRADE OVERVIEW</h3>`;
  html += `<div class="grade-chart">`;
  for (const s of sorted) {
    const pct = Math.max(2, s.mark);
    html += `<div class="grade-row">
      <div class="grade-label">${escHtml(s.name)}</div>
      <div class="grade-bar-wrap">
        <div class="grade-bar ${s.colorClass}" style="width: ${pct}%">
          <span class="grade-bar-text">${s.mark}%</span>
        </div>
      </div>
      <span class="grade-badge ${s.colorClass}">${s.grade}</span>
    </div>`;
  }
  html += `</div>`;

  // === PRIORITY TABLE ===
  html += `<h3>WEEKLY STUDY PLAN</h3>`;
  html += `<div class="plan-table-wrap"><table class="plan-table">
    <thead><tr>
      <th>Subject</th><th>Grade</th><th>Priority</th><th>Weekly</th><th>Sessions</th>
    </tr></thead><tbody>`;
  for (const s of subjectData.sort((a, b) => b.urgency - a.urgency || a.mark - b.mark)) {
    html += `<tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${s.mark}%</td>
      <td><span class="${s.colorClass} badge">${s.level}</span></td>
      <td><strong>${formatMinutes(s.weeklyMinutes)}</strong></td>
      <td>${s.pomodoroSessions} × 25min</td>
    </tr>`;
  }
  html += `</tbody></table></div>`;

  // === DAILY TIMETABLE ===
  html += `<h3>DAILY TIMETABLE</h3>`;
  html += `<div class="timetable-wrap"><table class="timetable">
    <thead><tr><th>Day</th><th>Subjects & Sessions</th><th>Total</th></tr></thead><tbody>`;
  for (let d = 0; d < 7; d++) {
    const dayItems = schedule[d];
    const dayTotal = dayItems.reduce((s, b) => s + b.minutes, 0);
    html += `<tr><td class="day-name">${DAY_NAMES[d]}</td><td class="day-sessions">`;
    if (dayItems.length === 0) {
      html += `<span class="rest-day">Rest / Light review</span>`;
    } else {
      html += dayItems.map(item =>
        `<span class="session-chip ${item.colorClass}">${escHtml(item.subject)} · ${formatMinutes(item.minutes)}</span>`
      ).join('');
    }
    html += `</td><td class="day-total">${formatMinutes(dayTotal)}</td></tr>`;
  }
  html += `</tbody></table></div>`;

  // === STUDY TECHNIQUES ===
  html += `<h3>RECOMMENDED TECHNIQUES</h3>`;
  html += `<div class="techniques-grid">`;
  for (const s of sorted.slice(0, 4)) {  // Top 4 weakest
    const techniques = getTechniquesFor(s.name);
    html += `<div class="technique-card">
      <h4>${escHtml(s.name)} <span class="${s.colorClass}">${s.grade}</span></h4>
      <ul>${techniques.slice(0, 3).map(t => `<li>${t}</li>`).join('')}</ul>
    </div>`;
  }
  html += `</div>`;

  // === MOTIVATION ===
  html += `<div class="motivation-block">
    <h3>MOTIVATION BOOST</h3>
    <p class="weak-link">Your biggest growth area: <strong>${escHtml(weakest.name)}</strong> (${weakest.mark}%). That's where the most points are waiting!</p>
    <p class="strong-link">Your strongest weapon: <strong>${escHtml(strongest.name)}</strong> (${strongest.mark}%). Keep it sharp!</p>`;
  html += quotes.map((q, i) => `<p class="quote"><span class="quote-marker">${['🔴','🔥','🌟'][i]}</span> <em>"${escHtml(q)}"</em></p>`).join('');
  html += `</div>`;

  // === REVISION ORDER ===
  html += `<div class="revision-order">
    <h3>RECOMMENDED REVISION ORDER</h3>
    <p>${sorted.map(s => `<span class="order-chip ${s.colorClass}">${escHtml(s.name)} (${s.mark}%)</span>`).join(' → ')}</p>
  </div>`;

  // === TIPS ===
  html += `<div class="tips-block"><h3>SYSTEM TIPS</h3><ul>`;
  if (days <= 7) html += `<li>Use the Pomodoro technique: 25 min focused + 5 min break.</li>`;
  if (days <= 14) html += `<li>Focus on past papers — they reveal exam patterns.</li>`;
  if (avgMark < 50) html += `<li>Start with the basics. Don't skip foundational topics.</li>`;
  if (subjectData.length >= 6) html += `<li>With ${subjectData.length} subjects, cluster similar ones on the same day.</li>`;
  html += `<li>Review each session's material within 24 hours for best retention.</li>`;
  if (days > 30) html += `<li>You have time — explore active recall and spaced repetition apps.</li>`;
  html += `<li>Sleep 7-8 hours. Your brain consolidates memory during sleep.</li>`;
  html += `</ul></div>`;

  resultsDiv.innerHTML = html;
  resultsDiv.classList.add('has-results');
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Save current data
  saveCurrentData();
  // Save to history
  saveToHistory(name, days, subjects, avgMark, totalWeekly);
  showToast('Analysis complete!', 'success');
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== LOCAL STORAGE =====
function saveCurrentData() {
  localStorage.setItem(`${STORAGE_PREFIX}name`, nameInput.value.trim());
  localStorage.setItem(`${STORAGE_PREFIX}days`, daysInput.value);
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    localStorage.setItem(`${STORAGE_PREFIX}subj_${i}`, $(`#subject-${i}`).value);
    localStorage.setItem(`${STORAGE_PREFIX}grade_${i}`, $(`#grade-${i}`).value);
  }
}

function loadSavedData() {
  const n = localStorage.getItem(`${STORAGE_PREFIX}name`);
  if (n) nameInput.value = n;
  const d = localStorage.getItem(`${STORAGE_PREFIX}days`);
  if (d) daysInput.value = d;
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    const s = localStorage.getItem(`${STORAGE_PREFIX}subj_${i}`);
    const g = localStorage.getItem(`${STORAGE_PREFIX}grade_${i}`);
    if (s) $(`#subject-${i}`).value = s;
    if (g) $(`#grade-${i}`).value = g;
  }
  updateSubjectCounter();
  // Trigger exam hint
  daysInput.dispatchEvent(new Event('input'));
}

// ===== HISTORY =====
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveToHistory(name, days, subjects, avg, totalMin) {
  const history = getHistory();
  history.unshift({
    date: new Date().toISOString(),
    name, days,
    subjects: { ...subjects },
    average: avg,
    totalWeekly: totalMin,
    count: Object.keys(subjects).length
  });
  // Keep only last N entries
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function renderHistory() {
  const history = getHistory();
  if (history.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No analysis history yet. Run your first analysis!</p>';
    return;
  }
  historyList.innerHTML = history.map((h, i) => {
    const date = new Date(h.date);
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const subjectNames = Object.keys(h.subjects).join(', ');
    return `<div class="history-item" data-index="${i}">
      <div class="history-meta">
        <span class="history-date">${dateStr} ${timeStr}</span>
        <span class="history-avg ${h.average < 50 ? 'priority-critical' : h.average < 70 ? 'priority-medium' : 'priority-low'}">${h.average}%</span>
      </div>
      <div class="history-subjects">${escHtml(subjectNames)}</div>
      <div class="history-details">${h.count} subjects · ${formatMinutes(h.totalWeekly)}/week · ${h.days} days</div>
    </div>`;
  }).join('');

  // Click to restore
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      const h = history[idx];
      nameInput.value = h.name || '';
      daysInput.value = h.days || '';
      for (let i = 1; i <= SUBJECT_SLOTS; i++) {
        $(`#subject-${i}`).value = '';
        $(`#grade-${i}`).value = '';
      }
      let slot = 1;
      for (const [subj, grade] of Object.entries(h.subjects)) {
        if (slot > SUBJECT_SLOTS) break;
        $(`#subject-${slot}`).value = subj;
        $(`#grade-${slot}`).value = grade;
        slot++;
      }
      updateSubjectCounter();
      daysInput.dispatchEvent(new Event('input'));
      historyPanel.hidden = true;
      showToast('History entry restored', 'info', 2000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ===== CLEAR ALL =====
function clearAll() {
  if (!confirm('Reset the System? All data will be lost!')) return;
  nameInput.value = '';
  daysInput.value = '';
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    $(`#subject-${i}`).value = '';
    $(`#grade-${i}`).value = '';
    clearFieldError(i);
  }
  examHint.textContent = 'Enter days remaining';
  examHint.className = 'exam-hint';
  resultsDiv.innerHTML = `<div class="results-placeholder">
    <div class="placeholder-icon">💪</div>
    <p>Enter your stats and hit <strong>Run Analysis</strong> to get your personalized training plan.</p>
  </div>`;
  resultsDiv.classList.remove('has-results');
  updateSubjectCounter();
  localStorage.removeItem(`${STORAGE_PREFIX}name`);
  localStorage.removeItem(`${STORAGE_PREFIX}days`);
  for (let i = 1; i <= SUBJECT_SLOTS; i++) {
    localStorage.removeItem(`${STORAGE_PREFIX}subj_${i}`);
    localStorage.removeItem(`${STORAGE_PREFIX}grade_${i}`);
  }
  showToast('System reset. Ready for a new journey.', 'info');
}

// ===== PRINT SCROLL =====
function printResults() {
  if (!resultsDiv.classList.contains('has-results')) {
    showToast('Run the analysis first!', 'warning');
    return;
  }
  // Use the browser's print with a print stylesheet
  window.print();
}

// ===== EXPORT AS TEXT =====
function exportResults() {
  if (!resultsDiv.classList.contains('has-results')) {
    showToast('Run the analysis first!', 'warning');
    return;
  }
  const text = resultsDiv.innerText;
  const blob = new Blob([`STUDY DOJO - ANALYSIS REPORT\n${'='.repeat(50)}\n\n${text}\n\nGenerated by Study Dojo System v3.0\n`], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `study-dojo-plan-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Plan exported!', 'success');
}

// ===== EVENT LISTENERS =====
studyForm.addEventListener('submit', analyze);
$('#clearBtn').addEventListener('click', clearAll);
$('#printBtn').addEventListener('click', printResults);
$('#exportBtn').addEventListener('click', exportResults);

// History panel toggle
$('#historyBtn').addEventListener('click', () => {
  renderHistory();
  historyPanel.hidden = !historyPanel.hidden;
  if (!historyPanel.hidden) historyPanel.scrollIntoView({ behavior: 'smooth' });
});
$('#closeHistory').addEventListener('click', () => { historyPanel.hidden = true; });
$('#clearHistory').addEventListener('click', () => {
  if (!confirm('Clear all analysis history?')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast('History cleared', 'info');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+H for history
  if (e.ctrlKey && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    renderHistory();
    historyPanel.hidden = !historyPanel.hidden;
  }
  // Escape to close history
  if (e.key === 'Escape' && !historyPanel.hidden) {
    historyPanel.hidden = true;
  }
});

// Auto-accept suggestion on blur
subjectGrid.addEventListener('focusout', (e) => {
  if (e.target.dataset.subject) {
    const suggestion = e.target.getAttribute('data-suggestion');
    if (suggestion) {
      e.target.value = suggestion;
      e.target.removeAttribute('data-suggestion');
      updateSubjectCounter();
    }
  }
});

// ===== INIT =====
initTheme();
loadSavedData();