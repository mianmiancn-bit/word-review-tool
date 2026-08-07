"use strict";

const assert = require("node:assert/strict");
const logic = require("../logic.js");

assert.equal(logic.normalizeAnswer("  Plate   Tectonics "), "plate tectonics");
assert.equal(logic.normalizeAnswer("ＣＥＬＬ"), "cell");
assert.notEqual(logic.normalizeAnswer("long-term"), logic.normalizeAnswer("long term"));
assert.notEqual(logic.normalizeAnswer("writer's"), logic.normalizeAnswer("writers"));

const graded = logic.gradeItems(
  [
    { id: "a", answer: "Earth science" },
    { id: "b", answer: "long-term erosion" },
    { id: "c", answer: "geology" }
  ],
  { a: " earth   SCIENCE ", b: "long term erosion", c: "" }
);
assert.deepEqual(graded.map((item) => item.correct), [true, false, false]);

assert.equal(logic.validateBackup({ schemaVersion: 1, customSets: [], history: [] }).valid, true);
assert.equal(logic.validateBackup({ schemaVersion: 1, customSets: [], history: [] }).legacy, true);
assert.equal(logic.validateBackup({ schemaVersion: 2, activeSession: null, history: [] }).valid, true);
assert.equal(logic.validateBackup({ schemaVersion: 2, activeSession: null, history: [] }).legacy, true);
assert.equal(logic.validateBackup({ schemaVersion: 3, activeSession: null, history: [] }).valid, true);
assert.equal(logic.validateBackup({ schemaVersion: 3, activeSession: null, history: [] }).legacy, true);
assert.equal(logic.validateBackup({ schemaVersion: 4, activeSession: null, history: [], excludedIds: [] }).valid, true);
assert.equal(logic.validateBackup({ schemaVersion: 4, activeSession: null, history: [], excludedIds: [] }).legacy, false);
assert.equal(logic.validateBackup({ schemaVersion: 4, history: [] }).valid, false);
assert.equal(logic.validateBackup({ schemaVersion: 5, history: [], excludedIds: [] }).valid, false);
assert.equal(logic.validateBackup({ schemaVersion: 2 }).valid, false);
assert.equal(logic.validateBackup({ schemaVersion: 4, activeSession: null, history: [], excludedIds: [12] }).valid, false);
assert.equal(logic.validateBackup({ schemaVersion: 4, activeSession: { items: null }, history: [], excludedIds: [] }).valid, false);
assert.equal(logic.validateBackup({ schemaVersion: 4, activeSession: null, history: [{ id: "" }], excludedIds: [] }).valid, false);

const validSession = {
  id: "session-test",
  setId: "geology",
  setTitle: "地质学词汇",
  sectionId: "geology-s1",
  sectionTitle: "一、地质学基础与地球结构",
  sectionIndex: 0,
  items: [{ id: "geology-s1-001", prompt: "地质学", answer: "geology" }],
  currentIds: ["geology-s1-001"],
  round: 1,
  responses: {},
  results: null,
  startedAt: new Date().toISOString(),
  completed: false
};
assert.equal(logic.validateBackup({ schemaVersion: 4, activeSession: validSession, history: [], excludedIds: [] }).valid, true);
for (const schemaVersion of [2, 3]) {
  const validation = logic.validateBackup({ schemaVersion, activeSession: validSession, history: [] });
  assert.equal(validation.valid, true);
  assert.equal(validation.legacy, true);
}

console.log("logic.test.js: all assertions passed");
