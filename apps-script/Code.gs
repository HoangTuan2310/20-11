const CONFIG = {
  folderName: "ThiepTriAn",
  spreadsheetName: "ThiepTriAn - Loi chuc",
  sheetName: "Lời chúc",
  maxImageBytes: 6 * 1024 * 1024,
  maxRequestsPerMinute: 20
};

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    validatePayload(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      enforceRateLimit();

      const folder = getOrCreateFolder();
      const spreadsheet = getOrCreateSpreadsheet();
      const image = Utilities.newBlob(
        Utilities.base64Decode(payload.imageBase64),
        "image/png",
        makeImageName(payload.sender, payload.recipient)
      );
      folder.createFile(image);

      const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
      sheet.appendRow([
        payload.submittedAt,
        escapeSheetValue(payload.sender),
        escapeSheetValue(payload.recipient),
        escapeSheetValue(payload.message)
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Không thể lưu thiệp." });
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid request body.");
  }

  const limits = {
    sender: 100,
    recipient: 100,
    message: 2000,
    submittedAt: 40
  };

  Object.keys(limits).forEach(function (key) {
    if (
      typeof payload[key] !== "string" ||
      payload[key].trim().length === 0 ||
      payload[key].length > limits[key]
    ) {
      throw new Error("Invalid " + key + ".");
    }
  });

  if (isNaN(Date.parse(payload.submittedAt))) {
    throw new Error("Invalid submission time.");
  }

  if (
    typeof payload.imageBase64 !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.imageBase64) ||
    payload.imageBase64.length > Math.ceil(CONFIG.maxImageBytes * 4 / 3) + 4
  ) {
    throw new Error("Invalid or oversized image.");
  }
}

function enforceRateLimit() {
  const cache = CacheService.getScriptCache();
  const minute = Math.floor(Date.now() / 60000);
  const key = "requests-" + minute;
  const count = Number(cache.get(key) || 0);

  if (count >= CONFIG.maxRequestsPerMinute) {
    throw new Error("Request limit reached.");
  }

  cache.put(key, String(count + 1), 120);
}

function getOrCreateFolder() {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty("FOLDER_ID");
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      properties.deleteProperty("FOLDER_ID");
    }
  }

  const folders = DriveApp.getFoldersByName(CONFIG.folderName);
  const folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(CONFIG.folderName);
  properties.setProperty("FOLDER_ID", folder.getId());
  return folder;
}

function getOrCreateSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  let spreadsheet;

  if (spreadsheetId) {
    try {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      properties.deleteProperty("SPREADSHEET_ID");
    }
  }

  if (!spreadsheet) {
    const files = DriveApp.getFilesByName(CONFIG.spreadsheetName);
    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.openById(files.next().getId());
    } else {
      spreadsheet = SpreadsheetApp.create(CONFIG.spreadsheetName);
    }
    properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  }

  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = spreadsheet.getSheets()[0];
    sheet.setName(CONFIG.sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Thời gian", "Người gửi", "Thầy cô", "Lời chúc"]);
  }

  return spreadsheet;
}

function makeImageName(sender, recipient) {
  const normalize = function (value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 60);
  };

  return normalize(sender) + "-" + normalize(recipient) + "-" + Date.now() + ".png";
}

function escapeSheetValue(value) {
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
