(function (global) {
  "use strict";

  function normalizePrefix(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 4);
  }

  function parseAnswers(value) {
    const seen = new Set();
    return String(value || "")
      .split(/[\n,;，；]+/)
      .map((item) => item.trim().toLowerCase().replace(/\s+/g, " "))
      .filter((item) => item && !seen.has(item) && seen.add(item));
  }

  function sortByFrequency(words) {
    return [...words].sort((a, b) => {
      if (Boolean(a.priority) !== Boolean(b.priority)) return a.priority ? -1 : 1;
      return (a.rank || Number.MAX_SAFE_INTEGER) - (b.rank || Number.MAX_SAFE_INTEGER) || a.word.localeCompare(b.word);
    });
  }

  function matchesForPrefix(bankWords, prefix) {
    const normalized = normalizePrefix(prefix);
    if (!normalized) return [];
    return sortByFrequency(bankWords.filter((entry) => entry.word.startsWith(normalized)));
  }

  function gradeRecall(bankWords, prefix, rawAnswers) {
    const normalizedPrefix = normalizePrefix(prefix);
    const answers = parseAnswers(rawAnswers);
    const matches = matchesForPrefix(bankWords, normalizedPrefix);
    const lookup = new Map(matches.map((entry) => [entry.word, entry]));
    const recalled = [];
    const outside = [];
    const wrongPrefix = [];
    for (const answer of answers) {
      if (!answer.startsWith(normalizedPrefix)) {
        wrongPrefix.push(answer);
      } else if (lookup.has(answer)) {
        recalled.push(lookup.get(answer));
      } else {
        outside.push(answer);
      }
    }
    const recalledSet = new Set(recalled.map((entry) => entry.word));
    return {
      prefix: normalizedPrefix,
      recalled: sortByFrequency(recalled),
      missing: matches.filter((entry) => !recalledSet.has(entry.word)),
      outside,
      wrongPrefix,
      totalInBank: matches.length
    };
  }

  function nextQueuedPrefix(queues, length, position) {
    const queue = queues[String(length)] || [];
    if (!queue.length) return { prefix: "", nextPosition: position };
    const safePosition = Number.isInteger(position) && position >= 0 ? position : 0;
    return { prefix: queue[safePosition % queue.length], nextPosition: safePosition + 1 };
  }

  const api = { normalizePrefix, parseAnswers, sortByFrequency, matchesForPrefix, gradeRecall, nextQueuedPrefix };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.PrefixRecallLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
