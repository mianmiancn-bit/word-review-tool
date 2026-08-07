# 词汇默写簿

一个完全静态、可离线使用的中文到英文分题默写网页。

在线地址：<https://mianmiancn-bit.github.io/word-review-tool/>

## 已内置内容

- 地质学词汇：153 条，9 个分类。
- 文学术语：164 条，9 个分类。
- 合计：317 条。

## 使用方法

直接双击 `index.html` 即可使用；也可以双击 `启动词汇默写.bat`，通过本地服务器打开。

1. 选择一个专题，再从大题目录中点选要练的一道。
2. 每一道大题都可以独立开始、独立提交，不必一次写完整个专题。
3. 绿色表示正确，红色表示错误，蓝色显示标准答案。
4. 点击“只重默错词”，只循环本大题的错词，并继续按原题号排列，直到全部正确。
5. 完成后可以返回大题目录、重默本题或直接进入下一大题；完成过的大题会在目录中标记。
6. 遇到太简单的词，可以在默写行点击“移出”，或从首页进入“管理简单词”集中处理。
7. 已移出的词可以逐个或整专题恢复；恢复后回到原来的大题和题号位置。

网页不会抽取词汇或随机打乱。判分会忽略大小写、首尾空格和连续空格，但不会忽略拼写、词序、连字符、撇号或其他标点。当前进度、历史记录和“太简单”标记只保存在浏览器的 `localStorage` 中，不会上传到服务器。

“管理简单词”可以导出一份整理结果 JSON。把它交给主 Agent 后，才会经审核写回正式词库；网页不会携带 GitHub Token，也不能自行修改公开仓库。

## 数据来源

唯一正式数据源是上级目录的 `词汇数据/approved/word-sets.json`。本文件夹中的 `word-data.json` 和 `word-data.js` 是自动生成的发布副本，不应手工修改。

同步命令：

```powershell
node ..\.agents\skills\vocab-web-publish\scripts\sync-web-data.mjs
```

## 进度迁移

首页可以导出 JSON 进度文件。在另一台设备打开网页后，点击“导入进度”即可恢复。

## 测试

使用 Node.js 运行纯逻辑测试：

```powershell
node .\tests\logic.test.js
```

完整审核还包括：

```powershell
node ..\.agents\skills\vocab-qa\scripts\validate-vocab.mjs
node .\tests\browser.smoke.test.js
```

首次在新电脑运行浏览器测试时，在本目录执行：

```powershell
npm install
npx playwright install chromium
npm test
```

如果 Windows 已安装 Google Chrome，测试会优先使用它；其他环境会使用 Playwright 安装的 Chromium，也可以通过 `CHROME_PATH` 指定浏览器。

## 发布

参见 [发布到GitHub.md](./发布到GitHub.md)。

本项目用于个人学习，不是 ETS 官方产品。

