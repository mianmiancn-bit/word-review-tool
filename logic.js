(function exposeDictationLogic(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DictationLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLogic() {
  "use strict";

  const SCHEMA_VERSION = 3;

  function normalizeAnswer(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("en-US");
  }

  function gradeItems(items, responses) {
    return items.map((item) => {
      const response = String(responses[item.id] ?? "");
      return {
        id: item.id,
        response,
        answer: item.answer,
        correct: normalizeAnswer(response) === normalizeAnswer(item.answer)
      };
    });
  }

  function validateBackup(value) {
    if (!value || typeof value !== "object") return { valid: false, error: "文件内容不是对象" };
    if (![1, 2, SCHEMA_VERSION].includes(value.schemaVersion)) {
      return { valid: false, error: `不支持的数据版本：${value.schemaVersion ?? "未知"}` };
    }
    if (!Array.isArray(value.history)) {
      return { valid: false, error: "缺少历史记录数组" };
    }
    return { valid: true, legacy: value.schemaVersion !== SCHEMA_VERSION };
  }

  return {
    SCHEMA_VERSION,
    normalizeAnswer,
    gradeItems,
    validateBackup
  };
});
