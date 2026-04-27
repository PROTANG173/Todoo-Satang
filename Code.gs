// ================================================
// PIXEL DASHBOARD — Google Apps Script Backend
// รองรับ JSONP (callback parameter)
// ================================================

const SHEET_NAME = "ชีต1";

function doGet(e) {
  const callback = e.parameter.callback; // JSONP callback name
  let result;

  try {
    const action = e.parameter.action || 'get';

    if (action === 'get') {
      const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const data    = sheet.getDataRange().getValues();
      const headers = data[0];
      const tasks   = data.slice(1)
        .filter(r => r[0] !== '')
        .map(r => {
          const obj = {};
          headers.forEach((h, i) => {
            if (h === 'done') obj[h] = r[i] === true || r[i] === 'TRUE';
            else if (h === 'id') obj[h] = Number(r[i]);
            else obj[h] = String(r[i]);
          });
          return obj;
        });
      result = { status: 'ok', tasks };
    }

    else if (action === 'add') {
      const t     = JSON.parse(e.parameter.task);
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      sheet.appendRow([t.id, t.name, t.dueDate, t.priority, t.color, t.done]);
      result = { status: 'ok', message: 'added' };
    }

    else if (action === 'update') {
      const t     = JSON.parse(e.parameter.task);
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const row   = findRow(sheet, t.id);
      if (!row) { result = { status: 'error', message: 'not found' }; }
      else {
        sheet.getRange(row, 1, 1, 6).setValues([[t.id, t.name, t.dueDate, t.priority, t.color, t.done]]);
        result = { status: 'ok', message: 'updated' };
      }
    }

    else if (action === 'delete') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const row   = findRow(sheet, Number(e.parameter.id));
      if (!row) { result = { status: 'error', message: 'not found' }; }
      else {
        sheet.deleteRow(row);
        result = { status: 'ok', message: 'deleted' };
      }
    }

    else {
      result = { status: 'error', message: 'unknown action' };
    }

  } catch(err) {
    result = { status: 'error', message: err.toString() };
  }

  const json = JSON.stringify(result);

  // ถ้ามี callback = JSONP, ถ้าไม่มี = JSON ปกติ
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function findRow(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === Number(id)) return i + 1;
  }
  return null;
}
