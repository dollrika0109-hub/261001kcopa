/* =========================================================================
 * 모의신고 훈련 게임 로직
 * 화면 문구/CASE/양식은 js/data/*.js 에서 관리합니다.
 * ========================================================================= */
(function () {
  'use strict';
  var C = window.CONTENT, CASES = window.CASES, FORMS = window.FORMS, CFG = window.APP_CONFIG, R = window.Render, Store = window.Store;
  var esc = R.esc;
  var LS = { participant: 'mockreport.participant', completed: 'mockreport.completed' };
  var screen = document.getElementById('screen');

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var S = {
    step: 1,
    category: null,
    caseId: null,
    selectedFormId: null,
    wrongAttempts: [],
    answers: {},
    startedAt: null,
    formStartedAt: null,
    exampleViewed: 0,
    validationFailCount: 0,
    materialsOpened: [],
    participant: lsGet(LS.participant, { name: '', dept: '' }),
    result: null,
    submitting: false
  };

  function getCase() { return CASES.filter(function (c) { return c.id === S.caseId; })[0]; }
  function getCategory() { return C.categories.filter(function (c) { return c.id === S.category; })[0]; }
  function getForm() { var c = getCase(); return c && FORMS[c.answerFormId]; }
  function participantKey() { return (S.participant.name || '').trim() + '|' + (S.participant.dept || '').trim(); }
  function completedSet() { var all = lsGet(LS.completed, {}); return all[participantKey()] || []; }
  function markCompleted(id) {
    var all = lsGet(LS.completed, {}); var k = participantKey();
    all[k] = (all[k] || []).filter(function (x) { return x !== id; }).concat([id]);
    lsSet(LS.completed, all);
  }

  /* ================================================================ 공통 UI */
  var toastTimer;
  function toast(msg, type) {
    var el = document.getElementById('toast');
    el.className = 'toast show ' + (type || '');
    el.innerHTML = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 2800);
  }

  var modal = document.getElementById('modal');
  var lastFocus = null;
  function openModal(o) {
    lastFocus = document.activeElement;
    document.getElementById('modalTitle').textContent = o.title || '';
    document.getElementById('modalBody').innerHTML = o.body || '';
    document.getElementById('modalFoot').innerHTML = o.foot || '<button class="btn primary" data-close>확인</button>';
    modal.querySelector('.modal').className = 'modal ' + (o.size || '') + ' ' + (o.tone || '');
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    var btn = modal.querySelector('.modal-foot [data-close], .modal-foot button');
    if (btn) btn.focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  function openMaterial(id) {
    var c = getCase(); if (!c) return;
    var m = c.materials.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    if (S.materialsOpened.indexOf(id) < 0) S.materialsOpened.push(id);
    document.querySelectorAll('[data-material="' + id + '"].file-chip').forEach(function (el) { el.classList.add('opened'); });
    openModal({
      title: R.fileIcon(m.type) + ' ' + m.fileName,
      body: '<div class="mat-label">' + esc(m.label) + '</div>' + R.material(m),
      size: m.type === 'table' && m.columns.length > 2 ? 'wide' : ''
    });
  }

  function openExample() {
    var c = getCase(), f = getForm();
    S.exampleViewed++;
    openModal({
      title: '🔍 작성 예시 · ' + f.title,
      body: '<div class="example-notice">💡 ' + esc(C.messages.exampleNotice) + '</div><div class="paper">' + R.formDoc(f, c.example || {}, c, { stamp: '예시' }) + '</div>',
      size: 'wide',
      foot: '<button class="btn primary" data-close>예시 닫고 직접 작성하기</button>'
    });
  }

  /* ================================================================ 렌더 */
  function renderProgress() {
    var el = document.getElementById('progress');
    var n = C.steps.length;
    var pct = (S.step - 1) / (n - 1) * 100;
    el.innerHTML = '<div class="pg-inner"><div class="pg-track"><div class="pg-fill" style="width:' + pct + '%"></div></div><ol class="pg-steps">' +
      C.steps.map(function (s, i) {
        var no = i + 1, cls = no < S.step ? 'done' : (no === S.step ? 'current' : '');
        return '<li class="' + cls + '"' + (no === S.step ? ' aria-current="step"' : '') + '><span class="pg-dot">' + (no < S.step ? '✓' : no) + '</span><span class="pg-label">' + esc(s) + '</span></li>';
      }).join('') + '</ol><div class="pg-mobile">' + S.step + ' / ' + n + ' · ' + esc(C.steps[S.step - 1]) + '</div></div>';
  }

  function renderAddress() {
    var parts = ['모의신고훈련'];
    var cat = getCategory(), c = getCase();
    if (S.step >= 2 && cat) parts.push(cat.button);
    if (S.step >= 3 && c) parts.push('CASE ' + c.no);
    if (S.step >= 2) parts.push(C.steps[S.step - 1]);
    document.getElementById('addressText').innerHTML = parts.map(esc).join(' <span class="sep">›</span> ');
  }

  var VIEWS = {};
  function render() {
    renderProgress();
    renderAddress();
    screen.innerHTML = '<div class="view view-' + S.step + '">' + VIEWS[S.step]() + '</div>';
    if (BINDERS[S.step]) BINDERS[S.step]();
  }
  function go(step) {
    S.step = step;
    clearTimeout(toastTimer); document.getElementById('toast').className = 'toast';
    render();
    window.scrollTo(0, 0);
    var h = screen.querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function backBar(label, step) {
    return '<div class="backbar"><button class="btn text" data-go="' + step + '">← ' + esc(label) + '</button></div>';
  }

  function materialsBlock(c) {
    if (!c.materials || !c.materials.length) {
      return '<div class="no-materials">📎 이 상황에는 별도의 참고자료가 없습니다. 상황 내용을 꼼꼼히 읽어 보세요.</div>';
    }
    return '<div class="materials"><h3 class="materials-title">📎 참고자료 <span class="muted">· 클릭하여 열기</span></h3><ul class="file-list">' +
      c.materials.map(function (m) {
        var opened = S.materialsOpened.indexOf(m.id) > -1;
        return '<li><button type="button" class="file-chip ' + (opened ? 'opened' : '') + '" data-material="' + m.id + '">' +
          '<span class="file-ico">' + R.fileIcon(m.type) + '</span>' +
          '<span class="file-meta"><b>' + esc(m.label) + '</b><small>' + esc(m.fileName) + '</small></span>' +
          '<span class="file-open">열기</span></button></li>';
      }).join('') + '</ul></div>';
  }

  /* ---------- ① 메인화면 ---------- */
  VIEWS[1] = function () {
    return '<section class="hero">' +
      '<div class="hero-text"><span class="eyebrow">' + esc(C.eyebrow) + '</span>' +
      '<h1>' + esc(C.orgName) + '<br><strong>' + esc(C.gameName) + '</strong></h1>' +
      C.intro.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      '<div class="hero-art" aria-hidden="true"><div class="ha-monitor"><div class="ha-screen"><div class="ha-line w80"></div><div class="ha-line w60"></div><div class="ha-line w70"></div><div class="ha-btn">신고하기</div></div></div><div class="ha-badge b1">🚨</div><div class="ha-badge b2">📋</div><div class="ha-badge b3">✅</div></div>' +
      '</section>' +
      (CFG.participant.required ?
        '<section class="panel participant"><div class="panel-head"><h2 class="panel-title">👤 참가자 정보</h2><p class="muted">' + esc(C.messages.participantGuide) + '</p></div>' +
        '<div class="p-grid"><label class="pfield" data-p="name"><span>성명</span><input id="pName" type="text" autocomplete="name" placeholder="예) 홍길동" value="' + esc(S.participant.name) + '"></label>' +
        '<label class="pfield" data-p="dept"><span>소속</span><input id="pDept" type="text" placeholder="예) ○○부" value="' + esc(S.participant.dept) + '"></label></div></section>' : '') +
      '<div class="category-grid">' + C.categories.map(function (cat) {
        return '<button type="button" class="category-card tone-' + cat.tone + '" data-cat="' + cat.id + '">' +
          '<span class="cat-icon">' + cat.icon + '</span>' +
          '<span class="cat-q">' + esc(cat.question) + '</span>' +
          '<span class="cat-ex">' + esc(cat.examples) + '</span>' +
          '<span class="cat-btn">「' + esc(cat.button) + '」 <b>→</b></span></button>';
      }).join('') + '</div>';
  };

  /* ---------- ② CASE 선택 ---------- */
  VIEWS[2] = function () {
    var cat = getCategory(), done = completedSet();
    var list = cat.caseIds.map(function (id) { return CASES.filter(function (c) { return c.id === id; })[0]; }).filter(Boolean);
    var other = C.categories.filter(function (c) { return c.id !== cat.id; })[0];
    return backBar('처음으로', 1) +
      '<div class="section-head"><span class="chip tone-' + cat.tone + '">' + cat.icon + ' ' + esc(cat.button) + '</span>' +
      '<h2>체험할 CASE를 선택하세요</h2><p class="muted">' + esc(C.messages.caseGuide) + '</p></div>' +
      '<div class="case-grid">' + list.map(function (c) {
        var isDone = done.indexOf(c.id) > -1;
        return '<button type="button" class="case-card tone-' + cat.tone + '" data-case="' + c.id + '">' +
          '<div class="case-top"><span class="case-no">CASE ' + esc(c.no) + '</span>' + (isDone ? '<span class="badge done">✓ 체험 완료</span>' : '') + '</div>' +
          '<div class="case-emoji">' + c.icon + '</div>' +
          '<h3>' + esc(c.title) + '</h3><p>' + esc(c.summary) + '</p>' +
          '<span class="case-go">상황 확인하기 →</span></button>';
      }).join('') + '</div>' +
      (other ? '<div class="switch-cat"><button class="btn text" data-cat-switch="' + other.id + '">' + other.icon + ' ' + esc(other.button) + ' CASE 보기 →</button></div>' : '');
  };

  /* ---------- ③ 상황 확인 ---------- */
  VIEWS[3] = function () {
    var c = getCase();
    return backBar('CASE 목록', 2) +
      '<article class="doc-window">' +
      '<header class="doc-head"><span class="case-no big">CASE ' + esc(c.no) + '</span><h2>' + esc(c.title) + '</h2>' +
      '<p class="doc-sub">📄 지금부터 당신은 이 상황의 당사자입니다. 상황과 참고자료를 꼼꼼히 확인하세요.</p></header>' +
      '<div class="scenario">' + R.paragraphs(c.scenario) + '</div>' +
      materialsBlock(c) +
      '</article>' +
      '<div class="actions"><button class="btn primary lg" data-act="toType">' + esc(C.messages.situationNext) + ' →</button></div>';
  };

  /* ---------- ④ 신고유형 선택 ---------- */
  VIEWS[4] = function () {
    var c = getCase();
    return backBar('상황 다시 보기', 3) +
      '<div class="section-head"><span class="chip">CASE ' + esc(c.no) + ' · ' + esc(c.title) + '</span>' +
      '<h2>어떤 신고서를 작성해야 할까요?</h2><p class="muted">' + esc(C.messages.selectGuide) + '</p></div>' +
      '<details class="recap"><summary>📄 상황·참고자료 다시 보기</summary><div class="recap-body"><div class="scenario small">' + R.paragraphs(c.scenario) + '</div>' + materialsBlock(c) + '</div></details>' +
      '<div class="type-grid" role="radiogroup" aria-label="신고서 종류">' + C.formOrder.map(function (fid) {
        var f = FORMS[fid]; var sel = S.selectedFormId === fid;
        return '<button type="button" role="radio" aria-checked="' + sel + '" class="type-card ' + (sel ? 'selected' : '') + '" data-form="' + fid + '">' +
          '<span class="type-radio" aria-hidden="true"></span><span class="type-ico">' + f.icon + '</span>' +
          '<span class="type-name">' + esc(f.title) + '</span><span class="type-desc">' + esc(f.description) + '</span></button>';
      }).join('') + '</div>' +
      '<div id="typeFeedback" class="feedback" aria-live="polite"></div>' +
      '<div class="actions"><button class="btn primary lg" data-act="toForm" ' + (S.selectedFormId ? '' : 'disabled') + '>신고서 작성하기 →</button></div>';
  };

  /* ---------- ⑤ 신고서 작성 ---------- */
  function fieldHTML(fd, c) {
    var v = S.answers[fd.id];
    var hidden = !R.isVisible(fd, S.answers);
    var req = R.isRequired(fd);
    var lab = '<span class="flabel">' + esc(fd.label) + (req ? '<i class="req" aria-label="필수">*</i>' : '') + (fd.help ? '<em class="fhelp">' + esc(fd.help) + '</em>' : '') + '</span>';
    var ctrl = '', id = 'f_' + fd.id;
    switch (fd.type) {
      case 'text':
        ctrl = '<input id="' + id + '" type="text" name="' + fd.id + '" value="' + esc(v || '') + '" placeholder="' + esc(fd.placeholder || '') + '" autocomplete="off">';
        lab = '<label for="' + id + '" class="flabel-wrap">' + lab + '</label>';
        break;
      case 'textarea':
        ctrl = '<textarea id="' + id + '" name="' + fd.id + '" rows="' + (fd.rows || 4) + '" placeholder="' + esc(fd.placeholder || '') + '">' + esc(v || '') + '</textarea>';
        lab = '<label for="' + id + '" class="flabel-wrap">' + lab + '</label>';
        break;
      case 'radio':
      case 'checkbox':
        var arr = fd.type === 'checkbox' ? (Array.isArray(v) ? v : []) : [v];
        ctrl = '<div class="opts ' + (fd.layout === 'stack' ? 'stack' : '') + '" role="' + (fd.type === 'radio' ? 'radiogroup' : 'group') + '">' + fd.options.map(function (o) {
          return '<label class="opt"><input type="' + fd.type + '" name="' + fd.id + '" value="' + esc(o) + '" ' + (arr.indexOf(o) > -1 ? 'checked' : '') + '><span>' + esc(o) + '</span></label>';
        }).join('') + '</div>';
        break;
      case 'attachments':
        var sel = Array.isArray(v) ? v : [];
        ctrl = (c.materials && c.materials.length) ? '<div class="attach-list">' + c.materials.map(function (m) {
          return '<div class="attach-item"><label><input type="checkbox" name="' + fd.id + '" value="' + m.id + '" ' + (sel.indexOf(m.id) > -1 ? 'checked' : '') + '>' +
            '<span class="file-ico">' + R.fileIcon(m.type) + '</span><span class="attach-meta"><b>' + esc(m.label) + '</b><small>' + esc(m.fileName) + '</small></span></label>' +
            '<button type="button" class="link" data-material="' + m.id + '">미리보기</button></div>';
        }).join('') + '</div>' : '<p class="muted">제공된 자료가 없습니다.</p>';
        break;
    }
    return '<div class="field w-' + (fd.width || 'full') + (hidden ? ' is-hidden' : '') + '" data-field="' + fd.id + '">' + lab + ctrl +
      '<span class="ferr">⚠ ' + esc(C.messages.fieldRequired) + '</span></div>';
  }

  VIEWS[5] = function () {
    var c = getCase(), f = getForm();
    return backBar('신고유형 다시 선택', 4) +
      '<div class="write-layout">' +
      '<aside class="write-left"><div class="sticky-panel">' +
      '<div class="panel-label">📄 신고 상황</div><h3 class="left-title">CASE ' + esc(c.no) + '. ' + esc(c.title) + '</h3>' +
      '<div class="scenario small">' + R.paragraphs(c.scenario) + '</div>' + materialsBlock(c) +
      '</div></aside>' +
      '<section class="write-right"><div class="form-sheet">' +
      '<div class="form-sheet-head"><div><span class="form-kicker">모의신고서 작성</span><h2>' + f.icon + ' ' + esc(f.title) + '</h2></div>' +
      '<button type="button" class="btn ghost sm" data-act="example">🔍 예시보기</button></div>' +
      '<p class="form-guide">' + esc(C.messages.formGuide) + '</p>' +
      '<form id="reportForm" novalidate>' + f.sections.map(function (sec, i) {
        return '<fieldset class="fsec"><legend><span class="fsec-no">' + (i + 1) + '</span>' + esc(sec.title) + '</legend>' +
          (sec.note ? '<p class="fsec-note">' + esc(sec.note) + '</p>' : '') +
          '<div class="fgrid">' + sec.fields.map(function (fd) { return fieldHTML(fd, c); }).join('') + '</div></fieldset>';
      }).join('') + '</form>' +
      '<div class="actions"><button type="button" class="btn primary lg" data-act="submitForm">제출하기</button></div>' +
      '</div></section></div>';
  };

  /* ---------- ⑥ 신고 접수 (내용 확인) ---------- */
  VIEWS[6] = function () {
    var c = getCase(), f = getForm();
    return backBar('신고서 수정하기', 5) +
      '<div class="review-wrap"><div class="section-head center"><h2>' + esc(C.messages.reviewTitle) + '</h2><p class="muted">' + esc(C.messages.reviewSubtitle) + '</p></div>' +
      '<div class="mock-notice">ℹ️ ' + esc(C.messages.mockNotice) + '</div>' +
      '<div class="paper">' + R.formDoc(f, S.answers, c) + '</div>' +
      '<div class="actions"><button class="btn ghost lg" data-go="5">수정하기</button><button class="btn danger lg" data-act="send">🚨 신고하기</button></div></div>';
  };

  /* ---------- ⑦ 접수 완료 ---------- */
  VIEWS[7] = function () {
    var c = getCase(), f = getForm(), r = S.result || {}, rr = C.realReport;
    return '<div class="done-wrap">' +
      '<div class="done-badge" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>' +
      '<h2>' + esc(C.completion.title) + '</h2><p class="muted">' + esc(C.completion.subtitle) + '</p>' +
      '<div class="receipt"><div class="receipt-head">모의신고 접수증</div>' +
      '<div class="receipt-row main"><span>접수번호</span><b class="mono">' + esc(r.receiptNo || '-') + '</b></div>' +
      '<div class="receipt-row"><span>접수일시</span><b>' + esc(R.formatDateTime(r.submittedAt)) + '</b></div>' +
      '<div class="receipt-row"><span>신고 상황</span><b>CASE ' + esc(c.no) + '. ' + esc(c.title) + '</b></div>' +
      '<div class="receipt-row"><span>신고서 종류</span><b>' + esc(f.title) + '</b></div>' +
      '<div class="receipt-row"><span>신고인</span><b>' + esc(S.answers.reporter_name || '-') + '</b></div>' +
      (r.pending ? '<p class="receipt-warn">⚠ ' + esc(C.completion.offlineNotice) + '</p>' : '') +
      '</div>' +
      '<section class="promo"><h3>📢 ' + esc(rr.title) + '</h3>' + rr.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      '<div class="promo-grid">' +
      '<div class="promo-box"><h4>☎ 문의</h4><dl>' + rr.contacts.map(function (x) { return '<div><dt>' + esc(x.label) + '</dt><dd>' + esc(x.value) + '</dd></div>'; }).join('') + '</dl></div>' +
      '<div class="promo-box"><h4>💻 ' + esc(rr.onlineLabel) + '</h4><div class="crumbs">' + rr.onlinePath.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('<i>→</i>') + '</div>' +
      '<div class="centers">' + rr.centers.map(function (x) { return '<div class="center"><span>' + x.icon + '</span><b>' + esc(x.name) + '</b><em>' + esc(x.note) + '</em></div>'; }).join('<span class="or">혹은</span>') + '</div></div>' +
      '</div></section>' +
      '<div class="actions"><button class="btn ghost lg" data-act="home">처음으로</button><button class="btn primary lg" data-act="another">다른 CASE 체험하기 →</button></div>' +
      '</div>';
  };

  /* ================================================================ 이벤트 */
  var BINDERS = {};

  BINDERS[1] = function () {
    var n = document.getElementById('pName'), d = document.getElementById('pDept');
    function save() {
      if (n) S.participant.name = n.value;
      if (d) S.participant.dept = d.value;
      lsSet(LS.participant, S.participant);
      if (n && n.value.trim()) n.closest('.pfield').classList.remove('invalid');
      if (d && d.value.trim()) d.closest('.pfield').classList.remove('invalid');
    }
    if (n) n.addEventListener('input', save);
    if (d) d.addEventListener('input', save);
  };

  BINDERS[5] = function () {
    var form = document.getElementById('reportForm');
    var f = getForm();
    var byId = {}; R.allFields(f).forEach(function (fd) { byId[fd.id] = fd; });
    function onInput(e) {
      var name = e.target.name; if (!name || !byId[name]) return;
      var fd = byId[name];
      if (fd.type === 'checkbox' || fd.type === 'attachments') {
        S.answers[name] = Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
      } else if (fd.type === 'radio') {
        var ch = form.querySelector('input[name="' + name + '"]:checked'); S.answers[name] = ch ? ch.value : '';
      } else {
        S.answers[name] = e.target.value;
      }
      var w = form.querySelector('[data-field="' + name + '"]');
      if (w && R.isFilled(fd, S.answers[name])) w.classList.remove('invalid');
      // 조건부 항목 표시/숨김
      R.allFields(f).forEach(function (x) {
        if (!x.showIf) return;
        var el = form.querySelector('[data-field="' + x.id + '"]');
        if (el) el.classList.toggle('is-hidden', !R.isVisible(x, S.answers));
      });
    }
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
  };

  function validateParticipant() {
    if (!CFG.participant.required) return true;
    var ok = true;
    ['name', 'dept'].forEach(function (k) {
      var el = document.querySelector('.pfield[data-p="' + k + '"]');
      var filled = (S.participant[k] || '').trim() !== '';
      if (el) el.classList.toggle('invalid', !filled);
      if (!filled) ok = false;
    });
    if (!ok) {
      toast('⚠ ' + esc(C.messages.participantMissing), 'warn');
      var first = document.querySelector('.pfield.invalid input'); if (first) first.focus();
    }
    return ok;
  }

  function selectCase(id) {
    S.caseId = id;
    S.selectedFormId = null;
    S.wrongAttempts = [];
    S.answers = {};
    S.exampleViewed = 0;
    S.validationFailCount = 0;
    S.materialsOpened = [];
    S.result = null;
    S.startedAt = new Date().toISOString();
    S.formStartedAt = null;
    go(3);
  }

  function selectFormType(fid) {
    S.selectedFormId = fid;
    document.querySelectorAll('.type-card').forEach(function (el) {
      var on = el.getAttribute('data-form') === fid;
      el.classList.toggle('selected', on);
      el.classList.remove('wrong');
      el.setAttribute('aria-checked', on);
    });
    var btn = document.querySelector('[data-act="toForm"]'); if (btn) btn.disabled = false;
    var fb = document.getElementById('typeFeedback'); if (fb) { fb.className = 'feedback'; fb.innerHTML = ''; }
  }

  function checkFormType() {
    var c = getCase();
    if (!S.selectedFormId) return;
    var fb = document.getElementById('typeFeedback');
    if (S.selectedFormId !== c.answerFormId) {
      S.wrongAttempts.push({ formId: S.selectedFormId, at: new Date().toISOString() });
      var card = document.querySelector('.type-card[data-form="' + S.selectedFormId + '"]');
      if (card) { card.classList.remove('wrong'); void card.offsetWidth; card.classList.add('wrong'); }
      var showHint = CFG.game.hintAfterWrongAttempts > 0 && S.wrongAttempts.length >= CFG.game.hintAfterWrongAttempts && c.hint;
      fb.className = 'feedback error show';
      fb.innerHTML = '<b>🤔 ' + esc(C.messages.wrongType) + '</b><span>' + esc(C.messages.wrongTypeDetail) + '</span>' +
        (showHint ? '<div class="hint"><b>💡 힌트</b> ' + esc(c.hint) + '</div>' : '');
      toast('🤔 ' + esc(C.messages.wrongType), 'warn');
      return;
    }
    fb.className = 'feedback success show';
    fb.innerHTML = '<b>🎉 ' + esc(C.messages.correctType) + '</b>';
    if (!S.formStartedAt) S.formStartedAt = new Date().toISOString();
    setTimeout(function () { go(5); }, 700);
  }

  function validateForm() {
    var f = getForm();
    var form = document.getElementById('reportForm');
    var missing = [];
    R.allFields(f).forEach(function (fd) {
      var el = form.querySelector('[data-field="' + fd.id + '"]');
      var bad = R.isRequired(fd) && R.isVisible(fd, S.answers) && !R.isFilled(fd, S.answers[fd.id]);
      if (el) el.classList.toggle('invalid', bad);
      if (bad) missing.push(fd);
    });
    if (!missing.length) return true;
    S.validationFailCount++;
    var secOf = {};
    f.sections.forEach(function (s) { s.fields.forEach(function (fd) { secOf[fd.id] = s.title; }); });
    var first = form.querySelector('.field.invalid');
    toast('⚠ ' + esc(C.messages.incomplete), 'error');
    openModal({
      title: '⚠ ' + C.messages.incomplete,
      tone: 'tone-error',
      body: '<p class="muted">' + esc(C.messages.incompleteDetail) + '</p><ul class="missing-list">' + missing.map(function (fd) {
        return '<li><span>' + esc(secOf[fd.id]) + '</span>' + esc(fd.docLabel || fd.label) + '</li>';
      }).join('') + '</ul>',
      foot: '<button class="btn primary" data-close>확인하고 작성하기</button>'
    });
    var onClose = function () {
      if (modal.hidden) {
        if (first) {
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var inp = first.querySelector('input, textarea'); if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 350);
        }
        obs.disconnect();
      }
    };
    var obs = new MutationObserver(onClose);
    obs.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
    return false;
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function buildSubmission() {
    var c = getCase(), f = getForm(), now = new Date();
    var started = S.startedAt ? new Date(S.startedAt) : now;
    return {
      appVersion: CFG.appVersion,
      participant: { name: (S.participant.name || '').trim(), dept: (S.participant.dept || '').trim() },
      category: S.category,
      caseId: c.id,
      caseNo: c.no,
      caseTitle: c.title,
      formId: f.id,
      formTitle: f.title,
      typeSelection: {
        correctFormId: c.answerFormId,
        wrongAttempts: S.wrongAttempts.slice(),
        wrongCount: S.wrongAttempts.length,
        firstTryCorrect: S.wrongAttempts.length === 0
      },
      answers: JSON.parse(JSON.stringify(S.answers)),
      evidenceSelected: (S.answers.evidence || []).slice(),
      // 사람이 읽기 쉬운 요약 (구글 시트·CSV 등에서 그대로 확인용)
      evidenceText: (S.answers.evidence || []).map(function (id) {
        var m = (c.materials || []).filter(function (x) { return x.id === id; })[0]; return m ? m.label : id;
      }).join(', '),
      wrongAttemptsText: S.wrongAttempts.map(function (w) { return FORMS[w.formId] ? FORMS[w.formId].title : w.formId; }).join(' > '),
      answersText: R.plainAnswers(f, S.answers, c),
      behavior: {
        exampleViewedCount: S.exampleViewed,
        validationFailCount: S.validationFailCount,
        materialsOpened: S.materialsOpened.slice(),
        materialsTotal: (c.materials || []).length
      },
      startedAt: S.startedAt,
      formStartedAt: S.formStartedAt,
      submittedAt: now.toISOString(),
      durationSec: Math.round((now - started) / 1000),
      client: { userAgent: navigator.userAgent, screen: window.screen.width + 'x' + window.screen.height }
    };
  }

  function send() {
    if (S.submitting) return;
    S.submitting = true;
    var overlay = document.getElementById('sending'), fill = document.getElementById('sendingFill'), text = document.getElementById('sendingText');
    var steps = C.messages.sendingSteps, total = CFG.game.sendingAnimationMs;
    overlay.hidden = false; overlay.classList.remove('done');
    fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth;
    fill.style.transition = 'width ' + total + 'ms cubic-bezier(.3,.6,.4,1)'; fill.style.width = '100%';
    steps.forEach(function (s, i) { setTimeout(function () { text.textContent = s; }, i * total / steps.length); });
    var sub = buildSubmission();
    Promise.all([Store.submit(sub), wait(total)]).then(function (res) {
      S.result = Object.assign({}, res[0], { submittedAt: sub.submittedAt });
      markCompleted(sub.caseId);
      overlay.classList.add('done');
      text.textContent = '접수 완료!';
      return wait(500);
    }).then(function () {
      overlay.hidden = true;
      S.submitting = false;
      go(7);
      updateModePill();
    });
  }

  screen.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-material]'))) { e.preventDefault(); openMaterial(t.getAttribute('data-material')); return; }
    if ((t = e.target.closest('[data-go]'))) { go(+t.getAttribute('data-go')); return; }
    if ((t = e.target.closest('[data-cat]'))) {
      if (!validateParticipant()) return;
      S.category = t.getAttribute('data-cat'); go(2); return;
    }
    if ((t = e.target.closest('[data-cat-switch]'))) { S.category = t.getAttribute('data-cat-switch'); go(2); return; }
    if ((t = e.target.closest('[data-case]'))) { selectCase(t.getAttribute('data-case')); return; }
    if ((t = e.target.closest('[data-form]'))) { selectFormType(t.getAttribute('data-form')); return; }
    if ((t = e.target.closest('[data-act]'))) {
      switch (t.getAttribute('data-act')) {
        case 'toType': go(4); break;
        case 'toForm': checkFormType(); break;
        case 'example': openExample(); break;
        case 'submitForm': if (validateForm()) go(6); break;
        case 'send': send(); break;
        case 'home': S.category = null; S.caseId = null; go(1); break;
        case 'another': S.caseId = null; go(2); break;
      }
    }
  });

  // 모달 안의 링크(예: 미리보기) 처리
  document.getElementById('modalBody').addEventListener('click', function (e) {
    var t = e.target.closest('[data-material]'); if (t) openMaterial(t.getAttribute('data-material'));
  });

  // 작성 중 이탈 방지
  window.addEventListener('beforeunload', function (e) {
    if (S.step >= 5 && S.step <= 6 && Object.keys(S.answers).length) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ================================================================ 기타 */
  function tickClock() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    document.getElementById('clock').innerHTML = '<b>' + p(d.getHours()) + ':' + p(d.getMinutes()) + '</b><small>' + d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.</small>';
  }
  function updateModePill() {
    Store.getMode().then(function (m) {
      var el = document.getElementById('modePill');
      var label = { local: '💾 이 PC에 저장', server: '🌐 서버 저장', supabase: '☁️ 클라우드 저장', gsheet: '📗 구글 시트 저장' }[m] || m;
      el.textContent = label;
      el.className = 'mode-pill mode-' + m;
    });
  }

  tickClock(); setInterval(tickClock, 30000);
  updateModePill();
  render();
})();
