function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetInv = ss.getSheetByName("Inventario");
  var sheetReg = ss.getSheetByName("Registro");
  
  var payload = JSON.parse(e.postData.contents);
  var action = payload.action;

  // -- ACCIÓN: GUARDAR LOTE DE INVENTARIO --
  if (action === "inventory_add_batch") {
    var items = payload.items;
    var now = new Date();
    var formattedDate = Utilities.formatDate(now, "GMT-3", "dd/MM/yyyy HH:mm:ss");
    
    // 1. Obtener nuevo ID secuencial (mirando la hoja Registro)
    var lastRowReg = sheetReg.getLastRow();
    var lastId = 0;
    if (lastRowReg > 1) {
      lastId = parseInt(sheetReg.getRange(lastRowReg, 1).getValue()) || 0;
    }
    var newId = lastId + 1;

    // 2. Registrar el evento en la hoja "Registro"
    // Columnas actuales: ID | Fecha | Usuario | Estacion | Estado | Observaciones
    sheetReg.appendRow([
      newId,
      formattedDate,
      payload.usuario || "",
      payload.estacion || "",
      "Completo",
      payload.itemsDesc || ""
    ]);

    // 3. Registrar el detalle en la hoja "Inventario"
    // Columnas actuales: ID | Fecha | Usuario | Estacion | Tipo | Unidad | Cantidad | Largo | Ancho | Obs
    var rowsToAppend = [];
    items.forEach(function(item) {
      rowsToAppend.push([
        newId,
        formattedDate,
        payload.usuario || "",
        payload.estacion || "",
        item.tipo ? String(item.tipo).trim() : "",
        item.unidad || "",
        item.cantidad || 0,
        item.largo || "-",
        item.ancho || "-",
        item.observaciones || ""
      ]);
    });

    if (rowsToAppend.length > 0) {
      sheetInv.getRange(sheetInv.getLastRow() + 1, 1, rowsToAppend.length, 10).setValues(rowsToAppend);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Inventario registrado con ID " + newId,
      id: newId
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "error",
    message: "Acción no reconocida"
  })).setMimeType(ContentService.MimeType.JSON);
}
