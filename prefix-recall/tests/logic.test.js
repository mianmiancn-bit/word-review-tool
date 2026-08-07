"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const logic = require("../logic.js");

const root = path.resolve(__dirname, "..");
const bank = JSON.parse(fs.readFileSync(path.join(root, "word-bank.json"), "utf8"));

assert.ok(bank.words.length >= 5000, "词库应包含至少 5000 项");
assert.equal(bank.source.frequencyLicense, "CC BY-SA 4.0");
for (const word of ["transform", "transport", "transfer", "transmit", "translate", "transition", "transaction", "communal", "community", "common", "communicate", "experience", "experiment", "experimental", "material", "materials", "distribute", "distributed", "finished goods", "art", "artistic"]) {
  assert.ok(bank.words.some((entry) => entry.word === word), `缺少目标词：${word}`);
}

assert.equal(logic.normalizePrefix(" TR-an "), "tran");
assert.deepEqual(logic.parseAnswers("Transform, transport\ntransform；transmit"), ["transform", "transport", "transmit"]);

const grade = logic.gradeRecall(bank.words, "trans", "transform\ntransport\ntransponder\nmaterial");
assert.deepEqual(new Set(grade.recalled.map((entry) => entry.word)), new Set(["transform", "transport"]));
assert.deepEqual(grade.outside, ["transponder"]);
assert.deepEqual(grade.wrongPrefix, ["material"]);
assert.ok(grade.missing.some((entry) => entry.word === "transfer"));
assert.ok(grade.missing.some((entry) => entry.word === "translate"));

const queueA = logic.nextQueuedPrefix(bank.prefixQueues, 3, 0);
const queueB = logic.nextQueuedPrefix(bank.prefixQueues, 3, queueA.nextPosition);
assert.equal(queueA.prefix, "art");
assert.equal(queueB.prefix, "com");

const oneLetter = logic.matchesForPrefix(bank.words, "s");
assert.ok(oneLetter.length > 100, "单字母应有足够多的联想结果");
for (let i = 1; i < oneLetter.length; i += 1) {
  const previous = oneLetter[i - 1];
  const current = oneLetter[i];
  if (Boolean(previous.priority) === Boolean(current.priority)) {
    assert.ok((previous.rank || Infinity) <= (current.rank || Infinity), "同优先层应按频率排序");
  }
}

console.log(`logic.test.js: all assertions passed (${bank.words.length} entries)`);
