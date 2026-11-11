/* 「나의 팀 연대기」 교사 전광판 */
(function () {
  const D = window.GAME_DATA, cfg = window.APP_CONFIG || {};
  const $t = document.getElementById("t");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let rows = [], tab = "rank", cls = "all";

  function gate() {
    $t.innerHTML = `<div class="panel" style="max-width:520px;margin:60px auto;text-align:center">
      <h1 class="led">교사 전광판</h1><input type="tel" id="pin" placeholder="비밀번호" style="text-align:center">
      <p><button class="btn" id="go" style="width:100%;margin-top:12px">입장</button></p></div>`;
    const go = () => {
      if (document.getElementById("pin").value === String(cfg.teacherPin)) { sessionStorage.setItem("tpin", "1"); start(); }
      else document.getElementById("pin").value = "", document.getElementById("pin").placeholder = "비밀번호가 맞지 않아요";
    };
    document.getElementById("go").onclick = go;
    document.getElementById("pin").onkeydown = e => { if (e.key === "Enter") go(); };
  }

  function filtered() { return rows.filter(r => r.sid && (cls === "all" || String(r.cls) === cls)); }

  function render() {
    const classes = [...new Set(rows.map(r => r.cls).filter(Boolean))].sort((a, b) => a - b);
    const list = filtered();
    $t.innerHTML = `<div class="hdr noprint">
        <h1 class="led" style="margin:0">나의 팀 연대기 · 실시간 전광판</h1>
        <select id="cls"><option value="all">전체 반</option>${classes.map(c => `<option value="${c}" ${String(c) === cls ? "selected" : ""}>${c}반</option>`).join("")}</select>
        <span class="small muted">참여 ${list.length}명 · ${Store.mode === "demo" ? "체험 모드" : "실시간 연결됨"}</span>
      </div>
      <div class="tabs noprint">
        ${[["rank", "개인 순위"], ["team", "구단 응원 점수"], ["gallery", "전시 라벨 갤러리"], ["scene", "나의 한 장면"], ["gm", "단장 시뮬레이션"]].map(([k, v]) => `<button data-k="${k}" class="${tab === k ? "on" : ""}">${v}</button>`).join("")}
        <a href="index.html?board=1" target="_blank" rel="noopener"><button>튜토리얼 띄우기</button></a><button id="csv">CSV 내려받기</button><button id="print">인쇄</button>
      </div>
      <div class="panel" id="body"></div>`;
    document.getElementById("cls").onchange = e => { cls = e.target.value; render(); };
    document.querySelectorAll(".tabs button[data-k]").forEach(b => b.onclick = () => { tab = b.dataset.k; render(); });
    document.getElementById("csv").onclick = csv;
    document.getElementById("print").onclick = () => window.print();
    const body = document.getElementById("body");
    if (tab === "rank") body.innerHTML = rankHTML(list);
    if (tab === "team") body.innerHTML = teamHTML(list);
    if (tab === "gallery") body.innerHTML = galleryHTML(list);
    if (tab === "scene") body.innerHTML = sceneHTML(list);
    if (tab === "gm") body.innerHTML = gmHTML(list);
  }

  function gmHTML(list) {
    const G = D.gm || {};
    const parts = Object.keys(G).map(tk => {
      const done = list.filter(r => r.gm && r.gm[tk] && r.gm[tk].picks && r.gm[tk].picks.length >= G[tk].scenes.length);
      if (!done.length) return "";
      const ends = {}; done.forEach(r => { const e = r.gm[tk].ending; ends[e] = (ends[e] || 0) + 1; });
      return `<h2>${esc(D.teams[tk].name)} <small class="muted">${done.length}명 완료</small></h2>
        <p>${Object.entries(ends).sort((a, b) => b[1] - a[1]).map(([e, n]) => `<span class="pill">🏆 ${esc(e)} ${n}명</span>`).join(" ")}</p>
        <table><thead><tr><th>장면</th><th>실제 단장과 같은 선택</th><th>토론 질문</th></tr></thead><tbody>
        ${G[tk].scenes.map((sc, i) => { const ri = sc.choices.findIndex(c => c.real); const same = done.filter(r => r.gm[tk].picks[i] === ri).length; const pct = Math.round(same / done.length * 100);
          return `<tr><td><b>${esc(sc.year)}</b> ${esc(sc.title)}</td><td><div class="bar"><i style="width:${pct}%"></i></div> ${pct}% (${same}/${done.length})</td><td class="small">${esc(sc.debate || "")}</td></tr>`; }).join("")}
        </tbody></table>`;
    }).join("");
    return parts || `<p class="muted">아직 단장 시뮬레이션을 끝낸 학생이 없어요.</p>`;
  }

  function tname(k) { return k && D.teams[k] ? D.teams[k].short : "-"; }

  function rankHTML(list) {
    const sorted = list.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0) || (b.progress || 0) - (a.progress || 0));
    let rank = 0, prev = null;
    return `<table><thead><tr><th>순위</th><th>반</th><th>번호</th><th>이름</th><th>구단</th><th>진행</th><th>점수</th><th>팬 등급</th><th>최근</th></tr></thead><tbody>
      ${sorted.map((r, i) => { if (r.pct !== prev) { rank = i + 1; prev = r.pct; } return `<tr class="${rank === 1 ? "top1" : ""}">
        <td class="n">${rank}</td><td>${r.cls || ""}</td><td>${r.num || ""}</td><td>${esc(r.name)}</td>
        <td>${r.team ? `<span style="color:${D.teams[r.team].color === "#000000" ? "#ddd" : D.teams[r.team].color};filter:brightness(1.6)">■</span> ${tname(r.team)}` : "선택 전"}</td>
        <td>${r.progress || 0}/${r.total || "-"}${r.finished ? " ✓" : ""}</td><td class="n">${(r.pct || 0).toFixed(1)}%</td><td>${esc(r.fan || "")}</td>
        <td class="small muted">${r.updatedAt ? new Date(r.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""}</td></tr>`; }).join("")}
      </tbody></table>`;
  }

  function teamHTML(list) {
    const by = {};
    list.filter(r => r.team).forEach(r => { (by[r.team] = by[r.team] || []).push(r.pct || 0); });
    const arr = D.teamOrder.map(k => ({ k, n: (by[k] || []).length, avg: by[k] ? by[k].reduce((a, b) => a + b, 0) / by[k].length : 0 }))
      .sort((a, b) => b.avg - a.avg);
    return `<p class="small muted">같은 구단을 고른 학생들의 평균 점수예요. 평균이라 인원이 많은 팀이 유리하지 않아요.</p>
      ${arr.map(t => `<div class="tbar"><div><b>${esc(D.teams[t.k].name)}</b> <span class="small muted">${t.n}명</span></div>
        <div class="bar"><i style="width:${t.avg}%;background:${D.teams[t.k].color === "#000000" ? "#888" : D.teams[t.k].color}"></i></div>
        <div class="n score">${t.n ? t.avg.toFixed(1) + "%" : "-"}</div></div>`).join("")}`;
  }

  function galleryHTML(list) {
    const L = list.filter(r => r.label && r.label.fact);
    if (!L.length) return `<p>아직 전시된 라벨이 없어요. 학생들이 마지막 단계에서 라벨을 쓰면 여기에 모여요.</p>`;
    return `<div class="gallery">${L.sort((a, b) => (a.team || "").localeCompare(b.team || "")).map(r => { const l = r.label, t = D.teams[r.team]; return `
      <div class="label-preview" style="--c:${t ? t.color : "#999"}"><div class="small" style="color:#666">${esc(t ? t.name : "")} · ${esc(l.cardYear || "")}</div>
      <h2 style="margin:4px 0 8px">${esc(l.cardTitle || "")}</h2>
      <div>① ${esc(l.fact)}</div><div>② ${esc(l.context)}${l.eraText ? ` <span class="small" style="color:#888">[${esc(l.eraText)}]</span>` : ""}</div>
      <div>③ ${esc(l.source)}${l.sourceLink ? ` <a class="small" href="${esc(l.sourceLink)}" target="_blank">[${esc(l.sourceTitle)}]</a>` : ""}</div>
      <div class="small" style="color:#666;margin-top:6px">큐레이터: ${r.cls}반 ${r.num}번 ${esc(r.name)}</div></div>`; }).join("")}</div>`;
  }

  function sceneHTML(list) {
    const L = list.filter(r => r.scene && r.scene.text);
    if (!L.length) return `<p>아직 올라온 '나의 한 장면'이 없어요.</p>`;
    return `<table><thead><tr><th>이름</th><th>구단</th><th>고른 카드</th><th>이유</th></tr></thead><tbody>
      ${L.map(r => `<tr><td>${r.cls}반 ${esc(r.name)}</td><td>${tname(r.team)}</td><td>${esc(r.scene.card ? r.scene.card.yr + " " + r.scene.card.title : "")}</td><td>${esc(r.scene.text)}</td></tr>`).join("")}</tbody></table>`;
  }

  function csv() {
    const head = ["학번", "반", "번호", "이름", "구단", "진행", "전체", "점수(%)", "팬 등급", "완료", "라벨 카드", "라벨1(사실)", "라벨2(맥락)", "라벨3(출처)", "한 장면"];
    const lines = [head].concat(filtered().map(r => [r.sid, r.cls, r.num, r.name, tname(r.team), r.progress, r.total, r.pct, r.fan, r.finished ? "O" : "",
      r.label ? r.label.cardTitle : "", r.label ? r.label.fact : "", r.label ? r.label.context : "", r.label ? r.label.source : "", r.scene ? r.scene.text : ""]));
    const text = "﻿" + lines.map(l => l.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `내팀연대기_${cls === "all" ? "전체" : cls + "반"}.csv`; a.click();
  }

  function start() {
    Store.init().then(() => {
      $t.innerHTML = `<div class="panel">연결 중…</div>`;
      Store.watchAll(list => { rows = list; render(); });
    }).catch(() => { $t.innerHTML = `<div class="panel">Firebase 연결에 실패했어요. config.js 설정을 확인해 주세요.</div>`; });
  }

  if (sessionStorage.getItem("tpin") === "1") start(); else gate();
})();
