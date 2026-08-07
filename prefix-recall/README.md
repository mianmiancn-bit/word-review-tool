# 熟词前缀联想工作台

独立的静态学习网页，解决“明明认识完整单词，只给 1–4 个开头字母却想不出来”以及相近词、词性转换混淆的问题。页面不依赖 CDN、字体服务、账号或后端，适合放在任意静态子路径中。

## 功能

- 系统按固定队列给出 1、2、3 或 4 个字母，不随机；也可手动指定前缀。
- 一次写任意多个词，支持换行、英文/中文逗号和分号分隔。
- 提交后分为“库中已想到”“库中未想到”“库外待核验（不判错）”和“前缀不符”。前缀匹配但词库未收录的输入会被保留供后续核验，本次练习不判错，但页面不会擅自认定它是真词。
- 参考词按“本地正式专题词优先，其余按 wordfreq 常用程度”排序。
- 单字母可能得到数百项；默认只渲染前 80 项，可搜索或主动展开，避免页面一次堆出过多节点。
- 固定的 trans-、comm-、exper- 和熟词变体辨析卡，以及 community、experience、trans-、distribute、material、art 词族卡。
- 练习历史保存在 `localStorage` 的 `prefix-recall-workbench-v1` 中，不会上传。

## 生成词库

```powershell
node scripts/build-word-bank.mjs
```

生成器只读 `../词汇数据/approved/word-sets.json`，不会修改正式词义、分类、顺序、难度或 ID。首次运行会缓存 `aparrish/wordfreq-en-25000` 的原始 JSON，然后生成独立的 `word-bank.json` 和 `word-bank.js`。若今后改用另一份高频词表，只需在生成器中替换 `loadFrequencyRows()` 的输入接口；页面只依赖生成后的统一数据结构。

## 本地测试

```powershell
npm run build:data
npm test
```

测试覆盖纯逻辑、固定出题队列、库内/库外分类、GitHub Pages 风格子路径、桌面端、移动端、键盘提交、折叠/搜索、辨析卡、词族卡和本机历史保留。

## 数据授权

高频数据来自 [aparrish/wordfreq-en-25000](https://github.com/aparrish/wordfreq-en-25000)，基于 `wordfreq` 导出，按 CC BY-SA 4.0 提供。本项目取过滤后的前 5,000 项。完整署名及派生数据说明见 [NOTICE.md](./NOTICE.md)。
