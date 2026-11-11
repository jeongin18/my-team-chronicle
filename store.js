// 저장소: Firebase Firestore(실시간) 또는 체험 모드(localStorage)
window.Store = (function () {
  const cfg = window.APP_CONFIG || {};
  const COL = cfg.collection || "chronicle";
  const useFirebase = !!(cfg.firebase && cfg.firebase.apiKey);
  let db = null, fs = null;
  const LS_KEY = "chronicle_demo_" + COL;
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(LS_KEY) : null;

  async function init() {
    if (!useFirebase) return { mode: "demo" };
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const app = appMod.initializeApp(cfg.firebase);
    db = fs.getFirestore(app);
    return { mode: "firebase" };
  }

  function readAllLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
  }
  function writeAllLocal(all) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch (e) {}
    if (bc) bc.postMessage("changed");
  }

  async function get(sid) {
    if (!useFirebase) return readAllLocal()[sid] || null;
    const snap = await fs.getDoc(fs.doc(db, COL, sid));
    return snap.exists() ? snap.data() : null;
  }

  async function save(sid, data) {
    data.updatedAt = Date.now();
    if (!useFirebase) {
      const all = readAllLocal();
      all[sid] = Object.assign({}, all[sid] || {}, data);
      writeAllLocal(all);
      return;
    }
    await fs.setDoc(fs.doc(db, COL, sid), data, { merge: true });
  }

  function watchAll(cb) {
    if (!useFirebase) {
      const emit = () => cb(Object.values(readAllLocal()));
      emit();
      window.addEventListener("storage", e => { if (e.key === LS_KEY) emit(); });
      if (bc) bc.onmessage = emit;
      setInterval(emit, 3000);
      return;
    }
    fs.onSnapshot(fs.collection(db, COL), snap => {
      cb(snap.docs.map(d => d.data()));
    });
  }

  return { init, get, save, watchAll, get mode() { return useFirebase ? "firebase" : "demo"; } };
})();
