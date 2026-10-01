/* =========================================================================
 * 관리자 대시보드
 * ========================================================================= */
(function () {
  'use strict';
  var C = window.CONTENT, CASES = window.CASES, FORMS = window.FORMS, R = window.Render, Store = window.Store;
  var esc = R.esc;
  var root = document.getElementById('adminScreen');
  var items = [];
  var filter = { caseId: '', q: '' };
  var currentMode = 'local';

  function caseById(id) { return CASES.filter(function (c) { return c.id === id; })[0]; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function avg(arr) { return arr.length ? arr.reduce(function (s, x) { return s + x; }, 0) / arr.length : 0; }

  function toast(msg) {
    var el = document.getElementById('toast');
    el.className = 'toast show'; el.textContent = msg;
    setTimeout(function () { el.className = 'toast'; }, 2400);
  }
  var modal = document.getElementById('modal');
  function openModal(title, body, foot) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFoot').innerHTML = foot || '<button class="btn primary" data-close>닫기</button>';
    modal.hidden = false; document.body.classList.add('no-scroll');
  }
  function closeModal() { modal.hidden = true; document.body.classList.remove('no-scroll'); }
  modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ---------------- 로그인 ---------------- */
  function viewLogin(err) {
    var supa = currentMode === 'supabase';
    var notes = {
      local: '현재 <b>이 PC(브라우저) 저장 모드</b>입니다. 이 브라우저에서 제출된 결과만 볼 수 있습니다. 여러 PC의 결과를 모으려면 README의 서버 실행 방법을 참고하세요.',
      server: '현재 <b>중앙 서버 저장 모드</b>입니다. 서버 실행 시 설정한 ADMIN_PASSWORD로 로그인하세요.',
      supabase: '현재 <b>Supabase 저장 모드</b>입니다. Supabase Auth에 등록되고 admin_users 테이블에 추가된 계정으로 로그인하세요.',
      gsheet: '현재 <b>구글 시트 저장 모드</b>입니다. Apps Script(Code.gs)에 설정한 ADMIN_PASSWORD로 로그인하세요. 결과는 구글 시트에서도 바로 확인할 수 있습니다.'
    };
    root.innerHTML = '<div class="login-box view"><div class="lock-ico">🔐</div><h2>관리자 로그인</h2><p class="muted">모의신고 훈련 결과는 관리자만 확인할 수 있습니다.</p>' +
      '<form id="loginForm">' + (supa ? '<input type="email" id="email" placeholder="관리자 이메일" autocomplete="username" required>' : '') +
      '<input type="password" id="pw" placeholder="비밀번호" autocomplete="current-password" required>' +
      '<div class="login-err">' + esc(err || '') + '</div><button class="btn primary lg" type="submit">로그인</button></form>' +
      '<p class="login-note">ℹ️ ' + notes[currentMode] + '</p></div>';
    var f = document.getElementById('loginForm');
    (supa ? document.getElementById('email') : document.getElementById('pw')).focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var cred = { password: document.getElementById('pw').value, email: supa ? document.getElementById('email').value : '' };
      Store.adminLogin(cred).then(function (ok) {
        if (ok) load(); else viewLogin('로그인 정보가 올바르지 않습니다.');
      });
    });
  }

  /* ---------------- 데이터 로드 ---------------- */
  function load() {
    root.innerHTML = '<div class="empty-state">불러오는 중…</div>';
    Store.list().then(function (list) {
      items = list || [];
      document.getElementById('logoutBtn').hidden = false;
      viewDashboard();
    }).catch(function (err) {
      if (err && err.status === 401) { Store.adminLogout(); return viewLogin('세션이 만료되었습니다. 다시 로그인하세요.'); }
      root.innerHTML = '<div class="empty-state">데이터를 불러오지 못했습니다.<br>' + esc(err && err.message) + '</div>';
    });
  }

  /* ---------------- 통계 ---------------- */
  function caseStats() {
    return CASES.map(function (c) {
      var list = items.filter(function (s) { return s.caseId === c.id; });
      var first = list.filter(function (s) { return s.typeSelection && s.typeSelection.firstTryCorrect; }).length;
      return {
        c: c, n: list.length,
        firstRate: pct(first, list.length),
        avgWrong: avg(list.map(function (s) { return (s.typeSelection && s.typeSelection.wrongCount) || 0; })),
        exampleRate: pct(list.filter(function (s) { return s.behavior && s.behavior.exampleViewedCount > 0; }).length, list.length),
        avgFail: avg(list.map(function (s) { return (s.behavior && s.behavior.validationFailCount) || 0; })),
        avgDur: avg(list.map(function (s) { return s.durationSec || 0; })),
        wrongForms: list.reduce(function (acc, s) {
          ((s.typeSelection && s.typeSelection.wrongAttempts) || []).forEach(function (w) { acc[w.formId] = (acc[w.formId] || 0) + 1; });
          return acc;
        }, {})
      };
    });
  }

  function viewDashboard() {
    var people = {};
    items.forEach(function (s) { var p = s.participant || {}; people[(p.name || '') + '|' + (p.dept || '')] = 1; });
    var firstAll = items.filter(function (s) { return s.typeSelection && s.typeSelection.firstTryCorrect; }).length;
    var stats = caseStats();

    root.innerHTML = '<div class="view">' +
      '<div class="admin-head"><div><span class="chip">관리자</span><h2 style="margin-top:8px">모의신고 훈련 결과</h2></div>' +
      '<div class="admin-tools"><button class="btn ghost sm" data-act="reload">↻ 새로고침</button><button class="btn ghost sm" data-act="csv">⬇ CSV 다운로드</button><button class="btn ghost sm" data-act="json">⬇ JSON 백업</button></div></div>' +
      '<div class="kpis">' +
      kpi('총 제출 건수', items.length + '건') +
      kpi('참여 인원', Object.keys(people).length + '명', '성명·소속 기준') +
      kpi('신고유형 1차 정답률', pct(firstAll, items.length) + '%', '오답 없이 정답 선택') +
      kpi('평균 소요시간', R.formatDuration(avg(items.map(function (s) { return s.durationSec || 0; })))) +
      kpi('예시보기 활용률', pct(items.filter(function (s) { return s.behavior && s.behavior.exampleViewedCount > 0; }).length, items.length) + '%') +
      '</div>' +
      '<section class="admin-section"><h3>📊 CASE별 현황</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>CASE</th><th>정답 신고서</th><th class="num">참여</th><th>1차 정답률</th><th class="num">평균 오답</th><th>가장 많이 틀린 선택</th><th class="num">예시보기</th><th class="num">미완료 제출 시도</th><th class="num">평균 소요</th></tr></thead><tbody>' +
      stats.map(function (s) {
        var top = Object.keys(s.wrongForms).sort(function (a, b) { return s.wrongForms[b] - s.wrongForms[a]; })[0];
        return '<tr><td><b>CASE ' + esc(s.c.no) + '</b> ' + esc(s.c.title) + '</td><td>' + esc(FORMS[s.c.answerFormId].title) + '</td>' +
          '<td class="num">' + s.n + '</td><td><span class="bar"><i style="width:' + s.firstRate + '%"></i></span>' + (s.n ? s.firstRate + '%' : '-') + '</td>' +
          '<td class="num">' + (s.n ? s.avgWrong.toFixed(1) : '-') + '</td>' +
          '<td>' + (top ? esc(FORMS[top] ? FORMS[top].title : top) + ' (' + s.wrongForms[top] + ')' : '-') + '</td>' +
          '<td class="num">' + (s.n ? s.exampleRate + '%' : '-') + '</td><td class="num">' + (s.n ? s.avgFail.toFixed(1) + '회' : '-') + '</td>' +
          '<td class="num">' + (s.n ? R.formatDuration(s.avgDur) : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="admin-section"><h3>📝 제출 목록 <span class="muted" style="font-size:13px;font-weight:500">· 행을 클릭하면 작성한 신고서를 볼 수 있습니다</span></h3>' +
      '<div class="filters"><select id="fCase"><option value="">전체 CASE</option>' + CASES.map(function (c) {
        return '<option value="' + c.id + '"' + (filter.caseId === c.id ? ' selected' : '') + '>CASE ' + esc(c.no) + '. ' + esc(c.title) + '</option>';
      }).join('') + '</select><input id="fQ" type="search" placeholder="성명 · 소속 · 접수번호 검색" value="' + esc(filter.q) + '"></div>' +
      '<div class="tbl-wrap" id="listWrap"></div></section></div>';

    renderList();
    document.getElementById('fCase').addEventListener('change', function (e) { filter.caseId = e.target.value; renderList(); });
    document.getElementById('fQ').addEventListener('input', function (e) { filter.q = e.target.value; renderList(); });
  }
  function kpi(label, val, sub) { return '<div class="kpi"><span>' + esc(label) + '</span><b>' + esc(val) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; }

  function filtered() {
    var q = filter.q.trim().toLowerCase();
    return items.filter(function (s) {
      if (filter.caseId && s.caseId !== filter.caseId) return false;
      if (!q) return true;
      var p = s.participant || {};
      return [p.name, p.dept, s.receiptNo].join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function renderList() {
    var list = filtered();
    var wrap = document.getElementById('listWrap');
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">' + (items.length ? '조건에 맞는 제출 건이 없습니다.' : '아직 제출된 모의신고가 없습니다.') + '</div>'; return; }
    wrap.innerHTML = '<table class="tbl"><thead><tr><th>접수번호</th><th>제출일시</th><th>성명</th><th>소속</th><th>CASE</th><th>신고유형 선택</th><th class="num">오답</th><th class="num">첨부자료</th><th class="num">소요</th></tr></thead><tbody>' +
      list.map(function (s) {
        var ts = s.typeSelection || {}, p = s.participant || {}, c = caseById(s.caseId);
        var evid = (s.evidenceSelected || []).length, total = (s.behavior && s.behavior.materialsTotal) || 0;
        return '<tr class="clickable" data-id="' + esc(s.id) + '"><td class="mono">' + esc(s.receiptNo) + (s.syncStatus === 'pending' ? ' <span class="tag pending">미전송</span>' : '') + '</td>' +
          '<td>' + esc(R.formatDateTime(s.submittedAt)) + '</td><td>' + esc(p.name || '-') + '</td><td>' + esc(p.dept || '-') + '</td>' +
          '<td>' + (c ? 'CASE ' + esc(c.no) : esc(s.caseId)) + '</td>' +
          '<td>' + (ts.firstTryCorrect ? '<span class="tag ok">1차 정답</span>' : '<span class="tag ng">재선택</span>') + '</td>' +
          '<td class="num">' + (ts.wrongCount || 0) + '</td><td class="num">' + (total ? evid + '/' + total : '-') + '</td>' +
          '<td class="num">' + R.formatDuration(s.durationSec) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function showDetail(id) {
    var s = items.filter(function (x) { return x.id === id; })[0]; if (!s) return;
    var c = caseById(s.caseId), f = FORMS[s.formId], ts = s.typeSelection || {}, b = s.behavior || {}, p = s.participant || {};
    var meta = [
      ['접수번호', s.receiptNo], ['참가자', (p.name || '-') + ' / ' + (p.dept || '-')], ['제출일시', R.formatDateTime(s.submittedAt)],
      ['CASE', c ? 'CASE ' + c.no + '. ' + c.title : s.caseId], ['소요시간', R.formatDuration(s.durationSec)], ['예시보기', (b.exampleViewedCount || 0) + '회'],
      ['참고자료 열람', (b.materialsOpened || []).length + ' / ' + (b.materialsTotal || 0)], ['미완료 제출 시도', (b.validationFailCount || 0) + '회'], ['신고유형 오답', (ts.wrongCount || 0) + '회']
    ];
    var wrong = (ts.wrongAttempts || []).length ? '<div class="wrong-list"><b>신고유형 오답 이력:</b> ' + ts.wrongAttempts.map(function (w) { return esc(FORMS[w.formId] ? FORMS[w.formId].title : w.formId); }).join(' → ') + ' → <b>정답</b></div>' : '';
    openModal('📄 ' + s.receiptNo + ' · ' + (p.name || ''),
      '<div class="detail-meta">' + meta.map(function (m) { return '<div><span>' + esc(m[0]) + '</span><b>' + esc(m[1]) + '</b></div>'; }).join('') + '</div>' + wrong +
      '<div class="paper">' + (f ? R.formDoc(f, s.answers, c) : '<pre>' + esc(JSON.stringify(s.answers, null, 2)) + '</pre>') + '</div>',
      '<button class="btn ghost" data-del="' + esc(s.id) + '">🗑 삭제</button><button class="btn primary" data-close>닫기</button>');
  }

  /* ---------------- 내보내기 ---------------- */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV() {
    var head = ['접수번호', '제출일시', '성명', '소속', 'CASE', 'CASE 제목', '정답 신고서', '1차 정답', '오답 횟수', '오답 이력', '예시보기 횟수', '미완료 제출 시도', '참고자료 열람 수', '첨부 선택 자료 수', '소요시간(초)', '신고서 작성 내용'];
    var rows = filtered().map(function (s) {
      var c = caseById(s.caseId), f = FORMS[s.formId], ts = s.typeSelection || {}, b = s.behavior || {}, p = s.participant || {};
      return [s.receiptNo, R.formatDateTime(s.submittedAt), p.name, p.dept, c ? c.no : s.caseId, s.caseTitle, s.formTitle,
        ts.firstTryCorrect ? 'Y' : 'N', ts.wrongCount || 0, (ts.wrongAttempts || []).map(function (w) { return FORMS[w.formId] ? FORMS[w.formId].title : w.formId; }).join(' > '),
        b.exampleViewedCount || 0, b.validationFailCount || 0, (b.materialsOpened || []).length, (s.evidenceSelected || []).length, s.durationSec,
        f ? R.plainAnswers(f, s.answers, c) : JSON.stringify(s.answers)];
    });
    var csv = '﻿' + [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    download('모의신고_결과_' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv;charset=utf-8');
  }

  /* ---------------- 이벤트 ---------------- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (t) {
      var a = t.getAttribute('data-act');
      if (a === 'reload') load();
      if (a === 'csv') exportCSV();
      if (a === 'json') download('모의신고_백업_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(items, null, 2), 'application/json');
      return;
    }
    var row = e.target.closest('tr[data-id]');
    if (row) showDetail(row.getAttribute('data-id'));
  });
  document.getElementById('modalFoot').addEventListener('click', function (e) {
    var t = e.target.closest('[data-del]'); if (!t) return;
    if (!confirm('이 제출 건을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) return;
    Store.remove(t.getAttribute('data-del')).then(function () { closeModal(); toast('삭제했습니다.'); load(); })
      .catch(function (err) { toast('삭제 실패: ' + (err && err.message)); });
  });
  document.getElementById('logoutBtn').addEventListener('click', function () {
    Store.adminLogout(); this.hidden = true; items = []; viewLogin();
  });

  /* ---------------- 시작 ---------------- */
  Store.getMode().then(function (m) {
    currentMode = m;
    var pill = document.getElementById('modePill');
    pill.textContent = { local: '💾 이 PC 저장 모드', server: '🌐 중앙 서버 모드', supabase: '☁️ Supabase 모드', gsheet: '📗 구글 시트 모드' }[m];
    pill.className = 'mode-pill mode-' + m;
    if (Store.isAdminLoggedIn()) load(); else viewLogin();
  });
})();
