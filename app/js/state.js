// state.js —— 状态层:统一读写学习进度(localStorage 键 cet6_progress_v1),界面层绝不直接碰 localStorage。
// 以后若换存储方案 / 升级 key(如 v2 加字段),只改本文件并保持下列函数名不变;新功能需要更多统计,也优先在这里加。
(function () {
  'use strict';

  var STORAGE_KEY = 'cet6_progress_v1';

  // 三种分类的取值与中文对照(UI 文案见 app.js)。familiar=熟悉(即已完成,不再出现在队列)。
  var CATEGORY = {
    FAMILIAR: 'familiar',
    UNFAMILIAR: 'unfamiliar',
    DONTKNOW: 'dontknow'
  };

  // localStorage 不可用(隐私模式/被禁用)时,退化为内存对象,本页会话内仍可用。
  var memory = null;

  function canUseStorage() {
    try {
      var probe = '__cet6_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 读取原始进度对象(不含任何过滤)。
  function readAll() {
    if (memory !== null) return memory;
    if (canUseStorage()) {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  // 写入:先落内存保证本页一致,再尽力同步 localStorage。
  function writeAll(data) {
    memory = data;
    if (canUseStorage()) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        // 写入失败(如配额满):保留内存兜底,本次会话仍可用。
      }
    }
  }

  // 当前词表(只读数据层,见 words.js)。
  function dict() {
    return (window.CET6_WORDS && Array.isArray(window.CET6_WORDS)) ? window.CET6_WORDS : [];
  }

  // 词表索引 word -> 词条对象(保留第一个出现者,防御重复)。
  function dictIndex() {
    var map = {};
    dict().forEach(function (entry) {
      if (entry && entry.word && !(entry.word in map)) map[entry.word] = entry;
    });
    return map;
  }

  function isValidCategory(c) {
    return c === CATEGORY.FAMILIAR || c === CATEGORY.UNFAMILIAR || c === CATEGORY.DONTKNOW;
  }

  // 清洗:只保留「当前词表里存在、且分类合法」的进度(词库被更大文件替换时,旧词不残留)。
  function sanitize(obj) {
    var index = dictIndex();
    var out = {};
    Object.keys(obj).forEach(function (word) {
      if (index[word] && isValidCategory(obj[word])) out[word] = obj[word];
    });
    return out;
  }

  /** 返回当前进度对象 { word: category }(已按当前词表过滤)。 */
  function loadState() {
    return sanitize(readAll());
  }

  /** 把某词标为熟悉/陌生/不会;参数非法则忽略。 */
  function mark(word, category) {
    if (!word || !isValidCategory(category)) return;
    var all = readAll();
    all[word] = category;
    writeAll(all);
  }

  /** 某分类下已有多少词(仅统计当前词表中出现的)。 */
  function countBy(category) {
    if (!isValidCategory(category)) return 0;
    var state = loadState();
    var n = 0;
    Object.keys(state).forEach(function (word) {
      if (state[word] === category) n += 1;
    });
    return n;
  }

  /** 未分类的词条数组(背新词队列来源)。 */
  function getUnclassified() {
    var state = loadState();
    var out = [];
    dict().forEach(function (entry) {
      if (entry && entry.word && !(entry.word in state)) out.push(entry);
    });
    return out;
  }

  /** 某分类下的词条数组(复习库队列来源)。 */
  function getByCategory(category) {
    if (!isValidCategory(category)) return [];
    var state = loadState();
    var out = [];
    dict().forEach(function (entry) {
      if (entry && entry.word && state[entry.word] === category) out.push(entry);
    });
    return out;
  }

  window.State = {
    STORAGE_KEY: STORAGE_KEY,
    CATEGORY: CATEGORY,
    loadState: loadState,
    mark: mark,
    countBy: countBy,
    getUnclassified: getUnclassified,
    getByCategory: getByCategory
  };
})();
