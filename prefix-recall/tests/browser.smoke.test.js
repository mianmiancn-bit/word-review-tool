"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const artifacts = path.resolve(root, "..", "99_校验记录", "熟词前缀联想网页截图");
fs.mkdirSync(artifacts, { recursive: true });
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

function createServer() {
  return http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname.startsWith("/my-pages/prefix-lab/")) pathname = pathname.slice("/my-pages/prefix-lab".length);
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      response.writeHead(404); response.end("Not found"); return;
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
    timeout: 10000
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const external = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (!["127.0.0.1", "localhost"].includes(host)) external.push(request.url());
  });

  try {
    const url = `http://127.0.0.1:${port}/my-pages/prefix-lab/index.html`;
    await page.goto(url, { waitUntil: "networkidle" });
    assert.equal(external.length, 0, "页面不得请求外部资源");
    assert.match(await page.locator("body").innerText(), /熟词前缀\s*联想工作台/);
    assert.equal(await page.locator("#active-prefix").textContent(), "CO");
    await page.screenshot({ path: path.join(artifacts, "01-桌面首页.png"), fullPage: true });

    await page.locator("#manual-prefix").fill("trans");
    await page.locator("#manual-prefix").press("Enter");
    assert.equal(await page.locator("#active-prefix").textContent(), "TRAN");
    await page.locator("#recall-input").fill("transform\ntransport\ntransponder\nmaterial");
    await page.locator("#recall-input").press("Control+Enter");
    await page.locator("#results:not([hidden])").waitFor();
    const resultText = await page.locator("#results").innerText();
    assert.match(resultText, /库中已想到/);
    assert.match(resultText, /库外待核验（不判错）/);
    assert.match(resultText, /库外待核验：符合前缀，但不在当前词库；本次不判错/);
    assert.match(resultText, /transponder/);
    assert.match(resultText, /不是 tran 开头/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("prefix-recall-workbench-v1")));
    assert.equal(stored.history.length, 1);
    assert.equal(stored.history[0].prefix, "tran");

    await page.locator("#manual-prefix").fill("s");
    await page.getByRole("button", { name: "使用" }).click();
    await page.locator("#recall-input").fill("science");
    await page.getByRole("button", { name: "核对词库" }).click();
    assert.equal(await page.locator("#missing-list .word-chip").count(), 80);
    assert.match(await page.locator("#toggle-missing").textContent(), /展开全部/);
    await page.locator("#missing-search").fill("strat");
    assert.ok(await page.locator("#missing-list .word-chip").count() >= 1);
    assert.equal(await page.locator("#toggle-missing").isHidden(), true);
    await page.screenshot({ path: path.join(artifacts, "02-单字母结果.png"), fullPage: true });

    await page.getByRole("button", { name: /02 近形辨析/ }).click();
    const compareText = await page.locator("#compare-view").innerText();
    for (const phrase of ["transform A into B", "raw materials ↔ finished goods", "community→communal", "allow + 宾语 + to do", "transaction"]) assert.match(compareText, new RegExp(phrase.replace(/[+]/g, "\\+")));
    await page.screenshot({ path: path.join(artifacts, "03-错因实验室.png"), fullPage: true });

    await page.getByRole("button", { name: /03 词族工坊/ }).click();
    const familyText = await page.locator("#families-view").innerText();
    assert.match(familyText, /communal 描写/);
    assert.match(familyText, /experience 来自实际经历/);
    assert.match(familyText, /transform 改变形态/);

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /04 练习记录/ }).click();
    assert.equal(await page.locator("#history-list > li").count(), 2);

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await mobileContext.newPage();
    await mobile.goto(url, { waitUntil: "networkidle" });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await mobile.getByRole("button", { name: /02 近形辨析/ }).click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await mobile.screenshot({ path: path.join(artifacts, "04-移动端辨析.png"), fullPage: true });
    await mobileContext.close();
    console.log("browser.smoke.test.js: all assertions passed");
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

const timer = setTimeout(() => { console.error("browser.smoke.test.js: hard timeout"); process.exit(124); }, 60000);
main().then(() => clearTimeout(timer)).catch((error) => { clearTimeout(timer); console.error(error); process.exitCode = 1; });
