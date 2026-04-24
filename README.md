<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Cross‑Device Sync (Firestore Offline‑First)</title>
  <style>
    body{font-family:system-ui;margin:18px;max-width:880px}
    input,button,textarea{padding:10px;margin:6px 0;width:100%}
    .row{display:flex;gap:12px}
    .row > *{flex:1}
    .small{font-size:12px;opacity:.75}
    pre{background:#f6f6f6;padding:10px;overflow:auto}
    .item{border:1px solid #ddd;padding:10px;border-radius:8px;margin:8px 0}
  </style>
</head>
<body>
  <h2>Offline‑First Sync Across Devices (Firestore)</h2>
  <p class="small">
    This sync model caches data locally and syncs automatically when connectivity returns. [1](https://firebase.google.com/docs/firestore/manage-data/enable-offline)[2](https://firebase.google.com/docs/firestore/)
  </p>

  <div class="row">
    <input id="deviceId" placeholder="Device ID (e.g. phone1, laptopA)" />
    <input id="collection" placeholder="Collection name (e.g. baseline_entries)" value="baseline_entries"/>
  </div>

  <textarea id="payload" rows="6" placeholder='JSON data to save, e.g. {"student":"Asha","score":12,"grade":3}'></textarea>
  <button id="saveBtn">Save (Sync)</button>

  <h3>Live feed (updates appear on all devices)</h3>
  <div id="list"></div>

  <h4>Debug</h4>
  <pre id="debug"></pre>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
    import {
      initializeFirestore,
      persistentLocalCache,
      persistentMultipleTabManager,
      collection,
      addDoc,
      serverTimestamp,
      query,
      orderBy,
      limit,
      onSnapshot
    } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

    // 1) Firebase config (fill from Firebase Console)
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
    };

    // 2) Initialize app + Firestore with persistent cache (IndexedDB)
    // Firestore supports offline persistence and syncs changes when online again. [1](https://firebase.google.com/docs/firestore/manage-data/enable-offline)[2](https://firebase.google.com/docs/firestore/)
    const app = initializeApp(firebaseConfig);
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });

    const $ = (id) => document.getElementById(id);
    const dbg = (msg, obj) => {
      $("debug").textContent = msg + (obj ? "\n" + JSON.stringify(obj, null, 2) : "");
    };

    function getCollRef() {
      const name = $("collection").value.trim() || "baseline_entries";
      return collection(db, name);
    }

    // 3) Live listener (real-time sync)
    // Firestore provides realtime updates via listeners and works with cached data offline. [2](https://firebase.google.com/docs/firestore/)[1](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
    function startListener() {
      const q = query(getCollRef(), orderBy("createdAt", "desc"), limit(30));
      return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        const el = $("list");
        el.innerHTML = "";
        snap.docs.forEach(d => {
          const data = d.data();
          const fromCache = d.metadata?.fromCache ? " (from cache/offline)" : " (from server)";
          const div = document.createElement("div");
          div.className = "item";
          div.innerHTML = `
            <div><b>ID:</b> ${d.id}${fromCache}</div>
            <div><b>deviceId:</b> ${data.deviceId ?? "-"}</div>
            <div><b>createdAt:</b> ${data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : "-"}</div>
            <pre>${JSON.stringify(data.payload, null, 2)}</pre>
          `;
          el.appendChild(div);
        });
        dbg("Listener active. Docs: " + snap.size, {
          hasPendingWrites: snap.metadata?.hasPendingWrites
        });
      });
    }

    let unsub = startListener();

    // 4) Save data (works offline; queues writes; syncs later)
    $("saveBtn").onclick = async () => {
      try {
        const deviceId = $("deviceId").value.trim() || ("device_" + Math.random().toString(16).slice(2));
        const payloadText = $("payload").value.trim();
        const payload = payloadText ? JSON.parse(payloadText) : {};

        const doc = {
          deviceId,
          payload,
          createdAt: serverTimestamp(),
          // Optional: version for your own conflict policy if you update existing docs
          v: Date.now()
        };

        await addDoc(getCollRef(), doc);
        dbg("Saved. If offline, it will sync automatically when online again.", doc);
        $("payload").value = "";
      } catch (e) {
        dbg("ERROR: " + e.message);
      }
    };
  </script>
</body>
</html>
<!DOCTYPE html>

<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TaRL Teacher Support | Local Sync | Multi‑Device</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        .modal { transition: opacity 0.2s; }
        .tab-btn { transition: all 0.2s; }
    </style>
</head>
<body class="bg-gray-50 font-sans">
<div class="max-w-7xl mx-auto px-4 py-6">
    <div class="flex flex-wrap justify-between items-center mb-6 border-b pb-4">
        <div>
            <h1 class="text-2xl font-bold text-green-800"><i class="fas fa-chalkboard-user mr-2"></i>TaRL Teacher Support System</h1>
            <p class="text-sm text-gray-500">SMILE Project | Real‑time sync across devices (Local network)</p>
        </div>
        <div class="flex items-center space-x-3">
            <span id="syncStatus" class="text-sm bg-white px-3 py-1 rounded-full shadow"><i class="fas fa-circle-notch fa-spin mr-1"></i> Connecting...</span>
        </div>
    </div>

    <!-- Dashboard cards -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500"><div class="text-gray-500 text-sm">Total Students</div><div class="text-3xl font-bold" id="statStudents">0</div></div>
        <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500"><div class="text-gray-500 text-sm">Reading Goal (Word+)</div><div class="text-3xl font-bold" id="statReadingGoal">0%</div></div>
        <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500"><div class="text-gray-500 text-sm">Lesson Plans</div><div class="text-3xl font-bold" id="statLessons">0</div></div>
        <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500"><div class="text-gray-500 text-sm">Avg Reading Score</div><div class="text-3xl font-bold" id="statAvgReading">--</div></div>
    </div>

    <!-- Tabs -->
    <div class="flex flex-wrap border-b gap-2 mb-4">
        <button class="tab-btn py-2 px-4 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent" data-tab="dashboard">📊 Dashboard</button>
        <button class="tab-btn py-2 px-4 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent" data-tab="students">👩‍🎓 Students & Levels</button>
        <button class="tab-btn py-2 px-4 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent" data-tab="planning">📅 Lesson Planning</button>
        <button class="tab-btn py-2 px-4 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent" data-tab="gradebook">📊 Gradebook</button>
        <button class="tab-btn py-2 px-4 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent" data-tab="reports">📈 Reports & Analytics</button>
    </div>

    <!-- Dashboard tab -->
    <div id="tab-dashboard" class="tab-content"><div class="bg-white rounded-xl shadow p-5"><h2 class="text-xl font-bold mb-3">Recent Activity</h2><ul id="recentActivities" class="space-y-2 text-gray-700 max-h-64 overflow-y-auto"></ul><div class="mt-5 p-3 bg-blue-50 rounded-lg text-sm"><i class="fas fa-wifi text-blue-600 mr-2"></i> Connected to local server. All changes sync instantly across devices.</div></div></div>

    <!-- Students tab -->
    <div id="tab-students" class="tab-content hidden"><div class="bg-white rounded-xl shadow p-5"><div class="flex flex-wrap justify-between items-center mb-4"><h2 class="text-xl font-bold">Student Roster (TaRL Levels)</h2><button id="newStudentBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus"></i> Add Student</button></div><div class="overflow-x-auto"><table class="min-w-full border text-sm"><thead class="bg-gray-100"><tr><th class="p-2 text-left">Name</th><th>Grade</th><th>Reading Level</th><th>Numeracy Level</th><th>Actions</th></tr></thead><tbody id="studentTableBody"></tbody></table></div><div class="mt-3 text-xs text-gray-500">TaRL: Beginner → Letter → Word → Paragraph. Regroup every 4–6 weeks.</div></div></div>

    <!-- Lesson planning tab -->
    <div id="tab-planning" class="tab-content hidden"><div class="bg-white rounded-xl shadow p-5"><div class="flex justify-between mb-4"><h2 class="text-xl font-bold">Weekly TaRL Lesson Plans</h2><button id="newLessonBtn" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus"></i> Add Lesson</button></div><div class="overflow-x-auto"><table class="min-w-full border text-sm"><thead class="bg-gray-100"><tr><th>Week</th><th>Day</th><th>Level</th><th>Objective</th><th>Activities</th><th>Actions</th></tr></thead><tbody id="lessonTableBody"></tbody></table></div></div></div>

    <!-- Gradebook tab -->
    <div id="tab-gradebook" class="tab-content hidden"><div class="bg-white rounded-xl shadow p-5"><div class="flex justify-between mb-4"><h2 class="text-xl font-bold">Assessment & Grade Records</h2><button id="newGradeBtn" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus"></i> Add Grade/Assessment</button></div><div class="overflow-x-auto"><table class="min-w-full border text-sm"><thead class="bg-gray-100"><tr><th>Student</th><th>Assessment</th><th>Reading (%)</th><th>Numeracy (%)</th><th>Date</th><th>Actions</th></tr></thead><tbody id="gradeTableBody"></tbody></table></div></div></div>

    <!-- Reports tab -->
    <div id="tab-reports" class="tab-content hidden"><div class="bg-white rounded-xl shadow p-5"><div class="flex flex-wrap justify-between items-center mb-4"><h2 class="text-xl font-bold">Quantitative & Narrative Report</h2><button id="copyReportBtn" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-copy"></i> Copy Full Report</button></div><div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-center"><div class="bg-gray-100 p-2 rounded"><span class="font-bold">Total Students</span><br><span id="reportTotalStudents" class="text-2xl">0</span></div><div class="bg-gray-100 p-2 rounded"><span class="font-bold">Reading Proficient</span><br><span id="reportReadingProficient" class="text-2xl">0%</span></div><div class="bg-gray-100 p-2 rounded"><span class="font-bold">Avg Reading Score</span><br><span id="reportAvgReadingScore" class="text-2xl">--</span></div><div class="bg-gray-100 p-2 rounded"><span class="font-bold">Avg Numeracy Score</span><br><span id="reportAvgNumeracyScore" class="text-2xl">--</span></div></div><div class="grid md:grid-cols-2 gap-6 mb-6"><div><canvas id="readingLevelChart"></canvas></div><div><canvas id="numeracyLevelChart"></canvas></div></div><div class="mb-6"><canvas id="trendChart"></canvas></div><div class="bg-gray-50 p-4 rounded-lg border"><h3 class="font-bold text-lg mb-2"><i class="fas fa-file-alt"></i> Narrative Report</h3><div id="narrativeText" class="text-gray-700 whitespace-pre-line"></div></div></div></div>

    <!-- MODALS -->
    <div id="studentModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center hidden z-50"><div class="bg-white rounded-lg w-full max-w-md p-6"><div class="flex justify-between"><h3 id="studentModalTitle" class="text-lg font-bold">Add Student</h3><button class="close-modal text-gray-500 text-2xl">&times;</button></div><form id="studentForm"><input type="hidden" id="studentId"><div class="mt-2"><label class="block font-medium">Full Name</label><input type="text" id="studentName" required class="w-full border p-2 rounded"></div><div class="mt-2"><label>Grade</label><select id="studentGrade" class="w-full border p-2 rounded"><option>3</option><option>4</option><option>5</option></select></div><div class="mt-2"><label>Reading Level</label><select id="readingLevel" class="w-full border p-2 rounded"><option>Beginner</option><option>Letter</option><option>Word</option><option>Paragraph</option></select></div><div class="mt-2"><label>Numeracy Level</label><select id="numeracyLevel" class="w-full border p-2 rounded"><option>Beginner</option><option>Number ID</option><option>Addition</option><option>Subtraction</option></select></div><div class="mt-4 flex justify-end"><button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Save</button></div></form></div></div>

    <div id="lessonModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center hidden z-50"><div class="bg-white rounded-lg w-full max-w-md p-6"><div class="flex justify-between"><h3 id="lessonModalTitle" class="text-lg font-bold">Lesson Plan</h3><button class="close-modal text-gray-500 text-2xl">&times;</button></div><form id="lessonForm"><input type="hidden" id="lessonId"><div><label>Week</label><input type="text" id="lessonWeek" class="w-full border p-2 rounded"></div><div><label>Day</label><input type="text" id="lessonDay" class="w-full border p-2 rounded"></div><div><label>TaRL Level</label><select id="lessonLevel" class="w-full border p-2 rounded"><option>Beginner</option><option>Letter</option><option>Word</option><option>Paragraph</option></select></div><div><label>Learning Objective</label><textarea id="lessonObjective" rows="2" class="w-full border p-2 rounded"></textarea></div><div><label>Activities / Materials</label><textarea id="lessonActivities" rows="2" class="w-full border p-2 rounded"></textarea></div><div class="mt-4 flex justify-end"><button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Save</button></div></form></div></div>

    <div id="gradeModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center hidden z-50"><div class="bg-white rounded-lg w-full max-w-md p-6"><div class="flex justify-between"><h3 id="gradeModalTitle" class="text-lg font-bold">Assessment / Grade</h3><button class="close-modal text-gray-500 text-2xl">&times;</button></div><form id="gradeForm"><input type="hidden" id="gradeId"><div><label>Student</label><select id="gradeStudentId" required class="w-full border p-2 rounded"></select></div><div><label>Assessment Type</label><select id="gradeType" class="w-full border p-2 rounded"><option>Baseline</option><option>Mid‑term</option><option>Endline</option><option>Weekly Formative</option></select></div><div><label>Reading Score (%)</label><input type="number" id="gradeReading" class="w-full border p-2 rounded"></div><div><label>Numeracy Score (%)</label><input type="number" id="gradeNumeracy" class="w-full border p-2 rounded"></div><div><label>Date</label><input type="date" id="gradeDate" class="w-full border p-2 rounded"></div><div class="mt-4 flex justify-end"><button type="submit" class="bg-purple-600 text-white px-4 py-2 rounded">Save</button></div></form></div></div>
</div>

<script>
    const socket = io();

    // Global state
    let students = [], lessons = [], grades = [];
    let readingChart, numeracyChart, trendChart;

    // DOM elements
    const studentTableBody = document.getElementById('studentTableBody');
    const lessonTableBody = document.getElementById('lessonTableBody');
    const gradeTableBody = document.getElementById('gradeTableBody');
    const syncStatusSpan = document.getElementById('syncStatus');

    function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }
    function getLevelBadge(lvl) { const c = { Beginner:'bg-gray-300', Letter:'bg-blue-100', Word:'bg-green-100', Paragraph:'bg-purple-100' }; return c[lvl] || 'bg-gray-200'; }

    // Render functions
    function renderStudents() {
        studentTableBody.innerHTML = students.map(s => `<tr class="border-b"><td class="p-2 font-medium">${escapeHtml(s.name)}</td><td class="p-2">Grade ${s.grade||'3'}</td><td class="p-2"><span class="px-2 py-1 rounded-full text-xs font-bold ${getLevelBadge(s.readingLevel)}">${s.readingLevel||'Beginner'}</span></td><td class="p-2"><span class="px-2 py-1 rounded-full text-xs font-bold ${getLevelBadge(s.numeracyLevel)}">${s.numeracyLevel||'Beginner'}</span></td><td class="p-2"><button class="edit-student text-blue-600 mr-2" data-id="${s.id}"><i class="fas fa-edit"></i></button><button class="delete-student text-red-600" data-id="${s.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        attachStudentEvents();
    }
    function attachStudentEvents() {
        document.querySelectorAll('.edit-student').forEach(btn => btn.addEventListener('click', () => editStudent(btn.dataset.id)));
        document.querySelectorAll('.delete-student').forEach(btn => btn.addEventListener('click', () => deleteStudent(btn.dataset.id)));
    }
    function renderLessons() {
        lessonTableBody.innerHTML = lessons.map(l => `<tr class="border-b"><td class="p-2">Week ${l.week||'-'}</td><td class="p-2">${l.day||'-'}</td><td class="p-2">${l.levelGroup||'-'}</td><td class="p-2 max-w-xs">${escapeHtml(l.objective||'')}</td><td class="p-2 max-w-xs">${escapeHtml(l.activities||'')}</td><td class="p-2"><button class="edit-lesson text-blue-600 mr-2" data-id="${l.id}"><i class="fas fa-edit"></i></button><button class="delete-lesson text-red-600" data-id="${l.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        attachLessonEvents();
    }
    function attachLessonEvents() {
        document.querySelectorAll('.edit-lesson').forEach(btn => btn.addEventListener('click', () => editLesson(btn.dataset.id)));
        document.querySelectorAll('.delete-lesson').forEach(btn => btn.addEventListener('click', () => deleteLesson(btn.dataset.id)));
    }
    function renderGrades() {
        gradeTableBody.innerHTML = grades.map(g => {
            const stu = students.find(s => s.id === g.studentId);
            return `<tr class="border-b"><td class="p-2">${escapeHtml(stu?.name||'Unknown')}</td><td class="p-2">${g.assessmentType||'Formative'}</td><td class="p-2">${g.readingScore??'-'}</td><td class="p-2">${g.numeracyScore??'-'}</td><td class="p-2">${g.date||''}</td><td class="p-2"><button class="edit-grade text-blue-600 mr-2" data-id="${g.id}"><i class="fas fa-edit"></i></button><button class="delete-grade text-red-600" data-id="${g.id}"><i class="fas fa-trash"></i></button></td></tr>`;
        }).join('');
        attachGradeEvents();
    }
    function attachGradeEvents() {
        document.querySelectorAll('.edit-grade').forEach(btn => btn.addEventListener('click', () => editGrade(btn.dataset.id)));
        document.querySelectorAll('.delete-grade').forEach(btn => btn.addEventListener('click', () => deleteGrade(btn.dataset.id)));
    }

    // CRUD via sockets
    function addStudent(data) { socket.emit('addStudent', data); }
    function updateStudent(id, data) { socket.emit('updateStudent', { id, ...data }); }
    function deleteStudent(id) { if(confirm('Delete student?')) socket.emit('deleteStudent', id); }
    function addLesson(data) { socket.emit('addLesson', data); }
    function updateLesson(id, data) { socket.emit('updateLesson', { id, ...data }); }
    function deleteLesson(id) { if(confirm('Delete lesson?')) socket.emit('deleteLesson', id); }
    function addGrade(data) { socket.emit('addGrade', data); }
    function updateGrade(id, data) { socket.emit('updateGrade', { id, ...data }); }
    function deleteGrade(id) { if(confirm('Delete grade?')) socket.emit('deleteGrade', id); }

    // Edit helpers
    function editStudent(id) { const s = students.find(x => x.id === id); if(s) { document.getElementById('studentId').value = s.id; document.getElementById('studentName').value = s.name; document.getElementById('studentGrade').value = s.grade; document.getElementById('readingLevel').value = s.readingLevel; document.getElementById('numeracyLevel').value = s.numeracyLevel; document.getElementById('studentModalTitle').innerText = 'Edit Student'; document.getElementById('studentModal').classList.remove('hidden'); } }
    function editLesson(id) { const l = lessons.find(x => x.id === id); if(l) { document.getElementById('lessonId').value = l.id; document.getElementById('lessonWeek').value = l.week; document.getElementById('lessonDay').value = l.day; document.getElementById('lessonLevel').value = l.levelGroup; document.getElementById('lessonObjective').value = l.objective; document.getElementById('lessonActivities').value = l.activities; document.getElementById('lessonModalTitle').innerText = 'Edit Lesson'; document.getElementById('lessonModal').classList.remove('hidden'); } }
    function editGrade(id) { const g = grades.find(x => x.id === id); if(g) { document.getElementById('gradeId').value = g.id; document.getElementById('gradeStudentId').value = g.studentId; document.getElementById('gradeType').value = g.assessmentType; document.getElementById('gradeReading').value = g.readingScore; document.getElementById('gradeNumeracy').value = g.numeracyScore; document.getElementById('gradeDate').value = g.date; document.getElementById('gradeModalTitle').innerText = 'Edit Grade'; document.getElementById('gradeModal').classList.remove('hidden'); } }

    // Update all dashboard and charts
    function updateAllUI() {
        document.getElementById('statStudents').innerText = students.length;
        const proficient = students.filter(s => s.readingLevel === 'Word' || s.readingLevel === 'Paragraph').length;
        const pct = students.length ? Math.round(proficient/students.length*100) : 0;
        document.getElementById('statReadingGoal').innerText = pct+'%';
        document.getElementById('statLessons').innerText = lessons.length;
        let readingScores = grades.map(g => g.readingScore).filter(v => v != null);
        let avgRead = readingScores.length ? Math.round(readingScores.reduce((a,b)=>a+b,0)/readingScores.length) : null;
        document.getElementById('statAvgReading').innerHTML = avgRead !== null ? avgRead+'%' : '--%';
        // reports
        document.getElementById('reportTotalStudents').innerText = students.length;
        document.getElementById('reportReadingProficient').innerText = pct+'%';
        let readingVals = grades.map(g => g.readingScore).filter(v=>v!=null);
        let numeracyVals = grades.map(g => g.numeracyScore).filter(v=>v!=null);
        document.getElementById('reportAvgReadingScore').innerHTML = readingVals.length ? Math.round(readingVals.reduce((a,b)=>a+b,0)/readingVals.length) : '--';
        document.getElementById('reportAvgNumeracyScore').innerHTML = numeracyVals.length ? Math.round(numeracyVals.reduce((a,b)=>a+b,0)/numeracyVals.length) : '--';
        // charts
        const readingCounts = { Beginner:0, Letter:0, Word:0, Paragraph:0 };
        students.forEach(s => { if(s.readingLevel) readingCounts[s.readingLevel]++; });
        if(readingChart) readingChart.destroy();
        const ctx1 = document.getElementById('readingLevelChart').getContext('2d');
        readingChart = new Chart(ctx1, { type:'bar', data:{ labels:['Beginner','Letter','Word','Paragraph'], datasets:[{ label:'Students', data:[readingCounts.Beginner,readingCounts.Letter,readingCounts.Word,readingCounts.Paragraph], backgroundColor:'#3b82f6' }] } });
        const numeracyCounts = { Beginner:0, 'Number ID':0, Addition:0, Subtraction:0 };
        students.forEach(s => { let l = s.numeracyLevel||'Beginner'; if(numeracyCounts[l]!==undefined) numeracyCounts[l]++; else numeracyCounts.Beginner++; });
        if(numeracyChart) numeracyChart.destroy();
        const ctx2 = document.getElementById('numeracyLevelChart').getContext('2d');
        numeracyChart = new Chart(ctx2, { type:'bar', data:{ labels:['Beginner','Number ID','Addition','Subtraction'], datasets:[{ label:'Students', data:[numeracyCounts.Beginner, numeracyCounts['Number ID'], numeracyCounts.Addition, numeracyCounts.Subtraction], backgroundColor:'#10b981' }] } });
        const trendMap = { Baseline:[], 'Mid‑term':[], Endline:[] };
        grades.forEach(g => { if(g.readingScore && trendMap[g.assessmentType]) trendMap[g.assessmentType].push(Number(g.readingScore)); });
        const trendData = ['Baseline','Mid‑term','Endline'].map(t => { let arr = trendMap[t]; return arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null; });
        if(trendChart) trendChart.destroy();
        const ctx3 = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctx3, { type:'line', data:{ labels:['Baseline','Mid‑term','Endline'], datasets:[{ label:'Avg Reading Score (%)', data:trendData, borderColor:'#f59e0b', fill:false }] } });
        // narrative
        let narrative = `📋 QUANTITATIVE SUMMARY (${students.length} students)\n• Reading proficient (Word+): ${pct}%\n• Avg reading score: ${avgRead !== null ? avgRead+'%' : 'N/A'}\n• Lesson plans: ${lessons.length}\n\n📊 Level distribution\nReading: Beginner ${readingCounts.Beginner}, Letter ${readingCounts.Letter}, Word ${readingCounts.Word}, Paragraph ${readingCounts.Paragraph}\n\n📈 Recommendations:\n${pct>=80 ? 'Excellent progress. Focus on fluency.' : (pct>=50 ? 'Good progress. Support Beginner groups.' : 'Critical: Intensive TaRL for Beginner/Letter.')}`;
        document.getElementById('narrativeText').innerText = narrative;
        // recent activities
        const recentList = document.getElementById('recentActivities');
        if(recentList) recentList.innerHTML = grades.slice(-5).reverse().map(g => { const s = students.find(x=>x.id===g.studentId); return `<li>${s?.name||'?'} – ${g.assessmentType}: R ${g.readingScore??'N/A'} / N ${g.numeracyScore??'N/A'}</li>`; }).join('');
        renderStudents(); renderLessons(); renderGrades();
    }

    // Socket events
    socket.on('connect', () => { syncStatusSpan.innerHTML = '<i class="fas fa-check-circle text-green-600"></i> Synced (live)'; });
    socket.on('disconnect', () => { syncStatusSpan.innerHTML = '<i class="fas fa-exclamation-triangle text-yellow-600"></i> Disconnected'; });
    socket.on('initialData', (data) => { students = data.students; lessons = data.lessons; grades = data.grades; updateAllUI(); });
    socket.on('studentAdded', (s) => { students.push(s); updateAllUI(); });
    socket.on('studentUpdated', (s) => { const idx = students.findIndex(x=>x.id===s.id); if(idx!==-1) students[idx]=s; updateAllUI(); });
    socket.on('studentDeleted', (id) => { students = students.filter(x=>x.id!==id); updateAllUI(); });
    socket.on('lessonAdded', (l) => { lessons.push(l); updateAllUI(); });
    socket.on('lessonUpdated', (l) => { const idx = lessons.findIndex(x=>x.id===l.id); if(idx!==-1) lessons[idx]=l; updateAllUI(); });
    socket.on('lessonDeleted', (id) => { lessons = lessons.filter(x=>x.id!==id); updateAllUI(); });
    socket.on('gradeAdded', (g) => { grades.push(g); updateAllUI(); });
    socket.on('gradeUpdated', (g) => { const idx = grades.findIndex(x=>x.id===g.id); if(idx!==-1) grades[idx]=g; updateAllUI(); });
    socket.on('gradeDeleted', (id) => { grades = grades.filter(x=>x.id!==id); updateAllUI(); });

    // Form submissions
    document.getElementById('studentForm').addEventListener('submit', (e) => { e.preventDefault(); const id = document.getElementById('studentId').value; const data = { name: document.getElementById('studentName').value, grade: document.getElementById('studentGrade').value, readingLevel: document.getElementById('readingLevel').value, numeracyLevel: document.getElementById('numeracyLevel').value }; if(id) updateStudent(id, data); else addStudent(data); document.getElementById('studentModal').classList.add('hidden'); document.getElementById('studentForm').reset(); document.getElementById('studentId').value = ''; });
    document.getElementById('lessonForm').addEventListener('submit', (e) => { e.preventDefault(); const id = document.getElementById('lessonId').value; const data = { week: document.getElementById('lessonWeek').value, day: document.getElementById('lessonDay').value, levelGroup: document.getElementById('lessonLevel').value, objective: document.getElementById('lessonObjective').value, activities: document.getElementById('lessonActivities').value }; if(id) updateLesson(id, data); else addLesson(data); document.getElementById('lessonModal').classList.add('hidden'); document.getElementById('lessonForm').reset(); document.getElementById('lessonId').value = ''; });
    document.getElementById('gradeForm').addEventListener('submit', (e) => { e.preventDefault(); const id = document.getElementById('gradeId').value; const data = { studentId: document.getElementById('gradeStudentId').value, assessmentType: document.getElementById('gradeType').value, readingScore: parseInt(document.getElementById('gradeReading').value)||null, numeracyScore: parseInt(document.getElementById('gradeNumeracy').value)||null, date: document.getElementById('gradeDate').value }; if(id) updateGrade(id, data); else addGrade(data); document.getElementById('gradeModal').classList.add('hidden'); document.getElementById('gradeForm').reset(); document.getElementById('gradeId').value = ''; });
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => { document.getElementById('studentModal')?.classList.add('hidden'); document.getElementById('lessonModal')?.classList.add('hidden'); document.getElementById('gradeModal')?.classList.add('hidden'); }));
    document.getElementById('newStudentBtn').addEventListener('click', () => { document.getElementById('studentForm').reset(); document.getElementById('studentId').value = ''; document.getElementById('studentModalTitle').innerText = 'Add Student'; document.getElementById('studentModal').classList.remove('hidden'); });
    document.getElementById('newLessonBtn').addEventListener('click', () => { document.getElementById('lessonForm').reset(); document.getElementById('lessonId').value = ''; document.getElementById('lessonModalTitle').innerText = 'Add Lesson Plan'; document.getElementById('lessonModal').classList.remove('hidden'); });
    document.getElementById('newGradeBtn').addEventListener('click', () => { document.getElementById('gradeForm').reset(); document.getElementById('gradeId').value = ''; document.getElementById('gradeModalTitle').innerText = 'Add Assessment'; document.getElementById('gradeModal').classList.remove('hidden'); });
    document.getElementById('copyReportBtn').addEventListener('click', () => { const txt = document.getElementById('narrativeText').innerText; navigator.clipboard.writeText(txt + `\n\nGenerated: ${new Date()}`); alert('Report copied!'); });
    setInterval(() => { const sel = document.getElementById('gradeStudentId'); if(sel) { const cur = sel.value; sel.innerHTML = '<option value="">-- Select Student --</option>' + students.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (G${s.grade})</option>`).join(''); if(cur && students.find(s=>s.id===cur)) sel.value = cur; } }, 800);

    // Tabs
    const tabs = document.querySelectorAll('.tab-btn'), contents = document.querySelectorAll('.tab-content');
    tabs.forEach(btn => btn.addEventListener('click', () => { const target = btn.dataset.tab; tabs.forEach(b => b.classList.remove('border-blue-600','text-blue-600','border-b-2')); btn.classList.add('border-blue-600','text-blue-600','border-b-2'); contents.forEach(c => c.classList.add('hidden')); document.getElementById(`tab-${target}`)?.classList.remove('hidden'); if(target === 'reports') setTimeout(updateAllUI, 50); }));
</script>
</body>
</html>const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve static files (the HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// In‑memory data store
let students = [];
let lessons = [];
let grades = [];
let nextId = { students: 1, lessons: 1, grades: 1 };

// Helper to generate simple IDs
function generateId(collection) {
    return String(nextId[collection]++);
}

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send current data to the new client
    socket.emit('initialData', { students, lessons, grades });

    // Student CRUD
    socket.on('addStudent', (data, callback) => {
        const newStudent = { id: generateId('students'), ...data };
        students.push(newStudent);
        io.emit('studentAdded', newStudent);
        if (callback) callback({ success: true, id: newStudent.id });
    });

    socket.on('updateStudent', (data) => {
        const index = students.findIndex(s => s.id === data.id);
        if (index !== -1) {
            students[index] = { ...students[index], ...data };
            io.emit('studentUpdated', students[index]);
        }
    });

    socket.on('deleteStudent', (id) => {
        students = students.filter(s => s.id !== id);
        io.emit('studentDeleted', id);
    });

    // Lesson CRUD
    socket.on('addLesson', (data, callback) => {
        const newLesson = { id: generateId('lessons'), ...data };
        lessons.push(newLesson);
        io.emit('lessonAdded', newLesson);
        if (callback) callback({ success: true, id: newLesson.id });
    });

    socket.on('updateLesson', (data) => {
        const index = lessons.findIndex(l => l.id === data.id);
        if (index !== -1) {
            lessons[index] = { ...lessons[index], ...data };
            io.emit('lessonUpdated', lessons[index]);
        }
    });

    socket.on('deleteLesson', (id) => {
        lessons = lessons.filter(l => l.id !== id);
        io.emit('lessonDeleted', id);
    });

    // Grade CRUD
    socket.on('addGrade', (data, callback) => {
        const newGrade = { id: generateId('grades'), ...data };
        grades.push(newGrade);
        io.emit('gradeAdded', newGrade);
        if (callback) callback({ success: true, id: newGrade.id });
    });

    socket.on('updateGrade', (data) => {
        const index = grades.findIndex(g => g.id === data.id);
        if (index !== -1) {
            grades[index] = { ...grades[index], ...data };
            io.emit('gradeUpdated', grades[index]);
        }
    });

    socket.on('deleteGrade', (id) => {
        grades = grades.filter(g => g.id !== id);
        io.emit('gradeDeleted', id);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start server on port 3000 (or use environment variable)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`On other devices, use http://<YOUR_SERVER_IP>:${PORT}`);
});
