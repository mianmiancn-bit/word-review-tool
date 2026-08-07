# 数据与授权说明

本项目的高频英文词排序使用 [aparrish/wordfreq-en-25000](https://github.com/aparrish/wordfreq-en-25000) 导出的 `wordfreq-en-25000-log.json`。该数据由 Allison Parrish 从 [wordfreq](https://github.com/rspeer/wordfreq) 导出，并依其说明按 [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/) 提供。

本项目只取经纯英文字母或撇号过滤后的前 5,000 项，用于前缀匹配及常用程度排序。生成后的 `word-bank.json` 和 `word-bank.js` 中保留来源、链接和授权信息。若分发这些派生数据，应继续保留署名并遵守 CC BY-SA 4.0 的相同方式共享要求。

专题词条来自本地正式词库的只读快照，其权利与分发范围按原项目约定执行；生成器不会反向修改正式词库。
