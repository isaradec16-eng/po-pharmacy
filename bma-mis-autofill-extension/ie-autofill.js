/**
 * BMA MIS Auto-Filler (IE11 / Microsoft Edge IE Mode Compatible Engine)
 * เขียนด้วย ES5 มาตรฐาน เพื่อให้รันบน Internet Explorer 11 และ Edge IE Mode ได้ 100%
 * โหลดสดจาก GitHub ทุกครั้ง จึงอัปเดตโค้ดได้ทันทีโดยไม่ต้องติดตั้งใหม่
 */
(function () {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbyAvDPZrKrKK0B50nU84aK9bVTyLWT47YhjW2ppGiGPSFIrI3Lryu55CBbnPFKCXKMx/exec';
  var REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension/remote-config.json';

  var COMMITTEE_SETS = {
    '1': {
      over100k: [
        { name: 'นางสาวเบญญาภา จงชาญสิทโธ', position: 'เภสัชกรชำนาญการพิเศษ', role: 'ประธานกรรมการ' },
        { name: 'นางสาวละอองดาว โคตรแสนลี', position: 'เจ้าพนักงานเภสัชกรรมชำนาญงาน', role: 'กรรมการ' },
        { name: 'นายปิยะ บุญธรรม', position: 'เจ้าพนักงานเภสัชกรรมชำนาญงาน', role: 'กรรมการ' },
        { name: 'นางสาวนัทธมน คำประดิษฐ์', position: 'เภสัชกรปฏิบัติการ', role: 'เจ้าหน้าที่พัสดุ' }
      ],
      under100k: [
        { name: 'นางสาวเบญญาภา จงชาญสิทโธ', position: 'เภสัชกรชำนาญการพิเศษ', role: '' },
        { name: 'นางสาวนัทธมน คำประดิษฐ์', position: 'เภสัชกรปฏิบัติการ', role: 'เจ้าหน้าที่พัสดุ' }
      ]
    },
    '2': {
      over100k: [
        { name: 'นายวีรวิชญ์ เสาววัฒนพัฒน์', position: 'เภสัชกรปฏิบัติการ', role: 'ประธานกรรมการ' },
        { name: 'นางสาวธนาภรณ์ พิมพาเรือ', position: 'เจ้าพนักงานเภสัชกรรมชำนาญงาน', role: 'กรรมการ' },
        { name: 'นางสาวชิดชนก สุวรรณมณี', position: 'เจ้าพนักงานเภสัชกรรมชำนาญงาน', role: 'กรรมการ' },
        { name: 'นางสาวนัทธมน คำประดิษฐ์', position: 'เภสัชกรปฏิบัติการ', role: 'เจ้าหน้าที่พัสดุ' }
      ],
      under100k: [
        { name: 'นายวีรวิชญ์ เสาววัฒนพัฒน์', position: 'เภสัชกรปฏิบัติการ', role: '' },
        { name: 'นางสาวนัทธมน คำประดิษฐ์', position: 'เภสัชกรปฏิบัติการ', role: 'เจ้าหน้าที่พัสดุ' }
      ]
    }
  };

  var DEFAULT_FISCAL_YEARS = {
    '70': {
      label: 'ปีงบ 70 (MISS70 / Auto Crat-EGP70)',
      autocratSheetId: '1qFqdTqcP_d_nNLAX3AL0Gq21s2zjffXW2Czo3Jv1F_Y',
      missSheetId: '1tTaFrjVCPm8IrjJAg6e0Y27jIqoedLsmJz92py1O0lU'
    }
  };

  function extractSheetId(idOrUrl) {
    var s = String(idOrUrl || '').replace(/^\s+|\s+$/g, '');
    if (!s) return '';
    var m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : s;
  }

  function thaiToArabic(str) {
    var s = String(str || '');
    var th = '๐๑๒๓๔๕๖๗๘๙';
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var idx = th.indexOf(s.charAt(i));
      out += idx !== -1 ? String(idx) : s.charAt(i);
    }
    return out;
  }

  function ieEscapeJsonStr(s) {
    return '"' + String(s)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029') + '"';
  }

  function ieJsonStringify(val) {
    if (typeof window.JSON !== 'undefined' && window.JSON && typeof window.JSON.stringify === 'function') {
      try { return window.JSON.stringify(val); } catch (e) {}
    }
    if (val === null || val === undefined) return 'null';
    var t = typeof val;
    if (t === 'number') return isFinite(val) ? String(val) : 'null';
    if (t === 'boolean') return val ? 'true' : 'false';
    if (t === 'string') return ieEscapeJsonStr(val);
    if (Object.prototype.toString.call(val) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < val.length; i++) {
        arr.push(val[i] === undefined ? 'null' : ieJsonStringify(val[i]));
      }
      return '[' + arr.join(',') + ']';
    }
    if (t === 'object') {
      var props = [];
      for (var k in val) {
        if (val.hasOwnProperty(k) && val[k] !== undefined && typeof val[k] !== 'function') {
          props.push(ieEscapeJsonStr(k) + ':' + ieJsonStringify(val[k]));
        }
      }
      return '{' + props.join(',') + '}';
    }
    return 'null';
  }

  function ieJsonParse(str) {
    var s = String(str || '').replace(/^\s+|\s+$/g, '');
    if (!s) return null;
    if (typeof window.JSON !== 'undefined' && window.JSON && typeof window.JSON.parse === 'function') {
      return window.JSON.parse(s);
    }
    return (new Function('return (' + s + ')'))();
  }

  function ieUtf8ToBase64Url(str) {
    var s = String(str || '');
    var bytes = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(++i);
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    var out = '';
    for (var j = 0; j < bytes.length; j += 3) {
      var b0 = bytes[j];
      var has1 = j + 1 < bytes.length;
      var has2 = j + 2 < bytes.length;
      var b1 = has1 ? bytes[j + 1] : 0;
      var b2 = has2 ? bytes[j + 2] : 0;
      out += chars.charAt(b0 >> 2);
      out += chars.charAt(((b0 & 3) << 4) | (b1 >> 4));
      if (has1) out += chars.charAt(((b1 & 15) << 2) | (b2 >> 6));
      if (has2) out += chars.charAt(b2 & 63);
    }
    return out;
  }

  function ieSetSelectOptions(sel, opts, selectedVal) {
    if (!sel) return;
    sel.options.length = 0;
    var matchIdx = -1;
    var targetVal = selectedVal !== undefined && selectedVal !== null ? String(selectedVal) : null;
    for (var i = 0; i < opts.length; i++) {
      var opt = document.createElement('option');
      opt.value = String(opts[i].value !== undefined ? opts[i].value : '');
      opt.text = String(opts[i].text !== undefined ? opts[i].text : '');
      try {
        sel.add(opt, null);
      } catch (e) {
        sel.add(opt);
      }
      if (targetVal !== null && opt.value === targetVal && matchIdx === -1) {
        matchIdx = i;
      }
    }
    if (matchIdx >= 0) {
      sel.selectedIndex = matchIdx;
    } else if (opts.length > 0) {
      sel.selectedIndex = 0;
    }
  }

  var BRIDGE_URL = 'http://127.0.0.1:47291';
  var VENDORS_CACHE_URL = 'https://cdn.jsdelivr.net/gh/isaradec16-eng/po-pharmacy@main/bma-mis-autofill-extension/vendors-cache.json';
  var WHT_EXEMPT_KEYWORDS = ['สภากาชาด', 'เอเบิ้ล', 'เอเบิล', 'a-ble', 'abel', 'องค์การเภสัชกรรม', 'gpo', 'ยูนีซัน', 'unison'];
  var ASSIGN_TO_PRESETS = [
    'สำนักงานบริหารการเงินการคลังกรุงเทพมหานคร โอนเงินเข้าบัญชี รพจ.',
    'คณะกรรมการรับ-ส่งเงินกองการเงินโอนเข้าบัญชี รพจ.'
  ];

  function isIeMis2Portal() {
    return /bmasso\.bma\.go\.th/i.test(window.location.href || '');
  }

  var ieBridgeStatus = {
    connected: false,
    targetFound: false,
    targetTitle: '',
    calibratedCount: 0,
    totalCalibCount: 18
  };

  var state = {
    items: [],
    vendors: [],
    selectedCode: '',
    activeMode: isIeMis2Portal() ? 'pay' : 'purhire',
    paySubTab: '1',
    committeeSet: '1',
    fiscalYear: '70',
    fiscalYears: {
      '70': {
        label: 'ปีงบ 70 (MISS70 / Auto Crat-EGP70)',
        autocratSheetId: '1qFqdTqcP_d_nNLAX3AL0Gq21s2zjffXW2Czo3Jv1F_Y',
        missSheetId: '1tTaFrjVCPm8IrjJAg6e0Y27jIqoedLsmJz92py1O0lU'
      }
    },
    showYearSettings: false,
    invoiceNo: '',
    purHireNo: '',
    poNo: '',
    rcvNo: '',
    filterText: '',
    minimized: false,
    defaultAssignTo: ASSIGN_TO_PRESETS[0],
    defaultRequester: 'นางอรชุมา หุตะโกวิท',
    payChecks: { payTo: true, assignTo: true, bankCode: true, branchCode: true, accountNo: true },
    branchOverrides: {}
  };

  try {
    if (window.localStorage) {
      var saved = window.localStorage.getItem('bma_mis_ie_state');
      if (saved) {
        var parsed = ieJsonParse(saved);
        if (parsed && typeof parsed === 'object') {
          for (var k in parsed) {
            if (parsed.hasOwnProperty(k)) state[k] = parsed[k];
          }
        }
      }
    }
  } catch (e) {}
  if (isIeMis2Portal()) state.activeMode = 'pay';

  function saveState() {
    try {
      if (window.localStorage) {
        window.localStorage.setItem('bma_mis_ie_state', ieJsonStringify(state));
      }
    } catch (e) {}
  }

  function getTargetDocs() {
    var docs = [document];
    try {
      var frames = document.getElementsByTagName('frame');
      for (var i = 0; i < frames.length; i++) {
        try {
          if (frames[i].contentWindow && frames[i].contentWindow.document) {
            docs.push(frames[i].contentWindow.document);
          }
        } catch (e1) {}
      }
      var iframes = document.getElementsByTagName('iframe');
      for (var j = 0; j < iframes.length; j++) {
        try {
          if (iframes[j].contentWindow && iframes[j].contentWindow.document) {
            docs.push(iframes[j].contentWindow.document);
          }
        } catch (e2) {}
      }
    } catch (e) {}
    return docs;
  }

  function fireEvents(el) {
    if (!el) return;
    var evts = ['focus', 'input', 'change', 'blur'];
    for (var i = 0; i < evts.length; i++) {
      try {
        if (document.createEvent) {
          var evt = document.createEvent('HTMLEvents');
          evt.initEvent(evts[i], true, false);
          el.dispatchEvent(evt);
        } else if (el.fireEvent) {
          el.fireEvent('on' + evts[i]);
        }
      } catch (e) {}
    }
  }

  function setInputValue(el, val) {
    if (!el || val === undefined || val === null) return false;
    if (el.disabled || el.readOnly) return false;
    el.value = String(val);
    fireEvents(el);
    el.style.backgroundColor = '#fef9c3';
    return true;
  }

  function setSelectByTextOrVal(selectEl, targetText) {
    if (!selectEl || selectEl.tagName !== 'SELECT') return false;
    var t = String(targetText || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var opts = selectEl.options || [];
    var matched = null;
    for (var i = 0; i < opts.length; i++) {
      var ov = String(opts[i].value || '').toLowerCase();
      var ot = String(opts[i].text || '').replace(/^\s+|\s+$/g, '').toLowerCase();
      if (ov === t || ot === t) {
        matched = opts[i];
        break;
      }
    }
    if (!matched && t !== '') {
      for (var j = 0; j < opts.length; j++) {
        var ov2 = String(opts[j].value || '').toLowerCase();
        var ot2 = String(opts[j].text || '').replace(/^\s+|\s+$/g, '').toLowerCase();
        if (ot2.indexOf(t) !== -1 || ov2.indexOf(t) !== -1) {
          matched = opts[j];
          break;
        }
      }
    }
    if (!matched && t === '') {
      for (var k = 0; k < opts.length; k++) {
        if (opts[k].value === '' || String(opts[k].text || '').indexOf('เลือก') !== -1) {
          matched = opts[k];
          break;
        }
      }
    }
    if (matched) {
      selectEl.value = matched.value;
      fireEvents(selectEl);
      selectEl.style.backgroundColor = '#fef9c3';
      return true;
    }
    return false;
  }

  function ieNextEl(node) {
    var n = node ? node.nextSibling : null;
    while (n && n.nodeType !== 1) n = n.nextSibling;
    return n;
  }

  function ieFindFields(container) {
    var out = [];
    if (!container || !container.getElementsByTagName) return out;
    var tags = ['input', 'select', 'textarea'];
    for (var t = 0; t < tags.length; t++) {
      var els = container.getElementsByTagName(tags[t]);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (tags[t] === 'input' && String(el.type || '').toLowerCase() === 'hidden') continue;
        out.push(el);
      }
    }
    return out;
  }

  function ieFindInputsByType(container, wantedType) {
    var out = [];
    if (!container || !container.getElementsByTagName) return out;
    var els = container.getElementsByTagName('input');
    var want = String(wantedType || 'text').toLowerCase();
    for (var i = 0; i < els.length; i++) {
      var tp = String(els[i].type || 'text').toLowerCase();
      if (tp === want) out.push(els[i]);
    }
    return out;
  }

  function ieFindFirst(container, tagName, inputType) {
    if (!container || !container.getElementsByTagName) return null;
    var els = container.getElementsByTagName(tagName);
    if (!inputType) return els.length > 0 ? els[0] : null;
    var want = String(inputType).toLowerCase();
    for (var i = 0; i < els.length; i++) {
      if (String(els[i].type || 'text').toLowerCase() === want) return els[i];
    }
    return null;
  }

  function findInputsAfterLabel(doc, labelText) {
    var tds = [];
    var tagList = ['td', 'th', 'span', 'div'];
    for (var tl = 0; tl < tagList.length; tl++) {
      var found = doc.getElementsByTagName(tagList[tl]);
      for (var fi = 0; fi < found.length; fi++) tds.push(found[fi]);
    }
    var cleanTarget = labelText.replace(/\s+/g, '').toLowerCase();
    for (var i = 0; i < tds.length; i++) {
      var td = tds[i];
      if (td.children && td.children.length > 3) continue;
      var txt = String(td.innerText || td.textContent || '').replace(/\s+/g, '').toLowerCase();
      if (txt.indexOf(cleanTarget) !== -1) {
        var next = ieNextEl(td);
        while (next) {
          var inputs = ieFindFields(next);
          if (inputs.length > 0) return inputs;
          next = ieNextEl(next);
        }
        var selfInputs = ieFindFields(td);
        if (selfInputs.length > 0) return selfInputs;
      }
    }
    return [];
  }

  function isItemAlreadyRecorded(item) {
    if (!item) return false;
    var p = String(item.purHireNo || '').replace(/^\s+|\s+$/g, '');
    var o = String(item.poNo || '').replace(/^\s+|\s+$/g, '');
    var r = String(item.rcvNo || '').replace(/^\s+|\s+$/g, '');
    return p !== '' && o !== '' && r !== '';
  }

  function getSelectedItem() {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].code === state.selectedCode) return state.items[i];
    }
    return null;
  }

  // ==================== 8 STEPS FILL FUNCTIONS ====================
  function fillStep1(item) {
    var count = 0;
    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var subj = findInputsAfterLabel(doc, 'เรื่องการจัดซื้อ');
      if (subj[0] && setInputValue(subj[0], item.subject)) count++;
      var book = findInputsAfterLabel(doc, 'เลขที่หนังสือ');
      if (book[0] && setInputValue(book[0], '-')) count++;
      var docDt = findInputsAfterLabel(doc, 'เอกสารลงวันที่');
      if (docDt[0] && setInputValue(docDt[0], item.agreeDate)) count++;
      var agDt = findInputsAfterLabel(doc, 'วันที่เห็นชอบ');
      if (agDt[0] && setInputValue(agDt[0], item.agreeDate)) count++;
      var meth = findInputsAfterLabel(doc, 'วิธีการจัดซื้อ');
      if (meth[0] && setSelectByTextOrVal(meth[0], 'วิธีเฉพาะเจาะจง')) count++;
      var deliv = findInputsAfterLabel(doc, 'ระยะเวลาส่งมอบ');
      if (deliv.length >= 3 && setInputValue(deliv[2], item.deliveryDays || '5')) count++;

      var dept = findInputsAfterLabel(doc, 'รหัสหน่วยงาน');
      if (dept[0] && !dept[0].value) setInputValue(dept[0], '07070000');

      // Popup งบประมาณ กทม.
      var proj = findInputsAfterLabel(doc, 'งาน/โครงการ');
      if (proj[0] && setInputValue(proj[0], '0620076')) count++;
      var exp = findInputsAfterLabel(doc, 'หมวดรายจ่าย');
      if (exp[0] && setSelectByTextOrVal(exp[0], '03')) count++;
      var subExp = findInputsAfterLabel(doc, 'รายจ่ายย่อย');
      if (subExp[0] && setSelectByTextOrVal(subExp[0], '6-27')) count++;

      // Popup รายการพัสดุ
      var pType = findInputsAfterLabel(doc, 'ประเภทรายการ');
      if (pType[0] && setSelectByTextOrVal(pType[0], '11')) count++;
      var pCat = findInputsAfterLabel(doc, 'หมวด');
      if (pCat[0] && setSelectByTextOrVal(pCat[0], '09')) count++;
      var pMain = findInputsAfterLabel(doc, 'ประเภทหลัก');
      if (pMain[0] && setSelectByTextOrVal(pMain[0], '02')) count++;
      var pSub = findInputsAfterLabel(doc, 'ประเภทรอง');
      if (pSub[0] && setSelectByTextOrVal(pSub[0], '06')) count++;

      // ตารางงบประมาณและตารางพัสดุ
      var trs = doc.getElementsByTagName('tr');
      for (var r = 0; r < trs.length; r++) {
        var tr = trs[r];
        var inps = ieFindInputsByType(tr, 'text');
        var cb = ieFindFirst(tr, 'input', 'checkbox');
        var hasBg = false;
        var hasMed = false;
        var editable = [];
        for (var k = 0; k < inps.length; k++) {
          var v = String(inps[k].value || '');
          if (/0620076|ค่ายาและเวชภัณฑ์|00002/.test(v)) hasBg = true;
          if (/09020600|เวชภัณฑ์/.test(v)) hasMed = true;
          if (!inps[k].readOnly && !inps[k].disabled && !/09020600/.test(v)) editable.push(inps[k]);
        }
        if (hasBg) {
          if (cb && !cb.checked) { cb.checked = true; fireEvents(cb); count++; }
          if (editable.length > 0 && setInputValue(editable[editable.length - 1], item.amountFormatted)) count++;
        }
        if (hasMed) {
          if (cb && !cb.checked) { cb.checked = true; fireEvents(cb); count++; }
          if (editable.length >= 2) {
            setInputValue(editable[0], item.amountFormatted);
            setInputValue(editable[1], '1');
            count += 2;
          }
        }
      }
    }
    return count;
  }

  function fillStep2(item) {
    var count = 0;
    var purNo = state.purHireNo || item.purHireNo || '';
    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var pur = findInputsAfterLabel(doc, 'รหัสจัดซื้อ');
      if (pur.length >= 2 && purNo && setInputValue(pur[1], purNo)) count++;

      if (item.vendorTaxId) {
        var tax = findInputsAfterLabel(doc, 'เลขประจำตัวผู้เสียภาษี');
        if (tax[0] && setInputValue(tax[0], item.vendorTaxId)) count++;
      }

      // รายละเอียดรายการที่เสนอ
      var cbs = ieFindInputsByType(doc, 'checkbox');
      for (var c = 0; c < cbs.length; c++) {
        var pTxt = (cbs[c].parentNode ? (cbs[c].parentNode.innerText || cbs[c].parentNode.textContent || '') : '');
        if (pTxt.indexOf('ได้รับการคัดเลือก') !== -1 && !cbs[c].checked) {
          cbs[c].checked = true;
          fireEvents(cbs[c]);
          count++;
        }
      }

      var trs = doc.getElementsByTagName('tr');
      for (var r = 0; r < trs.length; r++) {
        var tr = trs[r];
        var inps = ieFindInputsByType(tr, 'text');
        var isMed = false;
        var hasTax = false;
        var editable = [];
        for (var k = 0; k < inps.length; k++) {
          var v = String(inps[k].value || '');
          if (/09020600|เวชภัณฑ์/.test(v)) isMed = true;
          if (item.vendorTaxId && v.indexOf(item.vendorTaxId) !== -1) hasTax = true;
          if (!inps[k].readOnly && !inps[k].disabled) editable.push(inps[k]);
        }
        if (hasTax) {
          var cb1 = ieFindFirst(tr, 'input', 'checkbox');
          if (cb1 && !cb1.checked) { cb1.checked = true; fireEvents(cb1); count++; }
        }
        if (isMed && editable.length >= 2) {
          var cb2 = ieFindFirst(tr, 'input', 'checkbox');
          if (cb2 && !cb2.checked) { cb2.checked = true; fireEvents(cb2); }
          setInputValue(editable[0], '-');
          setInputValue(editable[1], '-');
          count += 2;
          if (editable.length >= 4) {
            setInputValue(editable[2], item.amountFormatted);
            setInputValue(editable[3], '1.00');
            count += 2;
          }
        }
      }
    }
    return count;
  }

  function fillStep3(item) {
    var count = 0;
    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var book = findInputsAfterLabel(doc, 'เลขที่หนังสือ');
      if (book[0] && setInputValue(book[0], '-')) count++;
      var docDt = findInputsAfterLabel(doc, 'เอกสารลงวันที่');
      if (docDt[0] && setInputValue(docDt[0], item.quoteDate)) count++;
      var appDt = findInputsAfterLabel(doc, 'วันที่อนุมัติ');
      if (appDt[0] && setInputValue(appDt[0], item.quoteDate)) count++;
    }
    return count;
  }

  function fillStep4(item) {
    var count = 0;
    var purNo = state.purHireNo || item.purHireNo || '';
    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var docType = findInputsAfterLabel(doc, 'ประเภทเอกสาร');
      if (docType[0]) setSelectByTextOrVal(docType[0], '11');
      var dept = findInputsAfterLabel(doc, 'หน่วยงานดำเนินการ');
      if (dept[0] && setInputValue(dept[0], '07070000')) count++;
      var pur = findInputsAfterLabel(doc, 'รหัสจัดซื้อ');
      if (pur.length >= 2 && purNo && setInputValue(pur[1], purNo)) count++;
      var signDt = findInputsAfterLabel(doc, 'วันที่สั่งซื้อ/ลงนามสัญญา');
      if (signDt[0] && setInputValue(signDt[0], item.poSignDate)) count++;
      var startDt = findInputsAfterLabel(doc, 'วันที่เริ่มสัญญา');
      if (startDt[0] && setInputValue(startDt[0], item.rcvDate || item.contractStartDate)) count++;
      var endDt = findInputsAfterLabel(doc, 'วันที่สิ้นสุดสัญญา');
      if (endDt[0] && setInputValue(endDt[0], item.contractEndDate)) count++;
      var dur = findInputsAfterLabel(doc, 'ระยะเวลาดำเนินการ');
      if (dur.length >= 3 && setInputValue(dur[2], item.deliveryDays || '5')) count++;
      var fine = findInputsAfterLabel(doc, 'เงื่อนไขการปรับ');
      if (fine[0] && setInputValue(fine[0], '0.2 % ของราคาสินค้าที่ยังไม่ได้รับมอบ')) count++;
      var rcvDept = findInputsAfterLabel(doc, 'หน่วยงานตรวจรับ');
      if (rcvDept[0] && setInputValue(rcvDept[0], '07070000')) count++;
      var terms = findInputsAfterLabel(doc, 'จำนวนงวดทั้งหมด');
      if (terms[0] && setInputValue(terms[0], '1')) count++;
    }
    return count;
  }

  function fillStep5(item) {
    var count = 0;
    var poNo = state.poNo || item.poNo || state.purHireNo || item.purHireNo || '';
    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var dept = findInputsAfterLabel(doc, 'หน่วยงานทำสัญญา');
      if (dept[0] && setInputValue(dept[0], '07070000')) count++;
      var po = findInputsAfterLabel(doc, 'เลขที่ใบสั่งซื้อ/สัญญา');
      if (po.length >= 2) {
        if (po[0].tagName === 'SELECT') {
          setSelectByTextOrVal(po[0], '11');
          if (poNo && setInputValue(po[1], poNo)) count++;
        } else if (poNo && setInputValue(po[1], poNo)) count++;
      }
      var inv = findInputsAfterLabel(doc, 'เลขที่เอกสารส่งมอบ');
      if (inv[0] && state.invoiceNo && setInputValue(inv[0], state.invoiceNo)) count++;
      var docDt = findInputsAfterLabel(doc, 'เอกสารลงวันที่');
      if (docDt[0] && setInputValue(docDt[0], item.rcvDate)) count++;
      var term = findInputsAfterLabel(doc, 'งวดในใบสั่งซื้อ/สัญญา');
      if (term[0] && setInputValue(term[0], '1')) count++;
    }
    return count;
  }

  function fillStep6(item) {
    var count = 0;
    var rcvNo = state.rcvNo || item.rcvNo || state.poNo || item.poNo || '';
    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var rcv = findInputsAfterLabel(doc, 'เลขที่ใบตรวจรับ');
      if (rcv[0] && rcvNo && setInputValue(rcv[0], rcvNo)) count++;
      var rcvDocDt = findInputsAfterLabel(doc, 'ใบตรวจรับลงวันที่');
      if (rcvDocDt[0] && setInputValue(rcvDocDt[0], item.rcvDate)) count++;
      var effDt = findInputsAfterLabel(doc, 'วันที่ตรวจรับมีผล');
      if (effDt[0] && setInputValue(effDt[0], item.rcvDate)) count++;

      var tbls = doc.getElementsByTagName('table');
      for (var t = 0; t < tbls.length; t++) {
        var txt = tbls[t].innerText || '';
        if (txt.indexOf('การตรวจรับครั้งสุดท้าย') !== -1) {
          var sel = ieFindFirst(tbls[t], 'select');
          if (sel && setSelectByTextOrVal(sel, '1')) count++;
          var cb = ieFindFirst(tbls[t], 'input', 'checkbox');
          if (cb && !cb.checked) { cb.checked = true; fireEvents(cb); count++; }
        }
        if (txt.indexOf('แจ้งส่ง') !== -1 && txt.indexOf('ตรวจรับ') !== -1) {
          var trs = tbls[t].getElementsByTagName('tr');
          for (var r = 0; r < trs.length; r++) {
            var inps = ieFindInputsByType(trs[r], 'text');
            var isMed = false;
            for (var k = 0; k < inps.length; k++) {
              if (/09020600|เวชภัณฑ์/.test(inps[k].value)) isMed = true;
            }
            if (isMed) {
              for (var m = 0; m < inps.length; m++) {
                if (!inps[m].readOnly && !inps[m].disabled) {
                  if (setInputValue(inps[m], '1.00')) count++;
                }
              }
            }
          }
        }
      }
    }
    return count;
  }

  function fillStep7(item) {
    var count = 0;
    var amount = item ? Number(item.amount || 0) : 0;
    var isOver100k = amount >= 100000;
    var chosenSet = COMMITTEE_SETS[state.committeeSet] || COMMITTEE_SETS['1'];
    var members = isOver100k ? chosenSet.over100k : chosenSet.under100k;
    var poNo = state.poNo || (item && item.poNo) || state.purHireNo || (item && item.purHireNo) || '';

    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      var docType = findInputsAfterLabel(doc, 'ประเภทเอกสาร');
      if (docType[0] && setSelectByTextOrVal(docType[0], '11')) count++;
      var po = findInputsAfterLabel(doc, 'เลขที่ใบสั่งซื้อ/สัญญา');
      if (po.length >= 2) {
        if (!po[0].value || po[0].value === 'undefined') setInputValue(po[0], '11');
        if (poNo && setInputValue(po[1], poNo)) count++;
        if (po[2]) setInputValue(po[2], state.fiscalYear || '70');
      }

      // ล้างคำว่า undefined ทั้งหมด
      var allInps = ieFindInputsByType(doc, 'text');
      for (var a = 0; a < allInps.length; a++) {
        if (allInps[a].value && allInps[a].value.replace(/^\s+|\s+$/g, '').toLowerCase() === 'undefined') {
          allInps[a].value = '';
        }
      }

      var tbls = doc.getElementsByTagName('table');
      for (var t = 0; t < tbls.length; t++) {
        var txt = tbls[t].innerText || '';
        if (txt.indexOf('ชื่อคณะกรรมการ') !== -1 && txt.indexOf('ตำแหน่ง') !== -1) {
          var trs = tbls[t].getElementsByTagName('tr');
          var dataRows = [];
          for (var r = 0; r < trs.length; r++) {
            if (ieFindInputsByType(trs[r], 'text').length >= 2 && ieFindFirst(trs[r], 'select')) {
              dataRows.push(trs[r]);
            }
          }
          for (var idx = 0; idx < dataRows.length; idx++) {
            var tr = dataRows[idx];
            var tInps = ieFindInputsByType(tr, 'text');
            var sel = ieFindFirst(tr, 'select');
            var cb = ieFindFirst(tr, 'input', 'checkbox');
            if (idx < members.length) {
              var m = members[idx];
              setInputValue(tInps[0], m.name);
              setInputValue(tInps[1], m.position);
              setSelectByTextOrVal(sel, m.role || '');
              if (cb && !cb.checked) { cb.checked = true; fireEvents(cb); }
              count++;
            } else {
              tInps[0].value = '';
              tInps[1].value = '';
              setSelectByTextOrVal(sel, '');
              if (cb && cb.checked) { cb.checked = false; fireEvents(cb); }
            }
          }
        }
      }
    }
    return count;
  }

  function fillStep8(item) {
    var count = 0;
    var rcvNo = state.rcvNo || (item && item.rcvNo) || state.poNo || (item && item.poNo) || '';
    var yr = state.fiscalYear || '70';
    var code = (item && item.code) || state.selectedCode || '';
    var pdfBaseName = 'ใบตรวจรับ_' + (rcvNo || 'X') + '-' + yr + (code ? '_' + code : '');
    try {
      document.title = pdfBaseName;
    } catch (e) {}

    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      try {
        doc.title = pdfBaseName;
      } catch (e2) {}
      var dept = findInputsAfterLabel(doc, 'หน่วยงานตรวจรับ');
      if (dept[0] && setInputValue(dept[0], '07070000')) count++;
      var rcv = findInputsAfterLabel(doc, 'เลขที่ใบตรวจรับ');
      if (rcv.length >= 2) {
        if (rcv[0].tagName === 'SELECT') {
          setSelectByTextOrVal(rcv[0], 'จัดซื้อ');
          if (rcvNo && setInputValue(rcv[1], rcvNo)) count++;
          if (rcv[2]) setInputValue(rcv[2], state.fiscalYear || '70');
        } else if (rcvNo && setInputValue(rcv[0], rcvNo)) count++;
      }
      var cmd = findInputsAfterLabel(doc, 'ตามคำสั่ง');
      if (cmd[0] && setInputValue(cmd[0], 'อนุมัติ ผว.กทม.')) count++;
      var loc = findInputsAfterLabel(doc, 'สถานที่ตรวจรับ');
      if (loc[0] && setInputValue(loc[0], 'โรงพยาบาลเจริญกรุงประชารักษ์')) count++;
      var cls = findInputsAfterLabel(doc, 'ผู้ขายได้ส่งมอบตามสัญญา');
      if (cls[0] && setInputValue(cls[0], '1')) count++;
      var ho = findInputsAfterLabel(doc, 'คณะกรรมการได้ส่งมอบพัสดุให้แก่');
      if (ho[0] && setInputValue(ho[0], 'นางสาวนัทธมน คำประดิษฐ์')) count++;
      var aff = findInputsAfterLabel(doc, 'สังกัดของเจ้าหน้าที่พัสดุ');
      if (aff[0] && setInputValue(aff[0], 'กลุ่มงานเภสัชกรรม รพ.เจริญกรุงประชารักษ์ สำนักการแพทย์')) count++;
    }
    return count;
  }

  function isIePageStep7Or8() {
    var fullUrl = window.location.href;
    var fullText = '';
    var docs = getTargetDocs();
    for (var i = 0; i < docs.length; i++) {
      try {
        fullText += ' ' + (docs[i].body ? docs[i].body.innerText : '');
        fullUrl += ' ' + (docs[i].location ? docs[i].location.href : '');
      } catch (e) {}
    }
    return (
      /Rep_pur_rcv\.jsp|Frm_pur_hire_rcv_committee\.jsp/i.test(fullUrl) ||
      fullText.indexOf('รายงานรายละเอียดการตรวจรับ') !== -1 ||
      fullText.indexOf('บันทึกข้อมูลคณะกรรมการตรวจรับ') !== -1 ||
      fullText.indexOf('รายชื่อคณะกรรมการตรวจรับ') !== -1
    );
  }

  function runAutoFill(stepOverride, isSilent) {
    var item = getSelectedItem();
    if (!item) {
      if (!isSilent) alert('กรุณาเลือกรายการยาจาก Google Sheet ก่อนครับ');
      return;
    }
    var rec = isItemAlreadyRecorded(item);
    var allowStep = stepOverride === 7 || stepOverride === 8 || (!stepOverride && isIePageStep7Or8());
    if (rec && !allowStep) {
      if (!isSilent) {
        alert('มีประวัติการลงข้อมูลแล้ว\n\nรายการ [' + item.code + '] มีรหัสจัดซื้อ / ใบสั่งซื้อ / ใบตรวจรับ ครบแล้ว\nห้ามลงข้อมูลซ้ำในขั้นตอนที่ 1-6 (สามารถกดปุ่ม 7.กรรมการ หรือ 8.ใบตรวจรับ ได้ตามปกติ)');
      }
      return;
    }
    var count = 0;
    if (stepOverride) {
      if (stepOverride === 1) count += fillStep1(item);
      if (stepOverride === 2) count += fillStep2(item);
      if (stepOverride === 3) count += fillStep3(item);
      if (stepOverride === 4) count += fillStep4(item);
      if (stepOverride === 5) count += fillStep5(item);
      if (stepOverride === 6) count += fillStep6(item);
      if (stepOverride === 7) count += fillStep7(item);
      if (stepOverride === 8) count += fillStep8(item);
    } else if (rec) {
      count += fillStep7(item);
      count += fillStep8(item);
    } else {
      count += fillStep1(item);
      count += fillStep2(item);
      count += fillStep3(item);
      count += fillStep4(item);
      count += fillStep5(item);
      count += fillStep6(item);
      count += fillStep7(item);
      count += fillStep8(item);
    }
    var st = document.getElementById('bma-ie-status');
    if (count > 0) {
      highlightIeApprovalButtons();
      if (st) st.innerHTML = '[สำเร็จ] กรอกอัตโนมัติ [' + item.code + '] แล้ว (' + count + ' จุด) • รอคุณกด [บันทึก]';
    } else if (!isSilent && st) {
      st.innerHTML = '[ไม่พบช่อง] ไม่พบช่องที่ต้องกรอกในหน้านี้';
    }
  }

  // ==================== IE MIS2 DISBURSEMENT (ES5) HELPERS ====================
  function iePad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function ieTodayThaiSlash() {
    var d = new Date();
    return iePad2(d.getDate()) + '/' + iePad2(d.getMonth() + 1) + '/' + (d.getFullYear() + 543);
  }

  function ieNormalizeCompany(name) {
    return thaiToArabic(String(name || ''))
      .replace(/บริษัท|ห้างหุ้นส่วนจำกัด|หจก\.?|จำกัด|\(มหาชน\)|\(ประเทศไทย\)|\.|,|-|\s+/gi, '')
      .toLowerCase();
  }

  function ieIsWhtExempt(companyName) {
    var s = String(companyName || '').toLowerCase();
    if (!s) return false;
    for (var i = 0; i < WHT_EXEMPT_KEYWORDS.length; i++) {
      if (s.indexOf(WHT_EXEMPT_KEYWORDS[i].toLowerCase()) !== -1) return true;
    }
    return false;
  }

  function ieCalcTax(amountVal, companyName) {
    var amt = parseFloat(amountVal) || 0;
    if (amt <= 0) return { base: 0, vat7: 0, wht1: 0, net: 0, exempt: false };
    var base = Math.round((amt / 1.07) * 100) / 100;
    var vat7 = Math.round((amt - base) * 100) / 100;
    var exempt = ieIsWhtExempt(companyName);
    var wht1 = exempt ? 0 : Math.round(base * 0.01 * 100) / 100;
    var net = Math.round((amt - wht1) * 100) / 100;
    return { base: base, vat7: vat7, wht1: wht1, net: net, exempt: exempt };
  }

  function ieFormatNum(n) {
    var num = parseFloat(n) || 0;
    var parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function ieIsAidsBudget(item) {
    if (!item) return false;
    if (item.isAidsBudget) return true;
    return /งบเอดส์|เอดส์|aids/i.test(String(item.code || '')) || /เอดส์|อุดหนุน/i.test(String(item.budgetType || ''));
  }

  function ieFormatPayDesc(item, vendor) {
    if (!item) return '';
    var subj = String(item.missSubject || item.subject || '').replace(/^\s+|\s+$/g, '');
    var parenDesc = !subj ? '' : (subj.indexOf('ค่า') === 0 ? '(' + subj + ')' : '(ค่า' + subj + ')');
    var acctType = vendor && vendor.accountType ? String(vendor.accountType).replace(/^\s+|\s+$/g, '') : '';
    if (acctType && parenDesc) return acctType + '\n' + parenDesc;
    return parenDesc || acctType;
  }

  function ieGetBranchCode(v) {
    if (!v) return '';
    var cKey = String(v.company || '').replace(/^\s+|\s+$/g, '');
    if (cKey && state.branchOverrides && state.branchOverrides[cKey]) {
      return state.branchOverrides[cKey];
    }
    if (v.branchCode && String(v.branchCode).replace(/^\s+|\s+$/g, '')) {
      return String(v.branchCode).replace(/^\s+|\s+$/g, '');
    }
    var digits = thaiToArabic(String(v.accountNo || '')).replace(/\D/g, '');
    return digits.length >= 3 ? '0' + digits.substring(0, 3) : '';
  }

  function ieFindVendor(vendorName, taxId) {
    var list = state.vendors || [];
    var cleanTax = thaiToArabic(String(taxId || '')).replace(/\D/g, '');
    var i;
    if (cleanTax) {
      for (i = 0; i < list.length; i++) {
        if (String(list[i].taxId || '').replace(/\D/g, '') === cleanTax) return list[i];
      }
    }
    var nKey = ieNormalizeCompany(vendorName);
    if (!nKey) return null;
    for (i = 0; i < list.length; i++) {
      if (ieNormalizeCompany(list[i].company) === nKey) return list[i];
    }
    if (nKey.length >= 4) {
      for (i = 0; i < list.length; i++) {
        var vk = ieNormalizeCompany(list[i].company);
        if (vk && (vk.indexOf(nKey) !== -1 || nKey.indexOf(vk) !== -1)) return list[i];
      }
    }
    return null;
  }

  function ieCopyClipboard(text) {
    var val = String(text || '');
    if (!val) return false;
    try {
      if (window.clipboardData && window.clipboardData.setData) {
        window.clipboardData.setData('Text', val);
        return true;
      }
    } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = val;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e2) {
      return false;
    }
  }

  var ieBridgeSeq = 0;

  function ieBridgeReq(endpoint, method, payload, cb) {
    ieBridgeSeq++;
    var cbName = '__bmaBrCb_' + ieBridgeSeq + '_' + new Date().getTime();
    var done = false;
    var sc = null;
    var timer = null;

    function finish(ok, data) {
      if (done) return;
      done = true;
      if (timer) { try { clearTimeout(timer); } catch (e0) {} }
      try { window[cbName] = undefined; delete window[cbName]; } catch (e1) { try { window[cbName] = null; } catch (e2) {} }
      if (sc && sc.parentNode) { try { sc.parentNode.removeChild(sc); } catch (e3) {} }
      if (cb) cb(ok, data);
    }

    try {
      window[cbName] = function (data) {
        finish(true, data);
      };
      var url = BRIDGE_URL + '/jsonp?path=' + encodeURIComponent(endpoint || '/status') + '&cb=' + cbName;
      if (payload !== undefined && payload !== null && (method || 'GET').toUpperCase() === 'POST') {
        url += '&b64=' + ieUtf8ToBase64Url(ieJsonStringify(payload));
      }
      url += '&t=' + new Date().getTime();

      var timeoutMs = 45000;
      if (endpoint === '/status' || endpoint === '/vendors-cache') timeoutMs = 4500;
      else if (endpoint === '/calibrate' || endpoint === '/pick-window') timeoutMs = 300000;

      timer = setTimeout(function () {
        finish(false, null);
      }, timeoutMs);

      sc = document.createElement('script');
      sc.type = 'text/javascript';
      sc.charset = 'utf-8';
      sc.async = true;
      sc.onerror = function () {
        finish(false, null);
      };
      sc.src = url;
      var target = document.getElementsByTagName('head')[0] || document.body || document.documentElement;
      target.appendChild(sc);
    } catch (e) {
      finish(false, null);
    }
  }

  // ==================== BUILD IE PANEL UI (CRISP IE7/IE8/IE11 QUIRKS MODE SAFE) ====================
  function ieGetScrollTop() {
    return window.pageYOffset ||
      (document.documentElement && document.documentElement.scrollTop) ||
      (document.body && document.body.scrollTop) || 0;
  }

  function ieGetViewportHeight() {
    return window.innerHeight ||
      (document.documentElement && document.documentElement.clientHeight) ||
      (document.body && document.body.clientHeight) || 680;
  }

  var ieIsQuirks = true; // Always use IE5-IE11 universal absolute+scroll pinning so Quirks/IE7/IE8 modes never drop panel to bottom-left

  var oldStyle = document.getElementById('bma-ie-style');
  if (oldStyle) oldStyle.parentNode.removeChild(oldStyle);
  var styleEl = document.createElement('style');
  styleEl.id = 'bma-ie-style';
  styleEl.type = 'text/css';
  var cssText =
    '#bma-ie-panel, #bma-ie-panel * { box-sizing: border-box; font-family: "Leelawadee UI", "Segoe UI", Tahoma, sans-serif !important; line-height: 1.4; }' +
    '#bma-ie-panel { position: absolute !important; top: 10px; right: 12px; left: auto; bottom: auto; width: 416px; overflow-y: auto; background: #ffffff; border: 2px solid #1d4ed8; border-radius: 10px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.25); font-size: 13.5px; color: #0f172a; z-index: 2147483647; padding: 12px; text-align: left; }' +
    '#bma-ie-panel table.bma-ie-tbl { width: 100%; border-collapse: collapse; border-spacing: 0; border: 0; margin: 0 0 7px 0; padding: 0; background: transparent; table-layout: fixed; }' +
    '#bma-ie-panel table.bma-ie-tbl-tight { width: 100%; border-collapse: collapse; border-spacing: 0; border: 0; margin: 0; padding: 0; background: transparent; }' +
    '#bma-ie-panel table.bma-ie-tbl td, #bma-ie-panel table.bma-ie-tbl-tight td { border: 0; padding: 0; margin: 0; background: transparent; vertical-align: middle; text-align: left; font-size: 13px; }' +
    '#bma-ie-panel td.bma-ie-pr6 { padding-right: 6px !important; }' +
    '#bma-ie-panel td.bma-ie-btncol { width: 58px; padding-left: 5px !important; }' +
    '#bma-ie-panel td.bma-ie-chkcol { width: 94px; font-size: 12.5px; font-weight: 600; color: #1e293b; white-space: nowrap; }' +
    '#bma-ie-panel input[type="text"], #bma-ie-panel select, #bma-ie-panel textarea { font-size: 13.5px; color: #0f172a; background: #ffffff; border: 1px solid #94a3b8; border-radius: 5px; padding: 5px 7px; width: 100%; }' +
    '#bma-ie-panel input[type="text"]:focus, #bma-ie-panel select:focus, #bma-ie-panel textarea:focus { border-color: #2563eb; outline: none; }' +
    '#bma-ie-panel button { font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; }' +
    '.bma-ie-lbl { font-size: 12.5px; font-weight: 600; color: #334155; margin-bottom: 3px; }' +
    '.bma-ie-copy { width: 54px; height: 30px; background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-size: 12px !important; font-weight: 600; padding: 0; }' +
    '.bma-ie-copy:hover { background: #bae6fd; }' +
    '.bma-ie-actbtn { width: 100%; padding: 8px 10px; border: none; color: #ffffff; font-size: 13px !important; font-weight: 600; margin-bottom: 6px; text-align: center; }';
  if (styleEl.styleSheet) {
    styleEl.styleSheet.cssText = cssText;
  } else {
    styleEl.appendChild(document.createTextNode(cssText));
  }
  (document.head || document.getElementsByTagName('head')[0] || document.documentElement).appendChild(styleEl);

  var oldPanel = document.getElementById('bma-ie-panel');
  if (oldPanel) oldPanel.parentNode.removeChild(oldPanel);

  var panel = document.createElement('div');
  panel.id = 'bma-ie-panel';
  panel.style.position = 'absolute';
  panel.style.top = (ieGetScrollTop() + 10) + 'px';
  panel.style.right = '12px';
  panel.style.left = 'auto';
  panel.style.bottom = 'auto';
  panel.style.width = '416px';
  panel.style.zIndex = '2147483647';
  panel.style.background = '#ffffff';
  panel.style.border = '2px solid #1d4ed8';
  panel.style.padding = '12px';
  panel.style.overflowY = 'auto';
  panel.style.maxHeight = Math.max(360, ieGetViewportHeight() - 28) + 'px';

  function getCurrentIeFyEntry() {
    if (!state.fiscalYears || typeof state.fiscalYears !== 'object') {
      state.fiscalYears = { '70': DEFAULT_FISCAL_YEARS['70'] };
    }
    if (!state.fiscalYears['70']) {
      state.fiscalYears['70'] = DEFAULT_FISCAL_YEARS['70'];
    }
    var fy = String(state.fiscalYear || '70').replace(/^\s+|\s+$/g, '');
    if (!state.fiscalYears[fy]) {
      state.fiscalYears[fy] = {
        label: 'ปีงบ ' + fy + ' (MISS' + fy + ' / Auto Crat-EGP' + fy + ')',
        autocratSheetId: DEFAULT_FISCAL_YEARS['70'].autocratSheetId,
        missSheetId: DEFAULT_FISCAL_YEARS['70'].missSheetId
      };
    }
    return state.fiscalYears[fy];
  }

  var curIeEntry = getCurrentIeFyEntry();
  var ieChecks = state.payChecks || { payTo: true, assignTo: true, bankCode: true, branchCode: true, accountNo: true };

  function ieInRowHtml(fieldHtml, id, isMulti) {
    return '<table class="bma-ie-tbl-tight"><tr>' +
      '<td>' + fieldHtml + '</td>' +
      '<td class="bma-ie-btncol"><button type="button" class="bma-ie-copy" data-src="' + id + '" data-multi="' + (isMulti ? '1' : '0') + '" title="คัดลอกหรือวางลงช่องที่เลือก">คัดลอก</button></td>' +
    '</tr></table>';
  }

  function ieChkRowHtml(ckId, checked, label, inId) {
    return '<table class="bma-ie-tbl-tight" style="margin-bottom:6px;"><tr>' +
      '<td class="bma-ie-chkcol"><label style="cursor:pointer;"><input id="' + ckId + '" type="checkbox" ' + (checked ? 'checked="checked"' : '') + ' /> ' + label + '</label></td>' +
      '<td><input id="' + inId + '" type="text" /></td>' +
      '<td class="bma-ie-btncol"><button type="button" class="bma-ie-copy" data-src="' + inId + '" data-multi="0" title="คัดลอกหรือวางลงช่องที่เลือก">คัดลอก</button></td>' +
    '</tr></table>';
  }

  panel.innerHTML =
    '<div id="bma-ie-header" style="background:#1d4ed8;color:#ffffff;padding:8px 10px;border-radius:7px;margin-bottom:9px;cursor:move;" title="ลากแถบนี้เพื่อย้ายตำแหน่งแผงควบคุม">' +
      '<table class="bma-ie-tbl-tight"><tr>' +
        '<td style="color:#ffffff;font-size:14.5px;font-weight:700;">' +
          'BMA MIS &amp; MIS2 <span style="font-size:11px;font-weight:600;background:#2563eb;color:#ffffff;padding:2px 6px;border-radius:4px;margin-left:4px;">ARISSARA.K v2.2</span>' +
        '</td>' +
        '<td style="width:94px;text-align:right;">' +
          '<button id="bma-ie-sync" type="button" style="background:#3b82f6;color:#ffffff;border:none;padding:4px 9px;font-size:12px;margin-right:4px;">ซิงค์</button>' +
          '<button id="bma-ie-min" type="button" style="background:#1e40af;color:#ffffff;border:none;padding:4px 8px;font-size:12px;">-</button>' +
        '</td>' +
      '</tr></table>' +
    '</div>' +

    '<div id="bma-ie-body">' +
      '<div style="background:#e2e8f0;padding:4px;border-radius:8px;margin-bottom:9px;">' +
        '<table class="bma-ie-tbl" style="margin-bottom:0;"><tr>' +
          '<td class="bma-ie-pr6"><button id="bma-ie-tab-pur" type="button" style="width:100%;padding:8px 4px;border:none;font-size:13px;">จัดซื้อ/ตรวจรับ (8 ขั้น)</button></td>' +
          '<td><button id="bma-ie-tab-pay" type="button" style="width:100%;padding:8px 4px;border:none;font-size:13px;">เบิกจ่าย MIS2 (ฎีกา)</button></td>' +
        '</tr></table>' +
      '</div>' +

      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;padding:8px 9px;margin-bottom:8px;">' +
        '<table class="bma-ie-tbl-tight" style="margin-bottom:5px;"><tr>' +
          '<td style="color:#1e3a8a;font-weight:700;font-size:12.5px;">ปีงบประมาณ &amp; ไฟล์ปลายทาง</td>' +
          '<td style="width:130px;text-align:right;">' +
            '<button id="bma-ie-fy-toggle" type="button" style="background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;padding:3px 8px;font-size:11.5px;">+ เพิ่มปีงบ / ตั้งค่า</button>' +
          '</td>' +
        '</tr></table>' +
        '<select id="bma-ie-fy-select" style="border-color:#93c5fd;font-weight:600;color:#1e3a8a;"></select>' +
        '<div id="bma-ie-fy-box" style="display:none;margin-top:8px;padding-top:8px;border-top:1px dashed #93c5fd;">' +
          '<div class="bma-ie-lbl">ปีงบประมาณ (เช่น 70, 71, 72):</div>' +
          '<table class="bma-ie-tbl"><tr>' +
            '<td class="bma-ie-pr6" style="width:90px;"><input id="bma-ie-cfg-fy" type="text" value="' + state.fiscalYear + '" /></td>' +
            '<td><button id="bma-ie-add-next-fy" type="button" style="width:100%;padding:6px;background:#fff;color:#1d4ed8;border:1px solid #93c5fd;font-size:12px;">+ สร้างปีถัดไป</button></td>' +
          '</tr></table>' +
          '<div class="bma-ie-lbl">ลิงก์/ID ไฟล์ Auto Crat-EGP:</div>' +
          '<input id="bma-ie-cfg-ac" type="text" value="' + (curIeEntry.autocratSheetId || '') + '" placeholder="วางลิงก์หรือ ID Google Sheet..." style="margin-bottom:6px;font-size:12px;" />' +
          '<div class="bma-ie-lbl">ลิงก์/ID ไฟล์ MISS:</div>' +
          '<input id="bma-ie-cfg-miss" type="text" value="' + (curIeEntry.missSheetId || '') + '" placeholder="วางลิงก์หรือ ID Google Sheet..." style="margin-bottom:7px;font-size:12px;" />' +
          '<button id="bma-ie-save-fy" type="button" class="bma-ie-actbtn" style="background:#1d4ed8;margin-bottom:0;">บันทึกปีงบ &amp; โหลดไฟล์ใหม่</button>' +
        '</div>' +
      '</div>' +

      '<div style="margin-bottom:8px;">' +
        '<input id="bma-ie-search" type="text" placeholder="พิมพ์ค้นหารหัส เช่น 1งบ, 7งบ, 30งบ..." style="margin-bottom:6px;" />' +
        '<select id="bma-ie-select" style="font-weight:600;"></select>' +
      '</div>' +

      /* ===== MODE 1: จัดซื้อ/ตรวจรับ (8 ขั้นตอน) ===== */
      '<div id="bma-ie-mode-pur">' +
        '<div id="bma-ie-summary" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:7px;padding:8px 10px;margin-bottom:8px;font-size:13px;">กำลังโหลดข้อมูลจาก Google Sheet...</div>' +
        '<table class="bma-ie-tbl"><tr>' +
          '<td class="bma-ie-pr6"><div class="bma-ie-lbl">รหัสจัดซื้อ</div><input id="bma-ie-purno" type="text" placeholder="เช่น 8" /></td>' +
          '<td class="bma-ie-pr6"><div class="bma-ie-lbl">ใบสั่งซื้อ</div><input id="bma-ie-pono" type="text" placeholder="เช่น 8" /></td>' +
          '<td><div class="bma-ie-lbl">ใบตรวจรับ</div><input id="bma-ie-rcvno" type="text" placeholder="เช่น 8" /></td>' +
        '</tr></table>' +
        '<table class="bma-ie-tbl"><tr>' +
          '<td class="bma-ie-pr6" style="width:54%;"><div class="bma-ie-lbl">เลขที่บิล (หน้าส่งมอบ)</div><input id="bma-ie-inv" type="text" placeholder="เลขที่บิล..." /></td>' +
          '<td><div class="bma-ie-lbl">ชุดกรรมการ</div><select id="bma-ie-comm"><option value="1">ชุดที่ 1 (เบญญาภา)</option><option value="2">ชุดที่ 2 (วีรวิชญ์)</option></select></td>' +
        '</tr></table>' +
        '<button id="bma-ie-fillbtn" type="button" class="bma-ie-actbtn" style="background:#2563eb;">กรอกข้อมูลหน้านี้ (Auto-Fill)</button>' +
        '<table class="bma-ie-tbl"><tr>' +
          '<td class="bma-ie-pr6"><button id="bma-ie-step7" type="button" style="width:100%;padding:7px 6px;background:#eff6ff;color:#1e40af;border:1px solid #93c5fd;font-size:12.5px;">7. กรรมการ (ข้อ 12)</button></td>' +
          '<td><button id="bma-ie-step8" type="button" style="width:100%;padding:7px 6px;background:#eff6ff;color:#1e40af;border:1px solid #93c5fd;font-size:12.5px;">8. ใบตรวจรับ (ข้อ 13)</button></td>' +
        '</tr></table>' +
      '</div>' +

      /* ===== MODE 2: เบิกจ่าย MIS2 (FRM_PAY_DOC) ===== */
      '<div id="bma-ie-mode-pay" style="display:none;">' +
        '<div id="bma-ie-bridge-bar" style="background:#fffbeb;border:1px solid #f59e0b;color:#92400e;border-radius:7px;padding:8px 9px;font-size:12.5px;margin-bottom:8px;">' +
          '<div id="bma-ie-bridge-txt">กำลังตรวจสอบตัวช่วย Oracle Forms...</div>' +
          '<table class="bma-ie-tbl" style="margin-top:6px;margin-bottom:5px;"><tr>' +
            '<td class="bma-ie-pr6"><button id="bma-ie-br-pick" type="button" style="width:100%;padding:5px;font-size:12px;background:#fff;color:#1e293b;border:1px solid #94a3b8;">เลือกหน้าต่าง Oracle</button></td>' +
            '<td><button id="bma-ie-br-cal" type="button" style="width:100%;padding:5px;font-size:12px;background:#fff;color:#1e293b;border:1px solid #94a3b8;">ตั้งพิกัด (F8)</button></td>' +
          '</tr></table>' +
          '<button id="bma-ie-br-float" type="button" style="width:100%;padding:6px;font-size:12.5px;background:#0f766e;color:#ffffff;border:none;">เปิดแผงลอยเบิกจ่าย (ลอยทับ Oracle Forms)</button>' +
        '</div>' +
        '<div id="bma-ie-pay-dup" style="display:none;background:#fef2f2;border:2px solid #dc2626;color:#b91c1c;padding:7px;border-radius:6px;font-weight:700;font-size:12.5px;text-align:center;margin-bottom:7px;"></div>' +
        '<div id="bma-ie-pay-brief" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:7px 9px;font-size:13px;margin-bottom:8px;"></div>' +

        '<table class="bma-ie-tbl" style="margin-bottom:8px;"><tr>' +
          '<td class="bma-ie-pr6"><button id="bma-ie-psub-1" type="button" style="width:100%;padding:7px 4px;font-size:12.5px;border:1px solid #94a3b8;">1. ใบตรวจรับ</button></td>' +
          '<td class="bma-ie-pr6"><button id="bma-ie-psub-2" type="button" style="width:100%;padding:7px 4px;font-size:12.5px;border:1px solid #94a3b8;">2. ผู้รับเงิน</button></td>' +
          '<td><button id="bma-ie-psub-3" type="button" style="width:100%;padding:7px 4px;font-size:12.5px;border:1px solid #94a3b8;">3. รายละเอียด</button></td>' +
        '</tr></table>' +

        /* Pay Sub 1 */
        '<div id="bma-ie-ppane-1">' +
          '<table class="bma-ie-tbl"><tr>' +
            '<td class="bma-ie-pr6"><div class="bma-ie-lbl">เลขที่ใบตรวจรับ</div>' + ieInRowHtml('<input id="bma-ie-pay-rcvno" type="text" />', 'bma-ie-pay-rcvno', false) + '</td>' +
            '<td style="width:138px;"><div class="bma-ie-lbl">ปีงบ</div>' + ieInRowHtml('<input id="bma-ie-pay-rcvyr" type="text" value="' + state.fiscalYear + '" />', 'bma-ie-pay-rcvyr', false) + '</td>' +
          '</tr></table>' +
          '<table class="bma-ie-tbl"><tr>' +
            '<td class="bma-ie-pr6"><div class="bma-ie-lbl">ภาษีมูลค่าเพิ่ม (7%)</div>' + ieInRowHtml('<input id="bma-ie-pay-vat" type="text" />', 'bma-ie-pay-vat', false) + '</td>' +
            '<td><div class="bma-ie-lbl">หักภาษีเงินได้ (1%)</div>' + ieInRowHtml('<input id="bma-ie-pay-wht" type="text" />', 'bma-ie-pay-wht', false) + '</td>' +
          '</tr></table>' +
          '<div id="bma-ie-pay-taxbadge" style="background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:7px 9px;border-radius:6px;font-weight:700;font-size:13px;text-align:center;margin-bottom:8px;">ยอดสุทธิที่จ่าย: -</div>' +
          '<button id="bma-ie-prun-1" type="button" class="bma-ie-actbtn" style="background:#0284c7;">ขั้น 1: กรอกใบตรวจรับ + กดแว่นขยาย</button>' +
          '<button id="bma-ie-prun-15" type="button" class="bma-ie-actbtn" style="background:#0e7490;">ขั้น 1.5: รายละเอียด &raquo; ติ๊กงบ &raquo; ตกลง</button>' +
          '<button id="bma-ie-prun-16" type="button" class="bma-ie-actbtn" style="background:#0369a1;">ขั้น 1.6: กรอก VAT 7% + หักภาษี 1%</button>' +
        '</div>' +

        /* Pay Sub 2 */
        '<div id="bma-ie-ppane-2" style="display:none;">' +
          '<input id="bma-ie-vsearch" type="text" placeholder="ค้นหาบริษัทในทะเบียนบริษัท..." style="margin-bottom:5px;" />' +
          '<select id="bma-ie-vselect" style="margin-bottom:6px;"></select>' +
          '<div id="bma-ie-bankinfo" style="background:#f0f9ff;border:1px solid #7dd3fc;color:#0c4a6e;padding:6px 8px;border-radius:6px;font-size:12.5px;margin-bottom:7px;">ธนาคาร: - | สาขา: -</div>' +
          ieChkRowHtml('bma-ie-ck-payTo', ieChecks.payTo !== false, 'จ่ายให้', 'bma-ie-pay-to') +
          ieChkRowHtml('bma-ie-ck-assignTo', ieChecks.assignTo !== false, 'โดยมอบให้', 'bma-ie-pay-assign') +
          ieChkRowHtml('bma-ie-ck-bankCode', ieChecks.bankCode !== false, 'ธนาคาร', 'bma-ie-pay-bank') +
          ieChkRowHtml('bma-ie-ck-branchCode', ieChecks.branchCode !== false, 'สาขา 4 หลัก', 'bma-ie-pay-branch') +
          ieChkRowHtml('bma-ie-ck-accountNo', ieChecks.accountNo !== false, 'เลขบัญชี', 'bma-ie-pay-acct') +
          '<button id="bma-ie-prun-2" type="button" class="bma-ie-actbtn" style="background:#0284c7;">ขั้น 2: กรอกแท็บ \'ผู้รับเงิน\'</button>' +
        '</div>' +

        /* Pay Sub 3 */
        '<div id="bma-ie-ppane-3" style="display:none;">' +
          '<div style="margin-bottom:6px;"><div class="bma-ie-lbl">ชื่อผู้ขอเบิก</div>' + ieInRowHtml('<input id="bma-ie-pay-req" type="text" value="' + (state.defaultRequester || 'นางอรชุมา หุตะโกวิท') + '" />', 'bma-ie-pay-req', false) + '</div>' +
          '<div style="margin-bottom:6px;">' +
            '<table class="bma-ie-tbl-tight" style="margin-bottom:3px;"><tr>' +
              '<td style="font-size:12.5px;font-weight:600;color:#334155;">วันที่เบิก (พ.ศ.)</td>' +
              '<td style="width:130px;text-align:right;"><button id="bma-ie-dt-today" type="button" style="font-size:11.5px;padding:2px 7px;background:#f1f5f9;border:1px solid #cbd5e1;margin-right:4px;">วันนี้</button><button id="bma-ie-dt-rcv" type="button" style="font-size:11.5px;padding:2px 7px;background:#f1f5f9;border:1px solid #cbd5e1;">วันตรวจรับ</button></td>' +
            '</tr></table>' +
            ieInRowHtml('<input id="bma-ie-pay-date" type="text" value="' + ieTodayThaiSlash() + '" />', 'bma-ie-pay-date', false) +
          '</div>' +
          '<div style="margin-bottom:7px;"><div class="bma-ie-lbl">คำอธิบายรายการเบิก</div>' + ieInRowHtml('<textarea id="bma-ie-pay-desc" style="height:62px;"></textarea>', 'bma-ie-pay-desc', true) + '</div>' +
          '<button id="bma-ie-prun-3" type="button" class="bma-ie-actbtn" style="background:#0284c7;">ขั้น 3: กรอกแท็บ \'รายละเอียดเบิก\'</button>' +
          '<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:6px 8px;border-radius:6px;font-size:12px;font-weight:600;text-align:center;margin-bottom:8px;">หยุดก่อนบันทึกทุกครั้ง (คนตรวจและกดบันทึกเอง) | กด ESC หยุดทันที</div>' +
        '</div>' +

        '<div style="border-top:1px solid #cbd5e1;padding-top:8px;margin-bottom:8px;">' +
          '<div class="bma-ie-lbl">บันทึกเลขที่ใบขอเบิกลง MISS (คอลัมน์ H)</div>' +
          '<table class="bma-ie-tbl-tight"><tr>' +
            '<td><input id="bma-ie-pay-docno" type="text" placeholder="เช่น 123/' + state.fiscalYear + '" /></td>' +
            '<td style="width:105px;padding-left:6px;"><button id="bma-ie-pay-savedoc" type="button" style="width:100%;height:32px;background:#16a34a;color:#fff;border:none;font-size:12.5px;">ลง MISS' + state.fiscalYear + '</button></td>' +
          '</tr></table>' +
        '</div>' +
      '</div>' +

      '<div id="bma-ie-status" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:7px 9px;border-radius:6px;font-size:12.5px;font-weight:600;color:#1e293b;margin-bottom:6px;">พร้อมใช้งานบน IE Mode</div>' +
      '<div style="text-align:center;font-size:12px;color:#64748b;font-weight:600;">ผู้พัฒนา: <span style="color:#1d4ed8;">ARISSARA.K</span> • กลุ่มงานเภสัชกรรม รพจ.</div>' +
    '</div>';

  if (document.body.firstChild) {
    document.body.insertBefore(panel, document.body.firstChild);
  } else {
    document.body.appendChild(panel);
  }

  var ieCustomDragged = false;
  function ieRepositionPanel() {
    var p = document.getElementById('bma-ie-panel');
    if (!p) return;
    p.style.maxHeight = Math.max(360, ieGetViewportHeight() - 28) + 'px';
    if (ieIsQuirks && !ieCustomDragged) {
      p.style.position = 'absolute';
      p.style.top = (ieGetScrollTop() + 10) + 'px';
      p.style.right = '12px';
      p.style.left = 'auto';
    }
  }
  ieRepositionPanel();
  if (window.addEventListener) {
    window.addEventListener('scroll', ieRepositionPanel, false);
    window.addEventListener('resize', ieRepositionPanel, false);
  } else if (window.attachEvent) {
    window.attachEvent('onscroll', ieRepositionPanel);
    window.attachEvent('onresize', ieRepositionPanel);
  }
  if (ieIsQuirks) {
    setInterval(ieRepositionPanel, 450);
  }

  (function () {
    var hdr = document.getElementById('bma-ie-header');
    if (!hdr) return;
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var origLeft = 0;
    var origTop = 0;
    hdr.onmousedown = function (e) {
      e = e || window.event;
      var tgt = e.target || e.srcElement;
      if (tgt && tgt.tagName && tgt.tagName.toLowerCase() === 'button') return;
      dragging = true;
      ieCustomDragged = true;
      startX = e.clientX;
      startY = e.clientY;
      var rect = panel.getBoundingClientRect();
      origLeft = rect.left + (ieIsQuirks ? (document.body.scrollLeft || 0) : 0);
      origTop = rect.top + (ieIsQuirks ? ieGetScrollTop() : 0);
      panel.style.right = 'auto';
      panel.style.left = origLeft + 'px';
      panel.style.top = origTop + 'px';
      return false;
    };
    document.onmousemove = function (e) {
      if (!dragging) return;
      e = e || window.event;
      panel.style.left = (origLeft + (e.clientX - startX)) + 'px';
      panel.style.top = Math.max(4, origTop + (e.clientY - startY)) + 'px';
    };
    document.onmouseup = function () {
      dragging = false;
    };
  })();

  function setIeStatus(msg) {
    var st = document.getElementById('bma-ie-status');
    if (st) st.innerHTML = msg;
  }

  function updateIeBridgeUi() {
    var bar = document.getElementById('bma-ie-bridge-bar');
    var txt = document.getElementById('bma-ie-bridge-txt');
    if (!bar || !txt) return;
    if (ieBridgeStatus.connected) {
      bar.style.background = '#ecfdf5';
      bar.style.borderColor = '#4ade80';
      bar.style.color = '#166534';
      var wStr = ieBridgeStatus.targetFound
        ? 'หน้าต่างเป้าหมาย: ' + String(ieBridgeStatus.targetTitle || 'Oracle Forms').slice(0, 32)
        : 'ยังไม่พบหน้าต่าง Oracle Forms (เปิด FRM_PAY_DOC แล้วกดเลือกหน้าต่าง)';
      txt.innerHTML = '<b>[เชื่อมต่อแล้ว] ตัวช่วย Oracle Forms</b> (พิกัด ' + ieBridgeStatus.calibratedCount + '/' + ieBridgeStatus.totalCalibCount + ')<br/>' + wStr;
    } else {
      bar.style.background = '#fffbeb';
      bar.style.borderColor = '#f59e0b';
      bar.style.color = '#92400e';
      txt.innerHTML = '<b>[โหมดคัดลอกวาง]</b> ยังไม่เปิดตัวช่วย (เปิด <b>START_ORACLE_BRIDGE.bat</b> เพื่อกรอกอัตโนมัติ)';
    }
  }

  function pollIeBridge() {
    ieBridgeReq('/status', 'GET', null, function (ok, d) {
      if (ok && d && d.ok) {
        ieBridgeStatus.connected = true;
        ieBridgeStatus.targetFound = !!d.targetFound;
        ieBridgeStatus.targetTitle = String(d.targetTitle || '');
        ieBridgeStatus.calibratedCount = Number(d.calibratedCount || 0);
        ieBridgeStatus.totalCalibCount = Number(d.totalCalibCount || 18);
      } else {
        ieBridgeStatus.connected = false;
        ieBridgeStatus.targetFound = false;
      }
      updateIeBridgeUi();
    });
  }

  function updateIeTaxDisplay(amountVal, companyName) {
    var tax = ieCalcTax(amountVal, companyName);
    var vIn = document.getElementById('bma-ie-pay-vat');
    var wIn = document.getElementById('bma-ie-pay-wht');
    var bd = document.getElementById('bma-ie-pay-taxbadge');
    if (vIn) vIn.value = tax.vat7.toFixed(2);
    if (wIn) wIn.value = tax.wht1.toFixed(2);
    if (bd) {
      if (tax.exempt) {
        bd.style.background = '#fffbeb';
        bd.style.borderColor = '#fde68a';
        bd.style.color = '#92400e';
        bd.innerHTML = '✓ ยกเว้นหัก 1% (0.00) • สุทธิจ่าย: ' + ieFormatNum(tax.net) + ' บาท';
      } else {
        bd.style.background = '#f0fdf4';
        bd.style.borderColor = '#bbf7d0';
        bd.style.color = '#166534';
        bd.innerHTML = 'หัก 1% ปกติ • สุทธิจ่าย: ' + ieFormatNum(tax.net) + ' บาท';
      }
    }
  }

  function renderIeVendors() {
    var sel = document.getElementById('bma-ie-vselect');
    var qIn = document.getElementById('bma-ie-vsearch');
    if (!sel) return;
    var curVal = sel.value || '';
    var q = String((qIn && qIn.value) || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var list = state.vendors || [];
    var opts = [{ value: '', text: '-- เลือกบริษัทจากทะเบียนบริษัท (' + list.length + ') --' }];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      var match = !q ||
        String(v.company || '').toLowerCase().indexOf(q) !== -1 ||
        String(v.bank || '').toLowerCase().indexOf(q) !== -1 ||
        String(v.accountNo || '').indexOf(q) !== -1;
      if (match) {
        var bTag = v.bank ? ' [' + (v.bankCode || '') + ' ' + v.bank + ']' : '';
        opts.push({ value: String(v.company || ''), text: String(v.company || '') + bTag });
      }
    }
    ieSetSelectOptions(sel, opts, curVal);
  }

  function applyVendorToIePay(v) {
    if (!v) return;
    var item = getSelectedItem();
    document.getElementById('bma-ie-pay-to').value = v.company || '';
    document.getElementById('bma-ie-pay-bank').value = v.bankCode || '';
    document.getElementById('bma-ie-pay-branch').value = ieGetBranchCode(v);
    document.getElementById('bma-ie-pay-acct').value = v.accountNo || '';
    document.getElementById('bma-ie-pay-assign').value = ieIsAidsBudget(item)
      ? (v.company || '')
      : (state.defaultAssignTo || ASSIGN_TO_PRESETS[0]);
    document.getElementById('bma-ie-bankinfo').innerHTML =
      'ธนาคาร (B): <b>' + (v.bank || '-') + ' (' + (v.bankCode || '-') + ')</b><br/>สาขา (C): <b>' + (v.branch || '-') + '</b>';
    if (item) {
      document.getElementById('bma-ie-pay-desc').value = ieFormatPayDesc(item, v);
    }
    updateIeTaxDisplay(item ? item.amount : 0, v.company || '');
  }

  function applyItemToIePay(item) {
    if (!item) return;
    var fy = String(state.fiscalYear || '70');
    document.getElementById('bma-ie-pay-rcvno').value = state.rcvNo || item.rcvNo || '';
    document.getElementById('bma-ie-pay-rcvyr').value = fy;
    document.getElementById('bma-ie-pay-desc').value = ieFormatPayDesc(item);
    document.getElementById('bma-ie-pay-docno').value = item.payDocNo || '';
    document.getElementById('bma-ie-pay-savedoc').innerHTML = 'ลง MISS' + fy;

    var rcvDisp = item.rcvNo ? (item.rcvNo + '/' + fy) : '(ยังไม่มีเลขตรวจรับ)';
    document.getElementById('bma-ie-pay-brief').innerHTML =
      '<b>[' + item.code + ']</b> ใบตรวจรับ: <b>' + rcvDisp + '</b> | <b style="color:#16a34a;">' + item.amountFormatted + ' บาท</b><br/>' +
      '<span style="color:#475569;">' + (item.vendorName || '-') + '</span>';

    var dup = document.getElementById('bma-ie-pay-dup');
    if (item.payDocNo) {
      dup.style.display = 'block';
      dup.innerHTML = '[เตือน] มีประวัติขอเบิกแล้วใน MISS' + fy + ' (เลขที่: ' + item.payDocNo + ') — ระวังเบิกซ้ำ!';
    } else {
      dup.style.display = 'none';
    }

    updateIeTaxDisplay(item.amount, item.vendorName);
    var matched = (item.vendorProfile && item.vendorProfile.company)
      ? item.vendorProfile
      : ieFindVendor(item.vendorName, item.vendorTaxId);
    if (matched) {
      applyVendorToIePay(matched);
      document.getElementById('bma-ie-vselect').value = matched.company || '';
    } else {
      document.getElementById('bma-ie-pay-to').value = item.vendorName || '';
      document.getElementById('bma-ie-pay-assign').value = ieIsAidsBudget(item)
        ? (item.vendorName || '')
        : (state.defaultAssignTo || ASSIGN_TO_PRESETS[0]);
      document.getElementById('bma-ie-pay-bank').value = '';
      document.getElementById('bma-ie-pay-branch').value = '';
      document.getElementById('bma-ie-pay-acct').value = '';
      document.getElementById('bma-ie-bankinfo').innerHTML = '[ไม่พบในทะเบียนบริษัท] สามารถเลือกบริษัทจากช่องด้านบนได้';
    }
  }

  function switchIeMode(mode) {
    state.activeMode = mode === 'pay' ? 'pay' : 'purhire';
    saveState();
    var pPur = document.getElementById('bma-ie-mode-pur');
    var pPay = document.getElementById('bma-ie-mode-pay');
    var bPur = document.getElementById('bma-ie-tab-pur');
    var bPay = document.getElementById('bma-ie-tab-pay');
    pPur.style.display = state.activeMode === 'purhire' ? 'block' : 'none';
    pPay.style.display = state.activeMode === 'pay' ? 'block' : 'none';
    bPur.style.background = state.activeMode === 'purhire' ? '#ffffff' : 'transparent';
    bPur.style.color = state.activeMode === 'purhire' ? '#1d4ed8' : '#475569';
    bPay.style.background = state.activeMode === 'pay' ? '#ffffff' : 'transparent';
    bPay.style.color = state.activeMode === 'pay' ? '#0f766e' : '#475569';
    if (state.activeMode === 'pay') {
      applyItemToIePay(getSelectedItem());
      pollIeBridge();
    }
  }

  function switchIePaySub(sub) {
    state.paySubTab = String(sub || '1');
    saveState();
    var arr = ['1', '2', '3'];
    for (var i = 0; i < arr.length; i++) {
      var k = arr[i];
      var pn = document.getElementById('bma-ie-ppane-' + k);
      var bt = document.getElementById('bma-ie-psub-' + k);
      if (pn) pn.style.display = k === state.paySubTab ? 'block' : 'none';
      if (bt) {
        bt.style.background = k === state.paySubTab ? '#0284c7' : '#f8fafc';
        bt.style.color = k === state.paySubTab ? '#ffffff' : '#475569';
      }
    }
  }

  function runIeBridgeStep(step) {
    if (!ieBridgeStatus.connected) {
      alert('ยังไม่ได้เปิดตัวช่วย Oracle Forms\n\n- ดับเบิลคลิก START_ORACLE_BRIDGE.bat เพื่อกรอกอัตโนมัติ\n- หรือกดปุ่ม คัดลอก ข้างแต่ละช่องเพื่อนำไปกด Ctrl+V เองได้ทันที');
      pollIeBridge();
      return;
    }
    var payload = {};
    if (step === '1') {
      payload.rcvNo = String(document.getElementById('bma-ie-pay-rcvno').value || '').replace(/^\s+|\s+$/g, '');
      payload.rcvYear = String(document.getElementById('bma-ie-pay-rcvyr').value || '').replace(/^\s+|\s+$/g, '');
      if (!payload.rcvNo) { alert('กรุณาระบุเลขที่ใบตรวจรับก่อนครับ'); return; }
    } else if (step === '1.6') {
      payload.vatAmount = String(document.getElementById('bma-ie-pay-vat').value || '').replace(/^\s+|\s+$/g, '');
      payload.whtAmount = String(document.getElementById('bma-ie-pay-wht').value || '').replace(/^\s+|\s+$/g, '');
    } else if (step === '2') {
      var pTo = String(document.getElementById('bma-ie-pay-to').value || '').replace(/^\s+|\s+$/g, '');
      var br = String(document.getElementById('bma-ie-pay-branch').value || '').replace(/^\s+|\s+$/g, '');
      if (pTo && br) {
        state.branchOverrides = state.branchOverrides || {};
        state.branchOverrides[pTo] = br;
        saveState();
      }
      if (document.getElementById('bma-ie-ck-payTo').checked) payload.payTo = pTo;
      if (document.getElementById('bma-ie-ck-assignTo').checked) payload.assignTo = String(document.getElementById('bma-ie-pay-assign').value || '').replace(/^\s+|\s+$/g, '');
      if (document.getElementById('bma-ie-ck-bankCode').checked) payload.bankCode = String(document.getElementById('bma-ie-pay-bank').value || '').replace(/^\s+|\s+$/g, '');
      if (document.getElementById('bma-ie-ck-branchCode').checked) payload.branchCode = br;
      if (document.getElementById('bma-ie-ck-accountNo').checked) payload.accountNo = String(document.getElementById('bma-ie-pay-acct').value || '').replace(/^\s+|\s+$/g, '');
    } else if (step === '3') {
      payload.requesterName = String(document.getElementById('bma-ie-pay-req').value || '').replace(/^\s+|\s+$/g, '');
      payload.payDate = String(document.getElementById('bma-ie-pay-date').value || '').replace(/^\s+|\s+$/g, '');
      payload.description = String(document.getElementById('bma-ie-pay-desc').value || '').replace(/^\s+|\s+$/g, '');
    }

    setIeStatus('กำลังกรอกขั้นที่ ' + step + ' ลง Oracle Forms... (กด ESC หยุดทันที)');
    ieBridgeReq('/run-step', 'POST', { step: step, payload: payload }, function (ok, d) {
      if (!ok || !d) {
        setIeStatus('[ผิดพลาด] ติดต่อตัวช่วย Oracle Forms ไม่ได้');
        pollIeBridge();
        return;
      }
      if (d.ok) {
        setIeStatus('[สำเร็จ] ' + (d.message || ('กรอกขั้นที่ ' + step + ' สำเร็จ')));
        if (step === '1.6') switchIePaySub('2');
        if (step === '2') switchIePaySub('3');
      } else {
        setIeStatus('[เตือน] ' + (d.error || 'กรอกไม่สำเร็จ'));
        if (d.needCalibration && confirm((d.error || 'ยังไม่ได้ตั้งพิกัด') + '\n\nเปิดหน้าต่างตั้งพิกัด (F8) ตอนนี้เลยไหมครับ?')) {
          ieBridgeReq('/calibrate', 'POST', {}, function () { pollIeBridge(); });
        }
      }
    });
  }

  function saveIePayDocToMiss() {
    var item = getSelectedItem();
    var fy = String(state.fiscalYear || '70');
    var entry = getCurrentIeFyEntry();
    var payNo = String(document.getElementById('bma-ie-pay-docno').value || '').replace(/^\s+|\s+$/g, '');
    if (!payNo) { alert('กรุณาพิมพ์เลขที่ใบขอเบิกก่อนครับ'); return; }
    if (!item || !item.missRowIndex) { alert('รายการนี้ยังไม่ได้เชื่อมแถวในชีต MISS' + fy); return; }
    setIeStatus('กำลังบันทึกเลขใบขอเบิก ' + payNo + ' ลง MISS' + fy + '...');
    var postPayload = {
      action: 'updatePayDocNo',
      missRowIndex: item.missRowIndex,
      payDocNo: payNo,
      missSheetId: extractSheetId(entry.missSheetId),
      missTabName: 'ชีต1'
    };

    function onSaved() {
      item.payDocNo = payNo;
      saveState();
      applyItemToIePay(item);
      setIeStatus('บันทึกเลขใบขอเบิก ' + payNo + ' ลง MISS' + fy + ' เรียบร้อย!');
    }

    function trySaveViaXhr() {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', GAS_URL, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            try {
              var res = ieJsonParse(xhr.responseText);
              if (res && res.ok) {
                onSaved();
                return;
              }
            } catch (e) {}
            setIeStatus('บันทึก MISS' + fy + ' ไม่สำเร็จ (เปิด START_ORACLE_BRIDGE.bat แล้วลองใหม่)');
          }
        };
        xhr.onerror = function () {
          setIeStatus('บันทึก MISS' + fy + ' ไม่สำเร็จ (เปิด START_ORACLE_BRIDGE.bat แล้วลองใหม่)');
        };
        xhr.send(ieJsonStringify(postPayload));
      } catch (e2) {
        setIeStatus('บันทึก MISS' + fy + ' ไม่สำเร็จ (เปิด START_ORACLE_BRIDGE.bat แล้วลองใหม่)');
      }
    }

    ieBridgeReq('/fetch-gas', 'POST', { url: GAS_URL, method: 'POST', payload: postPayload }, function (ok, res) {
      if (ok && res && res.ok) {
        onSaved();
        return;
      }
      trySaveViaXhr();
    });
  }

  function ieMergeAccountTypes(cacheArr) {
    if (!cacheArr || !cacheArr.length) return;
    var byTax = {};
    var byKey = {};
    var i, cv, at, tx, k;
    for (i = 0; i < cacheArr.length; i++) {
      cv = cacheArr[i];
      at = String(cv.accountType || '').replace(/^\s+|\s+$/g, '');
      if (!at) continue;
      tx = thaiToArabic(String(cv.taxId || '')).replace(/\D/g, '');
      if (tx) byTax[tx] = at;
      k = ieNormalizeCompany(cv.company);
      if (k) byKey[k] = at;
    }
    function fillProf(p) {
      if (!p || (p.accountType && String(p.accountType).replace(/^\s+|\s+$/g, ''))) return;
      var ptx = thaiToArabic(String(p.taxId || '')).replace(/\D/g, '');
      var pk = ieNormalizeCompany(p.company);
      if (ptx && byTax[ptx]) p.accountType = byTax[ptx];
      else if (pk && byKey[pk]) p.accountType = byKey[pk];
    }
    if (state.vendors) {
      for (i = 0; i < state.vendors.length; i++) fillProf(state.vendors[i]);
    }
    if (state.items) {
      for (i = 0; i < state.items.length; i++) {
        if (state.items[i] && state.items[i].vendorProfile) fillProf(state.items[i].vendorProfile);
      }
    }
  }

  function ieVendorsHaveAccountType() {
    if (!state.vendors || state.vendors.length === 0) return false;
    for (var i = 0; i < state.vendors.length; i++) {
      if (state.vendors[i].accountType && String(state.vendors[i].accountType).replace(/^\s+|\s+$/g, '')) return true;
    }
    return false;
  }

  function loadFallbackVendorsCache() {
    var needFull = !(state.vendors && state.vendors.length > 0);
    var needAcctTypes = !ieVendorsHaveAccountType();
    if (!needFull && !needAcctTypes) return;
    function applyVendorArr(data) {
      var arr = (data && data.vendors) ? data.vendors : (data instanceof Array ? data : []);
      if (arr.length > 0) {
        if (needFull) {
          state.vendors = arr;
        } else {
          ieMergeAccountTypes(arr);
        }
        renderIeVendors();
        applyItemToIePay(getSelectedItem());
        return true;
      }
      return false;
    }
    ieBridgeReq('/vendors-cache', 'GET', null, function (ok, data) {
      if (ok && applyVendorArr(data)) return;
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', VENDORS_CACHE_URL + '?t=' + new Date().getTime(), true);
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try { applyVendorArr(ieJsonParse(xhr.responseText)); } catch (e) {}
          }
        };
        xhr.send();
      } catch (e2) {}
    });
  }

  function renderIeFiscalYearDropdown() {
    getCurrentIeFyEntry();
    var sel = document.getElementById('bma-ie-fy-select');
    if (!sel) return;
    var yrs = [];
    for (var k in state.fiscalYears) {
      if (state.fiscalYears.hasOwnProperty(k)) yrs.push(k);
    }
    yrs.sort(function (a, b) {
      return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0);
    });
    var opts = [];
    for (var i = 0; i < yrs.length; i++) {
      var y = yrs[i];
      var info = state.fiscalYears[y] || {};
      var lbl = info.label || ('ปีงบ ' + y + ' (MISS' + y + ' / Auto Crat-EGP' + y + ')');
      opts.push({ value: y, text: lbl });
    }
    ieSetSelectOptions(sel, opts, String(state.fiscalYear || '70'));

    var entry = getCurrentIeFyEntry();
    var fyIn = document.getElementById('bma-ie-cfg-fy');
    var acIn = document.getElementById('bma-ie-cfg-ac');
    var msIn = document.getElementById('bma-ie-cfg-miss');
    if (fyIn) fyIn.value = String(state.fiscalYear || '70');
    if (acIn) acIn.value = entry.autocratSheetId || '';
    if (msIn) msIn.value = entry.missSheetId || '';
  }

  renderIeFiscalYearDropdown();

  function renderIeList() {
    var q = String(document.getElementById('bma-ie-search').value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var sel = document.getElementById('bma-ie-select');
    var exact = [];
    for (var i = 0; i < state.items.length; i++) {
      var it = state.items[i];
      var c = String(it.code || '').toLowerCase();
      var num = c.replace(/[^0-9]/g, '');
      if (c === q || (q !== '' && /^\d+$/.test(q) && num === q)) exact.push(it);
    }
    var list = [];
    if (q && exact.length > 0) {
      list = exact;
    } else {
      for (var j = 0; j < state.items.length; j++) {
        var it2 = state.items[j];
        var c2 = String(it2.code || '').toLowerCase();
        if (!q || c2 === q || String(it2.subject || '').toLowerCase().indexOf(q) !== -1) {
          list.push(it2);
        }
      }
    }
    list.sort(function (a, b) {
      var na = parseInt(String(a.code || '').replace(/\D/g, ''), 10) || 0;
      var nb = parseInt(String(b.code || '').replace(/\D/g, ''), 10) || 0;
      return na - nb;
    });

    if (list.length === 0) {
      ieSetSelectOptions(sel, [{ value: '', text: '-- ไม่พบรายการ --' }], '');
      return;
    }
    var opts = [];
    var keepSelected = false;
    for (var k = 0; k < list.length; k++) {
      var x = list[k];
      var recTag = isItemAlreadyRecorded(x) ? '[ลงแล้ว] ' : '';
      opts.push({
        value: x.code,
        text: recTag + '[' + x.code + '] ' + String(x.subject || '').slice(0, 28) + ' (' + x.amountFormatted + ')'
      });
      if (state.selectedCode && x.code === state.selectedCode) keepSelected = true;
    }
    state.selectedCode = keepSelected ? state.selectedCode : list[0].code;
    ieSetSelectOptions(sel, opts, state.selectedCode);
    onIeItemChange();
  }

  function onIeItemChange() {
    var sel = document.getElementById('bma-ie-select');
    state.selectedCode = sel.value;
    var item = getSelectedItem();
    if (!item) return;
    state.purHireNo = item.purHireNo || '';
    state.poNo = item.poNo || '';
    state.rcvNo = item.rcvNo || '';
    document.getElementById('bma-ie-purno').value = state.purHireNo;
    document.getElementById('bma-ie-pono').value = state.poNo;
    document.getElementById('bma-ie-rcvno').value = state.rcvNo;

    var rec = isItemAlreadyRecorded(item);
    var allowMain = !rec || isIePageStep7Or8();
    var btn = document.getElementById('bma-ie-fillbtn');
    var sum = document.getElementById('bma-ie-summary');
    var warnHtml = rec
      ? '<div style="background:#fef2f2;border:2px solid #dc2626;color:#b91c1c;padding:5px;border-radius:4px;font-weight:bold;text-align:center;margin-bottom:5px;">[ลงแล้ว] มีประวัติการลงข้อมูลแล้ว<br/>(ล็อกขั้น 1-6 • แก้ไขขั้น 7 และ 8 ได้)</div>'
      : '';
    sum.innerHTML =
      warnHtml +
      '<div><b>[' + item.code + ']</b> ' + item.subject + '</div>' +
      '<div style="color:#16a34a;font-weight:bold;">ยอดเงิน: ' + item.amountFormatted + ' บาท</div>' +
      '<div>บริษัท: ' + (item.vendorName || '-') + '</div>' +
      '<div>เห็นชอบ: ' + (item.agreeDate || '-') + ' | อนุมัติ: ' + (item.quoteDate || '-') + '</div>' +
      '<div>สั่งซื้อ: ' + (item.poSignDate || '-') + ' | ตรวจรับ: ' + (item.rcvDate || '-') + '</div>';

    btn.disabled = !allowMain;
    btn.style.background = !allowMain ? '#94a3b8' : '#2563eb';
    btn.innerHTML = !allowMain ? '[ล็อกขั้น 1-6] มีประวัติการลงข้อมูลแล้ว' : 'กรอกซ้ำอีกครั้ง (Auto-Fill)';
    applyItemToIePay(item);
    saveState();

    // กรอกอัตโนมัติทันทีที่เลือกรายการหรือโหลดหน้าเสร็จ (เฉพาะฝั่ง PurHire)
    if (allowMain && !isIeMis2Portal() && state.activeMode !== 'pay') {
      runAutoFill(undefined, true);
    }
  }

  function highlightIeApprovalButtons() {
    var docs = getTargetDocs();
    for (var d = 0; d < docs.length; d++) {
      var btns = [];
      var inps = docs[d].getElementsByTagName('input');
      for (var ii = 0; ii < inps.length; ii++) {
        var tp = String(inps[ii].type || '').toLowerCase();
        if (tp === 'button' || tp === 'submit') btns.push(inps[ii]);
      }
      var bEls = docs[d].getElementsByTagName('button');
      for (var bi = 0; bi < bEls.length; bi++) btns.push(bEls[bi]);
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var txt = String(b.value || b.innerText || b.textContent || '').replace(/\s+/g, '');
        if (/^(บันทึก|ตกลง|แสดงรายงาน|รายละเอียด)$/.test(txt)) {
          b.style.border = '2px solid #16a34a';
          b.style.fontWeight = 'bold';
        }
      }
    }
  }

  function applyLoadedSheetsResponse(res, fy, viaTag) {
    if (res && res.items) {
      state.items = res.items;
      if (res.vendors && res.vendors.length > 0) {
        state.vendors = res.vendors;
        if (!ieVendorsHaveAccountType()) {
          loadFallbackVendorsCache();
        }
      } else {
        loadFallbackVendorsCache();
      }
      renderIeVendors();
      renderIeList();
      setIeStatus('ปีงบ ' + fy + ': โหลดสำเร็จ (' + state.items.length + ' รายการ' + (viaTag || '') + ')');
      return true;
    }
    return false;
  }

  function loadDataViaXhr() {
    var fy = String(state.fiscalYear || '70').replace(/^\s+|\s+$/g, '');
    var entry = getCurrentIeFyEntry();
    setIeStatus('กำลังดึงข้อมูลปีงบ ' + fy + ' (MISS' + fy + ' / Auto Crat-EGP' + fy + ')...');
    var url =
      GAS_URL +
      '?fiscalYear=' + encodeURIComponent(fy) +
      '&autocratSheetId=' + encodeURIComponent(extractSheetId(entry.autocratSheetId)) +
      '&missSheetId=' + encodeURIComponent(extractSheetId(entry.missSheetId)) +
      '&t=' + new Date().getTime();

    function showCacheOrFail() {
      if (state.items && state.items.length > 0) {
        renderIeVendors();
        renderIeList();
        setIeStatus('ใช้ข้อมูลในแคช (' + state.items.length + ' รายการ) — เปิด START_ORACLE_BRIDGE.bat เพื่อซิงค์สดบน IE');
      } else {
        ieSetSelectOptions(document.getElementById('bma-ie-select'), [{ value: '', text: '-- ยังไม่เชื่อมข้อมูล (เปิด START_ORACLE_BRIDGE.bat แล้วกด ซิงค์) --' }], '');
        setIeStatus('โหลดข้อมูลไม่สำเร็จ — เปิด START_ORACLE_BRIDGE.bat แล้วกด ซิงค์ อีกครั้ง');
      }
    }

    function tryDirectXhr() {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                var res = ieJsonParse(xhr.responseText);
                if (applyLoadedSheetsResponse(res, fy, '')) return;
              } catch (e) {}
            }
            showCacheOrFail();
          }
        };
        xhr.onerror = showCacheOrFail;
        xhr.send();
      } catch (e2) {
        showCacheOrFail();
      }
    }

    ieBridgeReq('/fetch-gas', 'POST', { url: url, method: 'GET' }, function (ok, res) {
      if (ok && applyLoadedSheetsResponse(res, fy, ' ผ่านตัวช่วย')) {
        return;
      }
      tryDirectXhr();
    });
  }

  document.getElementById('bma-ie-min').onclick = function () {
    var body = document.getElementById('bma-ie-body');
    var hidden = body.style.display === 'none';
    body.style.display = hidden ? 'block' : 'none';
    this.innerHTML = hidden ? '-' : '+';
  };

  document.getElementById('bma-ie-tab-pur').onclick = function () { switchIeMode('purhire'); };
  document.getElementById('bma-ie-tab-pay').onclick = function () { switchIeMode('pay'); };
  document.getElementById('bma-ie-psub-1').onclick = function () { switchIePaySub('1'); };
  document.getElementById('bma-ie-psub-2').onclick = function () { switchIePaySub('2'); };
  document.getElementById('bma-ie-psub-3').onclick = function () { switchIePaySub('3'); };

  document.getElementById('bma-ie-br-pick').onclick = function () {
    if (!ieBridgeStatus.connected) { pollIeBridge(); return; }
    ieBridgeReq('/pick-window', 'POST', {}, function () { pollIeBridge(); });
  };
  document.getElementById('bma-ie-br-cal').onclick = function () {
    if (!ieBridgeStatus.connected) { alert('กรุณาเปิด START_ORACLE_BRIDGE.bat ก่อนกดตั้งพิกัดครับ'); pollIeBridge(); return; }
    ieBridgeReq('/calibrate', 'POST', {}, function () { pollIeBridge(); });
  };
  document.getElementById('bma-ie-br-float').onclick = function () {
    if (!ieBridgeStatus.connected) { alert('กรุณาดับเบิลคลิกเปิด START_ORACLE_BRIDGE.bat ก่อนครับ'); pollIeBridge(); return; }
    ieBridgeReq('/open-floating-pay', 'POST', {}, function (ok, d) {
      setIeStatus(ok && d && d.ok ? 'เปิดแผงลอยเบิกจ่ายทับหน้าต่าง Oracle Forms แล้ว' : 'ไม่พบไฟล์ mis2_pay_autofill.ps1 (กด UPDATE_FROM_GITHUB.bat)');
    });
  };

  document.getElementById('bma-ie-prun-1').onclick = function () { runIeBridgeStep('1'); };
  document.getElementById('bma-ie-prun-15').onclick = function () { runIeBridgeStep('1.5'); };
  document.getElementById('bma-ie-prun-16').onclick = function () { runIeBridgeStep('1.6'); };
  document.getElementById('bma-ie-prun-2').onclick = function () { runIeBridgeStep('2'); };
  document.getElementById('bma-ie-prun-3').onclick = function () { runIeBridgeStep('3'); };
  document.getElementById('bma-ie-pay-savedoc').onclick = saveIePayDocToMiss;

  document.getElementById('bma-ie-vsearch').onkeyup = renderIeVendors;
  document.getElementById('bma-ie-vselect').onchange = function () {
    var comp = this.value;
    var list = state.vendors || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].company === comp) {
        applyVendorToIePay(list[i]);
        break;
      }
    }
  };
  document.getElementById('bma-ie-dt-today').onclick = function () {
    document.getElementById('bma-ie-pay-date').value = ieTodayThaiSlash();
  };
  document.getElementById('bma-ie-dt-rcv').onclick = function () {
    var it = getSelectedItem();
    if (it && it.rcvDate) document.getElementById('bma-ie-pay-date').value = it.rcvDate;
  };

  var ckKeys = ['payTo', 'assignTo', 'bankCode', 'branchCode', 'accountNo'];
  for (var cki = 0; cki < ckKeys.length; cki++) {
    (function (k) {
      var el = document.getElementById('bma-ie-ck-' + k);
      if (el) {
        el.onchange = function () {
          state.payChecks = state.payChecks || {};
          state.payChecks[k] = !!this.checked;
          saveState();
        };
      }
    })(ckKeys[cki]);
  }
  document.getElementById('bma-ie-pay-assign').onchange = function () {
    if (!ieIsAidsBudget(getSelectedItem())) {
      state.defaultAssignTo = String(this.value || '').replace(/^\s+|\s+$/g, '') || ASSIGN_TO_PRESETS[0];
      saveState();
    }
  };
  document.getElementById('bma-ie-pay-req').onchange = function () {
    state.defaultRequester = String(this.value || '').replace(/^\s+|\s+$/g, '') || 'นางอรชุมา หุตะโกวิท';
    saveState();
  };

  var allPanelBtns = panel.getElementsByTagName('button');
  for (var ci = 0; ci < allPanelBtns.length; ci++) {
    if ((' ' + (allPanelBtns[ci].className || '') + ' ').indexOf(' bma-ie-copy ') === -1) continue;
    allPanelBtns[ci].onclick = function () {
      var srcId = this.getAttribute('data-src');
      var isMulti = this.getAttribute('data-multi') === '1';
      var el = document.getElementById(srcId);
      var val = el ? String(el.value || '').replace(/^\s+|\s+$/g, '') : '';
      if (!val) { setIeStatus('[เตือน] ไม่มีข้อมูลในช่องนี้'); return; }
      ieCopyClipboard(val);
      if (ieBridgeStatus.connected && ieBridgeStatus.targetFound) {
        ieBridgeReq('/paste', 'POST', { text: val, isMultiline: isMulti }, function (ok, d) {
          setIeStatus(ok && d && d.pasted ? '[สำเร็จ] วางลง Oracle Forms แล้ว' : 'คัดลอกแล้ว (กด Ctrl+V ใน Oracle Forms)');
        });
      } else {
        setIeStatus('คัดลอกแล้ว (กด Ctrl+V ใน Oracle Forms)');
      }
    };
  }

  document.getElementById('bma-ie-fy-select').onchange = function () {
    state.fiscalYear = String(this.value || '70');
    saveState();
    renderIeFiscalYearDropdown();
    loadDataViaXhr();
  };

  document.getElementById('bma-ie-fy-toggle').onclick = function () {
    var box = document.getElementById('bma-ie-fy-box');
    if (box) {
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
      renderIeFiscalYearDropdown();
    }
  };

  document.getElementById('bma-ie-add-next-fy').onclick = function () {
    var maxYr = 70;
    for (var k in state.fiscalYears) {
      if (state.fiscalYears.hasOwnProperty(k)) {
        var n = parseInt(k, 10) || 70;
        if (n > maxYr) maxYr = n;
      }
    }
    var nextYr = String(maxYr + 1);
    document.getElementById('bma-ie-cfg-fy').value = nextYr;
    document.getElementById('bma-ie-cfg-ac').value = '';
    document.getElementById('bma-ie-cfg-miss').value = '';
  };

  document.getElementById('bma-ie-save-fy').onclick = function () {
    var rawFy = String(document.getElementById('bma-ie-cfg-fy').value || '').replace(/\D/g, '');
    var fy = (rawFy.length === 4 && rawFy.indexOf('25') === 0) ? rawFy.slice(2) : (rawFy || '70');
    var acId = extractSheetId(document.getElementById('bma-ie-cfg-ac').value) || DEFAULT_FISCAL_YEARS['70'].autocratSheetId;
    var msId = extractSheetId(document.getElementById('bma-ie-cfg-miss').value) || DEFAULT_FISCAL_YEARS['70'].missSheetId;
    state.fiscalYears[fy] = {
      label: 'ปีงบ ' + fy + ' (MISS' + fy + ' / Auto Crat-EGP' + fy + ')',
      autocratSheetId: acId,
      missSheetId: msId
    };
    state.fiscalYear = fy;
    document.getElementById('bma-ie-fy-box').style.display = 'none';
    saveState();
    renderIeFiscalYearDropdown();
    loadDataViaXhr();
  };

  document.getElementById('bma-ie-search').onkeyup = renderIeList;
  document.getElementById('bma-ie-select').onchange = onIeItemChange;
  document.getElementById('bma-ie-sync').onclick = function () { loadDataViaXhr(); pollIeBridge(); };
  document.getElementById('bma-ie-fillbtn').onclick = function () { runAutoFill(); };
  document.getElementById('bma-ie-step7').onclick = function () { runAutoFill(7); };
  document.getElementById('bma-ie-step8').onclick = function () { runAutoFill(8); };
  document.getElementById('bma-ie-purno').onchange = function () { state.purHireNo = this.value; saveState(); if (!isIeMis2Portal()) runAutoFill(undefined, true); };
  document.getElementById('bma-ie-pono').onchange = function () { state.poNo = this.value; saveState(); if (!isIeMis2Portal()) runAutoFill(undefined, true); };
  document.getElementById('bma-ie-rcvno').onchange = function () { state.rcvNo = this.value; document.getElementById('bma-ie-pay-rcvno').value = this.value; saveState(); if (!isIeMis2Portal()) runAutoFill(undefined, true); };
  document.getElementById('bma-ie-inv').onchange = function () { state.invoiceNo = this.value; saveState(); if (!isIeMis2Portal()) runAutoFill(undefined, true); };
  document.getElementById('bma-ie-comm').onchange = function () { state.committeeSet = this.value; saveState(); if (!isIeMis2Portal()) runAutoFill(undefined, true); };

  var commSel = document.getElementById('bma-ie-comm');
  if (commSel) commSel.value = state.committeeSet || '1';
  ieSetSelectOptions(document.getElementById('bma-ie-select'), [{ value: '', text: '-- กำลังโหลดรายการจาก Google Sheet... --' }], '');
  ieSetSelectOptions(document.getElementById('bma-ie-vselect'), [{ value: '', text: '-- กำลังโหลดทะเบียนบริษัท... --' }], '');

  switchIeMode(state.activeMode);
  switchIePaySub(state.paySubTab);
  pollIeBridge();
  loadDataViaXhr();
})();
