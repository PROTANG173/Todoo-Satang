// ================================================
// PIXEL DASHBOARD — Google Apps Script Backend
// ================================================

const SHEET_NAME = "tasks";

function doGet(e) {
  try {
    const action = e.parameter.action;

    // GET tasks
    if (!action || action === 'get') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const data  = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows    = data.slice(1);
      const tasks = rows
        .filter(r => r[0] !== '')
        .map(r => {
          const obj = {};
          headers.forEach((h, i) => {
            if (h === 'done') obj[h] = r[i] === true || r[i] === 'TRUE';
            else if (h === 'id') obj[h] = Number(r[i]);
            else obj[h] = r[i];
          });
          return obj;
        });
      return jsonResponse({ status: 'ok', tasks });
    }

    // ADD
    if (action === 'add') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const t = JSON.parse(e.parameter.task);
      sheet.appendRow([t.id, t.name, t.dueDate, t.priority, t.color, t.done]);
      return jsonResponse({ status: 'ok', message: 'added' });
    }

    // UPDATE
    if (action === 'update') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const t   = JSON.parse(e.parameter.task);
      const row = findRow(sheet, t.id);
      if (!row) return jsonResponse({ status: 'error', message: 'not found' });
      sheet.getRange(row, 1, 1, 6).setValues([[t.id, t.name, t.dueDate, t.priority, t.color, t.done]]);
      return jsonResponse({ status: 'ok', message: 'updated' });
    }

    // DELETE
    if (action === 'delete') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const row = findRow(sheet, Number(e.parameter.id));
      if (!row) return jsonResponse({ status: 'error', message: 'not found' });
      sheet.deleteRow(row);
      return jsonResponse({ status: 'ok', message: 'deleted' });
    }

    return jsonResponse({ status: 'error', message: 'unknown action' });

  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function findRow(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === Number(id)) return i + 1;
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
