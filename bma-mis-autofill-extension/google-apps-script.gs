/**
 * Google Apps Script สำหรับเชื่อมต่อข้อมูล Google Sheets เข้ากับ Opera Extension (BMA MIS Auto-Filler)
 *
 * วิธีติดตั้ง:
 * 1. เปิดไฟล์ Google Sheet "Auto Crat-EGP70" (หรือชีตหลักของคุณ)
 * 2. ไปที่เมนู ส่วนขยาย (Extensions) -> Apps Script
 * 3. วางโค้ดนี้ลงไป แล้วกด บันทึก (Save)
 * 4. กดปุ่ม "ทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 * 5. เลือกประเภทเป็น "เว็บแอป" (Web app)
 *    - ดำเนินการในฐานะ (Execute as): "ฉัน" (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง (Who has access): "ทุกคน" (Anyone)
 * 6. คัดลอก URL ของเว็บแอป (ลงท้ายด้วย /exec) ไปวางในช่องตั้งค่าของ Opera Extension
 */

const CONFIG = {
  // Spreadsheet ID ของไฟล์ Auto Crat-EGP70
  AUTOCRAT_SHEET_ID: '1qFqdTqcP_d_nNLAX3AL0Gq21s2zjffXW2Czo3Jv1F_Y',
  AUTOCRAT_TAB_NAME: 'main',

  // Spreadsheet ID ของไฟล์ MISS70
  MISS70_SHEET_ID: '1tTaFrjVCPm8IrjJAg6e0Y27jIqoedLsmJz92py1O0lU',
  MISS70_TAB_NAME: 'ชีต1',

  // Spreadsheet ID ของไฟล์ EGP+MIS (ชีต ทะเบียนบริษัท: Col A บริษัท, B ธนาคาร, C สาขา, E MIs2, G ที่อยู่, H เลขผู้เสียภาษี)
  EGP_MIS_SHEET_ID: '1m0EdHfSe3M6JUBirvivwJW5GOnzKos9sUI-smRsrOvE',
  VENDORS_TAB_NAME: 'ทะเบียนบริษัท'
};

function thaiToArabic(str) {
  if (!str) return '';
  const th = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  let out = String(str);
  for (let i = 0; i < 10; i++) {
    out = out.split(th[i]).join(String(i));
  }
  return out;
}

function normalizeCompanyKey(name) {
  return thaiToArabic(String(name || ''))
    .replace(/บริษัท|ห้างหุ้นส่วนจำกัด|หจก\.?|จำกัด|\(มหาชน\)|\(ประเทศไทย\)|\.|,|-|\s+/gi, '')
    .toLowerCase();
}

function bankNameToCode(bankName) {
  const b = String(bankName || '').trim().toLowerCase();
  const rules = [
    ['กรุงเทพ', '002'],
    ['กสิกร', '004'],
    ['กรุงไทย', '006'],
    ['ทหารไทย', '011'],
    ['ทีเอ็มบี', '011'],
    ['ธนชาต', '011'],
    ['ไทยพาณิช', '014'],
    ['ไทยพานิช', '014'],
    ['ซิตี้', '017'],
    ['สแตนดาร์ด', '020'],
    ['ซีไอเอ็มบี', '022'],
    ['ยูโอบี', '024'],
    ['uob', '024'],
    ['กรุงศรี', '025'],
    ['ออมสิน', '030'],
    ['ฮ่องกง', '031'],
    ['hsbc', '031'],
    ['ดอยซ์', '032'],
    ['ธ.ก.ส', '034'],
    ['บีเอ็นพี', '045'],
    ['bnp', '045'],
    ['ทิสโก้', '067'],
    ['เกียรตินาคิน', '069'],
    ['แลนด์', '073']
  ];
  for (let i = 0; i < rules.length; i++) {
    if (b.indexOf(rules[i][0]) !== -1) return rules[i][1];
  }
  return '';
}

function parseThaiDateToSlash(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    const dd = String(val.getDate()).padStart(2, '0');
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    let yyyy = val.getFullYear();
    if (yyyy < 2400) yyyy += 543;
    return dd + '/' + mm + '/' + yyyy;
  }
  const s = thaiToArabic(String(val).trim());
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const dd = slashMatch[1].padStart(2, '0');
    const mm = slashMatch[2].padStart(2, '0');
    let yyyy = parseInt(slashMatch[3], 10);
    if (yyyy < 2400) yyyy += 543;
    return dd + '/' + mm + '/' + yyyy;
  }
  const months = {
    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
    'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
    'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12',
    'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
    'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
    'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
  };
  for (const mName in months) {
    if (s.indexOf(mName) !== -1) {
      const parts = s.replace(/\s+/g, ' ').split(' ');
      if (parts.length >= 3) {
        const dd = parts[0].replace(/\D/g, '').padStart(2, '0');
        const mm = months[mName];
        let yyyy = parseInt(parts[parts.length - 1].replace(/\D/g, ''), 10);
        if (yyyy < 2400) yyyy += 543;
        return dd + '/' + mm + '/' + yyyy;
      }
    }
  }
  return s;
}

function parseAmount(val) {
  if (typeof val === 'number') return val;
  const cleaned = thaiToArabic(String(val || '')).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getVendorsRegistry() {
  const vendors = [];
  const byTaxId = {};
  const byNameKey = {};
  try {
    const ss = SpreadsheetApp.openById(CONFIG.EGP_MIS_SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.VENDORS_TAB_NAME);
    if (!sheet) return { vendors: vendors, byTaxId: byTaxId, byNameKey: byNameKey };
    const values = sheet.getDataRange().getDisplayValues();
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const company = String(row[0] || '').replace(/\s+/g, ' ').trim(); // Col A: บริษัท
      if (!company) continue;
      const bank = String(row[1] || '').replace(/\s+/g, ' ').trim();    // Col B: ธนาคาร
      const branch = String(row[2] || '').replace(/\s+/g, ' ').trim();  // Col C: สาขา
      const acctThai = String(row[3] || '').trim();                     // Col D: เลขที่บัญชี (ไทย)
      const acctMis2 = thaiToArabic(String(row[4] || '').trim() || acctThai).trim(); // Col E: MIs2
      const address = String(row[6] || '').replace(/\s+/g, ' ').trim(); // Col G: ที่อยู่
      let taxId = thaiToArabic(String(row[7] || '')).replace(/\D/g, ''); // Col H: เลขผู้เสียภาษี
      if (taxId === '000000') taxId = '';

      const profile = {
        company: company,
        bank: bank,
        bankCode: bankNameToCode(bank),
        branch: branch,
        accountNo: acctMis2,
        address: address,
        taxId: taxId
      };
      vendors.push(profile);
      if (taxId && !byTaxId[taxId]) byTaxId[taxId] = profile;
      const key = normalizeCompanyKey(company);
      if (key && !byNameKey[key]) byNameKey[key] = profile;
    }
  } catch (e) {}
  return { vendors: vendors, byTaxId: byTaxId, byNameKey: byNameKey };
}

function doGet(e) {
  try {
    const vendorReg = getVendorsRegistry();
    const result = getCombinedMisData(vendorReg);
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        items: result,
        vendors: vendorReg.vendors,
        updatedAt: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message || String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'updateMiss70Codes') {
      const res = updateMiss70Codes(body);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, result: res }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (body.action === 'updatePayDocNo') {
      const res = updatePayDocNo(body);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, result: res }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message || String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getCombinedMisData(vendorReg) {
  vendorReg = vendorReg || { vendors: [], byTaxId: {}, byNameKey: {} };

  // 1. อ่านรหัสจัดซื้อ / เลขใบสั่งซื้อ / เลขใบตรวจรับ / เลขที่ใบขอเบิก จากชีต MISS70
  const missMap = {};
  try {
    const missSS = SpreadsheetApp.openById(CONFIG.MISS70_SHEET_ID);
    const missSheet = missSS.getSheetByName(CONFIG.MISS70_TAB_NAME) || missSS.getSheets()[0];
    const missValues = missSheet.getDataRange().getDisplayValues();
    for (let r = 3; r < missValues.length; r++) {
      const row = missValues[r];
      const purHireNo = String(row[1] || '').trim();
      const poNo = String(row[2] || '').trim();
      const rcvNo = String(row[3] || '').trim();
      const amount = parseAmount(row[4]);
      const vendorShort = String(row[6] || '').trim();
      const payDocNo = String(row[7] || '').trim();  // Col H: เลขที่ใบขอเบิก.../70
      const orderSeq = String(row[8] || '').trim();  // Col I: ลำดับใบสั่งซื้อ (1, 2, 3...) ซึ่งตรงกับ 1งบ, 2งบ...
      const subject = thaiToArabic(String(row[9] || '').trim()).replace(/\s+/g, ' ').trim();
      if (orderSeq && (subject || purHireNo || amount > 0)) {
        missMap[orderSeq + 'งบ'] = {
          missRowIndex: r + 1,
          purHireNo: purHireNo,
          poNo: poNo,
          rcvNo: rcvNo,
          payDocNo: payDocNo,
          orderSeq: orderSeq,
          subjectArabic: subject,
          vendorShort: vendorShort,
          amount: amount
        };
      }
    }
  } catch (e) {}

  // 2. อ่านข้อมูลหลักจาก Auto Crat-EGP70 (แท็บ main)
  const acSS = SpreadsheetApp.openById(CONFIG.AUTOCRAT_SHEET_ID);
  const acSheet = acSS.getSheetByName(CONFIG.AUTOCRAT_TAB_NAME) || acSS.getSheets()[0];
  const acValues = acSheet.getDataRange().getDisplayValues();

  const items = [];
  for (let r = 1; r < acValues.length; r++) {
    const row = acValues[r];
    const code = String(row[1] || '').trim(); // เช่น 1งบ, 7งบ, 1งบเอดส์, 1AIDs
    const rawSubject = String(row[2] || '').trim();
    // กรองเฉพาะคอลัมน์ B (เลข ซ.) ที่ลงท้ายด้วย "งบ" หรือ "งบเอดส์" / "เอดส์" / "AIDs" เท่านั้น
    if (!code || !/(งบ|งบเอดส์|เอดส์|aids)$/i.test(code)) continue;

    const subjectArabic = thaiToArabic(rawSubject).replace(/\s+/g, ' ').trim();
    const itemCount = thaiToArabic(String(row[3] || '1').trim());
    const missInfo = missMap[code] || {};
    const acAmountNum = parseAmount(row[7] || row[5]);
    const amountNum = (missInfo.amount !== undefined && missInfo.amount > 0) ? missInfo.amount : acAmountNum;
    const amountFormatted = amountNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const vendorName = String(row[9] || '').replace(/\s+/g, ' ').trim();
    const vendorTaxId = thaiToArabic(String(row[10] || '')).replace(/\D/g, '');
    const budgetType = String(row[11] || '').trim();

    const agreeDate = parseThaiDateToSlash(row[12]);
    const quoteDate = parseThaiDateToSlash(row[13]);
    const poSignDate = parseThaiDateToSlash(row[14]);
    const rcvDate = parseThaiDateToSlash(row[15]);
    const contractStartDate = parseThaiDateToSlash(row[16]) || rcvDate || poSignDate;
    const contractEndDate = parseThaiDateToSlash(row[17]);

    const isGpo = /องค์การเภสัชกรรม|GPO/i.test(vendorName);
    const isAidsBudget = /เอดส์|อุดหนุน/i.test(budgetType) || /(งบเอดส์|เอดส์|aids)$/i.test(code);
    const isBmaBudget = !isAidsBudget && (/งบประมาณรายจ่ายประจำปี/i.test(budgetType) || /งบ$/.test(code));
    const deliveryDays = (isGpo || isAidsBudget) ? '60' : '5';

    // จับคู่ข้อมูลบริษัท/ธนาคาร/สาขา/เลขบัญชี/ที่อยู่ จากแท็บ ทะเบียนบริษัท (EGP+MIS)
    let matchedVendor = (vendorTaxId && vendorReg.byTaxId[vendorTaxId]) || null;
    if (!matchedVendor && vendorName) {
      const nKey = normalizeCompanyKey(vendorName);
      matchedVendor = vendorReg.byNameKey[nKey] || null;
      if (!matchedVendor && nKey.length >= 4) {
        for (let v = 0; v < vendorReg.vendors.length; v++) {
          const vKey = normalizeCompanyKey(vendorReg.vendors[v].company);
          if (vKey && (vKey.indexOf(nKey) !== -1 || nKey.indexOf(vKey) !== -1)) {
            matchedVendor = vendorReg.vendors[v];
            break;
          }
        }
      }
    }

    items.push({
      rowIndex: r + 1,
      code: code,
      projectNo: String(row[0] || '').trim(),
      subject: missInfo.subjectArabic || subjectArabic,
      rawSubject: rawSubject,
      itemCount: itemCount,
      amount: amountNum,
      amountFormatted: amountFormatted,
      vendorName: vendorName,
      vendorTaxId: vendorTaxId,
      vendorProfile: matchedVendor,
      budgetType: budgetType,
      isBmaBudget: isBmaBudget,
      isAidsBudget: isAidsBudget,
      isGpo: isGpo,
      deliveryDays: deliveryDays,
      agreeDate: agreeDate,
      quoteDate: quoteDate,
      poSignDate: poSignDate,
      rcvDate: rcvDate,
      contractStartDate: contractStartDate,
      contractEndDate: contractEndDate,
      purHireNo: missInfo.purHireNo || '',
      poNo: missInfo.poNo || '',
      rcvNo: missInfo.rcvNo || '',
      payDocNo: missInfo.payDocNo || '',
      missRowIndex: missInfo.missRowIndex || null
    });
  }

  return items;
}

function updateMiss70Codes(payload) {
  const missSS = SpreadsheetApp.openById(CONFIG.MISS70_SHEET_ID);
  const missSheet = missSS.getSheetByName(CONFIG.MISS70_TAB_NAME) || missSS.getSheets()[0];
  const rowIndex = Number(payload.missRowIndex);
  if (!rowIndex || rowIndex < 4) {
    throw new Error('ไม่พบแถวในชีต MISS70 ที่ต้องการบันทึก');
  }
  if (payload.purHireNo !== undefined) {
    missSheet.getRange(rowIndex, 2).setValue(payload.purHireNo);
  }
  if (payload.poNo !== undefined) {
    missSheet.getRange(rowIndex, 3).setValue(payload.poNo);
  }
  if (payload.rcvNo !== undefined) {
    missSheet.getRange(rowIndex, 4).setValue(payload.rcvNo);
  }
  if (payload.payDocNo !== undefined) {
    missSheet.getRange(rowIndex, 8).setValue(payload.payDocNo);
  }
  return { updatedRow: rowIndex };
}

function updatePayDocNo(payload) {
  const missSS = SpreadsheetApp.openById(CONFIG.MISS70_SHEET_ID);
  const missSheet = missSS.getSheetByName(CONFIG.MISS70_TAB_NAME) || missSS.getSheets()[0];
  const rowIndex = Number(payload.missRowIndex);
  if (!rowIndex || rowIndex < 4) {
    throw new Error('ไม่พบแถวในชีต MISS70 ที่ต้องการบันทึกเลขที่ใบขอเบิก');
  }
  const val = String(payload.payDocNo || '').trim();
  missSheet.getRange(rowIndex, 8).setValue(val); // Col H: เลขที่ใบขอเบิก.../70
  return { updatedRow: rowIndex, payDocNo: val };
}
