Exit code: 0
Wall time: 0.6 seconds
Output:
(function exposeDictationLogic(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DictationLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLogic() {
  "use strict";

  const SCHEMA_VERSION = 4;

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
    if (![1, 2, 3, SCHEMA_VERSION].includes(value.schemaVersion)) {
      return { valid: false, error: `不支持的数据版本：${value.schemaVersion ?? "未知"}` };
    }
    if (!Array.isArray(value.history)) {
      return { valid: false, error: "缺少历史记录数组" };
    }
    if (value.history.some((entry) => !entry || typeof entry !== "object" || !entry.id || !entry.setTitle)) {
      return { valid: false, error: "历史记录结构损坏" };
    }
    if (value.schemaVersion === SCHEMA_VERSION && !Array.isArray(value.excludedIds)) {
      return { valid: false, error: "缺少已移出词汇数组" };
    }
    if (Array.isArray(value.excludedIds) && value.excludedIds.some((id) => typeof id !== "string" || !id)) {
      return { valid: false, error: "已移出词汇 ID 无效" };
    }
    const session = value.activeSession;
    if (session !== undefined && session !== null) {
      const validSession = typeof session === "object"
        && typeof session.id === "string"
        && typeof session.setId === "string"
        && typeof session.setTitle === "string"
        && typeof session.sectionId === "string"
        && typeof session.sectionTitle === "string"
        && Number.isInteger(session.sectionIndex)
        && session.sectionIndex >= 0
        && Array.isArray(session.items)
        && session.items.every((item) => item && typeof item.id === "string" && typeof item.prompt === "string" && typeof item.answer === "string")
        && Array.isArray(session.currentIds)
        && session.currentIds.every((id) => typeof id === "string")
        && Number.isInteger(session.round)
        && session.round >= 1
        && session.responses && typeof session.responses === "object" && !Array.isArray(session.responses)
        && (session.results === null || Array.isArray(session.results))
        && typeof session.startedAt === "string"
        && typeof session.completed === "boolean";
      if (!validSession) return { valid: false, error: "当前默写会话结构损坏" };
      const itemIds = new Set(session.items.map((item) => item.id));
      if (session.currentIds.some((id) => !itemIds.has(id))) {
        return { valid: false, error: "当前默写包含未知词条" };
      }
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

