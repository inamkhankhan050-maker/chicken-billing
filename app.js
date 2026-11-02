/* ============================================================
   UI layer. All maths goes through window.BillingCalc (calc.js).
   ============================================================ */
(function () {
  'use strict';
  var C = window.BillingCalc;
  var STORE_KEY = 'chickenBilling.v1';
  var MAX_ROWS = 500;
  var FIELDS = ['name', 'pieces', 'kg', 'jaal', 'rate', 'oldBal', 'cash', 'online'];

  var SAMPLE = [
    ['Customer 01', 50, 193, 90], ['Sharma Chicken Centre', 120, 462, 92], ['Al-Noor Meat Shop', 80, 310, 90],
    ['Royal Hotel & Caterers', 200, 786, 88], ['Gupta Poultry Point', 65, 248, 91], ['Fresh Choice Chicken', 40, 151, 92],
    ['Khan Brothers', 150, 579, 89], ['City Dhaba', 30, 112, 93], ['New Delhi Biryani House', 95, 368, 90], ['Rahman Chicken Corner', 55, 212, 91]
  ];

  var $ = function (id) { return document.getElementById(id); };
  var uid = function () { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  var newRow = function (o) { o = o || {}; return { id: uid(), name: o.name || '', pieces: o.pieces != null ? String(o.pieces) : '', kg: o.kg != null ? String(o.kg) : '', rate: o.rate != null ? String(o.rate) : '', customRate: !!o.customRate, jaal: o.jaal != null ? String(o.jaal) : '', customJaal: !!o.customJaal, oldBal: o.oldBal != null ? String(o.oldBal) : '', cash: o.cash != null ? String(o.cash) : '', online: o.online != null ? String(o.online) : '' }; };

  var state = { rows: [], defaultRate: '', defaultJaal: '', sheetNo: 1, selectedId: null };

  // ---------- Persistence (local only, never sent anywhere) ----------
  var storage = (function () {
    try { var k = '__t'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return window.localStorage; }
    catch (e) { return null; }
  })();
  function load() {
    if (!storage) return null;
    try { var d = JSON.parse(storage.getItem(STORE_KEY) || 'null'); return d && Array.isArray(d.rows) ? d : null; } catch (e) { return null; }
  }
  var saveTimer = null;
  function save() {
    if (!storage) return;
    clearTimeout(saveTimer);
    $('saveText').textContent = 'Saving…';
    saveTimer = setTimeout(function () {
      try {
        storage.setItem(STORE_KEY, JSON.stringify({ rows: state.rows, defaultRate: state.defaultRate, defaultJaal: state.defaultJaal, sheetNo: state.sheetNo, savedAt: new Date().toISOString() }));
        $('saveText').textContent = 'Saved on this device';
      } catch (e) { $('saveText').textContent = 'Not saved (storage full)'; $('saveState').classList.add('off'); }
    }, 250);
  }

  // ---------- Row DOM ----------
  var ICON_DEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  var ICON_WA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';
  function rowHTML(row) {
    function inp(f, cls, ph, mode) {
      return '<input class="cell-in ' + cls + '" data-f="' + f + '" inputmode="' + mode + '" autocomplete="off" aria-label="' + ph + '">';
    }
    return '' +
      '<div class="c idx"></div>' +
      '<div class="c name">' + inp('name', 'name-in', 'Enter customer name', 'text') + '<span class="status" hidden></span></div>' +
      '<div class="c inp pcs"><span class="m-lbl">Pieces</span>' + inp('pieces', 'n', 'Pieces', 'numeric') + '</div>' +
      '<div class="c inp kg"><span class="m-lbl">Total KG</span>' + inp('kg', 'n', 'KG', 'decimal') + '</div>' +
      '<div class="c inp jaal"><span class="m-lbl">Jaal KG</span>' + inp('jaal', 'n', 'Jaal', 'decimal') + '</div>' +
      '<div class="c auto avg"><span class="m-lbl">Average</span><span class="v" data-o="avg"></span></div>' +
      '<div class="c inp rate"><span class="m-lbl">Rate / KG</span>' + inp('rate', 'n', 'Rate', 'decimal') + '</div>' +
      '<div class="c auto basic"><span class="m-lbl">Basic</span><span class="v" data-o="basic"></span></div>' +
      '<div class="c auto samiti"><span class="m-lbl">Samiti</span><span class="v" data-o="samiti"></span></div>' +
      '<div class="c auto labour"><span class="m-lbl">Labour</span><span class="lab-wrap"><span class="adj" data-o="adj" hidden></span><span class="v" data-o="labour"></span></span></div>' +
      '<div class="c fin"><span class="v" data-o="final"></span></div>' +
      '<div class="c inp old"><span class="m-lbl">Pichla Bal (B)</span>' + inp('oldBal', 'n', 'Bal', 'decimal') + '</div>' +
      '<div class="c inp cash"><span class="m-lbl">Rec Cash</span>' + inp('cash', 'n', 'Cash', 'decimal') + '</div>' +
      '<div class="c inp onl"><span class="m-lbl">Rec Online</span>' + inp('online', 'n', 'Online', 'decimal') + '</div>' +
      '<div class="c due"><span class="m-lbl">Balance Baaki</span><span class="v" data-o="due"></span></div>' +
      '<div class="c act"><button class="wa1" data-wa title="Is customer ka bill WhatsApp par bhejo" aria-label="WhatsApp PDF">' + ICON_WA + '</button><button class="del" data-del title="Delete row" aria-label="Delete row">' + ICON_DEL + '</button></div>' +
      '<div class="m-meta" data-o="meta"></div>';
  }
  function buildRow(row) {
    var el = document.createElement('div');
    el.className = 'r';
    el.setAttribute('role', 'row');
    el.dataset.id = row.id;
    el.innerHTML = rowHTML(row);
    FIELDS.forEach(function (f) { el.querySelector('[data-f="' + f + '"]').value = row[f]; });
    return el;
  }
  function renderAll() {
    var body = $('body');
    body.innerHTML = '';
    var frag = document.createDocumentFragment();
    state.rows.forEach(function (r) { frag.appendChild(buildRow(r)); });
    body.appendChild(frag);
    state.rows.forEach(function (r) { updateRow(r); });
    renumber(); applySearch(); updateTotals(); renderPreview();
  }
  function rowEl(id) { return $('body').querySelector('.r[data-id="' + id + '"]'); }
  function renumber() {
    var n = 0;
    $('body').querySelectorAll('.r').forEach(function (el) { el.querySelector('.idx').textContent = ++n; });
  }

  function updateRow(row) {
    var el = rowEl(row.id); if (!el) return;
    var c = C.computeRow(row);
    var out = function (k) { return el.querySelector('[data-o="' + k + '"]'); };
    ['pieces', 'kg', 'jaal', 'rate'].forEach(function (f) {
      var i = el.querySelector('[data-f="' + f + '"]');
      i.classList.toggle('err', !!c.errors[f]);
      i.title = c.errors[f] || '';
    });
    var st = el.querySelector('.status');
    updateLedgerCell(row, el, c);
    el.classList.toggle('blank', c.status === 'empty' && !rowLedger(row, c));
    var vv = C.validateRow(row), av = C.averageKg(vv.netGrams, vv.pieces);
    setV(out('avg'), av ? av + ' kg' : '—', !av);
    if (c.result && c.status === 'valid') {
      var r = c.result;
      setV(out('basic'), C.formatINR(r.basic));
      setV(out('samiti'), C.formatINR(r.samiti));
      setV(out('labour'), C.formatINR(r.labourAdjusted, { decimals: 2 }));
      setV(out('final'), C.formatINR(r.final));
      var a = out('adj');
      if (r.adjustment > 0) { a.hidden = false; a.textContent = '+' + C.formatINR(r.adjustment, { decimals: 2 }).replace('₹', '₹'); a.title = 'Original ' + C.formatINR(r.labourOriginal, { decimals: 2 }) + ' + round-off ' + C.formatINR(r.adjustment, { decimals: 2 }); }
      else a.hidden = true;
      out('meta').textContent = '';
      st.hidden = true;
    } else {
      ['basic', 'samiti', 'labour', 'final'].forEach(function (k) { setV(out(k), '—', true); });
      out('adj').hidden = true;
      out('meta').textContent = c.status === 'incomplete' ? 'Fill name, pieces, KG and rate to calculate' : c.status === 'empty' ? '' : (c.result && c.result.warning) || 'Check the highlighted values';
      if (c.status === 'incomplete' || c.status === 'invalid' || c.status === 'warning') {
        st.hidden = false; st.className = 'status ' + c.status;
        st.textContent = c.status === 'incomplete' ? 'Incomplete' : c.status === 'warning' ? 'Warning' : 'Invalid';
        st.title = c.status === 'warning' ? c.result.warning : Object.values(c.errors).join('; ');
      } else st.hidden = true;
    }
  }
  function rowLedger(row, c) {
    c = c || C.computeRow(row);
    var billBlank = !String(row.pieces).trim() && !String(row.kg).trim();
    if (c.status === 'valid') return C.ledger(row, c.result.final);
    if (billBlank && row.name.trim()) { var l = C.ledger(row, 0); return l.any ? l : null; }
    return null;
  }
  function dueText(p) { return p < 0 ? 'Adv ' + C.formatINR(-p, { decimals: p % 100 ? 2 : 0 }) : C.formatINR(p, { decimals: p % 100 ? 2 : 0 }); }
  function updateLedgerCell(row, el, c) {
    var l = C.ledger(row, 0);
    ['oldBal', 'cash', 'online'].forEach(function (f) { var i = el.querySelector('[data-f="' + f + '"]'); i.classList.toggle('err', !!l.errors[f]); i.title = l.errors[f] || ''; });
    var L = rowLedger(row, c), o = el.querySelector('[data-o="due"]');
    if (L && L.ok) { setV(o, dueText(L.due)); o.classList.toggle('adv', L.due < 0); }
    else { setV(o, '—', true); o.classList.remove('adv'); }
  }
  function setV(el, text, dash) { el.textContent = text; el.classList.toggle('dash', !!dash); }

  // ---------- Totals ----------
  function updateTotals() {
    var t = C.computeTotals(state.rows);
    var map = {
      tCust: C.formatInt(t.customers), sCust: C.formatInt(t.customers),
      tPcs: C.formatInt(t.pieces), sPcs: C.formatInt(t.pieces), fPcs: C.formatInt(t.pieces),
      tKg: C.formatKg(t.grams), sKg: C.formatKg(t.grams), fKg: C.formatKg(t.grams),
      tBasic: C.formatINR(t.basic), sBasic: C.formatINR(t.basic), fBasic: C.formatINR(t.basic),
      tSamiti: C.formatINR(t.samiti), sSamiti: C.formatINR(t.samiti), fSamiti: C.formatINR(t.samiti),
      tLabour: C.formatINR(t.labour), sLabour: C.formatINR(t.labour), fLabour: C.formatINR(t.labour),
      tGrand: C.formatINR(t.grand), sGrand: C.formatINR(t.grand), mGrand: C.formatINR(t.grand), fFinal: C.formatINR(t.grand)
    };
    var lo = 0, lc = 0, ln = 0, ld = 0;
    state.rows.forEach(function (r) { var L = rowLedger(r); if (L && L.ok) { lo += L.oldBal; lc += L.cash; ln += L.online; ld += L.due; } });
    var m2 = function (p) { return C.formatINR(p, { decimals: p % 100 ? 2 : 0 }); };
    map.fOld = m2(lo); map.fCash = m2(lc); map.fOnline = m2(ln); map.fDue = dueText(ld);
    map.tRec = m2(lc + ln); map.sRec = m2(lc + ln); map.tRecSplit = 'Cash ' + m2(lc) + ' · Online ' + m2(ln);
    map.tDue = dueText(ld); map.sDue = dueText(ld);
    var tav = C.averageKg(t.net, t.pieces) || '—';
    map.fJaal = C.formatKg(t.jaal);
    map.tAvg = tav; map.sAvg = tav; map.fAvg = tav === '—' ? '—' : tav + ' kg';
    Object.keys(map).forEach(function (k) { $(k).textContent = map[k]; });
    $('tWords').textContent = $('sWords').textContent = C.amountInWords(t.grand);
    var extra = [];
    if (t.incomplete) extra.push(t.incomplete + ' incomplete');
    if (t.invalid) extra.push(t.invalid + ' need checking');
    $('metaCount').textContent = t.customers + ' customer' + (t.customers === 1 ? '' : 's') + ' calculated · ' + state.rows.length + ' rows' + (extra.length ? ' · ' + extra.join(', ') + ' (not included in totals)' : '');
    return t;
  }

  // ---------- Calculation preview ----------
  function renderPreview() {
    var p = $('preview');
    var row = state.rows.filter(function (r) { return r.id === state.selectedId; })[0] ||
              state.rows.filter(function (r) { return C.computeRow(r).status === 'valid'; })[0];
    $('body').querySelectorAll('.r.sel').forEach(function (e) { e.classList.remove('sel'); });
    if (!row) { p.innerHTML = '<h3>Calculation Preview</h3><p class="sub">Select a row to see its breakdown</p><p class="footnote">Enter a customer\'s pieces, weight and rate. The breakdown appears here.</p>'; return; }
    var el = rowEl(row.id); if (el) el.classList.add('sel');
    var c = C.computeRow(row);
    var name = row.name.trim() || 'Unnamed customer';
    var idx = state.rows.indexOf(row) + 1;
    var h = '<h3>Calculation Preview</h3><p class="sub">' + esc(name) + ' · row ' + idx + '</p>';
    if (!c.result) {
      h += '<p class="footnote">' + (c.status === 'invalid' ? 'Some values are invalid: ' + esc(Object.values(c.errors).join('; ')) + '.' : 'This row is incomplete. Fill customer name, pieces, total KG and rate.') + '</p>';
      p.innerHTML = h; return;
    }
    var r = c.result;
    var gkg = C.formatKg(c.grams), kg = C.formatKg(c.netGrams), rate = C.formatINR(c.ratePaise);
    h += rc('Pieces', C.formatInt(c.pieces)) + rc('Total Weight', gkg + ' kg') + (c.jaalGrams ? rc('Jaal Weight', '− ' + C.formatKg(c.jaalGrams) + ' kg') + rc('Net Weight<small>' + gkg + ' − ' + C.formatKg(c.jaalGrams) + '</small>', kg + ' kg') : '') + rc('Average Size<small>' + kg + ' kg ÷ ' + C.formatInt(c.pieces) + ' pcs</small>', C.averageKg(c.netGrams, c.pieces) + ' kg / pc') + rc('Rate', rate + ' / kg') +
      rc('Basic Amount<small>' + kg + ' × ' + rate + '</small>', C.formatINR(r.basic)) +
      rc('Samiti Charge<small>1% of basic, rounded down</small>', C.formatINR(r.samiti)) +
      rc('Original Labour<small>' + C.labourRuleText(c.pieces, r.labourDivisor) + '</small>', C.formatINR(r.labourOriginal, { decimals: 2 })) +
      rc('Labour Adjustment<span class="badge">Round to ₹10</span>', '+ ' + C.formatINR(r.adjustment, { decimals: 2 })) +
      rc('Adjusted Labour', C.formatINR(r.labourAdjusted, { decimals: 2 })) +
      '<div class="rc big"><span class="k">Final Amount</span><span class="val">' + (r.final == null ? '—' : C.formatINR(r.final)) + '</span></div>' +
      (r.warning ? '<div class="warn">' + esc(r.warning) + '</div>' : '') +
      ledgerHTML(C.ledger(row, r.final)) +
      '<p class="footnote">Labour is adjusted upward only, so the final bill lands on a multiple of ₹10. Basic and Samiti never change.</p>';
    p.innerHTML = h;
  }
  function ledgerHTML(L) {
    if (!L || !L.any || !L.ok) return '';
    var m2 = function (p) { return C.formatINR(p, { decimals: p % 100 ? 2 : 0 }); };
    return rc('Pichla Balance (B)', '+ ' + m2(L.oldBal)) + rc('Total Due<small>aaj ka bill + pichla</small>', m2(L.due + L.received)) +
      rc('Rec Cash', '− ' + m2(L.cash)) + rc('Rec Online', '− ' + m2(L.online)) +
      '<div class="rc big due-r"><span class="k">Balance Baaki</span><span class="val">' + dueText(L.due) + '</span></div>';
  }
  function rc(k, v) { return '<div class="rc"><span class="k">' + k + '</span><span class="val">' + v + '</span></div>'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

  // ---------- Actions ----------
  function addRows(n, focus) {
    var room = MAX_ROWS - state.rows.length;
    if (room <= 0) { toast('Maximum of ' + MAX_ROWS + ' rows per bill reached'); return; }
    n = Math.min(n, room);
    var body = $('body'), first = null;
    for (var i = 0; i < n; i++) {
      var r = newRow({ rate: state.defaultRate, jaal: state.defaultJaal });
      state.rows.push(r);
      var el = buildRow(r); body.appendChild(el); updateRow(r);
      if (!first) first = el;
    }
    renumber(); updateTotals(); save();
    if (focus && first) { first.querySelector('[data-f="name"]').focus(); if (first.scrollIntoView) first.scrollIntoView({ block: 'nearest' }); }
    if (n > 1) toast(n + ' rows added');
  }
  function deleteRow(id) {
    var i = state.rows.findIndex(function (r) { return r.id === id; });
    if (i < 0) return;
    var removed = state.rows.splice(i, 1)[0];
    var el = rowEl(id); if (el) el.remove();
    if (state.selectedId === id) state.selectedId = null;
    renumber(); updateTotals(); renderPreview(); save();
    toast('Deleted ' + (removed.name.trim() || 'row ' + (i + 1)));
  }
  function clearAll() {
    state.rows = []; state.selectedId = null; state.sheetNo += 1;
    $('sheetNo').textContent = '#' + state.sheetNo;
    $('search').value = '';
    renderAll(); addRows(10, false); save();
    toast('Bill cleared. New sheet started.');
  }

  // ---------- Export ----------
  function exportRows() {
    var head = ['S.No', 'Customer Name', 'Pieces', 'Total KG', 'Jaal KG', 'Net KG', 'Average KG / Piece', 'Rate / KG', 'Basic Amount', 'Samiti Charge', 'Original Labour', 'Labour Adjustment', 'Labour Charge', 'Final Amount', 'Pichla Balance', 'Rec Cash', 'Rec Online', 'Balance Baaki'];
    var rows = [], n = 0, P = C.paiseToPlain, lo = 0, lc = 0, ln = 0, ld = 0;
    state.rows.forEach(function (row) {
      var c = C.computeRow(row), L = rowLedger(row, c);
      if (L && !L.ok) L = null;
      var led = L ? [P(L.oldBal), P(L.cash), P(L.online), P(L.due)] : ['', '', '', ''];
      if (L) { lo += L.oldBal; lc += L.cash; ln += L.online; ld += L.due; }
      if (c.status === 'valid') {
        var r = c.result;
        rows.push([++n, row.name.trim(), c.pieces, C.formatKg(c.grams).replace(/,/g, ''), C.formatKg(c.jaalGrams).replace(/,/g, ''), C.formatKg(c.netGrams).replace(/,/g, ''), C.averageKg(c.netGrams, c.pieces) || '', P(c.ratePaise), P(r.basic), P(r.samiti), P(r.labourOriginal), P(r.adjustment), P(r.labourAdjusted), P(r.final)].concat(led));
      } else if (L) {
        rows.push([++n, row.name.trim(), '', '', '', '', '', '', '', '', '', '', '', ''].concat(led));
      }
    });
    var t = C.computeTotals(state.rows);
    var total = ['', 'TOTAL', t.pieces, C.formatKg(t.grams).replace(/,/g, ''), C.formatKg(t.jaal).replace(/,/g, ''), C.formatKg(t.net).replace(/,/g, ''), C.averageKg(t.net, t.pieces) || '', '', P(t.basic), P(t.samiti), '', '', P(t.labour), P(t.grand), P(lo), P(lc), P(ln), P(ld)];
    return { head: head, rows: rows, total: total, count: n };
  }
  function fileStamp() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function download(name, mime, content) {
    try {
      var blob = new Blob([content], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      toast('Downloaded ' + name);
    } catch (e) { toast('Download blocked in this window. Use the offline app file.'); }
  }
  function exportCSV() {
    var d = exportRows(); if (!d.count) { toast('No complete customer rows to export'); return; }
    var q = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [d.head].concat(d.rows, [d.total]).map(function (r) { return r.map(q).join(','); });
    download('chicken-bill-' + fileStamp() + '.csv', 'text/csv;charset=utf-8', '\uFEFF' + lines.join('\r\n'));
  }
  function exportExcel() {
    var d = exportRows(); if (!d.count) { toast('No complete customer rows to export'); return; }
    var x = function (v) { return String(v).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); };
    var cell = function (v, style, num) {
      if (v === '' || v == null) return '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + '/>';
      return '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + '><Data ss:Type="' + (num ? 'Number' : 'String') + '">' + x(v) + '</Data></Cell>';
    };
    var money = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    var body = d.rows.map(function (r) {
      return '<Row>' + r.map(function (v, i) { return cell(v, money.indexOf(i) >= 0 ? (i === 13 || i === 17 ? 'fin' : 'money') : (i >= 3 && i <= 6 ? 'kg' : null), i !== 1); }).join('') + '</Row>';
    }).join('');
    var tot = '<Row>' + d.total.map(function (v, i) { return cell(v, money.indexOf(i) >= 0 ? 'totm' : 'tot', i > 1 && v !== ''); }).join('') + '</Row>';
    var xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#166534" ss:Pattern="Solid"/></Style>' +
      '<Style ss:ID="money"><NumberFormat ss:Format="&quot;₹&quot;#,##,##0.00"/></Style>' +
      '<Style ss:ID="kg"><NumberFormat ss:Format="0.###"/></Style>' +
      '<Style ss:ID="fin"><Font ss:Bold="1" ss:Color="#166534"/><Interior ss:Color="#F0FDF4" ss:Pattern="Solid"/><NumberFormat ss:Format="&quot;₹&quot;#,##,##0.00"/></Style>' +
      '<Style ss:ID="tot"><Font ss:Bold="1"/><Interior ss:Color="#F1F4F7" ss:Pattern="Solid"/></Style>' +
      '<Style ss:ID="totm"><Font ss:Bold="1"/><Interior ss:Color="#F1F4F7" ss:Pattern="Solid"/><NumberFormat ss:Format="&quot;₹&quot;#,##,##0.00"/></Style></Styles>' +
      '<Worksheet ss:Name="Bill ' + fileStamp() + '"><Table>' +
      '<Column ss:Width="40"/><Column ss:Width="190"/>' + '<Column ss:Width="80"/>'.repeat(9) +
      '<Row>' + d.head.map(function (h) { return cell(h, 'h'); }).join('') + '</Row>' + body + tot +
      '</Table></Worksheet></Workbook>';
    download('chicken-bill-' + fileStamp() + '.xls', 'application/vnd.ms-excel', xml);
  }
  function doPrint() {
    $('printDate').textContent = 'Bill Sheet #' + state.sheetNo + ' · ' + new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    closeSummary();
    try { window.print(); } catch (e) { toast('Printing is blocked in this window. Use the offline app file.'); }
  }

  // ---------- UI helpers ----------
  var toastT;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2400); }
  function confirmDlg(onYes) {
    var d = $('dlg'); d.classList.add('show'); $('dlgNo').focus();
    var close = function () { d.classList.remove('show'); $('dlgYes').onclick = $('dlgNo').onclick = null; };
    $('dlgNo').onclick = close;
    $('dlgYes').onclick = function () { close(); onYes(); };
  }
  function applySearch() {
    var q = $('search').value.trim().toLowerCase();
    state.rows.forEach(function (r) { var el = rowEl(r.id); if (el) el.classList.toggle('hidden', !!q && r.name.toLowerCase().indexOf(q) < 0); });
  }
  function openSummary() { $('mSheet').classList.add('show'); }
  function closeSummary() { $('mSheet').classList.remove('show'); }

  // ---------- Events ----------
  function bind() {
    var body = $('body');
    body.addEventListener('input', function (e) {
      var f = e.target.dataset.f; if (!f) return;
      var id = e.target.closest('.r').dataset.id;
      var row = state.rows.filter(function (r) { return r.id === id; })[0]; if (!row) return;
      row[f] = e.target.value;
      if (f === 'rate') row.customRate = row.rate.trim() !== '' && row.rate.trim() !== state.defaultRate;
      if (f === 'jaal') row.customJaal = row.jaal.trim() !== state.defaultJaal;
      updateRow(row); updateTotals();
      if (state.selectedId === id || !state.selectedId) { state.selectedId = id; renderPreview(); }
      if (f === 'name') applySearch();
      save();
    });
    body.addEventListener('focusin', function (e) {
      var r = e.target.closest('.r'); if (!r || state.selectedId === r.dataset.id) return;
      state.selectedId = r.dataset.id; renderPreview();
    });
    body.addEventListener('click', function (e) {
      var w = e.target.closest('[data-wa]'); if (w) { shareRow(w.closest('.r').dataset.id); return; }
      var b = e.target.closest('[data-del]'); if (b) deleteRow(b.closest('.r').dataset.id);
    });
    body.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.dataset.f) return;
      e.preventDefault();
      var f = e.target.dataset.f, rowE = e.target.closest('.r');
      var next = rowE.nextElementSibling;
      while (next && next.classList.contains('hidden')) next = next.nextElementSibling;
      if (!next) { addRows(1, false); next = body.lastElementChild; }
      var i = next.querySelector('[data-f="' + f + '"]'); i.focus(); i.select && i.select();
    });
    $('btnAdd').onclick = function () { addRows(1, true); };
    $('btnAdd10').onclick = function () { addRows(10, false); };
    $('btnClear').onclick = function () { $('dlgT').textContent = 'Clear all customers?'; $('dlgP').textContent = "This removes every entry from this bill. It can't be undone."; confirmDlg(clearAll); };
    $('btnCsv').onclick = exportCSV;
    $('btnExcel').onclick = $('mExcel').onclick = exportExcel;
    $('btnPrint').onclick = $('mPrint').onclick = doPrint;
    $('btnWa').onclick = $('mWa').onclick = shareMulti;
    $('btnSummary').onclick = openSummary; $('btnBack').onclick = closeSummary;
    $('search').addEventListener('input', applySearch);
    var dr = $('defaultRate');
    dr.addEventListener('input', function () {
      var v = C.parseScaled(dr.value, 2);
      dr.classList.toggle('err', !(v > 0));
      if (v > 0) {
        state.defaultRate = dr.value.trim();
        state.rows.forEach(function (r) {
          if (r.customRate) return;
          r.rate = state.defaultRate;
          var el = rowEl(r.id), inp = el && el.querySelector('[data-f="rate"]');
          if (inp && inp !== document.activeElement) inp.value = r.rate;
          updateRow(r);
        });
        updateTotals(); renderPreview();
        if (!singleCustomRate) { $('sRate').value = state.defaultRate; renderSingle(); saveSingle(); }
        save();
      }
    });
    var dj = $('defaultJaal');
    dj.addEventListener('input', function () {
      var raw = dj.value.trim(), v = raw === '' ? 0 : C.parseScaled(raw, 3);
      dj.classList.toggle('err', !(v >= 0));
      if (!(v >= 0)) return;
      state.defaultJaal = raw;
      state.rows.forEach(function (r) {
        if (r.customJaal) return;
        r.jaal = state.defaultJaal;
        var el = rowEl(r.id), inp = el && el.querySelector('[data-f="jaal"]');
        if (inp && inp !== document.activeElement) inp.value = r.jaal;
        updateRow(r);
      });
      updateTotals(); renderPreview();
      if (!singleCustomJaal) { $('sJaal').value = state.defaultJaal; renderSingle(); saveSingle(); }
      save();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { $('dlg').classList.remove('show'); closeSummary(); } });
    window.addEventListener('beforeprint', function () { $('printDate').textContent = 'Bill Sheet #' + state.sheetNo + ' · ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); });
  }

  // ---------- Single customer calculator ----------
  var SINGLE_KEY = 'chickenBilling.single.v1';
  var singleCustomRate = false, singleCustomJaal = false;
  var sF = { name: 'sName', pieces: 'sPieces', kg: 'sKgIn', jaal: 'sJaal', rate: 'sRate', oldBal: 'sOld', cash: 'sCash', online: 'sOnline' };
  function singleRow() { return { name: $('sName').value || 'x', pieces: $('sPieces').value, kg: $('sKgIn').value, jaal: $('sJaal').value, rate: $('sRate').value, oldBal: $('sOld').value, cash: $('sCash').value, online: $('sOnline').value }; }
  // Manual labour (user asked Nov 2 2026): typed value replaces auto labour as the final labour charge, no round-off.
  var singleLabourManual = false;
  function singleLabour() { if (!singleLabourManual) return null; var s = ($('sLabour').value || '').trim(); if (s === '') return null; var v = C.parseScaled(s, 2); return v === null || isNaN(v) ? NaN : v; }
  function calcSingle(v) {
    var r = C.calculate(v.pieces, v.netGrams, v.ratePaise), m = singleLabour();
    if (m === null || isNaN(m)) return r;
    var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; });
    o.manual = true; o.labourAdjusted = m; o.adjustment = 0; o.warning = null; o.final = o.basic + o.samiti + m;
    return o;
  }
  function labNote(v, r) { return r.manual ? 'manual (auto ' + C.formatINR(r.labourOriginal, { decimals: 2 }) + ')' : C.labourRuleText(v.pieces, r.labourDivisor) + ' + round-off ' + C.formatINR(r.adjustment, { decimals: 2 }); }
  function renderSingle() {
    var row = singleRow(), v = C.validateRow(row), out = $('sOut');
    ['pieces', 'kg', 'jaal', 'rate'].forEach(function (f) { $(sF[f]).classList.toggle('err', !!v.errors[f]); });
    var sl = C.ledger(row, 0);
    ['oldBal', 'cash', 'online'].forEach(function (f) { $(sF[f]).classList.toggle('err', !!sl.errors[f]); });
    $('sErr').textContent = Object.values(v.errors).concat(Object.values(sl.errors)).join(' · ');
    var nm = $('sName').value.trim();
    var h = '<h3>Bill' + (nm ? ' · ' + esc(nm) : '') + '</h3>';
    if (!v.ok) { if (!singleLabourManual && document.activeElement !== $('sLabour')) $('sLabour').value = ''; out.innerHTML = h + '<p class="empty">Pieces, total KG and rate bharte hi bill yahan dikhega.</p>'; return; }
    var lm = singleLabour(); $('sLabour').classList.toggle('err', isNaN(lm));
    if (isNaN(lm)) $('sErr').textContent = ($('sErr').textContent ? $('sErr').textContent + ' · ' : '') + 'Labour sahi bhariye';
    var r = calcSingle(v);
    if (!singleLabourManual && document.activeElement !== $('sLabour')) $('sLabour').value = (r.labourAdjusted / 100).toFixed(2);
    var gkg = C.formatKg(v.grams), kg = C.formatKg(v.netGrams), rate = C.formatINR(v.ratePaise);
    var q = function (k, val) { return '<div><span>' + k + '</span><b>' + val + '</b></div>'; };
    h += '<div class="sq">' + q('Pieces', C.formatInt(v.pieces)) + q('Total KG', gkg) + (v.jaalGrams ? q('Jaal', '− ' + C.formatKg(v.jaalGrams)) + q('Net KG', kg) : '') +
      q('Average', (C.averageKg(v.netGrams, v.pieces) || '—') + ' kg') + q('Rate', rate) + '</div>';
    var L = C.ledger(row, r.final), led = ledgerHTML(L);
    h += '<div class="s2' + (led ? '' : ' one') + '"><div class="s2a">' +
      rc('Basic Amount<small>' + kg + ' kg × ' + rate + '</small>', C.formatINR(r.basic)) +
      rc('Samiti Charge<small>1%, rounded down</small>', C.formatINR(r.samiti)) +
      rc('Labour Charge<small>' + (r.manual ? labNote(v, r) : C.labourRuleText(v.pieces, r.labourDivisor) + ' = ' + C.formatINR(r.labourOriginal, { decimals: 2 }) + ' + ' + C.formatINR(r.adjustment, { decimals: 2 }) + ' round-off') + '</small>', C.formatINR(r.labourAdjusted, { decimals: 2 })) +
      '<div class="rc big"><span class="k">Aaj ka Bill</span><span class="val" id="sFinal">' + (r.final == null ? '—' : C.formatINR(r.final, { decimals: r.final % 100 ? 2 : 0 })) + '</span></div>' +
      (r.final != null ? '<div class="words">' + esc(C.amountInWords(r.final)) + '</div>' : '') +
      (r.warning ? '<div class="warn">' + esc(r.warning) + '</div>' : '') +
      '</div>' + (led ? '<div class="s2b">' + led + '</div>' : '') + '</div>';
    out.innerHTML = h;
  }
  function buildReceipt() {
    var row = singleRow(), v = C.validateRow(row);
    if (!v.ok) return false;
    var r = calcSingle(v), L = C.ledger(row, r.final);
    var m2 = function (p) { return C.formatINR(p, { decimals: p % 100 ? 2 : 0 }); };
    var nm = $('sName').value.trim(), firm = $('sFirm').value.trim();
    var d = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    var t = function (k, val, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + k + '</td><td>' + val + '</td></tr>'; };
    var h = '<div class="rh"><div><b>Ghazipur Murga Mandi</b>' + (firm ? '<i>' + esc(firm) + '</i>' : '') + '<span>Wholesale Bill</span></div><div class="rd">' + d + '</div></div>' +
      '<div class="rn">' + (nm ? esc(nm) : 'Customer') + '</div>' +
      '<div class="rq">' +
        '<div><span>Pieces</span><b>' + C.formatInt(v.pieces) + '</b></div>' +
        '<div><span>Total KG</span><b>' + C.formatKg(v.grams) + '</b></div>' +
        (v.jaalGrams ? '<div><span>Jaal KG</span><b>− ' + C.formatKg(v.jaalGrams) + '</b></div><div><span>Net KG</span><b>' + C.formatKg(v.netGrams) + '</b></div>' : '') +
        '<div><span>Average</span><b>' + C.averageKg(v.netGrams, v.pieces) + ' kg</b></div>' +
        '<div><span>Rate / KG</span><b>' + C.formatINR(v.ratePaise) + '</b></div>' +
      '</div>' +
      '<table class="rt">' +
        t('Basic Amount <small>' + C.formatKg(v.netGrams) + ' kg × ' + C.formatINR(v.ratePaise) + '</small>', C.formatINR(r.basic)) +
        t('Samiti <small>1%</small>', C.formatINR(r.samiti)) +
        t('Labour <small>' + labNote(v, r) + '</small>', C.formatINR(r.labourAdjusted, { decimals: 2 })) +
        t('Aaj ka Bill', r.final == null ? '—' : C.formatINR(r.final, { decimals: r.final % 100 ? 2 : 0 }), 'tot') +
      '</table>';
    if (L.any && L.ok) {
      h += '<table class="rt led">' +
        t('Pichla Balance (B)', '+ ' + m2(L.oldBal)) +
        t('Total Due', m2(L.due + L.received), 'sub') +
        t('Rec Cash', '− ' + m2(L.cash)) +
        t('Rec Online', '− ' + m2(L.online)) +
        t('Balance Baaki', dueText(L.due), 'tot due') +
      '</table>';
    }
    if (r.final != null) h += '<div class="rw">' + esc(C.amountInWords(L.any && L.ok ? Math.max(L.due, 0) : r.final)) + '</div>';
    h += '<div class="rf">Dhanyavaad · ' + (firm ? esc(firm) + ', ' : '') + 'Ghazipur Murga Mandi</div>';
    $('sReceipt').innerHTML = h;
    return true;
  }

  // ---------- Receipt as PDF (canvas image inside a one-page PDF, works offline) ----------
  function receiptModel(src) {
    var row = src || singleRow(), v = C.validateRow(row);
    if (!v.ok) return null;
    var r = src ? C.calculate(v.pieces, v.netGrams, v.ratePaise) : calcSingle(v), L = C.ledger(row, r.final);
    var m2 = function (p) { return C.formatINR(p, { decimals: p % 100 ? 2 : 0 }); };
    var m = { firm: $('sFirm').value.trim(), name: (src ? String(row.name || '') : $('sName').value).trim() || 'Customer',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), boxes: [], rows: [], led: [], final: r.final };
    m.boxes.push(['PIECES', C.formatInt(v.pieces)], ['TOTAL KG', C.formatKg(v.grams)]);
    if (v.jaalGrams) m.boxes.push(['JAAL KG', '− ' + C.formatKg(v.jaalGrams)], ['NET KG', C.formatKg(v.netGrams)]);
    m.boxes.push(['AVERAGE', C.averageKg(v.netGrams, v.pieces) + ' kg'], ['RATE / KG', C.formatINR(v.ratePaise)]);
    m.rows.push(['Basic Amount', C.formatKg(v.netGrams) + ' kg × ' + C.formatINR(v.ratePaise), C.formatINR(r.basic)]);
    m.rows.push(['Samiti', '1%', C.formatINR(r.samiti)]);
    m.rows.push(['Labour', labNote(v, r), C.formatINR(r.labourAdjusted, { decimals: 2 })]);
    m.billText = r.final == null ? '—' : C.formatINR(r.final, { decimals: r.final % 100 ? 2 : 0 });
    if (L.any && L.ok) {
      m.led = [['Pichla Balance (B)', '+ ' + m2(L.oldBal)], ['Total Due', m2(L.due + L.received), 1], ['Rec Cash', '− ' + m2(L.cash)], ['Rec Online', '− ' + m2(L.online)]];
      m.balText = dueText(L.due); m.balPaise = L.due;
    }
    m.words = r.final == null ? '' : C.amountInWords(L.any && L.ok ? Math.max(L.due, 0) : r.final);
    return m;
  }
  function receiptCanvas(m) {
    var W = 1000, S = 2, P = 50, F = '"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif';
    var H = 330 + Math.ceil(m.boxes.length / 3) * 92 + m.rows.length * 52 + 80 + (m.led.length ? m.led.length * 46 + 80 : 0) + 140;
    var cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    var g = cv.getContext('2d'); g.scale(S, S);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    var txt = function (t, x, y, size, color, weight, align) { g.font = (weight || 400) + ' ' + size + 'px ' + F; g.fillStyle = color || '#111'; g.textAlign = align || 'left'; g.fillText(t, x, y); };
    var line = function (y, color, w) { g.fillStyle = color || '#E3E3E3'; g.fillRect(P, y, W - 2 * P, w || 1); };
    var y = 80;
    txt('Ghazipur Murga Mandi', P, y, 40, '#166534', 700);
    txt(m.date, W - P, y, 22, '#444', 400, 'right');
    if (m.firm) { y += 40; txt(m.firm, P, y, 28, '#111', 700); }
    y += 30; txt('WHOLESALE BILL', P, y, 18, '#666', 600);
    y += 18; line(y, '#166534', 4);
    y += 56; txt(m.name, P, y, 32, '#111', 700);
    y += 22;
    var bw = (W - 2 * P - 2 * 16) / 3;
    m.boxes.forEach(function (b, i) {
      var cx = P + (i % 3) * (bw + 16), cy = y + Math.floor(i / 3) * 92;
      g.strokeStyle = '#CFCFCF'; g.lineWidth = 1.5; g.strokeRect(cx, cy, bw, 76);
      txt(b[0], cx + 16, cy + 28, 16, '#666', 600); txt(b[1], cx + 16, cy + 62, 28, '#111', 700);
    });
    y += Math.ceil(m.boxes.length / 3) * 92 + 10;
    m.rows.forEach(function (r) {
      y += 40; g.font = '400 24px ' + F; var w0 = g.measureText(r[0]).width;
      txt(r[0], P + 4, y, 24, '#222'); txt(r[1], P + 4 + w0 + 14, y, 17, '#777');
      txt(r[2], W - P - 4, y, 24, '#111', 600, 'right'); y += 12; line(y);
    });
    line(y, '#166534', 3);
    y += 50; txt('Aaj ka Bill', P + 4, y, 30, '#166534', 700); txt(m.billText, W - P - 4, y, 32, '#166534', 700, 'right');
    y += 16;
    if (m.led.length) {
      y += 14;
      m.led.forEach(function (r) { y += 36; txt(r[0], P + 4, y, 22, '#222', r[2] ? 700 : 400); txt(r[1], W - P - 4, y, 22, '#111', r[2] ? 700 : 500, 'right'); y += 10; line(y); });
      line(y, '#9A3412', 3);
      y += 50; var bc = m.balPaise < 0 ? '#166534' : '#9A3412';
      txt('Balance Baaki', P + 4, y, 30, bc, 700); txt(m.balText, W - P - 4, y, 32, bc, 700, 'right'); y += 16;
    }
    if (m.words) { y += 40; txt(m.words, W - P - 4, y, 20, '#444', 400, 'right'); }
    y += 30; g.strokeStyle = '#999'; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(P, y); g.lineTo(W - P, y); g.stroke(); g.setLineDash([]);
    y += 34; txt('Dhanyavaad · ' + (m.firm ? m.firm + ', ' : '') + 'Ghazipur Murga Mandi', W / 2, y, 18, '#666', 400, 'center');
    return cv;
  }
  function jpegPdf(dataUrl, pw, ph) {
    var bin = atob(dataUrl.split(',')[1]), img = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);
    var PW = Math.max(595.28, Math.round(pw / 2 * 0.46)), PH = Math.round(PW * ph / pw * 100) / 100;
    var content = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
    var parts = [], off = [], len = 0;
    var add = function (x) { if (typeof x === 'string') { var b = new Uint8Array(x.length); for (var j = 0; j < x.length; j++) b[j] = x.charCodeAt(j) & 255; x = b; } parts.push(x); len += x.length; };
    add('%PDF-1.4\n');
    var obj = function (n, body) { off[n] = len; add(n + ' 0 obj\n'); body(); add('\nendobj\n'); };
    obj(1, function () { add('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); });
    obj(3, function () { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'); });
    obj(4, function () { add('<< /Type /XObject /Subtype /Image /Width ' + pw + ' /Height ' + ph + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n'); add(img); add('\nendstream'); });
    obj(5, function () { add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
    var xref = len, x = 'xref\n0 6\n0000000000 65535 f \n';
    for (var k = 1; k <= 5; k++) x += ('0000000000' + off[k]).slice(-10) + ' 00000 n \n';
    add(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function shareReceipt() {
    var m = receiptModel();
    if (!m) { toast('Pehle pieces, KG aur rate sahi bhariye'); return; }
    shareCanvas(receiptCanvas(m), 'Bill ' + m.name + ' ' + m.date, 'Bill · ' + m.date);
  }

  function shareRow(id) {
    var row = null; state.rows.forEach(function (r) { if (r.id === id) row = r; });
    var m = row && receiptModel(row);
    if (!m) { toast('Is row mein pieces, KG aur rate sahi bhariye'); return; }
    shareCanvas(receiptCanvas(m), 'Bill ' + m.name + ' ' + m.date, 'Bill · ' + m.name + ' · ' + m.date);
  }
  // Ask: PDF or Photo, then share that file (WhatsApp etc.)
  var pendingShare = null;
  function shareCanvas(cv, base, msg) {
    pendingShare = { cv: cv, base: String(base).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'Bill', msg: msg };
    $('shareDlg').classList.add('show');
  }
  function closeShare() { $('shareDlg').classList.remove('show'); }
  function doShare(kind) {
    var p = pendingShare; closeShare(); if (!p) return; pendingShare = null;
    var url = p.cv.toDataURL('image/jpeg', 0.92);
    if (kind === 'pdf') sharePdf(jpegPdf(url, p.cv.width, p.cv.height), p.base + '.pdf', p.msg);
    else {
      var bin = atob(url.split(',')[1]), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      sharePdf(new Blob([u], { type: 'image/jpeg' }), p.base + '.jpg', p.msg, 'image/jpeg');
    }
  }
  function sharePdf(blob, fname, msg, mime) {
    mime = mime || 'application/pdf';
    var file = null; try { file = new File([blob], fname, { type: mime }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], text: msg }).catch(function (e) { if (e && e.name !== 'AbortError') fallback(); });
      return;
    }
    fallback();
    function fallback() {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      try { window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank'); } catch (e) {}
      toast((mime === 'application/pdf' ? 'PDF' : 'Photo') + ' download ho gayi. WhatsApp mein 📎 se attach karke bhejiye');
    }
  }
  function canvasPdf(cv) { return jpegPdf(cv.toDataURL('image/jpeg', 0.92), cv.width, cv.height); }
  // spec: {title, sub, date, cols:[{h, w, r}], rows:[[...]], bold:[rowIndex], sum:[[k, v, color]]}
  function tableCanvas(spec) {
    var W = 0; spec.cols.forEach(function (c) { W += c.w; }); var P = 40; W += 2 * P;
    var S = 2, F = '"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif', RH = 44;
    var H = 200 + (spec.sub ? 36 : 0) + 56 + spec.rows.length * RH + (spec.sum ? spec.sum.length * 46 + 40 : 0) + 90;
    var cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    var g = cv.getContext('2d'); g.scale(S, S); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    var txt = function (t, x, y, size, color, weight, align, maxW) {
      g.font = (weight || 400) + ' ' + size + 'px ' + F; g.fillStyle = color || '#111'; g.textAlign = align || 'left';
      t = String(t); if (maxW) { while (t.length > 1 && g.measureText(t).width > maxW) t = t.slice(0, -2) + '…'; }
      g.fillText(t, x, y);
    };
    var y = 70;
    txt('Ghazipur Murga Mandi', P, y, 38, '#166534', 700); txt(spec.date, W - P, y, 22, '#444', 400, 'right');
    if (spec.sub) { y += 38; txt(spec.sub, P, y, 26, '#111', 700); }
    y += 30; txt(spec.title.toUpperCase(), P, y, 17, '#666', 600);
    y += 16; g.fillStyle = '#166534'; g.fillRect(P, y, W - 2 * P, 4);
    y += 20; g.fillStyle = '#F1F5F2'; g.fillRect(P, y, W - 2 * P, 44);
    var x = P; spec.cols.forEach(function (c) { txt(c.h, c.r ? x + c.w - 10 : x + 10, y + 29, 16, '#334', 700, c.r ? 'right' : 'left'); x += c.w; });
    y += 44;
    spec.rows.forEach(function (row, i) {
      var b = spec.bold && spec.bold.indexOf(i) >= 0;
      if (b) { g.fillStyle = '#E7F7EC'; g.fillRect(P, y, W - 2 * P, RH); }
      x = P; spec.cols.forEach(function (c, j) { var v = row[j] == null ? '' : row[j]; txt(v, c.r ? x + c.w - 10 : x + 10, y + 29, 20, (c.color && !b) ? c.color : '#111', b || c.b ? 700 : 400, c.r ? 'right' : 'left', c.w - 16); x += c.w; });
      y += RH; g.fillStyle = '#E3E3E3'; g.fillRect(P, y - 1, W - 2 * P, 1);
    });
    if (spec.sum) {
      y += 24;
      spec.sum.forEach(function (sm) { y += 40; var big = sm[3]; txt(sm[0], W - P - 260, y, big ? 28 : 22, sm[2] || '#222', big ? 700 : 500, 'right'); txt(sm[1], W - P, y, big ? 30 : 22, sm[2] || '#111', 700, 'right'); y += 6; });
    }
    y += 50; txt('Dhanyavaad · ' + (spec.sub ? spec.sub + ', ' : '') + 'Ghazipur Murga Mandi', W / 2, y, 17, '#777', 400, 'center');
    return cv;
  }
  function firmName() { return ($('sFirm') && $('sFirm').value.trim()) || ''; }
  function todayText() { return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function multiSpec() {
    var d = exportRows(); if (!d.count) return null;
    var M = function (v) { return v === '' ? '' : C.formatINR(Math.round(parseFloat(v) * 100), { decimals: Math.round(parseFloat(v) * 100) % 100 ? 2 : 0 }); };
    var B = function (v) { return v === '' ? '' : dueText(Math.round(parseFloat(v) * 100)); };
    var K = function (v) { return v === '' ? '' : v; };
    var map = function (r, tot) {
      return [tot ? '' : r[0], tot ? 'TOTAL' : r[1], r[2] === '' ? '' : C.formatInt(+r[2]), K(r[3]), r[4] === '' || +r[4] === 0 ? (tot ? '0' : '—') : r[4], K(r[5]),
        tot ? '' : (r[7] === '' ? '' : M(r[7])), M(r[8]), M(r[9]), M(r[12]), M(r[13]), M(r[14]), M(r[15]), M(r[16]), B(r[17])];
    };
    var rows = d.rows.map(function (r) { return map(r); }); rows.push(map(d.total, true));
    var T = d.total, rec = String((parseFloat(T[15] || 0) + parseFloat(T[16] || 0)).toFixed(2));
    return { title: 'Wholesale Bill · ' + d.count + ' customers', sub: firmName(), date: todayText(),
      cols: [{ h: '#', w: 44 }, { h: 'Customer', w: 230, b: 1 }, { h: 'Pcs', w: 70, r: 1 }, { h: 'Total KG', w: 105, r: 1 }, { h: 'Jaal', w: 75, r: 1 }, { h: 'Net KG', w: 105, r: 1 }, { h: 'Rate', w: 70, r: 1 },
        { h: 'Basic', w: 125, r: 1 }, { h: 'Samiti', w: 95, r: 1 }, { h: 'Labour', w: 100, r: 1 }, { h: 'Aaj ka Bill', w: 135, r: 1, b: 1, color: '#166534' },
        { h: 'Pichla Bal', w: 125, r: 1 }, { h: 'Rec Cash', w: 115, r: 1 }, { h: 'Rec Online', w: 115, r: 1 }, { h: 'Balance', w: 140, r: 1, b: 1, color: '#9A3412' }],
      rows: rows, bold: [rows.length - 1],
      sum: [['Basic Amount', M(T[8])], ['Samiti Charge (1%)', M(T[9])], ['Labour Charge', M(T[12])], ['Grand Total (Aaj ka Bill)', M(T[13]), '#166534', 1],
        ['Pichla Balance', M(T[14])], ['Received (Cash ' + M(T[15]) + ' + Online ' + M(T[16]) + ')', M(rec)], ['Balance Baaki', B(T[17]), '#9A3412', 1]] };
  }
  function shareMulti() {
    var sp = multiSpec(); if (!sp) { toast('Pehle kam se kam ek customer ka bill bhariye'); return; }
    shareCanvas(tableCanvas(sp), 'Bill-Sheet-' + fileStamp(), 'Bill · ' + sp.date);
  }
  window.__cbReceipt = { shareCanvas: shareCanvas, shareRow: shareRow, model: receiptModel, pdf: jpegPdf, multiSpec: multiSpec, expSpec: function () { return expSpec(); } };
  function saveSingle() {
    if (!storage) return;
    try { storage.setItem(SINGLE_KEY, JSON.stringify({ name: $('sName').value, pieces: $('sPieces').value, kg: $('sKgIn').value, rate: $('sRate').value, customRate: singleCustomRate, jaal: $('sJaal').value, customJaal: singleCustomJaal, oldBal: $('sOld').value, cash: $('sCash').value, online: $('sOnline').value, labour: singleLabourManual ? $('sLabour').value : '' })); } catch (e) {}
  }
  function setMode(m) {
    if (m !== 'single' && m !== 'exp') m = 'multi';
    document.body.classList.toggle('mode-single', m === 'single'); document.body.classList.toggle('mode-exp', m === 'exp');
    [['tabSingle', 'single'], ['tabMulti', 'multi'], ['tabExp', 'exp']].forEach(function (x) { $(x[0]).classList.toggle('on', m === x[1]); $(x[0]).setAttribute('aria-selected', m === x[1]); });
    if (storage) try { storage.setItem('chickenBilling.mode', m); } catch (e) {}
  }
  function initSingle() {
    var s = null; try { s = storage && JSON.parse(storage.getItem(SINGLE_KEY) || 'null'); } catch (e) {}
    $('sName').value = s ? s.name || '' : ''; $('sPieces').value = s ? s.pieces || '' : '';
    $('sKgIn').value = s ? s.kg || '' : ''; $('sRate').value = s ? s.rate || state.defaultRate : state.defaultRate;
    try { $('sFirm').value = (storage && storage.getItem('chickenBilling.firm')) || ''; } catch (e) {}
    $('sFirm').addEventListener('input', function () { if (storage) try { storage.setItem('chickenBilling.firm', $('sFirm').value); } catch (e) {} });
    singleCustomRate = !!(s && s.customRate);
    singleCustomJaal = !!(s && s.customJaal);
    $('sJaal').value = s && s.jaal != null ? s.jaal : state.defaultJaal;
    $('sLabour').value = s ? s.labour || '' : ''; singleLabourManual = !!(s && s.labour); $('sOld').value = s ? s.oldBal || '' : ''; $('sCash').value = s ? s.cash || '' : ''; $('sOnline').value = s ? s.online || '' : '';
    $('sLabour').addEventListener('input', function () { singleLabourManual = $('sLabour').value.trim() !== ''; renderSingle(); saveSingle(); });
    $('sLabour').addEventListener('blur', function () { if (!singleLabourManual) renderSingle(); });
    Object.keys(sF).forEach(function (f) { $(sF[f]).addEventListener('input', function () { if (f === 'rate') singleCustomRate = $('sRate').value.trim() !== state.defaultRate; if (f === 'jaal') singleCustomJaal = $('sJaal').value.trim() !== state.defaultJaal; renderSingle(); saveSingle(); }); });
    $('sClear').onclick = function () { $('sName').value = ''; $('sPieces').value = ''; $('sKgIn').value = ''; $('sRate').value = state.defaultRate; singleCustomRate = false; $('sJaal').value = state.defaultJaal; singleCustomJaal = false; $('sOld').value = ''; $('sCash').value = ''; $('sOnline').value = ''; $('sLabour').value = ''; singleLabourManual = false; renderSingle(); saveSingle(); $('sPieces').focus(); };
    $('sPrint').onclick = function () {
      if (!buildReceipt()) { toast('Pehle pieces, KG aur rate sahi bhariye'); return; }
      var st = document.createElement('style'); st.id = 'pgSingle';
      st.textContent = '@page{size:A4 portrait;margin:12mm}';
      document.head.appendChild(st); document.body.classList.add('print-rcpt');
      var done = function () { document.body.classList.remove('print-rcpt'); var x = $('pgSingle'); if (x) x.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      try { window.print(); } catch (e) { toast('Printing is blocked in this window.'); }
      setTimeout(function () { if (!window.matchMedia || !window.matchMedia('print').matches) done(); }, 1500);
    };
    $('sShare').onclick = shareReceipt;
    $('sToSheet').onclick = function () {
      var v = C.validateRow(singleRow());
      if (!v.ok) { toast('Pehle pieces, KG aur rate sahi bhariye'); return; }
      if (state.rows.length >= MAX_ROWS) { toast('Maximum of ' + MAX_ROWS + ' rows per bill reached'); return; }
      var data = { name: $('sName').value.trim() || 'Customer', pieces: $('sPieces').value.trim(), kg: $('sKgIn').value.trim(), jaal: $('sJaal').value.trim(), rate: $('sRate').value.trim(), oldBal: $('sOld').value.trim(), cash: $('sCash').value.trim(), online: $('sOnline').value.trim() };
      data.customRate = data.rate !== state.defaultRate;
      data.customJaal = data.jaal !== state.defaultJaal;
      var blank = state.rows.filter(function (r) { return !r.name.trim() && !r.pieces && !r.kg; })[0];
      if (blank) { FIELDS.forEach(function (f) { blank[f] = data[f]; }); blank.customRate = data.customRate; blank.customJaal = data.customJaal; } else { state.rows.push(newRow(data)); }
      renderAll(); save(); toast('Added ' + data.name + ' to the multiple sheet');
    };
    $('tabSingle').onclick = function () { setMode('single'); };
    $('tabMulti').onclick = function () { setMode('multi'); };
    $('tabExp').onclick = function () { setMode('exp'); };
    initExp();
    var m = null; try { m = storage && storage.getItem('chickenBilling.mode'); } catch (e) {}
    setMode(m || 'single');
    renderSingle();
  }


  // ---------- Kharcha / Expense ----------
  var EXP_KEY = 'chickenBilling.expenses', EXP_TYPES = ['Truck / Gaadi Bhada', 'Khana Kharcha', 'Labour', 'Other'];
  var exp = { date: '', items: [], seq: 1 };
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function expDateText() { var p = (exp.date || todayISO()).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function expAmt(v) { v = String(v == null ? '' : v).replace(/[,₹\s]/g, ''); if (v === '') return { ok: true, p: 0, blank: true }; if (!/^\d+(\.\d{0,2})?$/.test(v)) return { ok: false }; return { ok: true, p: Math.round(parseFloat(v) * 100) }; }
  function expSave() { if (storage) try { storage.setItem(EXP_KEY, JSON.stringify(exp)); } catch (e) {} }
  function expMoney(p) { return C.formatINR(p, { decimals: p % 100 ? 2 : 0 }); }
  function expTotals() {
    var t = { total: 0, cash: 0, online: 0, bad: 0, n: 0, by: {} };
    exp.items.forEach(function (it) { var a = expAmt(it.amt); if (!a.ok) { t.bad++; return; } if (a.blank) return; t.n++; t.total += a.p; if (it.mode === 'Online') t.online += a.p; else t.cash += a.p; t.by[it.type] = (t.by[it.type] || 0) + a.p; });
    return t;
  }
  function expRenderOut() {
    var t = expTotals(), h = '<h3>Kharcha Summary · ' + esc(expDateText()) + '</h3>';
    var types = EXP_TYPES.slice(); Object.keys(t.by).forEach(function (k) { if (types.indexOf(k) < 0) types.push(k); });
    types.forEach(function (k) { if (t.by[k]) h += '<div class="rc"><span>' + esc(k) + '</span><span class="val">' + expMoney(t.by[k]) + '</span></div>'; });
    if (!t.n) h += '<div class="rc"><span style="color:var(--muted)">Koi kharcha nahi</span><span class="val">₹0</span></div>';
    h += '<div class="rc"><span>Cash se diya</span><span class="val">' + expMoney(t.cash) + '</span></div>';
    h += '<div class="rc"><span>Online diya</span><span class="val">' + expMoney(t.online) + '</span></div>';
    h += '<div class="rc big"><span class="k">Total Kharcha</span><span class="val">' + expMoney(t.total) + '</span></div>';
    if (t.total) h += '<div class="words">' + esc(C.amountInWords(t.total)) + '</div>';
    if (t.bad) h += '<div class="s-err" style="margin-top:8px">' + t.bad + ' row mein amount galat hai (total mein nahi juda)</div>';
    $('eOut').innerHTML = h;
    $('eEmpty').hidden = exp.items.length > 0;
  }
  function expRender() {
    var b = $('eBody'); b.innerHTML = '';
    exp.items.forEach(function (it, i) {
      var r = document.createElement('div'); r.className = 'e-r'; r.dataset.id = it.id;
      var types = EXP_TYPES.indexOf(it.type) < 0 ? EXP_TYPES.concat([it.type]) : EXP_TYPES;
      r.innerHTML = '<div class="ix">' + (i + 1) + '</div>' +
        '<select class="e-type" data-f="type" aria-label="Kharcha type">' + types.map(function (k) { return '<option' + (k === it.type ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
        '<input class="e-note" data-f="note" placeholder="' + (it.type === 'Truck / Gaadi Bhada' ? 'Truck no. / firm' : it.type === 'Labour' ? 'Labour ka naam' : 'Detail') + '" value="' + esc(it.note || '') + '" autocomplete="off">' +
        '<input class="n e-amt" data-f="amt" inputmode="decimal" value="' + esc(it.amt || '') + '" aria-label="Amount">' +
        '<select class="e-mode" data-f="mode" aria-label="Paid by"><option' + (it.mode !== 'Online' ? ' selected' : '') + '>Cash</option><option' + (it.mode === 'Online' ? ' selected' : '') + '>Online</option></select>' +
        '<button class="btn icon e-del" aria-label="Delete" title="Delete">✕</button>';
      b.appendChild(r);
      var a = r.querySelector('.e-amt'); a.classList.toggle('err', !expAmt(it.amt).ok);
    });
    expRenderOut();
  }
  function expAdd(type) {
    var it = { id: exp.seq++, type: type || 'Other', note: '', amt: '', mode: 'Cash' };
    exp.items.push(it); expRender(); expSave();
    var el = $('eBody').querySelector('[data-id="' + it.id + '"] ' + (type === 'Other' ? '.e-note' : '.e-amt')); if (el) el.focus();
  }
  function expCsv() {
    var q = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Date', 'S.No', 'Kharcha Type', 'Detail', 'Amount', 'Paid By'].join(',')];
    exp.items.forEach(function (it, i) { var a = expAmt(it.amt); if (!a.ok || a.blank) return; lines.push([expDateText(), i + 1, it.type, it.note || '', (a.p / 100).toFixed(2), it.mode || 'Cash'].map(q).join(',')); });
    var t = expTotals(); lines.push(['', '', 'TOTAL', '', (t.total / 100).toFixed(2), ''].map(q).join(','));
    download('Kharcha-' + (exp.date || todayISO()) + '.csv', 'text/csv;charset=utf-8', '\ufeff' + lines.join('\r\n'));
  }
  function expPrint() {
    var t = expTotals(); if (!t.n) { toast('Pehle koi kharcha add karo'); return; }
    var firm = ($('sFirm') && $('sFirm').value.trim()) || '';
    var tr = function (k, v, c) { return '<tr' + (c ? ' class="' + c + '"' : '') + '><td>' + k + '</td><td>' + v + '</td></tr>'; };
    var h = '<div class="rh"><div><b>Ghazipur Murga Mandi</b>' + (firm ? '<i>' + esc(firm) + '</i>' : '') + '<span>Kharcha / Expense</span></div><div class="rd">' + esc(expDateText()) + '</div></div><table class="rt" style="margin-top:10px">';
    var n = 0;
    exp.items.forEach(function (it) { var a = expAmt(it.amt); if (!a.ok || a.blank) return; n++; h += tr(n + '. ' + esc(it.type) + (it.note ? ' <small>' + esc(it.note) + '</small>' : '') + ' <small>(' + (it.mode || 'Cash') + ')</small>', expMoney(a.p)); });
    h += tr('Cash se diya', expMoney(t.cash), 'sub') + tr('Online diya', expMoney(t.online)) + tr('Total Kharcha', expMoney(t.total), 'tot due') + '</table>';
    h += '<div class="rw">' + esc(C.amountInWords(t.total)) + '</div>';
    $('sReceipt').innerHTML = h;
    var st = document.createElement('style'); st.id = 'pgSingle'; st.textContent = '@page{size:A4 portrait;margin:12mm}';
    document.head.appendChild(st); document.body.classList.add('print-rcpt');
    var done = function () { document.body.classList.remove('print-rcpt'); var x = $('pgSingle'); if (x) x.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { toast('Printing is blocked in this window.'); }
    setTimeout(function () { if (!window.matchMedia || !window.matchMedia('print').matches) done(); }, 1500);
  }
  function expSpec() {
    var t = expTotals(); if (!t.n) return null;
    var rows = [], n = 0;
    exp.items.forEach(function (it) { var a = expAmt(it.amt); if (!a.ok || a.blank) return; rows.push([++n, it.type, it.note || '', it.mode || 'Cash', expMoney(a.p)]); });
    return { title: 'Kharcha / Expense', sub: firmName(), date: expDateText(),
      cols: [{ h: '#', w: 50 }, { h: 'Kharcha Type', w: 260, b: 1 }, { h: 'Detail', w: 330 }, { h: 'Diya', w: 110 }, { h: 'Amount', w: 170, r: 1, b: 1 }],
      rows: rows, sum: [['Cash se diya', expMoney(t.cash)], ['Online diya', expMoney(t.online)], ['Total Kharcha', expMoney(t.total), '#B91C1C', 1]] };
  }
  function initExp() {
    try { var s = storage && JSON.parse(storage.getItem(EXP_KEY) || 'null'); if (s && s.items) exp = { date: s.date || '', items: s.items, seq: s.seq || s.items.length + 1 }; } catch (e) {}
    if (!exp.date) exp.date = todayISO();
    $('eDate').value = exp.date;
    $('eDate').addEventListener('change', function () { exp.date = $('eDate').value || todayISO(); expRenderOut(); expSave(); });
    Array.prototype.forEach.call(document.querySelectorAll('.e-quick [data-q]'), function (btn) { btn.onclick = function () { expAdd(btn.getAttribute('data-q')); }; });
    var b = $('eBody');
    b.addEventListener('input', function (e) {
      var r = e.target.closest('.e-r'), f = e.target.getAttribute('data-f'); if (!r || !f) return;
      var it = exp.items.filter(function (x) { return String(x.id) === r.dataset.id; })[0]; if (!it) return;
      it[f] = e.target.value; if (f === 'amt') e.target.classList.toggle('err', !expAmt(it.amt).ok);
      expRenderOut(); expSave();
    });
    b.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') { var ev = document.createEvent('Event'); ev.initEvent('input', true, true); e.target.dispatchEvent(ev); } });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.classList.contains('e-amt')) { e.preventDefault(); expAdd('Other'); } });
    b.addEventListener('click', function (e) {
      if (!e.target.closest('.e-del')) return; var r = e.target.closest('.e-r');
      exp.items = exp.items.filter(function (x) { return String(x.id) !== r.dataset.id; }); expRender(); expSave();
    });
    $('eClear').onclick = function () {
      if (!exp.items.length) return;
      $('dlgT').textContent = 'Saara kharcha hatana hai?'; $('dlgP').textContent = 'Is din ki saari kharcha entries hat jayengi.';
      confirmDlg(function () { exp.items = []; exp.seq = 1; exp.date = todayISO(); $('eDate').value = exp.date; expRender(); expSave(); });
    };
    $('eWa').onclick = function () {
      var sp = expSpec(); if (!sp) { toast('Pehle koi kharcha add karo'); return; }
      shareCanvas(tableCanvas(sp), 'Kharcha-' + (exp.date || todayISO()), 'Kharcha · ' + sp.date);
    };
    $('eCsv').onclick = expCsv; $('ePrint').onclick = expPrint;
    expRender();
  }

  // ---------- Init ----------
  function initShareDlg() {
    $('shPdf').onclick = function () { doShare('pdf'); };
    $('shImg').onclick = function () { doShare('img'); };
    $('shNo').onclick = function () { pendingShare = null; closeShare(); };
    $('shareDlg').addEventListener('click', function (e) { if (e.target === $('shareDlg')) { pendingShare = null; closeShare(); } });
  }
  function init() {
    initShareDlg();
    $('todayChip').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    var saved = load();
    if (saved) {
      state.rows = saved.rows.map(function (r) { return newRow(r); });
      state.defaultRate = saved.defaultRate || '';
      var mig = false; try { mig = storage && !storage.getItem('chickenBilling.blankV2'); if (mig) storage.setItem('chickenBilling.blankV2', '1'); } catch (e) {}
      if (mig && state.defaultRate === '90') {
        state.defaultRate = '';
        state.rows.forEach(function (r) { if (!r.customRate && r.rate === '90' && !String(r.name || '').trim() && !String(r.pieces || '').trim() && !String(r.kg || '').trim()) r.rate = ''; });
      }
      state.defaultJaal = saved.defaultJaal || '';
      state.sheetNo = saved.sheetNo || 1;
    } else {
      try { storage && storage.setItem('chickenBilling.blankV2', '1'); } catch (e) {}
      if (/[?&]demo\b/.test(location.search)) {
        state.defaultRate = '90';
        state.rows = SAMPLE.map(function (s) { return newRow({ name: s[0], pieces: s[1], kg: s[2], rate: s[3] }); });
        state.rows.push(newRow({ rate: '90' }), newRow({ rate: '90' }));
      } else for (var bi = 0; bi < 5; bi++) state.rows.push(newRow({ rate: '' }));
    }
    if (!storage) { $('storageNotice').classList.add('show'); $('saveState').classList.add('off'); $('saveText').textContent = 'Not saved (preview)'; }
    $('defaultRate').value = state.defaultRate;
    $('defaultJaal').value = state.defaultJaal;
    $('sheetNo').textContent = '#' + state.sheetNo;
    state.selectedId = state.rows[0] && state.rows[0].id;
    bind(); renderAll(); initSingle(); initCalcBar();
    if (!saved && storage) { save(); toast('Sample bill loaded. Use Clear All to start a fresh bill.'); }
  }
  /* ---- Number keypad with + − × ÷ (replaces phone keyboard on touch screens) ---- */
  function imOf(el) { return el.getAttribute('data-im') || el.getAttribute('inputmode') || ''; }
  function isNumIn(el) { return el && el.tagName === 'INPUT' && /^(decimal|numeric)$/.test(imOf(el)); }
  var touchPad = false;
  function initCalcBar() {
    try { touchPad = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
    var bar = document.createElement('div'); bar.id = 'calcBar'; bar.className = 'calc-bar' + (touchPad ? ' pad' : '');
    var K = function (k, cls, lbl) { return '<button type="button" data-op="' + k + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + (lbl || k) + '</button>'; };
    bar.innerHTML = '<div class="cb-top"><span class="cb-lbl" id="cbLbl"></span><span class="cb-res" id="cbRes"></span></div>' +
      (touchPad
        ? '<div class="cb-keys pad">' +
          K('7') + K('8') + K('9') + K('÷', 'op') + K('⌫', 'cb-del') +
          K('4') + K('5') + K('6') + K('×', 'op') + K('C', 'cb-clr') +
          K('1') + K('2') + K('3') + K('−', 'op') + K('next', 'cb-next', 'Next ›') +
          K('.') + K('0') + K('=', 'cb-eq') + K('+', 'op') + K('done', 'cb-done', 'Done') + '</div>'
        : '<div class="cb-keys">' + K('+', 'op') + K('−', 'op') + K('×', 'op') + K('÷', 'op') + K('⌫', 'cb-del') + K('=', 'cb-eq') + '</div>');
    document.body.appendChild(bar);
    var cur = null;
    function places(el) { return imOf(el) === 'numeric' ? 0 : (/rate|cash|online|old|amt/i.test((el.id || '') + (el.dataset.f || '')) ? 2 : 3); }
    function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); }
    function label(el) {
      var l = el.closest('label'); if (l && l.querySelector('span')) return l.querySelector('span').textContent;
      return el.getAttribute('aria-label') || el.placeholder || '';
    }
    function show() {
      if (!cur) return;
      var v = cur.value, e = C.hasExpr(v), r = e ? C.evalExpr(v, places(cur)) : null;
      $('cbLbl').textContent = label(cur);
      $('cbRes').textContent = r !== null ? v + ' = ' + r : (e ? v + ' = ?' : (v || '+ − × ÷ se jodo, ghatao'));
      bar.classList.toggle('has', r !== null);
    }
    function settle(el) {
      if (!el || !C.hasExpr(el.value)) return;
      var r = C.evalExpr(el.value, places(el));
      if (r !== null) { el.title = el.value + ' = ' + r; el.value = r; fire(el); }
    }
    function open(el) {
      cur = el; bar.classList.add('show'); document.body.classList.add('calc-on'); show();
      if (touchPad) setTimeout(function () {
        var rb = el.getBoundingClientRect(), top = window.innerHeight - bar.offsetHeight - 12;
        if (rb.bottom > top) window.scrollBy({ top: rb.bottom - top, behavior: 'smooth' });
      }, 30);
    }
    function close() { bar.classList.remove('show'); document.body.classList.remove('calc-on'); cur = null; }
    function numInputs() { return Array.prototype.filter.call(document.querySelectorAll('input'), function (i) { return isNumIn(i) && i.offsetParent !== null && !i.disabled; }); }
    function prep(el) { if (touchPad && isNumIn(el) && el.getAttribute('inputmode') !== 'none') { el.setAttribute('data-im', el.getAttribute('inputmode')); el.setAttribute('inputmode', 'none'); } }
    if (touchPad) {
      document.addEventListener('pointerdown', function (e) { if (e.target.tagName === 'INPUT') prep(e.target); }, true);
      document.addEventListener('touchstart', function (e) { if (e.target.tagName === 'INPUT') prep(e.target); }, { capture: true, passive: true });
    }
    document.addEventListener('focusin', function (e) { if (isNumIn(e.target)) { prep(e.target); open(e.target); } });
    document.addEventListener('focusout', function (e) {
      if (e.target !== cur) return; var el = cur;
      setTimeout(function () { if (document.activeElement !== el) { settle(el); if (!isNumIn(document.activeElement)) close(); } }, 0);
    });
    document.addEventListener('input', function (e) { if (e.target === cur) show(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && cur && e.target === cur && C.hasExpr(cur.value)) { e.preventDefault(); settle(cur); show(); } });
    bar.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !cur) return;
      var op = b.dataset.op, v = cur.value, len = v.length,
        st = cur.selectionStart == null ? len : cur.selectionStart, en = cur.selectionEnd == null ? len : cur.selectionEnd;
      if (touchPad && document.activeElement !== cur) { st = en = len; }
      if (op === '=') { settle(cur); show(); cur.focus(); return; }
      if (op === 'done') { settle(cur); cur.blur(); close(); return; }
      if (op === 'next') {
        settle(cur); var list = numInputs(), i = list.indexOf(cur), nx = list[i + 1];
        if (nx) { prep(nx); nx.focus(); try { nx.setSelectionRange(nx.value.length, nx.value.length); } catch (x) {} } else { cur.blur(); close(); }
        return;
      }
      if (op === 'C') { cur.value = ''; st = 0; }
      else if (op === '⌫') { if (st === en && st > 0) st--; cur.value = v.slice(0, st) + v.slice(en); }
      else { cur.value = v.slice(0, st) + op + v.slice(en); st += op.length; }
      try { cur.setSelectionRange(st, st); } catch (x) {}
      fire(cur); cur.focus();
    });
  }
  if (typeof window !== 'undefined') window.__calcBarReady = true;
  init();

  // Expose for automated testing only
  window.__billing = { setMode: setMode, renderSingle: renderSingle, state: state, addRows: addRows, deleteRow: deleteRow, clearAll: clearAll, exportRows: exportRows };
})();
