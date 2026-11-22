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

  var state = {
    items: [],
    selectedCode: '',
    committeeSet: '1',
    fiscalYear: '70',
    invoiceNo: '',
    purHireNo: '',
    poNo: '',
    rcvNo: '',
    filterText: '',
    minimized: false
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

  // ==================== BUILD IE PANEL UI ====================
  var oldPanel = document.getElementById('bma-ie-panel');
  if (oldPanel) oldPanel.parentNode.removeChild(oldPanel);

  var panel = document.createElement('div');
  panel.id = 'bma-ie-panel';
  panel.style.cssText = 'position:fixed;top:10px;right:10px;width:330px;background:#ffffff;border:2px solid #2563eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:Tahoma,sans-serif;font-size:12px;color:#1e293b;z-index:2147483647;padding:10px;';

  panel.innerHTML =
    '<div style="background:#1d4ed8;color:#fff;padding:7px 10px;border-radius:6px;font-weight:bold;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">' +
      '<span>💊 BMA MIS Auto-Filler <span style="font-size:10px;background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px;">by ARISSARA.K</span></span>' +
      '<button id="bma-ie-sync" style="background:#3b82f6;color:#fff;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;">🔄 ซิงค์</button>' +
    '</div>' +
    '<div style="margin-bottom:6px;">' +
      '<input id="bma-ie-search" type="text" placeholder="ค้นหารหัส เช่น 1งบ, 7งบ, 30งบ..." style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:4px;margin-bottom:4px;box-sizing:border-box;" />' +
      '<select id="bma-ie-select" style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;font-weight:bold;"></select>' +
    '</div>' +
    '<div id="bma-ie-summary" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:7px;margin-bottom:6px;font-size:11.5px;line-height:1.45;">กำลังโหลดข้อมูลจาก Google Sheet...</div>' +
    '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
      '<input id="bma-ie-purno" type="text" placeholder="รหัสจัดซื้อ" title="รหัสจัดซื้อ" style="width:33%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;" />' +
      '<input id="bma-ie-pono" type="text" placeholder="เลขใบสั่งซื้อ" title="เลขที่ใบสั่งซื้อ" style="width:33%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;" />' +
      '<input id="bma-ie-rcvno" type="text" placeholder="เลขใบตรวจรับ" title="เลขที่ใบตรวจรับ" style="width:34%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;" />' +
    '</div>' +
    '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
      '<input id="bma-ie-inv" type="text" placeholder="เลขที่บิล (หน้าส่งมอบ)..." style="width:55%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;" />' +
      '<select id="bma-ie-comm" style="width:45%;padding:4px;border:1px solid #cbd5e1;border-radius:4px;">' +
        '<option value="1">ชุดที่ 1 (เบญญาภา)</option>' +
        '<option value="2">ชุดที่ 2 (วีรวิชญ์)</option>' +
      '</select>' +
    '</div>' +
    '<button id="bma-ie-fillbtn" style="width:100%;padding:8px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;margin-bottom:6px;">⚡ กรอกซ้ำอีกครั้ง (Auto-Fill)</button>' +
    '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
      '<button id="bma-ie-step7" style="width:50%;padding:6px 4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:5px;font-weight:bold;cursor:pointer;font-size:11px;">7. กรรมการ (ข้อ12)</button>' +
      '<button id="bma-ie-step8" style="width:50%;padding:6px 4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:5px;font-weight:bold;cursor:pointer;font-size:11px;">8. พิมพ์ใบตรวจรับ (ข้อ13)</button>' +
    '</div>' +
    '<div id="bma-ie-status" style="background:#f1f5f9;padding:5px 7px;border-radius:4px;font-size:11px;font-weight:bold;margin-bottom:4px;">พร้อมใช้งานบน IE Mode</div>' +
    '<div style="text-align:center;font-size:10.5px;color:#64748b;font-weight:bold;">ผู้พัฒนา: <span style="color:#1d4ed8;">ARISSARA.K</span> • กลุ่มงานเภสัชกรรม รพจ.</div>';

  document.body.appendChild(panel);

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
    saveState();

    // กรอกอัตโนมัติทันทีที่เลือกรายการหรือโหลดหน้าเสร็จ (รอคนกดบันทึก)
    if (allowMain) {
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
    var st = document.getElementById('bma-ie-status');
    if (st) st.innerHTML = '⏳ กำลังดึงข้อมูลจาก Google Sheets...';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', GAS_URL + '?t=' + new Date().getTime(), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var res = JSON.parse(xhr.responseText);
            if (res && res.items) {
              state.items = res.items;
              renderIeList();
              return;
            }
          } catch (e) {}
        }
        if (st) st.innerHTML = '⚠️ โหลดข้อมูลไม่สำเร็จ';
      }
    };
    xhr.send();
  }

  document.getElementById('bma-ie-search').onkeyup = renderIeList;
  document.getElementById('bma-ie-select').onchange = onIeItemChange;
  document.getElementById('bma-ie-sync').onclick = loadDataViaXhr;
  document.getElementById('bma-ie-fillbtn').onclick = function () { runAutoFill(); };
  document.getElementById('bma-ie-step7').onclick = function () { runAutoFill(7); };
  document.getElementById('bma-ie-step8').onclick = function () { runAutoFill(8); };
  document.getElementById('bma-ie-purno').onchange = function () { state.purHireNo = this.value; saveState(); runAutoFill(undefined, true); };
  document.getElementById('bma-ie-pono').onchange = function () { state.poNo = this.value; saveState(); runAutoFill(undefined, true); };
  document.getElementById('bma-ie-rcvno').onchange = function () { state.rcvNo = this.value; saveState(); runAutoFill(undefined, true); };
  document.getElementById('bma-ie-inv').onchange = function () { state.invoiceNo = this.value; saveState(); runAutoFill(undefined, true); };
  document.getElementById('bma-ie-comm').onchange = function () { state.committeeSet = this.value; saveState(); runAutoFill(undefined, true); };

  loadDataViaXhr();
})();
