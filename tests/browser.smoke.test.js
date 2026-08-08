"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const artifacts = path.resolve(root, "..", "99_校验记录", "词汇网页截图");
fs.mkdirSync(artifacts, { recursive: true });

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function createStoredSession(id = "legacy-active-session") {
  return {
    id,
    setId: "geology",
    setTitle: "地质学词汇",
    sectionId: "geology-s1",
    sectionTitle: "一、地质学基础与地球结构",
    sectionIndex: 0,
    items: [{
      id: "geology-s1-001",
      prompt: "地质学",
      answer: "geology",
      ipa: "/dʒiˈɒlədʒi/",
      order: 1,
      status: "active",
      sectionId: "geology-s1",
      sectionTitle: "一、地质学基础与地球结构",
      sectionIndex: 0,
      itemNumber: 1
    }],
    currentIds: ["geology-s1-001"],
    round: 1,
    responses: { "geology-s1-001": "geo" },
    results: null,
    firstRoundCorrect: null,
    startedAt: "2026-08-01T00:00:00.000Z",
    completed: false
  };
}

function createServer() {
  return http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname.startsWith("/repo/")) pathname = pathname.slice(5);
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(target)] || "application/octet-stream" });
    fs.createReadStream(target).pipe(response);
  });
}

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const defaultChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : (fs.existsSync(defaultChrome) ? { executablePath: defaultChrome } : {})),
    timeout: 8000
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const externalRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) externalRequests.push(request.url());
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/repo/index.html`, { waitUntil: "networkidle" });
    console.log("step: per-question directory loaded");
    await page.screenshot({ path: path.join(artifacts, "01-首页.png"), fullPage: true });
    const homeText = await page.locator("body").innerText();
    assert.match(homeText, /432/);
    assert.match(homeText, /一次只练一道/);
    assert.match(homeText, /不抽词、不乱序/);
    assert.doesNotMatch(homeText, /我的词表|添加词表|本组数量|按原顺序开始整张/);
    assert.equal(await page.locator("[data-start-section]").count(), 9);
    assert.equal(externalRequests.length, 0, "页面不应请求外部资源");

    assert.equal(await page.locator("#set-select option").count(), 5);
    assert.equal(await page.locator('#set-select option[value="rail-industry-logistics"]').count(), 1);
    assert.equal(await page.locator('#set-select option[value="prefix-word-families"]').count(), 1);
    assert.equal(await page.locator('#set-select option[value="gardening-nursery"]').count(), 1);
    await page.locator("#set-select").selectOption("rail-industry-logistics");
    assert.equal(await page.locator("[data-start-section]").count(), 4);
    const newTopicOrder = await page.evaluate(() => ({
      expected: window.BUILTIN_WORD_SETS.find((set) => set.id === "rail-industry-logistics").sections.map((section) => section.id),
      actual: [...document.querySelectorAll("[data-start-section]")].map((button) => button.dataset.startSection)
    }));
    assert.deepEqual(newTopicOrder.actual, newTopicOrder.expected, "新增专题的大题必须保持正式词库顺序");
    await page.locator("#set-select").selectOption("geology");
    assert.equal(await page.locator("[data-start-section]").count(), 9);
    console.log("step: five approved topics and fixed topic order verified");

    await page.locator("#set-select").selectOption("gardening-nursery");
    assert.equal(await page.locator("[data-start-section]").count(), 1);
    const gardeningSectionId = await page.locator("[data-start-section]").getAttribute("data-start-section");
    const gardeningDirectoryOrder = await page.evaluate(() => ({
      expected: window.BUILTIN_WORD_SETS.find((set) => set.id === "gardening-nursery").sections.map((section) => section.id),
      actual: [...document.querySelectorAll("[data-start-section]")].map((button) => button.dataset.startSection)
    }));
    assert.deepEqual(gardeningDirectoryOrder.actual, gardeningDirectoryOrder.expected);
    await page.locator(`[data-start-section="${gardeningSectionId}"]`).click();
    assert.equal(await page.locator("[data-answer-id]").count(), 20);
    const gardeningOrder = await page.evaluate(() => ({
      expected: window.BUILTIN_WORD_SETS.find((set) => set.id === "gardening-nursery").sections[0].items.map((item) => item.id),
      actual: [...document.querySelectorAll("[data-answer-id]")].map((input) => input.dataset.answerId)
    }));
    assert.deepEqual(gardeningOrder.actual, gardeningOrder.expected, "gardening section must keep approved fixed order");
    const gardeningWrongIds = gardeningOrder.expected.filter((_, index) => [2, 11, 19].includes(index));
    await page.evaluate((wrongIds) => {
      const items = window.BUILTIN_WORD_SETS.find((set) => set.id === "gardening-nursery").sections[0].items;
      const answers = new Map(items.map((item) => [item.id, item.answer]));
      [...document.querySelectorAll("[data-answer-id]")].forEach((input) => {
        input.value = wrongIds.includes(input.dataset.answerId) ? "definitely wrong" : answers.get(input.dataset.answerId);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }, gardeningWrongIds);
    await page.locator("#submit-round").click();
    assert.deepEqual(
      await page.locator(".word-row.wrong [data-answer-id]").evaluateAll((inputs) => inputs.map((input) => input.dataset.answerId)),
      gardeningWrongIds,
      "gardening wrong words must retain their approved order"
    );
    await page.locator("#retry-wrong").click();
    assert.deepEqual(
      await page.locator("[data-answer-id]").evaluateAll((inputs) => inputs.map((input) => input.dataset.answerId)),
      gardeningWrongIds,
      "gardening wrong-only loop must retain original order"
    );
    await page.evaluate(() => {
      const items = window.BUILTIN_WORD_SETS.find((set) => set.id === "gardening-nursery").sections[0].items;
      const answers = new Map(items.map((item) => [item.id, item.answer]));
      [...document.querySelectorAll("[data-answer-id]")].forEach((input) => {
        input.value = answers.get(input.dataset.answerId);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    await page.locator("#submit-round").click();
    await page.locator("#another-session").click();
    await page.locator("#set-select").selectOption("geology");
    console.log("step: gardening 20-word fixed order and ordered wrong-only loop verified");

    await page.getByRole("button", { name: "管理简单词" }).click();
    await page.getByRole("heading", { name: "简单词管理" }).waitFor();
    assert.equal(await page.locator("[data-manage-word]").count(), 153);
    const managedId = "geology-s1-001";
    const managedRow = page.locator(`[data-manage-word="${managedId}"]`);
    await managedRow.getByRole("button", { name: "太简单，移出" }).click();
    assert.equal(await page.locator(`[data-manage-word="${managedId}"].is-excluded`).count(), 1);
    await page.screenshot({ path: path.join(artifacts, "04-简单词管理.png"), fullPage: true });
    const decisionsDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出整理结果" }).click();
    const decisionsDownload = await decisionsDownloadPromise;
    assert.match(decisionsDownload.suggestedFilename(), /简单词整理结果/);
    await page.locator(`[data-manage-word="${managedId}"]`).getByRole("button", { name: "恢复练习" }).click();
    assert.equal(await page.locator(`[data-manage-word="${managedId}"]`).getByRole("button", { name: "太简单，移出" }).count(), 1);
    await page.getByRole("button", { name: /返回大题目录/ }).click();
    console.log("step: reversible easy-word manager verified");

    await page.locator('[data-start-section="geology-s1"]').click();
    console.log("step: geology question 1 started independently");
    const inputs = page.locator("[data-answer-id]");
    assert.equal(await inputs.count(), 16);
    assert.equal(await page.locator(".major-question").count(), 1);
    assert.equal(await page.locator(".major-number").textContent(), "第一大题");
    const orderCheck = await page.evaluate(() => ({
      expected: window.BUILTIN_WORD_SETS[0].sections[0].items.map((item) => item.id),
      actual: [...document.querySelectorAll("[data-answer-id]")].map((input) => input.dataset.answerId)
    }));
    assert.deepEqual(orderCheck.actual, orderCheck.expected, "单题内部必须严格保持原始顺序");

    await page.evaluate(() => {
      const answers = new Map(window.BUILTIN_WORD_SETS[0].sections[0].items.map((item) => [item.id, item.answer]));
      [...document.querySelectorAll("[data-answer-id]")].forEach((input, index) => {
        input.value = index === 7 ? "definitely wrong" : `  ${answers.get(input.dataset.answerId).toUpperCase()}  `;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    await page.getByRole("button", { name: "提交本大题并批改" }).click();
    assert.equal(await page.locator(".word-row.correct").count(), 15);
    assert.equal(await page.locator(".word-row.wrong").count(), 1);
    const wrongId = await page.locator(".word-row.wrong [data-answer-id]").getAttribute("data-answer-id");
    const correction = await page.locator(".correction strong").textContent();
    await page.screenshot({ path: path.join(artifacts, "02-单题批改.png"), fullPage: true });

    await page.getByRole("button", { name: /只重默这 1 个错词/ }).click();
    assert.equal(await page.locator("[data-answer-id]").count(), 1);
    assert.equal(await page.locator("[data-answer-id]").getAttribute("data-answer-id"), wrongId);
    await page.locator("[data-answer-id]").fill(correction);
    await page.getByRole("button", { name: "提交本大题并批改" }).click();
    await page.getByText("本大题，全部写对了。").waitFor();
    console.log("step: question-local wrong-only loop completed");

    await page.getByRole("button", { name: "返回大题目录" }).click();
    const firstRow = page.locator('.exam-outline li:has([data-start-section="geology-s1"])');
    await firstRow.waitFor();
    assert.equal(await firstRow.evaluate((element) => element.classList.contains("completed")), true);
    assert.match(await firstRow.innerText(), /已完成/);
    assert.equal(await firstRow.locator("[data-start-section]").textContent(), "再练一次");

    await page.locator('[data-start-section="geology-s2"]').click();
    assert.equal(await page.locator("[data-answer-id]").count(), 18);
    await page.locator("[data-answer-id]").first().fill("temporary answer");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /继续这道大题/ }).click();
    assert.equal(await page.locator("[data-answer-id]").count(), 18);
    assert.equal(await page.locator("[data-answer-id]").first().inputValue(), "temporary answer");
    const inlineExcludedId = await page.locator("[data-answer-id]").first().getAttribute("data-answer-id");
    await page.locator(`[data-word-row="${inlineExcludedId}"]`).getByRole("button", { name: "移出" }).click();
    assert.equal(await page.locator("[data-answer-id]").count(), 17);
    console.log("step: per-question persistence restored");
    await page.getByRole("button", { name: /暂停并返回/ }).click();

    await page.getByRole("button", { name: "管理简单词" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "恢复本专题全部" }).click();
    await page.getByRole("button", { name: /返回大题目录/ }).click();
    console.log("step: in-session easy-word removal and manager restore verified");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出进度" }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /词汇默写进度/);
    const badBackup = path.join(os.tmpdir(), `bad-vocab-progress-${Date.now()}.json`);
    fs.writeFileSync(badBackup, JSON.stringify({ schemaVersion: 999, history: [] }));
    await page.locator("#progress-import").setInputFiles(badBackup);
    await page.locator("#toast").filter({ hasText: "导入失败" }).waitFor();

    const damagedBackup = path.join(os.tmpdir(), `damaged-vocab-progress-${Date.now()}.json`);
    fs.writeFileSync(damagedBackup, JSON.stringify({ schemaVersion: 4, history: [], excludedIds: [], activeSession: { items: null } }));
    await page.locator("#progress-import").setInputFiles(damagedBackup);
    await page.locator("#toast").filter({ hasText: "当前默写会话结构损坏" }).waitFor();

    const refreshContext = await browser.newContext();
    const refreshPage = await refreshContext.newPage();
    const refreshSession = createStoredSession("refresh-active-session");
    const refreshHistory = [{
      id: "refresh-history",
      setId: "geology",
      setTitle: "地质学词汇",
      sectionId: "geology-s1",
      sectionTitle: "一、地质学基础与地球结构",
      sectionIndex: 0,
      total: 1,
      rounds: 1,
      firstRoundCorrect: 1,
      completedAt: "2026-07-31T00:00:00.000Z"
    }];
    const refreshStore = {
      schemaVersion: 4,
      activeSession: refreshSession,
      history: refreshHistory,
      excludedIds: ["geology-s1-002"]
    };
    await refreshPage.goto(`http://127.0.0.1:${port}/repo/index.html`, { waitUntil: "networkidle" });
    await refreshPage.evaluate((store) => {
      localStorage.setItem("vocab-dictation-notebook-v4", JSON.stringify(store));
    }, refreshStore);
    await refreshPage.reload({ waitUntil: "networkidle" });
    const refreshed = await refreshPage.evaluate(() => JSON.parse(localStorage.getItem("vocab-dictation-notebook-v4")));
    assert.deepEqual(refreshed.history, refreshHistory);
    assert.deepEqual(refreshed.activeSession, refreshSession);
    assert.deepEqual(refreshed.excludedIds, ["geology-s1-002"]);
    assert.equal(await refreshPage.locator('#set-select option[value="literature"]').count(), 1);
    assert.equal(await refreshPage.locator('#set-select option[value="gardening-nursery"]').count(), 1);
    const refreshedFirstRow = refreshPage.locator('.exam-outline li:has([data-start-section="geology-s1"])');
    assert.equal(await refreshedFirstRow.evaluate((element) => element.classList.contains("completed")), true);
    await refreshPage.getByRole("button", { name: /继续这道大题/ }).click();
    assert.deepEqual(await refreshPage.locator("[data-answer-id]").evaluateAll((inputs) => inputs.map((input) => input.dataset.answerId)), ["geology-s1-001"]);
    assert.equal(await refreshPage.locator('[data-answer-id="geology-s1-001"]').inputValue(), "geo");
    await refreshPage.getByRole("button", { name: /暂停并返回/ }).click();
    await refreshPage.getByRole("button", { name: "管理简单词" }).click();
    assert.equal(await refreshPage.locator('[data-manage-word="geology-s1-002"].is-excluded').count(), 1);
    await refreshContext.close();
    console.log("step: v4 progress survived expanded vocabulary data refresh");

    const migrationContext = await browser.newContext();
    const migrationPage = await migrationContext.newPage();
    const migratedSession = createStoredSession("migrated-active-session");
    await migrationPage.goto(`http://127.0.0.1:${port}/repo/index.html`, { waitUntil: "networkidle" });
    await migrationPage.evaluate((activeSession) => {
      localStorage.removeItem("vocab-dictation-notebook-v4");
      localStorage.setItem("vocab-dictation-notebook-v3", JSON.stringify({
        schemaVersion: 3,
        activeSession,
        history: [{ id: "legacy-history", setTitle: "旧记录", total: 1, rounds: 1 }]
      }));
    }, migratedSession);
    await migrationPage.reload({ waitUntil: "networkidle" });
    const migrated = await migrationPage.evaluate(() => JSON.parse(localStorage.getItem("vocab-dictation-notebook-v4")));
    assert.equal(migrated.schemaVersion, 4);
    assert.equal(migrated.history.length, 1);
    assert.deepEqual(migrated.excludedIds, []);
    assert.deepEqual(migrated.activeSession, migratedSession);
    await migrationPage.getByRole("button", { name: /继续这道大题/ }).click();
    assert.equal(await migrationPage.locator('[data-answer-id="geology-s1-001"]').inputValue(), "geo");
    await migrationContext.close();
    console.log("step: v3 local storage migrated to v4 with active session");

    const importContext = await browser.newContext();
    const importPage = await importContext.newPage();
    const importedSession = createStoredSession("imported-active-session");
    const v3Backup = path.join(os.tmpdir(), `v3-vocab-progress-${Date.now()}.json`);
    fs.writeFileSync(v3Backup, JSON.stringify({
      schemaVersion: 3,
      activeSession: importedSession,
      history: [{ id: "v3-import-history", setTitle: "旧版导入记录", total: 1, rounds: 1 }]
    }));
    await importPage.goto(`http://127.0.0.1:${port}/repo/index.html`, { waitUntil: "networkidle" });
    await importPage.locator("#progress-import").setInputFiles(v3Backup);
    await importPage.waitForFunction(() => {
      const store = JSON.parse(localStorage.getItem("vocab-dictation-notebook-v4") || "null");
      return store?.activeSession?.id === "imported-active-session";
    });
    const importedV3 = await importPage.evaluate(() => JSON.parse(localStorage.getItem("vocab-dictation-notebook-v4")));
    assert.deepEqual(importedV3.activeSession, importedSession);
    assert.equal(importedV3.history[0].id, "v3-import-history");
    await importPage.getByRole("button", { name: /继续这道大题/ }).click();
    assert.equal(await importPage.locator('[data-answer-id="geology-s1-001"]').inputValue(), "geo");
    await importPage.getByRole("button", { name: /暂停并返回/ }).click();

    const v1Backup = path.join(os.tmpdir(), `v1-vocab-progress-${Date.now()}.json`);
    fs.writeFileSync(v1Backup, JSON.stringify({
      schemaVersion: 1,
      activeSession: createStoredSession("v1-session-must-drop"),
      history: [{ id: "v1-import-history", setTitle: "更旧版导入记录", total: 1, rounds: 1 }]
    }));
    await importPage.locator("#progress-import").setInputFiles(v1Backup);
    await importPage.waitForFunction(() => {
      const store = JSON.parse(localStorage.getItem("vocab-dictation-notebook-v4") || "null");
      return store?.history?.[0]?.id === "v1-import-history";
    });
    const importedV1 = await importPage.evaluate(() => JSON.parse(localStorage.getItem("vocab-dictation-notebook-v4")));
    assert.equal(importedV1.activeSession, null);
    await importContext.close();
    console.log("step: v3 import preserved active session and v1 import dropped it");

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await mobileContext.newPage();
    await mobile.goto(`http://127.0.0.1:${port}/repo/index.html`, { waitUntil: "networkidle" });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await mobile.screenshot({ path: path.join(artifacts, "03-移动端大题目录.png"), fullPage: true });
    await mobile.getByRole("button", { name: "管理简单词" }).click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await mobile.screenshot({ path: path.join(artifacts, "05-移动端简单词管理.png"), fullPage: true });
    await mobile.getByRole("button", { name: /返回大题目录/ }).click();
    await mobile.locator('[data-start-section="geology-s1"]').click();
    assert.equal(await mobile.locator("[data-answer-id]").count(), 16);
    await mobile.getByRole("button", { name: "提交本大题并批改" }).click();
    assert.equal(await mobile.locator(".word-row.wrong").count(), 16);
    assert.equal(await mobile.locator(".correction strong").count(), 16);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await mobile.screenshot({ path: path.join(artifacts, "06-移动端批改结果.png"), fullPage: true });
    await mobile.getByRole("button", { name: /只重默这 16 个错词/ }).click();
    assert.equal(await mobile.locator("[data-answer-id]").count(), 16);
    await mobileContext.close();

    console.log("browser.smoke.test.js: all assertions passed");
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

const hardTimeout = setTimeout(() => {
  console.error("browser.smoke.test.js: hard timeout");
  process.exit(124);
}, 60000);

main().then(() => clearTimeout(hardTimeout)).catch((error) => {
  clearTimeout(hardTimeout);
  console.error(error);
  process.exitCode = 1;
});
