// ============================================================
//            ANIME STUDY DOJO – SCRIPT
//    (I'm still learning, so please forgive any messy code!)
// ============================================================

// ----- 1.  DOM references – connect to HTML elements -----
const nameInput = document.getElementById('name');
const daysInput = document.getElementById('days');
const resultsDiv = document.getElementById('results');
const subjectGrid = document.getElementById('subjectGrid');

// ----- 2.  Build the 7 subject slots dynamically -----
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

// ----- 3.  MOTIVATIONAL QUOTES (curated list – 100+ powerful ones) -----
const motivationQuotes = [
  // ANIME QUOTES
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
  // STUDY & GENERAL WISDOM
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
  "The more you read, the more things you will know. The more you learn, the more places you'll go."
];

// ----- 4.  Helper: get 3 random quotes for motivation -----
function getRandomMotivationQuotes() {
  const shuffled = [...motivationQuotes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

// ----- 5.  Priority logic – determines study intensity based on grade and days left -----
function getPriority(mark, days) {
  let baseTime = 20;
  if (mark < 40) baseTime = 60;
  else if (mark < 60) baseTime = 45;
  else if (mark < 75) baseTime = 30;
  else baseTime = 20;

  if (days <= 3) baseTime = Math.round(baseTime * 1.5);
  else if (days <= 7) baseTime = Math.round(baseTime * 1.2);

  let level, colorClass;
  if (mark < 40) { level = 'HIGH PRIORITY'; colorClass = 'priority-high'; }
  else if (mark < 60) { level = 'MEDIUM PRIORITY'; colorClass = 'priority-medium'; }
  else if (mark < 75) { level = 'LOW PRIORITY'; colorClass = 'priority-low'; }
  else { level = 'VERY LOW'; colorClass = 'priority-low'; }

  return { level, colorClass, time: baseTime };
}

// ----- 6.  MAIN ANALYSIS FUNCTION – the heart of the study planner -----
function analyze() {
  const name = nameInput.value.trim() || 'Student';
  const days = Number(daysInput.value.trim());
  if (isNaN(days) || days < 0) {
    resultsDiv.innerHTML = `<h2>⚠️ ERROR</h2><p>Please enter a valid number of days (0 or more).</p>`;
    return;
  }

  // Collect subjects and grades from the 7 slots
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

  // If there are errors or no subjects, show error message
  if (!isValid || Object.keys(subjects).length === 0) {
    let output = `<h2>⚠️ INCOMPLETE REGISTER</h2>`;
    if (errors.length) output += `<ul style="color:#ff6b6b;">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
    if (Object.keys(subjects).length === 0 && errors.length === 0) output += `<p>Please enter at least one subject and its grade.</p>`;
    resultsDiv.innerHTML = output;
    return;
  }

  // Build the study plan output
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
    output += `<p>⚠️ <span style="color:#ff2a75;">ULTRA URGENT:</span> Final stretch! Study for at least 4 hours daily.</p>`;
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
  output += `<p>📊 <b>Total daily study time:</b> ${totalMin} minutes (${Math.round(totalMin/60)} hours).</p>`;

  // ----- Save data to localStorage -----
  localStorage.setItem('studyAssistant_name', name);
  localStorage.setItem('studyAssistant_days', daysInput.value);
  for (let i = 1; i <= 7; i++) {
    localStorage.setItem(`studyAssistant_subj_${i}`, document.getElementById(`subject-${i}`).value.trim());
    localStorage.setItem(`studyAssistant_grade_${i}`, document.getElementById(`grade-${i}`).value.trim());
  }

  resultsDiv.innerHTML = output;
}

// ----- 7.  Load saved data from localStorage (on page load) -----
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

// ----- 8.  Clear all data (with confirmation) -----
function clearAll() {
  if (!confirm('Reset the Dojo? All data will be lost!')) return;
  nameInput.value = '';
  daysInput.value = '';
  for (let i = 1; i <= 7; i++) {
    document.getElementById(`subject-${i}`).value = '';
    document.getElementById(`grade-${i}`).value = '';
  }
  resultsDiv.innerHTML = '<p style="color:#445566;">🧹 Dojo reset. Ready for a new journey.</p>';
  localStorage.clear();
}

// ----- 9.  Print the study plan (opens a new window for printing) -----
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
      body { font-family: 'Segoe UI', sans-serif; padding: 2rem; background: #0b0a16; color: #e2e8f0; }
      .priority-high { color: #ff2a75; font-weight:700; }
      .priority-medium { color: #ffdd00; font-weight:700; }
      .priority-low { color: #00f0ff; font-weight:700; }
      .motivation-block { background: #1a1a2e; padding:1rem; border-radius:16px; border-left:4px solid #ff2a75; }
    </style>
    </head><body>
    <h1>📜 My Personal Study Scroll</h1>
    ${content}
    <p><em>Generated by Anime Study Dojo</em></p>
    </body></html>
  `);
  win.document.close();
  win.print();
}

// ----- 10. Event listeners for buttons -----
document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('clearBtn').addEventListener('click', clearAll);
document.getElementById('printBtn').addEventListener('click', printResults);
// Enter key triggers analysis
document.querySelectorAll('input').forEach(inp => inp.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
}));

// ----- 11. Load saved data when page starts -----
window.addEventListener('DOMContentLoaded', loadSavedData);

// ============================================================
// ======  EXTRA MODULES (FOCUS AREAS)  =======================
// ============================================================

// ---------- A. REPAIR & MAINTENANCE LOG ----------
function loadTasks() {
  const tasks = JSON.parse(localStorage.getItem('maintenanceTasks') || '[]');
  const list = document.getElementById('taskList');
  if (tasks.length === 0) {
    list.innerHTML = '<p style="color:#445566;">No tasks yet. Add a maintenance task.</p>';
    return;
  }
  list.innerHTML = tasks.map((task, idx) => `
    <div class="task-item">
      <span><b>${task.name}</b> — ${task.status}</span>
      <button class="del-btn" data-idx="${idx}">✕</button>
    </div>
  `).join('');
  document.querySelectorAll('#taskList .del-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      let tasks = JSON.parse(localStorage.getItem('maintenanceTasks') || '[]');
      tasks.splice(this.dataset.idx, 1);
      localStorage.setItem('maintenanceTasks', JSON.stringify(tasks));
      loadTasks();
    });
  });
}

document.getElementById('addTaskBtn').addEventListener('click', function() {
  const name = document.getElementById('taskInput').value.trim();
  const status = document.getElementById('taskStatus').value.trim() || 'Pending';
  if (!name) return alert('Enter a task name.');
  const tasks = JSON.parse(localStorage.getItem('maintenanceTasks') || '[]');
  tasks.push({ name, status });
  localStorage.setItem('maintenanceTasks', JSON.stringify(tasks));
  document.getElementById('taskInput').value = '';
  document.getElementById('taskStatus').value = '';
  loadTasks();
});

// ---------- B. COMPONENT INVENTORY (Industrial Electronics) ----------
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

// ---------- C. IoT DEVICE STATUS (Communication Tech) ----------
let iotDevices = {
  lamp: true,
  watch: true,
  headphone: true
};

function updateIoTUI() {
  document.getElementById('lampStatus').textContent = iotDevices.lamp ? 'ONLINE' : 'OFFLINE';
  document.getElementById('lampStatus').style.color = iotDevices.lamp ? '#ffdd00' : '#ff2a75';
  document.getElementById('watchStatus').textContent = iotDevices.watch ? 'ONLINE' : 'OFFLINE';
  document.getElementById('watchStatus').style.color = iotDevices.watch ? '#00f0ff' : '#ff2a75';
  document.getElementById('headphoneStatus').textContent = iotDevices.headphone ? 'ONLINE' : 'OFFLINE';
  document.getElementById('headphoneStatus').style.color = iotDevices.headphone ? '#00f0ff' : '#ff2a75';
}

document.getElementById('toggleLamp').addEventListener('click', () => { iotDevices.lamp = !iotDevices.lamp; updateIoTUI(); });
document.getElementById('toggleWatch').addEventListener('click', () => { iotDevices.watch = !iotDevices.watch; updateIoTUI(); });
document.getElementById('toggleHeadphone').addEventListener('click', () => { iotDevices.headphone = !iotDevices.headphone; updateIoTUI(); });

// ---------- D. WEARABLE FOCUS REMINDER (Smartwatch simulation) ----------
let focusTimer = null;
let focusSeconds = 0;

function updateTimerDisplay() {
  const mins = Math.floor(focusSeconds / 60);
  const secs = focusSeconds % 60;
  document.getElementById('timerDisplay').textContent = 
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function showNotification(title, message) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body: message, icon: '📚' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') new Notification(title, { body: message, icon: '📚' });
    });
  }
  document.getElementById('notificationStatus').textContent = '🔔 Notifications: ' + Notification.permission;
}

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
document.getElementById('notificationStatus').textContent = '🔔 Notifications: ' + (Notification.permission || 'not requested');

document.getElementById('startFocusBtn').addEventListener('click', function() {
  const mins = parseInt(document.getElementById('focusMinutes').value) || 25;
  if (focusTimer) return alert('A timer is already running. Stop it first.');
  focusSeconds = mins * 60;
  updateTimerDisplay();
  focusTimer = setInterval(() => {
    focusSeconds--;
    updateTimerDisplay();
    if (focusSeconds <= 0) {
      clearInterval(focusTimer);
      focusTimer = null;
      showNotification('⌚ WEARABLE ALERT!', 'Study session complete! Time for a break, shinobi! 🍵');
      document.getElementById('timerDisplay').textContent = '00:00';
    }
  }, 1000);
  showNotification('⌚ Focus mode engaged', `Study for ${mins} minutes. You got this! 🔥`);
});

document.getElementById('stopFocusBtn').addEventListener('click', function() {
  if (focusTimer) {
    clearInterval(focusTimer);
    focusTimer = null;
    focusSeconds = 0;
    updateTimerDisplay();
    document.getElementById('timerDisplay').textContent = '00:00';
    showNotification('⌚ Focus stopped', 'Timer was cancelled. Rest when you need to.');
  } else {
    alert('No timer running.');
  }
});

// ---------- E. BACKUP & RESTORE (for cross‑device use) ----------
function exportData() {
  const data = {
    studyAssistant_name: localStorage.getItem('studyAssistant_name'),
    studyAssistant_days: localStorage.getItem('studyAssistant_days'),
    maintenanceTasks: JSON.parse(localStorage.getItem('maintenanceTasks') || '[]'),
    componentInventory: JSON.parse(localStorage.getItem('componentInventory') || '[]'),
    // Also export all subject/grade data
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
  a.download = 'anime_dojo_backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      // Restore each piece
      if (data.studyAssistant_name) localStorage.setItem('studyAssistant_name', data.studyAssistant_name);
      if (data.studyAssistant_days) localStorage.setItem('studyAssistant_days', data.studyAssistant_days);
      if (data.maintenanceTasks) localStorage.setItem('maintenanceTasks', JSON.stringify(data.maintenanceTasks));
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
      alert('Data imported successfully! Please refresh the page to see all your data.');
      // Reload all UI
      loadSavedData();
      loadTasks();
      loadComponents();
      updateIoTUI();
    } catch (err) {
      alert('Failed to import data. Please check the file format.');
    }
  };
  reader.readAsText(file);
}

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', function(e) {
  if (this.files.length) {
    importData(this.files[0]);
    this.value = ''; // reset so same file can be chosen again
  }
});

// ---------- Load extra data on start ----------
document.addEventListener('DOMContentLoaded', function() {
  loadTasks();
  loadComponents();
  updateIoTUI();
});