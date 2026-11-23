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

  const DEFAULT_FISCAL_YEARS = {
    '70': {
      label: 'ปีงบ 70 (MISS70 / Auto Crat-EGP70)',
      autocratSheetId: '1qFqdTqcP_d_nNLAX3AL0Gq21s2zjffXW2Czo3Jv1F_Y',
      missSheetId: '1tTaFrjVCPm8IrjJAg6e0Y27jIqoedLsmJz92py1O0lU'
    }
  };

  function extractSheetId(idOrUrl) {
    const s = String(idOrUrl || '').trim();
    if (!s) return '';
    const m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : s;
  }

  const WHT_EXEMPT_KEYWORDS = [
    'สภากาชาด',
    'เอเบิ้ล',
    'เอเบิล',
    'a-ble',
    'abel',
    'องค์การเภสัชกรรม',
    'gpo',
    'ยูนีซัน',
    'unison'
  ];

  const ASSIGN_TO_PRESETS = [
    'สำนักงานบริหารการเงินการคลังกรุงเทพมหานคร โอนเงินเข้าบัญชี รพจ.',
    'คณะกรรมการรับ-ส่งเงินกองการเงินโอนเข้าบัญชี รพจ.'
  ];

  function isMis2PortalHost() {
    return /bmasso\.bma\.go\.th/i.test(window.location.href || '');
  }

  let bridgeStatus = {
    connected: false,
    targetFound: false,
    targetTitle: '',
    calibratedCount: 0,
    totalCalibCount: 18
  };

  let state = {
    items: [],
    vendors: [],
    selectedCode: '',
    activeMode: isMis2PortalHost() ? 'pay' : 'purhire',
    paySubTab: '1',
    committeeSet: '1',
    fiscalYear: '70',
    fiscalYears: JSON.parse(JSON.stringify(DEFAULT_FISCAL_YEARS)),
    showYearSettings: false,
    invoiceNo: '',
    purHireNo: '',
    poNo: '',
    rcvNo: '',
    filterText: '',
    minimized: false,
    autoFillOnLoad: true,
    defaultAssignTo: ASSIGN_TO_PRESETS[0],
    defaultRequester: 'นางอรชุมา หุตะโกวิท',
    payChecks: { payTo: true, assignTo: true, bankCode: true, branchCode: true, accountNo: true },
    branchOverrides: {},
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
    if (/bmasso\.bma\.go\.th/i.test(url)) {
      return { id: 'MIS2_PORTAL', title: 'MIS2 ระบบการเงินจ่าย (FRM_PAY_DOC)' };
    }
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

  function syncRcvPdfContext(item) {
    const rcvNo = state.rcvNo || (item && item.rcvNo) || state.poNo || (item && item.poNo) || '';
    const fiscalYear = state.fiscalYear || '70';
    const code = (item && item.code) || state.selectedCode || '';
    const subject = (item && item.subject) || '';
    try {
      chrome.runtime.sendMessage({
        type: 'SET_RCV_PDF_CONTEXT',
        rcvNo,
        fiscalYear,
        code,
        subject
      });
    } catch (e) {}
  }

  function findEmbeddedPdfUrls() {
    const urls = [];
    if (/\.pdf(\?|$)|report|servlet/i.test(window.location.href) && document.contentType === 'application/pdf') {
      urls.push(window.location.href);
    }
    getTargetDocs().forEach((doc) => {
      try {
        const embeds = doc.querySelectorAll('embed[src], iframe[src], object[data], a[href*=".pdf"], a[href*="report"], a[href*="Report"]');
        embeds.forEach((el) => {
          const rawUrl = el.getAttribute('src') || el.getAttribute('data') || el.getAttribute('href') || '';
          if (rawUrl && (/\.pdf/i.test(rawUrl) || /report|servlet/i.test(rawUrl))) {
            try {
              const absUrl = new URL(rawUrl, doc.location.href).href;
              if (!urls.includes(absUrl)) urls.push(absUrl);
            } catch (e) {}
          }
        });
      } catch (e) {}
    });
    return urls;
  }

  function saveCurrentRcvPdfs(item) {
    const rcvNo = state.rcvNo || (item && item.rcvNo) || state.poNo || (item && item.poNo) || 'X';
    const fiscalYear = state.fiscalYear || '70';
    const code = (item && item.code) || state.selectedCode || '';
    syncRcvPdfContext(item);

    const pdfUrls = findEmbeddedPdfUrls();
    const baseName = `ใบตรวจรับ_${rcvNo}-${fiscalYear}${code ? '_' + code : ''}`;

    // ตั้งชื่อ Title ของหน้าเว็บให้ตรงกับชื่อใบตรวจรับ เวลาผู้ใช้กด Ctrl+S หรือ Save as PDF ชื่อไฟล์จะเป็นชื่อใบตรวจรับทันที
    try {
      document.title = baseName;
    } catch (e) {}

    if (pdfUrls.length > 0) {
      chrome.runtime.sendMessage(
        {
          type: 'DOWNLOAD_PDF_URLS',
          urls: pdfUrls,
          rcvNo,
          fiscalYear,
          code
        },
        (res) => {
          if (res && res.ok) {
            setStatus(`✓ บันทึกไฟล์ PDF ตามชื่อ "${baseName}" (${res.count} ไฟล์) เรียบร้อย!`, 'ok');
          }
        }
      );
      return true;
    }
    return false;
  }

  // ขั้นตอนที่ 8: รายงาน -> 13. ใบตรวจรับพัสดุ (Rep_pur_rcv.jsp)
  function fillStep8ReportRcv(item) {
    let count = 0;
    const rcvNo = state.rcvNo || (item && item.rcvNo) || state.poNo || (item && item.poNo) || '';
    const fiscalYear = state.fiscalYear || '70';
    const code = (item && item.code) || state.selectedCode || '';
    const baseName = `ใบตรวจรับ_${rcvNo || 'X'}-${fiscalYear}${code ? '_' + code : ''}`;

    // ส่งชื่อใบตรวจรับไปตั้งรอไว้ที่ Background Downloader ทันทีเผื่อกดปุ่ม [แสดงรายงาน] แล้วมี PDF 2 ไฟล์เด้งขึ้นมา
    syncRcvPdfContext(item);
    try {
      document.title = baseName;
    } catch (e) {}

    getTargetDocs().forEach((doc) => {
      try {
        doc.title = baseName;
      } catch (e) {}

      const deptInputs = findInputsAfterLabel(doc, 'หน่วยงานตรวจรับ');
      if (deptInputs[0] && setInputValue(deptInputs[0], '07070000')) count++;

      const rcvInputs = findInputsAfterLabel(doc, 'เลขที่ใบตรวจรับ');
      if (rcvInputs.length >= 2) {
        if (rcvInputs[0].tagName === 'SELECT') {
          setSelectByTextOrVal(rcvInputs[0], 'จัดซื้อ');
          if (rcvNo && setInputValue(rcvInputs[1], rcvNo)) count++;
          if (rcvInputs[2]) setInputValue(rcvInputs[2], fiscalYear);
        } else {
          if (rcvNo && setInputValue(rcvInputs[0], rcvNo)) count++;
          if (rcvInputs[1]) setInputValue(rcvInputs[1], fiscalYear);
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

      // ผูก Event กับปุ่ม [แสดงรายงาน] เพื่อส่งชื่อไฟล์ใบตรวจรับไปตั้งชื่อ PDF ทั้ง 2 ไฟล์ทันทีที่กด
      const showBtn = findButtonByText(doc, 'แสดงรายงาน');
      if (showBtn && !showBtn.__bmaPdfHooked) {
        showBtn.__bmaPdfHooked = true;
        showBtn.addEventListener('click', () => {
          syncRcvPdfContext(getSelectedItem());
        });
      }
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

  const STEP_URLS = {
    1: 'http://bmamisapp11.bma.go.th:7778/PurHire/_agree.jsp?pur_hire_type_id=1&mode=new&isNew=1',
    2: 'http://bmamisapp11.bma.go.th:7778/PurHire/Frm_pur_bidder.jsp',
    3: 'http://bmamisapp11.bma.go.th:7778/PurHire/_accept.jsp?pur_hire_type_id=1&mode=search&isNew=1',
    4: 'http://bmamisapp11.bma.go.th:7778/PurHire/_orderterm.jsp?pur_hire_type_id=1',
    5: 'http://bmamisapp11.bma.go.th:7778/PurHire/Frm_pur_prereceiveterm.jsp',
    6: 'http://bmamisapp11.bma.go.th:7778/PurHire/Frm_pur_receiveterm.jsp',
    7: 'http://bmamisapp11.bma.go.th:7778/PurHire/Frm_pur_hire_rcv_committee.jsp?pur_hire_type_id=1',
    8: 'http://bmamisapp11.bma.go.th:7778/PurHire/Rep_pur_rcv.jsp'
  };

  const PAGE_ID_TO_STEP_NUM = {
    STEP1_AGREE: 1,
    STEP2_BIDDER: 2,
    STEP3_APPROVE: 3,
    STEP4_CONTRACT: 4,
    STEP5_DELIVERY: 5,
    STEP6_RCV_RESULT: 6,
    STEP7_COMMITTEE: 7,
    STEP8_REP_RCV: 8
  };

  function navigateToMisStep(stepNum) {
    const targetUrl = STEP_URLS[stepNum];
    if (!targetUrl) return;
    // หากหน้าเว็บใช้ Frame ให้เปลี่ยน URL เฉพาะ Frame เนื้อหาหลัก หรือเปลี่ยนทั้งหน้า
    let navigated = false;
    try {
      const frames = document.querySelectorAll('frame, iframe');
      frames.forEach((f) => {
        try {
          if (f.contentWindow && /PurHire/i.test(f.contentWindow.location.href)) {
            f.contentWindow.location.href = targetUrl;
            navigated = true;
          }
        } catch (e) {}
      });
    } catch (e) {}
    if (!navigated) {
      window.location.href = targetUrl;
    }
  }

  function isPageShowingSavedBanner() {
    let saved = false;
    getTargetDocs().forEach((doc) => {
      try {
        const txt = doc.body ? doc.body.innerText || '' : '';
        if (txt.includes('บันทึกเรียบร้อย')) saved = true;
      } catch (e) {}
    });
    return saved;
  }

  function clickPrimarySaveButtonOnPage() {
    let clicked = false;
    getTargetDocs().forEach((doc) => {
      if (clicked) return;
      const btns = Array.from(doc.querySelectorAll('input[type="button"], input[type="submit"], button'));
      // หาปุ่ม [บันทึก] หรือ [ตกลง] หรือ [แสดงรายงาน] หรือ [รายละเอียด]
      const target =
        btns.find((b) => String(b.value || b.innerText || '').trim() === 'บันทึก') ||
        btns.find((b) => String(b.value || b.innerText || '').trim() === 'รายละเอียด') ||
        btns.find((b) => String(b.value || b.innerText || '').trim() === 'ตกลง') ||
        btns.find((b) => String(b.value || b.innerText || '').trim() === 'แสดงรายงาน');
      if (target && !target.disabled) {
        target.click();
        clicked = true;
      }
    });
    return clicked;
  }

  function approveAndSaveCurrentStep() {
    const page = detectCurrentPage();
    const curStepNum = PAGE_ID_TO_STEP_NUM[page.id] || 0;
    const nextStepNum = curStepNum >= 1 && curStepNum < 8 ? curStepNum + 1 : 0;

    const item = getSelectedItem();
    if (item && isItemAlreadyRecorded(item) && !isStepAllowedWhenRecorded(page.id)) {
      alert('มีประวัติการลงข้อมูลแล้ว\n\nห้ามบันทึกข้อมูลซ้ำในขั้นตอนที่ 1–6!');
      return;
    }

    const ok = confirm(
      `ยืนยันการอนุมัติบันทึกข้อมูล "${page.title}" หรือไม่?\n\n` +
        (item ? `รายการ: [${item.code}] ${item.subject}\nยอดเงิน: ${item.amountFormatted} บาท\n\n` : '') +
        `เมื่อคุณกด "ตกลง (OK)" ระบบจะสั่งกดปุ่ม [บันทึก]` +
        (nextStepNum ? ` และเตรียมพาไปขั้นตอนที่ ${nextStepNum} ต่อไป` : '')
    );
    if (!ok) return;

    if (nextStepNum) {
      state.pendingAutoNextStep = nextStepNum;
      saveState();
    }

    const clicked = clickPrimarySaveButtonOnPage();
    if (clicked) {
      setStatus(`✓ อนุมัติและสั่งกดปุ่ม [บันทึก] แล้ว... กำลังรอดึงรหัสและไปขั้นตอนถัดไป`, 'ok');
    } else {
      setStatus(`⚠️ ไม่พบปุ่ม [บันทึก] บนหน้าจอ กรุณากดปุ่มบันทึกบนหน้าเว็บด้วยตัวเอง`, 'err');
    }
  }

  function updateApprovalBoxUI() {
    if (!panelEl) return;
    const box = panelEl.querySelector('#bma-approval-gate');
    if (!box) return;
    const item = getSelectedItem();
    const page = detectCurrentPage();
    const recorded = isItemAlreadyRecorded(item);
    const allowPage = !recorded || isStepAllowedWhenRecorded(page.id);

    if (!item || !allowPage || page.id === 'MIS2_PORTAL' || page.id === 'UNKNOWN') {
      box.style.display = 'none';
      return;
    }

    const curStepNum = PAGE_ID_TO_STEP_NUM[page.id] || 0;
    const nextStepNum = curStepNum >= 1 && curStepNum < 8 ? curStepNum + 1 : 0;
    const savedNow = isPageShowingSavedBanner();

    box.style.display = 'flex';
    const titleEl = box.querySelector('#bma-approval-title');
    const descEl = box.querySelector('#bma-approval-desc');
    const approveBtn = box.querySelector('#bma-btn-approve-save');
    const nextBtn = box.querySelector('#bma-btn-goto-next');

    if (savedNow && nextStepNum) {
      titleEl.innerHTML = `✅ บันทึกขั้นตอนที่ ${curStepNum} เรียบร้อยแล้ว!`;
      descEl.textContent = `ระบบจำรหัสที่สร้างขึ้นเรียบร้อยแล้ว กดปุ่มด้านล่างเพื่อเปิดหน้าขั้นตอนที่ ${nextStepNum} ต่อทันที (และจะกรอกอัตโนมัติพร้อมรออนุมัติก่อนบันทึก)`;
      approveBtn.style.display = 'none';
      nextBtn.style.display = 'flex';
      nextBtn.textContent = `➡️ ไปขั้นตอนที่ ${nextStepNum} ต่อทันที (Auto-Fill)`;
      nextBtn.onclick = () => {
        state.pendingAutoNextStep = 0;
        saveState();
        navigateToMisStep(nextStepNum);
      };
    } else {
      const rcvNo = state.rcvNo || (item && item.rcvNo) || state.poNo || (item && item.poNo) || 'X';
      const yr = state.fiscalYear || '70';
      const basePdf = `ใบตรวจรับ_${rcvNo}-${yr}_${item.code}`;
      titleEl.innerHTML = `🔔 รออนุมัติก่อนบันทึก (${page.title})`;
      if (page.id === 'STEP8_REP_RCV') {
        descEl.innerHTML =
          `กรอกข้อมูลครบแล้ว เมื่อกด <b>[แสดงรายงาน]</b> ระบบจะตั้งชื่อไฟล์ PDF ทั้ง 2 ไฟล์เป็น:<br/>` +
          `📄 <b>${basePdf}_ไฟล์ที่1.pdf</b><br/>` +
          `📄 <b>${basePdf}_ไฟล์ที่2.pdf</b>`;
      } else {
        descEl.textContent = `ระบบกรอกข้อมูลลงช่องต่างๆ อัตโนมัติแล้ว กรุณาตรวจสอบความถูกต้องก่อนกดอนุมัติบันทึก`;
      }
      approveBtn.style.display = 'flex';
      approveBtn.textContent = nextStepNum
        ? `✅ อนุมัติบันทึก (และเตรียมไปขั้นตอนที่ ${nextStepNum})`
        : `✅ อนุมัติแสดงรายงาน & บันทึก PDF 2 ไฟล์ (${basePdf})`;
      if (nextStepNum) {
        nextBtn.style.display = 'flex';
        nextBtn.textContent = `⏭️ ข้ามไปเปิดหน้าขั้นตอนที่ ${nextStepNum}`;
        nextBtn.onclick = () => navigateToMisStep(nextStepNum);
      } else {
        nextBtn.style.display = 'none';
      }
    }
  }
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
      applyItemToPayFields(getSelectedItem());
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
    applyItemToPayFields(item);
    // กรอกอัตโนมัติทันทีที่เลือกรายการ (โดยไม่กดบันทึก รอคนอนุมัติ)
    if (state.autoFillOnLoad !== false && !isMis2PortalHost() && state.activeMode !== 'pay') {
      lastAutoFillSig = '';
      triggerSmartAutoFill();
    }
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

  function getCurrentFiscalYearEntry() {
    if (!state.fiscalYears || typeof state.fiscalYears !== 'object') {
      state.fiscalYears = JSON.parse(JSON.stringify(DEFAULT_FISCAL_YEARS));
    }
    if (!state.fiscalYears['70']) {
      state.fiscalYears['70'] = JSON.parse(JSON.stringify(DEFAULT_FISCAL_YEARS['70']));
    }
    const fy = String(state.fiscalYear || '70').trim();
    if (!state.fiscalYears[fy]) {
      state.fiscalYears[fy] = {
        label: `ปีงบ ${fy} (MISS${fy} / Auto Crat-EGP${fy})`,
        autocratSheetId: DEFAULT_FISCAL_YEARS['70'].autocratSheetId,
        missSheetId: DEFAULT_FISCAL_YEARS['70'].missSheetId
      };
    }
    return state.fiscalYears[fy];
  }

  function renderFiscalYearDropdown() {
    if (!panelEl) return;
    getCurrentFiscalYearEntry();
    const sel = panelEl.querySelector('#bma-fy-select');
    if (!sel) return;
    const years = Object.keys(state.fiscalYears).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
    sel.innerHTML = years
      .map((y) => {
        const info = state.fiscalYears[y] || {};
        const lbl = info.label || `ปีงบ ${y} (MISS${y} / Auto Crat-EGP${y})`;
        return `<option value="${y}" ${y === String(state.fiscalYear) ? 'selected' : ''}>${lbl}</option>`;
      })
      .join('');
    sel.value = String(state.fiscalYear || '70');

    // อัปเดตป้ายรหัส (1-X-YY) ตามปีงบประมาณที่เลือก
    const fy = String(state.fiscalYear || '70');
    const purLbl = panelEl.querySelector('#bma-pur-lbl');
    const poLbl = panelEl.querySelector('#bma-po-lbl');
    const rcvLbl = panelEl.querySelector('#bma-rcv-lbl');
    if (purLbl) purLbl.textContent = `รหัสจัดซื้อ (1-X-${fy})`;
    if (poLbl) poLbl.textContent = `เลขใบสั่งซื้อ (11-X-${fy})`;
    if (rcvLbl) rcvLbl.textContent = `เลขใบตรวจรับ (X-${fy})`;

    // อัปเดตช่องตั้งค่าไฟล์ปลายทาง
    const entry = getCurrentFiscalYearEntry();
    const fyInput = panelEl.querySelector('#bma-cfg-fy');
    const acInput = panelEl.querySelector('#bma-cfg-autocrat');
    const missInput = panelEl.querySelector('#bma-cfg-miss');
    if (fyInput && document.activeElement !== fyInput) fyInput.value = fy;
    if (acInput && document.activeElement !== acInput) acInput.value = entry.autocratSheetId || '';
    if (missInput && document.activeElement !== missInput) missInput.value = entry.missSheetId || '';
  }

  function fetchSheetsData() {
    const fy = String(state.fiscalYear || '70').trim();
    const entry = getCurrentFiscalYearEntry();
    setStatus(`⏳ กำลังซิงค์ข้อมูลปีงบประมาณ ${fy} (MISS${fy} / Auto Crat-EGP${fy})...`, '');
    chrome.runtime.sendMessage(
      {
        type: 'FETCH_SHEETS_DATA',
        config: {
          fiscalYear: fy,
          autocratSheetId: extractSheetId(entry.autocratSheetId),
          missSheetId: extractSheetId(entry.missSheetId),
          gasWebAppUrl: state.gasWebAppUrl
        }
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
          if (res.remoteConfig.fiscalYears && typeof res.remoteConfig.fiscalYears === 'object') {
            Object.keys(res.remoteConfig.fiscalYears).forEach((k) => {
              if (!state.fiscalYears[k]) {
                state.fiscalYears[k] = res.remoteConfig.fiscalYears[k];
              }
            });
          }
          state.remoteVersion = res.remoteConfig.version || '1.3.0';
        }
        state.items = res.items || [];
        if (Array.isArray(res.vendors) && res.vendors.length > 0) {
          state.vendors = res.vendors;
        }
        saveState();
        renderFiscalYearDropdown();
        renderPayVendorOptions();
        const cntLbl = panelEl ? panelEl.querySelector('#bma-sheet-count-lbl') : null;
        if (cntLbl) cntLbl.textContent = `ค้นหาและเลือกรายการ ปีงบ ${fy} (${state.items.length} รายการ)`;
        renderItemOptions();
        const curItem = getSelectedItem();
        applyItemToPayFields(curItem);
        if (!isItemAlreadyRecorded(curItem)) {
          const verTag = state.remoteVersion ? ` • GitHub v${state.remoteVersion}` : '';
          const srcText = res.source ? ` [${res.source}${verTag}]` : '';
          setStatus(`✓ ปีงบ ${fy}: พร้อมใช้งาน ${state.items.length} รายการ${srcText}`, 'ok');
        }
      }
    );
  }

  // ==================== MIS2 DISBURSEMENT (FRM_PAY_DOC) MODULE ====================
  function normalizeCompanyKey(name) {
    return thaiToArabic(String(name || ''))
      .replace(/บริษัท|ห้างหุ้นส่วนจำกัด|หจก\.?|จำกัด|\(มหาชน\)|\(ประเทศไทย\)|\.|,|-|\s+/gi, '')
      .toLowerCase();
  }

  function isWhtExemptCompany(companyName) {
    const s = String(companyName || '').toLowerCase();
    if (!s) return false;
    return WHT_EXEMPT_KEYWORDS.some((kw) => s.includes(String(kw).toLowerCase()));
  }

  function calcTaxBreakdown(amountVal, companyName) {
    const amt = Number(amountVal) || 0;
    if (amt <= 0) {
      return { base: 0, vat7: 0, wht1: 0, net: 0, exempt: false };
    }
    const base = Math.round((amt / 1.07) * 100) / 100;
    const vat7 = Math.round((amt - base) * 100) / 100;
    const exempt = isWhtExemptCompany(companyName);
    const wht1 = exempt ? 0 : Math.round(base * 0.01 * 100) / 100;
    const net = Math.round((amt - wht1) * 100) / 100;
    return { base, vat7, wht1, net, exempt };
  }

  function getTodayThaiSlash() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear() + 543;
    return `${dd}/${mm}/${yyyy}`;
  }

  function isItemAidsBudget(item) {
    if (!item) return false;
    if (item.isAidsBudget) return true;
    return /งบเอดส์|เอดส์|aids/i.test(String(item.code || '')) || /เอดส์|อุดหนุน/i.test(String(item.budgetType || ''));
  }

  function formatPayDescription(item) {
    if (!item) return '';
    const subjRaw = String(item.missSubject || item.subject || '').trim();
    if (!subjRaw) return '';
    if (subjRaw.startsWith('ค่า')) return `(${subjRaw})`;
    return `(ค่า${subjRaw})`;
  }

  function getBranchCodeForVendor(v) {
    if (!v) return '';
    const cKey = String(v.company || '').trim();
    if (cKey && state.branchOverrides && state.branchOverrides[cKey]) {
      return state.branchOverrides[cKey];
    }
    if (v.branchCode && String(v.branchCode).trim()) {
      return String(v.branchCode).trim();
    }
    const digits = thaiToArabic(String(v.accountNo || '')).replace(/\D/g, '');
    return digits.length >= 3 ? '0' + digits.slice(0, 3) : '';
  }

  function findMatchingVendor(vendorName, taxId) {
    const list = Array.isArray(state.vendors) ? state.vendors : [];
    const cleanTax = thaiToArabic(String(taxId || '')).replace(/\D/g, '');
    if (cleanTax) {
      const byTax = list.find((v) => String(v.taxId || '').replace(/\D/g, '') === cleanTax);
      if (byTax) return byTax;
    }
    const nKey = normalizeCompanyKey(vendorName);
    if (!nKey) return null;
    let exact = list.find((v) => normalizeCompanyKey(v.company) === nKey);
    if (exact) return exact;
    if (nKey.length >= 4) {
      exact = list.find((v) => {
        const vk = normalizeCompanyKey(v.company);
        return vk && (vk.includes(nKey) || nKey.includes(vk));
      });
    }
    return exact || null;
  }

  function copyTextToBrowserClipboard(text) {
    const val = String(text || '');
    if (!val) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(val).then(
        () => true,
        () => fallbackCopyText(val)
      );
    }
    return Promise.resolve(fallbackCopyText(val));
  }

  function fallbackCopyText(val) {
    try {
      const ta = document.createElement('textarea');
      ta.value = val;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function sendBridgeRequest(endpoint, method, payload, timeoutMs, cb) {
    try {
      chrome.runtime.sendMessage(
        { type: 'BRIDGE_REQUEST', endpoint, method: method || 'GET', payload: payload || {}, timeoutMs },
        (res) => {
          if (chrome.runtime.lastError) {
            if (cb) cb({ ok: false, bridgeConnected: false, error: chrome.runtime.lastError.message });
            return;
          }
          if (cb) cb(res || { ok: false, bridgeConnected: false });
        }
      );
    } catch (e) {
      if (cb) cb({ ok: false, bridgeConnected: false, error: e.message });
    }
  }

  function updateBridgeStatusUI() {
    if (!panelEl) return;
    const bar = panelEl.querySelector('#bma-bridge-bar');
    const txt = panelEl.querySelector('#bma-bridge-status-text');
    if (!bar || !txt) return;
    if (bridgeStatus.connected) {
      bar.className = 'bma-bridge-bar connected';
      const winText = bridgeStatus.targetFound
        ? `🪟 ล็อกหน้าต่าง: ${String(bridgeStatus.targetTitle || 'Oracle Forms').slice(0, 26)}`
        : '⚠️ ยังไม่พบหน้าต่าง Oracle Forms (เปิด FRM_PAY_DOC แล้วกดเลือกหน้าต่าง)';
      txt.innerHTML =
        `<b>🟢 เชื่อมตัวช่วย Oracle Forms แล้ว</b> (พิกัด ${bridgeStatus.calibratedCount}/${bridgeStatus.totalCalibCount})<br/>${winText}`;
    } else {
      bar.className = 'bma-bridge-bar offline';
      txt.innerHTML =
        `<b>🟡 โหมดคัดลอกวาง (ยังไม่เปิดตัวช่วย Oracle Forms)</b><br/>` +
        `กดปุ่ม 📋 คัดลอกไปวางได้เลย หรือดับเบิลคลิก <b>START_ORACLE_BRIDGE.bat</b> เพื่อกรอกอัตโนมัติ`;
    }
  }

  function pollBridgeStatus(silent) {
    sendBridgeRequest('/status', 'GET', null, 2000, (res) => {
      if (res && res.bridgeConnected && res.data && res.data.ok) {
        bridgeStatus = {
          connected: true,
          targetFound: Boolean(res.data.targetFound),
          targetTitle: String(res.data.targetTitle || ''),
          calibratedCount: Number(res.data.calibratedCount || 0),
          totalCalibCount: Number(res.data.totalCalibCount || 18)
        };
      } else {
        bridgeStatus = {
          connected: false,
          targetFound: false,
          targetTitle: '',
          calibratedCount: 0,
          totalCalibCount: 18
        };
      }
      updateBridgeStatusUI();
      if (!silent) {
        setStatus(
          bridgeStatus.connected
            ? `✓ เชื่อมตัวช่วย Oracle Forms แล้ว (พิกัด ${bridgeStatus.calibratedCount}/${bridgeStatus.totalCalibCount})`
            : '🟡 ยังไม่เปิดตัวช่วย Oracle Forms • ใช้ปุ่ม 📋 คัดลอกวางได้ทันที',
          bridgeStatus.connected ? 'ok' : ''
        );
      }
    });
  }

  function handleQuickCopyOrPaste(val, isMultiline, btnEl) {
    const clean = String(val || '').trim();
    if (!clean) {
      setStatus('⚠️ ไม่มีข้อมูลในช่องนี้ให้คัดลอก/วาง', 'err');
      return;
    }
    copyTextToBrowserClipboard(clean);
    if (btnEl) {
      const orig = btnEl.textContent;
      btnEl.textContent = '✓';
      setTimeout(() => { btnEl.textContent = orig; }, 900);
    }
    if (bridgeStatus.connected && bridgeStatus.targetFound) {
      sendBridgeRequest('/paste', 'POST', { text: clean, isMultiline: Boolean(isMultiline) }, 10000, (res) => {
        if (res && res.ok && res.data && res.data.pasted) {
          setStatus('✓ วางข้อมูลลงช่องที่เลือกใน Oracle Forms แล้ว', 'ok');
        } else {
          setStatus('📋 คัดลอกลงคลิปบอร์ดแล้ว (กด Ctrl+V ใน Oracle Forms)', 'ok');
        }
      });
    } else {
      setStatus('📋 คัดลอกลงคลิปบอร์ดแล้ว (กด Ctrl+V ใน Oracle Forms)', 'ok');
    }
  }

  function updatePayTaxDisplay(amountVal, companyName) {
    if (!panelEl) return;
    const tax = calcTaxBreakdown(amountVal, companyName);
    const vatIn = panelEl.querySelector('#bma-pay-vat');
    const whtIn = panelEl.querySelector('#bma-pay-wht');
    const badge = panelEl.querySelector('#bma-pay-tax-badge');
    if (vatIn) vatIn.value = tax.vat7.toFixed(2);
    if (whtIn) whtIn.value = tax.wht1.toFixed(2);
    if (badge) {
      const netStr = tax.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (tax.exempt) {
        badge.className = 'bma-tax-box exempt';
        badge.textContent = `✓ ยกเว้นหัก 1% (0.00) • ยอดสุทธิจ่าย: ${netStr} บาท`;
      } else {
        badge.className = 'bma-tax-box';
        badge.textContent = `หัก 1% ปกติ • ยอดสุทธิจ่าย: ${netStr} บาท`;
      }
    }
  }

  function renderPayVendorOptions() {
    if (!panelEl) return;
    const sel = panelEl.querySelector('#bma-pay-vendor-select');
    const qIn = panelEl.querySelector('#bma-pay-vendor-search');
    if (!sel) return;
    const q = String((qIn && qIn.value) || '').toLowerCase().trim();
    const list = (state.vendors || []).filter((v) => {
      if (!q) return true;
      return (
        String(v.company || '').toLowerCase().includes(q) ||
        String(v.bank || '').toLowerCase().includes(q) ||
        String(v.accountNo || '').includes(q) ||
        String(v.taxId || '').includes(q)
      );
    });
    if (list.length === 0) {
      sel.innerHTML = '<option value="">-- ไม่พบข้อมูลในทะเบียนบริษัท --</option>';
      return;
    }
    sel.innerHTML =
      '<option value="">-- เลือกบริษัทจากทะเบียนบริษัท (' + list.length + ') --</option>' +
      list
        .map((v, idx) => {
          const bTag = v.bank ? ` [${v.bankCode || ''} ${v.bank}]` : '';
          return `<option value="${v.company.replace(/"/g, '&quot;')}">${v.company}${bTag}</option>`;
        })
        .join('');
  }

  function applyVendorToPayFields(v) {
    if (!panelEl || !v) return;
    const item = getSelectedItem();
    const payToIn = panelEl.querySelector('#bma-pay-to');
    const assignIn = panelEl.querySelector('#bma-pay-assign');
    const bankIn = panelEl.querySelector('#bma-pay-bank');
    const branchIn = panelEl.querySelector('#bma-pay-branch');
    const acctIn = panelEl.querySelector('#bma-pay-acct');
    const infoBox = panelEl.querySelector('#bma-pay-bank-info');

    if (payToIn) payToIn.value = v.company || '';
    if (bankIn) bankIn.value = v.bankCode || '';
    if (branchIn) branchIn.value = getBranchCodeForVendor(v);
    if (acctIn) acctIn.value = v.accountNo || '';
    if (assignIn) {
      assignIn.value = isItemAidsBudget(item) ? (v.company || '') : (state.defaultAssignTo || ASSIGN_TO_PRESETS[0]);
    }
    if (infoBox) {
      infoBox.innerHTML = `🏦 ธนาคาร (B): <b>${v.bank || '-'} (${v.bankCode || '-'})</b><br/>📍 สาขา (C): <b>${v.branch || '-'}</b>`;
    }
    updatePayTaxDisplay(item ? item.amount : 0, v.company || '');
  }

  function applyItemToPayFields(item) {
    if (!panelEl || !item) return;
    const fy = String(state.fiscalYear || '70');
    const rcvNoIn = panelEl.querySelector('#bma-pay-rcvno');
    const rcvYrIn = panelEl.querySelector('#bma-pay-rcvyr');
    const reqIn = panelEl.querySelector('#bma-pay-requester');
    const dtIn = panelEl.querySelector('#bma-pay-date');
    const descIn = panelEl.querySelector('#bma-pay-desc');
    const docIn = panelEl.querySelector('#bma-pay-docno');
    const saveDocBtn = panelEl.querySelector('#bma-pay-save-doc');
    const alertBox = panelEl.querySelector('#bma-pay-dup-alert');
    const sumBox = panelEl.querySelector('#bma-pay-item-brief');

    if (rcvNoIn) rcvNoIn.value = state.rcvNo || item.rcvNo || '';
    if (rcvYrIn) rcvYrIn.value = fy;
    if (reqIn && !reqIn.value) reqIn.value = state.defaultRequester || 'นางอรชุมา หุตะโกวิท';
    if (dtIn && !dtIn.value) dtIn.value = getTodayThaiSlash();
    if (descIn) descIn.value = formatPayDescription(item);
    if (docIn) docIn.value = item.payDocNo || '';
    if (saveDocBtn) saveDocBtn.textContent = `💾 บันทึกลง MISS${fy}`;

    if (sumBox) {
      const rcvDisp = item.rcvNo ? `${item.rcvNo}/${fy}` : '(ยังไม่มีเลขใบตรวจรับ)';
      sumBox.innerHTML =
        `<b>[${item.code}]</b> ใบตรวจรับ: <b>${rcvDisp}</b> | ยอด: <b style="color:#16a34a;">${item.amountFormatted} ฿</b><br/>` +
        `<span style="color:#475569;">${item.vendorName || '-'}</span>`;
    }

    if (alertBox) {
      if (item.payDocNo) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = `⛔ มีประวัติการขอเบิกแล้วใน MISS${fy} (เลขที่ใบขอเบิก: <b>${item.payDocNo}</b>) — ระวังเบิกซ้ำ!`;
      } else {
        alertBox.style.display = 'none';
      }
    }

    updatePayTaxDisplay(item.amount, item.vendorName);

    const matched = (item.vendorProfile && item.vendorProfile.company)
      ? item.vendorProfile
      : findMatchingVendor(item.vendorName, item.vendorTaxId);

    if (matched) {
      applyVendorToPayFields(matched);
      const vSel = panelEl.querySelector('#bma-pay-vendor-select');
      if (vSel) vSel.value = matched.company || '';
    } else {
      const payToIn = panelEl.querySelector('#bma-pay-to');
      const assignIn = panelEl.querySelector('#bma-pay-assign');
      const bankIn = panelEl.querySelector('#bma-pay-bank');
      const branchIn = panelEl.querySelector('#bma-pay-branch');
      const acctIn = panelEl.querySelector('#bma-pay-acct');
      const infoBox = panelEl.querySelector('#bma-pay-bank-info');
      if (payToIn) payToIn.value = item.vendorName || '';
      if (assignIn) assignIn.value = isItemAidsBudget(item) ? (item.vendorName || '') : (state.defaultAssignTo || ASSIGN_TO_PRESETS[0]);
      if (bankIn) bankIn.value = '';
      if (branchIn) branchIn.value = '';
      if (acctIn) acctIn.value = '';
      if (infoBox) infoBox.textContent = '⚠️ ไม่พบบริษัทนี้ในทะเบียนบริษัท — เลือกจากรายการบริษัทด้านบนได้';
    }
  }

  function switchUnifiedMode(mode) {
    state.activeMode = mode === 'pay' ? 'pay' : 'purhire';
    saveState();
    if (!panelEl) return;
    const purDiv = panelEl.querySelector('#bma-mode-purhire');
    const payDiv = panelEl.querySelector('#bma-mode-pay');
    const tabPur = panelEl.querySelector('#bma-tab-btn-purhire');
    const tabPay = panelEl.querySelector('#bma-tab-btn-pay');
    if (purDiv) purDiv.style.display = state.activeMode === 'purhire' ? 'flex' : 'none';
    if (payDiv) payDiv.style.display = state.activeMode === 'pay' ? 'flex' : 'none';
    if (tabPur) tabPur.className = 'bma-mode-tab' + (state.activeMode === 'purhire' ? ' active' : '');
    if (tabPay) tabPay.className = 'bma-mode-tab' + (state.activeMode === 'pay' ? ' active pay-active' : '');
    if (state.activeMode === 'pay') {
      applyItemToPayFields(getSelectedItem());
      pollBridgeStatus(true);
    }
  }

  function switchPaySubTab(sub) {
    state.paySubTab = String(sub || '1');
    saveState();
    if (!panelEl) return;
    ['1', '2', '3'].forEach((k) => {
      const pane = panelEl.querySelector('#bma-pay-pane-' + k);
      const btn = panelEl.querySelector('#bma-pay-subbtn-' + k);
      if (pane) pane.style.display = k === state.paySubTab ? 'flex' : 'none';
      if (btn) btn.className = 'bma-subtab' + (k === state.paySubTab ? ' active' : '');
    });
  }

  function runOracleBridgeStep(step) {
    if (!panelEl) return;
    if (!bridgeStatus.connected) {
      setStatus('🟡 ยังไม่ได้เปิดตัวช่วย Oracle Forms — ดับเบิลคลิก START_ORACLE_BRIDGE.bat หรือใช้ปุ่ม 📋 คัดลอกวาง', 'err');
      alert(
        'ยังไม่ได้เปิดตัวช่วย Oracle Forms (BMA MIS2 Bridge)\n\n' +
        '• หากต้องการกรอกเข้าหน้าต่าง Oracle Forms อัตโนมัติ:\n  ให้ดับเบิลคลิก START_ORACLE_BRIDGE.bat (หรือ INSTALL_AUTOSTART_BRIDGE.bat)\n\n' +
        '• หรือกดปุ่ม 📋 ข้างแต่ละช่องเพื่อคัดลอกไปกด Ctrl+V เองได้ทันทีครับ'
      );
      return;
    }

    const payload = {};
    if (step === '1') {
      payload.rcvNo = (panelEl.querySelector('#bma-pay-rcvno').value || '').trim();
      payload.rcvYear = (panelEl.querySelector('#bma-pay-rcvyr').value || '').trim();
      if (!payload.rcvNo) {
        alert('กรุณาระบุเลขที่ใบตรวจรับก่อนครับ');
        return;
      }
    } else if (step === '1.6') {
      payload.vatAmount = (panelEl.querySelector('#bma-pay-vat').value || '').trim();
      payload.whtAmount = (panelEl.querySelector('#bma-pay-wht').value || '').trim();
    } else if (step === '2') {
      const checks = state.payChecks || {};
      const payToVal = (panelEl.querySelector('#bma-pay-to').value || '').trim();
      const branchVal = (panelEl.querySelector('#bma-pay-branch').value || '').trim();
      if (payToVal && branchVal) {
        state.branchOverrides = state.branchOverrides || {};
        state.branchOverrides[payToVal] = branchVal;
        saveState();
      }
      if (checks.payTo !== false) payload.payTo = payToVal;
      if (checks.assignTo !== false) payload.assignTo = (panelEl.querySelector('#bma-pay-assign').value || '').trim();
      if (checks.bankCode !== false) payload.bankCode = (panelEl.querySelector('#bma-pay-bank').value || '').trim();
      if (checks.branchCode !== false) payload.branchCode = branchVal;
      if (checks.accountNo !== false) payload.accountNo = (panelEl.querySelector('#bma-pay-acct').value || '').trim();
    } else if (step === '3') {
      payload.requesterName = (panelEl.querySelector('#bma-pay-requester').value || '').trim();
      payload.payDate = (panelEl.querySelector('#bma-pay-date').value || '').trim();
      payload.description = (panelEl.querySelector('#bma-pay-desc').value || '').trim();
    }

    setStatus(`⚡ กำลังส่งคำสั่งขั้นที่ ${step} ไปยัง Oracle Forms... (กด ESC หยุดฉุกเฉิน)`, '');
    sendBridgeRequest('/run-step', 'POST', { step, payload }, 45000, (res) => {
      if (!res || !res.bridgeConnected) {
        pollBridgeStatus(true);
        setStatus('❌ ขาดการเชื่อมต่อกับตัวช่วย Oracle Forms', 'err');
        return;
      }
      const d = res.data || {};
      if (d.ok) {
        setStatus('✓ ' + (d.message || `กรอกขั้นที่ ${step} สำเร็จ`), 'ok');
        if (step === '1.6') switchPaySubTab('2');
        if (step === '2') switchPaySubTab('3');
      } else {
        setStatus('⚠️ ' + (d.error || 'กรอกไม่สำเร็จ'), 'err');
        if (d.needCalibration) {
          const openCal = confirm(
            (d.error || 'ยังไม่ได้ตั้งพิกัดหน้าจอ Oracle Forms') +
            '\n\nต้องการเปิดหน้าต่างตั้งพิกัด (F8) ตอนนี้เลยไหมครับ?'
          );
          if (openCal) {
            sendBridgeRequest('/calibrate', 'POST', {}, 300000, () => pollBridgeStatus(false));
          }
        }
      }
    });
  }

  function savePayDocToMiss() {
    if (!panelEl) return;
    const item = getSelectedItem();
    const fy = String(state.fiscalYear || '70');
    const entry = getCurrentFiscalYearEntry();
    const payNo = (panelEl.querySelector('#bma-pay-docno').value || '').trim();
    if (!payNo) {
      alert('กรุณาพิมพ์เลขที่ใบขอเบิกที่ได้จากระบบ MIS2 ก่อนครับ');
      return;
    }
    if (!item || !item.missRowIndex) {
      alert(`รายการนี้ยังไม่ได้เชื่อมแถวในชีต MISS${fy} กรุณาเลือกรายการงบก่อนครับ`);
      return;
    }
    setStatus(`💾 กำลังบันทึกเลขที่ใบขอเบิก '${payNo}' ลง MISS${fy} คอลัมน์ H...`, '');
    chrome.runtime.sendMessage(
      {
        type: 'SAVE_PAY_DOC_NO',
        gasWebAppUrl: state.gasWebAppUrl,
        missRowIndex: item.missRowIndex,
        payDocNo: payNo,
        missSheetId: extractSheetId(entry.missSheetId),
        missTabName: entry.missTabName || 'ชีต1'
      },
      (res) => {
        if (res && res.ok) {
          item.payDocNo = payNo;
          saveState();
          applyItemToPayFields(item);
          setStatus(`✓ บันทึกเลขที่ใบขอเบิก '${payNo}' ลง MISS${fy} แถว ${item.missRowIndex} เรียบร้อย!`, 'ok');
        } else {
          const err = (res && res.error) || 'บันทึกไม่สำเร็จ';
          setStatus('❌ ' + err, 'err');
          alert('บันทึกไม่สำเร็จ: ' + err);
        }
      }
    );
  }

  function buildPanel() {
    // หากเป็นเฟรมย่อยที่ขนาดเล็กมาก (เช่น banner บนสุด) ไม่ต้องแสดงแผงซ้ำ
    if (window.innerHeight < 220 || window.innerWidth < 350) return;
    if (document.getElementById('bma-mis-autofill-panel')) return;

    const page = detectCurrentPage();
    const fy = String(state.fiscalYear || '70');
    const curEntry = getCurrentFiscalYearEntry();
    const checks = state.payChecks || { payTo: true, assignTo: true, bankCode: true, branchCode: true, accountNo: true };
    panelEl = document.createElement('div');
    panelEl.id = 'bma-mis-autofill-panel';
    if (state.minimized) panelEl.classList.add('minimized');

    panelEl.innerHTML = `
      <div class="bma-panel-header" id="bma-panel-drag">
        <div class="bma-panel-title">
          <span>💊 BMA MIS &amp; MIS2</span>
          <span style="font-size:10px;font-weight:600;background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:4px;">by ARISSARA.K</span>
        </div>
        <div class="bma-panel-header-btns">
          <button type="button" class="bma-icon-btn" id="bma-btn-reload" title="ดึงข้อมูลล่าสุดจาก Google Sheet">🔄 ซิงค์</button>
          <button type="button" class="bma-icon-btn" id="bma-btn-min" title="ย่อ/ขยายแผงควบคุม">${state.minimized ? '➕' : '➖'}</button>
        </div>
      </div>

      <div class="bma-panel-body">
        <div class="bma-mode-tabs">
          <button type="button" id="bma-tab-btn-purhire" class="bma-mode-tab ${state.activeMode !== 'pay' ? 'active' : ''}">📦 จัดซื้อ/ตรวจรับ (8 ขั้น)</button>
          <button type="button" id="bma-tab-btn-pay" class="bma-mode-tab ${state.activeMode === 'pay' ? 'active pay-active' : ''}">💰 เบิกจ่าย MIS2 (ฎีกา)</button>
        </div>

        <div class="bma-field-group" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:7px 9px;">
          <div class="bma-label" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="color:#1e40af;font-weight:700;">📅 ปีงบประมาณ &amp; ไฟล์ปลายทาง</span>
            <button type="button" id="bma-btn-toggle-fy-cfg" style="background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;border-radius:5px;padding:2px 7px;font-size:10.5px;font-weight:700;cursor:pointer;">
              ➕ เพิ่มปีงบ / ตั้งค่าไฟล์
            </button>
          </div>
          <select id="bma-fy-select" class="bma-select" style="border-color:#93c5fd;background:#fff;font-weight:700;color:#1e3a8a;"></select>

          <div id="bma-fy-config-box" style="display:${state.showYearSettings ? 'block' : 'none'};margin-top:7px;padding-top:7px;border-top:1px dashed #93c5fd;font-size:11px;">
            <div style="margin-bottom:5px;">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:2px;">ปีงบประมาณ (เช่น 70, 71, 72):</div>
              <div style="display:flex;gap:5px;">
                <input type="text" id="bma-cfg-fy" class="bma-input" placeholder="เช่น 71" value="${fy}" style="width:70px;font-weight:700;" />
                <button type="button" id="bma-btn-add-next-fy" style="flex:1;background:#fff;color:#1d4ed8;border:1px solid #93c5fd;border-radius:5px;font-size:10.5px;font-weight:700;cursor:pointer;">
                  ➕ สร้างปีถัดไปอัตโนมัติ
                </button>
              </div>
            </div>
            <div style="margin-bottom:5px;">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:2px;">ลิงก์ / ID ไฟล์ Auto Crat-EGP (ปีที่เลือก):</div>
              <input type="text" id="bma-cfg-autocrat" class="bma-input" placeholder="วางลิงก์ Google Sheet หรือ Spreadsheet ID..." value="${curEntry.autocratSheetId || ''}" style="font-size:10.5px;" />
            </div>
            <div style="margin-bottom:6px;">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:2px;">ลิงก์ / ID ไฟล์ MISS (ปีที่เลือก):</div>
              <input type="text" id="bma-cfg-miss" class="bma-input" placeholder="วางลิงก์ Google Sheet หรือ Spreadsheet ID..." value="${curEntry.missSheetId || ''}" style="font-size:10.5px;" />
            </div>
            <div style="display:flex;gap:5px;">
              <button type="button" id="bma-btn-save-fy" style="flex:1;background:#1d4ed8;color:#fff;border:none;border-radius:5px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;">
                💾 บันทึกปีงบ &amp; โหลดไฟล์ใหม่
              </button>
              <button type="button" id="bma-btn-del-fy" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;border-radius:5px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;" title="ลบปีงบนี้ (ลบไม่ได้ถ้าเป็นปี 70)">
                🗑️
              </button>
            </div>
          </div>
        </div>

        <div class="bma-field-group">
          <div class="bma-label">
            <span id="bma-sheet-count-lbl">ค้นหาและเลือกรายการ ปีงบ ${fy} (${state.items.length} รายการ)</span>
          </div>
          <input type="text" id="bma-search-input" class="bma-input" placeholder="ค้นหารหัส เช่น 1งบ, 7งบ, ชื่อยา, บริษัท..." value="${state.filterText || ''}" />
          <select id="bma-item-select" class="bma-select"></select>
        </div>

        <!-- ==================== TAB 1: จัดซื้อ / ตรวจรับ (8 ขั้นตอน) ==================== -->
        <div id="bma-mode-purhire" style="display:${state.activeMode !== 'pay' ? 'flex' : 'none'};flex-direction:column;gap:9px;">
          <div class="bma-page-badge">
            <span id="bma-current-page-lbl">📍 ${page.title}</span>
          </div>

          <div class="bma-summary-card" id="bma-item-summary"></div>

          <div class="bma-approval-box" id="bma-approval-gate" style="display:none;">
            <div class="bma-approval-title" id="bma-approval-title">🔔 รออนุมัติก่อนบันทึก</div>
            <div class="bma-approval-desc" id="bma-approval-desc"></div>
            <button type="button" class="bma-btn bma-btn-approve" id="bma-btn-approve-save">✅ อนุมัติบันทึก</button>
            <button type="button" class="bma-btn" id="bma-btn-goto-next" style="display:none;"></button>
          </div>

          <div class="bma-field-group">
            <div class="bma-label"><span>รหัสอ้างอิงในระบบ MIS (ดึงอัตโนมัติ / แก้ไขได้)</span></div>
            <div class="bma-grid-3">
              <div>
                <div id="bma-pur-lbl" style="font-size:10.5px;color:#64748b;">รหัสจัดซื้อ (1-X-${fy})</div>
                <input type="text" id="bma-pur-no" class="bma-input" placeholder="เช่น 8" value="${state.purHireNo || ''}" />
              </div>
              <div>
                <div id="bma-po-lbl" style="font-size:10.5px;color:#64748b;">เลขใบสั่งซื้อ (11-X-${fy})</div>
                <input type="text" id="bma-po-no" class="bma-input" placeholder="เช่น 8" value="${state.poNo || ''}" />
              </div>
              <div>
                <div id="bma-rcv-lbl" style="font-size:10.5px;color:#64748b;">เลขใบตรวจรับ (X-${fy})</div>
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

          <label style="display:flex;align-items:center;gap:6px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:6px 9px;border-radius:7px;font-size:11.5px;font-weight:700;cursor:pointer;">
            <input type="checkbox" id="bma-autofill-toggle" ${state.autoFillOnLoad !== false ? 'checked' : ''} style="accent-color:#16a34a;width:15px;height:15px;" />
            <span>กรอกอัตโนมัติทันทีเมื่อเปิดหน้า (รอคนกดบันทึก)</span>
          </label>

          <button type="button" class="bma-btn bma-btn-primary" id="bma-btn-autofill">
            ⚡ กรอกซ้ำอีกครั้ง (Auto-Fill)
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
        </div>

        <!-- ==================== TAB 2: เบิกจ่าย MIS2 (FRM_PAY_DOC) ==================== -->
        <div id="bma-mode-pay" style="display:${state.activeMode === 'pay' ? 'flex' : 'none'};flex-direction:column;gap:8px;">
          <div id="bma-bridge-bar" class="bma-bridge-bar offline">
            <div id="bma-bridge-status-text">กำลังตรวจสอบตัวช่วย Oracle Forms...</div>
            <div class="bma-bridge-actions">
              <button type="button" class="bma-mini-btn" id="bma-bridge-open-ie" title="เปิดหน้าเว็บ MIS2 ใน Internet Explorer">🌐 เปิด MIS2 (IE)</button>
              <button type="button" class="bma-mini-btn" id="bma-bridge-pick" title="เลือกหน้าต่าง Oracle Forms">🪟 เลือกหน้าต่าง</button>
              <button type="button" class="bma-mini-btn" id="bma-bridge-calib" title="ตั้งพิกัดหน้าจอ Oracle Forms (F8)">🎯 ตั้งพิกัด</button>
            </div>
            <button type="button" class="bma-mini-btn" id="bma-bridge-open-float" style="width:100%;background:#0f766e;color:#ffffff;border-color:#0f766e;padding:5px;">📌 เปิดแผงลอยเบิกจ่าย (ลอยทับหน้าต่าง Oracle Forms)</button>
          </div>

          <div id="bma-pay-dup-alert" class="bma-dup-alert" style="display:none;font-size:11.5px;padding:6px 8px;"></div>
          <div id="bma-pay-item-brief" class="bma-summary-card" style="padding:6px 8px;font-size:11.5px;"></div>

          <div class="bma-subtabs">
            <button type="button" id="bma-pay-subbtn-1" class="bma-subtab ${state.paySubTab === '1' ? 'active' : ''}">1. ใบตรวจรับ</button>
            <button type="button" id="bma-pay-subbtn-2" class="bma-subtab ${state.paySubTab === '2' ? 'active' : ''}">2. ผู้รับเงิน</button>
            <button type="button" id="bma-pay-subbtn-3" class="bma-subtab ${state.paySubTab === '3' ? 'active' : ''}">3. รายละเอียด</button>
          </div>

          <!-- Pay Sub-tab 1 -->
          <div id="bma-pay-pane-1" style="display:${state.paySubTab === '1' ? 'flex' : 'none'};flex-direction:column;gap:7px;">
            <div class="bma-grid-2">
              <div class="bma-field-group">
                <div class="bma-label"><span>เลขที่ใบตรวจรับ</span></div>
                <div class="bma-input-row">
                  <input type="text" id="bma-pay-rcvno" class="bma-input" placeholder="เช่น 54" />
                  <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-rcvno" title="คัดลอก/วาง">📋</button>
                </div>
              </div>
              <div class="bma-field-group">
                <div class="bma-label"><span>ปีงบประมาณ</span></div>
                <div class="bma-input-row">
                  <input type="text" id="bma-pay-rcvyr" class="bma-input" value="${fy}" />
                  <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-rcvyr" title="คัดลอก/วาง">📋</button>
                </div>
              </div>
            </div>

            <div class="bma-grid-2">
              <div class="bma-field-group">
                <div class="bma-label"><span>ภาษีมูลค่าเพิ่ม (7%)</span></div>
                <div class="bma-input-row">
                  <input type="text" id="bma-pay-vat" class="bma-input" />
                  <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-vat" title="คัดลอก/วาง">📋</button>
                </div>
              </div>
              <div class="bma-field-group">
                <div class="bma-label"><span>หักภาษีเงินได้ (1%)</span></div>
                <div class="bma-input-row">
                  <input type="text" id="bma-pay-wht" class="bma-input" />
                  <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-wht" title="คัดลอก/วาง">📋</button>
                </div>
              </div>
            </div>

            <div id="bma-pay-tax-badge" class="bma-tax-box">สุทธิที่จ่าย: -</div>

            <button type="button" class="bma-btn bma-btn-teal" id="bma-pay-run-1">⚡ ขั้น 1: กรอกใบตรวจรับ + กดแว่นขยาย 🔍</button>
            <button type="button" class="bma-btn bma-btn-teal" id="bma-pay-run-15" style="background:#0e7490;border-color:#0e7490;">⚡ ขั้น 1.5: รายละเอียด ➔ ติ๊กงบ ➔ ตกลง</button>
            <button type="button" class="bma-btn bma-btn-teal" id="bma-pay-run-16" style="background:#0369a1;border-color:#0369a1;">⚡ ขั้น 1.6: กรอก VAT 7% + หักภาษี 1%</button>
          </div>

          <!-- Pay Sub-tab 2 -->
          <div id="bma-pay-pane-2" style="display:${state.paySubTab === '2' ? 'flex' : 'none'};flex-direction:column;gap:6px;">
            <div class="bma-field-group">
              <div class="bma-label"><span>ค้นหาบริษัท (ทะเบียนบริษัท EGP+MIS)</span></div>
              <input type="text" id="bma-pay-vendor-search" class="bma-input" placeholder="พิมพ์ชื่อบริษัท / ธนาคาร / เลขบัญชี..." />
              <select id="bma-pay-vendor-select" class="bma-select"></select>
            </div>
            <div id="bma-pay-bank-info" class="bma-bank-info">🏦 ธนาคาร: - | 📍 สาขา: -</div>

            <div class="bma-check-row">
              <label><input type="checkbox" id="bma-chk-payTo" ${checks.payTo !== false ? 'checked' : ''} /> จ่ายให้</label>
              <div class="bma-input-row" style="flex:1;">
                <input type="text" id="bma-pay-to" class="bma-input" />
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-to">📋</button>
              </div>
            </div>
            <div class="bma-check-row">
              <label><input type="checkbox" id="bma-chk-assignTo" ${checks.assignTo !== false ? 'checked' : ''} /> โดยมอบให้</label>
              <div class="bma-input-row" style="flex:1;">
                <input type="text" id="bma-pay-assign" class="bma-input" list="bma-assign-presets" />
                <datalist id="bma-assign-presets">
                  <option value="${ASSIGN_TO_PRESETS[0]}"></option>
                  <option value="${ASSIGN_TO_PRESETS[1]}"></option>
                </datalist>
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-assign">📋</button>
              </div>
            </div>
            <div class="bma-check-row">
              <label><input type="checkbox" id="bma-chk-bankCode" ${checks.bankCode !== false ? 'checked' : ''} /> รหัสธนาคาร</label>
              <div class="bma-input-row" style="flex:1;">
                <input type="text" id="bma-pay-bank" class="bma-input" placeholder="3 หลัก เช่น 004" />
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-bank">📋</button>
              </div>
            </div>
            <div class="bma-check-row">
              <label><input type="checkbox" id="bma-chk-branchCode" ${checks.branchCode !== false ? 'checked' : ''} /> รหัสสาขา</label>
              <div class="bma-input-row" style="flex:1;">
                <input type="text" id="bma-pay-branch" class="bma-input" placeholder="4 หลัก เช่น 0001" />
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-branch">📋</button>
              </div>
            </div>
            <div class="bma-check-row">
              <label><input type="checkbox" id="bma-chk-accountNo" ${checks.accountNo !== false ? 'checked' : ''} /> เลขที่บัญชี</label>
              <div class="bma-input-row" style="flex:1;">
                <input type="text" id="bma-pay-acct" class="bma-input" />
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-acct">📋</button>
              </div>
            </div>

            <button type="button" class="bma-btn bma-btn-teal" id="bma-pay-run-2">⚡ ขั้น 2: กรอกแท็บ 'ผู้รับเงิน'</button>
          </div>

          <!-- Pay Sub-tab 3 -->
          <div id="bma-pay-pane-3" style="display:${state.paySubTab === '3' ? 'flex' : 'none'};flex-direction:column;gap:7px;">
            <div class="bma-field-group">
              <div class="bma-label"><span>ชื่อผู้ขอเบิก</span></div>
              <div class="bma-input-row">
                <input type="text" id="bma-pay-requester" class="bma-input" value="${state.defaultRequester || 'นางอรชุมา หุตะโกวิท'}" />
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-requester">📋</button>
              </div>
            </div>
            <div class="bma-field-group">
              <div class="bma-label">
                <span>วันที่เบิก (พ.ศ.)</span>
                <span style="display:flex;gap:4px;">
                  <button type="button" class="bma-mini-btn" id="bma-pay-dt-today" style="padding:1px 6px;">วันนี้</button>
                  <button type="button" class="bma-mini-btn" id="bma-pay-dt-rcv" style="padding:1px 6px;">วันตรวจรับ</button>
                </span>
              </div>
              <div class="bma-input-row">
                <input type="text" id="bma-pay-date" class="bma-input" value="${getTodayThaiSlash()}" />
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-date">📋</button>
              </div>
            </div>
            <div class="bma-field-group">
              <div class="bma-label"><span>คำอธิบายรายการเบิก (MISS Col J)</span></div>
              <div class="bma-input-row" style="align-items:flex-start;">
                <textarea id="bma-pay-desc" class="bma-textarea"></textarea>
                <button type="button" class="bma-copy-btn" data-copy-from="bma-pay-desc" data-copy-multi="1">📋</button>
              </div>
            </div>

            <button type="button" class="bma-btn bma-btn-teal" id="bma-pay-run-3">⚡ ขั้น 3: กรอกแท็บ 'รายละเอียดเงินเบิกจ่าย'</button>
            <div class="bma-safety-banner">🛑 โหมดปลอดภัย: หยุดก่อนบันทึกทุกครั้ง (คนตรวจและกด 💾 เอง) | กด ESC หยุดทันที</div>
          </div>

          <div class="bma-field-group" style="border-top:1px solid #e2e8f0;padding-top:7px;">
            <div class="bma-label"><span>บันทึกเลขที่ใบขอเบิกกลับลงชีต MISS (คอลัมน์ H)</span></div>
            <div class="bma-input-row">
              <input type="text" id="bma-pay-docno" class="bma-input" placeholder="เช่น 123/${fy}" />
              <button type="button" class="bma-btn bma-btn-green" id="bma-pay-save-doc" style="width:auto;padding:6px 10px;font-size:11px;white-space:nowrap;">💾 บันทึกลง MISS${fy}</button>
            </div>
          </div>
        </div>

        <div id="bma-status-bar" class="bma-status-bar">พร้อมใช้งาน • กรอกอัตโนมัติและรอคนกดบันทึกทุกครั้ง</div>
        <div style="text-align:center;font-size:10.5px;color:#64748b;font-weight:700;letter-spacing:0.02em;padding-top:2px;">
          ผู้พัฒนา: <span style="color:#1d4ed8;">ARISSARA.K</span> • กลุ่มงานเภสัชกรรม รพจ.
        </div>
      </div>
    `;

    document.body.appendChild(panelEl);
    renderFiscalYearDropdown();
    renderPayVendorOptions();

    // ผูก Event ปุ่มต่างๆ
    panelEl.querySelector('#bma-btn-min').addEventListener('click', () => {
      state.minimized = !state.minimized;
      panelEl.classList.toggle('minimized', state.minimized);
      panelEl.querySelector('#bma-btn-min').textContent = state.minimized ? '➕' : '➖';
      saveState();
    });

    panelEl.querySelector('#bma-btn-reload').addEventListener('click', () => {
      fetchSheetsData();
      if (state.activeMode === 'pay') pollBridgeStatus(true);
    });

    panelEl.querySelector('#bma-tab-btn-purhire').addEventListener('click', () => switchUnifiedMode('purhire'));
    panelEl.querySelector('#bma-tab-btn-pay').addEventListener('click', () => switchUnifiedMode('pay'));

    panelEl.querySelector('#bma-pay-subbtn-1').addEventListener('click', () => switchPaySubTab('1'));
    panelEl.querySelector('#bma-pay-subbtn-2').addEventListener('click', () => switchPaySubTab('2'));
    panelEl.querySelector('#bma-pay-subbtn-3').addEventListener('click', () => switchPaySubTab('3'));

    panelEl.querySelector('#bma-btn-approve-save').addEventListener('click', () => handleApproveSaveAndNext());

    // Event สำหรับปุ่มตัวช่วย Oracle Forms Bridge
    panelEl.querySelector('#bma-bridge-open-ie').addEventListener('click', () => {
      if (bridgeStatus.connected) {
        sendBridgeRequest('/open-mis2-ie', 'POST', { url: 'http://bmasso.bma.go.th/MIS2DirectLogins/index2.jsp' }, 10000, () => {
          setStatus('🌐 เปิดหน้า MIS2 ใน Internet Explorer แล้ว', 'ok');
        });
      } else {
        window.open('http://bmasso.bma.go.th/MIS2DirectLogins/index2.jsp', '_blank');
      }
    });

    panelEl.querySelector('#bma-bridge-open-float').addEventListener('click', () => {
      if (!bridgeStatus.connected) {
        alert('กรุณาดับเบิลคลิกเปิด START_ORACLE_BRIDGE.bat ก่อนครับ (เมื่อเปิดแล้ว แผงลอยจะเด้งทับหน้าต่าง Oracle Forms อัตโนมัติ)');
        pollBridgeStatus(false);
        return;
      }
      sendBridgeRequest('/open-floating-pay', 'POST', {}, 10000, (res) => {
        if (res && res.ok && res.data && res.data.ok) {
          setStatus('📌 เปิดแผงลอยเบิกจ่ายทับหน้าต่าง Oracle Forms แล้ว', 'ok');
        } else {
          setStatus('⚠️ ไม่พบไฟล์ mis2_pay_autofill.ps1 (กด UPDATE_FROM_GITHUB.bat)', 'err');
        }
      });
    });

    panelEl.querySelector('#bma-bridge-pick').addEventListener('click', () => {
      if (!bridgeStatus.connected) {
        pollBridgeStatus(false);
        return;
      }
      setStatus('🪟 กำลังเปิดหน้าต่างเลือก Oracle Forms...', '');
      sendBridgeRequest('/pick-window', 'POST', {}, 300000, () => pollBridgeStatus(false));
    });

    panelEl.querySelector('#bma-bridge-calib').addEventListener('click', () => {
      if (!bridgeStatus.connected) {
        alert('กรุณาดับเบิลคลิกเปิด START_ORACLE_BRIDGE.bat ก่อนกดตั้งพิกัดครับ');
        pollBridgeStatus(false);
        return;
      }
      setStatus('🎯 กำลังเปิดหน้าต่างตั้งพิกัด Oracle Forms (กด F8)...', '');
      sendBridgeRequest('/calibrate', 'POST', {}, 300000, () => pollBridgeStatus(false));
    });

    panelEl.querySelector('#bma-pay-run-1').addEventListener('click', () => runOracleBridgeStep('1'));
    panelEl.querySelector('#bma-pay-run-15').addEventListener('click', () => runOracleBridgeStep('1.5'));
    panelEl.querySelector('#bma-pay-run-16').addEventListener('click', () => runOracleBridgeStep('1.6'));
    panelEl.querySelector('#bma-pay-run-2').addEventListener('click', () => runOracleBridgeStep('2'));
    panelEl.querySelector('#bma-pay-run-3').addEventListener('click', () => runOracleBridgeStep('3'));
    panelEl.querySelector('#bma-pay-save-doc').addEventListener('click', () => savePayDocToMiss());

    panelEl.querySelectorAll('.bma-copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const srcId = btn.getAttribute('data-copy-from');
        const isMulti = btn.getAttribute('data-copy-multi') === '1';
        const el = panelEl.querySelector('#' + srcId);
        handleQuickCopyOrPaste(el ? el.value : '', isMulti, btn);
      });
    });

    panelEl.querySelector('#bma-pay-vendor-search').addEventListener('input', () => renderPayVendorOptions());
    panelEl.querySelector('#bma-pay-vendor-select').addEventListener('change', (e) => {
      const comp = e.target.value;
      const v = (state.vendors || []).find((x) => x.company === comp);
      if (v) applyVendorToPayFields(v);
    });

    ['payTo', 'assignTo', 'bankCode', 'branchCode', 'accountNo'].forEach((k) => {
      const chk = panelEl.querySelector('#bma-chk-' + k);
      if (chk) {
        chk.addEventListener('change', () => {
          state.payChecks = state.payChecks || {};
          state.payChecks[k] = chk.checked;
          saveState();
        });
      }
    });

    panelEl.querySelector('#bma-pay-assign').addEventListener('change', (e) => {
      if (!isItemAidsBudget(getSelectedItem())) {
        state.defaultAssignTo = e.target.value.trim() || ASSIGN_TO_PRESETS[0];
        saveState();
      }
    });

    panelEl.querySelector('#bma-pay-requester').addEventListener('change', (e) => {
      state.defaultRequester = e.target.value.trim() || 'นางอรชุมา หุตะโกวิท';
      saveState();
    });

    panelEl.querySelector('#bma-pay-dt-today').addEventListener('click', () => {
      panelEl.querySelector('#bma-pay-date').value = getTodayThaiSlash();
    });

    panelEl.querySelector('#bma-pay-dt-rcv').addEventListener('click', () => {
      const it = getSelectedItem();
      if (it && it.rcvDate) {
        panelEl.querySelector('#bma-pay-date').value = it.rcvDate;
      } else {
        setStatus('⚠️ รายการนี้ไม่มีวันที่ตรวจรับใน Sheet', 'err');
      }
    });

    // Event สำหรับเปลี่ยนปีงบประมาณ และเพิ่มปีงบประมาณ + เปลี่ยนไฟล์ปลายทาง (MISSxx / Auto Crat-EGPxx)
    panelEl.querySelector('#bma-fy-select').addEventListener('change', (e) => {
      state.fiscalYear = String(e.target.value || '70').trim();
      saveState();
      renderFiscalYearDropdown();
      fetchSheetsData();
      if (state.autoFillOnLoad !== false && !isMis2PortalHost() && state.activeMode !== 'pay') {
        lastAutoFillSig = '';
        triggerSmartAutoFill();
      }
    });

    panelEl.querySelector('#bma-btn-toggle-fy-cfg').addEventListener('click', () => {
      state.showYearSettings = !state.showYearSettings;
      const box = panelEl.querySelector('#bma-fy-config-box');
      if (box) box.style.display = state.showYearSettings ? 'block' : 'none';
      renderFiscalYearDropdown();
      saveState();
    });

    panelEl.querySelector('#bma-btn-add-next-fy').addEventListener('click', () => {
      const years = Object.keys(state.fiscalYears || {}).map((y) => parseInt(y, 10) || 70);
      const maxYr = years.length > 0 ? Math.max.apply(null, years) : 70;
      const nextYr = String(maxYr + 1);
      const fyInput = panelEl.querySelector('#bma-cfg-fy');
      const acInput = panelEl.querySelector('#bma-cfg-autocrat');
      const missInput = panelEl.querySelector('#bma-cfg-miss');
      if (fyInput) fyInput.value = nextYr;
      if (acInput) acInput.value = (state.fiscalYears[nextYr] && state.fiscalYears[nextYr].autocratSheetId) || '';
      if (missInput) missInput.value = (state.fiscalYears[nextYr] && state.fiscalYears[nextYr].missSheetId) || '';
      setStatus(`📅 เตรียมสร้างปีงบประมาณ ${nextYr} • กรุณาวางลิงก์ไฟล์ Auto Crat-EGP${nextYr} และ MISS${nextYr} แล้วกดบันทึก`, '');
    });

    panelEl.querySelector('#bma-btn-save-fy').addEventListener('click', () => {
      const rawFy = (panelEl.querySelector('#bma-cfg-fy').value || '').replace(/\D/g, '').trim();
      const fy = rawFy.length === 4 && rawFy.startsWith('25') ? rawFy.slice(2) : (rawFy || '70');
      const rawAc = (panelEl.querySelector('#bma-cfg-autocrat').value || '').trim();
      const rawMiss = (panelEl.querySelector('#bma-cfg-miss').value || '').trim();
      const acId = extractSheetId(rawAc) || DEFAULT_FISCAL_YEARS['70'].autocratSheetId;
      const missId = extractSheetId(rawMiss) || DEFAULT_FISCAL_YEARS['70'].missSheetId;

      if (!state.fiscalYears || typeof state.fiscalYears !== 'object') {
        state.fiscalYears = JSON.parse(JSON.stringify(DEFAULT_FISCAL_YEARS));
      }
      state.fiscalYears[fy] = {
        label: `ปีงบ ${fy} (MISS${fy} / Auto Crat-EGP${fy})`,
        autocratSheetId: acId,
        missSheetId: missId
      };
      state.fiscalYear = fy;
      state.showYearSettings = false;
      const box = panelEl.querySelector('#bma-fy-config-box');
      if (box) box.style.display = 'none';
      saveState();
      renderFiscalYearDropdown();
      fetchSheetsData();
    });

    panelEl.querySelector('#bma-btn-del-fy').addEventListener('click', () => {
      const curFy = String(state.fiscalYear || '70');
      if (curFy === '70') {
        alert('ไม่สามารถลบปีงบประมาณเริ่มต้น (ปีงบ 70) ได้ครับ');
        return;
      }
      delete state.fiscalYears[curFy];
      state.fiscalYear = '70';
      saveState();
      renderFiscalYearDropdown();
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
      if (state.autoFillOnLoad !== false && !isMis2PortalHost()) {
        lastAutoFillSig = '';
        triggerSmartAutoFill();
      }
    });

    panelEl.querySelector('#bma-po-no').addEventListener('input', (e) => {
      state.poNo = e.target.value.trim();
      saveState();
      if (state.autoFillOnLoad !== false && !isMis2PortalHost()) {
        lastAutoFillSig = '';
        triggerSmartAutoFill();
      }
    });

    panelEl.querySelector('#bma-rcv-no').addEventListener('input', (e) => {
      state.rcvNo = e.target.value.trim();
      const payRcv = panelEl.querySelector('#bma-pay-rcvno');
      if (payRcv) payRcv.value = state.rcvNo;
      saveState();
      if (state.autoFillOnLoad !== false && !isMis2PortalHost()) {
        lastAutoFillSig = '';
        triggerSmartAutoFill();
      }
    });

    panelEl.querySelector('#bma-inv-no').addEventListener('input', (e) => {
      state.invoiceNo = e.target.value.trim();
      saveState();
      if (state.autoFillOnLoad !== false && !isMis2PortalHost()) {
        lastAutoFillSig = '';
        triggerSmartAutoFill();
      }
    });

    panelEl.querySelector('#bma-committee-select').addEventListener('change', (e) => {
      state.committeeSet = e.target.value;
      saveState();
      if (state.autoFillOnLoad !== false && !isMis2PortalHost()) {
        lastAutoFillSig = '';
        triggerSmartAutoFill();
      }
    });

    panelEl.querySelector('#bma-autofill-toggle').addEventListener('change', (e) => {
      state.autoFillOnLoad = e.target.checked;
      saveState();
      if (state.autoFillOnLoad && !isMis2PortalHost()) {
        lastAutoFillSig = '';
        triggerSmartAutoFill();
      }
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
        highlightApprovalButtons();
        setStatus(filled > 0 ? `✓ กรอกขั้นตอนที่ ${st} สำเร็จ (${filled} จุด) • รอคุณกด [บันทึก]` : `⚠️ ไม่พบช่องของขั้นตอนที่ ${st} ในหน้านี้`, filled > 0 ? 'ok' : 'err');
      });
    });

    renderItemOptions();
    tryCaptureGeneratedCodes();
    pollBridgeStatus(true);

    // ถ้ายังไม่มีข้อมูลใน Cache หรือยังไม่มีทะเบียนบริษัท ให้ดึงจาก Google Sheets อัตโนมัติ
    if (!state.items || state.items.length === 0 || !state.vendors || state.vendors.length === 0) {
      fetchSheetsData();
    } else if (state.autoFillOnLoad !== false && !isMis2PortalHost() && state.activeMode !== 'pay') {
      setTimeout(triggerSmartAutoFill, 250);
    }
  }

  let lastAutoFillSig = '';

  function computePageDomSignature() {
    const p = detectCurrentPage();
    let inputCount = 0;
    let tableRows = 0;
    getTargetDocs().forEach((d) => {
      try {
        inputCount += d.querySelectorAll('input, select, textarea').length;
        tableRows += d.querySelectorAll('tr').length;
      } catch (e) {}
    });
    return [
      p.id,
      state.selectedCode,
      state.committeeSet,
      state.purHireNo,
      state.poNo,
      state.rcvNo,
      state.invoiceNo,
      inputCount,
      tableRows
    ].join('|');
  }

  function triggerSmartAutoFill() {
    if (state.autoFillOnLoad === false) return;
    if (isMis2PortalHost() || state.activeMode === 'pay') return;
    const sig = computePageDomSignature();
    if (sig === lastAutoFillSig) return;
    lastAutoFillSig = sig;
    autoFillCurrentPage(undefined, true);
  }

  // โหลด State แล้วสร้างแผงควบคุม
  let bridgePollCounter = 0;
  loadState(() => {
    if (isMis2PortalHost()) {
      state.activeMode = 'pay';
    }
    buildPanel();
    updateApprovalBoxUI();
    // ตรวจจับการเปลี่ยนหน้า/เปิด Popup/ดึงตารางใหม่ แล้วกรอกอัตโนมัติทันทีโดยไม่ต้องกดปุ่ม (รอคนอนุมัติก่อนบันทึก)
    setInterval(() => {
      bridgePollCounter++;
      if (state.activeMode === 'pay' && bridgePollCounter % 4 === 0) {
        pollBridgeStatus(true);
      }
      if (isMis2PortalHost()) return;

      tryCaptureGeneratedCodes();
      if (panelEl) {
        const lbl = panelEl.querySelector('#bma-current-page-lbl');
        if (lbl) {
          const p = detectCurrentPage();
          lbl.textContent = '📍 ' + p.title;
        }
        updateButtonsLockState(getSelectedItem());
        updateApprovalBoxUI();
      }
      // หากผู้ใช้อนุมัติให้บันทึกแล้ว และหน้าเว็บขึ้น "บันทึกเรียบร้อย" แล้ว ให้ดูดรหัสล่าสุดแล้วเปิดหน้าขั้นตอนถัดไปอัตโนมัติ
      if (state.pendingAutoNextStep && isPageShowingSavedBanner()) {
        const nextSt = state.pendingAutoNextStep;
        state.pendingAutoNextStep = 0;
        saveState();
        tryCaptureGeneratedCodes();
        setStatus(`✓ บันทึกสำเร็จ! กำลังเปิดไปขั้นตอนที่ ${nextSt} อัตโนมัติ...`, 'ok');
        setTimeout(() => {
          navigateToMisStep(nextSt);
        }, 800);
        return;
      }
      triggerSmartAutoFill();
    }, 1000);
  });
})();
