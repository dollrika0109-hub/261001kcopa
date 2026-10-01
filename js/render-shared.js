/* =========================================================================
 * 공통 렌더링 유틸 (게임 화면 + 관리자 화면에서 함께 사용)
 * ========================================================================= */
window.Render = (function () {
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return MAP[c]; }); }
  function rich(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }
  function paragraphs(arr) { return (arr || []).map(function (p) { return '<p>' + rich(p) + '</p>'; }).join(''); }

  function fileIcon(type) {
    return { kv: '🧾', chat: '💬', table: '📊', text: '📄' }[type] || '📄';
  }

  function material(m) {
    var cap = m.caption ? '<p class="mat-caption">' + rich(m.caption) + '</p>' : '';
    switch (m.type) {
      case 'kv':
        return '<div class="mat mat-kv">' + cap + '<dl>' + m.rows.map(function (r) {
          return '<div class="kv-row"><dt>' + esc(r[0]) + '</dt><dd>' + rich(r[1]) + '</dd></div>';
        }).join('') + '</dl></div>';
      case 'chat':
        return '<div class="mat mat-chat">' + cap + '<div class="chat-window"><div class="chat-head">💬 ' + esc(m.chatTitle || '메신저') +
          '</div><div class="chat-body">' + m.messages.map(function (x) {
            return '<div class="msg ' + (x.me ? 'me' : '') + '">' + (x.me ? '' : '<span class="who">' + esc(x.from) + '</span>') +
              '<div class="bubble">' + rich(x.text) + '</div></div>';
          }).join('') + '</div></div></div>';
      case 'table':
        var hl = m.highlightRows || [];
        return '<div class="mat mat-table">' + cap + '<div class="table-scroll"><table><thead><tr>' +
          m.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          m.rows.map(function (r, i) {
            return '<tr class="' + (hl.indexOf(i) > -1 ? 'hl' : '') + '">' + r.map(function (c) { return '<td>' + rich(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div></div>';
      default:
        return '<div class="mat mat-text">' + cap + paragraphs(m.paragraphs) + '</div>';
    }
  }

  function allFields(form) {
    return form.sections.reduce(function (a, s) { return a.concat(s.fields); }, []);
  }
  function isVisible(fd, answers) {
    if (!fd.showIf) return true;
    return (answers || {})[fd.showIf.field] === fd.showIf.equals;
  }
  function isRequired(fd) { return fd.required !== false; }
  function isFilled(fd, v) {
    if (fd.type === 'checkbox' || fd.type === 'attachments') return Array.isArray(v) && v.length >= (fd.min || 1);
    return typeof v === 'string' && v.trim() !== '';
  }

  function displayValue(fd, v, caseObj) {
    if (fd.type === 'attachments') {
      var arr = Array.isArray(v) ? v : [];
      if (!arr.length) return '<span class="empty">(선택 안 함)</span>';
      var mats = (caseObj && caseObj.materials) || [];
      return '<ul class="doc-files">' + arr.map(function (id) {
        var m = mats.filter(function (x) { return x.id === id; })[0];
        return '<li>📎 ' + esc(m ? m.label : id) + '</li>';
      }).join('') + '</ul>';
    }
    if (fd.type === 'checkbox' || fd.type === 'radio') {
      var sel = Array.isArray(v) ? v : (v ? [v] : []);
      return '<div class="doc-opts ' + (fd.layout === 'stack' ? 'stack' : '') + '">' + fd.options.map(function (o) {
        var on = sel.indexOf(o) > -1;
        return '<span class="doc-opt ' + (on ? 'on' : '') + '">' + (on ? '☑' : '☐') + ' ' + esc(o) + '</span>';
      }).join('') + '</div>';
    }
    return v && String(v).trim() ? rich(v) : '<span class="empty">(미작성)</span>';
  }

  /** 작성된 신고서를 문서(표) 형태로 출력 */
  function formDoc(form, answers, caseObj, opts) {
    opts = opts || {};
    answers = answers || {};
    return '<div class="doc">' + (opts.stamp ? '<div class="doc-stamp">' + esc(opts.stamp) + '</div>' : '') +
      '<h3 class="doc-title">' + esc(form.title) + '</h3>' +
      '<table class="doc-table">' + form.sections.map(function (sec) {
        var rows = sec.fields.filter(function (fd) { return isVisible(fd, answers); });
        return '<tr class="doc-sec"><th colspan="2">' + esc(sec.title) + '</th></tr>' + rows.map(function (fd) {
          var label = fd.docLabel || fd.label;
          if (sec.fields.length === 1 && label === sec.title) label = '내용';
          return '<tr><th>' + esc(label) + '</th><td>' + displayValue(fd, answers[fd.id], caseObj) + '</td></tr>';
        }).join('');
      }).join('') + '</table></div>';
  }

  /** 관리자 CSV 등에 쓰는 평문 요약 */
  function plainAnswers(form, answers, caseObj) {
    answers = answers || {};
    return allFields(form).filter(function (fd) { return isVisible(fd, answers); }).map(function (fd) {
      var v = answers[fd.id];
      if (fd.type === 'attachments') {
        v = (v || []).map(function (id) {
          var m = ((caseObj && caseObj.materials) || []).filter(function (x) { return x.id === id; })[0];
          return m ? m.label : id;
        }).join(', ');
      } else if (Array.isArray(v)) v = v.join(', ');
      return '[' + (fd.docLabel || fd.label) + '] ' + (v || '');
    }).join(' | ');
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '. ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function formatDuration(sec) {
    if (sec == null || isNaN(sec)) return '-';
    sec = Math.round(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m ? m + '분 ' + s + '초' : s + '초';
  }

  return {
    esc: esc, rich: rich, paragraphs: paragraphs, fileIcon: fileIcon, material: material,
    allFields: allFields, isVisible: isVisible, isRequired: isRequired, isFilled: isFilled,
    displayValue: displayValue, formDoc: formDoc, plainAnswers: plainAnswers,
    formatDateTime: formatDateTime, formatDuration: formatDuration
  };
})();
