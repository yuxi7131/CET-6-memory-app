// app.js —— 界面层:负责首页 / 背新词 / 复习·陌生 / 复习·不会 的渲染与点击(三场景共用 #app 一个容器)。
// 数据只读 window.CET6_WORDS,进度只调 state.js,界面不碰 localStorage。以后新场景(词表浏览/搜索/每日计划)
// 做法:新增渲染函数 → 在 switch 里加一个 view 分支 → 在首页/空态加入口按钮即可,不动数据层与状态层。
(function () {
  'use strict';

  var CONTAINER = document.getElementById('app');
  if (!CONTAINER) return;

  var CAT = window.State.CATEGORY;
  var FAMILIAR = CAT.FAMILIAR;       // 熟悉 = 已完成
  var UNFAMILIAR = CAT.UNFAMILIAR;   // 陌生
  var DONTKNOW = CAT.DONTKNOW;       // 不会

  // 当前会话;null 表示在首页。mode: 'study' | 'review';cat: 复习时的库(陌生/不会)。
  var S = null;

  /* ---------------- 工具 ---------------- */

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Fisher–Yates 原地洗牌(返回同一数组)。
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function totalWords() {
    return (window.CET6_WORDS && Array.isArray(window.CET6_WORDS)) ? window.CET6_WORDS.length : 0;
  }

  /* ---------------- 场景与文案 ---------------- */

  // 底部三键的主字 + 说明小字:复习场景里按键语义 = 重新归类。
  var CAPTION = {
    study: {
      familiar: '已掌握', unfamiliar: '进陌生库', dontknow: '进不会库'
    },
    'review-unfamiliar': {
      familiar: '记住·出局', unfamiliar: '保持陌生', dontknow: '转到不会'
    },
    'review-dontknow': {
      familiar: '记住·出局', unfamiliar: '降级去陌生', dontknow: '还是不会'
    }
  };

  function scenarioKey() {
    if (!S) return '';
    return S.mode === 'review' ? ('review-' + S.cat) : 'study';
  }

  function sessionTitle() {
    if (!S) return '';
    if (S.mode === 'study') return '背新词';
    return S.cat === DONTKNOW ? '复习·不会' : '复习·陌生';
  }

  function sessionTag() {
    return sessionTitle(); // 卡片上的小标签 = 当前场景名
  }

  /* ---------------- 会话控制 ---------------- */

  function startSession(mode, cat) {
    var list = (mode === 'study') ? State.getUnclassified() : State.getByCategory(cat);
    S = {
      mode: mode,
      cat: (mode === 'review') ? cat : null,
      queue: shuffle(list.slice()), // 每次进库都随机
      index: 0,
      revealed: false,
      done: 0
    };
    render();
  }

  function toHome() {
    S = null;
    render();
  }

  // 点三键之一:归类 → 自动下一个。
  function classify(cat) {
    var item = S.queue[S.index];
    if (!item) return;
    State.mark(item.word, cat);
    S.done += 1;
    S.index += 1;
    S.revealed = false;
    render();
  }

  function revealMeaning() {
    if (!S) return;
    S.revealed = true;
    render();
  }

  /* ---------------- 渲染:首页 ---------------- */

  function renderHome() {
    var total = totalWords();
    var done = State.countBy(FAMILIAR);
    var unfamiliar = State.countBy(UNFAMILIAR);
    var dontknow = State.countBy(DONTKNOW);
    var unclassified = State.getUnclassified().length;
    var percent = total ? Math.round((done / total) * 100) : 0;

    var html = '';
    // 顶栏:已完成数,给成就感
    html += '<div class="topbar">';
    html += '<span class="brand">📘 六级背单词</span>';
    html += '<span class="meta">已完成 <b>' + done + '</b> 词</span>';
    html += '</div>';

    html += '<div class="home-head">';
    html += '<h1>今天想怎么背?</h1>';
    html += '<p>主动把词归类,才能越背越熟。</p>';
    html += '</div>';

    // 进度条
    html += '<div class="progress-wrap">';
    html += '<div class="progress-track"><div class="progress-bar" style="width:' + percent + '%"></div></div>';
    html += '<div class="progress-text">总进度 ' + done + ' / ' + total + ' · ' + percent + '%</div>';
    html += '</div>';

    html += '<div class="home-cards">';

    // 入口一:背新词
    html += entryCard('start-study', '', 'icon-study', '🆕', '开始背新词', '第一次见到 · 自己判断', unclassified, '待分 ' + unclassified);
    // 入口二:复习·陌生
    html += entryCard('start-review', UNFAMILIAR, 'icon-unfam', '🤔', '复习 · 陌生', '眼熟但不确定的词', unfamiliar, unfamiliar + ' 词');
    // 入口三:复习·不会
    html += entryCard('start-review', DONTKNOW, 'icon-dontknow', '😵', '复习 · 不会', '完全没把握的词', dontknow, dontknow + ' 词');

    html += '</div>';

    if (total === 0) {
      html += '<div class="empty" style="justify-content:flex-start">';
      html += '<p class="hint">词表未加载 —— 请确认 app/js/words.js 存在且内容为 window.CET6_WORDS = [...];</p>';
      html += '</div>';
    }

    html += '<div class="foot-note">进度自动保存在本机浏览器(换浏览器/清缓存会丢失)</div>';

    CONTAINER.innerHTML = html;
  }

  function entryCard(action, cat, iconClass, emoji, title, sub, count, countLabel) {
    var h = '<button class="entry" data-action="' + action + '"';
    if (cat) h += ' data-cat="' + cat + '"';
    h += '>';
    h += '<span class="entry-icon ' + iconClass + '">' + emoji + '</span>';
    h += '<span class="entry-text">';
    h += '<span class="entry-title">' + title + '</span>';
    h += '<span class="entry-sub">' + sub + '</span>';
    h += '</span>';
    h += '<span class="entry-count">' + (count > 0 ? countLabel : '0') + '</span>';
    h += '</button>';
    return h;
  }

  /* ---------------- 渲染:单词卡片(三场景共用) ---------------- */

  function renderCard() {
    var item = S.queue[S.index];
    if (!item) { renderEmpty(); return; }
    var remain = S.queue.length - S.index;
    var scenario = scenarioKey();
    var caps = CAPTION[scenario];

    var html = '';
    html += '<div class="session-head">';
    html += '<button class="back-btn" data-action="nav-home">‹ 首页</button>';
    html += '<span class="title">' + sessionTitle() + '</span>';
    html += '<span class="remain">剩余 ' + remain + '</span>';
    html += '</div>';

    html += '<div class="card-scene">';
    html += '<div class="word-card">';
    html += '<div class="word-main">' + esc(item.word) + '</div>';
    if (item.phonetic) html += '<div class="word-phonetic">' + esc(item.phonetic) + '</div>';
    html += '<div class="word-tag">' + sessionTag() + '</div>';

    if (S.revealed) {
      html += '<div class="meaning-box">';
      if (item.pos) html += '<div class="meaning-pos">' + esc(item.pos) + '</div>';
      html += '<div class="meaning-text">' + esc(item.meaning) + '</div>';
      html += '</div>';
    } else {
      html += '<button class="reveal-btn" data-action="reveal">显示释义</button>';
    }

    html += '</div>'; // .word-card

    // 底部三大按钮
    html += '<div class="actions">';
    html += actBtn(FAMILIAR, '熟悉', caps.familiar);
    html += actBtn(UNFAMILIAR, '陌生', caps.unfamiliar);
    html += actBtn(DONTKNOW, '不会', caps.dontknow);
    html += '</div>';

    html += '</div>'; // .card-scene

    CONTAINER.innerHTML = html;
  }

  function actBtn(cat, text, caption) {
    var cls = cat === FAMILIAR ? 'act-familiar' : (cat === UNFAMILIAR ? 'act-unfamiliar' : 'act-dontknow');
    return '<button class="act-btn ' + cls + '" data-action="classify" data-cat="' + cat + '">' +
      text + '<small>' + caption + '</small></button>';
  }

  /* ---------------- 渲染:空队列 / 鼓励 ---------------- */

  function renderEmpty() {
    var scenario = scenarioKey();
    var msg, hint;
    if (scenario === 'study') {
      msg = '没有待背的新词啦 🎉';
      hint = '可回首页看看进度,或直接去复习下面两个库。';
    } else if (scenario === 'review-unfamiliar') {
      msg = '「陌生」库清空啦 🎉';
      hint = '太好了!去复习「不会」的词,或继续背新词。';
    } else if (scenario === 'review-dontknow') {
      msg = '「不会」库清空啦 🎉';
      hint = '把不会的也攻克掉,最有成就感!';
    } else {
      msg = '这里空空如也 🎉';
      hint = '回首页选一个入口开始吧。';
    }

    var html = '';
    html += '<div class="session-head">';
    html += '<button class="back-btn" data-action="nav-home">‹ 首页</button>';
    html += '<span class="title">' + sessionTitle() + '</span>';
    html += '</div>';

    html += '<div class="empty">';
    html += '<div class="emoji">🎉</div>';
    html += '<p class="msg">' + msg + '</p>';
    if (S && S.done > 0) html += '<p class="hint">本轮处理了 ' + S.done + ' 个词。</p>';
    html += '<p class="hint">' + hint + '</p>';
    html += '<div class="action-row">' + buildCtas() + '</div>';
    html += '</div>';

    CONTAINER.innerHTML = html;
  }

  // 空态里给 2~3 个快捷按钮(总带一个回首页)。
  function buildCtas() {
    var btns = [];
    var scenario = scenarioKey();
    var unfamiliar = State.countBy(UNFAMILIAR);
    var dontknow = State.countBy(DONTKNOW);
    var unclassified = State.getUnclassified().length;

    if (scenario === 'study') {
      if (unfamiliar > 0) btns.push(jumpBtn('start-review', UNFAMILIAR, '复习·陌生 (' + unfamiliar + ')'));
      if (dontknow > 0) btns.push(jumpBtn('start-review', DONTKNOW, '复习·不会 (' + dontknow + ')'));
    } else if (scenario === 'review-unfamiliar') {
      if (unclassified > 0) btns.push(jumpBtn('start-study', '', '背新词 (' + unclassified + ')'));
      if (dontknow > 0) btns.push(jumpBtn('start-review', DONTKNOW, '复习·不会 (' + dontknow + ')'));
    } else if (scenario === 'review-dontknow') {
      if (unclassified > 0) btns.push(jumpBtn('start-study', '', '背新词 (' + unclassified + ')'));
      if (unfamiliar > 0) btns.push(jumpBtn('start-review', UNFAMILIAR, '复习·陌生 (' + unfamiliar + ')'));
    }

    btns.push('<button class="primary-btn" data-action="nav-home">回首页</button>');
    return btns.join('');
  }

  function jumpBtn(action, cat, label) {
    var h = '<button class="ghost-btn" data-action="' + action + '"';
    if (cat) h += ' data-cat="' + cat + '"';
    h += '>' + label + '</button>';
    return h;
  }

  /* ---------------- 渲染总入口与事件 ---------------- */

  function render() {
    if (!S) { renderHome(); return; }
    if (S.index >= S.queue.length) { renderEmpty(); return; }
    renderCard();
  }

  CONTAINER.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var cat = btn.getAttribute('data-cat');

    if (action === 'nav-home') { toHome(); }
    else if (action === 'start-study') { startSession('study'); }
    else if (action === 'start-review') { startSession('review', cat); }
    else if (action === 'reveal') { revealMeaning(); }
    else if (action === 'classify') { classify(cat); }
  });

  // 首次渲染
  render();
})();
