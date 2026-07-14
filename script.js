// ================================================================
// STUDY DOJO – SYSTEM SCRIPT (UPDATED PRIORITY LOGIC)
// Full comments for every section – beginner friendly.
// ================================================================

// ----- 1. DOM REFERENCES – connect to HTML elements -----
const nameInput = document.getElementById('name');
const daysInput = document.getElementById('days');
const resultsDiv = document.getElementById('results');
const subjectGrid = document.getElementById('subjectGrid');

// ----- 2. BUILD THE 7 SUBJECT SLOTS dynamically -----
function buildSubjectGrid() {
  subjectGrid.innerHTML = '';
  for (let i = 1; i <= 7; i++) {
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.innerHTML = `
      <div>
        <label for="subject-${i}">📘 Subject ${i}</label>
        <input type="text" id="subject-${i}" placeholder="e.g., History" data-subject="true">
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

// ----- 3. MOTIVATIONAL QUOTES (120+ curated – anime + study wisdom) -----
const motivationQuotes = [
  // --- ANIME QUOTES ---
  "Believe in the me that believes in you! – Kamina (Gurren Lagann)",
  "A dropout will beat a genius through hard work. – Rock Lee (Naruto)",
  "If you don't like your destiny, don't accept it. – Naruto Uzumaki",
  "I never go back on my word, that's my ninja way! – Naruto",
  "Power comes in response to a need, not a desire. – Goku (Dragon Ball)",
  "It's not about the pain, it's about the lesson. – Erza Scarlet (Fairy Tail)",
  "The moment you think of giving up, think of why you held on so long. – Eren Yeager (AOT)",
  "I don't know what the future holds, but I know that I won't give up. – Luffy (One Piece)",
  "Hard work betters talent when talent doesn't work hard. – Various",
  "Give up on giving up. – Rock Lee",
  "You are the protagonist of your own story. Act like it! – Various",
  "Rest if you must, but don't you ever quit. – Various",
  "Your future is created by what you do today, not tomorrow. – Various",
  "The only way to truly fail is to give up. – Various",
  "Believe in your own potential. – All Might (MHA)",
  "Plus Ultra! – All Might",
  "Do or do not, there is no try. – Various",
  "Even the smallest person can change the course of the future. – Various",
  "It's not the strength of the body, but the strength of the spirit. – Various",
  // --- STUDY / GENERAL WISDOM ---
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
  "Champions are made in the hours that no one is watching.",
  "The only way to do great work is to love what you do.",
  "Your future depends on what you do today.",
  "The best way to predict the future is to create it.",
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
  "The secret to getting ahead is getting started.",
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
  "The only source of knowledge is experience.",
  "To succeed, you need to find something to hold on to, something to motivate you, something to inspire you.",
  "Success is the progressive realization of a worthy goal.",
  "Desire is the key to motivation.",
  "Without hard work, nothing grows but weeds.",
  "The best preparation for tomorrow is doing your best today.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
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
  "The future depends on what you do today.",
  "Today's learners are tomorrow's leaders.",
  "Learning is a treasure that will follow its owner everywhere.",
  "Education is not preparation for life; education is life itself.",
  "Your education is your ticket to the future. Don't leave it at the gate.",
  "The more you read, the more things you will know. The more you learn, the more places you'll go.",
  // --- EXTRA (Solo Leveling / System vibe) ---
  "Arise, and become stronger. – Sung Jin‑Woo",
  "The system rewards those who never stop leveling up.",
  "Every failure is just a quest you haven't completed yet.",
  "Your potential is your greatest weapon – sharpen it daily.",
  "A true hunter never fears the grind.",
  "The dungeon of exams is your final boss. Prepare accordingly."
];

// ----- 4. GET 3 RANDOM QUOTES for the motivation block -----
function getRandomMotivationQuotes() {
  const shuffled = [...motivationQuotes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

// ----- 5. PRIORITY LOGIC – UPDATED (more realistic, with cap) -----
function getPriority(mark, days) {
  // Base minutes – more realistic ranges
  let baseTime = 15; // default for high scorers
  if (mark < 35) baseTime = 50;
  else if (mark < 55) baseTime = 40;
  else if (mark < 70) baseTime = 25;
  else baseTime = 12;

  // Urgency factor – smaller multiplier so it doesn't explode
  let urgency = 1;
  if (days <= 3) urgency = 1.4;   // +40% if exam is very soon
  else if (days <= 7) urgency = 1.2; // +20% if within a week
  else urgency = 1; // normal pace

  let finalTime = Math.round(baseTime * urgency);

  // Cap individual subject time at 90 minutes (no one should study 1 subject for 2+ hours daily)
  if (finalTime > 90) finalTime = 90;

  let level, colorClass;
  if (mark < 35) { level = 'HIGH PRIORITY'; colorClass = 'priority-high'; }
  else if (mark < 55) { level = 'MEDIUM PRIORITY'; colorClass = 'priority-medium'; }
  else if (mark < 70) { level = 'LOW PRIORITY'; colorClass = 'priority-low'; }
  else { level = 'VERY LOW'; colorClass = 'priority-low'; }

  return { level, colorClass, time: finalTime };
}

// ----- 6. MAIN ANALYSIS FUNCTION – generates the study plan -----
function analyze() {
  const name = nameInput.value.trim() || 'Student';
  const days = Number(daysInput.value.trim());
  if (isNaN(days) || days < 0) {
    resultsDiv.innerHTML = `<h2>⚠️ ERROR</h2><p>Please enter a valid number of days (0 or more).</p>`;
    return;
  }

  // Collect subjects & grades from the 7 slots
  const subjects = {};
  let isValid = true;
  let errors = [];

  for (let i = 1; i <= 7; i++) {
    const subjInput = document.getElementById(`subject-${i}`);
    const gradeInput = document.getElementById(`grade-${i}`);
    const subjectName = subjInput.value.trim();
    const gradeVal = gradeInput.value.trim();

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

    const grade = Number(gradeVal);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      isValid = false;
      errors.push(`❌ "${subjectName}" has an invalid grade (must be 0–100).`);
      continue;
    }
    subjects[subjectName] = grade;
  }

  if (!isValid || Object.keys(subjects).length === 0) {
    let output = `<h2>⚠️ INCOMPLETE REGISTER</h2>`;
    if (errors.length) output += `<ul style="color:#ff6b6b;">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
    if (Object.keys(subjects).length === 0 && errors.length === 0) output += `<p>Please enter at least one subject and its grade.</p>`;
    resultsDiv.innerHTML = output;
    return;
  }

  // Build the study plan
  let output = `<h2>👋 HELLO, ${name.toUpperCase()}!</h2>`;
  output += `<h3>📊 YOUR STUDY PLAN</h3>`;

  let weakest = '';
  let lowestMark = 101;
  let totalMin = 0;

  for (const [subject, mark] of Object.entries(subjects)) {
    const { level, colorClass, time } = getPriority(mark, days);
    totalMin += time;
    output += `<p><b>${subject}</b>: <span class="${colorClass}">${level}</span> – Study <b>${time}</b> min/day</p>`;
    if (mark < lowestMark) {
      lowestMark = mark;
      weakest = subject;
    }
  }

  // ----- MOTIVATION BOOST (3 random quotes) -----
  const quotes = getRandomMotivationQuotes();
  output += `<div class="motivation-block">`;
  output += `<h3>💥 MOTIVATION BOOST</h3>`;
  output += `<p>🔴 Your weakest link is <b>${weakest}</b> (${lowestMark}%). But that's where you grow the most!</p>`;
  output += `<p>📢 <i>"${quotes[0]}"</i></p>`;
  output += `<p>🔥 <i>"${quotes[1]}"</i></p>`;
  output += `<p>🌟 <i>"${quotes[2]}"</i></p>`;
  output += `</div>`;

  // ----- Exam urgency -----
  output += `<h3>⏳ EXAM COUNTDOWN (${days} days)</h3>`;
  if (days <= 3) {
    output += `<p>⚠️ <span style="color:#ff4a6a;">ULTRA URGENT:</span> Final stretch! Study for at least 4 hours daily.</p>`;
  } else if (days <= 7) {
    output += `<p>📅 One week left. Create a strict daily schedule.</p>`;
  } else if (days <= 14) {
    output += `<p>📆 You have 2 weeks. Start focusing on your weak areas.</p>`;
  } else {
    output += `<p>✅ You have enough time. Build a solid foundation.</p>`;
  }

  // ----- Recommended revision order (weakest to strongest) -----
  const sorted = Object.entries(subjects).sort((a, b) => a[1] - b[1]);
  const order = sorted.map(([subj]) => subj).join(' → ');
  output += `<p><b>Recommended revision order:</b> ${order}</p>`;

  // ----- Total daily study time – WITH CAP (new) -----
  let finalTotal = totalMin;
  let capMessage = '';
  if (totalMin > 300) {
    finalTotal = 300;
    capMessage = ` (⚠️ Capped at 300 min / 5 hours. Focus on your weakest 4 subjects first, then rotate.)`;
  }
  output += `<p>📊 <b>Total daily study time:</b> ${finalTotal} minutes (${Math.round(finalTotal/60)} hours)${capMessage}.</p>`;

  // ----- Save data to localStorage -----
  localStorage.setItem('studyAssistant_name', name);
  localStorage.setItem('studyAssistant_days', daysInput.value);
  for (let i = 1; i <= 7; i++) {
    localStorage.setItem(`studyAssistant_subj_${i}`, document.getElementById(`subject-${i}`).value.trim());
    localStorage.setItem(`studyAssistant_grade_${i}`, document.getElementById(`grade-${i}`).value.trim());
  }

  resultsDiv.innerHTML = output;
}

// ----- 7. LOAD SAVED DATA from localStorage on page load -----
function loadSavedData() {
  const savedName = localStorage.getItem('studyAssistant_name');
  if (savedName) nameInput.value = savedName;
  const savedDays = localStorage.getItem('studyAssistant_days');
  if (savedDays) daysInput.value = savedDays;
  for (let i = 1; i <= 7; i++) {
    const savedSubj = localStorage.getItem(`studyAssistant_subj_${i}`);
    const savedGrade = localStorage.getItem(`studyAssistant_grade_${i}`);
    if (savedSubj) document.getElementById(`subject-${i}`).value = savedSubj;
    if (savedGrade) document.getElementById(`grade-${i}`).value = savedGrade;
  }
}

// ----- 8. CLEAR ALL DATA (with confirmation) -----
function clearAll() {
  if (!confirm('Reset the System? All data will be lost!')) return;
  nameInput.value = '';
  daysInput.value = '';
  for (let i = 1; i <= 7; i++) {
    document.getElementById(`subject-${i}`).value = '';
    document.getElementById(`grade-${i}`).value = '';
  }
  resultsDiv.innerHTML = '<p style="color:#445566;">🧹 System reset. Ready for a new journey.</p>';
  localStorage.clear();
}

// ----- 9. PRINT STUDY PLAN (opens a new window) -----
function printResults() {
  const content = resultsDiv.innerHTML;
  if (!content || content.includes('ERROR') || content.includes('INCOMPLETE')) {
    alert('Please run the analysis first to generate your scroll!');
    return;
  }
  const win = window.open('', '', 'width=800,height=600');
  win.document.write(`
    <html><head><title>My Study Scroll</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; padding: 2rem; background: #0b0a16; color: #d0dce8; }
      .priority-high { color: #ff4a6a; font-weight:700; }
      .priority-medium { color: #ffd04a; font-weight:700; }
      .priority-low { color: #00d4ff; font-weight:700; }
      .motivation-block { background: #1a1a2e; padding:1rem; border-radius:16px; border-left:4px solid #00c8ff; }
    </style>
    </head><body>
    <h1>📜 My Personal Study Scroll</h1>
    ${content}
    <p><em>Generated by STUDY DOJO · SYSTEM ACTIVATED</em></p>
    </body></html>
  `);
  win.document.close();
  win.print();
}

// ----- 10. EVENT LISTENERS for buttons -----
document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('clearBtn').addEventListener('click', clearAll);
document.getElementById('printBtn').addEventListener('click', printResults);

// Enter key triggers analysis
document.querySelectorAll('input').forEach(inp => inp.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
}));

// ----- 11. LOAD DATA when page starts -----
window.addEventListener('DOMContentLoaded', loadSavedData);

// ================================================================
// ====== FOCUS AREAS (only TWO) ===================================
// ================================================================

// ---------- A. COMMUNICATION TECHNOLOGY – IoT Dashboard ----------
let iotDevices = {
  lamp: true,
  watch: true,
  headphone: true
};

function updateIoTUI() {
  const lampEl = document.getElementById('lampStatus');
  const watchEl = document.getElementById('watchStatus');
  const headEl = document.getElementById('headphoneStatus');
  
  lampEl.textContent = iotDevices.lamp ? 'ONLINE' : 'OFFLINE';
  lampEl.className = iotDevices.lamp ? 'status-online' : 'status-offline';
  
  watchEl.textContent = iotDevices.watch ? 'ONLINE' : 'OFFLINE';
  watchEl.className = iotDevices.watch ? 'status-online' : 'status-offline';
  
  headEl.textContent = iotDevices.headphone ? 'ONLINE' : 'OFFLINE';
  headEl.className = iotDevices.headphone ? 'status-online' : 'status-offline';
}

document.getElementById('toggleLamp').addEventListener('click', () => { iotDevices.lamp = !iotDevices.lamp; updateIoTUI(); });
document.getElementById('toggleWatch').addEventListener('click', () => { iotDevices.watch = !iotDevices.watch; updateIoTUI(); });
document.getElementById('toggleHeadphone').addEventListener('click', () => { iotDevices.headphone = !iotDevices.headphone; updateIoTUI(); });

// ---------- B. INDUSTRIAL & PROFESSIONAL – Component Inventory ----------
function loadComponents() {
  const comps = JSON.parse(localStorage.getItem('componentInventory') || '[]');
  const list = document.getElementById('componentList');
  if (comps.length === 0) {
    list.innerHTML = '<p style="color:#445566;">No components added yet.</p>';
    return;
  }
  list.innerHTML = comps.map((comp, idx) => `
    <div class="comp-item">
      <span><b>${comp.name}</b> (${comp.spec}) — Qty: ${comp.qty}</span>
      <button class="del-btn" data-idx="${idx}">✕</button>
    </div>
  `).join('');
  document.querySelectorAll('#componentList .del-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      let comps = JSON.parse(localStorage.getItem('componentInventory') || '[]');
      comps.splice(this.dataset.idx, 1);
      localStorage.setItem('componentInventory', JSON.stringify(comps));
      loadComponents();
    });
  });
}

document.getElementById('addCompBtn').addEventListener('click', function() {
  const name = document.getElementById('compName').value.trim();
  const spec = document.getElementById('compSpec').value.trim() || 'N/A';
  const qty = parseInt(document.getElementById('compQty').value) || 0;
  if (!name) return alert('Enter a component name.');
  const comps = JSON.parse(localStorage.getItem('componentInventory') || '[]');
  comps.push({ name, spec, qty });
  localStorage.setItem('componentInventory', JSON.stringify(comps));
  document.getElementById('compName').value = '';
  document.getElementById('compSpec').value = '';
  document.getElementById('compQty').value = '';
  loadComponents();
});

// ---------- C. BACKUP & RESTORE (cross‑device sync) ----------
function exportData() {
  const data = {
    studyAssistant_name: localStorage.getItem('studyAssistant_name'),
    studyAssistant_days: localStorage.getItem('studyAssistant_days'),
    componentInventory: JSON.parse(localStorage.getItem('componentInventory') || '[]'),
    subjects: {},
    grades: {}
  };
  for (let i = 1; i <= 7; i++) {
    data.subjects[`subject-${i}`] = localStorage.getItem(`studyAssistant_subj_${i}`) || '';
    data.grades[`grade-${i}`] = localStorage.getItem(`studyAssistant_grade_${i}`) || '';
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'study_dojo_backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.studyAssistant_name) localStorage.setItem('studyAssistant_name', data.studyAssistant_name);
      if (data.studyAssistant_days) localStorage.setItem('studyAssistant_days', data.studyAssistant_days);
      if (data.componentInventory) localStorage.setItem('componentInventory', JSON.stringify(data.componentInventory));
      if (data.subjects) {
        for (let i = 1; i <= 7; i++) {
          const key = `studyAssistant_subj_${i}`;
          if (data.subjects[`subject-${i}`] !== undefined) localStorage.setItem(key, data.subjects[`subject-${i}`]);
        }
      }
      if (data.grades) {
        for (let i = 1; i <= 7; i++) {
          const key = `studyAssistant_grade_${i}`;
          if (data.grades[`grade-${i}`] !== undefined) localStorage.setItem(key, data.grades[`grade-${i}`]);
        }
      }
      alert('Data imported successfully! Refresh to see all your data.');
      loadSavedData();
      loadComponents();
      updateIoTUI();
    } catch (err) {
      alert('Failed to import. Check the file format.');
    }
  };
  reader.readAsText(file);
}

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', function(e) {
  if (this.files.length) {
    importData(this.files[0]);
    this.value = '';
  }
});

// ---------- D. LOAD EXTRA DATA on start ----------
document.addEventListener('DOMContentLoaded', function() {
  loadComponents();
  updateIoTUI();
});