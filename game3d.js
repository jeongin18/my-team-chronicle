// 「나의 팀 연대기」 명장면 재현 3D (Three.js r170, MIT)
// 한 타석(볼카운트) 승부. 타격: 포수 뒤 중계 시점 / 투구: 중견수 쪽 망원 시점.
// models/ 폴더에 Mixamo FBX(캐릭터+애니메이션)를 넣으면 실제 사람 모양 선수로 바뀌어요(README 참고).
import * as THREE from "./vendor/three.module.min.js";

const MOUND_Z = 18.44, BASE = 27.43;

function supported() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
  catch (e) { return false; }
}

// ───────── 난이도 ─────────
const LEVELS = {
  easy:   { label: "쉬움",   speed: 1.3, good: .12,  perf: .05,  meter: "full", ballRate: .2,  types: ["직구", "직구", "체인지업"], aim: 1.3, center: .14, contact: .15 },
  normal: { label: "보통",   speed: 1.0, good: .085, perf: .035, meter: "bar",  ballRate: .35, types: ["직구", "직구", "슬라이더", "체인지업"], aim: 1.9, center: .10, contact: .25 },
  hard:   { label: "어려움", speed: .82, good: .06,  perf: .025, meter: "none", ballRate: .4,  types: ["직구", "슬라이더", "커브", "체인지업"], aim: 2.6, center: .08, contact: .35 },
};
const PITCHES = {
  "직구":     { d: .78, kmh: [140, 153], bx: 0,    by: 0,    rise: .25 },
  "슬라이더": { d: .88, kmh: [127, 138], bx: .30,  by: -.06, rise: .3 },
  "커브":     { d: 1.0, kmh: [110, 122], bx: -.10, by: -.42, rise: .7 },
  "체인지업": { d: 1.02, kmh: [117, 128], bx: .06, by: -.2,  rise: .35 },
};

// ───────── 텍스처 ─────────
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const grassTex = () => {
  const t = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#2a8640" : "#33984b"; g.fillRect(0, i * h / 8, w, h / 8); }
    for (let i = 0; i < 12000; i++) { g.fillStyle = `rgba(${20 + Math.random() * 40},${90 + Math.random() * 70},${40 + Math.random() * 30},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 2.5); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
};
const dirtTex = () => {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#b9824f"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(${120 + Math.random() * 70},${80 + Math.random() * 45},${45 + Math.random() * 25},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); return t;
};
// 관중: 머리+어깨 실루엣을 줄지어 그린 텍스처
const crowdTex = (teamColor) => {
  const t = canvasTex(2048, 512, (g, w, h) => {
    g.fillStyle = "#151a26"; g.fillRect(0, 0, w, h);
    const shirts = ["#f2f2f2", "#ffd24d", "#ff6b8a", "#8fc6ff", teamColor, teamColor, teamColor, "#ff9b4a", "#444b5c", "#2b2f3a"];
    const skins = ["#f1c9a5", "#e0ac84", "#c98f69", "#2b2b2b"];
    for (let r = 0; r < 16; r++) {
      const y = 22 + r * 31;
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, y + 14, w, 4);
      for (let x = 4 + (r % 2) * 7; x < w; x += 14) {
        if (Math.random() < .08) continue;
        g.fillStyle = shirts[Math.floor(Math.random() * shirts.length)];
        g.beginPath(); g.ellipse(x, y + 12, 6.5, 7, 0, Math.PI, 0); g.fill(); g.fillRect(x - 6.5, y + 12, 13, 5);
        g.fillStyle = skins[Math.floor(Math.random() * 3)]; g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill();
        if (Math.random() < .25) { g.fillStyle = shirts[Math.floor(Math.random() * 5)]; g.beginPath(); g.arc(x, y - 2, 4.4, Math.PI, 0); g.fill(); }
        if (Math.random() < .05) { g.fillStyle = teamColor; g.fillRect(x - 1, y - 18, 2, 14); g.fillRect(x - 6, y - 22, 12, 7); }
      }
    }
  });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return t;
};
const glowTex = () => canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,240,1)"); r.addColorStop(.25, "rgba(255,250,220,.6)"); r.addColorStop(1, "rgba(255,250,220,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const skyTex = () => canvasTex(16, 512, (g, w, h) => {
  const r = g.createLinearGradient(0, 0, 0, h);
  r.addColorStop(0, "#020611"); r.addColorStop(.45, "#0b1838"); r.addColorStop(.5, "#1b2f63"); r.addColorStop(1, "#05070f");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const jerseyTex = (base, trim, num) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.fillStyle = trim; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 10, w, 10);
  g.font = "900 96px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 8; g.strokeStyle = trim; g.strokeText(num, w * .75, h * .5); g.fillStyle = base === "#f4f4f4" ? trim : "#ffffff"; g.fillText(num, w * .75, h * .5);
});

// ───────── 선수 인형(관절형) ─────────
function makePlayer({ shirt, trim, cap, pants = "#f4f4f4", skin = "#e9b98f", num = "", helmet = false }) {
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .7 }, o || {}));
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = .95; root.add(hips);
  const sleeveM = M(shirt), pantsM = M(pants), shirtM = M("#ffffff", { map: jerseyTex(shirt, trim || cap, num) }), skinM = M(skin), capM = M(cap, { roughness: .4 }), shoeM = M("#1a1a1a");
  hips.add(mesh(new THREE.CylinderGeometry(.17, .16, .18, 14), pantsM, 0, .02, 0));
  hips.add(mesh(new THREE.CylinderGeometry(.165, .165, .05, 14), M("#222"), 0, .12, 0)); // 벨트
  const torso = new THREE.Group(); torso.position.y = .14; hips.add(torso);
  const chest = mesh(new THREE.CylinderGeometry(.2, .165, .5, 16), shirtM, 0, .25, 0); chest.rotation.y = Math.PI; torso.add(chest);
  torso.add(mesh(new THREE.SphereGeometry(.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), sleeveM, 0, .5, 0));
  const neck = mesh(new THREE.CylinderGeometry(.055, .06, .08, 10), skinM, 0, .58, 0); torso.add(neck);
  const head = new THREE.Group(); head.position.y = .7; torso.add(head);
  head.add(mesh(new THREE.SphereGeometry(.115, 18, 14), skinM));
  if (helmet) {
    head.add(mesh(new THREE.SphereGeometry(.135, 18, 12, 0, Math.PI * 2, 0, Math.PI * .55), capM, 0, .02, 0));
    const flap = mesh(new THREE.CylinderGeometry(.06, .06, .03, 12), capM, -.12, -.03, .02); flap.rotation.z = Math.PI / 2; head.add(flap);
  } else head.add(mesh(new THREE.SphereGeometry(.125, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM, 0, .03, 0));
  const brim = mesh(new THREE.CylinderGeometry(.1, .1, .012, 16, 1, false, -Math.PI / 2, Math.PI), capM, 0, .03, .1); head.add(brim);
  // 팔: 어깨 → 위팔 → 팔꿈치 → 아래팔
  const arm = side => {
    const sh = new THREE.Group(); sh.position.set(side * .25, .44, 0);
    sh.add(mesh(new THREE.SphereGeometry(.075, 10, 8), sleeveM));
    sh.add(mesh(new THREE.CapsuleGeometry(.058, .2, 4, 8), sleeveM, 0, -.15, 0));
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    el.add(mesh(new THREE.CapsuleGeometry(.05, .2, 4, 8), skinM, 0, -.13, 0));
    const hand = new THREE.Group(); hand.position.y = -.27; el.add(hand);
    hand.add(mesh(new THREE.SphereGeometry(.05, 10, 8), skinM));
    torso.add(sh); return { sh, el, hand };
  };
  const L = arm(1), R = arm(-1);
  const leg = side => {
    const hp = new THREE.Group(); hp.position.set(side * .1, 0, 0);
    hp.add(mesh(new THREE.CapsuleGeometry(.085, .3, 4, 8), pantsM, 0, -.23, 0));
    const kn = new THREE.Group(); kn.position.y = -.45; hp.add(kn);
    kn.add(mesh(new THREE.CapsuleGeometry(.07, .26, 4, 8), M(cap), 0, -.2, 0));
    kn.add(mesh(new THREE.BoxGeometry(.11, .07, .24), shoeM, 0, -.42, .05));
    hips.add(hp); return { hp, kn };
  };
  const LL = leg(1), RL = leg(-1);
  return { root, hips, torso, head, L, R, LL, RL };
}
function makeBat() {
  const g = new THREE.Group();
  const pts = [[.012, 0], [.016, .02], [.016, .35], [.03, .6], [.034, .82], [.03, .86]].map(p => new THREE.Vector2(p[0], p[1]));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshStandardMaterial({ color: "#c8945a", roughness: .45 })); m.castShadow = true; g.add(m);
  return g;
}
function makeGlove() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), new THREE.MeshStandardMaterial({ color: "#8b5a2b", roughness: .8 }));
  m.scale.set(1, 1.2, .6); m.castShadow = true; return m;
}

// ───────── 소리 ─────────
function audio(soundOn) {
  let ctx = null;
  const get = () => { if (!soundOn()) return null; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } return ctx; };
  const noise = (dur, type, freq, gain, attack = .005) => {
    const c = get(); if (!c) return;
    const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const gn = c.createGain(); gn.gain.setValueAtTime(0, c.currentTime); gn.gain.linearRampToValueAtTime(gain, c.currentTime + attack); gn.gain.exponentialRampToValueAtTime(.001, c.currentTime + dur);
    s.connect(f); f.connect(gn); gn.connect(c.destination); s.start();
  };
  return {
    crack: () => { noise(.12, "highpass", 1800, .9, .002); noise(.25, "bandpass", 700, .4, .002); },
    mitt: () => noise(.09, "lowpass", 600, .7, .002),
    cheer: (big) => noise(big ? 3.2 : 1.6, "bandpass", 1100, big ? .35 : .2, .4),
    groan: () => noise(1.0, "lowpass", 400, .18, .2),
    boom: () => noise(.6, "lowpass", 160, .6, .005),
  };
}

// ───────── 선택: Mixamo FBX 모델 ─────────
async function tryLoadModels() {
  try {
    const head = await fetch("models/player.fbx", { method: "HEAD" });
    if (!head.ok) return null;
    const [{ FBXLoader }, SK] = await Promise.all([import("./vendor/jsm/loaders/FBXLoader.js"), import("./vendor/jsm/utils/SkeletonUtils.js")]);
    const ld = new FBXLoader();
    const load = u => new Promise((res) => ld.load(u, res, undefined, () => res(null)));
    const base = await load("models/player.fbx");
    if (!base) return null;
    const anim = {};
    for (const k of ["idle", "swing", "pitch", "catcher"]) { const a = await load(`models/${k}.fbx`); if (a && a.animations[0]) anim[k] = a.animations[0]; }
    return { base, anim, clone: o => SK.clone(o) };
  } catch (e) { return null; }
}

// ───────── 장면 ─────────
function play(container, opts) {
  const LV = LEVELS[opts.level] || LEVELS.normal;
  const pitchMode = opts.mode === "pitch";
  const scn = opts.scn || {};
  const tc = opts.color || "#c30452", tc2 = opts.color2 || "#222";
  const oppShirt = "#9aa3b5", oppCap = "#34405a";
  const snd = audio(opts.sound || (() => true));
  const bases = scn.bases || [0, 0, 0];

  container.classList.add("g3d");
  container.innerHTML = `<div class="g3d-hud">
      <div class="g3d-sb">
        <div class="g3d-teams"><span class="g3d-tm" style="background:${tc}">${opts.short || ""}</span>${scn.score ? `<b>${scn.score[0]}</b><span class="g3d-tm opp">상대</span><b>${scn.score[1]}</b>` : ""}</div>
        <div class="g3d-st">${scn.inn ? `<span class="g3d-inn">${scn.inn}</span>` : ""}
          <svg viewBox="0 0 40 30" class="g3d-dia"><rect x="15" y="2" width="10" height="10" transform="rotate(45 20 7)" class="${bases[1] ? "on" : ""}"/><rect x="26" y="12" width="10" height="10" transform="rotate(45 31 17)" class="${bases[0] ? "on" : ""}"/><rect x="4" y="12" width="10" height="10" transform="rotate(45 9 17)" class="${bases[2] ? "on" : ""}"/></svg>
          <span class="g3d-cnt"><b>B</b><i class="b"></i><i class="b"></i><i class="b"></i><b>S</b><i class="s"></i><i class="s"></i><b>O</b><i class="o ${scn.outs >= 1 ? "on" : ""}"></i><i class="o ${scn.outs >= 2 ? "on" : ""}"></i></span>
        </div></div>
      <div class="g3d-ticker" id="g3d-tk"><span>🎙️</span><em id="g3d-tkt">${opts.label ? opts.label + " · " : ""}명장면 재현을 시작합니다!</em></div>
      <div class="g3d-card l" style="--c:${tc}"><small>${pitchMode ? "우리 팀 투수" : "우리 팀 타자"}</small><b>${opts.short || ""}</b><em>${scn.goalText || ""}</em></div>
      <div class="g3d-card r"><small>${pitchMode ? "상대 타자" : "상대 투수"}</small><b>상대 팀</b><em id="g3d-spd">— km/h</em></div>
      <div class="g3d-msg" id="g3d-msg"></div>
      <div class="g3d-meter ${pitchMode ? "pm" : ""} m-${LV.meter}"><span>${pitchMode ? "조준점이 존 한가운데 올 때 던지기! 존 밖 공은 볼이에요." : "존 안의 공만 치고, 볼은 골라내요!"}</span><div class="bar"><i class="win"></i><i class="win p"></i><i class="cur" id="g3d-cur"></i></div></div>
    </div>`;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  container.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#0b1430", 150, 340);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, .1, 800);

  scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })));
  const starG = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = .25 + Math.random() * .9; sp.push(Math.cos(a) * Math.cos(e) * 450, Math.sin(e) * 450, Math.sin(a) * Math.cos(e) * 450); }
  starG.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starG, new THREE.PointsMaterial({ color: "#ffffff", size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: .8 })));

  scene.add(new THREE.HemisphereLight("#c4d2ff", "#1c3b22", .6));
  const sun = new THREE.DirectionalLight("#fff6e0", 2.4);
  sun.position.set(-30, 60, -25); sun.target.position.set(0, 0, 18);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0005;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 40, bottom: -15, near: 10, far: 150 });
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight("#ffe9c9", 1.0); fill.position.set(40, 50, 60); scene.add(fill);
  const rim = new THREE.DirectionalLight("#9fb8ff", .6); rim.position.set(0, 20, 60); scene.add(rim);

  // 그라운드
  const grass = new THREE.Mesh(new THREE.CircleGeometry(115, 64, -Math.PI * .75, Math.PI / 2), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: .95 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
  const groundAll = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: "#1f5f31", roughness: 1 }));
  groundAll.rotation.x = -Math.PI / 2; groundAll.position.y = -.02; groundAll.receiveShadow = true; scene.add(groundAll);
  const dirtM = new THREE.MeshStandardMaterial({ map: dirtTex(), roughness: 1 });
  const flat = (geo, mat, x, z, y = .01) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
  flat(new THREE.CircleGeometry(29, 64), dirtM, 0, MOUND_Z, .012);
  const inGrass = flat(new THREE.PlaneGeometry(BASE - 3.2, BASE - 3.2), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: .95 }), 0, BASE * Math.SQRT1_2, .02);
  inGrass.rotation.z = Math.PI / 4;
  flat(new THREE.CircleGeometry(4.2, 40), dirtM, 0, 0, .025);
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, .25, 40), dirtM); mound.position.set(0, .12, MOUND_Z); mound.receiveShadow = true; scene.add(mound);
  const white = new THREE.MeshStandardMaterial({ color: "#f8f8f8", roughness: .6 });
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(.61, .03, .15), white); rubber.position.set(0, .26, MOUND_Z); scene.add(rubber);
  const plateShape = new THREE.Shape([[-.216, 0], [.216, 0], [.216, .216], [0, .432], [-.216, .216]].map(p => new THREE.Vector2(p[0], p[1])));
  flat(new THREE.ShapeGeometry(plateShape), white, 0, 0, .03);
  const baseXZ = [[BASE * Math.SQRT1_2, BASE * Math.SQRT1_2], [0, BASE * Math.SQRT2], [-BASE * Math.SQRT1_2, BASE * Math.SQRT1_2]];
  baseXZ.forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.38, .08, .38), white); b.position.set(x, .05, z); b.rotation.y = Math.PI / 4; b.castShadow = true; scene.add(b); });
  [1, -1].forEach(s => { const l = flat(new THREE.PlaneGeometry(.1, 100), white, s * 50 * Math.SQRT1_2, 50 * Math.SQRT1_2, .035); l.rotation.z = s * Math.PI / 4; });
  const lineM = new THREE.LineBasicMaterial({ color: "#ffffff" });
  [-.95, .95].forEach(x => { const pts = [[-.6, -.9], [.6, -.9], [.6, .9], [-.6, .9], [-.6, -.9]].map(p => new THREE.Vector3(x + p[0], .04, p[1])); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineM)); });

  // 외야 담장 · 관중석
  const wallR = 105;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(wallR, wallR, 3.6, 80, 1, true, -Math.PI / 4, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#15452a", side: THREE.DoubleSide, roughness: .9 }));
  wall.position.y = 1.8; wall.receiveShadow = true; scene.add(wall);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(wallR - .05, wallR - .05, .35, 80, 1, true, -Math.PI / 4, Math.PI / 2), new THREE.MeshStandardMaterial({ color: tc, side: THREE.DoubleSide, emissive: tc, emissiveIntensity: .3 }));
  pad.position.y = 3.45; scene.add(pad);
  const cT = crowdTex(tc);
  const standM = new THREE.MeshStandardMaterial({ map: cT, side: THREE.DoubleSide, roughness: 1, emissive: "#ffffff", emissiveMap: cT, emissiveIntensity: .18 });
  const stands = new THREE.Mesh(new THREE.CylinderGeometry(175, wallR + 2, 42, 90, 1, true, -Math.PI * .62, Math.PI * 1.24), standM);
  stands.position.y = 3.6 + 21; scene.add(stands);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(40, 20, 20, 40, 1, true, Math.PI * .6, Math.PI * .8), standM);
  back.position.y = 11.5; scene.add(back);
  const backWall = new THREE.Mesh(new THREE.CylinderGeometry(19.8, 19.8, 1.6, 40, 1, true, Math.PI * .6, Math.PI * .8), new THREE.MeshStandardMaterial({ color: "#1b2a3a", side: THREE.DoubleSide }));
  backWall.position.y = .8; scene.add(backWall);
  // 광고판 띠
  const adTex = canvasTex(1024, 64, (g, w, h) => { g.fillStyle = "#0c0f18"; g.fillRect(0, 0, w, h); const words = ["나의 팀 연대기", opts.short || "", "PLAY BALL", "HISTORY", opts.short || ""]; g.font = "800 34px sans-serif"; g.textBaseline = "middle"; let x = 10; let i = 0; while (x < w) { g.fillStyle = i % 2 ? tc : "#ffd24d"; const s = words[i % words.length] + "   ·   "; g.fillText(s, x, h / 2); x += g.measureText(s).width; i++; } });
  adTex.wrapS = THREE.RepeatWrapping; adTex.repeat.set(6, 1);
  const ad = new THREE.Mesh(new THREE.CylinderGeometry(wallR + 2.2, wallR + 2.2, 1.6, 90, 1, true, -Math.PI * .62, Math.PI * 1.24), new THREE.MeshBasicMaterial({ map: adTex, side: THREE.DoubleSide }));
  ad.position.y = 4.4; scene.add(ad);

  // 전광판
  const sbTex = canvasTex(1024, 384, (g, w, h) => {
    g.fillStyle = "#050505"; g.fillRect(0, 0, w, h); g.strokeStyle = tc; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = "#ffae3a"; g.font = "900 96px sans-serif"; g.textAlign = "center"; g.fillText(opts.short || "", w / 2, 150);
    g.fillStyle = "#7cfcff"; g.font = "700 64px sans-serif"; g.fillText(scn.inn || "PLAY BALL", w / 2, 250);
    g.fillStyle = "#ffffff"; g.font = "600 40px sans-serif"; g.fillText(opts.label || "명장면 재현", w / 2, 330);
  });
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(48, 18), new THREE.MeshBasicMaterial({ map: sbTex, fog: false }));
  sb.position.set(0, 34, 150); sb.rotation.y = Math.PI; scene.add(sb);
  const sbPole = new THREE.Mesh(new THREE.BoxGeometry(4, 28, 2), new THREE.MeshStandardMaterial({ color: "#20242e" })); sbPole.position.set(0, 14, 151); scene.add(sbPole);

  // 조명탑
  const glow = glowTex();
  [[-70, 70], [70, 70], [-95, 5], [95, 5]].forEach(([x, z]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1, 55, 8), new THREE.MeshStandardMaterial({ color: "#3a4152" })); pole.position.set(x, 27, z); scene.add(pole);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 1), new THREE.MeshStandardMaterial({ color: "#fffbe6", emissive: "#fffbe6", emissiveIntensity: 2 }));
    hd.position.set(x, 57, z); hd.lookAt(0, 0, 25); scene.add(hd);
    const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#fff6d6", blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    sp2.scale.set(46, 46, 1); sp2.position.set(x, 57, z); scene.add(sp2);
  });

  // 선수
  const ours = { shirt: "#f4f4f4", trim: tc, cap: tc, num: String(10 + Math.floor(Math.random() * 60)) };
  const opp = { shirt: oppShirt, trim: oppCap, cap: oppCap, num: String(10 + Math.floor(Math.random() * 60)) };
  const batTeam = pitchMode ? opp : ours, pitTeam = pitchMode ? ours : opp;
  const batter = makePlayer(Object.assign({ helmet: true }, batTeam)); batter.root.position.set(-.85, 0, .05); batter.root.rotation.y = Math.PI / 2; scene.add(batter.root);
  const bat = makeBat(); batter.R.hand.add(bat); bat.position.set(0, -.02, 0);
  const pitcher = makePlayer(pitTeam); pitcher.root.position.set(0, .25, MOUND_Z - .3); pitcher.root.rotation.y = Math.PI; scene.add(pitcher.root);
  pitcher.L.hand.add(makeGlove());
  const catcher = makePlayer(Object.assign({ helmet: true }, pitTeam, { cap: "#1d1d1d" })); catcher.root.position.set(0, -.42, -1.0); scene.add(catcher.root);
  catcher.LL.hp.rotation.x = catcher.RL.hp.rotation.x = -1.6; catcher.LL.kn.rotation.x = catcher.RL.kn.rotation.x = 2.2;
  catcher.LL.hp.rotation.z = .35; catcher.RL.hp.rotation.z = -.35; catcher.torso.rotation.x = .25;
  const cGlove = makeGlove(); catcher.L.hand.add(cGlove); catcher.L.sh.rotation.x = -1.2; catcher.L.el.rotation.x = -.4;
  const umpire = makePlayer({ shirt: "#1b1f2a", trim: "#1b1f2a", cap: "#1b1f2a", pants: "#4b505c" }); umpire.root.position.set(-.35, -.15, -2.1); umpire.torso.rotation.x = .3; scene.add(umpire.root);
  const fielders = [[BASE * .5, BASE * .95], [-BASE * .45, BASE * 1.05], [BASE * .7, BASE * .6], [-BASE * .72, BASE * .62], [-38, 80], [0, 92], [38, 80]];
  fielders.forEach(([x, z]) => { const f = makePlayer(pitTeam); f.root.position.set(x, 0, z); f.root.rotation.y = Math.PI; f.torso.rotation.x = .3; f.LL.hp.rotation.x = f.RL.hp.rotation.x = -.3; f.LL.kn.rotation.x = f.RL.kn.rotation.x = .5; f.L.hand.add(makeGlove()); scene.add(f.root); });
  // 주자
  const runnerPos = [[BASE * Math.SQRT1_2 - 1.2, BASE * Math.SQRT1_2 - .8], [-1.2, BASE * Math.SQRT2 - 1], [-BASE * Math.SQRT1_2 + 1.2, BASE * Math.SQRT1_2 - .8]];
  bases.forEach((on, i) => { if (!on) return; const r = makePlayer(Object.assign({ helmet: true }, batTeam)); r.root.position.set(runnerPos[i][0], 0, runnerPos[i][1]); r.root.rotation.y = Math.PI; r.torso.rotation.x = .35; scene.add(r.root); });

  // 선택: FBX 모델로 바꾸기
  let mixers = [], fbx = null;
  tryLoadModels().then(md => {
    if (!md || !alive) return;
    fbx = md;
    const swap = (old, pos, rotY, clipName) => {
      const o = md.clone(md.base); o.scale.setScalar(.01); o.position.copy(pos); o.rotation.y = rotY;
      o.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
      scene.add(o); old.root.visible = false;
      const mx = new THREE.AnimationMixer(o); mixers.push(mx);
      const acts = {}; for (const k in md.anim) acts[k] = mx.clipAction(md.anim[k]);
      if (acts[clipName]) acts[clipName].play(); else if (acts.idle) acts.idle.play();
      return { o, mx, acts };
    };
    fbx.batter = swap(batter, batter.root.position, Math.PI / 2, "idle");
    fbx.pitcher = swap(pitcher, pitcher.root.position, Math.PI, "idle");
    if (md.anim.catcher) fbx.catcher = swap(catcher, new THREE.Vector3(0, 0, -1.0), 0, "catcher");
    bat.visible = false;
  });
  function fbxPlay(who, name) {
    if (!fbx || !fbx[who] || !fbx[who].acts[name]) return;
    const a = fbx[who].acts[name]; a.reset(); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a.play();
    for (const k in fbx[who].acts) if (k !== name) fbx[who].acts[k].stop();
    setTimeout(() => { if (fbx[who].acts.idle && alive) { a.stop(); fbx[who].acts.idle.play(); } }, 1800);
  }

  // 스트라이크 존 · 조준점
  const zoneW = .44, zoneB = .5, zoneT = 1.1;
  const zone = new THREE.Line(new THREE.BufferGeometry().setFromPoints([[-zoneW / 2, zoneB], [zoneW / 2, zoneB], [zoneW / 2, zoneT], [-zoneW / 2, zoneT], [-zoneW / 2, zoneB]].map(p => new THREE.Vector3(p[0], p[1], .2))), new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: .05, gapSize: .04, transparent: true, opacity: opts.level === "hard" ? .25 : .75 }));
  zone.computeLineDistances(); scene.add(zone);
  const reticle = new THREE.Mesh(new THREE.RingGeometry(.045, .065, 28), new THREE.MeshBasicMaterial({ color: "#ffd24d", side: THREE.DoubleSide, transparent: true, opacity: .95, depthTest: false }));
  reticle.position.z = .2; reticle.visible = pitchMode; reticle.renderOrder = 5; scene.add(reticle);
  const mark = new THREE.Mesh(new THREE.CircleGeometry(.04, 20), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: .0, depthTest: false }));
  mark.position.z = .21; mark.renderOrder = 6; scene.add(mark);

  // 공
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.06, 16, 12), new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: .35 }));
  ball.castShadow = true; ball.visible = false; scene.add(ball);
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 }));
  ballGlow.scale.set(.5, .5, 1); ball.add(ballGlow);
  const trailG = new THREE.BufferGeometry(); const trailN = 24; trailG.setAttribute("position", new THREE.BufferAttribute(new Float32Array(trailN * 3), 3));
  const trail = new THREE.Line(trailG, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: .5 })); scene.add(trail); let trailPts = [];

  // 불꽃놀이
  const sparks = [];
  function firework(x, y, z) {
    const n = 160, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = 9 + Math.random() * 7; vel.push([Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s]); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const col = ["#ffd24d", "#ff6b8a", "#8fc6ff", "#ffffff", tc][Math.floor(Math.random() * 5)];
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 3.6, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    scene.add(p); sparks.push({ p, vel, t: 0 }); snd.boom();
  }

  // 카메라
  const CAM_HOME = pitchMode
    ? { pos: new THREE.Vector3(2.4, 3.3, MOUND_Z + 14), look: new THREE.Vector3(.05, .8, 0), fov: 8 }
    : { pos: new THREE.Vector3(.9, 3.3, -6.4), look: new THREE.Vector3(-.15, .2, 14), fov: 40 };
  camera.fov = CAM_HOME.fov; camera.updateProjectionMatrix();
  const camPos = CAM_HOME.pos.clone(), camLook = CAM_HOME.look.clone();
  let camGoalPos = CAM_HOME.pos.clone(), camGoalLook = CAM_HOME.look.clone(), camGoalFov = CAM_HOME.fov;
  camera.position.copy(camPos); camera.lookAt(camLook);
  function resize() { const w = container.clientWidth || 640, h = Math.round(w * 9 / 16); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); window.addEventListener("resize", resize);

  // ───────── 타석 진행 ─────────
  const $ = id => container.querySelector(id);
  let balls = 0, strikes = 0, pitchNo = 0, state = "intro", t0 = 0, dur = 1, rel = new THREE.Vector3(), tgt = new THREE.Vector3();
  let swingT = -1, flight = null, aimT = Math.random() * 6, msgTimer = 0, alive = true, done = false, result = null;
  let pitch = PITCHES["직구"], brk = new THREE.Vector3(), isBall = false, curType = "직구";
  const clock = new THREE.Clock();
  function say(text, cls) { const m = $("#g3d-msg"); m.className = "g3d-msg show " + (cls || ""); m.textContent = text; clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove("show"), 1500); }
  function cast(text) { const t = $("#g3d-tkt"); t.style.animation = "none"; void t.offsetWidth; t.style.animation = ""; t.textContent = text; }
  function hud() {
    container.querySelectorAll(".g3d-cnt i.b").forEach((d, i) => d.classList.toggle("on", i < balls));
    container.querySelectorAll(".g3d-cnt i.s").forEach((d, i) => d.classList.toggle("on", i < strikes));
  }
  const ord = n => ["초구", "2구", "3구", "4구", "5구", "6구", "7구", "8구", "9구", "10구"][n - 1] || `${n}구`;
  function nextPitch() {
    if (!alive || done) return;
    if (pitchNo >= 10) return endAB(pitchMode ? "walk" : "walk");
    pitchNo++; swingT = -1; flight = null; mark.material.opacity = 0;
    camGoalPos = CAM_HOME.pos.clone(); camGoalLook = CAM_HOME.look.clone(); camGoalFov = CAM_HOME.fov;
    cast(`${ord(pitchNo)}! 볼카운트 ${balls}-${strikes}.`);
    if (pitchMode) { state = "aim"; reticle.visible = true; $("#g3d-spd").textContent = "— km/h"; }
    else { state = "windup"; t0 = performance.now(); fbxPlay("pitcher", "pitch"); }
  }
  function launch(target, kmh, type) {
    curType = type || "직구"; pitch = PITCHES[curType];
    rel.set(-.35, 1.95, MOUND_Z - 1.4); tgt.copy(target); brk.set(pitch.bx, pitch.by, 0);
    dur = pitch.d * LV.speed * (1 - Math.min(pitchNo - 1, 4) * .03);
    t0 = performance.now(); state = "flight"; ball.visible = true; trailPts = [];
    const k = kmh || (pitch.kmh[0] + Math.floor(Math.random() * (pitch.kmh[1] - pitch.kmh[0])));
    $("#g3d-spd").textContent = `${k} km/h ${curType}`;
    const tot = 1.15, gw = LV.good / dur, pw = LV.perf / dur, wins = container.querySelectorAll(".g3d-meter .win");
    wins[0].style.left = ((1 - gw) / tot * 100) + "%"; wins[0].style.width = (2 * gw / tot * 100) + "%";
    wins[1].style.left = ((1 - pw) / tot * 100) + "%"; wins[1].style.width = (2 * pw / tot * 100) + "%";
  }
  function ballPos(u) {
    const p = rel.clone().lerp(tgt.clone().sub(brk), u);
    p.addScaledVector(brk, Math.pow(Math.min(u, 1.2), 3));
    p.y += Math.sin(Math.PI * Math.min(u, 1)) * pitch.rise; return p;
  }
  function pickPitch() {
    const type = LV.types[Math.floor(Math.random() * LV.types.length)];
    const ballRate = strikes === 2 ? LV.ballRate + .1 : balls === 3 ? LV.ballRate - .15 : LV.ballRate;
    isBall = Math.random() < ballRate;
    let x, y;
    if (isBall) {
      const side = Math.floor(Math.random() * 4);
      x = side === 0 ? -(zoneW / 2 + .08 + Math.random() * .15) : side === 1 ? (zoneW / 2 + .08 + Math.random() * .15) : (Math.random() - .5) * .3;
      y = side === 2 ? zoneB - .12 - Math.random() * .15 : side === 3 ? zoneT + .1 + Math.random() * .12 : .55 + Math.random() * .5;
    } else { x = (Math.random() - .5) * (zoneW - .1); y = zoneB + .08 + Math.random() * (zoneT - zoneB - .16); }
    launch(new THREE.Vector3(x, y, 0), null, type);
  }
  function addStrike(foul) {
    if (foul && strikes >= 2) { hud(); return false; }
    strikes++; hud(); if (strikes >= 3) { endAB("k"); return true; } return false;
  }
  function addBall() { balls++; hud(); if (balls >= 4) { endAB("walk"); return true; } return false; }
  function showMark() { mark.position.x = tgt.x; mark.position.y = tgt.y; mark.material.color.set(isBall ? "#ff7a7a" : "#7cfc7c"); mark.material.opacity = .9; }

  function act() {
    if (!alive || done) return;
    const now = performance.now();
    if (pitchMode) {
      if (state !== "aim") return;
      const x = reticle.position.x, y = reticle.position.y;
      const inZone = Math.abs(x) <= zoneW / 2 && y >= zoneB && y <= zoneT;
      const nearEdge = !inZone && Math.abs(x) <= zoneW / 2 + .12 && y >= zoneB - .12 && y <= zoneT + .12;
      const center = Math.hypot(x, y - (zoneB + zoneT) / 2) < LV.center;
      state = "windup"; t0 = now; reticle.visible = false; fbxPlay("pitcher", "pitch");
      setTimeout(() => {
        if (!alive) return;
        isBall = !inZone;
        launch(new THREE.Vector3(x, y, 0), 140 + Math.floor(Math.random() * 12), "직구");
        setTimeout(() => {
          if (!alive) return;
          state = "wait"; showMark(); snd.mitt();
          const r = Math.random();
          let ended = false;
          if (inZone) {
            if (center || r < .35) { swingT = performance.now(); say("헛스윙! 스트라이크!", "good"); cast("헛스윙! 타자의 방망이가 허공을 가릅니다!"); ended = addStrike(false); }
            else if (r < .6) { say("스트라이크!", "good"); cast("그대로 서서 지켜봅니다. 스트라이크!"); ended = addStrike(false); }
            else if (r < 1 - LV.contact) { swingT = performance.now(); say("파울!", ""); cast("걷어 냈습니다. 파울!"); ended = addStrike(true); }
            else { swingT = performance.now(); snd.crack(); ended = true; endAB(Math.random() < .5 ? "out" : "hit"); }
          } else if (nearEdge && r < .4) { swingT = performance.now(); say("유인구에 헛스윙!", "good"); cast("존 밖으로 빠지는 공에 방망이가 나옵니다!"); ended = addStrike(false); }
          else { say("볼!", "bad"); cast("빠졌습니다. 볼!"); snd.groan(); ended = addBall(); }
          if (!ended) setTimeout(() => { ball.visible = false; nextPitch(); }, 1500);
        }, dur * 1000);
      }, 650);
      return;
    }
    if (swingT >= 0 || state !== "flight") return;
    swingT = now; fbxPlay("batter", "swing");
    const u = (now - t0) / (dur * 1000), dt = (u - 1) * dur, a = Math.abs(dt);
    if (isBall) {
      if (a <= LV.good) { snd.crack(); say("파울!", ""); cast("볼에 손이 나갔지만 걷어 냈습니다. 파울!"); state = "wait"; if (!addStrike(true)) setTimeout(nextPitch, 1600); }
      else { snd.groan(); say("볼에 헛스윙!", "bad"); cast("유인구에 속았습니다! 헛스윙!"); state = "wait"; if (!addStrike(false)) setTimeout(nextPitch, 1600); }
      return;
    }
    if (a <= LV.perf * .6) return hit("hr", dt, u);
    if (a <= LV.perf) return hit("double", dt, u);
    if (a <= LV.good) return hit("single", dt, u);
    if (a <= LV.good * 1.7) { snd.crack(); say("파울!", ""); cast(dt < 0 ? "앞에서 맞았습니다. 파울!" : "밀렸습니다. 파울!"); state = "wait"; if (!addStrike(true)) setTimeout(nextPitch, 1600); return; }
    snd.groan(); say(dt < 0 ? "헛스윙! 너무 빨라요" : "헛스윙! 늦었어요", "bad"); cast(`${curType}에 헛스윙!`); state = "wait"; if (!addStrike(false)) setTimeout(nextPitch, 1600);
  }
  function hit(kind, dt, u) {
    const now = performance.now();
    state = "hit"; snd.crack(); snd.cheer(kind === "hr");
    const ang = (Math.random() * 2 - 1) * (kind === "hr" ? .35 : .6) + (dt < 0 ? -.18 : .18);
    const dist = kind === "hr" ? 112 + Math.random() * 14 : kind === "double" ? 75 + Math.random() * 15 : 45 + Math.random() * 20;
    flight = { t: now, from: ballPos(Math.min(u, 1)), to: new THREE.Vector3(Math.sin(ang) * dist, 0, Math.cos(ang) * dist), apex: kind === "hr" ? 34 : kind === "double" ? 14 : 8, T: kind === "hr" ? 3.2 : 2.0, hr: kind === "hr" };
    cast(kind === "hr" ? "쳤습니다! 크게 뻗어 갑니다… 넘어갑니다! 홈런!" : kind === "double" ? "잘 맞은 타구! 외야를 가르는 장타!" : "받아쳤습니다! 안타!");
    say(kind === "hr" ? "홈런!!" : kind === "double" ? "2루타!" : "안타!", "good");
    setTimeout(() => endAB(kind), kind === "hr" ? 3600 : 2400);
  }
  function endAB(kind) {
    if (done) return;
    done = true; state = "end"; result = kind;
    const goal = scn.goal || (pitchMode ? "out" : "hit");
    const names = { hr: "홈런", double: "2루타", single: "안타", walk: "볼넷", k: "삼진", out: "범타 아웃", hit: "안타 허용" };
    let pts = 0, ok = false;
    if (pitchMode) { pts = kind === "k" ? 3 : kind === "out" ? 2 : 0; ok = kind === "k" || kind === "out"; }
    else {
      pts = kind === "hr" ? 3 : kind === "double" ? 2 : (kind === "single" || kind === "walk") ? 1 : 0;
      ok = goal === "hr" ? kind === "hr" : goal === "run" ? (kind !== "k") : (kind === "hr" || kind === "double" || kind === "single");
      if (ok) pts = 3;
    }
    if (kind === "k") { snd.mitt(); say(pitchMode ? "삼진! 경기 끝!" : "삼진…", pitchMode ? "good" : "bad"); cast(pitchMode ? "삼진! 마지막 아웃을 잡아냅니다!" : "루킹 아니면 헛스윙… 삼진으로 물러납니다."); }
    if (kind === "walk") { say("볼넷!", pitchMode ? "bad" : ""); cast("볼넷! 1루로 걸어 나갑니다."); }
    if (kind === "out") { say("범타! 아웃!", "good"); cast("빗맞은 타구! 잡아냅니다. 아웃!"); }
    if (kind === "hit" && pitchMode) { say("안타 허용…", "bad"); cast("맞았습니다. 안타!"); }
    if (ok) { flashT = 70; for (let i = 0; i < 3; i++) setTimeout(() => alive && firework((Math.random() - .5) * 120, 55 + Math.random() * 25, 110 + Math.random() * 30), 200 + i * 300); snd.cheer(true); }
    setTimeout(() => opts.onDone && opts.onDone({ pts, ok, kind, name: names[kind], balls, strikes, pitches: pitchNo }), 1400);
  }
  let flashT = 0;

  // 애니메이션
  function poseBatter(now) {
    if (fbx && fbx.batter) return;
    const s = swingT >= 0 ? Math.min(1, (now - swingT) / 200) : 0;
    const e = s < 1 ? s * s * (3 - 2 * s) : 1;
    const bob = Math.sin(now / 300) * .03 * (1 - e);
    batter.hips.rotation.y = .25 - e * 1.0;
    batter.torso.rotation.y = .3 - e * 1.1 + bob;
    batter.R.sh.rotation.set(-1.4 + e * .6, 0, -.6 + e * .9); batter.R.el.rotation.set(-1.3 + e * 1.1, 0, 0);
    batter.L.sh.rotation.set(-1.2 + e * .3, 0, .9 - e * .2); batter.L.el.rotation.set(-1.5 + e * 1.2, 0, 0);
    bat.rotation.set(1.9 - e * 1.6, 0, -.3);
    batter.LL.hp.rotation.x = -.15 - e * .35; batter.LL.kn.rotation.x = .3; batter.RL.hp.rotation.x = .1; batter.RL.kn.rotation.x = .25 + e * .3;
  }
  function posePitcher(now) {
    if (fbx && fbx.pitcher) { if (state === "windup" && !pitchMode && now - t0 >= 650) pickPitch(); return; }
    let w = 0, arm = 0;
    if (state === "windup") w = Math.min(1, (now - t0) / 650);
    if (state === "flight") { arm = Math.min(1, (now - t0) / 220); w = 1; }
    const k = Math.sin(Math.min(w, 1) * Math.PI);
    pitcher.LL.hp.rotation.x = -k * 1.5; pitcher.LL.kn.rotation.x = k * 1.6;
    pitcher.R.sh.rotation.x = arm ? -2.9 + arm * 3.8 : -w * 2.6; pitcher.R.el.rotation.x = arm ? -1.2 + arm * 1.1 : -w * 1.2;
    pitcher.L.sh.rotation.x = -w * 1.3 + arm * 1.0; pitcher.L.el.rotation.x = -.6;
    pitcher.torso.rotation.x = arm * .5; pitcher.torso.rotation.y = (1 - arm) * w * .6;
    if (state === "windup" && !pitchMode && w >= 1) pickPitch();
  }
  function frame() {
    if (!alive) return;
    if (!container.isConnected) return destroy();
    requestAnimationFrame(frame);
    const now = performance.now(), dtS = Math.min(clock.getDelta(), .05);
    mixers.forEach(mx => mx.update(dtS));
    posePitcher(now); poseBatter(now);
    if (pitchMode && state === "aim") {
      aimT += dtS * LV.aim * (1 + (pitchNo - 1) * .1);
      const wob = opts.level === "hard" ? Math.sin(aimT * 7.3) * .08 : 0;
      reticle.position.x = Math.sin(aimT * 2.1) * .42 + wob; reticle.position.y = (zoneB + zoneT) / 2 + Math.cos(aimT * 3.3) * .42 + wob;
    }
    const cur = $("#g3d-cur");
    if (state === "flight") {
      const u = (now - t0) / (dur * 1000);
      cur.style.left = Math.min(100, u / 1.15 * 100) + "%";
      if (u <= 1.15) { ball.position.copy(ballPos(u)); trailPts.push(ball.position.clone()); if (trailPts.length > trailN) trailPts.shift(); }
      if (!pitchMode && u > 1.15) {
        state = "wait"; ball.visible = false; showMark(); snd.mitt();
        if (swingT < 0) {
          if (isBall) { say("볼!", "good"); cast(`${curType}, 빠졌습니다. 잘 골라냈어요! 볼.`); if (!addBall()) setTimeout(nextPitch, 1400); }
          else { say("스트라이크!", "bad"); cast(`${curType}이 존에 꽂힙니다. 루킹 스트라이크!`); if (!addStrike(false)) setTimeout(nextPitch, 1400); }
        }
      }
    }
    if (flight) {
      const p = Math.min(1, (now - flight.t) / (flight.T * 1000));
      const pos = flight.from.clone().lerp(flight.to, p); pos.y = flight.from.y * (1 - p) + Math.sin(Math.PI * p) * flight.apex;
      ball.position.copy(pos); trailPts.push(pos.clone()); if (trailPts.length > trailN) trailPts.shift();
      camGoalLook = pos.clone(); camGoalPos = new THREE.Vector3(pos.x * .25, 3 + pos.y * .35, -8 + pos.z * .25); camGoalFov = 45;
      if (flight.hr && p > .78 && !flight.fw) { flight.fw = true; for (let i = 0; i < 4; i++) setTimeout(() => alive && firework((Math.random() - .5) * 120, 55 + Math.random() * 25, 110 + Math.random() * 30), i * 280); }
      if (p >= 1) { ball.visible = false; flight = null; }
    }
    const tp = trailG.attributes.position; for (let i = 0; i < trailN; i++) { const q = trailPts[Math.max(0, trailPts.length - trailN + i)] || ball.position; tp.setXYZ(i, q.x, q.y, q.z); } tp.needsUpdate = true; trail.visible = ball.visible;
    sparks.forEach(s => {
      s.t += dtS; const a = s.p.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { const v = s.vel[i]; v[1] -= 6 * dtS; a.setXYZ(i, a.getX(i) + v[0] * dtS, a.getY(i) + v[1] * dtS, a.getZ(i) + v[2] * dtS); }
      a.needsUpdate = true; s.p.material.opacity = Math.max(0, 1 - s.t / 2.2);
    });
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > 2.3) { scene.remove(sparks[i].p); sparks[i].p.geometry.dispose(); sparks.splice(i, 1); }
    if (flashT > 0) { flashT--; standM.emissiveIntensity = .18 + Math.abs(Math.sin(now / 90)) * .25; } else standM.emissiveIntensity = .18;
    const k = 1 - Math.pow(1 - (flight ? .06 : .14), dtS * 60);
    camPos.lerp(camGoalPos, k); camLook.lerp(camGoalLook, Math.min(1, k * 1.2));
    if (Math.abs(camera.fov - camGoalFov) > .05) { camera.fov += (camGoalFov - camera.fov) * k; camera.updateProjectionMatrix(); }
    camera.position.copy(camPos); camera.lookAt(camLook);
    renderer.render(scene, camera);
  }
  function destroy() {
    alive = false; window.removeEventListener("resize", resize);
    renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  requestAnimationFrame(frame);
  setTimeout(nextPitch, 1200);
  return { act, destroy };
}

window.Game3D = { supported, play, LEVELS };
window.dispatchEvent(new Event("game3d-ready"));
