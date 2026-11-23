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
    var saved = localStorage.getItem('bma_mis_ie_state');
    if (saved) {
      var parsed = JSON.parse(saved);
      for (var k in parsed) {
        if (parsed.hasOwnProperty(k)) state[k] = parsed[k];
      }
    }
  } catch (e) {}
  if (isIeMis2Portal()) state.activeMode = 'pay';

  function saveState() {
    try {
      localStorage.setItem('bma_mis_ie_state', JSON.stringify(state));
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

  function findInputsAfterLabel(doc, labelText) {
    var tds = doc.querySelectorAll('td, th, span, div');
    var cleanTarget = labelText.replace(/\s+/g, '').toLowerCase();
    for (var i = 0; i < tds.length; i++) {
      var td = tds[i];
      if (td.children && td.children.length > 3) continue;
      var txt = String(td.innerText || td.textContent || '').replace(/\s+/g, '').toLowerCase();
      if (txt.indexOf(cleanTarget) !== -1) {
        var next = td.nextElementSibling;
        while (next) {
          var inputs = next.querySelectorAll('input:not([type="hidden"]), select, textarea');
          if (inputs.length > 0) {
            var arr = [];
            for (var m = 0; m < inputs.length; m++) arr.push(inputs[m]);
            return arr;
          }
          next = next.nextElementSibling;
        }
        var selfInputs = td.querySelectorAll('input:not([type="hidden"]), select, textarea');
        if (selfInputs.length > 0) {
          var arr2 = [];
          for (var n = 0; n < selfInputs.length; n++) arr2.push(selfInputs[n]);
          return arr2;
        }
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
        var inps = tr.querySelectorAll('input[type="text"]');
        var cb = tr.querySelector('input[type="checkbox"]');
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
      var cbs = doc.querySelectorAll('input[type="checkbox"]');
      for (var c = 0; c < cbs.length; c++) {
        var pTxt = (cbs[c].parentElement ? cbs[c].parentElement.innerText : '');
        if (pTxt.indexOf('ได้รับการคัดเลือก') !== -1 && !cbs[c].checked) {
          cbs[c].checked = true;
          fireEvents(cbs[c]);
          count++;
        }
      }

      var trs = doc.getElementsByTagName('tr');
      for (var r = 0; r < trs.length; r++) {
        var tr = trs[r];
        var inps = tr.querySelectorAll('input[type="text"]');
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
          var cb1 = tr.querySelector('input[type="checkbox"]');
          if (cb1 && !cb1.checked) { cb1.checked = true; fireEvents(cb1); count++; }
        }
        if (isMed && editable.length >= 2) {
          var cb2 = tr.querySelector('input[type="checkbox"]');
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
          var sel = tbls[t].querySelector('select');
          if (sel && setSelectByTextOrVal(sel, '1')) count++;
          var cb = tbls[t].querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) { cb.checked = true; fireEvents(cb); count++; }
        }
        if (txt.indexOf('แจ้งส่ง') !== -1 && txt.indexOf('ตรวจรับ') !== -1) {
          var trs = tbls[t].getElementsByTagName('tr');
          for (var r = 0; r < trs.length; r++) {
            var inps = trs[r].querySelectorAll('input[type="text"]');
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
      var allInps = doc.querySelectorAll('input[type="text"]');
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
            if (trs[r].querySelectorAll('input[type="text"]').length >= 2 && trs[r].querySelector('select')) {
              dataRows.push(trs[r]);
            }
          }
          for (var idx = 0; idx < dataRows.length; idx++) {
            var tr = dataRows[idx];
            var tInps = tr.querySelectorAll('input[type="text"]');
            var sel = tr.querySelector('select');
            var cb = tr.querySelector('input[type="checkbox"]');
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
      if (st) st.innerHTML = '✓ กรอกอัตโนมัติ [' + item.code + '] แล้ว (' + count + ' จุด) • รอคุณกด [บันทึก]';
    } else if (!isSilent && st) {
      st.innerHTML = '⚠️ ไม่พบช่องที่ต้องกรอกในหน้านี้';
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

  function ieFormatPayDesc(item) {
    if (!item) return '';
    var subj = String(item.missSubject || item.subject || '').replace(/^\s+|\s+$/g, '');
    if (!subj) return '';
    if (subj.indexOf('ค่า') === 0) return '(' + subj + ')';
    return '(ค่า' + subj + ')';
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

  function ieBridgeReq(endpoint, method, payload, cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open(method || 'GET', BRIDGE_URL + endpoint, true);
      if ((method || 'GET').toUpperCase() === 'POST') {
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var parsed = JSON.parse(xhr.responseText);
              if (cb) cb(true, parsed);
              return;
            } catch (e) {}
          }
          if (cb) cb(false, null);
        }
      };
      xhr.onerror = function () {
        if (cb) cb(false, null);
      };
      xhr.send((method || 'GET').toUpperCase() === 'POST' ? JSON.stringify(payload || {}) : null);
    } catch (e) {
      if (cb) cb(false, null);
    }
  }

  // ==================== BUILD IE PANEL UI ====================
  var oldPanel = document.getElementById('bma-ie-panel');
  if (oldPanel) oldPanel.parentNode.removeChild(oldPanel);

  var panel = document.createElement('div');
  panel.id = 'bma-ie-panel';
  panel.style.cssText = 'position:fixed;top:10px;right:10px;width:350px;max-height:92vh;overflow-y:auto;background:#ffffff;border:2px solid #2563eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:Tahoma,sans-serif;font-size:12px;color:#1e293b;z-index:2147483647;padding:10px;box-sizing:border-box;';

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

  function ieCopyBtnHtml(id, isMulti) {
    return '<button type="button" class="bma-ie-copy" data-src="' + id + '" data-multi="' + (isMulti ? '1' : '0') + '" style="width:28px;height:25px;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:4px;cursor:pointer;font-size:11px;padding:0;flex-shrink:0;" title="คัดลอก/วาง">📋</button>';
  }

  panel.innerHTML =
    '<div style="background:#1d4ed8;color:#fff;padding:7px 9px;border-radius:6px;font-weight:bold;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;">' +
      '<span>💊 BMA MIS &amp; MIS2 <span style="font-size:9.5px;background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px;">ARISSARA.K</span></span>' +
      '<span>' +
        '<button id="bma-ie-sync" type="button" style="background:#3b82f6;color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:10.5px;margin-right:3px;">🔄 ซิงค์</button>' +
        '<button id="bma-ie-min" type="button" style="background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:10.5px;">➖</button>' +
      '</span>' +
    '</div>' +

    '<div id="bma-ie-body">' +
      '<div style="display:flex;gap:4px;background:#e2e8f0;padding:3px;border-radius:7px;margin-bottom:7px;">' +
        '<button id="bma-ie-tab-pur" type="button" style="flex:1;padding:6px 4px;border:none;border-radius:5px;font-weight:bold;font-size:11.5px;cursor:pointer;">📦 จัดซื้อ/ตรวจรับ (8 ขั้น)</button>' +
        '<button id="bma-ie-tab-pay" type="button" style="flex:1;padding:6px 4px;border:none;border-radius:5px;font-weight:bold;font-size:11.5px;cursor:pointer;">💰 เบิกจ่าย MIS2 (ฎีกา)</button>' +
      '</div>' +

      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:6px;margin-bottom:6px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
          '<span style="color:#1e40af;font-weight:bold;font-size:11px;">📅 ปีงบประมาณ &amp; ไฟล์ปลายทาง</span>' +
          '<button id="bma-ie-fy-toggle" type="button" style="background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:bold;cursor:pointer;">➕ เพิ่มปีงบ / ตั้งค่าไฟล์</button>' +
        '</div>' +
        '<select id="bma-ie-fy-select" style="width:100%;padding:4px;border:1px solid #93c5fd;border-radius:4px;font-weight:bold;color:#1e3a8a;box-sizing:border-box;"></select>' +
        '<div id="bma-ie-fy-box" style="display:none;margin-top:6px;padding-top:6px;border-top:1px dashed #93c5fd;font-size:11px;">' +
          '<div style="margin-bottom:4px;">' +
            '<div style="font-weight:bold;color:#1e3a8a;">ปีงบประมาณ (เช่น 70, 71, 72):</div>' +
            '<div style="display:flex;gap:4px;">' +
              '<input id="bma-ie-cfg-fy" type="text" value="' + state.fiscalYear + '" style="width:65px;padding:3px;border:1px solid #cbd5e1;border-radius:4px;font-weight:bold;" />' +
              '<button id="bma-ie-add-next-fy" type="button" style="flex:1;background:#fff;color:#1d4ed8;border:1px solid #93c5fd;border-radius:4px;font-size:10px;font-weight:bold;cursor:pointer;">➕ สร้างปีถัดไป</button>' +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:4px;">' +
            '<div style="font-weight:bold;color:#1e3a8a;">ลิงก์/ID ไฟล์ Auto Crat-EGP:</div>' +
            '<input id="bma-ie-cfg-ac" type="text" value="' + (curIeEntry.autocratSheetId || '') + '" placeholder="วางลิงก์หรือ ID Google Sheet..." style="width:100%;padding:3px;border:1px solid #cbd5e1;border-radius:4px;font-size:10.5px;box-sizing:border-box;" />' +
          '</div>' +
          '<div style="margin-bottom:5px;">' +
            '<div style="font-weight:bold;color:#1e3a8a;">ลิงก์/ID ไฟล์ MISS:</div>' +
            '<input id="bma-ie-cfg-miss" type="text" value="' + (curIeEntry.missSheetId || '') + '" placeholder="วางลิงก์หรือ ID Google Sheet..." style="width:100%;padding:3px;border:1px solid #cbd5e1;border-radius:4px;font-size:10.5px;box-sizing:border-box;" />' +
          '</div>' +
          '<button id="bma-ie-save-fy" type="button" style="width:100%;background:#1d4ed8;color:#fff;border:none;border-radius:4px;padding:5px;font-size:11px;font-weight:bold;cursor:pointer;">💾 บันทึกปีงบ &amp; โหลดไฟล์ใหม่</button>' +
        '</div>' +
      '</div>' +

      '<div style="margin-bottom:6px;">' +
        '<input id="bma-ie-search" type="text" placeholder="ค้นหารหัส เช่น 1งบ, 7งบ, 30งบ..." style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:4px;margin-bottom:4px;box-sizing:border-box;" />' +
        '<select id="bma-ie-select" style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;font-weight:bold;"></select>' +
      '</div>' +

      /* ===== MODE 1: จัดซื้อ/ตรวจรับ (8 ขั้นตอน) ===== */
      '<div id="bma-ie-mode-pur">' +
        '<div id="bma-ie-summary" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:7px;margin-bottom:6px;font-size:11.5px;line-height:1.45;">กำลังโหลดข้อมูลจาก Google Sheet...</div>' +
        '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
          '<input id="bma-ie-purno" type="text" placeholder="รหัสจัดซื้อ" title="รหัสจัดซื้อ" style="width:33%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' +
          '<input id="bma-ie-pono" type="text" placeholder="เลขใบสั่งซื้อ" title="เลขที่ใบสั่งซื้อ" style="width:33%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' +
          '<input id="bma-ie-rcvno" type="text" placeholder="เลขใบตรวจรับ" title="เลขที่ใบตรวจรับ" style="width:34%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' +
        '</div>' +
        '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
          '<input id="bma-ie-inv" type="text" placeholder="เลขที่บิล (หน้าส่งมอบ)..." style="width:55%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' +
          '<select id="bma-ie-comm" style="width:45%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;">' +
            '<option value="1">ชุดที่ 1 (เบญญาภา)</option>' +
            '<option value="2">ชุดที่ 2 (วีรวิชญ์)</option>' +
          '</select>' +
        '</div>' +
        '<button id="bma-ie-fillbtn" type="button" style="width:100%;padding:8px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;margin-bottom:6px;">⚡ กรอกซ้ำอีกครั้ง (Auto-Fill)</button>' +
        '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
          '<button id="bma-ie-step7" type="button" style="width:50%;padding:6px 4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:5px;font-weight:bold;cursor:pointer;font-size:11px;">7. กรรมการ (ข้อ12)</button>' +
          '<button id="bma-ie-step8" type="button" style="width:50%;padding:6px 4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:5px;font-weight:bold;cursor:pointer;font-size:11px;">8. พิมพ์ใบตรวจรับ (ข้อ13)</button>' +
        '</div>' +
      '</div>' +

      /* ===== MODE 2: เบิกจ่าย MIS2 (FRM_PAY_DOC) ===== */
      '<div id="bma-ie-mode-pay" style="display:none;">' +
        '<div id="bma-ie-bridge-bar" style="background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:6px;padding:6px;font-size:10.5px;margin-bottom:6px;">' +
          '<div id="bma-ie-bridge-txt">กำลังตรวจสอบตัวช่วย Oracle Forms...</div>' +
          '<div style="display:flex;gap:3px;margin-top:4px;">' +
            '<button id="bma-ie-br-pick" type="button" style="flex:1;padding:3px;font-size:10px;font-weight:bold;background:#fff;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">🪟 เลือกหน้าต่าง</button>' +
            '<button id="bma-ie-br-cal" type="button" style="flex:1;padding:3px;font-size:10px;font-weight:bold;background:#fff;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">🎯 ตั้งพิกัด (F8)</button>' +
          '</div>' +
        '</div>' +
        '<div id="bma-ie-pay-dup" style="display:none;background:#fef2f2;border:2px solid #dc2626;color:#b91c1c;padding:5px;border-radius:5px;font-weight:bold;font-size:11px;text-align:center;margin-bottom:5px;"></div>' +
        '<div id="bma-ie-pay-brief" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:5px 7px;font-size:11px;margin-bottom:6px;"></div>' +

        '<div style="display:flex;gap:3px;margin-bottom:6px;">' +
          '<button id="bma-ie-psub-1" type="button" style="flex:1;padding:5px 3px;font-size:10.5px;font-weight:bold;border:1px solid #cbd5e1;border-radius:5px;cursor:pointer;">1. ใบตรวจรับ</button>' +
          '<button id="bma-ie-psub-2" type="button" style="flex:1;padding:5px 3px;font-size:10.5px;font-weight:bold;border:1px solid #cbd5e1;border-radius:5px;cursor:pointer;">2. ผู้รับเงิน</button>' +
          '<button id="bma-ie-psub-3" type="button" style="flex:1;padding:5px 3px;font-size:10.5px;font-weight:bold;border:1px solid #cbd5e1;border-radius:5px;cursor:pointer;">3. รายละเอียด</button>' +
        '</div>' +

        /* Pay Sub 1 */
        '<div id="bma-ie-ppane-1">' +
          '<div style="display:flex;gap:4px;margin-bottom:5px;">' +
            '<div style="flex:1;"><div style="font-size:10.5px;font-weight:bold;">เลขใบตรวจรับ</div><div style="display:flex;gap:2px;"><input id="bma-ie-pay-rcvno" type="text" style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' + ieCopyBtnHtml('bma-ie-pay-rcvno', false) + '</div></div>' +
            '<div style="width:95px;"><div style="font-size:10.5px;font-weight:bold;">ปีงบ</div><div style="display:flex;gap:2px;"><input id="bma-ie-pay-rcvyr" type="text" value="' + state.fiscalYear + '" style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' + ieCopyBtnHtml('bma-ie-pay-rcvyr', false) + '</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;margin-bottom:5px;">' +
            '<div style="flex:1;"><div style="font-size:10.5px;font-weight:bold;">VAT (7%)</div><div style="display:flex;gap:2px;"><input id="bma-ie-pay-vat" type="text" style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' + ieCopyBtnHtml('bma-ie-pay-vat', false) + '</div></div>' +
            '<div style="flex:1;"><div style="font-size:10.5px;font-weight:bold;">หักภาษี (1%)</div><div style="display:flex;gap:2px;"><input id="bma-ie-pay-wht" type="text" style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;" />' + ieCopyBtnHtml('bma-ie-pay-wht', false) + '</div></div>' +
          '</div>' +
          '<div id="bma-ie-pay-taxbadge" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:5px;border-radius:5px;font-weight:bold;font-size:11px;text-align:center;margin-bottom:6px;">สุทธิที่จ่าย: -</div>' +
          '<button id="bma-ie-prun-1" type="button" style="width:100%;padding:6px;background:#0284c7;color:#fff;border:none;border-radius:5px;font-weight:bold;cursor:pointer;margin-bottom:4px;font-size:11.5px;">⚡ ขั้น 1: กรอกใบตรวจรับ + กดแว่นขยาย 🔍</button>' +
          '<button id="bma-ie-prun-15" type="button" style="width:100%;padding:6px;background:#0e7490;color:#fff;border:none;border-radius:5px;font-weight:bold;cursor:pointer;margin-bottom:4px;font-size:11.5px;">⚡ ขั้น 1.5: รายละเอียด ➔ ติ๊กงบ ➔ ตกลง</button>' +
          '<button id="bma-ie-prun-16" type="button" style="width:100%;padding:6px;background:#0369a1;color:#fff;border:none;border-radius:5px;font-weight:bold;cursor:pointer;margin-bottom:6px;font-size:11.5px;">⚡ ขั้น 1.6: กรอก VAT 7% + หักภาษี 1%</button>' +
        '</div>' +

        /* Pay Sub 2 */
        '<div id="bma-ie-ppane-2" style="display:none;">' +
          '<input id="bma-ie-vsearch" type="text" placeholder="ค้นหาบริษัทในทะเบียนบริษัท..." style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;margin-bottom:3px;box-sizing:border-box;" />' +
          '<select id="bma-ie-vselect" style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;margin-bottom:4px;box-sizing:border-box;"></select>' +
          '<div id="bma-ie-bankinfo" style="background:#f0f9ff;border:1px solid #bae6fd;color:#0c4a6e;padding:4px 6px;border-radius:5px;font-size:10.5px;margin-bottom:5px;">🏦 ธนาคาร: - | 📍 สาขา: -</div>' +
          '<div style="display:flex;align-items:center;gap:3px;margin-bottom:4px;"><label style="width:74px;font-size:10.5px;font-weight:bold;"><input id="bma-ie-ck-payTo" type="checkbox" ' + (ieChecks.payTo !== false ? 'checked' : '') + ' />จ่ายให้</label><input id="bma-ie-pay-to" type="text" style="flex:1;padding:3px;border:1px solid #cbd5e1;border-radius:4px;" />' + ieCopyBtnHtml('bma-ie-pay-to', false) + '</div>' +
          '<div style="display:flex;align-items:center;gap:3px;margin-bottom:4px;"><label style="width:74px;font-size:10.5px;font-weight:bold;"><input id="bma-ie-ck-assignTo" type="checkbox" ' + (ieChecks.assignTo !== false ? 'checked' : '') + ' />มอบให้</label><input id="bma-ie-pay-assign" type="text" style="flex:1;padding:3px;border:1px solid #cbd5e1;border-radius:4px;" />' + ieCopyBtnHtml('bma-ie-pay-assign', false) + '</div>' +
          '<div style="display:flex;align-items:center;gap:3px;margin-bottom:4px;"><label style="width:74px;font-size:10.5px;font-weight:bold;"><input id="bma-ie-ck-bankCode" type="checkbox" ' + (ieChecks.bankCode !== false ? 'checked' : '') + ' />ธนาคาร</label><input id="bma-ie-pay-bank" type="text" style="flex:1;padding:3px;border:1px solid #cbd5e1;border-radius:4px;" />' + ieCopyBtnHtml('bma-ie-pay-bank', false) + '</div>' +
          '<div style="display:flex;align-items:center;gap:3px;margin-bottom:4px;"><label style="width:74px;font-size:10.5px;font-weight:bold;"><input id="bma-ie-ck-branchCode" type="checkbox" ' + (ieChecks.branchCode !== false ? 'checked' : '') + ' />สาขา 4 หลัก</label><input id="bma-ie-pay-branch" type="text" style="flex:1;padding:3px;border:1px solid #cbd5e1;border-radius:4px;" />' + ieCopyBtnHtml('bma-ie-pay-branch', false) + '</div>' +
          '<div style="display:flex;align-items:center;gap:3px;margin-bottom:6px;"><label style="width:74px;font-size:10.5px;font-weight:bold;"><input id="bma-ie-ck-accountNo" type="checkbox" ' + (ieChecks.accountNo !== false ? 'checked' : '') + ' />เลขบัญชี</label><input id="bma-ie-pay-acct" type="text" style="flex:1;padding:3px;border:1px solid #cbd5e1;border-radius:4px;" />' + ieCopyBtnHtml('bma-ie-pay-acct', false) + '</div>' +
          '<button id="bma-ie-prun-2" type="button" style="width:100%;padding:7px;background:#0284c7;color:#fff;border:none;border-radius:5px;font-weight:bold;cursor:pointer;margin-bottom:6px;">⚡ ขั้น 2: กรอกแท็บ \'ผู้รับเงิน\'</button>' +
        '</div>' +

        /* Pay Sub 3 */
        '<div id="bma-ie-ppane-3" style="display:none;">' +
          '<div style="margin-bottom:4px;"><div style="font-size:10.5px;font-weight:bold;">ชื่อผู้ขอเบิก</div><div style="display:flex;gap:2px;"><input id="bma-ie-pay-req" type="text" value="' + (state.defaultRequester || 'นางอรชุมา หุตะโกวิท') + '" style="flex:1;padding:4px;border:1px solid #cbd5e1;border-radius:4px;" />' + ieCopyBtnHtml('bma-ie-pay-req', false) + '</div></div>' +
          '<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:bold;"><span>วันที่เบิก (พ.ศ.)</span><span><button id="bma-ie-dt-today" type="button" style="font-size:10px;padding:1px 4px;cursor:pointer;">วันนี้</button> <button id="bma-ie-dt-rcv" type="button" style="font-size:10px;padding:1px 4px;cursor:pointer;">วันตรวจรับ</button></span></div><div style="display:flex;gap:2px;"><input id="bma-ie-pay-date" type="text" value="' + ieTodayThaiSlash() + '" style="flex:1;padding:4px;border:1px solid #cbd5e1;border-radius:4px;" />' + ieCopyBtnHtml('bma-ie-pay-date', false) + '</div></div>' +
          '<div style="margin-bottom:5px;"><div style="font-size:10.5px;font-weight:bold;">คำอธิบายรายการเบิก</div><div style="display:flex;gap:2px;"><textarea id="bma-ie-pay-desc" style="flex:1;height:48px;padding:4px;border:1px solid #cbd5e1;border-radius:4px;font-family:Tahoma,sans-serif;font-size:11px;"></textarea>' + ieCopyBtnHtml('bma-ie-pay-desc', true) + '</div></div>' +
          '<button id="bma-ie-prun-3" type="button" style="width:100%;padding:7px;background:#0284c7;color:#fff;border:none;border-radius:5px;font-weight:bold;cursor:pointer;margin-bottom:5px;">⚡ ขั้น 3: กรอกแท็บ \'รายละเอียดเบิก\'</button>' +
          '<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:4px 6px;border-radius:5px;font-size:10.5px;font-weight:bold;text-align:center;margin-bottom:6px;">🛑 หยุดก่อนบันทึกทุกครั้ง (คนกด 💾 เอง) | กด ESC หยุดทันที</div>' +
        '</div>' +

        '<div style="border-top:1px solid #e2e8f0;padding-top:5px;margin-bottom:6px;">' +
          '<div style="font-size:10.5px;font-weight:bold;margin-bottom:3px;">บันทึกเลขที่ใบขอเบิกลง MISS (คอลัมน์ H)</div>' +
          '<div style="display:flex;gap:4px;">' +
            '<input id="bma-ie-pay-docno" type="text" placeholder="เช่น 123/' + state.fiscalYear + '" style="flex:1;padding:4px;border:1px solid #cbd5e1;border-radius:4px;" />' +
            '<button id="bma-ie-pay-savedoc" type="button" style="background:#16a34a;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-weight:bold;font-size:11px;cursor:pointer;">💾 บันทึก</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="bma-ie-status" style="background:#f1f5f9;padding:5px 7px;border-radius:4px;font-size:11px;font-weight:bold;margin-bottom:4px;">พร้อมใช้งานบน IE Mode</div>' +
      '<div style="text-align:center;font-size:10.5px;color:#64748b;font-weight:bold;">ผู้พัฒนา: <span style="color:#1d4ed8;">ARISSARA.K</span> • กลุ่มงานเภสัชกรรม รพจ.</div>' +
    '</div>';

  document.body.appendChild(panel);

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
      bar.style.borderColor = '#86efac';
      bar.style.color = '#166534';
      var wStr = ieBridgeStatus.targetFound
        ? '🪟 ล็อก: ' + String(ieBridgeStatus.targetTitle || 'Oracle Forms').slice(0, 26)
        : '⚠️ ยังไม่พบหน้าต่าง Oracle Forms';
      txt.innerHTML = '<b>🟢 เชื่อมตัวช่วย Oracle Forms แล้ว</b> (พิกัด ' + ieBridgeStatus.calibratedCount + '/' + ieBridgeStatus.totalCalibCount + ')<br/>' + wStr;
    } else {
      bar.style.background = '#fffbeb';
      bar.style.borderColor = '#fcd34d';
      bar.style.color = '#92400e';
      txt.innerHTML = '<b>🟡 โหมดคัดลอกวาง</b> (เปิด <b>START_ORACLE_BRIDGE.bat</b> เพื่อกรอกอัตโนมัติ)';
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
    var q = String((qIn && qIn.value) || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var list = state.vendors || [];
    var html = '<option value="">-- เลือกบริษัทจากทะเบียนบริษัท (' + list.length + ') --</option>';
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      var match = !q ||
        String(v.company || '').toLowerCase().indexOf(q) !== -1 ||
        String(v.bank || '').toLowerCase().indexOf(q) !== -1 ||
        String(v.accountNo || '').indexOf(q) !== -1;
      if (match) {
        var bTag = v.bank ? ' [' + (v.bankCode || '') + ' ' + v.bank + ']' : '';
        html += '<option value="' + String(v.company || '').replace(/"/g, '&quot;') + '">' + v.company + bTag + '</option>';
      }
    }
    sel.innerHTML = html;
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
      '🏦 ธนาคาร (B): <b>' + (v.bank || '-') + ' (' + (v.bankCode || '-') + ')</b><br/>📍 สาขา (C): <b>' + (v.branch || '-') + '</b>';
    updateIeTaxDisplay(item ? item.amount : 0, v.company || '');
  }

  function applyItemToIePay(item) {
    if (!item) return;
    var fy = String(state.fiscalYear || '70');
    document.getElementById('bma-ie-pay-rcvno').value = state.rcvNo || item.rcvNo || '';
    document.getElementById('bma-ie-pay-rcvyr').value = fy;
    document.getElementById('bma-ie-pay-desc').value = ieFormatPayDesc(item);
    document.getElementById('bma-ie-pay-docno').value = item.payDocNo || '';
    document.getElementById('bma-ie-pay-savedoc').innerHTML = '💾 ลง MISS' + fy;

    var rcvDisp = item.rcvNo ? (item.rcvNo + '/' + fy) : '(ยังไม่มีเลขตรวจรับ)';
    document.getElementById('bma-ie-pay-brief').innerHTML =
      '<b>[' + item.code + ']</b> ใบตรวจรับ: <b>' + rcvDisp + '</b> | <b style="color:#16a34a;">' + item.amountFormatted + ' ฿</b><br/>' +
      '<span style="color:#475569;">' + (item.vendorName || '-') + '</span>';

    var dup = document.getElementById('bma-ie-pay-dup');
    if (item.payDocNo) {
      dup.style.display = 'block';
      dup.innerHTML = '⛔ มีประวัติขอเบิกแล้วใน MISS' + fy + ' (เลขที่: ' + item.payDocNo + ') — ระวังเบิกซ้ำ!';
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
      document.getElementById('bma-ie-bankinfo').innerHTML = '⚠️ ไม่พบบริษัทในทะเบียนบริษัท — เลือกจากช่องด้านบนได้';
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
      alert('ยังไม่ได้เปิดตัวช่วย Oracle Forms\n\n• ดับเบิลคลิก START_ORACLE_BRIDGE.bat เพื่อกรอกอัตโนมัติ\n• หรือกดปุ่ม 📋 ข้างแต่ละช่องเพื่อคัดลอกไป Ctrl+V เองได้ทันที');
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

    setIeStatus('⚡ กำลังกรอกขั้นที่ ' + step + ' ลง Oracle Forms... (กด ESC หยุดทันที)');
    ieBridgeReq('/run-step', 'POST', { step: step, payload: payload }, function (ok, d) {
      if (!ok || !d) {
        setIeStatus('❌ ติดต่อตัวช่วย Oracle Forms ไม่ได้');
        pollIeBridge();
        return;
      }
      if (d.ok) {
        setIeStatus('✓ ' + (d.message || ('กรอกขั้นที่ ' + step + ' สำเร็จ')));
        if (step === '1.6') switchIePaySub('2');
        if (step === '2') switchIePaySub('3');
      } else {
        setIeStatus('⚠️ ' + (d.error || 'กรอกไม่สำเร็จ'));
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
    setIeStatus('💾 กำลังบันทึกเลขใบขอเบิก ' + payNo + ' ลง MISS' + fy + '...');
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', GAS_URL, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          try {
            var res = JSON.parse(xhr.responseText);
            if (res && res.ok) {
              item.payDocNo = payNo;
              saveState();
              applyItemToIePay(item);
              setIeStatus('✓ บันทึกเลขใบขอเบิก ' + payNo + ' ลง MISS' + fy + ' เรียบร้อย!');
              return;
            }
          } catch (e) {}
          setIeStatus('❌ บันทึก MISS' + fy + ' ไม่สำเร็จ');
        }
      };
      xhr.send(JSON.stringify({
        action: 'updatePayDocNo',
        missRowIndex: item.missRowIndex,
        payDocNo: payNo,
        missSheetId: extractSheetId(entry.missSheetId),
        missTabName: 'ชีต1'
      }));
    } catch (e2) {
      setIeStatus('❌ บันทึกไม่สำเร็จ');
    }
  }

  function loadFallbackVendorsCache() {
    if (state.vendors && state.vendors.length > 0) return;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', VENDORS_CACHE_URL + '?t=' + new Date().getTime(), true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
          try {
            var data = JSON.parse(xhr.responseText);
            var arr = (data && data.vendors) ? data.vendors : (data instanceof Array ? data : []);
            if (arr.length > 0) {
              state.vendors = arr;
              renderIeVendors();
              applyItemToIePay(getSelectedItem());
            }
          } catch (e) {}
        }
      };
      xhr.send();
    } catch (e2) {}
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
    var html = '';
    for (var i = 0; i < yrs.length; i++) {
      var y = yrs[i];
      var info = state.fiscalYears[y] || {};
      var lbl = info.label || ('ปีงบ ' + y + ' (MISS' + y + ' / Auto Crat-EGP' + y + ')');
      html += '<option value="' + y + '">' + lbl + '</option>';
    }
    sel.innerHTML = html;
    sel.value = String(state.fiscalYear || '70');

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
      sel.innerHTML = '<option value="">-- ไม่พบรายการ --</option>';
      return;
    }
    var html = '';
    for (var k = 0; k < list.length; k++) {
      var x = list[k];
      var recTag = isItemAlreadyRecorded(x) ? '⛔(ลงแล้ว) ' : '';
      html += '<option value="' + x.code + '">' + recTag + '[' + x.code + '] ' + String(x.subject || '').slice(0, 28) + ' (' + x.amountFormatted + ')</option>';
    }
    sel.innerHTML = html;
    state.selectedCode = list[0].code;
    sel.value = state.selectedCode;
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
      ? '<div style="background:#fef2f2;border:2px solid #dc2626;color:#b91c1c;padding:5px;border-radius:4px;font-weight:bold;text-align:center;margin-bottom:5px;">⛔ มีประวัติการลงข้อมูลแล้ว<br/>(ล็อกขั้น 1-6 • แก้ไขขั้น 7 และ 8 ได้)</div>'
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
    btn.innerHTML = !allowMain ? '⛔ มีประวัติการลงข้อมูลแล้ว (ล็อกขั้น 1-6)' : '⚡ กรอกซ้ำอีกครั้ง (Auto-Fill)';
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
      var btns = docs[d].querySelectorAll('input[type="button"], input[type="submit"], button');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var txt = String(b.value || b.innerText || '').replace(/\s+/g, '');
        if (/^(บันทึก|ตกลง|แสดงรายงาน|รายละเอียด)$/.test(txt)) {
          b.style.border = '2px solid #16a34a';
          b.style.fontWeight = 'bold';
        }
      }
    }
  }

  function loadDataViaXhr() {
    var fy = String(state.fiscalYear || '70').replace(/^\s+|\s+$/g, '');
    var entry = getCurrentIeFyEntry();
    setIeStatus('⏳ กำลังดึงข้อมูลปีงบ ' + fy + ' (MISS' + fy + ' / Auto Crat-EGP' + fy + ')...');
    var url =
      GAS_URL +
      '?fiscalYear=' + encodeURIComponent(fy) +
      '&autocratSheetId=' + encodeURIComponent(extractSheetId(entry.autocratSheetId)) +
      '&missSheetId=' + encodeURIComponent(extractSheetId(entry.missSheetId)) +
      '&t=' + new Date().getTime();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var res = JSON.parse(xhr.responseText);
            if (res && res.items) {
              state.items = res.items;
              if (res.vendors && res.vendors.length > 0) {
                state.vendors = res.vendors;
              } else {
                loadFallbackVendorsCache();
              }
              renderIeVendors();
              renderIeList();
              setIeStatus('✓ ปีงบ ' + fy + ': โหลดสำเร็จ (' + state.items.length + ' รายการ)');
              return;
            }
          } catch (e) {}
        }
        setIeStatus('⚠️ โหลดข้อมูลไม่สำเร็จ');
      }
    };
    xhr.send();
  }

  document.getElementById('bma-ie-min').onclick = function () {
    var body = document.getElementById('bma-ie-body');
    var hidden = body.style.display === 'none';
    body.style.display = hidden ? 'block' : 'none';
    this.innerHTML = hidden ? '➖' : '➕';
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

  var copyBtns = panel.querySelectorAll('.bma-ie-copy');
  for (var ci = 0; ci < copyBtns.length; ci++) {
    copyBtns[ci].onclick = function () {
      var srcId = this.getAttribute('data-src');
      var isMulti = this.getAttribute('data-multi') === '1';
      var el = document.getElementById(srcId);
      var val = el ? String(el.value || '').replace(/^\s+|\s+$/g, '') : '';
      if (!val) { setIeStatus('⚠️ ไม่มีข้อมูลในช่องนี้'); return; }
      ieCopyClipboard(val);
      if (ieBridgeStatus.connected && ieBridgeStatus.targetFound) {
        ieBridgeReq('/paste', 'POST', { text: val, isMultiline: isMulti }, function (ok, d) {
          setIeStatus(ok && d && d.pasted ? '✓ วางลง Oracle Forms แล้ว' : '📋 คัดลอกแล้ว (กด Ctrl+V ใน Oracle Forms)');
        });
      } else {
        setIeStatus('📋 คัดลอกแล้ว (กด Ctrl+V ใน Oracle Forms)');
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

  switchIeMode(state.activeMode);
  switchIePaySub(state.paySubTab);
  pollIeBridge();
  loadDataViaXhr();
})();
