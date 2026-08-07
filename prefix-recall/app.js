(function () {
  "use strict";

  const bank = window.PREFIX_WORD_BANK;
  const logic = window.PrefixRecallLogic;
  const STORAGE_KEY = "prefix-recall-workbench-v1";
  const state = loadState();
  let activePrefix = "co";
  let latestGrade = null;
  let revealAll = false;
  let missingQuery = "";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed?.schemaVersion === 1) return { schemaVersion: 1, history: Array.isArray(parsed.history) ? parsed.history : [], positions: parsed.positions || {} };
    } catch (_) {}
    return { schemaVersion: 1, history: [], positions: {} };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function setPrefix(prefix) {
    const normalized = logic.normalizePrefix(prefix);
    if (!normalized) return toast("请输入 1–4 个英文字母");
    activePrefix = normalized;
    latestGrade = null;
    revealAll = false;
    missingQuery = "";
    $("#active-prefix").textContent = normalized.toUpperCase();
    const count = logic.matchesForPrefix(bank.words, normalized).length;
    $("#match-hint").textContent = `参考库中有 ${count} 个匹配项`;
    $("#recall-input").value = "";
    $("#results").hidden = true;
    $("#recall-input").focus();
  }

  function nextPrefix() {
    const length = Number($("input[name='prefix-length']:checked").value);
    const next = logic.nextQueuedPrefix(bank.prefixQueues, length, state.positions[length] || 0);
    state.positions[length] = next.nextPosition;
    saveState();
    setPrefix(next.prefix);
  }

  function wordChip(entry, kind) {
    const source = entry.sources?.includes("approved") ? `<small>专题词${entry.meaning ? ` · ${escapeHtml(entry.meaning)}` : ""}</small>` : "";
    return `<li class="word-chip word-chip--${kind}"><b>${escapeHtml(entry.label || entry.word)}</b>${source}</li>`;
  }

  function renderMissingList() {
    if (!latestGrade) return;
    const query = missingQuery.trim().toLowerCase();
    const filtered = latestGrade.missing.filter((entry) => !query || entry.word.includes(query));
    const limit = revealAll || query ? filtered.length : 80;
    const shown = filtered.slice(0, limit);
    $("#missing-list").innerHTML = shown.map((entry) => wordChip(entry, "missing")).join("") || `<li class="empty">没有匹配项</li>`;
    $("#missing-count-note").textContent = query ? `筛选后 ${filtered.length} 个` : `共 ${latestGrade.missing.length} 个未想到`;
    const button = $("#toggle-missing");
    button.hidden = Boolean(query) || filtered.length <= 80;
    button.textContent = revealAll ? "收起，只看前 80 个" : `展开全部 ${filtered.length} 个`;
  }

  function renderResults() {
    const grade = latestGrade;
    const outsideItems = grade.outside.map((word) => `<li class="word-chip word-chip--outside"><b>${escapeHtml(word)}</b><small>库外待核验：符合前缀，但不在当前词库；本次不判错</small></li>`).join("");
    const wrongItems = grade.wrongPrefix.map((word) => `<li class="word-chip word-chip--wrong"><b>${escapeHtml(word)}</b><small>不是 ${escapeHtml(grade.prefix)} 开头</small></li>`).join("");
    const results = $("#results");
    results.hidden = false;
    results.innerHTML = `
      <div class="result-summary">
        <p>核对印次 <b>#${state.history.length}</b></p>
        <div><strong>${grade.recalled.length}</strong><span>库中已想到</span></div>
        <div><strong>${grade.missing.length}</strong><span>库中未想到</span></div>
        <div><strong>${grade.outside.length}</strong><span>库外待核验（不判错）</span></div>
      </div>
      <div class="result-column result-column--known"><h3><span>✓</span> 已想到</h3><ul>${grade.recalled.map((entry) => wordChip(entry, "known")).join("") || `<li class="empty">这轮还没有命中库内词</li>`}</ul></div>
      <div class="result-column result-column--missing">
        <div class="result-title"><h3><span>＋</span> 参考库补充</h3><label>在结果中搜索 <input id="missing-search" type="search" placeholder="输入词中片段"></label></div>
        <p id="missing-count-note" class="count-note"></p><ul id="missing-list" class="word-cloud"></ul>
        <button id="toggle-missing" class="text-button" type="button"></button>
      </div>
      ${(outsideItems || wrongItems) ? `<div class="result-column result-column--outside"><h3><span>◇</span> 你的其他答案</h3><ul>${outsideItems}${wrongItems}</ul></div>` : ""}
    `;
    $("#missing-search").addEventListener("input", (event) => { missingQuery = event.target.value; renderMissingList(); });
    $("#toggle-missing").addEventListener("click", () => { revealAll = !revealAll; renderMissingList(); });
    renderMissingList();
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitRecall() {
    const raw = $("#recall-input").value;
    latestGrade = logic.gradeRecall(bank.words, activePrefix, raw);
    state.history.unshift({
      id: `attempt-${Date.now()}`,
      prefix: activePrefix,
      recalled: latestGrade.recalled.length,
      missing: latestGrade.missing.length,
      outside: latestGrade.outside.length,
      entered: logic.parseAnswers(raw).length,
      completedAt: new Date().toISOString()
    });
    state.history = state.history.slice(0, 100);
    saveState();
    renderResults();
  }

  function switchView(viewName) {
    $$(".tab").forEach((tab) => {
      const active = tab.dataset.view === viewName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    $$(".view").forEach((view) => {
      const active = view.id === `${viewName}-view`;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
    });
    if (viewName === "history") renderHistory();
  }

  function renderComparisons() {
    $("#comparison-cards").innerHTML = bank.comparisons.map((card, index) => `
      <article class="index-card">
        <header><span>${String(index + 1).padStart(2, "0")}</span><div><p>${escapeHtml(card.prefix)}</p><h3>${escapeHtml(card.title)}</h3></div></header>
        <p class="card-cue">${escapeHtml(card.cue)}</p>
        <div class="comparison-table" role="table" aria-label="${escapeHtml(card.title)}">
          ${card.entries.map((entry) => `<div class="comparison-row" role="row"><b role="cell">${escapeHtml(entry.word)}</b><span role="cell">${escapeHtml(entry.meaning)}</span><small role="cell">${escapeHtml(entry.distinction)}<i>${escapeHtml(entry.collocation)}</i></small></div>`).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderFamilies() {
    $("#family-cards").innerHTML = bank.families.map((family, index) => `
      <article class="family-card">
        <div class="family-stamp"><span>${String(index + 1).padStart(2, "0")}</span><b>${escapeHtml(family.root)}</b></div>
        <h3>${escapeHtml(family.title)}</h3><p class="contrast">${escapeHtml(family.contrast)}</p>
        <ul>${family.forms.map((form) => `<li><span>${escapeHtml(form.partOfSpeech)}</span><b>${escapeHtml(form.word)}</b><em>${escapeHtml(form.meaning)}</em><small>${escapeHtml(form.collocation)}</small></li>`).join("")}</ul>
      </article>
    `).join("");
  }

  function renderHistory() {
    $("#history-summary").textContent = state.history.length ? `本机保存最近 ${state.history.length} 次核对。` : "还没有练习记录。";
    $("#history-list").innerHTML = state.history.map((item) => `
      <li><time>${new Date(item.completedAt).toLocaleString("zh-CN")}</time><b>${escapeHtml(item.prefix.toUpperCase())}</b><span>写出 ${item.entered} · 命中 ${item.recalled} · 库外 ${item.outside}</span></li>
    `).join("") || `<li class="empty">做完第一题后，记录会出现在这里。</li>`;
  }

  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  $("#next-prefix").addEventListener("click", nextPrefix);
  $("#use-prefix").addEventListener("click", () => setPrefix($("#manual-prefix").value));
  $("#manual-prefix").addEventListener("keydown", (event) => { if (event.key === "Enter") setPrefix(event.currentTarget.value); });
  $("#submit-recall").addEventListener("click", submitRecall);
  $("#recall-input").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); submitRecall(); } });
  $("#clear-history").addEventListener("click", () => {
    if (!window.confirm("只清空本网页的练习记录？")) return;
    state.history = [];
    saveState();
    renderHistory();
    toast("练习记录已清空");
  });

  renderComparisons();
  renderFamilies();
  setPrefix(activePrefix);
})();
