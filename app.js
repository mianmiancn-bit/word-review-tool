"use strict";

const app = document.getElementById("app");
const toast = document.getElementById("toast");
const progressImport = document.getElementById("progress-import");
const logic = window.DictationLogic;
const BUILTIN_SETS = Array.isArray(window.BUILTIN_WORD_SETS) ? window.BUILTIN_WORD_SETS : [];
const STORAGE_KEY = "vocab-dictation-notebook-v2";
const LEGACY_STORAGE_KEY = "vocab-dictation-notebook-v1";
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
    history: []
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    const validation = logic.validateBackup(parsed);
    if (!validation.valid) return emptyStore();
    if (validation.legacy) {
      const migrated = {
        schemaVersion: logic.SCHEMA_VERSION,
        activeSession: null,
        history: parsed.history || []
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {
      schemaVersion: logic.SCHEMA_VERSION,
      activeSession: parsed.activeSession || null,
      history: parsed.history || []
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

function totalItems(set) {
  return set.sections.reduce((sum, section) => sum + section.items.length, 0);
}

function majorLabel(index) {
  const numeral = MAJOR_NUMERALS[index] || String(index + 1);
  return `第${numeral}大题`;
}

function flattenSet(set) {
  return set.sections.flatMap((section, sectionIndex) =>
    section.items.map((item, itemIndex) => ({
      ...item,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionIndex,
      itemNumber: itemIndex + 1
    }))
  );
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
        <span>原序整卷 · 实用严格判分 · 错词循环</span>
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
  const sectionCount = BUILTIN_SETS.reduce((sum, set) => sum + set.sections.length, 0);
  const active = state.store.activeSession;
  const recent = state.store.history.slice(-5).reverse();

  const setOptions = BUILTIN_SETS.map((set) => `
    <option value="${escapeHtml(set.id)}" ${set.id === selected?.id ? "selected" : ""}>
      ${escapeHtml(set.title)} · ${totalItems(set)} 词
    </option>`).join("");

  const outline = selected?.sections.map((section, index) => `
    <li>
      <span>${majorLabel(index)}</span>
      <strong>${escapeHtml(section.title)}</strong>
      <small>${section.items.length} 词</small>
    </li>`).join("") || "";

  const resume = active ? `
    <article class="resume-slip">
      <div>
        <p class="eyebrow">UNFINISHED PAPER</p>
        <h3>${escapeHtml(active.setTitle)}</h3>
        <p>第 ${active.round} 轮 · ${active.currentIds.length} 个待默词 · ${formatDate(active.startedAt)}</p>
      </div>
      <button class="button button-ink" id="resume-session">继续整张默写 →</button>
    </article>` : "";

  const history = recent.length ? recent.map((entry) => `
    <li><span>${escapeHtml(entry.setTitle)}</span><strong>${entry.total} 词 / ${entry.rounds} 轮</strong><time>${formatDate(entry.completedAt)}</time></li>`
  ).join("") : `<li class="empty-list">完成一张专题默写后，记录会出现在这里。</li>`;

  app.innerHTML = shell(`
    <main>
      <section class="hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">WRITE · CHECK · REPEAT</p>
          <h1>从第一大题开始，<br><em>按原顺序整张写完。</em></h1>
          <p class="hero-lead">不抽词、不乱序。每个专题保持原来的章节结构；提交后只重默错词，且错词仍按原位置和大题顺序排列。</p>
          <div class="ledger-stats" aria-label="内置专题统计">
            <div><strong>${builtinCount}</strong><span>内置词汇</span></div>
            <div><strong>${sectionCount}</strong><span>完整大题</span></div>
            <div><strong>${state.store.history.length}</strong><span>完成记录</span></div>
          </div>
        </div>

        <section class="setup-sheet" aria-labelledby="setup-title">
          <span class="paperclip" aria-hidden="true"></span>
          <div class="sheet-number">01</div>
          <p class="eyebrow">FULL DICTATION PAPER</p>
          <h2 id="setup-title">开始一张完整默写</h2>
          <label class="field-label" for="set-select">选择专题</label>
          <select id="set-select" class="line-select">${setOptions}</select>
          <div class="paper-summary">
            <strong>${selected?.sections.length || 0} 道大题</strong>
            <span>${selected ? totalItems(selected) : 0} 个词 · 完整原序</span>
          </div>
          <ol class="exam-outline" aria-label="试卷大题目录">${outline}</ol>
          <button class="button button-primary button-wide" id="start-session">按原顺序开始整张默写</button>
          <p class="setup-hint">忽略大小写与多余空格，但拼写、词序和标点必须正确。</p>
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
  document.getElementById("start-session")?.addEventListener("click", startSession);
  document.getElementById("resume-session")?.addEventListener("click", () => {
    state.view = "session";
    renderSession();
  });
  document.getElementById("export-progress")?.addEventListener("click", exportProgress);
  document.getElementById("import-progress")?.addEventListener("click", () => progressImport.click());
  document.getElementById("reset-progress")?.addEventListener("click", resetProgress);
}

function startSession() {
  if (state.store.activeSession && !window.confirm("开始新的完整默写会替换当前未完成内容。确定继续吗？")) return;
  const set = currentSet();
  if (!set) return;
  const items = flattenSet(set);
  state.store.activeSession = {
    id: `session-${Date.now()}`,
    setId: set.id,
    setTitle: set.title,
    sectionTitle: "完整专题",
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
          <div class="status-cell" aria-live="polite"><span>${statusLabel}</span></div>
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
      <p>整张写完后统一提交。<kbd>Ctrl</kbd> + <kbd>Enter</kbd> 也可以批改。</p>
      <button class="button button-primary" id="submit-round">提交整张并批改</button>
    </div>`;

  app.innerHTML = shell(`
    <main class="session-main">
      <section class="session-heading">
        <button class="back-link" id="pause-session">← 暂停并返回</button>
        <div class="session-title">
          <p class="eyebrow">ROUND ${String(session.round).padStart(2, "0")}</p>
          <h1>${escapeHtml(session.setTitle)}</h1>
          <p>${session.round === 1 ? "完整原序试卷" : "错词重默（保持原题顺序）"} · 本轮 ${items.length} 词</p>
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
    setTitle: session.setTitle,
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
  const firstRate = Math.round((session.firstRoundCorrect / session.items.length) * 100);
  app.innerHTML = shell(`
    <main class="completion-main">
      <div class="completion-sheet">
        <div class="completion-check">✓</div>
        <p class="eyebrow">FULL PAPER MASTERED</p>
        <h1>整张专题，全部写对了。</h1>
        <p class="completion-copy">${escapeHtml(session.setTitle)} · 完整原序试卷</p>
        <div class="completion-stats">
          <div><strong>${session.items.length}</strong><span>掌握词汇</span></div>
          <div><strong>${session.round}</strong><span>完成轮数</span></div>
          <div><strong>${firstRate}%</strong><span>首轮正确率</span></div>
        </div>
        <div class="completion-actions">
          <button class="button button-primary" id="another-session">返回专题页</button>
          <button class="button button-secondary" id="repeat-session">重新默写整张</button>
        </div>
        <p class="completion-time">完成于 ${formatDate(session.completedAt)}</p>
      </div>
    </main>`, true);
  document.getElementById("brand-home")?.addEventListener("click", finishToHome);
  document.getElementById("another-session")?.addEventListener("click", finishToHome);
  document.getElementById("repeat-session")?.addEventListener("click", () => {
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
}

function finishToHome() {
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
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `词汇默写进度_${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
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
      history: parsed.history || []
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
  if (!window.confirm("清空当前默写和全部历史记录吗？此操作不能撤销。")) return;
  state.store = emptyStore();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  state.selectedSetId = BUILTIN_SETS[0]?.id || "";
  renderHome();
  showToast("本机进度已清空");
}

progressImport.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importProgressFile(file);
});

renderHome();
