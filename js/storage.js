/* =========================================================================
 * 저장소 어댑터 (Storage Adapter)
 *
 * 게임/관리자 화면은 아래 공통 인터페이스만 사용합니다.
 *   Store.submit(submission)  -> { receiptNo, id, mode, pending? }   (절대 throw 하지 않음)
 *   Store.getMode()           -> 'local' | 'server' | 'supabase'
 *   Store.adminLogin(cred)    -> true/false
 *   Store.adminLogout()
 *   Store.isAdminLoggedIn()
 *   Store.list()              -> submission[] (최신순)
 *   Store.remove(id)
 *
 * 새 백엔드를 붙이려면 adapters에 { submit, list, remove, login, logout } 를 구현해 추가하세요.
 * 원격 저장에 실패하면 이 브라우저에 임시 저장(pending)하고, 다음 접속 시 자동 재전송합니다.
 * ========================================================================= */
window.Store = (function () {
  var CFG = window.APP_CONFIG.storage;
  var ADMIN_CFG = window.APP_CONFIG.admin;
  var KEY = { subs: 'mockreport.submissions', seq: 'mockreport.seq', pending: 'mockreport.pending', session: 'mockreport.adminSession' };
  var mode = null;

  /* ---------------- helpers ---------------- */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function base() { return (CFG.serverBaseUrl || '').replace(/\/+$/, ''); }
  function pad3(n) { return String(n).padStart(3, '0'); }

  function uuid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) {} }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  /** 순수 JS SHA-256 (file:// 환경에서도 동작) */
  function sha256(str) {
    function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
    var K = [], H = [], n = 2, cnt = 0;
    function isPrime(x) { for (var i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; }
    while (cnt < 64) {
      if (isPrime(n)) {
        if (cnt < 8) H[cnt] = (Math.pow(n, 1 / 2) % 1) * 4294967296 | 0;
        K[cnt] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0;
        cnt++;
      }
      n++;
    }
    var bytes = new TextEncoder().encode(str), l = bytes.length;
    var total = Math.ceil((l + 9) / 64) * 64;
    var m = new Uint8Array(total); m.set(bytes); m[l] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(l * 8 / 4294967296)); dv.setUint32(total - 4, (l * 8) >>> 0);
    var w = new Array(64);
    for (var i = 0; i < total; i += 64) {
      for (var t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4) | 0;
      for (t = 16; t < 64; t++) {
        var a0 = w[t - 15], b0 = w[t - 2];
        w[t] = (w[t - 16] + (ror(a0, 7) ^ ror(a0, 18) ^ (a0 >>> 3)) + w[t - 7] + (ror(b0, 17) ^ ror(b0, 19) ^ (b0 >>> 10))) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        var t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [(H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0, (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0];
    }
    return H.map(function (x) { return (x >>> 0).toString(16).padStart(8, '0'); }).join('');
  }

  /* ---------------- local adapter (localStorage) ---------------- */
  var local = {
    nextReceipt: function () {
      var year = new Date().getFullYear();
      var seq = lsGet(KEY.seq, {});
      seq[year] = (seq[year] || 0) + 1;
      lsSet(KEY.seq, seq);
      return year + '-MOCK-' + pad3(seq[year]);
    },
    submit: function (sub) {
      var rec = Object.assign({}, sub, { id: sub.id || uuid(), receiptNo: local.nextReceipt(), storedAt: new Date().toISOString() });
      var all = lsGet(KEY.subs, []);
      all.push(rec);
      lsSet(KEY.subs, all);
      return Promise.resolve({ id: rec.id, receiptNo: rec.receiptNo });
    },
    list: function () { return Promise.resolve(lsGet(KEY.subs, []).slice().reverse()); },
    remove: function (id) {
      lsSet(KEY.subs, lsGet(KEY.subs, []).filter(function (s) { return s.id !== id; }));
      return Promise.resolve(true);
    },
    login: function (cred) {
      var ok = sha256(cred.password || '') === ADMIN_CFG.localPasswordSha256;
      if (ok) ssSet(KEY.session, 'local');
      return Promise.resolve(ok);
    },
    logout: function () { ssSet(KEY.session, null); return Promise.resolve(); }
  };

  /* ---------------- server adapter (동봉된 Node 서버) ---------------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = ssGet(KEY.session);
    if (token && token !== 'local') headers.Authorization = 'Bearer ' + token;
    return fetch(base() + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var err = new Error(j.error || ('HTTP ' + r.status)); err.status = r.status; throw err; }
          return j;
        });
      });
  }
  var server = {
    submit: function (sub) { return api('/api/submissions', { method: 'POST', body: sub }); },
    list: function () { return api('/api/submissions').then(function (j) { return j.items || []; }); },
    remove: function (id) { return api('/api/submissions/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () { return true; }); },
    login: function (cred) {
      return api('/api/admin/login', { method: 'POST', body: { password: cred.password } })
        .then(function (j) { ssSet(KEY.session, j.token); return true; })
        .catch(function () { return false; });
    },
    logout: function () { var p = api('/api/admin/logout', { method: 'POST' }).catch(function () {}); ssSet(KEY.session, null); return p; }
  };

  /* ---------------- supabase adapter ---------------- */
  var sbClient = null;
  function loadSupabase() {
    if (sbClient) return Promise.resolve(sbClient);
    return new Promise(function (resolve, reject) {
      function make() {
        try { sbClient = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey); resolve(sbClient); }
        catch (e) { reject(e); }
      }
      if (window.supabase && window.supabase.createClient) return make();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = make; s.onerror = function () { reject(new Error('Supabase 라이브러리를 불러오지 못했습니다.')); };
      document.head.appendChild(s);
    });
  }
  var supa = {
    submit: function (sub) {
      return loadSupabase().then(function (c) {
        return c.rpc(CFG.supabase.submitRpc, { p: sub }).then(function (res) {
          if (res.error) throw res.error;
          return { id: sub.id, receiptNo: res.data };
        });
      });
    },
    list: function () {
      return loadSupabase().then(function (c) {
        return c.from(CFG.supabase.table).select('id, receipt_no, payload, submitted_at').order('submitted_at', { ascending: false })
          .then(function (res) {
            if (res.error) throw res.error;
            return (res.data || []).map(function (r) {
              return Object.assign({}, r.payload, { id: r.id, receiptNo: r.receipt_no, storedAt: r.submitted_at });
            });
          });
      });
    },
    remove: function (id) {
      return loadSupabase().then(function (c) {
        return c.from(CFG.supabase.table).delete().eq('id', id).then(function (res) { if (res.error) throw res.error; return true; });
      });
    },
    login: function (cred) {
      return loadSupabase().then(function (c) {
        return c.auth.signInWithPassword({ email: cred.email, password: cred.password }).then(function (res) {
          if (res.error) return false;
          ssSet(KEY.session, 'supabase');
          return true;
        });
      }).catch(function () { return false; });
    },
    logout: function () { ssSet(KEY.session, null); return loadSupabase().then(function (c) { return c.auth.signOut(); }).catch(function () {}); }
  };

  /* ---------------- google sheets adapter (Apps Script 웹 앱) ---------------- */
  // Content-Type을 text/plain으로 보내야 브라우저 사전요청(CORS preflight) 없이 Apps Script로 전송됩니다.
  function gs(payload) {
    return fetch(CFG.googleSheets.webAppUrl, {
      method: 'POST', redirect: 'follow', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j && j.error) { var err = new Error(j.error); if (j.error === 'unauthorized') err.status = 401; throw err; }
      return j;
    });
  }
  var GS_PW = 'mockreport.gsPw';
  var gsheet = {
    submit: function (sub) { return gs({ action: 'submit', data: sub }); },
    list: function () { return gs({ action: 'list', password: ssGet(GS_PW) || '' }).then(function (j) { return j.items || []; }); },
    remove: function (id) { return gs({ action: 'delete', id: id, password: ssGet(GS_PW) || '' }).then(function () { return true; }); },
    login: function (cred) {
      return gs({ action: 'login', password: cred.password || '' }).then(function () {
        ssSet(GS_PW, cred.password); ssSet(KEY.session, 'gsheet'); return true;
      }).catch(function () { return false; });
    },
    logout: function () { ssSet(GS_PW, null); ssSet(KEY.session, null); return Promise.resolve(); }
  };

  var adapters = { local: local, server: server, supabase: supa, gsheet: gsheet };

  /* ---------------- mode resolve ---------------- */
  var modePromise = null;
  function resolveMode() {
    if (modePromise) return modePromise;
    modePromise = new Promise(function (resolve) {
      var m = CFG.mode || 'auto';
      if (m === 'supabase' && !(CFG.supabase.url && CFG.supabase.anonKey)) {
        console.warn('[Store] Supabase 설정이 비어 있어 local 모드로 동작합니다.');
        m = 'local';
      }
      if (m === 'gsheet' && !CFG.googleSheets.webAppUrl) {
        console.warn('[Store] 구글 시트 웹 앱 URL이 비어 있어 local 모드로 동작합니다.');
        m = 'local';
      }
      if (m !== 'auto') { mode = m; return resolve(mode); }
      if (!/^https?:$/.test(location.protocol)) { mode = 'local'; return resolve(mode); }
      var timer = setTimeout(function () { mode = 'local'; resolve(mode); }, 2500);
      fetch(base() + '/api/health', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { clearTimeout(timer); mode = (j && j.ok && j.app === 'mock-report') ? 'server' : 'local'; resolve(mode); })
        .catch(function () { clearTimeout(timer); mode = 'local'; resolve(mode); });
    });
    return modePromise;
  }

  /* ---------------- pending queue ---------------- */
  function flushPending() {
    return resolveMode().then(function (m) {
      if (m === 'local') return;
      var q = lsGet(KEY.pending, []);
      if (!q.length) return;
      var remaining = [];
      return q.reduce(function (p, sub) {
        return p.then(function () {
          return adapters[m].submit(sub).catch(function () { remaining.push(sub); });
        });
      }, Promise.resolve()).then(function () { lsSet(KEY.pending, remaining); });
    }).catch(function () {});
  }

  /* ---------------- public API ---------------- */
  function submit(sub) {
    sub = Object.assign({ id: uuid() }, sub);
    return resolveMode().then(function (m) {
      return adapters[m].submit(sub).then(function (res) {
        return { id: res.id || sub.id, receiptNo: res.receiptNo, mode: m };
      });
    }).catch(function (err) {
      console.warn('[Store] 원격 저장 실패, 로컬 임시 저장:', err);
      return local.submit(Object.assign({}, sub, { syncStatus: 'pending' })).then(function (res) {
        var q = lsGet(KEY.pending, []);
        q.push(Object.assign({}, sub, { localReceiptNo: res.receiptNo }));
        lsSet(KEY.pending, q);
        return { id: res.id, receiptNo: res.receiptNo, mode: 'local', pending: true };
      });
    });
  }

  function withMode(fn) { return resolveMode().then(function (m) { return fn(adapters[m], m); }); }

  // 페이지 로드 시 미전송 데이터 재전송 시도
  setTimeout(flushPending, 1500);

  return {
    submit: submit,
    getMode: resolveMode,
    list: function () { return withMode(function (a) { return a.list(); }); },
    remove: function (id) { return withMode(function (a) { return a.remove(id); }); },
    adminLogin: function (cred) { return withMode(function (a) { return a.login(cred || {}); }); },
    adminLogout: function () { return withMode(function (a) { return a.logout(); }); },
    isAdminLoggedIn: function () { return !!ssGet(KEY.session); },
    pendingCount: function () { return lsGet(KEY.pending, []).length; },
    flushPending: flushPending,
    sha256: sha256,
    uuid: uuid
  };
})();
