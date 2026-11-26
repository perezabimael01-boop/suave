/*
 * Statement import add-on for /customer-statement
 * Upload an existing Customer Statement PDF and the form is filled in
 * automatically (customer, issuer, statement type and every contract).
 * The generator then rebuilds the full M1–M12 schedule with late fees
 * as of the statement date.
 *
 * Install: add this line just before </body> on the customer-statement page:
 *   <script src="statement-import.js"></script>
 */
(function () {
  'use strict';

  var PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  /* ---------- helpers ---------- */
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS_SRC;
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error('Could not load the PDF reader.')); };
      document.head.appendChild(s);
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function money(s) { return parseFloat(String(s).replace(/,/g, '')); }

  function parseDmy(s) { // 08-Jul-2025
    var m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
    if (!m) return null;
    return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  }

  // Same month-rolling rule the generator uses: keep the billing day, clamp to month end.
  function addMonthsClamped(date, n, day) {
    var y = date.getFullYear(), m = date.getMonth() + n;
    var target = new Date(y, m, 1);
    var last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, last));
    return target;
  }

  /* ---------- PDF -> text lines ---------- */
  function pdfToLines(file) {
    return loadPdfJs().then(function (pdfjsLib) {
      return file.arrayBuffer().then(function (buf) {
        return pdfjsLib.getDocument({ data: buf }).promise;
      });
    }).then(function (pdf) {
      var pages = [];
      for (var p = 1; p <= pdf.numPages; p++) pages.push(pdf.getPage(p));
      return Promise.all(pages).then(function (ps) {
        return Promise.all(ps.map(function (pg) { return pg.getTextContent(); }));
      });
    }).then(function (contents) {
      var lines = [];
      contents.forEach(function (tc) {
        var rows = [];
        tc.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var y = it.transform[5], x = it.transform[4];
          var row = rows.find(function (r) { return Math.abs(r.y - y) < 3; });
          if (!row) { row = { y: y, items: [] }; rows.push(row); }
          row.items.push({ x: x, s: it.str.trim() });
        });
        rows.sort(function (a, b) { return b.y - a.y; });
        rows.forEach(function (r) {
          r.items.sort(function (a, b) { return a.x - b.x; });
          lines.push(r.items.map(function (i) { return i.s; }).join(' ').replace(/\s+/g, ' '));
        });
      });
      return lines;
    });
  }

  /* ---------- text -> statement data ---------- */
  var ROW_RE = /^(?:([A-Z]{1,4}\d{4,})\s+(.+?)\s+)?([ML])(\d{1,2})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(Monthly Payment|LF)((?:\s+(?:FL|USD|\$)\s*-?[\d,]+\.\d{2})+)\s*$/i;

  function parseStatement(lines) {
    var text = lines.join('\n');
    var out = { customer: '', date: '', issuer: '', option: '', contracts: [] };

    var acc = /Account\s*:\s*(.+)/i.exec(text);
    if (acc) out.customer = acc[1].trim();
    var d = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
    if (d) out.date = d[1];
    if (/Suave Solutions/i.test(text)) out.issuer = 'suave';
    else if (/Mimi Computer|My Computer/i.test(text)) out.issuer = 'mycomputer';
    out.option = /Legal Fee/i.test(text) ? 'B' : 'A';

    var cur = null;
    lines.forEach(function (line) {
      var m = ROW_RE.exec(line.trim());
      if (!m) return;
      if (m[1]) {
        cur = { number: m[1], vendor: (m[2] || '').trim(), rows: [] };
        out.contracts.push(cur);
      }
      if (!cur) return;
      var amounts = (m[7].match(/-?[\d,]+\.\d{2}/g) || []).map(money);
      cur.rows.push({
        kind: m[3].toUpperCase(), n: +m[4], date: parseDmy(m[5]),
        amount: amounts[0], balance: amounts[amounts.length - 1]
      });
    });

    out.contracts = out.contracts.map(toFormContract).filter(Boolean);
    return out;
  }

  function toFormContract(c) {
    var ms = c.rows.filter(function (r) { return r.kind === 'M'; });
    if (!ms.length) return null;
    var first = ms[0];
    var total = Math.max.apply(null, ms.map(function (r) { return r.n; }));
    var day = first.date.getDate();
    var m1, completed;

    var hasM1 = ms.some(function (r) { return r.n === 1; });
    if (hasM1) {
      // Full M1–M12 statement: count the months already paid off.
      m1 = ms.find(function (r) { return r.n === 1; }).date;
      completed = ms.filter(function (r) { return r.balance === 0; }).length;
    } else {
      // Open-items statement: first listed month is the oldest unpaid one.
      m1 = addMonthsClamped(first.date, -(first.n - 1), day);
      completed = first.n - 1;
    }
    return {
      number: c.number, vendor: c.vendor, amount: first.amount,
      purchaseDate: iso(m1), day: day, total: total, completed: completed
    };
  }

  /* ---------- fill the form ---------- */
  function setVal(el, v) {
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function byText(sel, re) {
    return Array.prototype.find.call(document.querySelectorAll(sel), function (b) { return re.test(b.textContent); });
  }
  function contractSuffixes() {
    return Array.prototype.map.call(document.querySelectorAll('[id^="c-contractNumber-"]'), function (e) {
      return e.id.replace('c-contractNumber-', '');
    });
  }

  function fillForm(data, keepOriginalDate) {
    setVal(document.getElementById('customerName'), data.customer);
    if (keepOriginalDate && data.date) setVal(document.getElementById('statementDate'), data.date);
    var iss = document.querySelector('input[name=issuer][value="' + data.issuer + '"]');
    if (iss) iss.click();
    var opt = document.querySelector('input[name=option][value="' + data.option + '"]');
    if (opt) opt.click();

    // Reset to a single contract, then add as many as needed.
    var guard = 50;
    while (contractSuffixes().length > 1 && guard--) {
      var last = contractSuffixes().slice(-1)[0];
      var field = document.getElementById('c-contractNumber-' + last);
      var card = field.closest('.panel') || field.parentElement.parentElement.parentElement;
      var rm = card.querySelector('.remove-btn');
      if (!rm) break;
      rm.click();
    }
    var addBtn = byText('button', /Add another contract/i);
    for (var i = 1; i < data.contracts.length; i++) addBtn.click();

    var sfx = contractSuffixes();
    data.contracts.forEach(function (c, i) {
      var s = sfx[i];
      setVal(document.getElementById('c-contractNumber-' + s), c.number);
      setVal(document.getElementById('c-merchantName-' + s), c.vendor);
      var amt = document.getElementById('c-monthlyAmount-' + s);
      setVal(amt, c.amount.toFixed(2));
      var curSel = amt && amt.parentElement.querySelector('select');
      if (curSel) setVal(curSel, 'FL');
      setVal(document.getElementById('c-purchaseDate-' + s), c.purchaseDate);
      setVal(document.getElementById('c-recurringDay-' + s), c.day);
      setVal(document.getElementById('c-totalMonths-' + s), c.total);
      setVal(document.getElementById('c-monthsCompleted-' + s), c.completed);
    });
  }

  /* ---------- UI ---------- */
  function buildPanel() {
    var setup = document.getElementById('setupPanel');
    if (!setup || document.getElementById('importPanel')) return;

    var css = document.createElement('style');
    css.textContent =
      '#importPanel .imp-drop{border:2px dashed #c9d2e0;border-radius:10px;padding:18px;text-align:center;cursor:pointer;transition:.15s}' +
      '#importPanel .imp-drop.over{border-color:#3b82f6;background:rgba(59,130,246,.06)}' +
      '#importPanel .imp-status{margin-top:10px;font-size:14px}' +
      '#importPanel .imp-status.err{color:#b91c1c}' +
      '#importPanel .imp-status.ok{color:#15803d}' +
      '#importPanel table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}' +
      '#importPanel th,#importPanel td{border-bottom:1px solid #e5e7eb;padding:4px 6px;text-align:left}' +
      '#importPanel label.imp-keep{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:14px}';
    document.head.appendChild(css);

    var p = document.createElement('div');
    p.id = 'importPanel';
    p.className = 'panel';
    p.style.marginBottom = '16px';
    p.innerHTML =
      '<h2 style="margin-top:0">Import an existing statement</h2>' +
      '<p style="margin-top:0">Upload a Customer Statement PDF and every field below is filled in for you. ' +
      'The new statement shows M1–M12 for each contract with the late fees recalculated.</p>' +
      '<div class="imp-drop" tabindex="0"><strong>Drop the PDF here</strong> or click to choose a file' +
      '<input type="file" accept="application/pdf,.pdf" id="importFile" hidden></div>' +
      '<label class="imp-keep"><input type="checkbox" id="importKeepDate"> ' +
      'Use the original statement date (otherwise fees are updated to the date selected below)</label>' +
      '<div class="imp-status" id="importStatus"></div>' +
      '<div id="importSummary"></div>';
    setup.parentNode.insertBefore(p, setup);

    var drop = p.querySelector('.imp-drop');
    var input = p.querySelector('#importFile');
    drop.addEventListener('click', function (e) { if (e.target !== input) input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function () { if (input.files[0]) handleFile(input.files[0]); input.value = ''; });
  }

  function status(msg, cls) {
    var s = document.getElementById('importStatus');
    s.className = 'imp-status ' + (cls || '');
    s.textContent = msg;
  }

  function handleFile(file) {
    status('Reading ' + file.name + '…');
    document.getElementById('importSummary').innerHTML = '';
    pdfToLines(file).then(function (lines) {
      var data = parseStatement(lines);
      if (!data.contracts.length) throw new Error('No contracts were found in this PDF. Is it a Customer Statement?');
      fillForm(data, document.getElementById('importKeepDate').checked);
      status('Imported ' + data.contracts.length + ' contract' + (data.contracts.length > 1 ? 's' : '') +
        ' for ' + (data.customer || 'this customer') +
        (data.date ? ' (original statement dated ' + data.date + ')' : '') +
        '. Check the details, then press Generate statement.', 'ok');
      var rows = data.contracts.map(function (c) {
        return '<tr><td>' + c.number + '</td><td>' + c.vendor + '</td><td>FL ' + c.amount.toFixed(2) +
          '</td><td>' + c.purchaseDate + '</td><td>' + c.completed + ' / ' + c.total + '</td></tr>';
      }).join('');
      document.getElementById('importSummary').innerHTML =
        '<table><thead><tr><th>Contract</th><th>Vendor</th><th>Monthly</th><th>M1 date</th><th>Paid / total</th></tr></thead><tbody>' +
        rows + '</tbody></table>';
    }).catch(function (err) {
      status(err.message || String(err), 'err');
    });
  }

  // Exposed for testing in the console.
  window.StatementImport = { parseStatement: parseStatement, pdfToLines: pdfToLines, fillForm: fillForm };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildPanel);
  else buildPanel();
})();
