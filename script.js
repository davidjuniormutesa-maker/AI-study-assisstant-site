// ======================================================
// STUDY DOJO - SYSTEM LOGIC
// 8 subject slots, min 3 required, auto-correct,
// priority based on days remaining (per week)
// ======================================================

// ----- DOM REFERENCES -----
const nameInput = document.getElementById('name');
const daysInput = document.getElementById('days');
const resultsDiv = document.getElementById('results');
const subjectGrid = document.getElementById('subjectGrid');

// ----- BUILD 8 SUBJECT SLOTS -----
function buildSubjectGrid() {
  subjectGrid.innerHTML = '';
  for (let i = 1; i <= 8; i++) {
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.innerHTML = `
      <div>
        <label for="subject-${i}">📘 Subject ${i}</label>
        <input type="text" id="subject-${i}" placeholder="e.g., Physics" data-subject="true">
      </div>
      <div>
        <label for="grade-${i}">🎯 Grade (0-100)</label>
        <input type="number" id="grade-${i}" min="0" max="100" placeholder="e.g., 85" data-grade="true">
      </div>
    `;
    subjectGrid.appendChild(row);
  }
}
buildSubjectGrid();

// ----- AUTO-CORRECT DICTIONARY (subject names) -----
const corrections = {
  'math': 'Mathematics', 'maths': 'Mathematics',
  'physic': 'Physics', 'chem': 'Chemistry', 'bio': 'Biology',
  'hist': 'History', 'geo': 'Geography', 'eng': 'English',
  'lit': 'Literature', 'ict': 'Computer Studies',
  'comp': 'Computer Studies', 'cs': 'Computer Studies',
  'bus': 'Business Studies', 'eco': 'Economics',
  'acc': 'Accounting', 'art': 'Art', 'music': 'Music',
  'pe': 'Physical Education', 'psych': 'Psychology',
  'soc': 'Sociology', 'stat': 'Statistics',
  'calc': 'Calculus', 'alg': 'Algebra', 'trig': 'Trigonometry'
};

function autoCorrectSubject(name) {
  const lower = name.trim().toLowerCase();
  if (corrections[lower]) return corrections[lower];
  for (const [key, value] of Object.entries(corrections)) {
    if (lower.startsWith(key)) return value;
  }
  return name.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

// ----- MOTIVATIONAL QUOTES (100+ curated) -----
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
  "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle.",
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
  "To succeed, you need to find something to hold on to, something to motivate you, something to inspire you.",
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
  "The only thing standing between you and your goal is the story you keep telling yourself that you can't achieve it.",
  "If you can dream it, you can do it.",
  "Strive for progress, not perfection.",
  "Be the change you wish to see in your studies.",
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

function getRandomMotivationQuotes() {
  const shuffled = [...motivationQuotes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

// ----- PRIORITY LOGIC (per week, based on days) -----
function getPriority(mark, days) {
  let baseWeekly = 60;
  if (mark < 40) baseWeekly = 150;
  else if (mark < 60) baseWeekly = 100;
  else if (mark < 75) baseWeekly = 70;
  else baseWeekly = 45;

  let multiplier = 1.0;
  if (days <= 3) multiplier = 2.0;
  else if (days <= 7) multiplier = 1.7;
  else if (days <= 14) multiplier = 1.5;
  else if (days <= 21) multiplier = 1.3;
  else if (days <= 30) multiplier = 1.1;
  else if (days <= 45) multiplier = 0.9;
  else multiplier = 0.7;

  const weeklyMinutes = Math.round(baseWeekly * multiplier);

  let level, colorClass;
  if (mark < 40) { level = 'HIGH PRIORITY'; colorClass = 'priority-high'; }
  else if (mark < 60) { level = 'MEDIUM PRIORITY'; colorClass = 'priority-medium'; }
  else if (mark < 75) { level = 'LOW PRIORITY'; colorClass = 'priority-low'; }
  else { level = 'VERY LOW'; colorClass = 'priority-low'; }

  return { level, colorClass, weeklyMinutes };
}

// ----- MAIN ANALYSIS -----
function analyze() {
  const name = nameInput.value.trim() || 'Student';
  const days = Number(daysInput.value.trim());
  if (isNaN(days) || days < 0) {
    resultsDiv.innerHTML = `<h2>⚠️ ERROR</h2><p>Please enter a valid number of days (0 or more).</p>`;
    return;
  }

  const subjects = {};
  let filledSlots = 0;
  let isValid = true;
  let errors = [];

  for (let i = 1; i <= 8; i++) {
    const subjInput = document.getElementById(`subject-${i}`);
    const gradeInput = document.getElementById(`grade-${i}`);
    let subjectName = subjInput.value.trim();
    const gradeVal = gradeInput.value.trim();

    if (subjectName !== '') {
      subjectName = autoCorrectSubject(subjectName);
      subjInput.value = subjectName;
    }

    if (subjectName !== '' && gradeVal === '') {
      isValid = false;
      errors.push(`❌ You entered "${subjectName}" but forgot the grade.`);
      continue;
    }
    if (subjectName === '' && gradeVal !== '') {
      isValid = false;
      errors.push(`❌ You entered a grade for slot ${i} but no subject name.`);
      continue;
    }
    if (subjectName === '' && gradeVal === '') continue;

    filledSlots++;
    const grade = Number(gradeVal);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      isValid = false;
      errors.push(`❌ "${subjectName}" has an invalid grade (must be 0–100).`);
      continue;
    }
    subjects[subjectName] = grade;
  }

  if (filledSlots < 3) {
    resultsDiv.innerHTML = `<h2>⚠️ INSUFFICIENT DATA</h2><p>Please enter at least <b>3 subjects</b> with their grades.</p>`;
    return;
  }

  if (!isValid) {
    let output = `<h2>⚠️ INPUT ERRORS</h2>`;
    if (errors.length) output += `<ul style="color:#ff6b6b;">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
    resultsDiv.innerHTML = output;
    return;
  }

  let output = `<h2>👋 HELLO, ${name.toUpperCase()}!</h2>`;
  output += `<h3>📊 YOUR WEEKLY STUDY PLAN</h3>`;
  output += `<p style="color:#8899aa;">📅 Exam in <b>${days}</b> day${days !== 1 ? 's' : ''}.</p>`;

  let weakest = '';
  let lowestMark = 101;
  let totalWeekly = 0;

  for (const [subject, mark] of Object.entries(subjects)) {
    const { level, colorClass, weeklyMinutes } = getPriority(mark, days);
    totalWeekly += weeklyMinutes;
    output += `<p><b>${subject}</b>: <span class="${colorClass}">${level}</span> – Study <b>${weeklyMinutes}</b> min/week</p>`;
    if (mark < lowestMark) {
      lowestMark = mark;
      weakest = subject;
    }
  }

  const quotes = getRandomMotivationQuotes();
  output += `<div class="motivation-block">`;
  output += `<h3>💥 MOTIVATION BOOST</h3>`;
  output += `<p>🔴 Your weakest link is <b>${weakest}</b> (${lowestMark}%). That's where you grow the most!</p>`;
  output += `<p>📢 <i>"${quotes[0]}"</i></p>`;
  output += `<p>🔥 <i>"${quotes[1]}"</i></p>`;
  output += `<p>🌟 <i>"${quotes[2]}"</i></p>`;
  output += `</div>`;

  output += `<h3>⏳ EXAM COUNTDOWN (${days} days)</h3>`;
  if (days <= 3) {
    output += `<p>⚠️ <span style="color:#ff2a75;">ULTRA URGENT:</span> Final stretch! This is your last push.</p>`;
  } else if (days <= 7) {
    output += `<p>📅 One week left. Focus on your weakest subjects.</p>`;
  } else if (days <= 14) {
    output += `<p>📆 Two weeks left. Build a daily revision habit.</p>`;
  } else if (days <= 30) {
    output += `<p>📅 You have about a month. Start a consistent weekly schedule.</p>`;
  } else {
    output += `<p>✅ You have plenty of time. Build a strong foundation now.</p>`;
  }

  const sorted = Object.entries(subjects).sort((a, b) => a[1] - b[1]);
  const order = sorted.map(([subj]) => subj).join(' → ');
  output += `<p><b>Recommended revision order:</b> ${order}</p>`;
  const hours = Math.round(totalWeekly / 60);
  const mins = totalWeekly % 60;
  output += `<p>📊 <b>Total weekly study time:</b> ${totalWeekly} minutes (${hours}h ${mins}m).</p>`;

  // Save to localStorage
  localStorage.setItem('studyAssistant_name', name);
  localStorage.setItem('studyAssistant_days', daysInput.value);
  for (let i = 1; i <= 8; i++) {
    localStorage.setItem(`studyAssistant_subj_${i}`, document.getElementById(`subject-${i}`).value.trim());
    localStorage.setItem(`studyAssistant_grade_${i}`, document.getElementById(`grade-${i}`).value.trim());
  }

  resultsDiv.innerHTML = output;
}

// ----- LOAD SAVED DATA -----
function loadSavedData() {
  const savedName = localStorage.getItem('studyAssistant_name');
  if (savedName) nameInput.value = savedName;
  const savedDays = localStorage.getItem('studyAssistant_days');
  if (savedDays) daysInput.value = savedDays;
  for (let i = 1; i <= 8; i++) {
    const savedSubj = localStorage.getItem(`studyAssistant_subj_${i}`);
    const savedGrade = localStorage.getItem(`studyAssistant_grade_${i}`);
    if (savedSubj) document.getElementById(`subject-${i}`).value = savedSubj;
    if (savedGrade) document.getElementById(`grade-${i}`).value = savedGrade;
  }
}

// ----- CLEAR ALL -----
function clearAll() {
  if (!confirm('Reset the System? All data will be lost!')) return;
  nameInput.value = '';
  daysInput.value = '';
  for (let i = 1; i <= 8; i++) {
    document.getElementById(`subject-${i}`).value = '';
    document.getElementById(`grade-${i}`).value = '';
  }
  resultsDiv.innerHTML = '<p style="color:#445566;">🧹 System reset. Ready for a new journey.</p>';
  localStorage.clear();
}

// ----- PRINT SCROLL (exact display) -----
function printResults() {
  const content = resultsDiv.innerHTML;
  if (!content || content.includes('ERROR') || content.includes('INSUFFICIENT')) {
    alert('Please run the analysis first to generate your scroll!');
    return;
  }
  const win = window.open('', '', 'width=1000,height=700');
  win.document.write(`
    <html><head><title>My Study Scroll</title>
    <style>
      body { font-family: 'Segoe UI', 'Inter', sans-serif; padding: 2rem; background: #0a0a12; color: #b0c8dd; }
      h1, h2, h3 { color: #d4af37; }
      .priority-high { color: #ff2a75; font-weight:700; background: #221122; padding: 2px 12px; border-radius:20px; border-left:3px solid #ff2a75; display:inline-block; }
      .priority-medium { color: #d4af37; font-weight:700; background: #221f11; padding: 2px 12px; border-radius:20px; border-left:3px solid #d4af37; display:inline-block; }
      .priority-low { color: #00f0ff; font-weight:700; background: #001a22; padding: 2px 12px; border-radius:20px; border-left:3px solid #00f0ff; display:inline-block; }
      .motivation-block { background: #0f0a1a; padding: 15px; border-radius: 16px; border: 1px dashed #d4af37; margin-top: 15px; font-style: italic; }
      .results-card { background: #0a0c18; padding: 20px; border-radius: 24px; border: 1px solid #1a1a2e; }
    </style>
    </head><body>
    <h1>📜 My Personal Study Scroll</h1>
    <div class="results-card">
      ${content}
    </div>
    <p style="margin-top:20px; color:#445566;"><em>Generated by Study Dojo · System v2.0</em></p>
    </body></html>
  `);
  win.document.close();
  win.print();
}

// ----- EVENT LISTENERS -----
document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('clearBtn').addEventListener('click', clearAll);
document.getElementById('printBtn').addEventListener('click', printResults);
document.querySelectorAll('input').forEach(inp => inp.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
}));
window.addEventListener('DOMContentLoaded', loadSavedData);