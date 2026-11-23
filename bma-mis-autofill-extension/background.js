/**
 * Background Service Worker สำหรับดึงข้อมูลจาก Google Sheets
 * รองรับทั้ง:
 * 1. ดึงจาก Google Apps Script Web App URL (JSON)
 * 2. ดึงโดยตรงจาก Google Sheets URL (gviz / export CSV)
 * 3. มีข้อมูลตั้งต้น (SEED_ITEMS) ฝังไว้ในตัว เพื่อให้ใช้งานได้ทันทีแม้ไม่ได้ล็อกอิน Google ใน Opera
 */

const SEED_ITEMS = [
  {
    "rowIndex": 82,
    "code": "1งบ",
    "projectNo": "69119152003",
    "subject": "ยา BIOSULIN 30 : 70 (3ml x 5 cartridge)จำนวน 1,280 BOX",
    "rawSubject": "ยา BIOSULIN ๓๐ : ๗๐ (๓ml x ๕ cartridge)จำนวน ๑,๒๘๐ BOX",
    "itemCount": "1",
    "amount": 499200.0,
    "amountFormatted": "499,200.00",
    "vendorName": "บริษัท เบอร์์ลี่ ยุคเกอร์ จำกัด (มหาชน)",
    "vendorTaxId": "0107536000226",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "02/11/2569",
    "quoteDate": "03/11/2569",
    "poSignDate": "04/11/2569",
    "rcvDate": "06/11/2569",
    "contractStartDate": "05/11/2569",
    "contractEndDate": "09/11/2569",
    "purHireNo": "1",
    "poNo": "1",
    "rcvNo": "1",
    "missRowIndex": 4
  },
  {
    "rowIndex": 83,
    "code": "2งบ",
    "projectNo": "69119203607",
    "subject": "ยา GLANATEC Ophtalmic Solution 0.4% EYE-DROPS 5 mL จำนวน 500 กล่อง",
    "rawSubject": "ยา GLANATEC Ophtalmic Solution ๐.๔% EYE-DROPS ๕ mL จำนวน ๕๐๐ กล่อง",
    "itemCount": "1",
    "amount": 239680.0,
    "amountFormatted": "239,680.00",
    "vendorName": "บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด",
    "vendorTaxId": "0105523002118",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "04/11/2569",
    "quoteDate": "09/11/2569",
    "poSignDate": "10/11/2569",
    "rcvDate": "11/11/2569",
    "contractStartDate": "11/11/2569",
    "contractEndDate": "15/11/2569",
    "purHireNo": "3",
    "poNo": "3",
    "rcvNo": "2",
    "missRowIndex": 5
  },
  {
    "rowIndex": 84,
    "code": "3งบ",
    "projectNo": "69119203619",
    "subject": "ยาจำนวน 2 รายการ",
    "rawSubject": "ยาจำนวน ๒ รายการ",
    "itemCount": "2",
    "amount": 395600.4,
    "amountFormatted": "395,600.40",
    "vendorName": "บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด",
    "vendorTaxId": "0105523002118",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "06/11/2569",
    "quoteDate": "09/11/2569",
    "poSignDate": "10/11/2569",
    "rcvDate": "11/11/2569",
    "contractStartDate": "11/11/2569",
    "contractEndDate": "15/11/2569",
    "purHireNo": "4",
    "poNo": "4",
    "rcvNo": "3",
    "missRowIndex": 6
  },
  {
    "rowIndex": 85,
    "code": "4งบ",
    "projectNo": "69119203645",
    "subject": "ยา ENCAPON 200 MG.TAB 10x10s จำนวน 70 กล่อง",
    "rawSubject": "ยา ENCAPON ๒๐๐ MG.TAB ๑๐x๑๐s จำนวน ๗๐ กล่อง",
    "itemCount": "1",
    "amount": 67410.0,
    "amountFormatted": "67,410.00",
    "vendorName": "บริษัท เมดไลน์ จำกัด",
    "vendorTaxId": "0105532083648",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "06/11/2569",
    "quoteDate": "09/11/2569",
    "poSignDate": "10/11/2569",
    "rcvDate": "11/11/2569",
    "contractStartDate": "11/11/2569",
    "contractEndDate": "15/11/2569",
    "purHireNo": "5",
    "poNo": "5",
    "rcvNo": "4",
    "missRowIndex": 7
  },
  {
    "rowIndex": 86,
    "code": "5งบ",
    "projectNo": "69119203659",
    "subject": "ยาจำนวน 6 รายการ",
    "rawSubject": "ยาจำนวน ๖ รายการ",
    "itemCount": "6",
    "amount": 468094.8,
    "amountFormatted": "468,094.80",
    "vendorName": "บริษัท ซิลลิค ฟาร์มา จำกัด",
    "vendorTaxId": "0105539106911",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "06/11/2569",
    "quoteDate": "09/11/2569",
    "poSignDate": "10/11/2569",
    "rcvDate": "11/11/2569",
    "contractStartDate": "11/11/2569",
    "contractEndDate": "15/11/2569",
    "purHireNo": "6",
    "poNo": "6",
    "rcvNo": "5",
    "missRowIndex": 8
  },
  {
    "rowIndex": 149,
    "code": "6งบ",
    "projectNo": "69119391436",
    "subject": "ยาจำนวน 3 รายการ",
    "rawSubject": "ยาจำนวน ๓ รายการ",
    "itemCount": "3",
    "amount": 428000.0,
    "amountFormatted": "428,000.00",
    "vendorName": "บริษัท ซิลลิค ฟาร์มา จำกัด",
    "vendorTaxId": "0105539106911",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "11/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "7",
    "poNo": "7",
    "rcvNo": "7",
    "missRowIndex": 9
  },
  {
    "rowIndex": 150,
    "code": "7งบ",
    "projectNo": "69119391484",
    "subject": "ยา Mannitol 20% (100 mL) จำนวน 1,000 BOT",
    "rawSubject": "ยา Mannitol ๒๐% (๑๐๐ mL) จำนวน ๑,๐๐๐ BOT",
    "itemCount": "1",
    "amount": 50000.0,
    "amountFormatted": "50,000.00",
    "vendorName": "บริษัท เอ.เอ็น.บี. ลาบอราตอรี่ จำกัด",
    "vendorTaxId": "0105504000806",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "8",
    "poNo": "8",
    "rcvNo": "8",
    "missRowIndex": 10
  },
  {
    "rowIndex": 151,
    "code": "8งบ",
    "projectNo": "69119391490",
    "subject": "ยา D5W 1000 ml จำนวน 500 ขวด",
    "rawSubject": "ยา D๕W ๑๐๐๐ ml จำนวน ๕๐๐ ขวด",
    "itemCount": "1",
    "amount": 14500.0,
    "amountFormatted": "14,500.00",
    "vendorName": "บริษัท วี.แอนด์.วี. กรุงเทพฯ จำกัด",
    "vendorTaxId": "0125523000093",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "9",
    "poNo": "9",
    "rcvNo": "9",
    "missRowIndex": 11
  },
  {
    "rowIndex": 152,
    "code": "9งบ",
    "projectNo": "69119391500",
    "subject": "ยา NEOAMIYU 200 ML. INJ จำนวน 60 ถุง",
    "rawSubject": "ยา NEOAMIYU ๒๐๐ ML. INJ จำนวน ๖๐ ถุง",
    "itemCount": "1",
    "amount": 7393.2,
    "amountFormatted": "7,393.20",
    "vendorName": "ห้างหุ้นส่วนจำกัด ฟาร์อีสต์ฟาร์มาซูติคอล",
    "vendorTaxId": "0103518000046",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "10",
    "poNo": "10",
    "rcvNo": "10",
    "missRowIndex": 12
  },
  {
    "rowIndex": 153,
    "code": "10งบ",
    "projectNo": "69119391509",
    "subject": "ยา LEUCOVORIN 50MG/5ML (1vial) จำนวน 300 ขวด",
    "rawSubject": "ยา LEUCOVORIN ๕๐MG/๕ML (๑vial) จำนวน ๓๐๐ ขวด",
    "itemCount": "1",
    "amount": 30174.0,
    "amountFormatted": "30,174.00",
    "vendorName": "ห้างหุ้นส่วนจำกัด ภิญโญฟาร์มาซี",
    "vendorTaxId": "0103521008575",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "11",
    "poNo": "11",
    "rcvNo": "11",
    "missRowIndex": 13
  },
  {
    "rowIndex": 154,
    "code": "11งบ",
    "projectNo": "69119391525",
    "subject": "ยา PREDSIRUP 5 mg/ 5 ml SYRUP (Prednisolone) จำนวน 100 BOT",
    "rawSubject": "ยา PREDSIRUP ๕ mg/ ๕ ml SYRUP (Prednisolone) จำนวน ๑๐๐ BOT",
    "itemCount": "1",
    "amount": 2033.0,
    "amountFormatted": "2,033.00",
    "vendorName": "บริษัท สหแพทย์เภสัช จำกัด",
    "vendorTaxId": "0105514005061",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "12",
    "poNo": "12",
    "rcvNo": "12",
    "missRowIndex": 14
  },
  {
    "rowIndex": 155,
    "code": "12งบ",
    "projectNo": "69119391531",
    "subject": "ยา HARIDOL-D 50mg/ml INJ AMP# 1ml  จำนวน 100 AMPOULES",
    "rawSubject": "ยา HARIDOL-D ๕๐mg/ml INJ AMP# ๑ml  จำนวน ๑๐๐ AMPOULES",
    "itemCount": "1",
    "amount": 6300.0,
    "amountFormatted": "6,300.00",
    "vendorName": "บริษัท แอตแลนติค ฟาร์มาซูติคอล จำกัด",
    "vendorTaxId": "0105528008271",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "13",
    "poNo": "13",
    "rcvNo": "13",
    "missRowIndex": 15
  },
  {
    "rowIndex": 156,
    "code": "13งบ",
    "projectNo": "69119391567",
    "subject": "ยา MYSOVEN GRANULE 200 MG. (กล่องละ 50 X 3 GM.)  จำนวน 480 BOX",
    "rawSubject": "ยา MYSOVEN GRANULE ๒๐๐ MG. (กล่องละ ๖๐ X ๓ GM.)  จำนวน ๔๘๐ BOX",
    "itemCount": "1",
    "amount": 35697.6,
    "amountFormatted": "35,697.60",
    "vendorName": "บริษัท เกร๊ทเตอร์มายบาซิน จำกัด",
    "vendorTaxId": "0735543000476",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "14",
    "poNo": "14",
    "rcvNo": "14",
    "missRowIndex": 16
  },
  {
    "rowIndex": 157,
    "code": "14งบ",
    "projectNo": "69119391571",
    "subject": "ยา IBUMAN200 TAB ROUND-PINK(BLIS1X100X10'S) จำนวน 5 Box",
    "rawSubject": "ยา IBUMAN๒๐๐ TAB ROUND-PINK(BLIS๑X๑๐๐X๑๐'S) จำนวน ๕ Box",
    "itemCount": "1",
    "amount": 2300.0,
    "amountFormatted": "2,300.00",
    "vendorName": "บริษัท ที.แมน ฟาร์มาซูติคอล จำกัด (มหาชน)",
    "vendorTaxId": "0107566000518",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "15",
    "poNo": "15",
    "rcvNo": "15",
    "missRowIndex": 17
  },
  {
    "rowIndex": 158,
    "code": "15งบ",
    "projectNo": "69119391580",
    "subject": "ยา METRAZOLE 200 MG WHITE  จำนวน 40 BOTTLE",
    "rawSubject": "ยา METRAZOLE ๒๐๐ MG WHITE  จำนวน ๔๐ BOTTLE",
    "itemCount": "1",
    "amount": 15000.0,
    "amountFormatted": "15,000.00",
    "vendorName": "บริษัท เยนเนอร์ราลดรั๊กส์เฮ้าส์ จำกัด",
    "vendorTaxId": "0105502000884",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "16",
    "poNo": "16",
    "rcvNo": "16",
    "missRowIndex": 18
  },
  {
    "rowIndex": 159,
    "code": "16งบ",
    "projectNo": "69119391583",
    "subject": "ยาจำนวน 3 รายการ",
    "rawSubject": "ยาจำนวน ๓ รายการ",
    "itemCount": "3",
    "amount": 41000.0,
    "amountFormatted": "41,000.00",
    "vendorName": "บริษัท เซ็นทรัลโพลีเทรดดิ้ง จำกัด",
    "vendorTaxId": "0105516010941",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "17",
    "poNo": "17",
    "rcvNo": "17",
    "missRowIndex": 19
  },
  {
    "rowIndex": 160,
    "code": "17งบ",
    "projectNo": "69119391588",
    "subject": "ยา CUROSURF 1.5ML  จำนวน 4 Vial",
    "rawSubject": "ยา CUROSURF ๑.๕ML  จำนวน ๔ Vial",
    "itemCount": "1",
    "amount": 36000.0,
    "amountFormatted": "36,000.00",
    "vendorName": "บริษัท แปซิฟิค เฮลธ์แคร์ (ไทยแลนด์) จำกัด",
    "vendorTaxId": "0105504000253",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "18",
    "poNo": "18",
    "rcvNo": "18",
    "missRowIndex": 20
  },
  {
    "rowIndex": 161,
    "code": "18งบ",
    "projectNo": "69119391593",
    "subject": "ยา KCL For Injection (50x10ml) จำนวน 60 กล่อง",
    "rawSubject": "ยา KCL For Injection (๕๐x๑๐ml) จำนวน ๖๐ กล่อง",
    "itemCount": "1",
    "amount": 24000.0,
    "amountFormatted": "24,000.00",
    "vendorName": "บริษัท ฟาร์ม่า อินโนวา จำกัด",
    "vendorTaxId": "0105547101744",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "19",
    "poNo": "19",
    "rcvNo": "19",
    "missRowIndex": 21
  },
  {
    "rowIndex": 162,
    "code": "19งบ",
    "projectNo": "69119391601",
    "subject": "ยา XYLOCAINE 1% WITH ADRENALINE INJ 10X20MLจำนวน 80 BOX",
    "rawSubject": "ยา XYLOCAINE ๑% WITH ADRENALINE INJ ๑๐X๒๐MLจำนวน ๘๐ BOX",
    "itemCount": "1",
    "amount": 44300.0,
    "amountFormatted": "44,300.00",
    "vendorName": "บริษัท เจ เอส วิชั่น จำกัด",
    "vendorTaxId": "0105538109282",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "20",
    "poNo": "20",
    "rcvNo": "20",
    "missRowIndex": 22
  },
  {
    "rowIndex": 163,
    "code": "20งบ",
    "projectNo": "69119391604",
    "subject": "ยา O.R.S. (OSRA) 5.5 GM POWDER จำนวน 600 กล่อง",
    "rawSubject": "ยา O.R.S. (OSRA) ๕.๕ GM POWDER จำนวน ๖๐๐ กล่อง",
    "itemCount": "1",
    "amount": 57780.0,
    "amountFormatted": "57,780.00",
    "vendorName": "บริษัท บี.เอ็ล.ฮั้ว จำกัด",
    "vendorTaxId": "0105490000456",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "21",
    "poNo": "21",
    "rcvNo": "21",
    "missRowIndex": 23
  },
  {
    "rowIndex": 164,
    "code": "21งบ",
    "projectNo": "69119391634",
    "subject": "ยาจำนวน 4 รายการ",
    "rawSubject": "ยาจำนวน ๔ รายการ",
    "itemCount": "4",
    "amount": 370190.04,
    "amountFormatted": "370,190.04",
    "vendorName": "บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด",
    "vendorTaxId": "0105523002118",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "22",
    "poNo": "22",
    "rcvNo": "22",
    "missRowIndex": 24
  },
  {
    "rowIndex": 165,
    "code": "22งบ",
    "projectNo": "",
    "subject": "ยา CARDIPLOT 20 MG.50X10S จำนวน 1,030 BOX",
    "rawSubject": "ยา CARDIPLOT ๒๐ MG.๕๐X๑๐S จำนวน ๑,๐๓๐ BOX",
    "itemCount": "1",
    "amount": 499550.0,
    "amountFormatted": "499,550.00",
    "vendorName": "บริษัท เบอร์ลินฟาร์มาซูติคอลอินดัสตรี้ จำกัด",
    "vendorTaxId": "0105527028430",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "23",
    "poNo": "23",
    "rcvNo": "23",
    "missRowIndex": 25
  },
  {
    "rowIndex": 166,
    "code": "23งบ",
    "projectNo": "",
    "subject": "ยา AMLOPROESS 10 MG.BLISTER PACK 50X10S จำนวน 1,200 BOX",
    "rawSubject": "ยา AMLOPROESS ๑๐ MG.BLISTER PACK ๕๐X๑๐S จำนวน ๑,๒๐๐ BOX",
    "itemCount": "1",
    "amount": 192000.0,
    "amountFormatted": "192,000.00",
    "vendorName": "บริษัท ชุมชนเภสัชกรรม จำกัด (มหาชน)",
    "vendorTaxId": "0107529000011",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "24",
    "poNo": "24",
    "rcvNo": "24",
    "missRowIndex": 26
  },
  {
    "rowIndex": 167,
    "code": "24งบ",
    "projectNo": "",
    "subject": "ยา AZARGA LDMO 10/5MG/ML 5ML (X)TH จำนวน 2,500 กล่อง",
    "rawSubject": "ยา AZARGA LDMO ๑๐/๕MG/ML ๕ML (X)TH จำนวน ๒,๕๐๐ กล่อง",
    "itemCount": "1",
    "amount": 481500.0,
    "amountFormatted": "481,500.00",
    "vendorName": "บริษัท ดีซีเอช ออริกา (ประเทศไทย) จำกัด",
    "vendorTaxId": "0105512001280",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "25",
    "poNo": "25",
    "rcvNo": "25",
    "missRowIndex": 27
  },
  {
    "rowIndex": 168,
    "code": "25งบ",
    "projectNo": "",
    "subject": "ยา ACRIPTEGA (300+300+50 mg) (30s)  จำนวน 710 ขวด",
    "rawSubject": "ยา ACRIPTEGA (๓๐๐+๓๐๐+๕๐ mg) (๓๐s)  จำนวน ๗๑๐ ขวด",
    "itemCount": "1",
    "amount": 496929.0,
    "amountFormatted": "496,929.00",
    "vendorName": "บริษัท แอตแลนต้า เมดดิคแคร์ จำกัด",
    "vendorTaxId": "0105549004037",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "26",
    "poNo": "26",
    "rcvNo": "26",
    "missRowIndex": 28
  },
  {
    "rowIndex": 169,
    "code": "26งบ",
    "projectNo": "",
    "subject": "ยา Norvita 4 mL. Ampoule (1กล่อง=50Amps) จำนวน 5,000 Amps.",
    "rawSubject": "ยา Norvita ๔ mL. Ampoule (๑กล่อง=๕๐Amps) จำนวน ๕,๐๐๐ Amps.",
    "itemCount": "1",
    "amount": 171200.0,
    "amountFormatted": "171,200.00",
    "vendorName": "บริษัท เอเบิ้ล เมดิคอล จำกัด",
    "vendorTaxId": "0105555008979",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "27",
    "poNo": "27",
    "rcvNo": "27",
    "missRowIndex": 29
  },
  {
    "rowIndex": 170,
    "code": "27งบ",
    "projectNo": "",
    "subject": "ยาจำนวน 3 รายการ",
    "rawSubject": "ยาจำนวน ๓ รายการ",
    "itemCount": "3",
    "amount": 104132.4,
    "amountFormatted": "104,132.40",
    "vendorName": "บริษัท สยามฟาร์มาซูติคอล จำกัด",
    "vendorTaxId": "0105509002220",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "28",
    "poNo": "28",
    "rcvNo": "28",
    "missRowIndex": 30
  },
  {
    "rowIndex": 171,
    "code": "28งบ",
    "projectNo": "",
    "subject": "ยา TRANCELTEAR จำนวน 3,890 กล่อง",
    "rawSubject": "ยา TRANCELTEAR จำนวน ๓,๘๙๐ กล่อง",
    "itemCount": "1",
    "amount": 499476.0,
    "amountFormatted": "499,476.00",
    "vendorName": "บริษัท พรอส ฟาร์มา จำกัด",
    "vendorTaxId": "0105551105503",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "30",
    "poNo": "29",
    "rcvNo": "29",
    "missRowIndex": 31
  },
  {
    "rowIndex": 172,
    "code": "29งบ",
    "projectNo": "",
    "subject": "ยาจำนวน 6 รายการ",
    "rawSubject": "ยาจำนวน ๖ รายการ",
    "itemCount": "6",
    "amount": 169060.0,
    "amountFormatted": "169,060.00",
    "vendorName": "บริษัท ซิลลิค ฟาร์มา จำกัด",
    "vendorTaxId": "0105539106911",
    "budgetType": "เงินงบประมาณรายจ่ายประจำปี พ.ศ. ๒๕๗๐ หมวดค่าตอบแทนใช้สอยและวัสดุ (ค่าวัสดุ)",
    "isBmaBudget": true,
    "isAidsBudget": false,
    "isGpo": false,
    "deliveryDays": "5",
    "agreeDate": "12/11/2569",
    "quoteDate": "16/11/2569",
    "poSignDate": "17/11/2569",
    "rcvDate": "18/11/2569",
    "contractStartDate": "18/11/2569",
    "contractEndDate": "22/11/2569",
    "purHireNo": "31",
    "poNo": "30",
    "rcvNo": "30",
    "missRowIndex": 32
  }
];

const DEFAULT_CONFIG = {
  autocratSheetId: "1qFqdTqcP_d_nNLAX3AL0Gq21s2zjffXW2Czo3Jv1F_Y",
  autocratGid: "0",
  miss70SheetId: "1tTaFrjVCPm8IrjJAg6e0Y27jIqoedLsmJz92py1O0lU",
  miss70Gid: "0",
  egpMisSheetId: "1m0EdHfSe3M6JUBirvivwJW5GOnzKos9sUI-smRsrOvE",
  vendorsGid: "1778203595",
  gasWebAppUrl: "https://script.google.com/macros/s/AKfycbyAvDPZrKrKK0B50nU84aK9bVTyLWT47YhjW2ppGiGPSFIrI3Lryu55CBbnPFKCXKMx/exec",
  bridgeUrl: "http://127.0.0.1:47291"
};

function thaiToArabic(str) {
  if (!str) return "";
  const th = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  let out = String(str);
  for (let i = 0; i < 10; i++) {
    out = out.split(th[i]).join(String(i));
  }
  return out;
}

function parseThaiDateToSlash(val) {
  if (!val) return "";
  const s = thaiToArabic(String(val).trim());
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const dd = slashMatch[1].padStart(2, "0");
    const mm = slashMatch[2].padStart(2, "0");
    let yyyy = parseInt(slashMatch[3], 10);
    if (yyyy < 2400) yyyy += 543;
    return dd + "/" + mm + "/" + yyyy;
  }
  const months = {
    "มกราคม": "01", "กุมภาพันธ์": "02", "มีนาคม": "03", "เมษายน": "04",
    "พฤษภาคม": "05", "มิถุนายน": "06", "กรกฎาคม": "07", "สิงหาคม": "08",
    "กันยายน": "09", "ตุลาคม": "10", "พฤศจิกายน": "11", "ธันวาคม": "12",
    "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
    "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
    "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12"
  };
  for (const mName in months) {
    if (s.indexOf(mName) !== -1) {
      const parts = s.replace(/\s+/g, " ").split(" ");
      if (parts.length >= 3) {
        const dd = parts[0].replace(/\D/g, "").padStart(2, "0");
        const mm = months[mName];
        let yyyy = parseInt(parts[parts.length - 1].replace(/\D/g, ""), 10);
        if (yyyy < 2400) yyyy += 543;
        return dd + "/" + mm + "/" + yyyy;
      }
    }
  }
  return s;
}

function parseAmount(val) {
  if (typeof val === "number") return val;
  const cleaned = thaiToArabic(String(val || "")).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === "\"" && next === "\"") {
        cur += "\"";
        i++;
      } else if (ch === "\"") {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === "\"") {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\r") {
        // skip
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
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
  const urls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid || "0"}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid || "0"}`
  ];
  let lastErr = null;
  for (const url of urls) {
    try {
      const resp = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (text.trim().startsWith("<!DOCTYPE html") || text.includes("ServiceLogin")) {
        continue;
      }
      const parsed = parseCsvRows(text);
      if (parsed.length > 1) return parsed;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("ไม่สามารถดึงข้อมูลสดจาก Google Sheet ได้");
}

function extractSheetId(idOrUrl) {
  const s = String(idOrUrl || "").trim();
  if (!s) return "";
  const m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : s;
}

function bankNameToCode(bankName) {
  const b = String(bankName || "").trim().toLowerCase();
  const rules = [
    ["กรุงเทพ", "002"],
    ["กสิกร", "004"],
    ["กรุงไทย", "006"],
    ["ทหารไทย", "011"],
    ["ทีเอ็มบี", "011"],
    ["ธนชาต", "011"],
    ["ไทยพาณิช", "014"],
    ["ไทยพานิช", "014"],
    ["ซิตี้", "017"],
    ["สแตนดาร์ด", "020"],
    ["ซีไอเอ็มบี", "022"],
    ["ยูโอบี", "024"],
    ["uob", "024"],
    ["กรุงศรี", "025"],
    ["ออมสิน", "030"],
    ["ฮ่องกง", "031"],
    ["hsbc", "031"],
    ["ดอยซ์", "032"],
    ["ธ.ก.ส", "034"],
    ["บีเอ็นพี", "045"],
    ["bnp", "045"],
    ["ทิสโก้", "067"],
    ["เกียรตินาคิน", "069"],
    ["แลนด์", "073"]
  ];
  for (let i = 0; i < rules.length; i++) {
    if (b.indexOf(rules[i][0]) !== -1) return rules[i][1];
  }
  return "";
}

async function loadBundledVendorsCache() {
  try {
    const url = chrome.runtime.getURL("vendors-cache.json");
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.vendors)) return data.vendors;
  } catch (e) {}
  return [];
}

function parseVendorsFromCsv(rows) {
  const vendors = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const company = String(row[0] || "").replace(/\s+/g, " ").trim();
    if (!company) continue;
    const bank = String(row[1] || "").replace(/\s+/g, " ").trim();
    const branch = String(row[2] || "").replace(/\s+/g, " ").trim();
    const acctThai = String(row[3] || "").trim();
    const acctMis2 = thaiToArabic(String(row[4] || "").trim() || acctThai).trim();
    const address = String(row[6] || "").replace(/\s+/g, " ").trim();
    let taxId = thaiToArabic(String(row[7] || "")).replace(/\D/g, "");
    if (taxId === "000000") taxId = "";
    const digitsOnly = acctMis2.replace(/\D/g, "");
    const branchCode = digitsOnly.length >= 3 ? ("0" + digitsOnly.substring(0, 3)) : "";
    vendors.push({
      company,
      bank,
      bankCode: bankNameToCode(bank),
      branch,
      branchCode,
      accountNo: acctMis2,
      address,
      taxId
    });
  }
  return vendors;
}

async function fetchAllFromGoogleSheets(cfg) {
  const settings = Object.assign({}, DEFAULT_CONFIG, cfg || {});
  const fy = String(settings.fiscalYear || "70").trim();
  const acSheetId = extractSheetId(settings.autocratSheetId) || DEFAULT_CONFIG.autocratSheetId;
  const missSheetId = extractSheetId(settings.missSheetId || settings.miss70SheetId) || DEFAULT_CONFIG.miss70SheetId;
  const egpMisSheetId = extractSheetId(settings.egpMisSheetId) || DEFAULT_CONFIG.egpMisSheetId;
  const vendorsGid = String(settings.vendorsGid || DEFAULT_CONFIG.vendorsGid);
  const isCustomYearOrSheet =
    fy !== "70" ||
    acSheetId !== DEFAULT_CONFIG.autocratSheetId ||
    missSheetId !== DEFAULT_CONFIG.miss70SheetId;

  let cachedVendors = await loadBundledVendorsCache();

  // 1. ดึงจาก Google Apps Script Web App (ได้ทั้ง items + vendors ทะเบียนบริษัท)
  if (settings.gasWebAppUrl && settings.gasWebAppUrl.startsWith("https://script.google.com/")) {
    try {
      const qs = new URLSearchParams({
        fiscalYear: fy,
        autocratSheetId: acSheetId,
        missSheetId: missSheetId,
        t: String(Date.now())
      });
      const sep = settings.gasWebAppUrl.includes("?") ? "&" : "?";
      const r = await fetch(settings.gasWebAppUrl + sep + qs.toString(), { cache: "no-store" });
      const data = await r.json();
      const gasMatchedSheet = !data.autocratSheetId || data.autocratSheetId === acSheetId;
      if (data && data.ok && Array.isArray(data.items) && data.items.length > 0 && (!isCustomYearOrSheet || gasMatchedSheet)) {
        const vendors = (Array.isArray(data.vendors) && data.vendors.length > 0) ? data.vendors : cachedVendors;
        return { items: data.items, vendors, source: `Apps Script (ปีงบ ${fy})` };
      }
    } catch (e) {}
  }

  // 2. ดึงสดโดยตรงจาก Google Sheets (Auto Crat-EGPxx, MISSxx, และ EGP+MIS ทะเบียนบริษัท)
  try {
    const [acRows, missRows, vendorRows] = await Promise.all([
      fetchSheetCsv(acSheetId, settings.autocratGid),
      fetchSheetCsv(missSheetId, settings.miss70Gid).catch(() => []),
      fetchSheetCsv(egpMisSheetId, vendorsGid).catch(() => [])
    ]);

    const liveVendors = parseVendorsFromCsv(vendorRows);
    const vendors = liveVendors.length > 0 ? liveVendors : cachedVendors;

    const missMap = {};
    for (let r = 3; r < missRows.length; r++) {
      const row = missRows[r];
      if (!row) continue;
      const purHireNo = String(row[1] || "").trim();
      const poNo = String(row[2] || "").trim();
      const rcvNo = String(row[3] || "").trim();
      const amount = parseAmount(row[4]);
      const vendorShort = String(row[6] || "").trim();
      const payDocNo = String(row[7] || "").trim();
      const orderSeq = String(row[8] || "").trim();
      const subject = thaiToArabic(String(row[9] || "").trim());
      if (orderSeq && (subject || purHireNo || amount > 0)) {
        missMap[orderSeq + "งบ"] = {
          missRowIndex: r + 1,
          purHireNo,
          poNo,
          rcvNo,
          payDocNo,
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
      const code = String(row[1] || "").trim();
      const rawSubject = String(row[2] || "").trim();
      if (!code || !/(งบ|งบเอดส์|เอดส์|aids)$/i.test(code)) continue;

      const subjectArabic = thaiToArabic(rawSubject).replace(/\s+/g, " ").trim();
      const itemCount = thaiToArabic(String(row[3] || "1").trim());
      const missInfo = missMap[code] || {};
      const acAmountNum = parseAmount(row[7] || row[5]);
      const amountNum = (missInfo.amount !== undefined && missInfo.amount > 0) ? missInfo.amount : acAmountNum;
      const amountFormatted = amountNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const vendorName = String(row[9] || "").trim();
      const vendorTaxId = thaiToArabic(String(row[10] || "")).replace(/\D/g, "");
      const budgetType = String(row[11] || "").trim();

      const agreeDate = parseThaiDateToSlash(row[12]);
      const quoteDate = parseThaiDateToSlash(row[13]);
      const poSignDate = parseThaiDateToSlash(row[14]);
      const rcvDate = parseThaiDateToSlash(row[15]);
      const contractStartDate = parseThaiDateToSlash(row[16]) || rcvDate || poSignDate;
      const contractEndDate = parseThaiDateToSlash(row[17]);

      const isGpo = /องค์การเภสัชกรรม|GPO/i.test(vendorName);
      const isAidsBudget = /เอดส์|อุดหนุน/i.test(budgetType) || /(งบเอดส์|เอดส์|aids)$/i.test(code);
      const isBmaBudget = !isAidsBudget && (/งบประมาณรายจ่ายประจำปี/i.test(budgetType) || /งบ$/.test(code));
      const deliveryDays = (isGpo || isAidsBudget) ? "60" : "5";

      items.push({
        rowIndex: r + 1,
        code,
        projectNo: String(row[0] || "").trim(),
        subject: thaiToArabic(missInfo.subjectArabic || subjectArabic),
        missSubject: missInfo.subjectArabic || "",
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
        purHireNo: missInfo.purHireNo || "",
        poNo: missInfo.poNo || "",
        rcvNo: missInfo.rcvNo || "",
        payDocNo: missInfo.payDocNo || "",
        missRowIndex: missInfo.missRowIndex || null
      });
    }

    if (items.length > 0) {
      return { items, vendors, source: "ซิงค์สดจาก Google Sheets" };
    }
  } catch (e) {
    // หากดึงสดไม่ได้ (เช่น ไม่ได้ล็อกอิน Google ใน Opera) ให้ใช้ข้อมูล SEED_ITEMS + vendors-cache.json
  }

  return { items: SEED_ITEMS, vendors: cachedVendors, source: "ฐานข้อมูลในตัว (1งบ-29งบ)" };
}

const GITHUB_REMOTE_CONFIG_URL =
  "https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension/remote-config.json";

async function fetchRemoteConfig() {
  try {
    const resp = await fetch(GITHUB_REMOTE_CONFIG_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

let lastRcvPdfContext = {
  rcvNo: "",
  fiscalYear: "70",
  code: "",
  subject: "",
  fileSeq: 0,
  updatedAt: 0
};

function sanitizeFileName(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

// ดักจับการดาวน์โหลดไฟล์ PDF จากเว็บ MIS (ข้อ 13 ใบตรวจรับพัสดุ ซึ่งจะมี 2 ไฟล์ PDF เด้งขึ้นมา) แล้วเปลี่ยนชื่อไฟล์ตามชื่อ/เลขที่ใบตรวจรับอัตโนมัติ
if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    const url = String(downloadItem.url || "");
    const mime = String(downloadItem.mime || "");
    const origName = String(downloadItem.filename || "");
    const isMisHost = /bmamisapp11\.bma\.go\.th|misweb\.bma\.go\.th/i.test(url);
    const isPdf = /pdf/i.test(mime) || /\.pdf$/i.test(origName) || /Rep_pur_rcv|report|servlet|pdf/i.test(url);

    if (isMisHost && isPdf && (lastRcvPdfContext.rcvNo || lastRcvPdfContext.code)) {
      lastRcvPdfContext.fileSeq = (lastRcvPdfContext.fileSeq % 2) + 1;
      const rcvNo = lastRcvPdfContext.rcvNo || "X";
      const yr = lastRcvPdfContext.fiscalYear || "70";
      const codePart = lastRcvPdfContext.code ? `_${lastRcvPdfContext.code}` : "";
      const baseTitle = sanitizeFileName(`ใบตรวจรับ_${rcvNo}-${yr}${codePart}`);
      const newFileName = `${baseTitle}_ไฟล์ที่${lastRcvPdfContext.fileSeq}.pdf`;
      suggest({ filename: newFileName, conflictAction: "uniquify" });
      return;
    }
    suggest();
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "SET_RCV_PDF_CONTEXT") {
    lastRcvPdfContext = {
      rcvNo: String(msg.rcvNo || "").trim(),
      fiscalYear: String(msg.fiscalYear || "70").trim(),
      code: String(msg.code || "").trim(),
      subject: String(msg.subject || "").trim(),
      fileSeq: 0,
      updatedAt: Date.now()
    };
    sendResponse({ ok: true, context: lastRcvPdfContext });
    return true;
  }

  if (msg && msg.type === "DOWNLOAD_PDF_URLS") {
    const urls = Array.isArray(msg.urls) ? msg.urls : [];
    const rcvNo = String(msg.rcvNo || lastRcvPdfContext.rcvNo || "X").trim();
    const yr = String(msg.fiscalYear || lastRcvPdfContext.fiscalYear || "70").trim();
    const codePart = msg.code ? `_${msg.code}` : "";
    const baseTitle = sanitizeFileName(`ใบตรวจรับ_${rcvNo}-${yr}${codePart}`);

    urls.forEach((u, idx) => {
      const fName = urls.length > 1 ? `${baseTitle}_ไฟล์ที่${idx + 1}.pdf` : `${baseTitle}.pdf`;
      chrome.downloads.download({
        url: u,
        filename: fName,
        conflictAction: "uniquify",
        saveAs: false
      });
    });
    sendResponse({ ok: true, count: urls.length, baseTitle });
    return true;
  }

  if (msg && msg.type === "SAVE_PAY_DOC_NO") {
    (async () => {
      try {
        const gasUrl = msg.gasWebAppUrl || DEFAULT_CONFIG.gasWebAppUrl;
        const resp = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "updatePayDocNo",
            missRowIndex: Number(msg.missRowIndex),
            payDocNo: String(msg.payDocNo || "").trim(),
            missSheetId: extractSheetId(msg.missSheetId) || DEFAULT_CONFIG.miss70SheetId,
            missTabName: String(msg.missTabName || "ชีต1").trim()
          })
        });
        const text = await resp.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) {}
        if (parsed && parsed.ok) {
          sendResponse({ ok: true, result: parsed.result });
        } else {
          sendResponse({ ok: false, error: (parsed && parsed.error) || "บันทึกไม่สำเร็จ (ตรวจสอบ Apps Script Deploy)" });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  if (msg && msg.type === "BRIDGE_REQUEST") {
    (async () => {
      const endpoint = String(msg.endpoint || "/status");
      const method = String(msg.method || "GET").toUpperCase();
      const timeoutMs = Number(msg.timeoutMs) || (endpoint === "/status" ? 2500 : 120000);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const opts = {
          method,
          cache: "no-store",
          signal: ctrl.signal
        };
        if (method === "POST") {
          opts.headers = { "Content-Type": "text/plain;charset=utf-8" };
          opts.body = JSON.stringify(msg.payload || {});
        }
        const resp = await fetch(DEFAULT_CONFIG.bridgeUrl + endpoint, opts);
        const text = await resp.text();
        let data = null;
        try { data = JSON.parse(text); } catch (e) { data = { ok: false, error: text }; }
        sendResponse({ ok: true, bridgeConnected: true, data });
      } catch (err) {
        sendResponse({
          ok: false,
          bridgeConnected: false,
          error: err.name === "AbortError" ? "หมดเวลารอตัวช่วย Oracle Forms" : "ยังไม่ได้เปิดตัวช่วย Oracle Forms (START_ORACLE_BRIDGE.bat)"
        });
      } finally {
        clearTimeout(timer);
      }
    })();
    return true;
  }

  if (msg && msg.type === "FETCH_SHEETS_DATA") {
    (async () => {
      try {
        const remoteConfig = await fetchRemoteConfig();
        const userCfg = Object.assign({}, msg.config || {});
        const fy = String(userCfg.fiscalYear || "70").trim();
        const remoteFyMap = (remoteConfig && remoteConfig.fiscalYears) || {};
        const remoteFyEntry = remoteFyMap[fy] || {};

        const mergedCfg = Object.assign({}, userCfg);
        if (!mergedCfg.gasWebAppUrl && remoteConfig && remoteConfig.gasWebAppUrl) {
          mergedCfg.gasWebAppUrl = remoteConfig.gasWebAppUrl;
        }
        if (!mergedCfg.autocratSheetId) {
          mergedCfg.autocratSheetId =
            remoteFyEntry.autocratSheetId ||
            (fy === "70" && remoteConfig && remoteConfig.autocratSheetId) ||
            DEFAULT_CONFIG.autocratSheetId;
        }
        if (!mergedCfg.missSheetId) {
          mergedCfg.missSheetId =
            remoteFyEntry.missSheetId ||
            (fy === "70" && remoteConfig && remoteConfig.miss70SheetId) ||
            DEFAULT_CONFIG.miss70SheetId;
        }
        if (remoteConfig && remoteConfig.egpMisSheetId) {
          mergedCfg.egpMisSheetId = remoteConfig.egpMisSheetId;
        }
        if (remoteConfig && remoteConfig.vendorsGid) {
          mergedCfg.vendorsGid = remoteConfig.vendorsGid;
        }

        const res = await fetchAllFromGoogleSheets(mergedCfg);
        sendResponse({
          ok: true,
          items: res.items,
          vendors: res.vendors || [],
          source: res.source,
          remoteConfig: remoteConfig
        });
      } catch (err) {
        const fallbackVendors = await loadBundledVendorsCache();
        sendResponse({
          ok: true,
          items: SEED_ITEMS,
          vendors: fallbackVendors,
          source: "ฐานข้อมูลในตัว (1งบ-29งบ)",
          remoteConfig: null
        });
      }
    })();
    return true;
  }
});
