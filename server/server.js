/* =========================================================================
 * 모의신고 훈련 — 중앙 저장용 경량 서버 (외부 패키지 없이 Node.js만 필요)
 *
 * 실행:  node server/server.js
 * 환경변수:
 *   PORT            기본 8080
 *   ADMIN_PASSWORD  관리자 비밀번호 (기본 kcopa1234 → 반드시 변경)
 *   ADMIN_PATH      관리자 페이지 경로 (기본 kcopa-admin → http://서버주소:8080/kcopa-admin)
 *
 * 데이터는 server/data/submissions.json 에 저장됩니다.
 * ========================================================================= */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kcopa1234';
const ADMIN_PATH = '/' + String(process.env.ADMIN_PATH || 'kcopa-admin').replace(/^\/+|\/+$/g, '');
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_BODY = 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

/* ---------------- 저장소 ---------------- */
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return { seq: {}, items: [] }; }
}
let db = loadDB();
function saveDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function nextReceipt() {
  const year = new Date().getFullYear();
  db.seq[year] = (db.seq[year] || 0) + 1;
  return `${year}-MOCK-${String(db.seq[year]).padStart(3, '0')}`;
}

/* ---------------- 관리자 세션 ---------------- */
const tokens = new Map();
function issueToken() {
  const t = crypto.randomBytes(24).toString('hex');
  tokens.set(t, Date.now() + TOKEN_TTL_MS);
  return t;
}
function isAuthed(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const exp = tokens.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { tokens.delete(t); return false; }
  return true;
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
const loginFails = new Map(); // ip -> { count, until }

/* ---------------- 유틸 ---------------- */
function send(res, status, obj, headers) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': typeof obj === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, headers || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function clientIp(req) { return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }

/* ---------------- 정적 파일 ---------------- */
const BLOCKED = [/^\/server(\/|$)/, /^\/supabase(\/|$)/, /^\/admin\.html$/, /^\/\./, /\.md$/i, /\.sql$/i];
function serveStatic(req, res, pathname) {
  if (pathname === ADMIN_PATH || pathname === ADMIN_PATH + '/') pathname = '/admin.html';
  else if (BLOCKED.some(r => r.test(pathname))) return send(res, 404, 'Not Found');
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not Found');
    const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    if (pathname === '/admin.html') { headers['X-Robots-Tag'] = 'noindex'; headers['Cache-Control'] = 'no-store'; }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- 라우터 ---------------- */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, { error: 'bad url' }); }
  const p = decodeURIComponent(url.pathname);

  try {
    if (p === '/api/health' && req.method === 'GET') {
      return send(res, 200, { ok: true, app: 'mock-report', count: db.items.length });
    }

    // 참가자 제출 (누구나 가능)
    if (p === '/api/submissions' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object' || !body.caseId || !body.answers) return send(res, 400, { error: '잘못된 요청입니다.' });
      const rec = Object.assign({}, body, {
        id: typeof body.id === 'string' && body.id.length < 80 ? body.id : crypto.randomUUID(),
        receiptNo: nextReceipt(),
        storedAt: new Date().toISOString(),
        clientIp: clientIp(req)
      });
      if (db.items.some(x => x.id === rec.id)) rec.id = crypto.randomUUID();
      db.items.push(rec);
      saveDB();
      return send(res, 201, { id: rec.id, receiptNo: rec.receiptNo });
    }

    // 관리자 로그인
    if (p === '/api/admin/login' && req.method === 'POST') {
      const ip = clientIp(req);
      const f = loginFails.get(ip);
      if (f && f.until > Date.now()) return send(res, 429, { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.' });
      const body = await readBody(req);
      if (safeEqual(body.password || '', ADMIN_PASSWORD)) {
        loginFails.delete(ip);
        return send(res, 200, { token: issueToken() });
      }
      const cnt = (f ? f.count : 0) + 1;
      loginFails.set(ip, { count: cnt, until: cnt >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
      return send(res, 401, { error: '비밀번호가 올바르지 않습니다.' });
    }
    if (p === '/api/admin/logout' && req.method === 'POST') {
      const h = req.headers.authorization || ''; tokens.delete(h.replace('Bearer ', ''));
      return send(res, 200, { ok: true });
    }

    // 관리자 전용
    if (p.startsWith('/api/submissions')) {
      if (!isAuthed(req)) return send(res, 401, { error: '관리자 인증이 필요합니다.' });
      if (p === '/api/submissions' && req.method === 'GET') {
        return send(res, 200, { items: db.items.slice().reverse() });
      }
      const m = p.match(/^\/api\/submissions\/([^/]+)$/);
      if (m && req.method === 'DELETE') {
        const before = db.items.length;
        db.items = db.items.filter(x => x.id !== m[1]);
        if (db.items.length === before) return send(res, 404, { error: 'not found' });
        saveDB();
        return send(res, 200, { ok: true });
      }
    }

    if (p.startsWith('/api/')) return send(res, 404, { error: 'not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
    return serveStatic(req, res, p);
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\n  🚨 한국저작권보호원 모의신고 훈련 서버가 시작되었습니다.\n');
  console.log(`  - 이 PC에서 접속     : http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  - 다른 PC에서 접속   : http://${ip}:${PORT}`));
  console.log(`  - 관리자 페이지      : http://localhost:${PORT}${ADMIN_PATH}`);
  console.log(`  - 데이터 저장 위치   : ${DATA_FILE}\n`);
  if (!process.env.ADMIN_PASSWORD) console.warn('  ⚠ ADMIN_PASSWORD 환경변수가 없어 기본 비밀번호(kcopa1234)를 사용 중입니다. 운영 전 반드시 변경하세요.\n');
});
