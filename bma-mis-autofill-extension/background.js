/**
 * Background Service Worker สำหรับดึงข้อมูลจาก Google Sheets
 * รองรับทั้ง:
 * 1. ดึงจาก Google Apps Script Web App URL (JSON)
 * 2. ดึงโดยตรงจาก Google Sheets URL (gviz CSV/JSON) โดยใช้คุกกี้ Google ที่ล็อกอินไว้ใน Opera
 */

const DEFAULT_CONFIG = {
  autocratSheetId: '1qFqdTqcP_d_nNLAX3AL0Gq21s2zjffXW2Czo3Jv1F_Y',
  autocratGid: '0',
  miss70SheetId: '1tTaFrjVCPm8IrjJAg6e0Y27jIqoedLsmJz92py1O0lU',
  miss70Gid: '0',
  gasWebAppUrl: ''
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

function parseThaiDateToSlash(val) {
  if (!val) return '';
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

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\r') {
        // skip
      } else if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

async function fetchSheetCsv(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid || '0'}`;
  const resp = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`ดึงข้อมูล Google Sheet ไม่สำเร็จ (HTTP ${resp.status}) กรุณาเปิดลิงก์ Google Sheet ใน Opera ค้างไว้ 1 แท็บ หรือใส่ลิงก์ Apps Script Web App`);
  }
  const text = await resp.text();
  if (text.trim().startsWith('<!DOCTYPE html') || text.includes('ServiceLogin')) {
    throw new Error('ยังไม่ได้ล็อกอิน Google ใน Opera กรุณาเปิด Google Sheets ใน Opera ก่อน หรือใช้ Apps Script Web App URL');
  }
  return parseCsvRows(text);
}

async function fetchAllFromGoogleSheets(cfg) {
  const settings = Object.assign({}, DEFAULT_CONFIG, cfg || {});

  // ถ้าระบุ Google Apps Script Web App URL ไว้ ให้ดึงผ่าน Web App ก่อน
  if (settings.gasWebAppUrl && settings.gasWebAppUrl.startsWith('https://script.google.com/')) {
    const r = await fetch(settings.gasWebAppUrl, { cache: 'no-store' });
    const data = await r.json();
    if (data && data.ok && Array.isArray(data.items)) {
      return data.items;
    }
  }

  // ดึงตรงจาก Google Sheets (Auto Crat-EGP70 และ MISS70)
  const [acRows, missRows] = await Promise.all([
    fetchSheetCsv(settings.autocratSheetId, settings.autocratGid),
    fetchSheetCsv(settings.miss70SheetId, settings.miss70Gid).catch(() => [])
  ]);

  const missMap = {};
  for (let r = 3; r < missRows.length; r++) {
    const row = missRows[r];
    if (!row) continue;
    const purHireNo = String(row[1] || '').trim();
    const poNo = String(row[2] || '').trim();
    const rcvNo = String(row[3] || '').trim();
    const amount = parseAmount(row[4]);
    const vendorShort = String(row[6] || '').trim();
    const orderSeq = String(row[8] || '').trim();
    const subject = String(row[9] || '').trim();
    if (orderSeq && (subject || purHireNo || amount > 0)) {
      missMap[orderSeq + 'งบ'] = {
        missRowIndex: r + 1,
        purHireNo,
        poNo,
        rcvNo,
        orderSeq,
        subjectArabic: subject,
        vendorShort,
        amount
      };
    }
  }

  const items = [];
  for (let r = 1; r < acRows.length; r++) {
    const row = acRows[r];
    if (!row) continue;
    const code = String(row[1] || '').trim();
    const rawSubject = String(row[2] || '').trim();
    // กรองเฉพาะคอลัมน์ B (เลข ซ.) ที่ลงท้ายด้วย "งบ" หรือ "งบเอดส์" / "เอดส์" / "AIDs" เท่านั้น
    if (!code || !/(งบ|งบเอดส์|เอดส์|aids)$/i.test(code)) continue;

    const subjectArabic = thaiToArabic(rawSubject).replace(/\s+/g, ' ').trim();
    const itemCount = thaiToArabic(String(row[3] || '1').trim());
    const missInfo = missMap[code] || {};
    const acAmountNum = parseAmount(row[7] || row[5]);
    const amountNum = (missInfo.amount !== undefined && missInfo.amount > 0) ? missInfo.amount : acAmountNum;
    const amountFormatted = amountNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const vendorName = String(row[9] || '').trim();
    const vendorTaxId = String(row[10] || '').trim();
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

    items.push({
      rowIndex: r + 1,
      code,
      projectNo: String(row[0] || '').trim(),
      subject: missInfo.subjectArabic || subjectArabic,
      rawSubject,
      itemCount,
      amount: amountNum,
      amountFormatted,
      vendorName,
      vendorTaxId,
      budgetType,
      isBmaBudget,
      isAidsBudget,
      isGpo,
      deliveryDays,
      agreeDate,
      quoteDate,
      poSignDate,
      rcvDate,
      contractStartDate,
      contractEndDate,
      purHireNo: missInfo.purHireNo || '',
      poNo: missInfo.poNo || '',
      rcvNo: missInfo.rcvNo || '',
      missRowIndex: missInfo.missRowIndex || null
    });
  }

  return items;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'FETCH_SHEETS_DATA') {
    fetchAllFromGoogleSheets(msg.config)
      .then((items) => sendResponse({ ok: true, items }))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true; // async response
  }
});
