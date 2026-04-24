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
