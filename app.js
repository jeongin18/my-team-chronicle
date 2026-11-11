/* 「나의 팀 연대기」 학생용 앱 */
(function () {
  const D = window.GAME_DATA;
  const $app = document.getElementById("app");
  const params = new URLSearchParams(location.search);
  const BOARD = params.has("board"); // 전자칠판 튜토리얼 모드
  const PTS = 10, GAME_MAX = 3;
  let S = null;            // 학생 상태
  let sound = true;
  let saving = Promise.resolve();

  // ───────── 유틸 ─────────
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h = (html) => { $app.innerHTML = html; window.scrollTo(0, 0); };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const team = () => D.teams[S.team];
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
  function srcHTML(m) {
    const s = (m.sources || []).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(" · ");
    return (s || m.sourceNote) ? `<div class="srcs">출처: ${s}${m.sourceNote ? esc(m.sourceNote) : ""}</div>` : "";
  }
  let actx = null;
  function beep(ok) {
    if (!sound || document.body.classList.contains("calm")) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "square"; o.frequency.value = ok ? 880 : 180; g.gain.value = .06;
      o.connect(g); g.connect(actx.destination); o.start();
      if (ok) o.frequency.setValueAtTime(1320, actx.currentTime + .09);
      o.stop(actx.currentTime + (ok ? .2 : .25));
    } catch (e) {}
  }
  function setEra(era, calm) {
    document.body.className = (era === "intro" ? "intro" : "era-" + era) + (calm ? " calm" : "");
  }
  function setTeamColors() {
    if (!S || !S.team) return;
    document.documentElement.style.setProperty("--team", team().color);
    document.documentElement.style.setProperty("--team2", team().color2);
  }
  const logoFound = {};
  // 로고 파일 이름이 조금 달라도 찾아내기(대소문자·확장자·한글 약칭·폴더 이름)
  function logoCands(k) {
    const t = D.teams[k], names = [k, k.toUpperCase(), k[0].toUpperCase() + k.slice(1), t.short];
    const out = [];
    for (const dir of ["logos", "logo"]) for (const n of names) for (const ext of ["svg", "png", "PNG", "jpg", "webp"]) out.push(`${dir}/${encodeURIComponent(n)}.${ext}`);
    return [...new Set(out)];
  }
  window.__logoNext = function (img) {
    const c = JSON.parse(img.dataset.c || "[]"), i = +(img.dataset.i || 0) + 1;
    if (i < c.length) { img.dataset.i = i; img.src = c[i]; return; }
    logoFound[img.dataset.k] = "none";
    if (img.dataset.fb === "emb") img.replaceWith(Object.assign(document.createElement("b"), { className: "emb", textContent: img.dataset.short }));
    else img.remove();
  };
  function logoImg(k, cls, fb) {
    if (logoFound[k] === "none") return fb === "emb" ? `<b class="emb">${esc(D.teams[k].short)}</b>` : "";
    const c = logoFound[k] ? [logoFound[k]] : logoCands(k);
    return `<img class="${cls || ""}" src="${c[0]}" alt="${esc(D.teams[k].name)} 로고" data-c='${JSON.stringify(c)}' data-i="0" data-fb="${fb || ""}" data-short="${esc(D.teams[k].short)}" data-k="${k}" onload="window.__logoOk&&__logoOk(this)" onerror="__logoNext(this)">`;
  }
  window.__logoOk = img => { logoFound[img.dataset.k] = img.getAttribute("src"); };

  function badge(key, size) {
    const t = D.teams[key];
    return `<span class="badge" style="background:${t.color};${size ? `width:${size}px;height:${size}px` : ""}">${logoImg(key)}<span>${esc(t.short)}</span></span>`;
  }

  // ───────── 미션 목록 · 점수 ─────────
  function missionList() { return team().chapters.flatMap((c, ci) => c.missions.map(id => ({ id, ci }))); }
  function maxOf(m) { return ({ choice: PTS, map: PTS, order: PTS, match: PTS, museum: PTS, game: GAME_MAX }[m.kind]) || 0; }
  function totals() {
    if (!S || !S.team || !D.teams[S.team]) return { max: 0, pts: 0, done: 0, total: 0, pct: 0 };
    const list = missionList();
    let max = 0, pts = 0, done = 0;
    for (const { id } of list) {
      const m = D.missions[id]; max += maxOf(m);
      if (S.done[id]) { pts += S.done[id].p || 0; done++; }
    }
    return { max, pts, done, total: list.length, pct: max ? Math.round(pts / max * 1000) / 10 : 0 };
  }
  function fanLevel(pct) { return pct >= 75 ? "레전드 팬" : pct >= 50 ? "골수 팬" : pct >= 25 ? "직관러" : "신입 팬"; }
  function persist() {
    const t = totals();
    const payload = { sid: S.sid, name: S.name, grade: S.grade, cls: S.cls, num: S.num, team: S.team || null,
      points: t.pts, max: t.max, pct: t.pct, progress: t.done, total: t.total, fan: fanLevel(t.pct),
      pos: S.pos, done: S.done, cards: S.cards, tutorialDone: !!S.tutorialDone, scene: S.scene || null,
      label: S.label || null, finished: !!S.finished, gm: S.gm || null };
    saving = saving.then(() => Store.save(S.sid, payload)).catch(() => toast("저장이 잠시 늦어지고 있어요. 계속 진행해도 괜찮아요."));
    updateTopbar();
  }
  function updateTopbar() {
    const tb = document.getElementById("topbar");
    if (!S || !S.team) { tb.classList.add("hidden"); return; }
    tb.classList.remove("hidden");
    const t = totals();
    document.getElementById("tb-badge").outerHTML = `<div class="badge" id="tb-badge" style="background:${team().color}">${logoImg(S.team)}<span>${esc(team().short)}</span></div>`;
    const ch = team().chapters[S.pos.ch];
    document.getElementById("tb-title").textContent = `${S.name} · ${ch ? ch.title : "마무리"} · ${fanLevel(t.pct)}`;
    document.getElementById("tb-prog").style.width = (t.done / t.total * 100) + "%";
    document.getElementById("tb-score").textContent = t.pct + "%";
  }
  document.getElementById("tb-home").onclick = () => { if (S && S.team) viewHome(); };
  document.getElementById("tb-ch").onclick = () => { if (S && S.team) viewChapters(); };
  document.getElementById("tb-sound").onclick = e => { sound = !sound; e.target.textContent = sound ? "🔊" : "🔇"; };

  function cardFor(id, extra) {
    const m = D.missions[id];
    let title = "";
    if (m.kind === "choice") title = m.options[0];
    else if (m.kind === "match") title = m.pairs.map(p => p[0].replace(/\s*\(.*?\)/, "")).join(" · ");
    else if (m.kind === "map") title = m.steps.map(s => s[0].replace(/\(.*\)/, "") + " → " + s[1]).join(", ");
    else if (m.kind === "museum") title = extra || "사라진 구단 박물관";
    else title = m.prompt.split(/[,.]/)[0];
    let yr = m.year || "";
    if (!yr && m.kind === "match") { const y = m.pairs.map(p => (p[0].match(/(19|20)\d\d/) || [""])[0]).filter(Boolean); yr = y.length ? y[0] + (y.length > 1 ? "~" : "") : ""; }
    yr = String(yr).slice(0, 5);
    return { id, yr, title, type: m.type, prompt: m.prompt, extra: extra || "" };
  }

  // 카드 눌러 읽기
  function docHTML(d) {
    return `<div class="doc"><div class="doc-hd"><span>${esc(d.from)}</span><span>${esc(d.year)}</span></div>
      <div class="doc-tt">${esc(d.title)}</div>
      <ol>${d.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ol>
      <div class="doc-note">※ ${esc(d.note)}</div></div>`;
  }
  function openCard(id, extra) {
    const m = D.missions[id]; if (!m) return;
    const c = cardFor(id, extra);
    let ans = "";
    if (m.kind === "choice") ans = `<div class="cm-ans">정답 · <b>${esc(m.options[0])}</b></div>`;
    if (m.kind === "match") ans = `<table class="cm-pairs">${m.pairs.map(p => `<tr><th>${esc(p[0])}</th><td>${esc(p[1])}</td></tr>`).join("")}</table>`;
    if (m.kind === "map") ans = `<div class="cm-ans">${m.steps.map(s => `🚩 ${esc(s[0])} → <b>${esc(s[1])}</b>`).join("<br>")}</div>`;
    if (m.kind === "museum" && extra) ans = `<div class="cm-ans">탐구한 카드 · <b>${esc(extra)}</b></div>`;
    const ov = document.createElement("div");
    ov.className = "cm-wrap";
    ov.innerHTML = `<div class="cm" role="dialog" aria-modal="true">
      <div class="cm-top" style="background:linear-gradient(135deg,${S && S.team ? team().color : "#333"},${S && S.team ? team().color2 : "#111"})">
        <div class="cm-yr">${esc(c.yr || "·")}</div><div class="cm-ty">${esc(S && S.team ? team().short : "")} · ${esc(m.type || "")}</div>
        <button class="cm-x" aria-label="닫기">✕</button></div>
      <div class="cm-bd"><div class="cm-q">${esc(m.prompt)}</div>${ans}
        ${m.explain ? `<div class="explain">💡 ${esc(m.explain)}</div>` : ""}
        ${m.detail ? `<div class="cm-detail"><b>사례 더 보기</b><ul>${m.detail.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        ${m.document ? docHTML(m.document) : ""}
        ${srcHTML(m)}</div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.onclick = e => { if (e.target === ov || e.target.classList.contains("cm-x")) close(); };
  }
  document.addEventListener("click", e => {
    const c = e.target.closest && e.target.closest(".card[data-id]");
    if (c && !c.closest("#cs")) openCard(c.dataset.id, c.dataset.extra);
  });

  // ───────── 화면: 로그인 ─────────
  function heroSVG() {
    const crowd = [];
    for (let i = 0; i < 260; i++) {
      const a = Math.PI * (1.04 + Math.random() * .92), r = 300 + Math.random() * 70;
      const x = 450 + Math.cos(a) * r * 1.45, y = 330 + Math.sin(a) * r * .55;
      const cols = ["#ff5a7a", "#ffd24d", "#7ab8ff", "#ffffff", "#ff8a3d", "#9be37a"];
      crowd.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1.6 + Math.random() * 1.8).toFixed(1)}" fill="${cols[i % 6]}" opacity="${(.45 + Math.random() * .5).toFixed(2)}"${i % 23 === 0 ? ` class="flash" style="animation-delay:${(Math.random() * 4).toFixed(1)}s"` : ""}/>`);
    }
    const stars = Array.from({ length: 40 }, () => `<circle cx="${(Math.random() * 900).toFixed(0)}" cy="${(Math.random() * 110).toFixed(0)}" r="${(Math.random() * 1.3 + .4).toFixed(1)}" fill="#fff" opacity="${(Math.random() * .6 + .2).toFixed(2)}"/>`).join("");
    const tower = (x, flip) => `<g transform="translate(${x},0)${flip ? " scale(-1,1)" : ""}">
        <polygon points="-6,250 6,250 3,70 -3,70" fill="#2a2f3d"/>
        <rect x="-34" y="44" width="68" height="30" rx="3" fill="#39404f"/>
        ${[0, 1, 2, 3].map(i => `<circle cx="${-24 + i * 16}" cy="59" r="6" fill="#fffbe6" class="lamp"/>`).join("")}
        <polygon points="-34,60 34,60 ${flip ? "-260,420 -40,420" : "40,420 260,420"}" fill="url(#beam)" opacity=".35"/></g>`;
    return `<svg class="hero-svg" viewBox="0 0 900 430" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050816"/><stop offset=".7" stop-color="#132048"/><stop offset="1" stop-color="#1d2f63"/></linearGradient>
        <radialGradient id="beam"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#fffbe6" stop-opacity="0"/></radialGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f7a3a"/><stop offset="1" stop-color="#2fa04c"/></linearGradient>
        <pattern id="mow" width="60" height="430" patternUnits="userSpaceOnUse"><rect width="30" height="430" fill="rgba(255,255,255,.05)"/></pattern></defs>
      <rect width="900" height="430" fill="url(#sky)"/>${stars}
      <path d="M0 250 Q450 120 900 250 L900 430 L0 430Z" fill="#161b29"/>
      ${crowd.join("")}
      <path d="M40 300 Q450 205 860 300 L900 430 L0 430Z" fill="#0f3f22"/>
      <path d="M70 312 Q450 222 830 312 L900 430 L0 430Z" fill="url(#grass)"/>
      <path d="M70 312 Q450 222 830 312 L900 430 L0 430Z" fill="url(#mow)"/>
      <polygon points="450,300 600,362 450,430 300,362" fill="#c58b52"/>
      <polygon points="450,318 572,364 450,416 328,364" fill="url(#grass)"/>
      <ellipse cx="450" cy="366" rx="20" ry="7" fill="#c58b52"/>
      ${[[450, 302], [598, 362], [302, 362]].map(([x, y]) => `<rect x="${x - 6}" y="${y - 4}" width="12" height="8" fill="#fff" transform="rotate(45 ${x} ${y})"/>`).join("")}
      <g transform="translate(560,150)"><rect width="240" height="78" rx="6" fill="#0a0a0a" stroke="#ffae3a" stroke-width="3"/>
        <text x="120" y="34" fill="#ffae3a" font-size="24" font-weight="900" text-anchor="middle" font-family="monospace" class="ledtxt">PLAY BALL</text>
        <text x="120" y="62" fill="#7cfcff" font-size="17" text-anchor="middle" font-family="monospace">1982 ▶ 2026</text>
        <rect x="112" y="78" width="16" height="70" fill="#222"/></g>
      ${tower(830, true)}
      <circle r="7" fill="#fff" class="hero-ball"><animateMotion dur="3.6s" repeatCount="indefinite" path="M450 400 Q600 60 860 160" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".2 .6 .4 1"/></circle>
    </svg>`;
  }

  function viewLogin(msg) {
    setEra("intro"); updateTopbar();
    const credit = (window.IMAGE_CREDITS || {})["hero"];
    h(`<section class="lp">
        <div class="lp-bg"><img src="images/hero/hero.jpg" alt="" onerror="this.remove()"></div>
        <h1 class="lp-title"><span class="a">나의 팀</span><span class="b">연대기</span></h1>
        <p class="lp-sub">프로야구 구단의 역사로 읽는 한국 현대사</p>
        ${credit ? `<div class="lp-credit">사진: ${esc(credit)}</div>` : ""}
      </section>
      <form class="tk" id="f">
        <div class="tk-main">
          <div class="tk-h"><b>ADMIT ONE</b><span>2026 SEASON · 입장권</span></div>
          <label class="field"><span>학번 5자리 <em>예: 10312 → 1학년 3반 12번</em></span><input type="tel" id="sid" inputmode="numeric" maxlength="5" autocomplete="off" required placeholder="10312"></label>
          <label class="field"><span>이름</span><input type="text" id="nm" maxlength="12" autocomplete="off" required placeholder="홍길동"></label>
          ${msg ? `<div class="notice bad">${esc(msg)}</div>` : ""}
          <button class="btn play">플레이 볼 <span>→</span></button>
          <p class="tk-mode">${Store.mode === "demo" ? "체험 모드 · 기록이 이 기기에만 저장돼요." : "기록은 자동으로 저장되고, 선생님 화면에 바로 보여요."}</p>
        </div>
        <div class="tk-stub" aria-hidden="true">
          <div class="tk-seat"><div><small>학년</small><b id="tk-g">-</b></div><div><small>반</small><b id="tk-c">--</b></div><div><small>번</small><b id="tk-n">--</b></div></div>
          <div class="tk-name" id="tk-nm">입장객</div>
          <div class="tk-bar" id="tk-bar"></div>
          <div class="tk-no">No. <span id="tk-no">00000</span></div>
        </div>
      </form>`);
    const upd = () => {
      const v = (document.getElementById("sid").value || "").replace(/\D/g, ""), n = document.getElementById("nm").value.trim();
      document.getElementById("tk-g").textContent = v[0] || "-";
      document.getElementById("tk-c").textContent = v.length >= 3 ? +v.slice(1, 3) : "--";
      document.getElementById("tk-n").textContent = v.length >= 5 ? +v.slice(3, 5) : "--";
      document.getElementById("tk-nm").textContent = n || "입장객";
      document.getElementById("tk-no").textContent = (v + "00000").slice(0, 5);
      let seed = 7; for (const ch of v + n) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
      const bars = []; for (let i = 0; i < 38; i++) { seed = (seed * 73 + 19) % 9973; bars.push(`<i style="width:${1 + seed % 3}px;margin-right:${1 + (seed >> 3) % 3}px"></i>`); }
      document.getElementById("tk-bar").innerHTML = bars.join("");
    };
    ["sid", "nm"].forEach(id => document.getElementById(id).addEventListener("input", upd)); upd();
    document.getElementById("f").onsubmit = async e => {
      e.preventDefault();
      const sid = document.getElementById("sid").value.trim(), name = document.getElementById("nm").value.trim();
      if (!/^\d{5}$/.test(sid)) return viewLogin("학번은 숫자 5자리로 써 주세요.");
      if (!name) return viewLogin("이름을 써 주세요.");
      let old = null;
      try { old = await Store.get(sid); } catch (err) { return viewLogin("서버에 연결하지 못했어요. 와이파이를 확인한 뒤 다시 눌러 주세요."); }
      if (old && old.name && old.name !== name) return viewLogin(`이 학번은 '${old.name}' 이름으로 이미 시작했어요. 학번과 이름을 다시 확인해 주세요.`);
      S = Object.assign({ sid, name, grade: +sid[0], cls: +sid.slice(1, 3), num: +sid.slice(3), team: null, pos: { ch: 0, i: 0 }, done: {}, cards: [], tutorialDone: false }, old || {});
      S.name = name;
      setTeamColors(); persist();
      route();
    };
  }

  function route() {
    if (!S.tutorialDone) return viewTutorial(0);
    if (!S.team) return viewTeams();
    if (S.finished) return viewDone();
    const ch = team().chapters[S.pos.ch];
    if (!ch) return viewFinale();
    if (S.pos.i === 0 && !S["intro" + S.pos.ch]) return viewChapterIntro();
    const id = ch.missions[S.pos.i];
    if (!id) return viewChapterEnd();
    viewMission(id);
  }
  function next() {
    S.pos.i++;
    const ch = team().chapters[S.pos.ch];
    if (S.pos.i >= ch.missions.length) { persist(); return viewChapterEnd(); }
    persist(); route();
  }

  // ───────── 튜토리얼 ─────────
  function viewTutorial(k) {
    setEra(0); updateTopbar();
    const id = D.tutorial[k];
    if (!id) {
      if (BOARD) return h(`<div class="panel"><h1 class="led">연습 끝!</h1><p>이제 각자 기기에서 학번과 이름을 넣고 시작해요.</p></div>`);
      S.tutorialDone = true; persist();
      return h(`<div class="panel"><h1 class="led">연습 경기 끝!</h1><p>이제 응원할 구단을 고를 차례예요. 한번 고르면 바꿀 수 없으니 신중하게 골라요.</p><button class="btn" id="go">구단 고르러 가기</button></div>`), document.getElementById("go").onclick = route;
    }
    const m = D.missions[id];
    renderMission(m, { tutorial: true, onDone: () => viewTutorial(k + 1), header: `연습 ${k + 1} / ${D.tutorial.length} · 점수에 들어가지 않아요` });
    if (!BOARD) {
      const skip = document.createElement("p");
      skip.innerHTML = `<button class="btn ghost small" id="skip">선생님과 이미 연습했어요 → 건너뛰기</button>`;
      $app.appendChild(skip);
      document.getElementById("skip").onclick = () => { S.tutorialDone = true; persist(); route(); };
    }
    if (m.teacherPrompt) {
      const tp = document.createElement("div");
      tp.className = "panel small";
      tp.innerHTML = `💬 함께 생각해 보기: ${esc(m.teacherPrompt)}`;
      $app.appendChild(tp);
    }
  }

  // ───────── 구단 선택 ─────────
  function viewTeams() {
    setEra(2); updateTopbar();
    let sel = null;
    h(`<h1>응원할 구단을 골라요</h1>
      <p class="muted">미션 수는 구단마다 달라도, 점수는 만점 대비 백분율로 매겨서 어느 팀을 골라도 불리하지 않아요.</p>
      <div class="teams">${D.teamOrder.map(k => { const t = D.teams[k]; return `
        <button class="team" data-k="${k}" style="--c1:${t.color};--c2:${t.color2}">
          <div class="ph"><div class="logo-wrap">${logoImg(k, "lgbig", "emb")}</div></div>
          <div class="bd"><b class="tn">${esc(t.name)}</b><br><b>${esc(t.city)}</b> · ${esc(t.stadium)}<br><span style="color:#555">${esc(t.lineage)}</span></div>
        </button>`; }).join("")}</div>
      <div class="foot"><div class="inner"><span class="grow small" id="selname" style="align-self:center"></span><button class="btn" id="ok" disabled>이 구단으로 시작</button></div></div>`);
    $app.querySelectorAll(".team").forEach(b => b.onclick = () => {
      $app.querySelectorAll(".team").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel"); sel = b.dataset.k;
      const okb = document.getElementById("ok"); okb.disabled = false; okb.textContent = "이 구단으로 시작"; okb.dataset.sure = "";
      document.getElementById("selname").textContent = D.teams[sel].name + "의 신입 팬이 됩니다";
    });
    document.getElementById("ok").onclick = () => {
      if (!sel) return;
      const okb = document.getElementById("ok");
      if (okb.dataset.sure !== sel) { okb.dataset.sure = sel; okb.textContent = "바꿀 수 없어요. 한 번 더 누르면 시작!"; return; }
      S.team = sel; S.pos = { ch: 0, i: 0 }; setTeamColors(); persist(); viewWelcome();
    };
  }

  // 구장 사진(없으면 그림) 블록
  function stadiumPhoto(cls, caption) {
    const k = S.team, credit = (window.IMAGE_CREDITS || {})[k];
    return `<figure class="stadium ${cls || ""}"><img src="images/stadium/${k}.jpg" alt="${esc(team().stadium)}" onerror="this.replaceWith(window.__stadiumSVG())">
      ${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>${credit ? `<div class="credit">사진: ${esc(credit)}</div>` : ""}`;
  }
  function viewWelcome() {
    setEra(2); updateTopbar();
    h(`<div class="panel welcome">${stadiumPhoto("wide", `📍 ${esc(team().city)} · ${esc(team().stadium)}`)}
      <div class="kicker" style="margin-top:14px">우리 홈구장</div>
      <h1>${esc(team().name)}의 신입 팬이 된 걸 환영해요!</h1>
      <p>지금 ${esc(team().name)}의 홈은 <b>${esc(team().city)}</b>의 <b>${esc(team().stadium)}</b>이에요. 이 구장에 오기까지 어떤 역사가 있었는지, 1982년부터 따라가 봐요.</p>
      <p class="small muted">${esc(team().lineage)}</p>
      <button class="btn" id="go">1챕터로 출발!</button></div>`);
    document.getElementById("go").onclick = route;
  }

  // ───────── 챕터 ─────────
  function viewChapterIntro() {
    const ch = team().chapters[S.pos.ch], ci = S.pos.ch, tm = team();
    setEra(ch.era); updateTopbar();
    const eras = (D.eraCards || []).filter(e => { const y = +String(e.year).slice(0, 4); return y >= ch.from && y <= ch.to; }).slice(0, 4);
    const eraHTML = eras.length ? `<div class="eraboard"><div class="eb-h">그 시절 한국은</div>${eras.map(e => `<div class="eb-row"><b>${esc(e.year)}</b><span>${esc(e.society)}</span><em>⚾ ${esc(e.baseball)}</em></div>`).join("")}<p class="small muted" style="margin:6px 0 0">이 시대 배경을 떠올리며 미션을 풀어 보세요.</p></div>` : "";
    const body = `<p>${esc(tm.name)}의 ${ch.from}년부터 ${ch.to}년까지를 따라가요. 미션 ${ch.missions.length}개가 기다리고 있어요.</p>
      ${ci === 0 ? `<p class="small muted">${esc(tm.lineage)}</p>` : ""}`;
    let stage;
    if (ci === 0) {
      // 1챕터: 1980년대 LED 도트 전광판이 켜지는 오프닝
      const inn = Array.from({ length: 9 }, (_, i) => `<td style="--d:${i * .12 + .6}s">${i % 3 === 1 ? 0 : ""}</td>`).join("");
      stage = `<div class="op op-led"><div class="led-marq"><span>★ ${esc(tm.short)} ★ PLAY BALL ★ ${ch.from} ★ 그 시절의 기억 ★ ${esc(tm.short)} ★ PLAY BALL ★ ${ch.from} ★</span></div>
        <div class="led-title" data-t="${esc(ch.title)}">${[...ch.title].map((c, i) => `<i style="--d:${i * .07}s">${esc(c)}</i>`).join("")}</div>
        <table class="led-inn"><tr><th></th>${[1,2,3,4,5,6,7,8,9].map(n => `<th>${n}</th>`).join("")}</tr><tr><th>${esc(tm.short)}</th>${inn}</tr></table>
        <div class="led-yr">${ch.from} — ${ch.to}</div></div>`;
    } else if (ci === 1) {
      // 2챕터: 1990~2000년대 브라운관 TV 중계 오프닝
      stage = `<div class="op op-crt"><div class="crt"><div class="crt-static"></div><div class="crt-in">
        <div class="crt-live">● 생중계</div><div class="crt-rec">▶ PLAY&nbsp; ${ch.from}.10.</div>
        <div class="crt-logo">KOREA SERIES</div>
        <div class="crt-title">${esc(ch.title)}</div>
        <div class="crt-lower"><b>${esc(tm.short)}</b><span>${ch.from}~${ch.to} · 중계석에서 전해 드립니다</span></div></div></div>
        <div class="crt-knobs"><i></i><i></i><span>CH ${ci + 1}</span></div></div>`;
    } else {
      // 3챕터: 지금의 구장, 드론 중계처럼 다가가는 오프닝
      stage = `<div class="op op-now">${stadiumPhoto("banner", `지금의 홈구장 · ${esc(tm.stadium)}`)}
        <div class="now-over"><span class="now-live">LIVE</span><div class="now-title">${esc(ch.title)}</div><div class="now-yr">${ch.from} – ${ch.to}</div></div></div>`;
    }
    h(`<div class="panel chintro ch${ci}">${stage}
      <div style="text-align:center"><div class="kicker">${ci + 1}챕터</div><h1 class="led">「${esc(ch.title)}」</h1>${body}</div>
      ${eraHTML}
      <p style="text-align:center"><button class="btn" id="go">플레이 볼!</button></p></div>`);
    document.getElementById("go").onclick = () => { S["intro" + S.pos.ch] = true; persist(); route(); };
  }
  function viewChapterEnd() {
    const ch = team().chapters[S.pos.ch];
    const mine = S.cards.filter(c => ch.missions.includes(c.id));
    const nc = nextChapter(S.pos.ch);
    h(`<div class="panel"><div class="kicker">${S.pos.ch + 1}챕터 종료</div><h1 class="led">「${esc(ch.title)}」 완료</h1>
      <p>이번 챕터에서 모은 연대기 카드 ${mine.length}장</p>
      <div class="cards">${mine.map(cardHTML).join("")}</div>
      <p class="row"><button class="btn" id="go">${nc >= team().chapters.length ? "마지막 정리로" : nc > S.pos.ch ? "다음 시대로" : `남은 ${nc + 1}챕터로`}</button><button class="btn ghost" id="chs">📚 챕터 선택</button></p></div>`);
    document.getElementById("go").onclick = () => goChapter(nc);
    document.getElementById("chs").onclick = viewChapters;
  }

  // ───────── 홈 · 챕터 선택 ─────────
  function chStat(ci) {
    const ms = team().chapters[ci].missions;
    const done = ms.filter(id => S.done[id]).length;
    return { done, total: ms.length, first: Math.max(0, ms.findIndex(id => !S.done[id])) };
  }
  function nextChapter(cur) {
    const n = team().chapters.length;
    for (let k = 1; k <= n; k++) { const ci = (cur + k) % n; if (ci > cur || k === n) { const st = chStat(ci); if (st.done < st.total) return ci; } }
    for (let ci = 0; ci < n; ci++) { const st = chStat(ci); if (st.done < st.total) return ci; }
    return n; // 모두 끝 → 마무리
  }
  function goChapter(ci) {
    if (ci >= team().chapters.length) { S.pos = { ch: ci, i: 0 }; persist(); return route(); }
    const st = chStat(ci);
    S.pos = { ch: ci, i: st.done >= st.total ? 0 : st.first };
    if (st.done >= st.total) { persist(); return viewChapterReview(ci); }
    persist(); route();
  }
  function chapterCards() {
    const chs = team().chapters, allDone = chs.every((_, ci) => { const st = chStat(ci); return st.done >= st.total; });
    const eraName = ["1980년대 전광판", "1990~2000년대 TV 중계", "지금의 KBO 중계"];
    return `<div class="chlist">${chs.map((c, ci) => { const st = chStat(ci), pct = Math.round(st.done / st.total * 100), here = S.pos.ch === ci;
      return `<button class="chbtn ${here ? "here" : ""} ${st.done >= st.total ? "clear" : ""}" data-ci="${ci}">
        <span class="chn">${ci + 1}</span><span class="chb"><b>「${esc(c.title)}」</b><small>${c.from}~${c.to}</small>
        <span class="chbar"><i style="width:${pct}%"></i></span><small>${st.done}/${st.total} 미션 ${st.done >= st.total ? "· 완료 ✓" : here ? "· 지금 여기" : ""}</small></span>
        <span class="chgo">${st.done >= st.total ? "다시 보기" : st.done ? "이어 하기" : "시작"} ›</span></button>`; }).join("")}
      <button class="chbtn fin ${allDone ? "" : "lock"}" data-ci="${chs.length}" ${allDone ? "" : "disabled"}>
        <span class="chn">🏛️</span><span class="chb"><b>마무리 · 우리 구단 박물관 전시 라벨</b><small>${allDone ? (S.finished ? "전시 완료 · 라벨 고치기" : "세 챕터를 모두 끝냈어요!") : "세 챕터의 미션을 모두 끝내면 열려요"}</small></span>
        <span class="chgo">${allDone ? "열기 ›" : "🔒"}</span></button></div>`;
  }
  function bindChapters() {
    document.querySelectorAll(".chbtn[data-ci]").forEach(b => b.onclick = () => { if (!b.disabled) goChapter(+b.dataset.ci); });
  }
  function viewChapters() {
    setEra(2); updateTopbar();
    h(`<div class="panel"><div class="kicker">챕터 선택</div><h1>${esc(team().name)} 연대기</h1>
      <p class="muted small">원하는 챕터로 이동할 수 있어요. 푼 미션의 점수와 카드는 그대로 남아요. 풀던 미션은 다시 들어오면 처음부터 풀어요.</p>
      ${chapterCards()}<p style="text-align:right;margin-top:14px"><button class="btn ghost" id="home">🏠 홈으로</button></p></div>`);
    bindChapters(); document.getElementById("home").onclick = viewHome;
  }
  function viewChapterReview(ci) {
    const ch = team().chapters[ci];
    setEra(ch.era); updateTopbar();
    const mine = S.cards.filter(c => ch.missions.includes(c.id));
    h(`<div class="panel"><div class="kicker">${ci + 1}챕터 · 완료</div><h1>「${esc(ch.title)}」</h1>
      <p>이 챕터의 미션을 모두 풀었어요. 모은 카드를 눌러 다시 읽어 보세요.</p>
      <div class="cards">${mine.map(cardHTML).join("")}</div>
      <p class="row"><button class="btn" id="chs">📚 챕터 선택</button><button class="btn ghost" id="home">🏠 홈</button></p></div>`);
    document.getElementById("chs").onclick = viewChapters; document.getElementById("home").onclick = viewHome;
  }
  function viewHome() {
    setEra(2); updateTopbar();
    const t = totals();
    h(`<div class="panel home-hd" style="--c1:${team().color};--c2:${team().color2}"><img class="home-bg" src="images/stadium/${S.team}.jpg" alt="" onerror="this.remove()">
        <div class="row"><div class="badge big" style="background:${team().color}">${logoImg(S.team)}<span>${esc(team().short)}</span></div>
        <div class="grow"><div class="small">${S.cls}반 ${S.num}번</div><h1 style="margin:0">${esc(S.name)}</h1><div>${esc(team().name)} · <b>${esc(fanLevel(t.pct))}</b></div></div>
        <div class="home-score"><b>${t.pct}%</b><small>${t.done}/${t.total} 미션</small></div></div>
        <button class="btn play" id="cont" style="margin-top:16px">▶ 이어 하기</button></div>
      <button class="gm-entry" id="gm" style="--c1:${team().color}"><span class="gm-ic">🎮</span><span><b>단장 시뮬레이션 · 위기의 구단을 살려라</b><small>우리 구단이 실제로 겪은 위기 앞에서 단장이 되어 결정해요${S.gm && S.gm[D.gm[S.team] ? S.team : "kia"] ? " · 완료 ✓" : ""}</small></span><span class="chgo">시작 ›</span></button>
      <div class="panel"><h2>📚 챕터</h2>${chapterCards()}</div>
      <div class="panel"><h2>🃏 내 연대기 카드 ${S.cards.length}장</h2>${S.cards.length ? `<div class="cards">${S.cards.map(cardHTML).join("")}</div>` : `<p class="muted">아직 모은 카드가 없어요.</p>`}</div>
      <p style="text-align:center"><button class="btn ghost" id="out">처음 화면으로 (학번 다시 넣기)</button></p>`);
    bindChapters();
    document.getElementById("cont").onclick = route;
    document.getElementById("gm").onclick = () => viewGM(D.gm[S.team] ? S.team : "kia");
    document.getElementById("out").onclick = () => { S = null; viewLogin(); };
  }
  function cardHTML(c) {
    return `<div class="card" data-id="${esc(c.id)}" data-extra="${esc(c.extra || "")}" title="눌러서 카드 읽기"><div class="yr">${esc(c.yr || "·")}</div><div class="tt">${esc(c.title)}</div><div class="ty">${esc(S && S.team ? team().short : "")} · ${esc(c.type)}<span class="tap">눌러 보기 ›</span></div></div>`;
  }

  // ───────── 단장 시뮬레이션 ─────────
  let classRows = null;
  function watchClass() { if (classRows) return; classRows = []; try { Store.watchAll(rows => { classRows = rows || []; }); } catch (e) {} }
  function gaugeHTML(g, d) {
    const row = (k, ic, lb) => `<div class="gg"><span class="gg-l">${ic} ${lb}</span><span class="gg-b"><i style="width:${g[k]}%" class="${g[k] <= 20 ? "low" : ""}"></i></span><b>${g[k]}</b>${d && d[k] ? `<em class="${d[k] > 0 ? "up" : "dn"}">${d[k] > 0 ? "+" : ""}${d[k]}</em>` : ""}</div>`;
    return `<div class="gauges">${row("fan", "❤️", "팬 민심")}${row("cash", "💰", "구단 재정")}${row("power", "⚾", "팀 전력")}</div>`;
  }
  function viewGM(tk, step, st, opt) {
    opt = opt || {};
    const G = D.gm[tk];
    setEra(2); updateTopbar(); watchClass();
    st = st || { g: { fan: 50, cash: 50, power: 50 }, picks: [] };
    const tname = D.teams[tk].name;
    if (step === undefined) {
      h(`<div class="panel gm"><div class="kicker">🎮 단장 시뮬레이션</div><h1>${esc(G.title)}</h1>
        ${tk !== S.team ? `<p class="notice">시안이에요. 지금은 ${esc(tname)} 이야기로 체험해요. 다른 구단은 같은 틀로 이어서 만들 수 있어요.</p>` : ""}
        <p>${esc(G.intro)}</p>${gaugeHTML(st.g)}
        <p class="small gm-note">ⓘ 게이지 숫자는 게임을 위한 가상의 값이에요. '실제 역사에서는…' 부분만 사실이고, 출처가 함께 나와요.</p>
        <p class="small muted">점수에는 들어가지 않아요. 장면 ${G.scenes.length}개 · 약 5분</p>
        <p class="row"><button class="btn" id="go">단장실 입장 ▶</button>${opt.onDone ? "" : `<button class="btn ghost" id="home">🏠 홈</button>`}</p></div>`);
      document.getElementById("go").onclick = () => viewGM(tk, 0, st, opt);
      if (!opt.onDone) document.getElementById("home").onclick = viewHome;
      return;
    }
    if (step >= G.scenes.length) return viewGMEnd(tk, st, opt);
    const sc = G.scenes[step];
    h(`<div class="panel gm"><div class="gm-top"><span class="kicker">🎮 위기 ${step + 1} / ${G.scenes.length}</span><span class="gm-yr">${esc(sc.year)}</span></div>
      ${gaugeHTML(st.g)}
      <h2>${esc(sc.title)}</h2>
      <div class="clip gm-sit" style="--r:-.4deg"><span class="clip-who">${esc(sc.org || tname)} 단장실 보고서 · ${esc(sc.year)}년</span><span class="clip-txt">${esc(sc.situation)}</span></div>
      <p class="small muted" style="margin-top:14px">단장님, 어떻게 할까요?</p>
      <div class="opts" id="ch">${shuffle(sc.choices.map((c, i) => i)).map((i, n) => `<button class="opt" data-i="${i}"><span class="opt-n">${"ABC"[n]}</span>${esc(sc.choices[i].t)}</button>`).join("")}</div>
      <div id="result"></div></div>`);
    document.querySelectorAll("#ch .opt").forEach(b => b.onclick = () => {
      const i = +b.dataset.i, c = sc.choices[i];
      document.querySelectorAll("#ch .opt").forEach(x => { x.disabled = true; if (x !== b) x.classList.add("tried"); });
      b.classList.add("picked");
      const d = c.eff;
      ["fan", "cash", "power"].forEach(k => st.g[k] = Math.max(0, Math.min(100, st.g[k] + (d[k] || 0))));
      st.picks.push(i);
      beep(true);
      const realIdx = sc.choices.findIndex(x => x.real);
      const others = (classRows || []).filter(r => r.sid !== S.sid && r.gm && r.gm[tk] && r.gm[tk].picks && r.gm[tk].picks.length > step);
      const same = others.filter(r => r.gm[tk].picks[step] === i).length;
      document.querySelector(".gauges").outerHTML = gaugeHTML(st.g, d);
      document.getElementById("result").innerHTML = `
        <div class="hintbox gm-after"><b>📋 내 결정의 결과</b>${esc(c.after)}</div>
        <div class="gm-real ${c.real ? "same" : ""}"><b>📜 실제 역사에서는…</b>${c.real ? `<span class="gm-badge">실제 단장과 같은 선택!</span>` : `<span class="gm-badge other">실제 선택: ${esc(sc.choices[realIdx].t)}</span>`}
          <p>${esc(sc.real)}</p>${srcHTML(sc)}</div>
        ${sc.debate ? `<div class="gm-debate"><b>🗣️ 토론해 볼까요?</b>${esc(sc.debate)}</div>` : ""}
        ${others.length >= 3 ? `<p class="small muted">우리 반 친구 ${others.length}명 가운데 ${Math.round(same / others.length * 100)}%가 나와 같은 선택을 했어요.</p>` : ""}
        <p style="text-align:right"><button class="btn" id="nx">${step + 1 < G.scenes.length ? "다음 위기 ▶" : "결과 보기 ▶"}</button></p>`;
      document.getElementById("nx").onclick = () => viewGM(tk, step + 1, st, opt);
      document.getElementById("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
  function viewGMEnd(tk, st, opt) {
    opt = opt || {};
    const G = D.gm[tk], g = st.g;
    const pick = () => {
      if (Math.min(g.fan, g.cash, g.power) <= 20) return D.gmEndings[0];
      if (g.fan >= 60 && g.cash >= 60 && g.power >= 60) return D.gmEndings[1];
      const top = ["fan", "cash", "power"].sort((a, b) => g[b] - g[a])[0];
      return D.gmEndings.find(e => e[0] === top);
    };
    const e = pick();
    const same = G.scenes.filter((sc, i) => sc.choices[st.picks[i]] && sc.choices[st.picks[i]].real).length;
    S.gm = Object.assign({}, S.gm || {}, { [tk]: { picks: st.picks, ending: e[1], same, g } });
    persist();
    h(`<div class="panel gm" style="text-align:center"><div class="kicker">🎮 단장 임기 끝</div>
        <div class="gm-end">🏆</div><h1>${esc(e[1])}</h1><p>${esc(e[2])}</p>${gaugeHTML(g)}
        <p class="gm-same">실제 단장과 <b>${same} / ${G.scenes.length}</b>번 같은 선택을 했어요.</p></div>
      <div class="panel"><h2>내 선택 vs 실제 역사</h2><table class="cm-pairs gm-tbl">
        ${G.scenes.map((sc, i) => { const mine = sc.choices[st.picks[i]], real = sc.choices.find(x => x.real); return `<tr><th>${esc(sc.year)}<br><small>${esc(sc.title)}</small></th><td>나: ${esc(mine.t)}${mine.real ? " ✓" : `<br><span class="muted">실제: ${esc(real.t)}</span>`}</td></tr>`; }).join("")}
      </table>
      <div class="gm-debate"><b>🗣️ 토론 질문</b><ul>${G.scenes.map((sc, i) => sc.debate ? `<li><small>${esc(sc.year)} ${esc(sc.title)}</small> ${esc(sc.debate)}</li>` : "").join("")}</ul>
        <p class="small" style="margin:6px 0 0">실제 단장과 다른 선택을 한 장면이 있다면, 그때 실제 단장은 어떤 제약 때문에 그렇게 결정했을지도 생각해 보세요.</p></div>
      <p class="small gm-note">ⓘ 게이지 숫자는 게임을 위한 가상의 값이에요.</p>
      <p class="row">${opt.onDone ? `<button class="btn" id="fin">다음 미션 ▶</button>` : ""}<button class="btn ${opt.onDone ? "ghost" : ""}" id="again">다시 해 보기</button>${opt.onDone ? "" : `<button class="btn ghost" id="home">🏠 홈</button>`}</p></div>`);
    document.getElementById("again").onclick = () => viewGM(tk, undefined, undefined, opt);
    if (opt.onDone) document.getElementById("fin").onclick = () => { opt.onScore && opt.onScore(0); opt.onDone(); };
    else document.getElementById("home").onclick = viewHome;
  }

  // ───────── 미션 ─────────
  function viewMission(id) {
    const m = D.missions[id];
    const ch = team().chapters[S.pos.ch];
    setEra(ch.era, !!m.calm); updateTopbar();
    if (S.done[id]) return next();
    const n = S.pos.i + 1;
    renderMission(m, {
      header: `${S.pos.ch + 1}챕터 · 미션 ${n}/${ch.missions.length}`,
      onScore: (p, extra) => {
        S.done[id] = { p, t: Date.now() };
        if (m.kind !== "scene" && m.kind !== "chronicle" && m.kind !== "gm") {
          const c = cardFor(id, extra);
          if (!S.cards.find(x => x.id === id)) S.cards.push(c);
        }
        persist();
      },
      onDone: next
    });
  }

  function renderMission(m, ctx) {
    const kicker = m.fun ? `<span class="kicker fun">🎉 흥미 보너스</span>` : `<span class="kicker">${esc(m.label || m.type)}</span>`;
    const head = `<div class="small muted">${esc(ctx.header || "")}</div>${kicker}`;
    ({ choice: mChoice, map: mMap, order: mOrder, match: mMatch, gm: mGm, game: mGame, museum: mMuseum, scene: mScene, chronicle: mChronicle }[m.kind] || mChoice)(m, ctx, head);
  }

  function finishBox(m, ctx, ok, msg, extra) {
    const box = document.getElementById("result");
    const card = ctx.tutorial ? "" : (m.kind === "scene" || m.kind === "chronicle") ? "" : `<div class="cards" style="justify-content:center">${cardHTML(cardFor(m.id, extra)).replace('class="card"', 'class="card pop"')}</div><p class="small" style="text-align:center">연대기 카드를 얻었어요! 카드를 누르면 내용을 다시 읽을 수 있어요.</p>`;
    box.innerHTML = `<div class="notice ${ok ? "ok" : "bad"}">${msg}</div>
      ${m.explain ? `<div class="explain">💡 ${esc(m.explain)}</div>` : ""}
      ${m.document && ok ? `<p class="small muted" style="margin:14px 0 4px">📂 정답이에요! 이것이 바로 그 문건의 내용이에요.</p>${docHTML(m.document)}` : ""}
      ${m.detail ? `<div class="cm-detail"><b>사례 더 보기</b><ul>${m.detail.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${srcHTML(m)}${card}
      <p style="text-align:right"><button class="btn" id="nx">다음 ▶</button></p>`;
    document.getElementById("nx").onclick = ctx.onDone;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // 숫자 선택지는 섞지 않고 정렬: 연도는 오래된 것부터, 개수·순위는 큰 것부터
  function arrangeOpts(opts) {
    const nums = opts.map(o => { const k = o.t.match(/^(\d+)/); return k ? +k[1] : null; });
    if (nums.some(n => n === null) || new Set(nums).size !== nums.length) return shuffle(opts);
    const years = nums.every(n => n >= 1900 && n <= 2100);
    return opts.map((o, i) => i).sort((a, b) => years ? nums[a] - nums[b] : nums[b] - nums[a]).map(i => opts[i]);
  }
  function clipsHTML(m) {
    if (!m.clips) return "";
    return `<div class="clips">${m.clips.map((c, i) => `<a class="clip" href="${esc(c.url)}" target="_blank" rel="noopener" style="--r:${[-1.2, .8, -.5, 1.1][i % 4]}deg">
      <span class="clip-tag ${c.tag.endsWith("A") ? "a" : "b"}">${esc(c.tag)}</span><span class="clip-who">${esc(c.who)}</span>
      <span class="clip-txt">${esc(c.text)}</span><span class="clip-src">원문 보기 ↗ · 내용 요지</span></a>`).join("")}</div>`;
  }
  function clueHTML(m) {
    return m.clue ? `<div class="clue"><span class="clue-k">📎 단서</span>${esc(m.clue)}</div>` : "";
  }
  // 문항 시각 자료
  function visHTML(v) {
    if (!v) return "";
    const C = (S && S.team) ? team().color : "#4363d8";
    let body = "";
    if (v.type === "bars") {
      const max = Math.max(...v.items.map(i => i[1])), W = 560, rowH = 46;
      body = `<svg viewBox="0 0 ${W} ${v.items.length * rowH + 10}" class="vis-svg">${v.items.map((it, i) => { const w = Math.max(6, (it[1] / max) * (W - 230)); const y = i * rowH + 8;
        return `<text x="0" y="${y + 24}" class="vl">${esc(it[0])}</text><rect x="150" y="${y + 6}" width="${w}" height="26" rx="6" fill="${i === 0 ? C : "#8a93a6"}"><animate attributeName="width" from="0" to="${w}" dur=".7s"/></rect><text x="${158 + w}" y="${y + 25}" class="vv">${it[1].toLocaleString()}${esc(v.unit || "")}</text>`; }).join("")}</svg>`;
    } else if (v.type === "timeline") {
      const W = 600, x = t => 20 + (t - v.from) / (v.to - v.from) * (W - 40);
      const ticks = []; if (v.fmt !== "month") for (let y = Math.ceil(v.from); y <= v.to; y++) ticks.push(y);
      body = `<svg viewBox="0 0 ${W} 150" class="vis-svg"><line x1="20" y1="90" x2="${W - 20}" y2="90" class="tl"/>
        ${ticks.map(y => `<line x1="${x(y)}" y1="84" x2="${x(y)}" y2="96" class="tk"/>${(y % 5 === 0 || y === v.from || y === v.to) ? `<text x="${x(y)}" y="116" class="ty" text-anchor="middle">${y}</text>` : ""}`).join("")}
        ${v.fmt === "month" ? [1, 3, 5, 7, 9, 11].map(mo => { const t = v.from + (mo - 1) / 12; return `<line x1="${x(t)}" y1="84" x2="${x(t)}" y2="96" class="tk"/><text x="${x(t)}" y="116" class="ty" text-anchor="middle">${mo}월</text>`; }).join("") : ""}
        ${v.marks.map((mk, i) => `<circle cx="${x(mk[0])}" cy="90" r="9" fill="${C}" stroke="#fff" stroke-width="3"/><text x="${Math.min(W - 10, Math.max(10, x(mk[0])))}" y="${i % 2 ? 140 : 60}" text-anchor="${x(mk[0]) < 90 ? "start" : x(mk[0]) > W - 90 ? "end" : "middle"}" class="vm">${v.fmt === "month" ? "" : Math.floor(mk[0]) + " "}${esc(mk[1])}</text>`).join("")}</svg>`;
    } else if (v.type === "votes") {
      body = `<div class="votes">${Array.from({ length: v.yes + v.no }, (_, i) => `<span class="vote ${i < v.yes ? "y" : "n"}">${i < v.yes ? "찬성" : "반대"}</span>`).join("")}</div>${v.note ? `<p class="small">${esc(v.note)}</p>` : ""}`;
    } else if (v.type === "table") {
      body = `<table class="vis-tbl">${v.rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")}</table>`;
    } else if (v.type === "map" && window.MAP_DATA) {
      const M = window.MAP_DATA;
      body = `<svg viewBox="150 40 520 640" class="vis-svg vis-map"><rect x="150" y="40" width="520" height="640" class="sea"/><path d="${M.kp}" class="land north"/><path d="${M.kr}" class="land"/>
        ${v.cities.map(n => { const [px, py] = MP(...CITIES[n]); return `<circle cx="${px}" cy="${py}" r="9" fill="${C}" stroke="#fff" stroke-width="3"/><text x="${px + 14}" y="${py + 7}" class="vc">${n}</text>`; }).join("")}</svg>${v.note ? `<p class="small">${esc(v.note)}</p>` : ""}`;
    }
    return `<figure class="vis"><figcaption>📊 ${esc(v.title)}</figcaption>${body}</figure>`;
  }
  function missionImg(m) {
    const cr = (window.IMAGE_CREDITS || {})["m:" + m.id];
    return `<figure class="mimg"><img src="images/missions/${m.id}.jpg" alt="" onerror="this.parentNode.remove()">${cr ? `<figcaption>사진: ${esc(cr)}</figcaption>` : ""}</figure>`;
  }
  function promptHTML(p) {
    return esc(p).replace(/&quot;([^&]{6,}?)&quot;|"([^"]{6,}?)"/g, (_, a, b) => `<q class="qt">${a || b}</q>`);
  }
  const GENERIC_HINT = "발문 속 단서(①②③, 숫자, 연도, 따옴표 속 문장)를 다시 읽고, 선택지마다 '왜 그럴까?'를 따져 보세요.";

  // 객관식: 한 번에 10점, 힌트 보고 두 번째 7점, 세 번째 4점. 틀린 선택지를 지우지 않고 힌트를 줘요.
  function mChoice(m, ctx, head) {
    const opts = arrangeOpts(m.options.map((t, i) => ({ t, right: i === 0 })));
    const isBoss = m.type === "단장의 선택";
    h(`<div class="panel">${head}<div class="prompt">${promptHTML(m.prompt)}</div>
      ${missionImg(m)}${visHTML(m.vis)}${clipsHTML(m)}${clueHTML(m)}
      <div id="pre"></div><div class="opts" id="opts"></div><div id="hint"></div><div id="result"></div></div>`);
    const draw = () => {
      document.getElementById("opts").innerHTML = opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-n">${"ABCD"[i]}</span>${esc(o.t)}</button>`).join("");
      let tries = 0;
      document.querySelectorAll(".opt").forEach(b => b.onclick = () => {
        const o = opts[+b.dataset.i];
        if (o.right) {
          b.classList.add("right"); beep(true);
          const p = [PTS, 7, 4][tries] || 0;
          document.querySelectorAll(".opt").forEach(x => x.disabled = true);
          document.getElementById("hint").innerHTML = "";
          if (!ctx.tutorial && ctx.onScore) ctx.onScore(p);
          finishBox(m, ctx, true, tries === 0 ? "정답! 한 번에 맞혔어요." : `정답! 힌트를 보고 ${tries + 1}번째에 맞혔어요.`);
        } else {
          tries++; beep(false); b.classList.add("tried"); b.disabled = true;
          const hint = m.hint || GENERIC_HINT;
          if (tries === 1) document.getElementById("hint").innerHTML = `<div class="hintbox"><b>💡 힌트</b>${esc(hint)}</div>`;
          if (tries === 2) document.getElementById("hint").innerHTML = `<div class="hintbox"><b>💡 힌트</b>${esc(hint)}<div class="hint2">마지막 기회예요. ${m.clue ? "📎 단서와 " : ""}힌트를 발문과 한 번 더 맞춰 보세요.</div></div>`;
          if (tries >= 3) {
            document.querySelectorAll(".opt").forEach(x => { x.disabled = true; if (opts[+x.dataset.i].right) x.classList.add("right"); });
            if (!ctx.tutorial && ctx.onScore) ctx.onScore(0);
            document.getElementById("hint").innerHTML = "";
            finishBox(m, ctx, false, "정답을 확인해 보세요. 틀려도 배우고 지나가면 돼요.");
          }
        }
      });
    };
    if (isBoss && m.decide) {
      document.getElementById("pre").innerHTML = `<p class="small muted">먼저 여러분이 단장이라면 어떻게 할지 골라 보세요. (점수 없음)</p>
        <div class="row">${m.decide.map(d => `<button class="chip">${esc(d)}</button>`).join("")}</div>`;
      document.querySelectorAll("#pre .chip").forEach(b => b.onclick = () => {
        document.getElementById("pre").innerHTML = `<div class="notice ok">내 선택: ${esc(b.textContent)}${m.reveal ? `<br>실제 결말: ${esc(m.reveal)}` : "<br>그렇다면 실제로는 어땠을까요?"}</div>`;
        draw();
      });
    } else if (m.type === "구장 탐방") {
      stadiumIntro(m, draw);
    } else draw();
  }

  // 구장 탐방: 사진 + 표시 누르기 → 질문 열림
  function stadiumIntro(m, draw) {
    const mm = m.prompt.match(/표시(?: \d곳)?\(([^)]+)\)/);
    const spots = m.hotspots ? m.hotspots : (mm ? mm[1].split(/ \/ |, /).map(x => [x, ""]) : []);
    const key = S && S.team ? S.team : "lg";
    const credit = (window.IMAGE_CREDITS || {})[key];
    const PIN = [[24, 30], [74, 26], [50, 58], [26, 74], [78, 70]];
    document.getElementById("pre").innerHTML = `<div class="stadium hs-photo"><img src="images/stadium/${key}.jpg" alt="${esc(D.teams[key].stadium)}" onerror="this.replaceWith(window.__stadiumSVG())">${spots.map((s, i) => `<button class="hs-pin" data-i="${i}" style="left:${PIN[i % 5][0]}%;top:${PIN[i % 5][1]}%" title="${esc(s[0])}">${i + 1}</button>`).join("")}</div>
      ${credit ? `<div class="credit">사진: ${esc(credit)}</div>` : ""}
      ${spots.length ? `<p class="small muted">📍 표시를 모두 눌러 정보를 모아 보세요. 모으면 질문이 열려요.</p><div class="hotspots">${spots.map((s, i) => `<button class="chip" data-i="${i}">📍 ${i + 1}. ${esc(s[0])}</button>`).join("")}</div><div class="hs-info" id="hsinfo"></div>` : ""}`;
    if (!spots.length) return draw();
    let left = spots.length;
    const open = i => {
      const b = document.querySelector(`.hotspots .chip[data-i="${i}"]`), p = document.querySelector(`.hs-pin[data-i="${i}"]`);
      if (!b || b.classList.contains("on")) return;
      b.classList.add("on"); if (p) p.classList.add("on"); left--; beep(true);
      const s = spots[i];
      if (s[1]) document.getElementById("hsinfo").insertAdjacentHTML("beforeend", `<div class="hs-card"><b>📍 ${esc(s[0])}</b>${esc(s[1])}</div>`);
      if (left === 0) draw();
    };
    document.querySelectorAll(".hotspots .chip, .hs-pin").forEach(b => b.onclick = () => open(+b.dataset.i));
  }
  // 사진이 없을 때 그리는 구장 그림 (구단마다 모양을 달리함)
  window.__stadiumSVG = function () {
    const key = (S && S.team) || "lg", t = D.teams[key];
    const dome = key === "kiwoom", octa = key === "samsung", sea = key === "lotte" || key === "ssg";
    const stands = octa ? `<polygon points="60,230 150,120 300,80 500,80 650,120 740,230 740,260 60,260" fill="#3a4152"/>`
      : `<path d="M30 250 Q400 40 770 250 L770 270 L30 270Z" fill="#3a4152"/>`;
    const crowd = Array.from({ length: 160 }, (_, i) => { const a = Math.PI * (1.08 + (i / 160) * .84), r = 330 + (i % 4) * 14; return `<circle cx="${(400 + Math.cos(a) * r * 1.1).toFixed(0)}" cy="${(300 + Math.sin(a) * r * .55).toFixed(0)}" r="2.4" fill="${["#ff6b8a", "#ffd24d", "#8fc6ff", "#fff"][i % 4]}" opacity=".7"/>`; }).join("");
    const d = document.createElement("div");
    d.innerHTML = `<svg viewBox="0 0 800 380" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dome ? "#3b3f4a" : "#0b1636"}"/><stop offset="1" stop-color="${dome ? "#5a6070" : "#24407a"}"/></linearGradient></defs>
      <rect width="800" height="380" fill="url(#sk2)"/>
      ${sea ? `<rect y="150" width="800" height="40" fill="#1d4f7a" opacity=".6"/>` : ""}
      ${stands}${crowd}
      <path d="M90 380 L400 170 L710 380Z" fill="#2f8a3d"/><path d="M90 380 L400 170 L710 380Z" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>
      <polygon points="400,250 480,305 400,360 320,305" fill="#c58b52"/><polygon points="400,268 458,306 400,344 342,306" fill="#2f8a3d"/>
      <ellipse cx="400" cy="306" rx="14" ry="6" fill="#c58b52"/>
      ${dome ? `<path d="M10 210 Q400 -60 790 210" fill="none" stroke="#d9dde6" stroke-width="16"/><path d="M60 200 Q400 -20 740 200" fill="none" stroke="#c3c8d3" stroke-width="5"/>${[150, 250, 400, 550, 650].map(x => `<line x1="${x}" y1="${x === 400 ? 30 : 90}" x2="${x}" y2="190" stroke="#c3c8d3" stroke-width="3"/>`).join("")}`
        : `${[70, 730].map(x => `<rect x="${x - 4}" y="40" width="8" height="150" fill="#555"/><rect x="${x - 32}" y="24" width="64" height="24" rx="3" fill="#fffbe0"/>`).join("")}`}
      <rect x="300" y="${dome ? 120 : 92}" width="200" height="46" rx="4" fill="#000" stroke="${t.color}" stroke-width="4"/>
      <text x="400" y="${dome ? 150 : 122}" fill="#fff" font-size="19" font-weight="700" text-anchor="middle">${esc(t.stadium)}</text>
      ${octa ? `<text x="400" y="370" fill="#fff" font-size="14" text-anchor="middle" opacity=".8">팔각형 관중석</text>` : ""}</svg>`;
    return d.firstChild;
  };

  // ───────── 지도 퍼즐 (Natural Earth 해안선) ─────────
  const CITIES = { 서울: [126.98, 37.57], 인천: [126.63, 37.46], 수원: [127.01, 37.27], 춘천: [127.73, 37.88], 대전: [127.38, 36.35], 청주: [127.49, 36.64], 전주: [127.15, 35.82], 광주: [126.85, 35.16], 대구: [128.60, 35.87], 울산: [129.31, 35.54], 창원: [128.68, 35.23], 부산: [129.08, 35.18] };
  // 도시 이름표 위치 [dx, dy, 정렬]
  const CITY_LAB = { 서울: [10, -14, "start"], 인천: [-4, 30, "end"], 수원: [12, 20, "start"], 춘천: [14, 6, "start"], 대전: [14, 18, "start"], 청주: [14, 2, "start"], 전주: [14, 8, "start"], 광주: [14, 8, "start"], 대구: [14, 6, "start"], 울산: [14, 6, "start"], 창원: [-12, 22, "end"], 부산: [14, 20, "start"] };
  // 깃발 말풍선 자리: 바다 쪽 [x, y, 정렬] (west=말풍선 오른쪽 끝, east=왼쪽 끝)
  const FLAG_SLOT = { 서울: [230, 112, "w"], 인천: [230, 176, "w"], 수원: [230, 240, "w"], 청주: [230, 300, "w"], 대전: [230, 360, "w"], 전주: [230, 430, "w"], 광주: [220, 520, "w"], 춘천: [560, 96, "e"], 대구: [640, 396, "e"], 울산: [650, 462, "e"], 부산: [640, 580, "e"], 창원: [470, 640, "w"] };
  const SEOUL = { 잠실: [470, 205], 고척: [120, 245], 목동: [170, 150], 동대문: [345, 92] };
  function MP(lon, lat) { const M = window.MAP_DATA; return [(lon - M.lon0) * M.sx, (M.lat0 - lat) * M.sy]; }
  function mapSVG(kind) {
    if (kind === "seoul") {
      const Z = window.MAP_DATA.seoul;
      return `<svg viewBox="0 0 ${Z.w} ${Z.h}" id="msvg"><rect width="${Z.w}" height="${Z.h}" class="sea"/>
        ${Z.gus.map(g => `<path d="${g.d}" class="land gu"/>`).join("")}
        <path d="${Z.river}" class="river"/>
        ${Z.gus.map(g => `<text x="${g.c[0]}" y="${g.c[1]}" class="gulab" text-anchor="middle">${g.n}</text>`).join("")}
        <text x="${Z.w - 14}" y="${Z.h - 12}" class="sealab small" text-anchor="end">서울특별시 · 25개 구</text>
        <text x="222" y="256" class="riverlab" text-anchor="middle">한강</text>
        ${Object.entries(Z.pts).map(([n, [x, y]]) => `<g class="city" data-c="${n}"><circle cx="${x}" cy="${y}" r="6"/><circle cx="${x}" cy="${y}" r="16" class="hit-area"/><text x="${x + (n === "고척" ? -10 : 10)}" y="${y + (n === "목동" ? -9 : n === "고척" ? 18 : 4)}" text-anchor="${n === "고척" ? "end" : "start"}">${n}</text></g>`).join("")}<g id="flags"></g></svg>`;
    }
    const M = window.MAP_DATA;
    const [ux, uy] = MP(130.87, 37.50), [dx, dy] = MP(131.87, 37.24);
    return `<svg viewBox="0 0 ${M.w} ${M.h}" id="msvg">
      <rect width="${M.w}" height="${M.h}" class="sea"/>
      <path d="${M.kp}" class="land north"/><path d="${M.kr}" class="land"/>
      <circle cx="${ux}" cy="${uy}" r="4" class="land"/><circle cx="${dx}" cy="${dy}" r="2.5" class="land"/>
      <text x="${ux}" y="${uy - 12}" class="islab" text-anchor="middle">울릉도</text><text x="${dx}" y="${dy + 22}" class="islab" text-anchor="middle">독도</text>
      <text x="90" y="300" class="sealab">황해</text><text x="720" y="330" class="sealab">동해</text><text x="380" y="790" class="sealab">남해</text>
      ${Object.entries(CITIES).map(([n, ll]) => { const [x, y] = MP(...ll), [lx, ly, an] = CITY_LAB[n]; return `<g class="city" data-c="${n}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="26" class="hit-area"/><text x="${(x + lx).toFixed(1)}" y="${(y + ly).toFixed(1)}" text-anchor="${an}">${n}</text></g>`; }).join("")}
      <g id="flags"></g></svg>`;
  }
  function placeFlag(svg, kind, city, label, used) {
    const g = svg.querySelector("#flags");
    const w = label.length * 17 + 30, hgt = 34;
    let cx, cy, bx, by;
    if (kind === "seoul") {
      const Z = window.MAP_DATA.seoul; [cx, cy] = Z.pts[city]; const n = used[city] = (used[city] || 0) + 1;
      const sw = label.length * 11 + 22, sh = 24;
      bx = cx > Z.w / 2 ? Z.w - sw - 6 : 6; by = cx > Z.w / 2 ? 270 + (n - 1) * 30 : 290 + (n - 1) * 30;
      g.insertAdjacentHTML("beforeend", `<g class="flag sm"><line x1="${cx}" y1="${cy}" x2="${cx > Z.w / 2 ? bx + sw / 2 : bx + sw / 2}" y2="${by}"/><rect x="${bx}" y="${by}" width="${sw}" height="${sh}" rx="6"/><text x="${bx + 8}" y="${by + 16}">🚩 ${esc(label)}</text></g>`);
      return;
    } else {
      [cx, cy] = MP(...CITIES[city]); const [sx, sy, side] = FLAG_SLOT[city]; const n = used[city] = (used[city] || 0) + 1;
      bx = side === "w" ? sx - w : sx; by = sy - hgt / 2 + (n - 1) * 42;
    }
    const ax = Math.min(Math.max(cx, bx), bx + w), ay = by + hgt / 2;
    g.insertAdjacentHTML("beforeend", `<g class="flag"><line x1="${cx}" y1="${cy}" x2="${kind === "seoul" ? cx : ax}" y2="${kind === "seoul" ? by : ay}"/>
      <rect x="${bx}" y="${by}" width="${w}" height="${hgt}" rx="7"/><text x="${bx + 12}" y="${by + 23}">🚩 ${esc(label)}</text></g>`);
  }
  function mMap(m, ctx, head) {
    h(`<div class="panel">${head}<div class="prompt">${esc(m.prompt)}</div>
      <div class="notice" id="ask"></div><div class="mapbox ${m.map === "seoul" ? "seoulmap" : ""}">${mapSVG(m.map)}</div><div id="result"></div></div>`);
    let step = 0, earned = 0, miss = 0; const used = {};
    const share = PTS / m.steps.length;
    const svg = document.getElementById("msvg");
    const ask = () => { document.getElementById("ask").innerHTML = `🚩 <b>${esc(m.steps[step][0])}</b> 깃발을 꽂을 도시를 눌러요. (${step + 1}/${m.steps.length})`; };
    ask();
    svg.querySelectorAll(".city").forEach(g => g.onclick = () => {
      if (step >= m.steps.length) return;
      const target = m.steps[step][1];
      if (g.dataset.c === target) {
        beep(true); g.classList.add("hit"); g.classList.remove("miss");
        earned += miss === 0 ? share : miss === 1 ? share / 2 : 0;
        placeFlag(svg, m.map, target, m.steps[step][0].replace(/\(.*\)/, "").trim(), used);
        step++; miss = 0;
        if (step >= m.steps.length) {
          const p = Math.round(earned);
          if (!ctx.tutorial && ctx.onScore) ctx.onScore(p);
          document.getElementById("ask").innerHTML = "지도 완성!";
          finishBox(m, ctx, true, `깃발을 모두 꽂았어요! (${p}/${PTS}점)`);
        } else ask();
      } else {
        beep(false); miss++; g.classList.add("miss");
        setTimeout(() => g.classList.remove("miss"), 600);
        const hint = miss === 1 ? "💡 힌트: 구단 이름이나 괄호 속 지역 이름을 다시 보세요. 그 지역의 중심 도시는 어디일까요?" : `정답은 <b>${esc(target)}</b>예요. 그곳을 눌러 깃발을 꽂아요.`;
        document.getElementById("ask").innerHTML = `🚩 <b>${esc(m.steps[step][0])}</b>: ${hint}`;
        if (miss >= 2) { miss = 2; svg.querySelector(`.city[data-c="${target}"]`).classList.add("blink"); }
      }
    });
  }

  // ───────── 짝 맞추기: 사건 ↔ 배경 ─────────
  const PAIR_COL = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#008080"];
  function mMatch(m, ctx, head) {
    const n = m.pairs.length;
    const left = m.pairs.map((p, i) => ({ i, t: p[0] }));
    let right = shuffle(m.pairs.map((p, i) => ({ i, t: p[1] })));
    if (right.every((r, k) => r.i === k)) right = right.slice(1).concat(right[0]);
    const link = {}; // left i -> right i
    const locked = {}; let selL = null, round = 1, firstOk = 0;
    h(`<div class="panel">${head}<div class="prompt">${esc(m.prompt)}</div>
      <p class="small muted">왼쪽 사건 카드를 누른 뒤, 그 배경이나 설명이 되는 오른쪽 카드를 눌러 짝을 지어요. 짝을 지은 카드를 다시 누르면 풀려요.</p>
      <div class="match"><div class="mcol" id="ml"></div><div class="mcol" id="mr"></div></div>
      <div id="hint"></div><button class="btn" id="chk" disabled>짝 확인하기</button><div id="result"></div></div>`);
    const colOf = li => PAIR_COL[Object.keys(link).map(Number).sort((a, b) => a - b).indexOf(li) % PAIR_COL.length];
    const draw = () => {
      const rOwner = {}; Object.entries(link).forEach(([l, r]) => rOwner[r] = +l);
      document.getElementById("ml").innerHTML = left.map(o => { const on = o.i in link; return `<button class="mcard l ${selL === o.i ? "sel" : ""} ${locked[o.i] ? "ok" : ""}" data-i="${o.i}" ${on ? `style="--pc:${locked[o.i] ? "#2b9a3e" : colOf(o.i)}"` : ""}>${on ? `<i class="pn">${locked[o.i] ? "✓" : Object.keys(link).map(Number).sort((a, b) => a - b).indexOf(o.i) + 1}</i>` : ""}${esc(o.t)}</button>`; }).join("");
      document.getElementById("mr").innerHTML = right.map(o => { const l = rOwner[o.i]; const on = l !== undefined; return `<button class="mcard r ${on && locked[l] ? "ok" : ""}" data-i="${o.i}" ${on ? `style="--pc:${locked[l] ? "#2b9a3e" : colOf(l)}"` : ""}>${on ? `<i class="pn">${locked[l] ? "✓" : Object.keys(link).map(Number).sort((a, b) => a - b).indexOf(l) + 1}</i>` : ""}${esc(o.t)}</button>`; }).join("");
      const chk = document.getElementById("chk"); if (chk) chk.disabled = Object.keys(link).length !== n;
      document.querySelectorAll(".mcard.l").forEach(b => b.onclick = () => {
        const i = +b.dataset.i; if (locked[i]) return;
        if (i in link) { delete link[i]; selL = null; } else selL = selL === i ? null : i;
        draw();
      });
      document.querySelectorAll(".mcard.r").forEach(b => b.onclick = () => {
        const r = +b.dataset.i;
        const owner = Object.keys(link).find(l => link[l] === r);
        if (owner !== undefined) { if (locked[owner]) return; delete link[owner]; draw(); return; }
        if (selL === null) { toast("먼저 왼쪽 사건 카드를 눌러요."); return; }
        link[selL] = r; selL = null; beep(true); draw();
      });
    };
    draw();
    document.getElementById("chk").onclick = () => {
      const wrong = Object.keys(link).map(Number).filter(l => link[l] !== l);
      Object.keys(link).map(Number).forEach(l => { if (link[l] === l && !locked[l]) { locked[l] = round; if (round === 1) firstOk++; } });
      if (wrong.length && round === 1) {
        beep(false); round = 2;
        wrong.forEach(l => delete link[l]); draw();
        document.getElementById("hint").innerHTML = `<div class="hintbox"><b>💡 힌트</b>${n - wrong.length}쌍은 맞았어요(✓). 남은 ${wrong.length}쌍을 다시 맞춰 보세요. 양쪽 카드에 함께 나오는 단서(연도 순서, '첫'·'최초' 같은 말, 사람·회사 이름)를 이어 보세요. 지금까지 푼 미션이 근거예요.</div>`;
        return;
      }
      const okAll = Object.values(locked).length;
      const secondOk = okAll - firstOk;
      const p = Math.round(PTS * (firstOk + secondOk * .5) / n);
      document.getElementById("hint").innerHTML = "";
      document.getElementById("chk").remove();
      m.pairs.forEach((_, i) => { link[i] = i; if (!locked[i]) locked[i] = 9; });
      draw();
      document.querySelectorAll(".mcard").forEach(b => b.disabled = true);
      beep(okAll === n);
      if (!ctx.tutorial && ctx.onScore) ctx.onScore(p);
      finishBox(m, ctx, okAll === n, okAll === n ? `${n}쌍을 모두 이었어요! (${p}/${PTS}점)` : `${n}쌍 가운데 ${okAll}쌍을 이었어요. 위에 바른 짝을 보여 줬어요. (${p}/${PTS}점)`);
    };
  }

  // 카드 배치(예비): 지금은 짝 맞추기로 바꿔 쓰지 않음
  function mOrder(m, ctx, head) { return mChoice(m, ctx, head); }

  // ───────── 명장면 재현: 3D 야구장(Three.js). WebGL이 없으면 2D로 ─────────
  function mGame(m, ctx, head) {
    if (!(window.Game3D && window.Game3D.supported())) return mGame2D(m, ctx, head);
    const pitchMode = /마지막 공|마지막 아웃|리드를 지켜|던지는/.test(m.prompt);
    const inn = (m.prompt.match(/(\d+)회(초|말)?/) || [])[0] || "";
    const label = (m.prompt.match(/^(\d{4}년[^,.]*?(?:\d+차전|개막전))/) || [])[1] || "";
    const LVD = pitchMode
      ? { easy: "조준점이 천천히 움직여요", normal: "조준점이 빨라지고, 한가운데 판정이 좁아요", hard: "조준점이 흔들리며 공마다 더 빨라져요" }
      : { easy: "직구만, 타이밍 구간 표시", normal: "변화구·볼이 섞여요. 구간 표시 없음", hard: "더 빠른 공, 커브까지. 게이지 없음" };
    const scn = m.scn || {};
    h(`<div class="panel">${head}<div class="prompt">${esc(m.prompt)}</div>
      ${scn.goalText ? `<div class="g3d-goal">🎯 ${esc(scn.goalText)}</div>` : ""}
      <p class="small muted">${pitchMode ? "한 타자와 끝까지 승부해요. 노란 조준점이 존 안에 있을 때 '던지기!'를 누르면 스트라이크, 한가운데일수록 헛스윙을 잘 끌어내요. 존 밖이면 볼, 볼 4개면 볼넷이에요." : "한 타석을 끝까지 승부해요(볼 4개 볼넷, 스트라이크 3개 삼진). 존 안의 공은 홈플레이트에 닿는 순간 '스윙!', 존 밖의 공(볼)은 참아야 해요. 타이밍이 정확할수록 안타→2루타→홈런. 화면이나 스페이스바를 눌러도 돼요."} 결과에 따라 보너스 0~3점.</p>
      <div class="lvpick" id="lv">${["easy", "normal", "hard"].map(k => `<button data-k="${k}" class="${(S.level || "normal") === k ? "on" : ""}">${window.Game3D.LEVELS[k].label}<small>${LVD[k]}</small></button>`).join("")}</div>
      <div class="gamebox" id="g3"></div>
      <button class="btn swing" id="sw">▶ 이 난이도로 시작</button><div id="result"></div></div>`);
    const box = document.getElementById("g3"), sw = document.getElementById("sw");
    let ended = false, g = null;
    document.querySelectorAll("#lv button").forEach(b => b.onclick = () => { if (g) return; S.level = b.dataset.k; document.querySelectorAll("#lv button").forEach(x => x.classList.toggle("on", x === b)); });
    const start = () => {
    document.getElementById("lv").remove();
    sw.textContent = pitchMode ? "⚾ 던지기!" : "🏏 스윙!";
    g = window.Game3D.play(box, {
      mode: pitchMode ? "pitch" : "bat", level: S.level || "normal", color: team().color, color2: team().color2, short: team().short, label,
      scn: Object.assign({ inn }, scn),
      sound: () => sound,
      onDone: r => {
        if (ended) return; ended = true; sw.disabled = true; document.removeEventListener("keydown", key);
        if (!ctx.tutorial && ctx.onScore) ctx.onScore(r.pts);
        const line = `${r.ok ? "🎉 명장면 재현 성공!" : "아쉬워요. 역사와는 다른 결과가 나왔어요."} 결과: <b>${r.name}</b> (투구 ${r.pitches}개, 최종 카운트 ${r.balls}-${r.strikes}) · 보너스 +${r.pts}점`;
        setTimeout(() => finishBox(m, ctx, r.ok, line), 900);
      }
    });
    sw.onclick = g.act; box.onclick = g.act;
    };
    sw.onclick = start;
    const key = e => { if (e.code === "Space" && document.getElementById("g3")) { e.preventDefault(); g ? g.act() : start(); } };
    document.addEventListener("keydown", key);
  }

  // ───────── 명장면 재현: 2D 야구장 (WebGL이 없을 때) ─────────
  function mGame2D(m, ctx, head) {
    const pitchMode = /마지막 공|마지막 아웃|리드를 지켜|던지는/.test(m.prompt);
    const inn = (m.prompt.match(/(\d+)회(초|말)?/) || [])[0] || "";
    const scn = Object.assign({ inn }, m.scn || {});
    const L2 = { easy: { label: "쉬움", speed: 1.25, good: .12, perf: .05, ballRate: .2, contact: .15, aim: .022 }, normal: { label: "보통", speed: 1, good: .085, perf: .035, ballRate: .35, contact: .25, aim: .03 }, hard: { label: "어려움", speed: .85, good: .06, perf: .025, ballRate: .4, contact: .35, aim: .04 } };
    let LV = L2[S.level || "normal"] || L2.normal;
    h(`<div class="panel">${head}<div class="prompt">${esc(m.prompt)}</div>
      ${scn.goalText ? `<div class="g3d-goal">🎯 ${esc(scn.goalText)}</div>` : ""}
      <p class="small muted">${pitchMode ? "한 타자와 끝까지 승부해요. 노란 조준점이 존 안에 있을 때 '던지기!'를 누르면 스트라이크, 한가운데일수록 헛스윙을 잘 끌어내요. 존 밖이면 볼, 볼 4개면 볼넷이에요." : "한 타석을 끝까지 승부해요(볼 4개 볼넷, 스트라이크 3개 삼진). 존 안의 공은 홈플레이트에 닿는 순간 '스윙!', 존 밖의 공(볼)은 참아야 해요. 타이밍이 정확할수록 안타→2루타→홈런."} 결과에 따라 보너스 0~3점.</p>
      <div class="lvpick" id="lv">${["easy", "normal", "hard"].map(k => `<button data-k="${k}" class="${(S.level || "normal") === k ? "on" : ""}">${L2[k].label}</button>`).join("")}</div>
      <div class="gamebox"><canvas id="cv" width="760" height="440"></canvas></div>
      <div class="g2d-tk" id="tk2">🎙️ ${esc(scn.inn || "")} 명장면 재현을 시작합니다!</div>
      <button class="btn swing" id="sw">▶ 이 난이도로 시작</button><div id="result"></div></div>`);
    document.querySelectorAll("#lv button").forEach(bt => bt.onclick = () => { if (started) return; S.level = bt.dataset.k; LV = L2[bt.dataset.k]; document.querySelectorAll("#lv button").forEach(x => x.classList.toggle("on", x === bt)); });
    let started = false;
    const cv = document.getElementById("cv"), g = cv.getContext("2d"), sw = document.getElementById("sw");
    const W = 760, H = 440, tm = team();
    const crowd = Array.from({ length: 520 }, () => { const a = Math.PI * (1.02 + Math.random() * .96), r = 1 + Math.random() * .22; return { x: 380 + Math.cos(a) * 470 * r, y: 205 + Math.sin(a) * 150 * r, c: ["#ff6b8a", "#ffd24d", "#8fc6ff", "#ffffff", tm.color, "#ff9b4a"][Math.floor(Math.random() * 6)], f: Math.random() }; });
    let pitch = 0, hits = 0, strikes = 0, state = "ready", t0 = 0, msg = "준비!", msgT = 0, flight = null, swingT = -1, aimT = 0, speed = 1, flash = 0;
    const PZ = { x: 380, y: 352 }; // 홈플레이트 위 존 중심
    const REL = { x: 380, y: 222 };
    function bg(now) {
      const sky = g.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, "#040a1e"); sky.addColorStop(1, "#1a2c5e");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // 관중석
      g.fillStyle = "#1a1f2d"; g.beginPath(); g.moveTo(0, 230); g.quadraticCurveTo(380, 40, 760, 230); g.lineTo(760, 260); g.lineTo(0, 260); g.fill();
      for (const p of crowd) { g.globalAlpha = .5 + .5 * Math.sin(now / 300 + p.f * 20) * (flash > 0 ? 1 : .3); g.fillStyle = p.c; g.fillRect(p.x, p.y, 3, 3); }
      g.globalAlpha = 1;
      if (flash > 0) { for (let i = 0; i < 14; i++) { const p = crowd[(i * 37 + Math.floor(now / 90)) % crowd.length]; g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, 4, 0, 7); g.fill(); } }
      // 조명탑
      for (const x of [60, 700]) {
        g.fillStyle = "#2b3140"; g.fillRect(x - 4, 40, 8, 190);
        g.fillStyle = "#3a4152"; g.fillRect(x - 36, 26, 72, 26);
        for (let i = 0; i < 4; i++) { g.fillStyle = "#fffbe6"; g.shadowColor = "#fffbe6"; g.shadowBlur = 18; g.beginPath(); g.arc(x - 24 + i * 16, 39, 6, 0, 7); g.fill(); }
        g.shadowBlur = 0;
      }
      // 전광판
      g.fillStyle = "#050505"; g.fillRect(270, 92, 220, 74); g.strokeStyle = tm.color; g.lineWidth = 4; g.strokeRect(270, 92, 220, 74);
      g.fillStyle = "#ffae3a"; g.font = "bold 16px monospace"; g.textAlign = "center";
      g.fillText(`${tm.short} ${scn.score ? scn.score[0] + " : " + scn.score[1] : ""}  ${scn.inn || ""}`, 380, 112);
      const dots = (lab, n, max, col, x) => { g.fillStyle = "#9fb6e6"; g.font = "bold 13px monospace"; g.fillText(lab, x, 140); for (let i = 0; i < max; i++) { g.fillStyle = i < n ? col : "#3a4152"; g.beginPath(); g.arc(x + 14 + i * 13, 136, 5, 0, 7); g.fill(); } };
      dots("B", balls, 3, "#4ade80", 290); dots("S", strikes, 2, "#ffd24d", 352); dots("O", scn.outs || 0, 2, "#ff5d5d", 404);
      const bs = scn.bases || [0, 0, 0], dia = (x, y, on) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = on ? "#ffd24d" : "#3a4152"; g.fillRect(-4, -4, 8, 8); g.restore(); };
      dia(476, 146, bs[0]); dia(466, 136, bs[1]); dia(456, 146, bs[2]);
      g.fillStyle = "#7cfcff"; g.font = "bold 12px monospace"; g.fillText(`${pitchNo ? pitchNo + "구" : "PLAY BALL"}`, 380, 160);
      // 외야 담장
      g.fillStyle = "#14532b"; g.beginPath(); g.moveTo(0, 262); g.quadraticCurveTo(380, 150, 760, 262); g.lineTo(760, 276); g.quadraticCurveTo(380, 166, 0, 276); g.fill();
      // 잔디(원근)
      const gr = g.createLinearGradient(0, 180, 0, H); gr.addColorStop(0, "#1e6e36"); gr.addColorStop(1, "#38a556");
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 276); g.quadraticCurveTo(380, 166, 760, 276); g.lineTo(760, H); g.lineTo(0, H); g.fill();
      g.globalAlpha = .08; g.fillStyle = "#fff";
      for (let i = -6; i < 7; i += 2) { g.beginPath(); g.moveTo(380 + i * 40, 200); g.lineTo(380 + (i + 1) * 40, 200); g.lineTo(380 + (i + 1) * 170, H); g.lineTo(380 + i * 170, H); g.fill(); }
      g.globalAlpha = 1;
      // 내야 흙과 베이스
      g.fillStyle = "#c58b52"; g.beginPath(); g.moveTo(380, 228); g.lineTo(560, 300); g.lineTo(380, 420); g.lineTo(200, 300); g.closePath(); g.fill();
      g.fillStyle = "#2f8f48"; g.beginPath(); g.moveTo(380, 250); g.lineTo(520, 304); g.lineTo(380, 392); g.lineTo(240, 304); g.closePath(); g.fill();
      g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3; g.beginPath(); g.moveTo(380, 405); g.lineTo(0, 250); g.moveTo(380, 405); g.lineTo(760, 250); g.stroke();
      g.fillStyle = "#c58b52"; g.beginPath(); g.ellipse(380, 236, 30, 10, 0, 0, 7); g.fill();
      for (const [x, y] of [[560, 300], [380, 228], [200, 300]]) { g.fillStyle = "#fff"; g.fillRect(x - 6, y - 4, 12, 8); }
      // 타석 박스와 홈플레이트
      g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2; g.strokeRect(300, 380, 50, 50); g.strokeRect(410, 380, 50, 50);
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(364, 404); g.lineTo(396, 404); g.lineTo(396, 412); g.lineTo(380, 420); g.lineTo(364, 412); g.fill();
    }
    function pitcher(now) {
      // 투수: 와인드업
      const wind = state === "windup" ? Math.min(1, (now - t0) / 700) : 0;
      g.save(); g.translate(380, 230);
      g.fillStyle = state === "flight" && pitchMode ? tm.color : "#e9e9ef"; g.fillRect(-7, -34, 14, 24);
      g.fillStyle = "#f1c9a5"; g.beginPath(); g.arc(0, -40, 6, 0, 7); g.fill();
      g.fillStyle = pitchMode ? tm.color : "#555"; g.fillRect(-7, -47, 14, 4);
      g.strokeStyle = "#e9e9ef"; g.lineWidth = 5; g.beginPath(); g.moveTo(-4, -10); g.lineTo(-8, 4); g.moveTo(4, -10); g.lineTo(8 - wind * 4, 4 - wind * 6); g.stroke();
      g.beginPath(); g.moveTo(6, -30); const ang = -Math.PI / 2 - wind * 2.4; g.lineTo(6 + Math.cos(ang) * 16, -30 + Math.sin(ang) * 16); g.stroke();
      g.restore();
    }
    function batter(now) {
      g.save(); g.translate(318, 400);
      const sv = swingT >= 0 ? Math.min(1, (now - swingT) / 160) : 0;
      g.fillStyle = pitchMode ? "#9aa3b5" : tm.color; g.fillRect(-12, -70, 24, 44);
      g.fillStyle = "#f1c9a5"; g.beginPath(); g.arc(0, -80, 10, 0, 7); g.fill();
      g.fillStyle = pitchMode ? "#6b7385" : tm.color2; g.beginPath(); g.arc(0, -84, 11, Math.PI, 0); g.fill();
      g.strokeStyle = "#ddd"; g.lineWidth = 8; g.beginPath(); g.moveTo(-6, -26); g.lineTo(-10, 0); g.moveTo(6, -26); g.lineTo(10, 0); g.stroke();
      // 방망이
      const a = -2.2 + sv * 2.5; g.strokeStyle = "#c8945a"; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.moveTo(10, -58); g.lineTo(10 + Math.cos(a) * 62, -58 + Math.sin(a) * 62); g.stroke();
      g.restore();
    }
    function zone(now) {
      g.strokeStyle = "rgba(255,255,255,.55)"; g.setLineDash([6, 5]); g.lineWidth = 2; g.strokeRect(PZ.x - 34, PZ.y - 38, 68, 64); g.setLineDash([]);
      if (pitchMode && state === "aim") {
        const ax = PZ.x + Math.sin(aimT * 2.1) * 70, ay = PZ.y - 6 + Math.cos(aimT * 3.3) * 52;
        g.strokeStyle = "#ffd24d"; g.lineWidth = 3; g.beginPath(); g.arc(ax, ay, 12, 0, 7); g.moveTo(ax - 18, ay); g.lineTo(ax + 18, ay); g.moveTo(ax, ay - 18); g.lineTo(ax, ay + 18); g.stroke();
      }
    }
    const ZW = 34, ZT = PZ.y - 38, ZB = PZ.y + 26;
    let balls = 0, isBall = false, pitchNo = 0, done = false, typeName = "직구";
    function ballAt(p) {
      const e = p * p * .35 + p * .65, T = aimAt || PZ;
      return { x: REL.x + (T.x - REL.x) * e + Math.sin(p * 3) * 4 * curve, y: REL.y + (T.y - REL.y) * e - Math.sin(p * Math.PI) * 18, r: 3 + e * 9, sy: 240 + (410 - 240) * e };
    }
    let curve = 0, aimAt = null, markT = 0;
    const cast = t => { const el = document.getElementById("tk2"); if (el) el.textContent = "🎙️ " + t; };
    const say = (t, now) => { msg = t; msgT = now || performance.now(); };
    const dur = () => 900 / speed;
    function frame(now) {
      if (!document.getElementById("cv")) return;
      bg(now); zone(now); pitcher(now);
      if (aimAt && markT && now - markT < 1300) { g.fillStyle = isBall ? "rgba(255,122,122,.9)" : "rgba(124,252,124,.9)"; g.beginPath(); g.arc(aimAt.x, aimAt.y, 7, 0, 7); g.fill(); }
      if (state === "flight") {
        const p = (now - t0) / dur();
        if (p >= 1.12) {
          state = "wait"; markT = now; beep(false);
          if (!pitchMode && swingT < 0) {
            if (isBall) { say("볼!", now); cast(`${typeName}, 빠졌습니다. 잘 골라냈어요!`); if (!addBall()) setTimeout(nextPitch, 1100); }
            else { say("스트라이크!", now); cast(`${typeName}이 존에 꽂힙니다. 루킹 스트라이크!`); if (!addStrike(false)) setTimeout(nextPitch, 1100); }
          }
        } else {
          const b = ballAt(Math.min(p, 1.1));
          g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(b.x, b.sy, b.r, b.r * .35, 0, 0, 7); g.fill();
          g.fillStyle = "#fff"; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
          g.strokeStyle = "#d33"; g.lineWidth = 1; g.beginPath(); g.arc(b.x - b.r * .3, b.y, b.r * .7, -1, 1); g.stroke();
        }
      }
      if (state === "aim") aimT += LV.aim * (1 + (pitchNo - 1) * .1);
      if (flight) {
        const p = (now - flight.t) / 1400;
        if (p < 1) {
          const x = flight.x0 + (flight.x1 - flight.x0) * p, y = flight.y0 + (flight.y1 - flight.y0) * p - Math.sin(p * Math.PI) * flight.hgt;
          const sy = flight.y0 + (flight.y1 - flight.y0) * p, r = 10 * (1 - p * .8);
          g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, sy, r, r * .35, 0, 0, 7); g.fill();
          g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        } else flight = null;
      }
      batter(now);
      if (msg && now - msgT < 1300) {
        g.font = "900 46px 'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR',sans-serif"; g.textAlign = "center"; g.lineWidth = 8; g.strokeStyle = "#000"; g.strokeText(msg, 380, 70); g.fillStyle = "#fff"; g.fillText(msg, 380, 70);
      }
      if (flash > 0) flash--;
      raf = requestAnimationFrame(frame);
    }
    let raf = null;
    function addStrike(foul) { if (foul && strikes >= 2) return false; strikes++; if (strikes >= 3) { endAB("k"); return true; } return false; }
    function addBall() { balls++; if (balls >= 4) { endAB("walk"); return true; } return false; }
    function nextPitch() {
      if (done) return;
      if (pitchNo >= 10) return endAB("walk");
      pitchNo++; swingT = -1; aimAt = null; markT = 0; curve = Math.random() * 2 - 1;
      speed = (1 / LV.speed) * (1 + Math.min(pitchNo - 1, 4) * .03) * (.95 + Math.random() * .15);
      cast(`${pitchNo}구! 볼카운트 ${balls}-${strikes}.`);
      if (pitchMode) { state = "aim"; aimT = Math.random() * 6; return; }
      state = "windup"; t0 = performance.now();
      const types = LV === L2.easy ? ["직구", "직구", "체인지업"] : ["직구", "슬라이더", "커브", "체인지업"];
      typeName = types[Math.floor(Math.random() * types.length)]; if (typeName === "커브" || typeName === "체인지업") speed *= .85;
      const br = strikes === 2 ? LV.ballRate + .1 : balls === 3 ? LV.ballRate - .15 : LV.ballRate;
      isBall = Math.random() < br;
      if (isBall) { const side = Math.floor(Math.random() * 4); aimAt = { x: PZ.x + (side === 0 ? -(ZW + 14 + Math.random() * 22) : side === 1 ? ZW + 14 + Math.random() * 22 : (Math.random() - .5) * 40), y: side === 2 ? ZT - 12 - Math.random() * 16 : side === 3 ? ZB + 12 + Math.random() * 14 : PZ.y - 6 }; }
      else aimAt = { x: PZ.x + (Math.random() - .5) * (ZW * 2 - 14), y: ZT + 8 + Math.random() * (ZB - ZT - 16) };
      setTimeout(() => { if (!done) { state = "flight"; t0 = performance.now(); } }, 700);
    }
    function act() {
      if (!started) return start();
      if (done) return;
      const now = performance.now();
      if (pitchMode) {
        if (state !== "aim") return;
        const ax = PZ.x + Math.sin(aimT * 2.1) * 70, ay = PZ.y - 6 + Math.cos(aimT * 3.3) * 52;
        const inZone = Math.abs(ax - PZ.x) <= ZW && ay >= ZT && ay <= ZB;
        const near = !inZone && Math.abs(ax - PZ.x) <= ZW + 14 && ay >= ZT - 14 && ay <= ZB + 14;
        const center = Math.hypot(ax - PZ.x, ay - (PZ.y - 6)) < 22;
        isBall = !inZone; aimAt = { x: ax, y: ay }; state = "flight"; t0 = now; speed = 1.2;
        setTimeout(() => {
          if (done) return;
          state = "wait"; markT = performance.now(); beep(true);
          const r = Math.random(); let ended = false;
          if (inZone) {
            if (center || r < .35) { swingT = performance.now(); say("헛스윙!"); cast("헛스윙! 방망이가 허공을 가릅니다!"); ended = addStrike(false); }
            else if (r < .6) { say("스트라이크!"); cast("지켜봅니다. 스트라이크!"); ended = addStrike(false); }
            else if (r < 1 - LV.contact) { swingT = performance.now(); say("파울!"); cast("걷어 냈습니다. 파울!"); ended = addStrike(true); }
            else { swingT = performance.now(); ended = true; endAB(Math.random() < .5 ? "out" : "hit"); }
          } else if (near && r < .4) { swingT = performance.now(); say("유인구에 헛스윙!"); cast("존 밖으로 빠지는 공에 방망이가 나옵니다!"); ended = addStrike(false); }
          else { say("볼!"); cast("빠졌습니다. 볼!"); ended = addBall(); }
          if (!ended) setTimeout(nextPitch, 1300);
        }, dur());
        return;
      }
      if (state !== "flight" || swingT >= 0) return;
      swingT = now;
      const p = (now - t0) / dur(), dt = (p - 1) * .9, a = Math.abs(dt);
      if (isBall) {
        state = "wait"; markT = now;
        if (a <= LV.good) { say("파울!"); cast("볼에 손이 나갔지만 걷어 냈습니다. 파울!"); if (!addStrike(true)) setTimeout(nextPitch, 1300); }
        else { beep(false); say("볼에 헛스윙!"); cast("유인구에 속았습니다! 헛스윙!"); if (!addStrike(false)) setTimeout(nextPitch, 1300); }
        return;
      }
      const kind = a <= LV.perf * .6 ? "hr" : a <= LV.perf ? "double" : a <= LV.good ? "single" : null;
      if (kind) {
        state = "hit"; beep(true); flash = 50;
        const b = ballAt(Math.min(p, 1));
        flight = { t: now, x0: b.x, y0: b.y, x1: 380 + (Math.random() * 2 - 1) * (kind === "hr" ? 120 : 300), y1: kind === "hr" ? 150 : kind === "double" ? 210 : 260, hgt: kind === "hr" ? 230 : kind === "double" ? 160 : 100 };
        say(kind === "hr" ? "홈런!!" : kind === "double" ? "2루타!" : "안타!", now);
        cast(kind === "hr" ? "쳤습니다! 크게 뻗어 갑니다… 넘어갑니다! 홈런!" : kind === "double" ? "외야를 가르는 장타!" : "받아쳤습니다! 안타!");
        setTimeout(() => endAB(kind), 1700); return;
      }
      state = "wait"; markT = now;
      if (a <= LV.good * 1.7) { say("파울!"); cast(dt < 0 ? "앞에서 맞았습니다. 파울!" : "밀렸습니다. 파울!"); if (!addStrike(true)) setTimeout(nextPitch, 1300); }
      else { beep(false); say(dt < 0 ? "헛스윙! 너무 빨라요" : "헛스윙! 늦었어요", now); cast(`${typeName}에 헛스윙!`); if (!addStrike(false)) setTimeout(nextPitch, 1300); }
    }
    function start() {
      started = true; const lv = document.getElementById("lv"); if (lv) lv.remove();
      sw.textContent = pitchMode ? "⚾ 던지기!" : "🏏 스윙!";
      raf = requestAnimationFrame(frame); setTimeout(nextPitch, 700);
    }
    sw.onclick = act; cv.onclick = act;
    const key = e => { if (e.code === "Space" && document.getElementById("cv")) { e.preventDefault(); act(); } };
    document.addEventListener("keydown", key);
    function endAB(kind) {
      if (done) return; done = true; state = "end";
      const goal = scn.goal || (pitchMode ? "out" : "hit");
      const names = { hr: "홈런", double: "2루타", single: "안타", walk: "볼넷", k: "삼진", out: "범타 아웃", hit: "안타 허용" };
      let pts, ok;
      if (pitchMode) { pts = kind === "k" ? 3 : kind === "out" ? 2 : 0; ok = kind === "k" || kind === "out"; }
      else { pts = kind === "hr" ? 3 : kind === "double" ? 2 : (kind === "single" || kind === "walk") ? 1 : 0; ok = goal === "hr" ? kind === "hr" : goal === "run" ? kind !== "k" : ["hr", "double", "single"].includes(kind); if (ok) pts = 3; }
      say(names[kind] + (ok ? "!" : "…")); cast(kind === "k" ? (pitchMode ? "삼진! 마지막 아웃을 잡아냅니다!" : "삼진으로 물러납니다.") : kind === "walk" ? "볼넷! 1루로 걸어 나갑니다." : kind === "out" ? "빗맞은 타구! 아웃!" : kind === "hit" ? "맞았습니다. 안타!" : "");
      if (ok) flash = 80;
      sw.disabled = true; document.removeEventListener("keydown", key);
      setTimeout(() => cancelAnimationFrame(raf), 1600);
      if (!ctx.tutorial && ctx.onScore) ctx.onScore(pts);
      setTimeout(() => finishBox(m, ctx, ok, `${ok ? "🎉 명장면 재현 성공!" : "아쉬워요. 역사와는 다른 결과가 나왔어요."} 결과: <b>${names[kind]}</b> (투구 ${pitchNo}개, 최종 카운트 ${balls}-${strikes}) · 보너스 +${pts}점`), 900);
    }
    bg(performance.now()); zone(0); pitcher(0); batter(0);
  }

  // 단장 시뮬레이션(흐름 속 미션)
  function mGm(m, ctx) {
    const tk = D.gm[S.team] ? S.team : "kia";
    viewGM(tk, undefined, undefined, { onDone: ctx.onDone, onScore: ctx.onScore });
  }

  // 사라진 구단 박물관
  function mMuseum(m, ctx, head) {
    h(`<div class="panel">${head}<div class="prompt">${esc(m.prompt)}</div>
      <div class="opts">${m.cards.map((c, i) => `<button class="opt" data-i="${i}">🏛️ ${esc(c.title)}</button>`).join("")}</div></div>`);
    document.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      const c = m.cards[+b.dataset.i];
      const sub = { id: m.id, kind: "choice", type: "사라진 구단 박물관", prompt: `[${c.title}] ${c.prompt}`, options: c.options, sources: c.sources };
      mChoice(sub, Object.assign({}, ctx, {
        onScore: p => ctx.onScore && ctx.onScore(p, c.title + " 탐구")
      }), head);
    });
  }

  // 나의 한 장면 (채점 없음)
  function mScene(m, ctx, head) {
    const cs = S.cards;
    let pick = null;
    h(`<div class="panel">${head}<div class="prompt">${esc(m.prompt)}</div>
      <div class="cards" id="cs">${cs.map((c, i) => cardHTML(c).replace('class="card"', `class="card" data-i="${i}" style="cursor:pointer"`)).join("")}</div>
      <label class="field"><span>이 카드를 고른 이유 한 줄</span><textarea id="why" maxlength="120" placeholder="예: 구단 주인이 바뀌어도 팬과 선수는 그대로라는 걸 보여 주는 순간이라서"></textarea></label>
      <button class="btn" id="ok" disabled>제출</button><div id="result"></div></div>`);
    const upd = () => document.getElementById("ok").disabled = !(pick !== null && document.getElementById("why").value.trim().length >= 5);
    document.querySelectorAll("#cs .card").forEach(el => el.onclick = () => {
      document.querySelectorAll("#cs .card").forEach(x => x.style.outline = ""); el.style.outline = "5px solid #ffcf5a"; pick = +el.dataset.i; upd();
    });
    document.getElementById("why").oninput = upd;
    document.getElementById("ok").onclick = () => {
      S.scene = { card: cs[pick], text: document.getElementById("why").value.trim() };
      ctx.onScore && ctx.onScore(0);
      finishBox(m, ctx, true, "선생님 화면에 나의 한 장면이 올라갔어요.");
    };
  }

  // 레전드 팬 인증: 모은 카드로 완성한 연대기
  function mChronicle(m, ctx, head) {
    const cs = S.cards.slice().sort((a, b) => (+a.yr || 0) - (+b.yr || 0));
    h(`<div class="panel">${head}<h2>${esc(team().name)} 연대기 완성</h2>
      <p>지금까지 모은 카드 ${cs.length}장을 연도 순서대로 꽂았어요. 이제 이 가운데 한 장으로 박물관 전시 라벨을 만들 차례예요.</p>
      <div class="cards">${cs.map(cardHTML).join("")}</div><div id="result"></div></div>`);
    ctx.onScore && ctx.onScore(0);
    finishBox(m, ctx, true, `🏆 ${fanLevel(totals().pct)} 인증!`);
  }

  // ───────── 마무리: 우리 구단 박물관 전시 라벨 ─────────
  function viewFinale() {
    setEra(2); updateTopbar();
    const cs = S.cards;
    const L = S.label || {};
    const eraCards = D.eraCards;
    h(`<h1>「우리 구단 박물관」 전시 라벨</h1>
      <p class="muted">큐레이터가 되어 연대기 카드 한 장을 전시품으로 고르고, 설명판 세 줄을 써요. 점수에는 들어가지 않아요.</p>
      <div class="panel"><h2>① 전시할 카드</h2><select id="card">${cs.map((c, i) => `<option value="${i}" ${L.cardId === c.id ? "selected" : ""}>${esc(c.yr)} · ${esc(c.title)}</option>`).join("")}</select>
        <p class="small muted" id="cardq"></p></div>
      <div class="panel"><h2>1줄 · 무슨 일이 있었나 (사실)</h2><textarea id="l1" maxlength="150">${esc(L.fact || "")}</textarea></div>
      <div class="panel"><h2>2줄 · 그때 한국 사회는 어땠나 (맥락)</h2>
        <select id="era"><option value="">시대 카드 고르기</option>${eraCards.map((e, i) => `<option value="${i}" ${L.era === i ? "selected" : ""}>${esc(e.year)} · ${esc(e.society)}</option>`).join("")}</select>
        <p class="small muted" id="eraq"></p><textarea id="l2" maxlength="150" placeholder="예: 외환 위기로 기업들이 사업을 정리하던 때였다.">${esc(L.context || "")}</textarea></div>
      <div class="panel"><h2>3줄 · 어떻게 아는가 (출처)</h2><select id="src"></select>
        <textarea id="l3" maxlength="150" placeholder="예: 2000년 서울신문 보도로 확인했다.">${esc(L.source || "")}</textarea></div>
      <div class="panel label-preview" id="pv"></div>
      <button class="btn" id="ok">전시하기</button>`);
    const $ = id => document.getElementById(id);
    const upd = () => {
      const c = cs[+$("card").value]; const m = c ? D.missions[c.id] : null;
      $("cardq").textContent = c ? "카드 뒷면: " + c.prompt : "";
      const srcs = m ? (m.sources || []) : [];
      const prevSrc = $("src").value;
      $("src").innerHTML = srcs.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join("") || `<option>출처 없음</option>`;
      if (prevSrc && $("src").options[prevSrc]) $("src").value = prevSrc;
      const e = eraCards[+$("era").value]; $("eraq").textContent = e ? `야구에서 일어난 일: ${e.baseball}` : "";
      $("pv").innerHTML = `<div class="small muted">${esc(team().name)} · ${esc(c ? c.yr : "")}</div><h2>${esc(c ? c.title : "")}</h2>
        <div class="l">① ${esc($("l1").value)}</div><div class="l">② ${esc($("l2").value)}</div><div class="l">③ ${esc($("l3").value)}</div>
        <div class="small muted">큐레이터: ${S.cls}반 ${esc(S.name)}</div>`;
    };
    ["card", "era", "src"].forEach(id => $(id).onchange = upd);
    ["l1", "l2", "l3"].forEach(id => $(id).oninput = upd);
    upd();
    $("ok").onclick = () => {
      if ($("l1").value.trim().length < 5 || $("l2").value.trim().length < 5 || $("l3").value.trim().length < 3) return toast("세 줄을 모두 써 주세요.");
      const c = cs[+$("card").value], m = D.missions[c.id], s = (m.sources || [])[+$("src").value];
      S.label = { cardId: c.id, cardYear: c.yr, cardTitle: c.title, fact: $("l1").value.trim(), era: $("era").value === "" ? null : +$("era").value,
        eraText: $("era").value === "" ? "" : eraCards[+$("era").value].year + " " + eraCards[+$("era").value].society,
        context: $("l2").value.trim(), source: $("l3").value.trim(), sourceLink: s ? s.url : "", sourceTitle: s ? s.title : "" };
      S.finished = true; persist(); viewDone();
    };
  }

  function viewDone() {
    setEra(2); updateTopbar();
    const t = totals(), L = S.label || {};
    h(`<div class="panel" style="text-align:center"><div class="kicker">경기 종료</div><h1>${esc(team().name)} ${esc(fanLevel(t.pct))}</h1>
      <p class="score" style="font-size:44px">${t.pct}%</p><p class="muted">${t.pts} / ${t.max}점 · 연대기 카드 ${S.cards.length}장</p></div>
      <div class="panel label-preview"><div class="small muted">${esc(team().name)} · ${esc(L.cardYear || "")}</div><h2>${esc(L.cardTitle || "")}</h2>
      <div class="l">① ${esc(L.fact || "")}</div><div class="l">② ${esc(L.context || "")}</div><div class="l">③ ${esc(L.source || "")}</div>
      <div class="small muted">큐레이터: ${S.cls}반 ${esc(S.name)}</div></div>
      <p><button class="btn ghost" id="edit">라벨 고치기</button></p>`);
    document.getElementById("edit").onclick = () => { S.finished = false; persist(); viewFinale(); };
  }

  // ───────── 시작 ─────────
  Store.init().then(() => {
    if (BOARD) { document.body.style.fontSize = "22px"; S = { team: null, done: {}, cards: [] }; return viewTutorial(0); }
    viewLogin();
  }).catch(() => { h(`<div class="panel"><h2>서버에 연결하지 못했어요</h2><p>와이파이를 확인하고 새로고침해 주세요.</p></div>`); });
})();
