import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const workspace = path.resolve(root, "..");
const approvedPath = path.join(workspace, "词汇数据", "approved", "word-sets.json");
const cacheDir = path.join(root, "data", "source");
const cachePath = path.join(cacheDir, "wordfreq-en-25000-log.json");
const sourceUrl = "https://raw.githubusercontent.com/aparrish/wordfreq-en-25000/master/wordfreq-en-25000-log.json";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "prefix-recall-workbench-builder" } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(fetchText(response.headers.location));
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`下载词频表失败：HTTP ${response.statusCode}`));
        response.resume();
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

async function loadFrequencyRows() {
  fs.mkdirSync(cacheDir, { recursive: true });
  if (!fs.existsSync(cachePath)) {
    const body = await fetchText(sourceUrl);
    JSON.parse(body);
    fs.writeFileSync(cachePath, body, "utf8");
  }
  return JSON.parse(fs.readFileSync(cachePath, "utf8"));
}

const comparisons = [
  {
    id: "trans",
    prefix: "trans-",
    title: "移动、改变与传递",
    cue: "别只看 trans-，要抓后半段词根。",
    entries: [
      ["transform", "彻底改变；使变形", "form＝形状：改变形态", "transform a system"],
      ["transport", "运输；运送", "port＝携带：把东西带过去", "transport goods"],
      ["transfer", "转移；调动；转乘", "fer＝携带：从一处转到另一处", "transfer data"],
      ["transmit", "传输；传播", "mit＝发送：把信号发出去", "transmit information"],
      ["translate", "翻译；转化", "late（词源义为搬运）：把意义转到另一语言", "translate a text"],
      ["transition", "过渡；转变", "it＝走：从一个状态走到另一个状态", "transition to industry"],
      ["transaction", "交易；业务", "act＝做：双方完成的一项行为", "business transaction"]
    ]
  },
  {
    id: "comm",
    prefix: "comm-",
    title: "共同、群体与交流",
    cue: "communal 是形容词；community 是名词。",
    entries: [
      ["communal", "公共的；群体共有的", "形容环境、设施或生活方式", "a communal environment"],
      ["community", "社区；群体", "可数名词，指人群或共同体", "creative communities"],
      ["common", "常见的；共同的", "普通性质，不一定强调群体所有", "a common feature"],
      ["communicate", "交流；传达", "动词，强调信息往来", "communicate ideas"]
    ]
  },
  {
    id: "exper",
    prefix: "exper-",
    title: "经历与实验",
    cue: "experience 是经历/经验；experiment 是人为设置的实验。",
    entries: [
      ["experience", "经历；经验；体验", "真实发生或积累所得", "gain experience"],
      ["experiment", "实验；试验", "为验证想法而设计的测试", "conduct an experiment"],
      ["experimental", "实验性的；试验性的", "experiment 的形容词", "experimental evidence"]
    ]
  },
  {
    id: "familiar-forms",
    prefix: "熟词变体",
    title: "熟词、词形与固定搭配",
    cue: "先判断空格需要的词性，再恢复完整词形。",
    entries: [
      ["material", "材料；物质；材料的", "单数或不可数名词，也可作形容词", "raw material"],
      ["materials", "各种材料；资料", "复数，强调多种具体材料", "building materials"],
      ["distribute", "分发；分配；使分布", "动词原形", "distribute goods"],
      ["distributed", "分发了；分布式的", "过去式/过去分词或形容词", "distributed finished goods"],
      ["finished goods", "制成品；成品", "固定名词短语，finished 修饰 goods", "distribute finished goods"],
      ["art", "艺术；美术", "名词", "works of art"],
      ["artistic", "艺术的；有艺术性的", "形容词", "artistic traditions"]
    ]
  }
].map((card) => ({
  ...card,
  entries: card.entries.map(([word, meaning, distinction, collocation]) => ({ word, meaning, distinction, collocation }))
}));

const families = [
  {
    id: "community",
    root: "commun- / common",
    title: "共同与交流",
    contrast: "communal 描写‘共有的’性质；community 指具体的群体。",
    forms: [
      ["名词", "community", "社区；群体", "a creative community"],
      ["名词", "communication", "交流；通信", "mass communication"],
      ["动词", "communicate", "交流；传达", "communicate with peers"],
      ["形容词", "communal", "公共的；群体共有的", "a communal environment"],
      ["形容词", "common", "常见的；共同的", "a common purpose"],
      ["副词", "commonly", "通常；常见地", "commonly used"]
    ]
  },
  {
    id: "experience",
    root: "experi- / experiment-",
    title: "经历与实验",
    contrast: "experience 来自实际经历；experiment 是为验证假设而设置的实验。",
    forms: [
      ["名词/动词", "experience", "经验；经历；体验", "experience change"],
      ["形容词", "experienced", "有经验的", "an experienced artist"],
      ["形容词", "experiential", "经验性的；体验式的", "experiential learning"],
      ["名词/动词", "experiment", "实验；试验", "experiment with materials"],
      ["形容词", "experimental", "实验性的", "experimental results"],
      ["副词", "experimentally", "通过实验；实验性地", "verified experimentally"]
    ]
  },
  {
    id: "trans",
    root: "trans-（跨越、转移）",
    title: "改变、运送与传播",
    contrast: "transform 改变形态；transport 运送人或物。后半段 form/port 才是判别核心。",
    forms: [
      ["动词", "transform", "改变；使变形", "transform society"],
      ["名词", "transformation", "转变；变形", "industrial transformation"],
      ["形容词", "transformative", "带来重大改变的", "transformative technology"],
      ["动词/名词", "transport", "运输；交通运输", "transport goods"],
      ["名词", "transportation", "运输；交通系统", "transportation network"],
      ["形容词", "transportable", "可运输的", "transportable materials"]
    ]
  },
  {
    id: "distribute",
    root: "distribut-",
    title: "分配与分布",
    contrast: "distributed 可能是谓语过去式，也可能是过去分词或形容词。",
    forms: [
      ["动词", "distribute", "分发；分配；使分布", "distribute finished goods"],
      ["名词", "distribution", "分配；分布；经销", "goods distribution"],
      ["形容词", "distributed", "分布的；分布式的", "a distributed network"],
      ["形容词", "distributive", "分配的；分布的", "distributive effects"]
    ]
  },
  {
    id: "material",
    root: "materi-",
    title: "材料与物质",
    contrast: "material 可作不可数名词或形容词；materials 常指多种材料或资料。",
    forms: [
      ["名词/形容词", "material", "材料；物质；材料的", "material culture"],
      ["复数名词", "materials", "材料；资料", "raw materials"],
      ["动词", "materialize", "实现；具体化；出现", "plans materialize"],
      ["形容词", "materialistic", "物质主义的", "a materialistic society"],
      ["副词", "materially", "实质上；重大地", "materially different"]
    ]
  },
  {
    id: "art",
    root: "art-",
    title: "艺术与艺术性",
    contrast: "art 是名词；artistic 是形容词，修饰 tradition、movement、value 等名词。",
    forms: [
      ["名词", "art", "艺术；美术", "works of art"],
      ["名词", "artist", "艺术家", "a local artist"],
      ["形容词", "artistic", "艺术的；有艺术性的", "artistic traditions"],
      ["副词", "artistically", "在艺术上", "artistically significant"]
    ]
  }
].map((family) => ({
  ...family,
  forms: family.forms.map(([partOfSpeech, word, meaning, collocation]) => ({ partOfSpeech, word, meaning, collocation }))
}));

const requiredTargets = [...new Set([
  ...comparisons.flatMap((card) => card.entries.map((entry) => entry.word)),
  ...families.flatMap((family) => family.forms.map((form) => form.word))
])];

const frequencyRows = await loadFrequencyRows();
const filteredFrequency = frequencyRows
  .filter(([word]) => /^[a-z]+(?:'[a-z]+)?$/i.test(word))
  .slice(0, 5000)
  .map(([word, logFrequency], index) => ({ word: word.toLowerCase(), rank: index + 1, logFrequency }));

const approved = JSON.parse(fs.readFileSync(approvedPath, "utf8"));
const approvedWords = [];
let approvedSequence = 0;
for (const set of approved.wordSets || []) {
  for (const section of set.sections || []) {
    for (const item of section.items || []) {
      if (item.status !== "active") continue;
      approvedSequence += 1;
      const word = String(item.answer || "").trim().toLowerCase();
      if (!word) continue;
      approvedWords.push({
        word,
        label: item.answer,
        meaning: item.prompt,
        ipa: item.ipa || "",
        approvedId: item.id,
        topic: set.title,
        approvedSequence
      });
    }
  }
}

const byWord = new Map();
for (const entry of filteredFrequency) {
  byWord.set(entry.word, {
    word: entry.word,
    label: entry.word,
    rank: entry.rank,
    logFrequency: entry.logFrequency,
    sources: ["wordfreq"]
  });
}

for (const entry of approvedWords) {
  const current = byWord.get(entry.word) || {
    word: entry.word,
    label: entry.label,
    rank: 6000 + entry.approvedSequence,
    sources: []
  };
  current.label = entry.label;
  current.meaning = entry.meaning;
  current.ipa = entry.ipa;
  current.approvedId = entry.approvedId;
  current.topic = entry.topic;
  current.sources = [...new Set([...current.sources, "approved"] )];
  current.priority = true;
  byWord.set(entry.word, current);
}

for (const word of requiredTargets) {
  const normalized = word.toLowerCase();
  const current = byWord.get(normalized) || {
    word: normalized,
    label: word,
    rank: 5500 + requiredTargets.indexOf(word),
    sources: []
  };
  current.sources = [...new Set([...current.sources, "target-family"] )];
  current.priority = true;
  byWord.set(normalized, current);
}

const words = [...byWord.values()].sort((a, b) => {
  if (Boolean(a.priority) !== Boolean(b.priority)) return a.priority ? -1 : 1;
  return (a.rank || 999999) - (b.rank || 999999) || a.word.localeCompare(b.word);
});

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    approved: "../词汇数据/approved/word-sets.json（只读提取）",
    frequency: sourceUrl,
    frequencyLicense: "CC BY-SA 4.0",
    frequencyLimit: 5000
  },
  words,
  comparisons,
  families,
  prefixQueues: {
    "1": ["a", "c", "d", "e", "m", "p", "s", "t"],
    "2": ["ar", "co", "di", "ex", "ma", "tr", "re", "in"],
    "3": ["art", "com", "dis", "exp", "mat", "tra", "pro", "con"],
    "4": ["comm", "dist", "expe", "mate", "tran", "arti", "prod", "cult"]
  }
};

const json = `${JSON.stringify(payload, null, 2)}\n`;
fs.writeFileSync(path.join(root, "word-bank.json"), json, "utf8");
fs.writeFileSync(path.join(root, "word-bank.js"), `window.PREFIX_WORD_BANK = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`word bank generated: ${words.length} entries (${filteredFrequency.length} frequency + ${approvedWords.length} approved rows)`);
