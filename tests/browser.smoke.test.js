Exit code: 0
Wall time: 0.5 seconds
Output:
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
    assert.match(homeText, /317/);
    assert.match(homeText, /一次只练一道/);
    assert.match(homeText, /不抽词、不乱序/);
    assert.doesNotMatch(homeText, /我的词表|添加词表|本组数量|按原顺序开始整张/);
    assert.equal(await page.locator("[data-start-section]").count(), 9);
    assert.equal(externalRequests.length, 0, "页面不应请求外部资源");

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

    const migrationContext = await browser.newContext();
    const migrationPage = await migrationContext.newPage();
    await migrationPage.goto(`http://127.0.0.1:${port}/repo/index.html`, { waitUntil: "networkidle" });
    await migrationPage.evaluate(() => {
      localStorage.removeItem("vocab-dictation-notebook-v4");
      localStorage.setItem("vocab-dictation-notebook-v3", JSON.stringify({
        schemaVersion: 3,
        activeSession: null,
        history: [{ id: "legacy-history", setTitle: "旧记录", total: 1, rounds: 1 }]
      }));
    });
    await migrationPage.reload({ waitUntil: "networkidle" });
    const migrated = await migrationPage.evaluate(() => JSON.parse(localStorage.getItem("vocab-dictation-notebook-v4")));
    assert.equal(migrated.schemaVersion, 4);
    assert.equal(migrated.history.length, 1);
    assert.deepEqual(migrated.excludedIds, []);
    await migrationContext.close();
    console.log("step: v3 local storage migrated to v4");

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

