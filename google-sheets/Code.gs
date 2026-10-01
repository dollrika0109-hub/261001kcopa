/* =========================================================================
 * 한국저작권보호원 모의신고 훈련 · 구글 시트 저장용 Apps Script
 *
 * 설치 방법 (README.md의 "구글 시트로 결과 받기" 참고)
 *  1) 결과를 받을 구글 시트 → 확장 프로그램 → Apps Script
 *  2) 이 코드를 전부 붙여넣고 저장
 *  3) 아래 ADMIN_PASSWORD 를 원하는 비밀번호로 변경
 *  4) 배포 → 새 배포 → 유형: 웹 앱
 *       - 다음 사용자로 실행: 나
 *       - 액세스 권한이 있는 사용자: 모든 사용자
 *  5) 발급된 웹 앱 URL(…/exec)을 js/config.js 의 googleSheets.webAppUrl 에 입력
 *
 * ※ 코드를 수정한 뒤에는 "배포 관리 → 수정 → 새 버전"으로 다시 배포해야 반영됩니다.
 * ========================================================================= */

var ADMIN_PASSWORD = 'kcopa1234';   // ★ 반드시 변경하세요 (관리자 화면 로그인용)
var SHEET_NAME = '제출결과';

var HEADERS = [
  '접수번호', '제출일시', '성명', '소속', '신고 구분', 'CASE', 'CASE 제목', '신고서 종류',
  '1차 정답', '오답 횟수', '오답 이력', '예시보기 횟수', '미완료 제출 시도', '참고자료 열람',
  '첨부 선택 자료', '소요시간(초)', '신고서 작성 내용', 'ID', '원본 데이터(JSON)'
];
var COL_ID = HEADERS.indexOf('ID') + 1;
var COL_JSON = HEADERS.indexOf('원본 데이터(JSON)') + 1;

/* ---------------- 진입점 ---------------- */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ error: '잘못된 요청입니다.' }); }

  switch (body.action) {
    case 'submit': return json(submit(body.data));
    case 'login':  return json(checkPw(body.password) ? { ok: true } : { error: 'unauthorized' });
    case 'list':   return json(checkPw(body.password) ? { items: list() } : { error: 'unauthorized' });
    case 'delete': return json(checkPw(body.password) ? remove(body.id) : { error: 'unauthorized' });
  }
  return json({ error: 'unknown action' });
}

function doGet() {
  return json({ ok: true, app: 'mock-report', backend: 'google-sheets' });
}

/* ---------------- 기능 ---------------- */
function submit(d) {
  if (!d || !d.caseId || !d.answers) return { error: '잘못된 요청입니다.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    var receiptNo = nextReceipt();
    var id = d.id || Utilities.getUuid();
    var rec = Object.assign({}, d, { id: id, receiptNo: receiptNo, storedAt: new Date().toISOString() });
    var p = d.participant || {}, t = d.typeSelection || {}, b = d.behavior || {};
    var submitted = d.submittedAt ? new Date(d.submittedAt) : new Date();

    sheet.appendRow([
      receiptNo,
      Utilities.formatDate(submitted, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      p.name || '', p.dept || '',
      d.category === 'self' ? '본인 신고' : '위반행위 신고',
      'CASE ' + (d.caseNo || ''), d.caseTitle || '', d.formTitle || '',
      t.firstTryCorrect ? 'Y' : 'N', t.wrongCount || 0, d.wrongAttemptsText || '',
      b.exampleViewedCount || 0, b.validationFailCount || 0,
      (b.materialsOpened || []).length + ' / ' + (b.materialsTotal || 0),
      d.evidenceText || '',
      d.durationSec || 0,
      truncate(d.answersText || '', 45000),
      id,
      truncate(JSON.stringify(rec), 49000)
    ]);
    return { id: id, receiptNo: receiptNo };
  } finally {
    lock.releaseLock();
  }
}

function list() {
  var sheet = getSheet();
  var n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  var vals = sheet.getRange(2, COL_JSON, n, 1).getValues();
  var items = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    try { items.push(JSON.parse(vals[i][0])); } catch (e) { /* 수동 편집된 행은 건너뜀 */ }
  }
  return items;
}

function remove(id) {
  var sheet = getSheet();
  var n = sheet.getLastRow() - 1;
  if (n < 1) return { error: 'not found' };
  var ids = sheet.getRange(2, COL_ID, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) { sheet.deleteRow(i + 2); return { ok: true }; }
  }
  return { error: 'not found' };
}

/* ---------------- 유틸 ---------------- */
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#e9efff');
    sheet.setColumnWidth(HEADERS.indexOf('신고서 작성 내용') + 1, 420);
  }
  return sheet;
}

function nextReceipt() {
  var props = PropertiesService.getScriptProperties();
  var year = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy');
  var key = 'seq_' + year;
  var seq = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(seq));
  return year + '-MOCK-' + (seq < 1000 ? ('00' + seq).slice(-3) : String(seq));
}

function checkPw(pw) { return typeof pw === 'string' && pw === ADMIN_PASSWORD; }
function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…(생략)' : s; }
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
