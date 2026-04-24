<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CRDT Sync (Yjs)</title></head>
<body style="font-family:system-ui;max-width:820px;margin:18px">
  <h2>CRDT Form Sync (Yjs)</h2>
  <p>Edits merge automatically (CRDT). Works offline and syncs when connected. [3](https://yjs.dev/)[5](https://www.askantech.com/real-time-data-sync-distributed-systems-crdt-operational-transform-event-sourcing/)</p>

  <input id="student" placeholder="Student name"/>
  <input id="grade" placeholder="Grade"/>
  <input id="score" placeholder="Score"/>
  <pre id="state"></pre>

  <script type="module">
    import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.20/+esm";
    import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@1.5.0/+esm";
    import { IndexeddbPersistence } from "https://cdn.jsdelivr.net/npm/y-indexeddb@9.0.12/+esm";

    const ydoc = new Y.Doc();

    // Offline persistence (local IndexedDB)
    const persistence = new IndexeddbPersistence("baseline-crdt-doc", ydoc);
    persistence.on("synced", () => console.log("Loaded from IndexedDB"));

    // Sync transport (WebSocket relay)
    // You need a websocket server (y-websocket) or a hosted service.
    // Yjs is network-agnostic and can sync via websocket/webrtc/etc. [3](https://yjs.dev/)
    const provider = new WebsocketProvider("wss://YOUR_WEBSOCKET_SERVER", "room-baseline", ydoc);

    const form = ydoc.getMap("form"); // shared map (CRDT)
    const $ = (id) => document.getElementById(id);
    const render = () => $("state").textContent = JSON.stringify(form.toJSON(), null, 2);

    // Apply local edits as CRDT operations
    ["student","grade","score"].forEach((k) => {
      $(k).addEventListener("input", (e) => {
        ydoc.transact(() => form.set(k, e.target.value));
      });
    });

    // Reflect remote edits
    form.observe(render);
    render();
  </script>
</body>
</html>
