Exit code: 0
Wall time: 0.5 seconds
Output:
"use strict";

const app = document.getElementById("app");
const toast = document.getElementById("toast");
const progressImport = document.getElementById("progress-import");
const logic = window.DictationLogic;
const BUILTIN_SETS = Array.isArray(window.BUILTIN_WORD_SETS) ? window.BUILTIN_WORD_SETS : [];
const STORAGE_KEY = "vocab-dictation-notebook-v4";
const LEGACY_STORAGE_KEYS = ["vocab-dictation-notebook-v3", "vocab-dictation-notebook-v2", "vocab-dictation-notebook-v1"];
const MAJOR_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

const state = {
  view: "home",
  selectedSetId: BUILTIN_SETS[0]?.id ?? "",
  store: loadStore()
};

function emptyStore() {
  return {
    schemaVersion: logic.SCHEMA_VERSION,
    activeSession: null,
    history: [],
    excludedIds: []
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    const validation = logic.validateBackup(parsed);
    if (!validation.valid) return emptyStore();
    if (validation.legacy) {
      const migrated = {
        schemaVersion: logic.SCHEMA_VERSION,
        activeSession: parsed.schemaVersion >= 2 ? (parsed.activeSession || null) : null,
        history: parsed.history || [],
        excludedIds: Array.isArray(parsed.excludedIds) ? parsed.excludedIds : []
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {
      schemaVersion: logic.SCHEMA_VERSION,
      activeSession: parsed.activeSession || null,
      history: parsed.history || [],
      excludedIds: parsed.excludedIds || []
    };
  } catch {
    return emptyStore();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.store));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function currentSet() {
  return BUILTIN_SETS.find((set) => set.id === state.selectedSetId) || BUILTIN_SETS[0];
}

function excludedIdSet() {
  return new Set(state.store.excludedIds || []);
}

function isPracticeItem(item) {
  return item.status !== "excluded_easy" && item.status !== "archived" && !excludedIdSet().has(item.id);
}

function activeTotal(set) {
  return set.sections.reduce((sum, section) => sum + section.items.filter(isPracticeItem).length, 0);
}

function localExcludedTotal(set) {
  const excluded = excludedIdSet();
  return set.sections.reduce((sum, section) => sum + section.items.filter((item) => excluded.has(item.id)).length, 0);
}

function totalItems(set) {
  return set.sections.reduce((sum, section) => sum + section.items.length, 0);
}

function majorLabel(index) {
  const numeral = MAJOR_NUMERALS[index] || String(index + 1);
  return `第${numeral}大题`;
}

function sectionItems(set, sectionIndex) {
  const section = set.sections[sectionIndex];
  if (!section) return [];
  return section.items.filter(isPracticeItem).map((item) => ({
    ...item,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionIndex,
    itemNumber: item.order
  }));
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function shell(content, compact = false) {
  return `
    <div class="site-shell ${compact ? "site-shell-compact" : ""}">
      <header class="masthead">
        <button class="brand" id="brand-home" aria-label="返回词汇默写簿首页">
          <span class="brand-stamp">默</span>
          <span>
            <strong>词汇默写簿</strong>
            <small>DICTATION NOTEBOOK</small>
          </span>
        </button>
        <div class="privacy-note"><span></span>答案只保存在这台设备</div>
      </header>
      ${content}
      <footer class="site-footer">
        <span>中文 → English</span>
        <span>大题独立 · 实用严格判分 · 错词循环</span>
        <span>非 ETS 官方产品</span>
      </footer>
    </div>`;
}

function renderHome() {
  state.view = "home";
  if (!BUILTIN_SETS.some((set) => set.id === state.selectedSetId)) {
    state.selectedSetId = BUILTIN_SETS[0]?.id || "";
  }
  const selected = currentSet();
  const builtinCount = BUILTIN_SETS.reduce((sum, set) => sum + totalItems(set), 0);
  const practiceCount = BUILTIN_SETS.reduce((sum, set) => sum + activeTotal(set), 0);
  const excludedCount = BUILTIN_SETS.reduce((sum, set) => sum + localExcludedTotal(set), 0);
  const sectionCount = BUILTIN_SETS.reduce((sum, set) => sum + set.sections.length, 0);
  const active = state.store.activeSession;
  const recent = state.store.history.slice(-5).reverse();
  const completedSectionIds = new Set(
    state.store.history
      .filter((entry) => entry.setId === selected?.id && entry.sectionId)
      .map((entry) => entry.sectionId)
  );

  const setOptions = BUILTIN_SETS.map((set) => `
    <option value="${escapeHtml(set.id)}" ${set.id === selected?.id ? "selected" : ""}>
      ${escapeHtml(set.title)} · ${activeTotal(set)} / ${totalItems(set)} 词
    </option>`).join("");

  const outline = selected?.sections.map((section, index) => {
    const activeCount = section.items.filter(isPracticeItem).length;
    const removedCount = section.items.length - activeCount;
    const completed = completedSectionIds.has(section.id);
    const isActive = active?.setId === selected.id && active?.sectionId === section.id;
    const actionLabel = isActive ? "继续" : (completed ? "再练一次" : "开始");
    return `
      <li class="${completed ? "completed" : ""} ${isActive ? "active" : ""}">
        <span class="question-number">${majorLabel(index)}</span>
        <div class="question-copy">
          <strong>${escapeHtml(section.title)}</strong>
          <small>${activeCount} 词${removedCount ? ` · 已移出 ${removedCount}` : ""}${completed ? " · 已完成" : ""}</small>
        </div>
        ${completed ? `<span class="question-check" aria-label="已完成">✓</span>` : ""}
        <button class="question-start" data-start-section="${escapeHtml(section.id)}" ${activeCount ? "" : "disabled"}>${activeCount ? actionLabel : "已清空"}</button>
      </li>`;
  }).join("") || "";

  const resume = active ? `
    <article class="resume-slip">
      <div>
        <p class="eyebrow">UNFINISHED PAPER</p>
        <h3>${escapeHtml(active.setTitle)} · ${escapeHtml(active.sectionTitle)}</h3>
        <p>第 ${active.round} 轮 · ${active.currentIds.length} 个待默词 · ${formatDate(active.startedAt)}</p>
      </div>
      <button class="button button-ink" id="resume-session">继续这道大题 →</button>
    </article>` : "";

  const history = recent.length ? recent.map((entry) => `
    <li><span>${escapeHtml(entry.setTitle)}${entry.sectionTitle ? ` · ${escapeHtml(entry.sectionTitle)}` : ""}</span><strong>${entry.total} 词 / ${entry.rounds} 轮</strong><time>${formatDate(entry.completedAt)}</time></li>`
  ).join("") : `<li class="empty-list">完成一道大题后，记录会出现在这里。</li>`;

  app.innerHTML = shell(`
    <main>
      <section class="hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">WRITE · CHECK · REPEAT</p>
          <h1>一次只练一道，<br><em>写完马上批改。</em></h1>
          <p class="hero-lead">不抽词、不乱序。每一道大题都可以单独开始、单独提交；遇到已经熟练的简单词，可以随时移出并在管理页恢复。</p>
          <div class="ledger-stats" aria-label="内置专题统计">
            <div><strong>${practiceCount}</strong><span>当前练习词汇</span></div>
            <div><strong>${sectionCount}</strong><span>完整大题</span></div>
            <div><strong>${excludedCount}</strong><span>本机已移出</span></div>
          </div>
        </div>

        <section class="setup-sheet" aria-labelledby="setup-title">
          <span class="paperclip" aria-hidden="true"></span>
          <div class="sheet-number">01</div>
          <p class="eyebrow">QUESTION DIRECTORY</p>
          <h2 id="setup-title">选择一道大题开始</h2>
          <label class="field-label" for="set-select">选择专题</label>
          <select id="set-select" class="line-select">${setOptions}</select>
          <div class="paper-summary">
            <strong>${selected?.sections.length || 0} 道大题</strong>
            <span>每题 ${selected ? Math.min(...selected.sections.map((section) => section.items.length)) : 0}–${selected ? Math.max(...selected.sections.map((section) => section.items.length)) : 0} 词 · 固定原序</span>
          </div>
          <ol class="exam-outline" aria-label="试卷大题目录">${outline}</ol>
          <p class="setup-hint">点击任意大题右侧的“开始”。忽略大小写与多余空格，但拼写、词序和标点必须正确。</p>
        </section>
      </section>

      ${resume}

      <section class="library-grid library-grid-single">
        <article class="library-panel history-panel">
          <div class="panel-heading">
            <div><p class="eyebrow">RECENT PAPERS</p><h2>最近完成</h2></div>
          </div>
          <ul class="history-list">${history}</ul>
        </article>
      </section>

      <section class="data-strip">
        <div><strong>换设备也能继续</strong><span>导出一个 JSON 进度文件，再在另一台设备导入。</span></div>
        <div class="data-actions">
          <button class="button button-secondary" id="manage-vocab">管理简单词</button>
          <button class="button button-ghost" id="export-progress">导出进度</button>
          <button class="button button-ghost" id="import-progress">导入进度</button>
          <button class="text-danger" id="reset-progress">清空本机进度</button>
        </div>
      </section>
    </main>`);
  bindHomeEvents();
}

function bindHomeEvents() {
  document.getElementById("brand-home")?.addEventListener("click", renderHome);
  document.getElementById("set-select")?.addEventListener("change", (event) => {
    state.selectedSetId = event.target.value;
    renderHome();
  });
  document.querySelectorAll("[data-start-section]").forEach((button) => {
    button.addEventListener("click", () => startSectionSession(button.dataset.startSection));
  });
  document.getElementById("resume-session")?.addEventListener("click", () => {
    state.view = "session";
    renderSession();
  });
  document.getElementById("export-progress")?.addEventListener("click", exportProgress);
  document.getElementById("manage-vocab")?.addEventListener("click", renderManager);
  document.getElementById("import-progress")?.addEventListener("click", () => progressImport.click());
  document.getElementById("reset-progress")?.addEventListener("click", resetProgress);
}

function startSectionSession(sectionId) {
  const set = currentSet();
  if (!set) return;
  const sectionIndex = set.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex < 0) return;
  const current = state.store.activeSession;
  if (current?.setId === set.id && current?.sectionId === sectionId && !current.completed) {
    state.view = "session";
    renderSession();
    return;
  }
  if (current && !window.confirm("开始另一道大题会替换当前未完成内容。确定继续吗？")) return;
  const section = set.sections[sectionIndex];
  const items = sectionItems(set, sectionIndex);
  if (!items.length) {
    showToast("这道大题的词都已移出，可在管理简单词中恢复");
    return;
  }
  state.store.activeSession = {
    id: `session-${Date.now()}`,
    setId: set.id,
    setTitle: set.title,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionIndex,
    items,
    currentIds: items.map((item) => item.id),
    round: 1,
    responses: {},
    results: null,
    firstRoundCorrect: null,
    startedAt: new Date().toISOString(),
    completed: false
  };
  persist();
  state.view = "session";
  renderSession();
}

function renderSession() {
  const session = state.store.activeSession;
  if (!session) {
    renderHome();
    return;
  }
  const blockedIds = new Set(session.items.filter((item) => !isPracticeItem(item)).map((item) => item.id));
  if (blockedIds.size) {
    if (session.round === 1 && Number.isInteger(session.firstRoundCorrect) && session.results) {
      const removedCorrect = session.results.filter((result) => blockedIds.has(result.id) && result.correct).length;
      session.firstRoundCorrect = Math.max(0, session.firstRoundCorrect - removedCorrect);
    }
    session.items = session.items.filter((item) => !blockedIds.has(item.id));
    session.currentIds = session.currentIds.filter((id) => !blockedIds.has(id));
    if (session.results) session.results = session.results.filter((result) => !blockedIds.has(result.id));
    blockedIds.forEach((id) => delete session.responses[id]);
    if (!session.items.length) {
      state.store.activeSession = null;
      persist();
      renderHome();
      showToast("未完成大题中的词已全部移出");
      return;
    }
    if (session.results && !session.results.some((result) => !result.correct)) {
      completeSession();
      return;
    }
    persist();
  }
  if (session.completed) {
    renderCompletion(session);
    return;
  }
  const itemMap = new Map(session.items.map((item) => [item.id, item]));
  const items = session.currentIds.map((id) => itemMap.get(id)).filter(Boolean);
  const resultMap = new Map((session.results || []).map((result) => [result.id, result]));
  const checked = Boolean(session.results);
  const correctCount = checked ? session.results.filter((item) => item.correct).length : 0;
  const wrongCount = checked ? session.results.length - correctCount : 0;
  const groups = [];

  items.forEach((item) => {
    let group = groups.find((candidate) => candidate.sectionId === item.sectionId);
    if (!group) {
      group = {
        sectionId: item.sectionId,
        sectionTitle: item.sectionTitle,
        sectionIndex: item.sectionIndex,
        items: []
      };
      groups.push(group);
    }
    group.items.push(item);
  });

  const papers = groups.map((group) => {
    const rows = group.items.map((item) => {
      const result = resultMap.get(item.id);
      const status = result ? (result.correct ? "correct" : "wrong") : "pending";
      const statusLabel = result ? (result.correct ? "✓ 正确" : "✕ 错误") : "待批改";
      return `
        <article class="word-row ${status}" data-word-row="${escapeHtml(item.id)}">
          <div class="word-index">${String(item.itemNumber).padStart(2, "0")}</div>
          <div class="prompt-cell">
            <label for="answer-${escapeHtml(item.id)}">${escapeHtml(item.prompt)}</label>
          </div>
          <div class="answer-cell">
            <input id="answer-${escapeHtml(item.id)}" data-answer-id="${escapeHtml(item.id)}"
              value="${escapeHtml(session.responses[item.id] || "")}" ${checked ? "readonly" : ""}
              autocomplete="off" autocapitalize="none" spellcheck="false"
              aria-label="${escapeHtml(item.prompt)} 的英文答案">
            ${result && !result.correct ? `<div class="correction"><span>正确答案</span><strong>${escapeHtml(item.answer)}</strong>${item.ipa ? `<small>${escapeHtml(item.ipa)}</small>` : ""}</div>` : ""}
          </div>
          <div class="status-cell" aria-live="polite">
            <span>${statusLabel}</span>
            <button class="exclude-word" data-exclude-word="${escapeHtml(item.id)}" type="button" title="太简单，移出练习">移出</button>
          </div>
        </article>`;
    }).join("");
    return `
      <section class="major-question" data-section-id="${escapeHtml(group.sectionId)}">
        <header class="major-heading">
          <span class="major-number">${majorLabel(group.sectionIndex)}</span>
          <h2>${escapeHtml(group.sectionTitle)}</h2>
          <small>${group.items.length} 词</small>
        </header>
        <div class="word-sheet" aria-label="${majorLabel(group.sectionIndex)} ${escapeHtml(group.sectionTitle)}">${rows}</div>
      </section>`;
  }).join("");

  const actionArea = checked ? `
    <div class="round-result" role="status">
      <div><strong>${correctCount}</strong><span>本轮正确</span></div>
      <div class="wrong-stat"><strong>${wrongCount}</strong><span>需要重默</span></div>
      <button class="button button-primary" id="retry-wrong">只重默这 ${wrongCount} 个错词 →</button>
  </div>` : `
    <div class="submit-bar">
      <p>本大题写完即可提交。<kbd>Ctrl</kbd> + <kbd>Enter</kbd> 也可以批改。</p>
      <button class="button button-primary" id="submit-round">提交本大题并批改</button>
    </div>`;

  app.innerHTML = shell(`
    <main class="session-main">
      <section class="session-heading">
        <button class="back-link" id="pause-session">← 暂停并返回</button>
        <div class="session-title">
          <p class="eyebrow">ROUND ${String(session.round).padStart(2, "0")}</p>
          <h1>${escapeHtml(session.setTitle)} · ${majorLabel(session.sectionIndex)}</h1>
          <p>${escapeHtml(session.sectionTitle)} · ${session.round === 1 ? "本题原序默写" : "错词重默（保持原题顺序）"} · 本轮 ${items.length} 词</p>
        </div>
        <div class="round-seal"><strong>${session.round}</strong><span>轮</span></div>
      </section>
      ${checked ? `<div class="correction-legend"><span class="legend-correct">绿色：正确</span><span class="legend-wrong">红色：错误</span><span class="legend-answer">蓝色：标准答案</span></div>` : ""}
      <div class="exam-paper">${papers}</div>
      ${actionArea}
    </main>`, true);
  bindSessionEvents(checked);
}

function bindSessionEvents(checked) {
  document.getElementById("brand-home")?.addEventListener("click", pauseSession);
  document.getElementById("pause-session")?.addEventListener("click", pauseSession);
  document.querySelectorAll("[data-exclude-word]").forEach((button) => {
    button.addEventListener("click", () => excludeSessionWord(button.dataset.excludeWord));
  });
  if (!checked) {
    const inputs = [...document.querySelectorAll("[data-answer-id]")];
    inputs.forEach((input, index) => {
      input.addEventListener("input", () => {
        state.store.activeSession.responses[input.dataset.answerId] = input.value;
        persist();
      });
      input.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key === "Enter") {
          event.preventDefault();
          submitRound();
        } else if (event.key === "Enter") {
          event.preventDefault();
          inputs[index + 1]?.focus();
        }
      });
    });
    document.getElementById("submit-round")?.addEventListener("click", submitRound);
    requestAnimationFrame(() => inputs.find((input) => !input.value)?.focus());
  } else {
    document.getElementById("retry-wrong")?.addEventListener("click", retryWrong);
  }
}

function excludeSessionWord(itemId) {
  const session = state.store.activeSession;
  if (!session || !session.items.some((item) => item.id === itemId)) return;
  if (!state.store.excludedIds.includes(itemId)) state.store.excludedIds.push(itemId);
  const removedResult = session.results?.find((item) => item.id === itemId);
  if (session.round === 1 && removedResult?.correct && Number.isInteger(session.firstRoundCorrect)) {
    session.firstRoundCorrect = Math.max(0, session.firstRoundCorrect - 1);
  }
  session.items = session.items.filter((item) => item.id !== itemId);
  session.currentIds = session.currentIds.filter((id) => id !== itemId);
  if (session.results) session.results = session.results.filter((item) => item.id !== itemId);
  delete session.responses[itemId];
  if (!session.items.length) {
    state.store.activeSession = null;
    persist();
    renderHome();
    showToast("本大题已全部移出练习，可在管理页恢复");
    return;
  }
  if (session.results && !session.results.some((item) => !item.correct)) {
    completeSession();
    showToast("这个词已移出练习");
    return;
  }
  persist();
  renderSession();
  showToast("已移出练习，可在管理页恢复");
}

function pauseSession() {
  persist();
  renderHome();
}

function submitRound() {
  const session = state.store.activeSession;
  if (!session || session.results) return;
  document.querySelectorAll("[data-answer-id]").forEach((input) => {
    session.responses[input.dataset.answerId] = input.value;
  });
  const map = new Map(session.items.map((item) => [item.id, item]));
  const items = session.currentIds.map((id) => map.get(id)).filter(Boolean);
  session.results = logic.gradeItems(items, session.responses);
  if (session.round === 1) session.firstRoundCorrect = session.results.filter((item) => item.correct).length;
  const wrong = session.results.filter((item) => !item.correct);
  if (!wrong.length) completeSession();
  else {
    persist();
    renderSession();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function retryWrong() {
  const session = state.store.activeSession;
  if (!session?.results) return;
  session.currentIds = session.results.filter((item) => !item.correct).map((item) => item.id);
  session.round += 1;
  session.responses = {};
  session.results = null;
  persist();
  renderSession();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function completeSession() {
  const session = state.store.activeSession;
  session.completed = true;
  session.completedAt = new Date().toISOString();
  const entry = {
    id: session.id,
    setId: session.setId,
    setTitle: session.setTitle,
    sectionId: session.sectionId,
    sectionTitle: session.sectionTitle,
    sectionIndex: session.sectionIndex,
    total: session.items.length,
    rounds: session.round,
    firstRoundCorrect: session.firstRoundCorrect,
    completedAt: session.completedAt
  };
  if (!state.store.history.some((item) => item.id === entry.id)) state.store.history.push(entry);
  state.store.history = state.store.history.slice(-100);
  persist();
  renderCompletion(session);
}

function renderCompletion(session) {
  const firstRate = session.items.length ? Math.round((session.firstRoundCorrect / session.items.length) * 100) : 0;
  const set = BUILTIN_SETS.find((candidate) => candidate.id === session.setId);
  const nextSection = set?.sections.find((section, index) => index > session.sectionIndex && section.items.some(isPracticeItem));
  const hasNext = Boolean(nextSection);
  app.innerHTML = shell(`
    <main class="completion-main">
      <div class="completion-sheet">
        <div class="completion-check">✓</div>
        <p class="eyebrow">QUESTION MASTERED</p>
        <h1>本大题，全部写对了。</h1>
        <p class="completion-copy">${escapeHtml(session.setTitle)} · ${majorLabel(session.sectionIndex)} · ${escapeHtml(session.sectionTitle)}</p>
        <div class="completion-stats">
          <div><strong>${session.items.length}</strong><span>掌握词汇</span></div>
          <div><strong>${session.round}</strong><span>完成轮数</span></div>
          <div><strong>${firstRate}%</strong><span>首轮正确率</span></div>
        </div>
        <div class="completion-actions">
          <button class="button button-primary" id="another-session">返回大题目录</button>
          ${hasNext ? `<button class="button button-secondary" id="next-session">下一大题</button>` : ""}
          <button class="button button-secondary" id="repeat-session">重默本大题</button>
        </div>
        <p class="completion-time">完成于 ${formatDate(session.completedAt)}</p>
      </div>
    </main>`, true);
  document.getElementById("brand-home")?.addEventListener("click", finishToHome);
  document.getElementById("another-session")?.addEventListener("click", finishToHome);
  document.getElementById("repeat-session")?.addEventListener("click", () => {
    session.id = `session-${Date.now()}`;
    session.currentIds = session.items.map((item) => item.id);
    session.round = 1;
    session.responses = {};
    session.results = null;
    session.firstRoundCorrect = null;
    session.startedAt = new Date().toISOString();
    session.completed = false;
    delete session.completedAt;
    persist();
    renderSession();
  });
  document.getElementById("next-session")?.addEventListener("click", () => {
    if (!nextSection) return;
    state.store.activeSession = null;
    state.selectedSetId = session.setId;
    persist();
    startSectionSession(nextSection.id);
  });
}

function renderManager() {
  state.view = "manager";
  const selected = currentSet();
  const excluded = excludedIdSet();
  const setOptions = BUILTIN_SETS.map((set) => `
    <option value="${escapeHtml(set.id)}" ${set.id === selected?.id ? "selected" : ""}>${escapeHtml(set.title)}</option>
  `).join("");
  const sections = selected?.sections.map((section, sectionIndex) => {
    const rows = section.items.map((item) => {
      const localExcluded = excluded.has(item.id);
      const sourceExcluded = item.status === "excluded_easy" || item.status === "archived";
      return `
        <article class="manage-word-row ${localExcluded || sourceExcluded ? "is-excluded" : ""}" data-manage-word="${escapeHtml(item.id)}">
          <span class="manage-index">${String(item.order).padStart(2, "0")}</span>
          <div class="manage-prompt"><strong>${escapeHtml(item.prompt)}</strong><small>${escapeHtml(item.answer)}${item.ipa ? ` · ${escapeHtml(item.ipa)}` : ""}</small></div>
          ${sourceExcluded
            ? `<span class="source-excluded">正式词库已移出</span>`
            : localExcluded
              ? `<button class="restore-word" data-restore-word="${escapeHtml(item.id)}">恢复练习</button>`
              : `<button class="mark-easy" data-mark-easy="${escapeHtml(item.id)}">太简单，移出</button>`}
        </article>`;
    }).join("");
    const removed = section.items.filter((item) => excluded.has(item.id) || item.status !== "active").length;
    return `
      <details class="manage-section" ${sectionIndex === 0 ? "open" : ""}>
        <summary><span>${majorLabel(sectionIndex)}</span><strong>${escapeHtml(section.title)}</strong><small>${section.items.length - removed} 练习中 · ${removed} 已移出</small></summary>
        <div class="manage-word-list">${rows}</div>
      </details>`;
  }).join("") || "";
  const localCount = localExcludedTotal(selected);
  app.innerHTML = shell(`
    <main class="manager-main">
      <section class="manager-heading">
        <button class="back-link" id="manager-back">← 返回大题目录</button>
        <p class="eyebrow">VOCABULARY EDIT DESK</p>
        <h1>简单词管理</h1>
        <p>点击“太简单，移出”后，该词不会再出现在默写中；这里只做可恢复的本机标记，不会直接删除正式词库。</p>
      </section>
      <section class="manager-toolbar">
        <label><span>专题</span><select id="manager-set-select" class="line-select">${setOptions}</select></label>
        <div class="manager-count"><strong>${activeTotal(selected)}</strong><span>练习中</span></div>
        <div class="manager-count manager-count-red"><strong>${localCount}</strong><span>本机已移出</span></div>
        <button class="button button-ghost" id="export-decisions" ${localCount ? "" : "disabled"}>导出整理结果</button>
        <button class="button button-ghost" id="restore-all" ${localCount ? "" : "disabled"}>恢复本专题全部</button>
      </section>
      <section class="manager-sections">${sections}</section>
    </main>`, true);
  bindManagerEvents();
}

function bindManagerEvents() {
  document.getElementById("brand-home")?.addEventListener("click", renderHome);
  document.getElementById("manager-back")?.addEventListener("click", renderHome);
  document.getElementById("manager-set-select")?.addEventListener("change", (event) => {
    state.selectedSetId = event.target.value;
    renderManager();
  });
  document.querySelectorAll("[data-mark-easy]").forEach((button) => button.addEventListener("click", () => setLocalExclusion(button.dataset.markEasy, true)));
  document.querySelectorAll("[data-restore-word]").forEach((button) => button.addEventListener("click", () => setLocalExclusion(button.dataset.restoreWord, false)));
  document.getElementById("export-decisions")?.addEventListener("click", exportReviewDecisions);
  document.getElementById("restore-all")?.addEventListener("click", restoreCurrentSet);
}

function setLocalExclusion(itemId, excluded) {
  const ids = new Set(state.store.excludedIds);
  if (excluded) ids.add(itemId);
  else ids.delete(itemId);
  state.store.excludedIds = [...ids];
  persist();
  const scrollTop = window.scrollY;
  renderManager();
  requestAnimationFrame(() => window.scrollTo(0, scrollTop));
  showToast(excluded ? "已移出练习，可随时恢复" : "已恢复到原来的题序");
}

function restoreCurrentSet() {
  const set = currentSet();
  if (!set || !window.confirm(`恢复「${set.title}」中全部本机已移出的词吗？`)) return;
  const setIds = new Set(set.sections.flatMap((section) => section.items.map((item) => item.id)));
  state.store.excludedIds = state.store.excludedIds.filter((id) => !setIds.has(id));
  persist();
  renderManager();
  showToast("本专题已全部恢复");
}

function exportReviewDecisions() {
  const excluded = excludedIdSet();
  const items = BUILTIN_SETS.flatMap((set) => set.sections.flatMap((section) => section.items.map((item) => ({
    id: item.id,
    setId: set.id,
    sectionId: section.id,
    prompt: item.prompt,
    answer: item.answer
  })))).filter((item) => excluded.has(item.id));
  const payload = { schemaVersion: 1, type: "vocab-review-decisions", exportedAt: new Date().toISOString(), action: "exclude_easy", excludedIds: items.map((item) => item.id), items };
  downloadJson(payload, `简单词整理结果_${new Date().toISOString().slice(0, 10)}.json`);
  showToast("整理结果已导出，可交给主 Agent 写回正式词库");
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function finishToHome() {
  if (state.store.activeSession?.setId) state.selectedSetId = state.store.activeSession.setId;
  state.store.activeSession = null;
  persist();
  renderHome();
}

function exportProgress() {
  const payload = {
    ...state.store,
    schemaVersion: logic.SCHEMA_VERSION,
    exportedAt: new Date().toISOString()
  };
  downloadJson(payload, `词汇默写进度_${new Date().toISOString().slice(0, 10)}.json`);
  showToast("进度文件已导出");
}

async function importProgressFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const validation = logic.validateBackup(parsed);
    if (!validation.valid) throw new Error(validation.error);
    state.store = {
      schemaVersion: logic.SCHEMA_VERSION,
      activeSession: validation.legacy ? null : (parsed.activeSession || null),
      history: parsed.history || [],
      excludedIds: Array.isArray(parsed.excludedIds) ? parsed.excludedIds : []
    };
    if (state.store.activeSession && !BUILTIN_SETS.some((set) => set.id === state.store.activeSession.setId)) {
      state.store.activeSession = null;
    }
    persist();
    renderHome();
    showToast(validation.legacy ? "旧版完成记录已迁移" : "进度已恢复");
  } catch (error) {
    showToast(`导入失败：${error.message}`);
  } finally {
    progressImport.value = "";
  }
}

function resetProgress() {
  if (!window.confirm("清空当前默写、全部历史记录和本机移出清单吗？此操作不能撤销。")) return;
  state.store = emptyStore();
  localStorage.removeItem(STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  state.selectedSetId = BUILTIN_SETS[0]?.id || "";
  renderHome();
  showToast("本机进度已清空");
}

progressImport.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importProgressFile(file);
});

renderHome();

