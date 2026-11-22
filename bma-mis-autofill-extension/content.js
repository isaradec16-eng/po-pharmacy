/**
 * Content Script สำหรับ BMA MIS Auto-Filler บน Opera / Chrome
 * รองรับการกรอกข้อมูลอัตโนมัติครบทั้ง 6 ขั้นตอน + หน้าต่าง Popup ย่อยทั้งหมด
 */

(function () {
  // ป้องกันการรันซ้ำในเฟรมที่เป็นแค่แถบเมนูเล็กๆ ที่ไม่มีฟอร์ม
  if (window.__bmaMisAutofillLoaded) return;
  window.__bmaMisAutofillLoaded = true;

  const STATE_KEY = 'bma_mis_autofill_state_v1';

  const COMMITTEE_SETS = {
    '1': {
      name: 'ชุดที่ 1 (เบญญาภา / ละอองดาว / ปิยะ)',
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
      name: 'ชุดที่ 2 (วีรวิชญ์ / ธนาภรณ์ / ชิดชนก)',
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

  let state = {
    items: [],
    selectedCode: '',
    committeeSet: '1',
    fiscalYear: '70',
    invoiceNo: '',
    purHireNo: '',
    poNo: '',
    rcvNo: '',
    filterText: '',
    minimized: false,
    gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbyAvDPZrKrKK0B50nU84aK9bVTyLWT47YhjW2ppGiGPSFIrI3Lryu55CBbnPFKCXKMx/exec'
  };

  function getTargetDocs() {
    const docs = [document];
    try {
      const frames = document.querySelectorAll('frame, iframe');
      frames.forEach((f) => {
        try {
          if (f.contentDocument) docs.push(f.contentDocument);
        } catch (e) {}
      });
    } catch (e) {}
    return docs;
  }

  function detectCurrentPage() {
    const url = window.location.href;
    const docs = getTargetDocs();
    let fullText = '';
    let fullUrl = url;

    docs.forEach((d) => {
      try {
        fullText += ' ' + (d.body ? d.body.innerText : '');
        fullUrl += ' ' + (d.location ? d.location.href : '');
      } catch (e) {}
    });

    if (/_searchbudget_bma\.jsp/i.test(fullUrl)) {
      return { id: 'POPUP_BUDGET_BMA', title: '1.2 Popup สอบถามงบประมาณ กทม.' };
    }
    if (/_searchbudget_etc\.jsp/i.test(fullUrl)) {
      return { id: 'POPUP_BUDGET_ETC', title: '1.2 Popup สอบถามเงินนอกงบ (งบเอดส์)' };
    }
    if (/Frm_pur_searchitem\.jsp/i.test(fullUrl)) {
      return { id: 'POPUP_SEARCH_ITEM', title: '1.3 Popup สอบถามรายการพัสดุ' };
    }
    if (/Frm_pur_searchVendor\.jsp/i.test(fullUrl)) {
      return { id: 'POPUP_SEARCH_VENDOR', title: '2.1 Popup ค้นหาผู้ประกอบการ' };
    }
    if (/Frm_pur_bidderdesc\.jsp/i.test(fullUrl) || fullText.includes('รายละเอียดรายการที่เสนอ')) {
      return { id: 'POPUP_BIDDER_DESC', title: '2.2 รายละเอียดรายการที่เสนอ' };
    }
    if (/Frm_pur_selectorder\.jsp/i.test(fullUrl)) {
      return { id: 'POPUP_SELECT_ORDER', title: '4.2 Popup เลือกรายการพัสดุ (ใบสั่งซื้อ)' };
    }
    if (/Rep_pur_rcv\.jsp/i.test(fullUrl) || fullText.includes('รายงานรายละเอียดการตรวจรับ')) {
      return { id: 'STEP8_REP_RCV', title: 'ขั้นตอนที่ 8: ใบตรวจรับพัสดุ (รายงาน -> 13)' };
    }
    if (/Frm_pur_hire_rcv_committee\.jsp/i.test(fullUrl) || fullText.includes('บันทึกข้อมูลคณะกรรมการตรวจรับ') || fullText.includes('รายชื่อคณะกรรมการตรวจรับ')) {
      return { id: 'STEP7_COMMITTEE', title: 'ขั้นตอนที่ 7: คณะกรรมการตรวจรับ (ข้อมูลอื่นๆ -> 12)' };
    }
    if (fullText.includes('บันทึกข้อมูลรายงานผลการตรวจรับจัดซื้อ') || /Frm_pur_receiveterm\.jsp|_receiveterm\.jsp/i.test(fullUrl)) {
      return { id: 'STEP6_RCV_RESULT', title: 'ขั้นตอนที่ 6: รายงานผลการตรวจรับ (แบบงวดงาน)' };
    }
    if (/Frm_pur_prereceiveterm\.jsp/i.test(fullUrl) || fullText.includes('บันทึกข้อมูลการส่งมอบ')) {
      return { id: 'STEP5_DELIVERY', title: 'ขั้นตอนที่ 5: บันทึกการส่งมอบ' };
    }
    if (/_orderterm\.jsp/i.test(fullUrl) || fullText.includes('บันทึกข้อมูลใบสั่งซื้อ/สัญญาแบบงวดงาน')) {
      return { id: 'STEP4_CONTRACT', title: 'ขั้นตอนที่ 4: บันทึกใบสั่งซื้อ/สัญญา' };
    }
    if (/_accept\.jsp/i.test(fullUrl) || fullText.includes('บันทึกข้อมูลอนุมัติจัดซื้อ')) {
      return { id: 'STEP3_APPROVE', title: 'ขั้นตอนที่ 3: บันทึกอนุมัติจัดซื้อ' };
    }
    if (/Frm_pur_bidder\.jsp/i.test(fullUrl) || fullText.includes('รายการผู้เข้าร่วมเสนอราคา/คัดเลือก')) {
      return { id: 'STEP2_BIDDER', title: 'ขั้นตอนที่ 2: เสนอราคา/คัดเลือก' };
    }
    if (/_agree\.jsp/i.test(fullUrl) || fullText.includes('บันทึกข้อมูลเห็นชอบจัดซื้อ')) {
      return { id: 'STEP1_AGREE', title: 'ขั้นตอนที่ 1: บันทึกเห็นชอบจัดซื้อ' };
    }
    return { id: 'UNKNOWN', title: 'ระบบงานจัดซื้อ/เช่า (MIS กทม.)' };
  }

  // ==================== DOM HELPERS ====================
  function fireEvents(el) {
    if (!el) return;
    ['focus', 'input', 'change', 'blur'].forEach((evtName) => {
      try {
        el.dispatchEvent(new Event(evtName, { bubbles: true }));
      } catch (e) {}
    });
  }

  function setInputValue(el, val) {
    if (!el || val === undefined || val === null) return false;
    if (el.disabled || el.readOnly) return false;
    el.value = String(val);
    fireEvents(el);
    el.style.backgroundColor = '#fef9c3';
    el.style.transition = 'background-color 0.3s';
    return true;
  }

  function setSelectByTextOrVal(selectEl, targetText) {
    if (!selectEl || selectEl.tagName !== 'SELECT') return false;
    const t = String(targetText || '').trim().toLowerCase();
    const opts = Array.from(selectEl.options || []);
    let matched = opts.find((o) => o.value.toLowerCase() === t || o.text.trim().toLowerCase() === t);
    if (!matched && t !== '') {
      matched = opts.find((o) => o.text.trim().toLowerCase().includes(t) || o.value.toLowerCase().includes(t));
    }
    if (!matched && t === '') {
      matched = opts.find((o) => o.value === '' || o.text.includes('เลือก'));
    }
    if (matched) {
      selectEl.value = matched.value;
      fireEvents(selectEl);
      selectEl.style.backgroundColor = '#fef9c3';
      return true;
    }
    return false;
  }

  // ค้นหา Input / Select จากข้อความ Label ในตาราง (<tr> / <td>)
  function findInputsAfterLabel(doc, labelText) {
    const tds = Array.from(doc.querySelectorAll('td, th, span, div'));
    const cleanTarget = labelText.replace(/\s+/g, '').toLowerCase();

    for (let i = 0; i < tds.length; i++) {
      const td = tds[i];
      if (td.children.length > 3) continue; // ข้าม container ใหญ่
      const txt = (td.innerText || td.textContent || '').replace(/\s+/g, '').toLowerCase();
      if (txt.includes(cleanTarget)) {
        // 1. หาใน td ถัดไปในแถวเดียวกัน
        let next = td.nextElementSibling;
        const found = [];
        while (next) {
          const inputs = next.querySelectorAll('input:not([type="hidden"]), select, textarea');
          if (inputs.length > 0) {
            inputs.forEach((inp) => found.push(inp));
            return found;
          }
          next = next.nextElementSibling;
        }
        // 2. หาใน td เดียวกัน
        const selfInputs = td.querySelectorAll('input:not([type="hidden"]), select, textarea');
        if (selfInputs.length > 0) return Array.from(selfInputs);
      }
    }
    return [];
  }

  function findButtonByText(doc, btnText) {
    const cleanTarget = btnText.replace(/\s+/g, '').toLowerCase();
    const btns = Array.from(doc.querySelectorAll('input[type="button"], input[type="submit"], button, a'));
    return btns.find((b) => {
      const val = (b.value || b.innerText || b.textContent || '').replace(/\s+/g, '').toLowerCase();
      return val === cleanTarget || val.includes(cleanTarget);
    });
  }

  // ดึงเลขรหัสจัดซื้อ / เลขที่ใบสั่งซื้อ / เลขที่ใบตรวจรับ ที่ระบบ MIS รันให้อัตโนมัติหลังกดบันทึก
  function tryCaptureGeneratedCodes() {
    let changed = false;
    getTargetDocs().forEach((doc) => {
      // 1. รหัสจัดซื้อ: [1] - [8] - [70]
      const purInputs = findInputsAfterLabel(doc, 'รหัสจัดซื้อ');
      if (purInputs.length >= 2) {
        const midVal = (purInputs[1].value || '').trim();
        if (midVal && /^\d+$/.test(midVal) && state.purHireNo !== midVal) {
          state.purHireNo = midVal;
          changed = true;
        }
      }
      // 2. เลขที่ใบสั่งซื้อ/สัญญา: [11] - [8] - [70]
      const poInputs = findInputsAfterLabel(doc, 'เลขที่ใบสั่งซื้อ/สัญญา');
      if (poInputs.length >= 2) {
        const midVal = (poInputs[1].value || '').trim();
        if (midVal && /^\d+$/.test(midVal) && state.poNo !== midVal) {
          state.poNo = midVal;
          changed = true;
        }
      }
      // 3. เลขที่ใบตรวจรับ: [8] - [70]
      const rcvInputs = findInputsAfterLabel(doc, 'เลขที่ใบตรวจรับ');
      if (rcvInputs.length >= 1) {
        const firstInput = rcvInputs[0].tagName === 'SELECT' ? rcvInputs[1] : rcvInputs[0];
        const rcvVal = firstInput ? (firstInput.value || '').trim() : '';
        if (rcvVal && /^\d+$/.test(rcvVal) && state.rcvNo !== rcvVal) {
          state.rcvNo = rcvVal;
          changed = true;
        }
      }
    });
    if (changed) {
      saveState();
      syncCodesToPanel();
    }
  }

  // ==================== AUTO-FILL LOGIC FOR ALL 6 STEPS ====================

  function getSelectedItem() {
    return state.items.find((x) => x.code === state.selectedCode) || null;
  }

  // ขั้นตอนที่ 1: หน้าบันทึกข้อมูลเห็นชอบจัดซื้อ (_agree.jsp)
  function fillStep1Agree(item, subAction) {
    let count = 0;
    getTargetDocs().forEach((doc) => {
      // ส่วนที่ 1.1: ข้อมูลหัวเรื่อง
      const subjInputs = findInputsAfterLabel(doc, 'เรื่องการจัดซื้อ');
      if (subjInputs[0] && setInputValue(subjInputs[0], item.subject)) count++;

      const bookInputs = findInputsAfterLabel(doc, 'เลขที่หนังสือ');
      if (bookInputs[0] && setInputValue(bookInputs[0], '-')) count++;

      const docDateInputs = findInputsAfterLabel(doc, 'เอกสารลงวันที่');
      if (docDateInputs[0] && setInputValue(docDateInputs[0], item.agreeDate)) count++;

      const agreeDateInputs = findInputsAfterLabel(doc, 'วันที่เห็นชอบ');
      if (agreeDateInputs[0] && setInputValue(agreeDateInputs[0], item.agreeDate)) count++;

      const methodSelects = findInputsAfterLabel(doc, 'วิธีการจัดซื้อ');
      if (methodSelects[0] && setSelectByTextOrVal(methodSelects[0], 'วิธีเฉพาะเจาะจง')) count++;

      const delivInputs = findInputsAfterLabel(doc, 'ระยะเวลาส่งมอบ');
      const textDeliv = delivInputs.filter((el) => el.type === 'text' || !el.type);
      if (textDeliv.length >= 3) {
        if (setInputValue(textDeliv[2], item.deliveryDays || '5')) count++;
      } else if (textDeliv.length > 0) {
        if (setInputValue(textDeliv[textDeliv.length - 1], item.deliveryDays || '5')) count++;
      }

      // ส่วนที่ 1.2: ข้อมูลงบประมาณ (ถ้าเปิดส่วนด้านล่างแล้ว)
      const deptInputs = findInputsAfterLabel(doc, 'รหัสหน่วยงาน');
      if (deptInputs[0] && !deptInputs[0].value) {
        setInputValue(deptInputs[0], '07070000');
      }

      // ตารางงบประมาณ & ตารางรายการพัสดุ: ค้นหาแถวที่มีข้อมูลแล้วติ๊กถูก + กรอกจำนวนเงิน
      const tables = Array.from(doc.querySelectorAll('table'));
      tables.forEach((tbl) => {
        const tblText = tbl.innerText || '';
        // ตารางงบประมาณ
        if (tblText.includes('จำนวนเงินที่จะใช้') || tblText.includes('จำนวนเงินคงเหลือ')) {
          const rows = Array.from(tbl.querySelectorAll('tr'));
          rows.forEach((tr) => {
            const cb = tr.querySelector('input[type="checkbox"]');
            const textInputs = Array.from(tr.querySelectorAll('input[type="text"]:not([readonly]):not([disabled])'));
            const allInputs = Array.from(tr.querySelectorAll('input[type="text"]'));
            // ตรวจว่าแถวนี้มีข้อมูลดึงมาแล้ว (เช่น มีรหัส 0620076 หรือ 07070000 หรือปี 70)
            const hasBudgetRowData = allInputs.some((inp) => /0620076|07070000|00002|70/.test(inp.value));
            if (hasBudgetRowData && textInputs.length > 0) {
              if (cb && !cb.checked) {
                cb.checked = true;
                fireEvents(cb);
              }
              // กรณีงบเอดส์ ช่อง "รายการ*" จะให้กรอกชื่อเรื่องด้วย
              if (item.isAidsBudget && textInputs.length >= 2) {
                setInputValue(textInputs[textInputs.length - 2], item.subject);
              }
              // ช่องขวาสุดคือ จำนวนเงินที่จะใช้* (บาท)
              const amtInput = textInputs[textInputs.length - 1];
              if (setInputValue(amtInput, item.amountFormatted)) count++;
            }
          });
        }

        // ตารางรายการพัสดุ (11 - 09020600 เวชภัณฑ์)
        if (tblText.includes('ราคาต่อหน่วย') && tblText.includes('ที่เห็นชอบ')) {
          const rows = Array.from(tbl.querySelectorAll('tr'));
          rows.forEach((tr) => {
            const allInputs = Array.from(tr.querySelectorAll('input[type="text"]'));
            const isMedRow = allInputs.some((inp) => /09020600|เวชภัณฑ์/.test(inp.value));
            if (isMedRow) {
              const cb = tr.querySelector('input[type="checkbox"]');
              if (cb && !cb.checked) {
                cb.checked = true;
                fireEvents(cb);
              }
              const editableInputs = allInputs.filter((inp) => !inp.readOnly && !inp.disabled && !/09020600/.test(inp.value));
              if (editableInputs.length >= 2) {
                setInputValue(editableInputs[0], item.amountFormatted); // ราคาต่อหน่วยที่เห็นชอบ
                setInputValue(editableInputs[1], '1'); // จำนวน
                count += 2;
              }
            }
          });
        }
      });

      if (subAction === 'ADD_DEPT') {
        const addDeptBtn = findButtonByText(doc, 'เพิ่มหน่วยงาน');
        if (addDeptBtn) addDeptBtn.click();
      }
    });
    return count;
  }

  // Popup 1.2: สอบถามรายการงบประมาณ กทม. (_searchbudget_bma.jsp)
  function fillPopupBudgetBma() {
    let count = 0;
    getTargetDocs().forEach((doc) => {
      const yrInputs = findInputsAfterLabel(doc, 'ปีงบประมาณ');
      if (yrInputs[0]) setInputValue(yrInputs[0], state.fiscalYear || '70');

      const srcSelects = findInputsAfterLabel(doc, 'แหล่งเงิน');
      if (srcSelects[0]) setSelectByTextOrVal(srcSelects[0], 'งบกทม.');

      const projInputs = findInputsAfterLabel(doc, 'งาน/โครงการ');
      if (projInputs[0] && setInputValue(projInputs[0], '0620076')) count++;

      const expSelects = findInputsAfterLabel(doc, 'หมวดรายจ่าย');
      if (expSelects[0] && setSelectByTextOrVal(expSelects[0], '03')) count++;

      const subExpSelects = findInputsAfterLabel(doc, 'รายจ่ายย่อย');
      if (subExpSelects[0] && setSelectByTextOrVal(subExpSelects[0], '6-27')) count++;

      // ถ้าตารางด้านล่างแสดงรายการงบประมาณแล้ว ให้ติ๊กถูกแถวที่ 1 (0620076 / ค่ายาและเวชภัณฑ์)
      const rows = Array.from(doc.querySelectorAll('tr'));
      rows.forEach((tr) => {
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        if (inputs.some((inp) => /0620076|ค่ายาและเวชภัณฑ์/.test(inp.value))) {
          const cb = tr.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.checked = true;
            fireEvents(cb);
            count++;
          }
        }
      });
    });
    return count;
  }

  // Popup 1.2 (งบเอดส์): สอบถามรายการงบประมาณนอกงบ (_searchbudget_etc.jsp)
  function fillPopupBudgetEtc() {
    let count = 0;
    getTargetDocs().forEach((doc) => {
      const typeSelects = findInputsAfterLabel(doc, 'ประเภทเงินนอกงบประมาณ');
      if (typeSelects[0] && setSelectByTextOrVal(typeSelects[0], '07')) count++;

      const deptInputs = findInputsAfterLabel(doc, 'หน่วยงานรับฝาก');
      if (deptInputs[0] && setInputValue(deptInputs[0], '07070000')) count++;

      // ถ้ามีแถวสมุดเงินเอดส์ (00002) ให้ติ๊กเลือก
      const rows = Array.from(doc.querySelectorAll('tr'));
      rows.forEach((tr) => {
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        if (inputs.some((inp) => /00002|เอดส์/.test(inp.value))) {
          const cb = tr.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.checked = true;
            fireEvents(cb);
            count++;
          }
        }
      });
    });
    return count;
  }

  // Popup 1.3: สอบถามรายการพัสดุ (Frm_pur_searchitem.jsp)
  function fillPopupSearchItem() {
    let count = 0;
    getTargetDocs().forEach((doc) => {
      const typeSelects = findInputsAfterLabel(doc, 'ประเภทรายการ');
      if (typeSelects[0] && setSelectByTextOrVal(typeSelects[0], '11')) count++;

      const catSelects = findInputsAfterLabel(doc, 'หมวด');
      if (catSelects[0] && setSelectByTextOrVal(catSelects[0], '09')) count++;

      const mainSelects = findInputsAfterLabel(doc, 'ประเภทหลัก');
      if (mainSelects[0] && setSelectByTextOrVal(mainSelects[0], '02')) count++;

      const subSelects = findInputsAfterLabel(doc, 'ประเภทรอง');
      if (subSelects[0] && setSelectByTextOrVal(subSelects[0], '06')) count++;

      // ถ้าตารางด้านล่างมีรหัส 09020600 (เวชภัณฑ์) ให้ติ๊กถูกทันที
      const rows = Array.from(doc.querySelectorAll('tr'));
      rows.forEach((tr) => {
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        if (inputs.some((inp) => inp.value.trim() === '09020600')) {
          const cb = tr.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.checked = true;
            fireEvents(cb);
            count++;
          }
        }
      });
    });
    return count;
  }

  // ขั้นตอนที่ 2: เสนอราคา/คัดเลือก (Frm_pur_bidder.jsp)
  function fillStep2Bidder(item) {
    let count = 0;
    const purNo = state.purHireNo || item.purHireNo || '';
    getTargetDocs().forEach((doc) => {
      const purInputs = findInputsAfterLabel(doc, 'รหัสจัดซื้อ');
      const textInputs = purInputs.filter((el) => el.type === 'text' || !el.type);
      if (textInputs.length >= 2 && purNo) {
        if (setInputValue(textInputs[1], purNo)) count++;
        if (textInputs[2]) setInputValue(textInputs[2], state.fiscalYear || '70');
      }

      // ถ้าเลือกผู้ประกอบการมาแล้ว ให้ติ๊กถูกหน้าแถวผู้ประกอบการ
      const rows = Array.from(doc.querySelectorAll('tr'));
      rows.forEach((tr) => {
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        if (inputs.some((inp) => inp.value && inp.value.trim().length > 3 && /บริษัท|ห้าง|องค์การ/.test(inp.value))) {
          const cbs = Array.from(tr.querySelectorAll('input[type="checkbox"]'));
          cbs.forEach((cb) => {
            if (!cb.checked) {
              cb.checked = true;
              fireEvents(cb);
              count++;
            }
          });
        }
      });
    });
    return count;
  }

  // Popup 2.1: ค้นหาผู้ประกอบการ (Frm_pur_searchVendor.jsp)
  function fillPopupSearchVendor(item) {
    let count = 0;
    getTargetDocs().forEach((doc) => {
      if (item.vendorTaxId) {
        const taxInputs = findInputsAfterLabel(doc, 'เลขประจำตัวผู้เสียภาษี');
        if (taxInputs[0] && setInputValue(taxInputs[0], item.vendorTaxId)) count++;
      } else if (item.vendorName) {
        const shortName = item.vendorName
          .replace(/บริษัท|ห้างหุ้นส่วนจำกัด|จำกัด|\(มหาชน\)|\(ประเทศไทย\)/g, '')
          .trim()
          .split(/\s+/)[0];
        const nameInputs = findInputsAfterLabel(doc, 'ชื่อผู้ประกอบการ');
        if (nameInputs[0] && setInputValue(nameInputs[0], '%' + shortName + '%')) count++;
      }

      // ถ้ามีผลการค้นหาแล้ว ให้ติ๊กแถวแรกที่มีเลขประจำตัวผู้เสียภาษีตรงกัน
      const rows = Array.from(doc.querySelectorAll('tr'));
      for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        const hasTax = inputs.some((inp) => item.vendorTaxId && inp.value.trim() === item.vendorTaxId);
        if (hasTax) {
          const cb = tr.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.checked = true;
            fireEvents(cb);
            count++;
            break;
          }
        }
      }
    });
    return count;
  }

  // Popup 2.2: รายละเอียดรายการที่เสนอ (Frm_pur_bidderdesc.jsp)
  function fillPopupBidderDesc(item) {
    let count = 0;
    getTargetDocs().forEach((doc) => {
      // ติ๊กถูก "ได้รับการคัดเลือก"
      const allCbs = Array.from(doc.querySelectorAll('input[type="checkbox"]'));
      allCbs.forEach((cb) => {
        const parentText = (cb.parentElement ? cb.parentElement.innerText : '') +
          (cb.nextSibling ? cb.nextSibling.textContent || '' : '');
        if (parentText.includes('ได้รับการคัดเลือก') && !cb.checked) {
          cb.checked = true;
          fireEvents(cb);
          count++;
        }
      });

      // ในตารางรายการซื้อ แถว 11 - 09020600 เวชภัณฑ์
      const rows = Array.from(doc.querySelectorAll('tr'));
      rows.forEach((tr) => {
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        const isMedRow = inputs.some((inp) => /09020600|เวชภัณฑ์/.test(inp.value));
        if (isMedRow) {
          const cb = tr.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.checked = true;
            fireEvents(cb);
          }
          const editable = inputs.filter((inp) => !inp.readOnly && !inp.disabled);
          // ยี่ห้อ*, รุ่น*, ราคาต่อหน่วยที่จัดซื้อ*, จำนวน*
          if (editable.length >= 2) {
            setInputValue(editable[0], '-'); // ยี่ห้อ
            setInputValue(editable[1], '-'); // รุ่น
            count += 2;
          }
          if (editable.length >= 4) {
            setInputValue(editable[2], item.amountFormatted); // ราคาต่อหน่วย
            setInputValue(editable[3], '1.00'); // จำนวน
            count += 2;
          }
        }
      });
    });
    return count;
  }

  // ขั้นตอนที่ 3: บันทึกข้อมูลอนุมัติจัดซื้อ (_accept.jsp)
  function fillStep3Approve(item) {
    let count = 0;
    const purNo = state.purHireNo || item.purHireNo || '';
    getTargetDocs().forEach((doc) => {
      const purInputs = findInputsAfterLabel(doc, 'รหัสจัดซื้อ');
      const textPur = purInputs.filter((el) => el.type === 'text' || !el.type);
      if (textPur.length >= 2 && purNo && !textPur[1].readOnly) {
        setInputValue(textPur[1], purNo);
      }

      const bookInputs = findInputsAfterLabel(doc, 'เลขที่หนังสือ');
      if (bookInputs[0] && setInputValue(bookInputs[0], '-')) count++;

      const docDateInputs = findInputsAfterLabel(doc, 'เอกสารลงวันที่');
      if (docDateInputs[0] && setInputValue(docDateInputs[0], item.quoteDate)) count++;

      const appDateInputs = findInputsAfterLabel(doc, 'วันที่อนุมัติ');
      if (appDateInputs[0] && setInputValue(appDateInputs[0], item.quoteDate)) count++;

      const delivInputs = findInputsAfterLabel(doc, 'ระยะเวลาส่งมอบ');
      const textDeliv = delivInputs.filter((el) => el.type === 'text' || !el.type);
      if (textDeliv.length >= 3) {
        if (setInputValue(textDeliv[2], item.deliveryDays || '5')) count++;
      }

      const deptContractInputs = findInputsAfterLabel(doc, 'หน่วยงานทำสัญญา');
      if (deptContractInputs[0] && !deptContractInputs[0].value) {
        setInputValue(deptContractInputs[0], '07070000');
      }
    });
    return count;
  }

  // ขั้นตอนที่ 4: บันทึกข้อมูลใบสั่งซื้อ/สัญญาแบบงวดงาน (_orderterm.jsp)
  function fillStep4Contract(item) {
    let count = 0;
    const purNo = state.purHireNo || item.purHireNo || '';
    getTargetDocs().forEach((doc) => {
      const docTypeSelects = findInputsAfterLabel(doc, 'ประเภทเอกสาร');
      if (docTypeSelects[0]) setSelectByTextOrVal(docTypeSelects[0], '11');

      const deptInputs = findInputsAfterLabel(doc, 'หน่วยงานดำเนินการ');
      if (deptInputs[0] && setInputValue(deptInputs[0], '07070000')) count++;

      const purInputs = findInputsAfterLabel(doc, 'รหัสจัดซื้อ');
      const textPur = purInputs.filter((el) => el.type === 'text' || !el.type);
      if (textPur.length >= 2 && purNo) {
        if (setInputValue(textPur[1], purNo)) count++;
        if (textPur[2]) setInputValue(textPur[2], state.fiscalYear || '70');
      }

      const signDateInputs = findInputsAfterLabel(doc, 'วันที่สั่งซื้อ/ลงนามสัญญา');
      if (signDateInputs[0] && setInputValue(signDateInputs[0], item.poSignDate)) count++;

      const startDateInputs = findInputsAfterLabel(doc, 'วันที่เริ่มสัญญา');
      if (startDateInputs[0] && setInputValue(startDateInputs[0], item.rcvDate || item.contractStartDate)) count++;

      const endDateInputs = findInputsAfterLabel(doc, 'วันที่สิ้นสุดสัญญา');
      if (endDateInputs[0] && setInputValue(endDateInputs[0], item.contractEndDate)) count++;

      const durInputs = findInputsAfterLabel(doc, 'ระยะเวลาดำเนินการ');
      const textDur = durInputs.filter((el) => el.type === 'text' || !el.type);
      if (textDur.length >= 3) {
        if (setInputValue(textDur[2], item.deliveryDays || '5')) count++;
      }

      const fineInputs = findInputsAfterLabel(doc, 'เงื่อนไขการปรับ');
      if (fineInputs[0] && setInputValue(fineInputs[0], '0.2 % ของราคาสินค้าที่ยังไม่ได้รับมอบ')) count++;

      const rcvDeptInputs = findInputsAfterLabel(doc, 'หน่วยงานตรวจรับ');
      if (rcvDeptInputs[0] && setInputValue(rcvDeptInputs[0], '07070000')) count++;

      const termCountInputs = findInputsAfterLabel(doc, 'จำนวนงวดทั้งหมด');
      if (termCountInputs[0] && setInputValue(termCountInputs[0], '1')) count++;
    });
    return count;
  }

  // Popup 4.2: เลือกรายการพัสดุในหน้าสัญญา (Frm_pur_selectorder.jsp)
  function fillPopupSelectOrder() {
    let count = 0;
    getTargetDocs().forEach((doc) => {
      const rows = Array.from(doc.querySelectorAll('tr'));
      rows.forEach((tr) => {
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        if (inputs.some((inp) => /09020600|เวชภัณฑ์/.test(inp.value))) {
          const cb = tr.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.checked = true;
            fireEvents(cb);
            count++;
          }
        }
      });
    });
    return count;
  }

  // ขั้นตอนที่ 5.1: บันทึกข้อมูลการส่งมอบ แบบงวดงาน (Frm_pur_prereceiveterm.jsp)
  function fillStep5Delivery(item) {
    let count = 0;
    const poNo = state.poNo || item.poNo || state.purHireNo || item.purHireNo || '';
    getTargetDocs().forEach((doc) => {
      const deptInputs = findInputsAfterLabel(doc, 'หน่วยงานทำสัญญา');
      if (deptInputs[0] && setInputValue(deptInputs[0], '07070000')) count++;

      const poInputs = findInputsAfterLabel(doc, 'เลขที่ใบสั่งซื้อ/สัญญา');
      if (poInputs.length >= 2) {
        if (poInputs[0].tagName === 'SELECT') {
          setSelectByTextOrVal(poInputs[0], '11');
          if (poNo && setInputValue(poInputs[1], poNo)) count++;
          if (poInputs[2]) setInputValue(poInputs[2], state.fiscalYear || '70');
        } else {
          if (poNo && setInputValue(poInputs[1], poNo)) count++;
        }
      }

      const invInputs = findInputsAfterLabel(doc, 'เลขที่เอกสารส่งมอบ');
      if (invInputs[0] && state.invoiceNo) {
        if (setInputValue(invInputs[0], state.invoiceNo)) count++;
      }

      const docDateInputs = findInputsAfterLabel(doc, 'เอกสารลงวันที่');
      if (docDateInputs[0] && setInputValue(docDateInputs[0], item.rcvDate)) count++;

      const termInputs = findInputsAfterLabel(doc, 'งวดในใบสั่งซื้อ/สัญญา');
      if (termInputs[0] && setInputValue(termInputs[0], '1')) count++;
    });
    return count;
  }

  // ขั้นตอนที่ 6: รายงานผลตรวจรับ -> 1. บันทึกข้อมูลรายงานผลการตรวจรับจัดซื้อ แบบงวดงาน
  function fillStep6RcvResult(item) {
    let count = 0;
    const rcvNo = state.rcvNo || (item && item.rcvNo) || state.poNo || (item && item.poNo) || state.purHireNo || (item && item.purHireNo) || '';

    getTargetDocs().forEach((doc) => {
      // 1. หน่วยงานตรวจรับ = 07070000
      const deptInputs = findInputsAfterLabel(doc, 'หน่วยงานตรวจรับ');
      if (deptInputs[0] && setInputValue(deptInputs[0], '07070000')) count++;

      // 2. เลขที่ใบตรวจรับ* = [rcvNo] - [70]
      const rcvInputs = findInputsAfterLabel(doc, 'เลขที่ใบตรวจรับ');
      const textRcv = rcvInputs.filter((el) => el.type === 'text' || !el.type);
      if (textRcv.length >= 1 && rcvNo) {
        if (setInputValue(textRcv[0], rcvNo)) count++;
        if (textRcv[1]) setInputValue(textRcv[1], state.fiscalYear || '70');
      }

      // 3. เอกสารการตรวจรับ: วันที่ส่งมอบ*, ใบตรวจรับลงวันที่*, วันที่ตรวจรับมีผล*
      if (item && item.rcvDate) {
        const sendDateInputs = findInputsAfterLabel(doc, 'วันที่ส่งมอบ');
        if (sendDateInputs[0] && !sendDateInputs[0].value && setInputValue(sendDateInputs[0], item.rcvDate)) count++;

        const rcvDocDateInputs = findInputsAfterLabel(doc, 'ใบตรวจรับลงวันที่');
        if (rcvDocDateInputs[0] && setInputValue(rcvDocDateInputs[0], item.rcvDate)) count++;

        const effDateInputs = findInputsAfterLabel(doc, 'วันที่ตรวจรับมีผล');
        if (effDateInputs[0] && setInputValue(effDateInputs[0], item.rcvDate)) count++;
      }

      // 4. รายการตรวจรับ: งวดที่* = 1, ติ๊กถูก "การตรวจรับครั้งสุดท้ายของงวด", และกรอกจำนวน "ตรวจรับ*" = 1.00
      const tables = Array.from(doc.querySelectorAll('table'));
      tables.forEach((tbl) => {
        const txt = tbl.innerText || '';
        // ตารางงวดงาน (งวดที่* | วันที่สิ้นสุดงวด/สัญญา | ... | การตรวจรับครั้งสุดท้ายของงวด)
        if (txt.includes('การตรวจรับครั้งสุดท้าย')) {
          const sel = tbl.querySelector('select');
          if (sel && setSelectByTextOrVal(sel, '1')) count++;
          const cb = tbl.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.checked = true;
            fireEvents(cb);
            count++;
          }
        }

        // ตารางรายการพัสดุตรวจรับ (รหัสพัสดุ | รายการ | ... | คงเหลือ | แจ้งส่ง | ตรวจรับ*)
        if (txt.includes('แจ้งส่ง') && txt.includes('ตรวจรับ')) {
          const rows = Array.from(tbl.querySelectorAll('tr'));
          rows.forEach((tr) => {
            const allInputs = Array.from(tr.querySelectorAll('input[type="text"]'));
            const isMedRow = allInputs.some((inp) => /09020600|เวชภัณฑ์/.test(inp.value));
            if (isMedRow) {
              const editable = allInputs.filter((inp) => !inp.readOnly && !inp.disabled);
              editable.forEach((inp) => {
                if (!inp.value || inp.value === '0' || inp.value === '0.00') {
                  if (setInputValue(inp, '1.00')) count++;
                }
              });
            }
          });
        }
      });
    });
    return count;
  }

  // ขั้นตอนที่ 7: ข้อมูลอื่นๆ -> 12. บันทึกข้อมูลคณะกรรมการตรวจรับ จัดซื้อ (Frm_pur_hire_rcv_committee.jsp)
  function fillStep7Committee(item) {
    let count = 0;
    const amount = item ? Number(item.amount || 0) : 0;
    const isOver100k = amount >= 100000;
    const chosenSet = COMMITTEE_SETS[state.committeeSet] || COMMITTEE_SETS['1'];
    const members = isOver100k ? chosenSet.over100k : chosenSet.under100k;
    const poNo = state.poNo || (item && item.poNo) || state.purHireNo || (item && item.purHireNo) || '';

    getTargetDocs().forEach((doc) => {
      // 1. เลือกประเภทเอกสาร = 11 ใบสั่งซื้อ
      const docTypeSelects = findInputsAfterLabel(doc, 'ประเภทเอกสาร');
      if (docTypeSelects[0] && setSelectByTextOrVal(docTypeSelects[0], '11')) {
        count++;
      }

      // 2. กรอกเลขที่ใบสั่งซื้อ/สัญญา: [11] - [poNo] - [70]
      const poInputs = findInputsAfterLabel(doc, 'เลขที่ใบสั่งซื้อ/สัญญา');
      const textPo = poInputs.filter((el) => el.type === 'text' || !el.type);
      if (textPo.length >= 2) {
        if (!textPo[0].value || textPo[0].value === 'undefined') setInputValue(textPo[0], '11');
        if (poNo && setInputValue(textPo[1], poNo)) count++;
        if (textPo[2]) setInputValue(textPo[2], state.fiscalYear || '70');
      }

      // 3. ล้างคำว่า "undefined" ที่ระบบ MIS สร้างขึ้นในทุกช่อง input ของตารางก่อน
      Array.from(doc.querySelectorAll('input[type="text"]')).forEach((inp) => {
        if (inp.value && inp.value.trim().toLowerCase() === 'undefined') {
          inp.value = '';
        }
      });

      // 4. ค้นหาตารางรายชื่อคณะกรรมการตรวจรับแล้วกรอกตามเกณฑ์วงเงิน (>= 100,000 กรอก 4 แถว / < 100,000 กรอก 2 แถว)
      const tables = Array.from(doc.querySelectorAll('table'));
      tables.forEach((tbl) => {
        const txt = tbl.innerText || '';
        if (txt.includes('ชื่อคณะกรรมการ') && txt.includes('ตำแหน่ง')) {
          const rows = Array.from(tbl.querySelectorAll('tr')).filter((tr) => {
            return tr.querySelectorAll('input[type="text"]').length >= 2 && tr.querySelector('select');
          });

          rows.forEach((tr, idx) => {
            const textInputs = Array.from(tr.querySelectorAll('input[type="text"]'));
            const selectEl = tr.querySelector('select');
            const cb = tr.querySelector('input[type="checkbox"]');

            if (idx < members.length) {
              const m = members[idx];
              setInputValue(textInputs[0], m.name);
              setInputValue(textInputs[1], m.position);
              if (m.role) {
                setSelectByTextOrVal(selectEl, m.role);
              } else {
                // กรณี < 100,000 แถวที่ 1 เลือก -----เลือก----- (เว้นว่าง)
                setSelectByTextOrVal(selectEl, '');
              }
              if (cb && !cb.checked) {
                cb.checked = true;
                fireEvents(cb);
              }
              count++;
            } else {
              // ล้างแถวที่เหลือให้ว่างสะอาด (ไม่มีคำว่า undefined)
              textInputs[0].value = '';
              textInputs[1].value = '';
              setSelectByTextOrVal(selectEl, '');
              if (cb && cb.checked) {
                cb.checked = false;
                fireEvents(cb);
              }
            }
          });
        }
      });
    });
    return count;
  }

  // ขั้นตอนที่ 8: รายงาน -> 13. ใบตรวจรับพัสดุ (Rep_pur_rcv.jsp)
  function fillStep8ReportRcv(item) {
    let count = 0;
    const rcvNo = state.rcvNo || (item && item.rcvNo) || state.poNo || (item && item.poNo) || '';
    getTargetDocs().forEach((doc) => {
      const deptInputs = findInputsAfterLabel(doc, 'หน่วยงานตรวจรับ');
      if (deptInputs[0] && setInputValue(deptInputs[0], '07070000')) count++;

      const rcvInputs = findInputsAfterLabel(doc, 'เลขที่ใบตรวจรับ');
      if (rcvInputs.length >= 2) {
        if (rcvInputs[0].tagName === 'SELECT') {
          setSelectByTextOrVal(rcvInputs[0], 'จัดซื้อ');
          if (rcvNo && setInputValue(rcvInputs[1], rcvNo)) count++;
          if (rcvInputs[2]) setInputValue(rcvInputs[2], state.fiscalYear || '70');
        } else {
          if (rcvNo && setInputValue(rcvInputs[0], rcvNo)) count++;
          if (rcvInputs[1]) setInputValue(rcvInputs[1], state.fiscalYear || '70');
        }
      }

      const cmdInputs = findInputsAfterLabel(doc, 'ตามคำสั่ง');
      if (cmdInputs[0] && setInputValue(cmdInputs[0], 'อนุมัติ ผว.กทม.')) count++;

      const locInputs = findInputsAfterLabel(doc, 'สถานที่ตรวจรับ');
      if (locInputs[0] && setInputValue(locInputs[0], 'โรงพยาบาลเจริญกรุงประชารักษ์')) count++;

      const clauseInputs = findInputsAfterLabel(doc, 'ผู้ขายได้ส่งมอบตามสัญญา');
      if (clauseInputs[0] && setInputValue(clauseInputs[0], '1')) count++;

      const handOverInputs = findInputsAfterLabel(doc, 'คณะกรรมการได้ส่งมอบพัสดุให้แก่');
      if (handOverInputs[0] && setInputValue(handOverInputs[0], 'นางสาวนัทธมน คำประดิษฐ์')) count++;

      const affInputs = findInputsAfterLabel(doc, 'สังกัดของเจ้าหน้าที่พัสดุ');
      if (affInputs[0] && setInputValue(affInputs[0], 'กลุ่มงานเภสัชกรรม รพ.เจริญกรุงประชารักษ์ สำนักการแพทย์')) count++;
    });
    return count;
  }

  function isItemAlreadyRecorded(item) {
    if (!item) return false;
    const p = String(item.purHireNo || '').trim();
    const o = String(item.poNo || '').trim();
    const r = String(item.rcvNo || '').trim();
    return p !== '' && o !== '' && r !== '';
  }

  function isStepAllowedWhenRecorded(pageId) {
    return pageId === 'STEP7_COMMITTEE' || pageId === 'STEP8_REP_RCV';
  }

  function autoFillCurrentPage(subAction) {
    tryCaptureGeneratedCodes();
    const page = detectCurrentPage();
    const item = getSelectedItem();

    if (item && isItemAlreadyRecorded(item) && !isStepAllowedWhenRecorded(page.id)) {
      setStatus('⛔ มีประวัติการลงข้อมูลแล้ว (อนุญาตเฉพาะขั้นตอนที่ 7 และ 8 เท่านั้น)', 'err');
      alert(
        'มีประวัติการลงข้อมูลแล้ว\n\nรายการ [' +
          item.code +
          '] ' +
          item.subject +
          '\nมีข้อมูลใน MISS70 ครบแล้ว:\n- รหัสจัดซื้อ: ' +
          item.purHireNo +
          '\n- เลขที่ใบสั่งซื้อ: ' +
          item.poNo +
          '\n- เลขที่ใบตรวจรับ: ' +
          item.rcvNo +
          '\n\nห้ามลงข้อมูลซ้ำในขั้นตอนที่ 1–6 (สามารถกดกรอกขั้นตอนที่ 7 คณะกรรมการ และขั้นตอนที่ 8 พิมพ์ใบตรวจรับได้ตามปกติ)'
      );
      return;
    }

    // หน้า Popup บางหน้าไม่จำเป็นต้องเลือกรายการก่อนก็กรอกได้
    const noItemNeeded = ['POPUP_BUDGET_BMA', 'POPUP_BUDGET_ETC', 'POPUP_SEARCH_ITEM', 'POPUP_SELECT_ORDER'];
    if (!item && !noItemNeeded.includes(page.id) && page.id !== 'STEP8_REP_RCV' && page.id !== 'STEP7_COMMITTEE') {
      setStatus('กรุณาเลือกรายการยาจาก Google Sheet ก่อนครับ', 'err');
      return;
    }

    let filled = 0;
    switch (page.id) {
      case 'STEP1_AGREE':
        filled = fillStep1Agree(item, subAction);
        break;
      case 'POPUP_BUDGET_BMA':
        filled = fillPopupBudgetBma();
        break;
      case 'POPUP_BUDGET_ETC':
        filled = fillPopupBudgetEtc();
        break;
      case 'POPUP_SEARCH_ITEM':
        filled = fillPopupSearchItem();
        break;
      case 'STEP2_BIDDER':
        filled = fillStep2Bidder(item);
        break;
      case 'POPUP_SEARCH_VENDOR':
        filled = fillPopupSearchVendor(item);
        break;
      case 'POPUP_BIDDER_DESC':
        filled = fillPopupBidderDesc(item);
        break;
      case 'STEP3_APPROVE':
        filled = fillStep3Approve(item);
        break;
      case 'STEP4_CONTRACT':
        filled = fillStep4Contract(item);
        break;
      case 'POPUP_SELECT_ORDER':
        filled = fillPopupSelectOrder();
        break;
      case 'STEP5_DELIVERY':
        filled = fillStep5Delivery(item);
        break;
      case 'STEP6_RCV_RESULT':
        filled = fillStep6RcvResult(item);
        break;
      case 'STEP7_COMMITTEE':
        filled = fillStep7Committee(item);
        break;
      case 'STEP8_REP_RCV':
        filled = fillStep8ReportRcv(item);
        break;
      default:
        if (item && !isItemAlreadyRecorded(item)) {
          filled += fillStep1Agree(item, subAction);
          filled += fillStep3Approve(item);
          filled += fillStep4Contract(item);
          filled += fillStep5Delivery(item);
          filled += fillStep6RcvResult(item);
        }
        filled += fillStep7Committee(item);
        filled += fillStep8ReportRcv(item);
        break;
    }

    if (filled > 0) {
      setStatus(`✓ กรอกข้อมูลลงหน้า "${page.title}" สำเร็จ (${filled} จุด)`, 'ok');
    } else {
      setStatus(`⚠️ ไม่พบช่องที่ต้องกรอกเพิ่มเติมในหน้านี้ (${page.title})`, 'err');
    }
  }

  // ==================== STORAGE & SYNC ====================
  function saveState() {
    try {
      chrome.storage.local.set({ [STATE_KEY]: state });
    } catch (e) {}
  }

  function loadState(cb) {
    try {
      chrome.storage.local.get([STATE_KEY], (res) => {
        if (res && res[STATE_KEY]) {
          state = Object.assign(state, res[STATE_KEY]);
        }
        cb();
      });
    } catch (e) {
      cb();
    }
  }

  // ==================== FLOATING PANEL UI ====================
  let panelEl = null;

  function setStatus(msg, type) {
    if (!panelEl) return;
    const bar = panelEl.querySelector('#bma-status-bar');
    if (!bar) return;
    bar.textContent = msg;
    bar.className = 'bma-status-bar' + (type ? ' ' + type : '');
  }

  function syncCodesToPanel() {
    if (!panelEl) return;
    const pIn = panelEl.querySelector('#bma-pur-no');
    const oIn = panelEl.querySelector('#bma-po-no');
    const rIn = panelEl.querySelector('#bma-rcv-no');
    if (pIn && document.activeElement !== pIn) pIn.value = state.purHireNo || '';
    if (oIn && document.activeElement !== oIn) oIn.value = state.poNo || '';
    if (rIn && document.activeElement !== rIn) rIn.value = state.rcvNo || '';
  }

  function updateButtonsLockState(item) {
    if (!panelEl) return;
    const recorded = isItemAlreadyRecorded(item);
    const page = detectCurrentPage();
    const allowCurrentPage = !recorded || isStepAllowedWhenRecorded(page.id);
    const mainBtn = panelEl.querySelector('#bma-btn-autofill');
    const stepBtns = panelEl.querySelectorAll('.bma-step-btn');

    if (mainBtn) {
      mainBtn.disabled = !allowCurrentPage;
      mainBtn.textContent = !allowCurrentPage
        ? '⛔ มีประวัติการลงข้อมูลแล้ว (ล็อกขั้น 1-6)'
        : '⚡ กรอกข้อมูลหน้านี้ทันที (Auto-Fill)';
    }
    stepBtns.forEach((btn) => {
      const st = btn.getAttribute('data-step');
      // ขั้นตอนที่ 7 (กรรมการ) และ 8 (พิมพ์ใบตรวจรับ) กดได้เสมอแม้มีประวัติลงข้อมูลแล้ว
      if (st === '7' || st === '8') {
        btn.disabled = false;
      } else {
        btn.disabled = recorded;
      }
    });

    if (recorded) {
      setStatus('⛔ มีประวัติการลงข้อมูลแล้ว (ล็อกขั้น 1-6 • กดขั้น 7 และ 8 ได้ตามปกติ)', 'err');
    } else if (item) {
      setStatus(`✓ รายการ [${item.code}] พร้อมสำหรับลงข้อมูล`, 'ok');
    }
  }

  function renderItemOptions() {
    if (!panelEl) return;
    const sel = panelEl.querySelector('#bma-item-select');
    if (!sel) return;

    const q = (state.filterText || '').toLowerCase().trim();

    // ตรวจสอบว่าผู้ใช้กำลังค้นหาด้วยรหัส ซ. หรือไม่ (เช่น "1งบ", "2งบ", "1งบเอดส์" หรือพิมพ์แค่ตัวเลข "1", "2")
    const exactCodeMatch = state.items.filter((it) => {
      const c = String(it.code || '').toLowerCase().trim();
      const numOnly = c.replace(/[^0-9]/g, '');
      return c === q || (q !== '' && /^\d+$/.test(q) && numOnly === q);
    });

    let filtered = [];
    if (q && exactCodeMatch.length > 0) {
      // ถ้ารหัสตรงเป๊ะ (เช่น พิมพ์ "2งบ" หรือ "2") ให้แสดงเฉพาะ "2งบ" เท่านั้น ไม่เอา 12งบ, 22งบ มาปน
      filtered = exactCodeMatch;
    } else {
      filtered = state.items.filter((it) => {
        if (!q) return true;
        const c = String(it.code || '').toLowerCase().trim();
        // ถ้าระบุคำค้นที่มีคำว่า "งบ" เช่น "30งบ" ให้เทียบตรงตัวกับรหัสเท่านั้น
        if (/^\d+\s*(งบ|งบเอดส์|เอดส์|aids)$/i.test(q)) {
          return c === q.replace(/\s+/g, '');
        }
        return (
          c === q ||
          String(it.subject || '').toLowerCase().includes(q) ||
          String(it.vendorName || '').toLowerCase().includes(q) ||
          String(it.amountFormatted || '').toLowerCase().includes(q)
        );
      });
    }

    if (filtered.length === 0) {
      sel.innerHTML = '<option value="">-- ไม่พบรายการที่ค้นหา --</option>';
      renderSelectedSummary();
      updateButtonsLockState(null);
      return;
    }

    // เรียงลำดับตามเลข ซ. จากน้อยไปมาก (1งบ, 2งบ, 3งบ...)
    const sorted = filtered.slice().sort((a, b) => {
      const na = parseInt(String(a.code || '').replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(String(b.code || '').replace(/\D/g, ''), 10) || 0;
      return na - nb;
    });

    sel.innerHTML = sorted
      .map((it) => {
        const tag = it.code ? `[${it.code}] ` : '';
        const recPrefix = isItemAlreadyRecorded(it) ? '⛔ (ลงแล้ว) ' : '';
        const shortSubj = (it.subject || '').slice(0, 32);
        return `<option value="${it.code}">${recPrefix}${tag}${shortSubj} (${it.amountFormatted} ฿)</option>`;
      })
      .join('');

    // ถ้าค้นหาแล้วเจอรายการเดียว หรือรายการที่เลือกไว้ไม่อยู่ในรายการที่กรอง ให้เลือกรายการแรกทันที
    if (sorted.length === 1 || !state.selectedCode || !sorted.some((x) => x.code === state.selectedCode)) {
      state.selectedCode = sorted[0].code;
      sel.value = state.selectedCode;
      onItemSelectionChange(sorted[0]);
    } else {
      sel.value = state.selectedCode;
      renderSelectedSummary();
      updateButtonsLockState(getSelectedItem());
    }
  }

  function onItemSelectionChange(item) {
    if (!item) return;
    state.purHireNo = item.purHireNo || '';
    state.poNo = item.poNo || '';
    state.rcvNo = item.rcvNo || '';
    saveState();
    syncCodesToPanel();
    renderSelectedSummary();
    updateButtonsLockState(item);
  }

  function renderSelectedSummary() {
    if (!panelEl) return;
    const box = panelEl.querySelector('#bma-item-summary');
    if (!box) return;
    const item = getSelectedItem();
    if (!item) {
      box.innerHTML = '<div style="color:#64748b;text-align:center;">กดปุ่ม "🔄 ดึงข้อมูล Google Sheet" เพื่อโหลดรายการ</div>';
      return;
    }

    const recorded = isItemAlreadyRecorded(item);
    const dupAlertHtml = recorded
      ? `<div class="bma-dup-alert" style="margin-bottom:8px;">
           ⛔ มีประวัติการลงข้อมูลแล้ว<br/>
           <span style="font-size:11.5px;font-weight:600;">(รหัสจัดซื้อ: ${item.purHireNo} • ใบสั่งซื้อ: ${item.poNo} • ใบตรวจรับ: ${item.rcvNo})<br/>ห้ามลงข้อมูลซ้ำเด็ดขาด</span>
         </div>`
      : '';

    const isOver100k = Number(item.amount || 0) >= 100000;
    const commBadge = isOver100k
      ? '<span style="color:#1d4ed8;font-weight:700;">>= 1 แสน (กรรมการ 3 + พัสดุ 1)</span>'
      : '<span style="color:#d97706;font-weight:700;">< 1 แสน (ผู้ตรวจรับ 1 + พัสดุ 1)</span>';

    box.innerHTML = `
      ${dupAlertHtml}
      <div class="bma-summary-row">
        <span class="bma-summary-key">รหัส/เรื่อง:</span>
        <span class="bma-summary-val"><b>[${item.code}]</b> ${item.subject}</span>
      </div>
      <div class="bma-summary-row">
        <span class="bma-summary-key">ยอดเงินรวม:</span>
        <span class="bma-summary-val bma-amount-highlight">${item.amountFormatted} บาท</span>
      </div>
      <div class="bma-summary-row">
        <span class="bma-summary-key">บริษัท:</span>
        <span class="bma-summary-val">${item.vendorName || '-'} (${item.vendorTaxId || '-'})</span>
      </div>
      <div class="bma-summary-row">
        <span class="bma-summary-key">วันที่เห็นชอบ / อนุมัติ:</span>
        <span class="bma-summary-val">${item.agreeDate || '-'} / ${item.quoteDate || '-'}</span>
      </div>
      <div class="bma-summary-row">
        <span class="bma-summary-key">วันสั่งซื้อ / ตรวจรับ:</span>
        <span class="bma-summary-val">${item.poSignDate || '-'} / ${item.rcvDate || '-'}</span>
      </div>
      <div class="bma-summary-row">
        <span class="bma-summary-key">สิ้นสุดสัญญา (${item.deliveryDays} วัน):</span>
        <span class="bma-summary-val">${item.contractEndDate || '-'}</span>
      </div>
      <div class="bma-summary-row">
        <span class="bma-summary-key">เกณฑ์กรรมการ:</span>
        <span class="bma-summary-val">${commBadge}</span>
      </div>
    `;
  }

  function fetchSheetsData() {
    setStatus('⏳ กำลังซิงค์ข้อมูลจาก Google Sheets...', '');
    chrome.runtime.sendMessage(
      {
        type: 'FETCH_SHEETS_DATA',
        config: { gasWebAppUrl: state.gasWebAppUrl }
      },
      (res) => {
        if (chrome.runtime.lastError) {
          setStatus('⚠️ ไม่สามารถติดต่อ Background Script ได้ กรุณากด Reload ส่วนขยายใน opera://extensions', 'err');
          return;
        }
        if (!res || !res.ok) {
          setStatus('⚠️ ' + (res && res.error ? res.error : 'โหลดข้อมูลไม่สำเร็จ'), 'err');
          return;
        }
        if (res.remoteConfig) {
          if (res.remoteConfig.committeeSets) {
            Object.assign(COMMITTEE_SETS, res.remoteConfig.committeeSets);
          }
          if (res.remoteConfig.gasWebAppUrl) {
            state.gasWebAppUrl = res.remoteConfig.gasWebAppUrl;
          }
          state.remoteVersion = res.remoteConfig.version || '1.2.0';
        }
        state.items = res.items || [];
        saveState();
        const cntLbl = panelEl ? panelEl.querySelector('#bma-sheet-count-lbl') : null;
        if (cntLbl) cntLbl.textContent = `ค้นหาและเลือกรายการจาก Google Sheet (${state.items.length} รายการ)`;
        renderItemOptions();
        const curItem = getSelectedItem();
        if (!isItemAlreadyRecorded(curItem)) {
          const verTag = state.remoteVersion ? ` • GitHub v${state.remoteVersion}` : '';
          const srcText = res.source ? ` [${res.source}${verTag}]` : '';
          setStatus(`✓ พร้อมใช้งาน ${state.items.length} รายการ${srcText}`, 'ok');
        }
      }
    );
  }

  function buildPanel() {
    // หากเป็นเฟรมย่อยที่ขนาดเล็กมาก (เช่น banner บนสุด) ไม่ต้องแสดงแผงซ้ำ
    if (window.innerHeight < 220 || window.innerWidth < 350) return;
    if (document.getElementById('bma-mis-autofill-panel')) return;

    const page = detectCurrentPage();
    panelEl = document.createElement('div');
    panelEl.id = 'bma-mis-autofill-panel';
    if (state.minimized) panelEl.classList.add('minimized');

    panelEl.innerHTML = `
      <div class="bma-panel-header" id="bma-panel-drag">
        <div class="bma-panel-title">
          <span>💊 BMA MIS Auto-Filler</span>
        </div>
        <div class="bma-panel-header-btns">
          <button type="button" class="bma-icon-btn" id="bma-btn-reload" title="ดึงข้อมูลล่าสุดจาก Google Sheet">🔄 ซิงค์</button>
          <button type="button" class="bma-icon-btn" id="bma-btn-min" title="ย่อ/ขยายแผงควบคุม">${state.minimized ? '➕' : '➖'}</button>
        </div>
      </div>

      <div class="bma-panel-body">
        <div class="bma-page-badge">
          <span id="bma-current-page-lbl">📍 ${page.title}</span>
        </div>

        <div class="bma-field-group">
          <div class="bma-label">
            <span id="bma-sheet-count-lbl">ค้นหาและเลือกรายการจาก Google Sheet (${state.items.length} รายการ)</span>
          </div>
          <input type="text" id="bma-search-input" class="bma-input" placeholder="ค้นหารหัส เช่น 1งบ, 7งบ, ชื่อยา, บริษัท..." value="${state.filterText || ''}" />
          <select id="bma-item-select" class="bma-select"></select>
        </div>

        <div class="bma-summary-card" id="bma-item-summary"></div>

        <div class="bma-field-group">
          <div class="bma-label"><span>รหัสอ้างอิงในระบบ MIS (ดึงอัตโนมัติ / แก้ไขได้)</span></div>
          <div class="bma-grid-3">
            <div>
              <div style="font-size:10.5px;color:#64748b;">รหัสจัดซื้อ (1-X-70)</div>
              <input type="text" id="bma-pur-no" class="bma-input" placeholder="เช่น 8" value="${state.purHireNo || ''}" />
            </div>
            <div>
              <div style="font-size:10.5px;color:#64748b;">เลขใบสั่งซื้อ (11-X-70)</div>
              <input type="text" id="bma-po-no" class="bma-input" placeholder="เช่น 8" value="${state.poNo || ''}" />
            </div>
            <div>
              <div style="font-size:10.5px;color:#64748b;">เลขใบตรวจรับ (X-70)</div>
              <input type="text" id="bma-rcv-no" class="bma-input" placeholder="เช่น 8" value="${state.rcvNo || ''}" />
            </div>
          </div>
        </div>

        <div class="bma-grid-2">
          <div class="bma-field-group">
            <div class="bma-label"><span>เลขที่บิล (หน้าส่งมอบ)</span></div>
            <input type="text" id="bma-inv-no" class="bma-input" placeholder="เลขที่เอกสารส่งมอบ..." value="${state.invoiceNo || ''}" />
          </div>
          <div class="bma-field-group">
            <div class="bma-label"><span>ชุดกรรมการตรวจรับ</span></div>
            <select id="bma-committee-select" class="bma-select">
              <option value="1" ${state.committeeSet === '1' ? 'selected' : ''}>ชุดที่ 1 (เบญญาภา)</option>
              <option value="2" ${state.committeeSet === '2' ? 'selected' : ''}>ชุดที่ 2 (วีรวิชญ์)</option>
            </select>
          </div>
        </div>

        <button type="button" class="bma-btn bma-btn-primary" id="bma-btn-autofill">
          ⚡ กรอกข้อมูลหน้านี้ทันที (Auto-Fill)
        </button>

        <div class="bma-field-group">
          <div class="bma-label"><span>หรือเลือกกดกรอกเฉพาะขั้นตอน (1-8):</span></div>
          <div class="bma-step-pills">
            <button type="button" class="bma-step-btn" data-step="1">1. เห็นชอบ</button>
            <button type="button" class="bma-step-btn" data-step="2">2. เสนอราคา</button>
            <button type="button" class="bma-step-btn" data-step="3">3. อนุมัติ</button>
            <button type="button" class="bma-step-btn" data-step="4">4. สัญญา</button>
            <button type="button" class="bma-step-btn" data-step="5">5. ส่งมอบ</button>
            <button type="button" class="bma-step-btn" data-step="6">6. รายงานผลตรวจรับ</button>
            <button type="button" class="bma-step-btn" data-step="7">7. กรรมการ (ข้อ12)</button>
            <button type="button" class="bma-step-btn" data-step="8" style="grid-column: span 2;">8. พิมพ์ใบตรวจรับ (ข้อ13)</button>
          </div>
        </div>

        <div id="bma-status-bar" class="bma-status-bar">พร้อมใช้งาน • เปิด Google Sheet ค้างไว้ใน Opera เพื่อซิงค์ข้อมูล</div>
      </div>
    `;

    document.body.appendChild(panelEl);

    // ผูก Event ปุ่มต่างๆ
    panelEl.querySelector('#bma-btn-min').addEventListener('click', () => {
      state.minimized = !state.minimized;
      panelEl.classList.toggle('minimized', state.minimized);
      panelEl.querySelector('#bma-btn-min').textContent = state.minimized ? '➕' : '➖';
      saveState();
    });

    panelEl.querySelector('#bma-btn-reload').addEventListener('click', () => {
      fetchSheetsData();
    });

    panelEl.querySelector('#bma-search-input').addEventListener('input', (e) => {
      state.filterText = e.target.value;
      renderItemOptions();
    });

    panelEl.querySelector('#bma-item-select').addEventListener('change', (e) => {
      state.selectedCode = e.target.value;
      const item = getSelectedItem();
      onItemSelectionChange(item);
    });

    panelEl.querySelector('#bma-pur-no').addEventListener('input', (e) => {
      state.purHireNo = e.target.value.trim();
      saveState();
    });

    panelEl.querySelector('#bma-po-no').addEventListener('input', (e) => {
      state.poNo = e.target.value.trim();
      saveState();
    });

    panelEl.querySelector('#bma-rcv-no').addEventListener('input', (e) => {
      state.rcvNo = e.target.value.trim();
      saveState();
    });

    panelEl.querySelector('#bma-inv-no').addEventListener('input', (e) => {
      state.invoiceNo = e.target.value.trim();
      saveState();
    });

    panelEl.querySelector('#bma-committee-select').addEventListener('change', (e) => {
      state.committeeSet = e.target.value;
      saveState();
    });

    panelEl.querySelector('#bma-btn-autofill').addEventListener('click', () => {
      autoFillCurrentPage();
    });

    panelEl.querySelectorAll('.bma-step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = btn.getAttribute('data-step');
        const item = getSelectedItem();
        if (item && isItemAlreadyRecorded(item) && st !== '7' && st !== '8') {
          setStatus('⛔ มีประวัติการลงข้อมูลแล้ว (อนุญาตเฉพาะขั้นตอนที่ 7 และ 8)', 'err');
          alert('มีประวัติการลงข้อมูลแล้ว\n\nห้ามลงข้อมูลซ้ำในขั้นตอนที่ 1–6!');
          return;
        }
        let filled = 0;
        if (st === '1' && item) {
          filled += fillStep1Agree(item);
          filled += fillPopupBudgetBma();
          filled += fillPopupBudgetEtc();
          filled += fillPopupSearchItem();
        } else if (st === '2' && item) {
          filled += fillStep2Bidder(item);
          filled += fillPopupSearchVendor(item);
          filled += fillPopupBidderDesc(item);
        } else if (st === '3' && item) {
          filled += fillStep3Approve(item);
        } else if (st === '4' && item) {
          filled += fillStep4Contract(item);
          filled += fillPopupSelectOrder();
        } else if (st === '5' && item) {
          filled += fillStep5Delivery(item);
        } else if (st === '6' && item) {
          filled += fillStep6RcvResult(item);
        } else if (st === '7') {
          filled += fillStep7Committee(item);
        } else if (st === '8') {
          filled += fillStep8ReportRcv(item);
        }
        setStatus(filled > 0 ? `✓ กรอกขั้นตอนที่ ${st} สำเร็จ (${filled} จุด)` : `⚠️ ไม่พบช่องของขั้นตอนที่ ${st} ในหน้านี้`, filled > 0 ? 'ok' : 'err');
      });
    });

    renderItemOptions();
    tryCaptureGeneratedCodes();

    // ถ้ายังไม่มีข้อมูลใน Cache ให้ดึงจาก Google Sheets อัตโนมัติ
    if (!state.items || state.items.length === 0) {
      fetchSheetsData();
    }
  }

  // โหลด State แล้วสร้างแผงควบคุม
  loadState(() => {
    buildPanel();
    // ตรวจจับการเปลี่ยนหน้าหรือเปลี่ยน Frame ทุก 1.5 วินาที
    setInterval(() => {
      tryCaptureGeneratedCodes();
      if (panelEl) {
        const lbl = panelEl.querySelector('#bma-current-page-lbl');
        if (lbl) {
          const p = detectCurrentPage();
          lbl.textContent = '📍 ' + p.title;
        }
        updateButtonsLockState(getSelectedItem());
      }
    }, 1500);
  });
})();
