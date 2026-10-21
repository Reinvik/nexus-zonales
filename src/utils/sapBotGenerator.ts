import { InventarioItemConsolidado } from '../types/ciclico';

/**
 * Descarga un archivo .vbs en el navegador con saltos de línea CRLF para Windows Script Host
 */
function downloadVbsFile(filename: string, content: string) {
  const crlfContent = content.replace(/\r?\n/g, '\r\n');
  const blob = new Blob([crlfContent], { type: 'text/vbscript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. BOT EXTRACTOR: Descarga LX02 (Almacén 999) + MB52 (Almacén SDIF) en un solo paso
 */
export function descargarBotExtractorSap() {
  const vbs = `' =========================================================================
' BOT SAP GUI (.VBS): EXTRACCION AUTOMATICA DE ALMACEN 999 (LX02) Y SDIF (MB52)
' CIAL Alimentos - Centro de Distribucion San Jorge (SGSJ / NCD)
' Generado desde Nexus Zonales
' =========================================================================
Option Explicit

Dim ARCHIVO_999, ARCHIVO_SDIF, CENTRO_WM, CENTRO_IM, ALMACEN_SDIF, VARIANTE_ALV, TIMEOUT_SEGUNDOS
ARCHIVO_999      = "LX02_999.xlsx"
ARCHIVO_SDIF     = "MB52_SDIF.xlsx"
CENTRO_WM        = "NCD"
CENTRO_IM        = "SGSJ"
ALMACEN_SDIF     = "SDIF"
VARIANTE_ALV     = "/JESTAY"
TIMEOUT_SEGUNDOS = 45

Dim oShell, fso, strDesktop, strUserDocs, strSapDocs
Dim ruta999, rutaSdif

Set oShell = CreateObject("WScript.Shell")
Set fso    = CreateObject("Scripting.FileSystemObject")

strDesktop = oShell.SpecialFolders("Desktop")
If Right(strDesktop, 1) <> "\\" Then strDesktop = strDesktop & "\\"

strUserDocs = oShell.SpecialFolders("MyDocuments")
If Right(strUserDocs, 1) <> "\\" Then strUserDocs = strUserDocs & "\\"
strSapDocs  = strUserDocs & "SAP\\SAP GUI\\"

ruta999  = PrepararRutaArchivo(ARCHIVO_999, "LX02_999")
rutaSdif = PrepararRutaArchivo(ARCHIVO_SDIF, "MB52_SDIF")

' --- CONEXION A SAP GUI ---
Dim SapGuiAuto, sapApp, connection, session

On Error Resume Next
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Or Not IsObject(SapGuiAuto) Then
    MsgBox "No se encontro SAP GUI abierto. Abre SAP Logon e inicia sesion en CIAL.", vbCritical, "SAP GUI no detectado"
    WScript.Quit 1
End If

Set sapApp = SapGuiAuto.GetScriptingEngine
Dim conn
For Each conn In sapApp.Children
    If conn.Children.Count > 0 Then
        Set connection = conn
        Set session = connection.Children(0)
        Exit For
    End If
Next

If Not IsObject(session) Then
    MsgBox "No se encontro una sesion activa de SAP.", vbExclamation, "Sin sesion SAP"
    WScript.Quit 1
End If
On Error GoTo 0

' =========================================================================
' PASO 1: DESCARGAR LX02 (ALMACEN 999)
' =========================================================================
On Error Resume Next
With session
    .findById("wnd[0]").maximize
    .findById("wnd[0]/tbar[0]/okcd").Text = "/nLX02"
    .findById("wnd[0]").sendVKey 0
    Call EsperarSincronizacion(session)

    .findById("wnd[0]/usr/ctxtS1_LGNUM").Text = CENTRO_WM
    .findById("wnd[0]/usr/ctxtS1_LGTYP-LOW").Text = "999"
    .findById("wnd[0]/usr/ctxtP_VARI").Text = VARIANTE_ALV
    .findById("wnd[0]/tbar[1]/btn[8]").press
    Call EsperarSincronizacion(session)
    WScript.Sleep 1000

    .findById("wnd[0]/mbar/menu[0]/menu[1]/menu[1]").Select
    Call EsperarSincronizacion(session)

    .findById("wnd[1]/usr/ssubSUB_CONFIGURATION:SAPLSALV_GUI_CUL_EXPORT_AS:0512/ctxtDY_PATH").Text = strDesktop
    .findById("wnd[1]/usr/ssubSUB_CONFIGURATION:SAPLSALV_GUI_CUL_EXPORT_AS:0512/txtGS_EXPORT-DIRECTORY").Text = strDesktop
    .findById("wnd[1]/usr/ssubSUB_CONFIGURATION:SAPLSALV_GUI_CUL_EXPORT_AS:0512/txtGS_EXPORT-FILE_NAME").Text = fso.GetFileName(ruta999)

    .findById("wnd[1]/tbar[0]/btn[20]").press
    Call EsperarSincronizacion(session)
    .findById("wnd[1]/tbar[0]/btn[0]").press
    Call EsperarSincronizacion(session)
End With
On Error GoTo 0

Call EsperarArchivo(ruta999)

' =========================================================================
' PASO 2: DESCARGAR MB52 (ALMACEN SDIF - CENTRO SGSJ)
' =========================================================================
On Error Resume Next
With session
    .findById("wnd[0]/tbar[0]/okcd").Text = "/nMB52"
    .findById("wnd[0]").sendVKey 0
    Call EsperarSincronizacion(session)

    .findById("wnd[0]/usr/ctxtMATNR-LOW").Text = ""
    .findById("wnd[0]/usr/ctxtCHARG-LOW").Text = ""
    .findById("wnd[0]/usr/ctxtWERKS-LOW").Text = CENTRO_IM
    .findById("wnd[0]/usr/ctxtLGORT-LOW").Text = ALMACEN_SDIF
    .findById("wnd[0]/usr/PA_GRID").Selected = False

    .findById("wnd[0]/tbar[1]/btn[8]").press
    Call EsperarSincronizacion(session)
    WScript.Sleep 1000

    .findById("wnd[0]/mbar/menu[0]/menu[1]/menu[1]").Select
    Call EsperarSincronizacion(session)

    If session.Children.Count > 1 Then
        If InStr(1, .findById("wnd[1]").Text, "Fichero", 1) > 0 Or InStr(1, .findById("wnd[1]").Text, "Local", 1) > 0 Then
            .findById("wnd[1]/usr/rad_SPOPLI-SELFLAG[1]").Select
            .findById("wnd[1]/tbar[0]/btn[0]").press
            Call EsperarSincronizacion(session)

            .findById("wnd[1]/usr/ctxtDY_PATH").Text = strDesktop
            .findById("wnd[1]/usr/ctxtDY_FILENAME").Text = fso.GetFileName(rutaSdif)
            .findById("wnd[1]").sendVKey 0
            Call EsperarSincronizacion(session)
            .findById("wnd[1]/tbar[0]/btn[11]").press
            Call EsperarSincronizacion(session)
        Else
            .findById("wnd[1]/usr/ssubSUB_CONFIGURATION:SAPLSALV_GUI_CUL_EXPORT_AS:0512/ctxtDY_PATH").Text = strDesktop
            .findById("wnd[1]/usr/ssubSUB_CONFIGURATION:SAPLSALV_GUI_CUL_EXPORT_AS:0512/txtGS_EXPORT-DIRECTORY").Text = strDesktop
            .findById("wnd[1]/usr/ssubSUB_CONFIGURATION:SAPLSALV_GUI_CUL_EXPORT_AS:0512/txtGS_EXPORT-FILE_NAME").Text = fso.GetFileName(rutaSdif)
            .findById("wnd[1]/tbar[0]/btn[20]").press
            Call EsperarSincronizacion(session)
            .findById("wnd[1]/tbar[0]/btn[0]").press
            Call EsperarSincronizacion(session)
        End If
    End If
End With
On Error GoTo 0

Call EsperarArchivo(rutaSdif)

MsgBox "Extraccion SAP completada con exito:" & vbCrLf & vbCrLf & _
       "1) Almacen 999 (LX02): " & ruta999 & vbCrLf & _
       "2) Almacen SDIF (MB52): " & rutaSdif, _
       vbInformation, "Nexus Zonales - SAP Extractor"

WScript.Quit 0

Function PrepararRutaArchivo(nombreBase, prefijo)
    Dim ruta
    ruta = strDesktop & nombreBase
    If fso.FileExists(ruta) Then
        On Error Resume Next
        fso.DeleteFile ruta, True
        If Err.Number <> 0 Then
            Err.Clear
            Dim ts
            ts = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & "_" & _
                 Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)
            ruta = strDesktop & prefijo & "_" & ts & ".xlsx"
        End If
        On Error GoTo 0
    End If
    PrepararRutaArchivo = ruta
End Function

Sub EsperarArchivo(rutaEsperada)
    Dim t0, nom
    t0  = Timer
    nom = fso.GetFileName(rutaEsperada)
    Do While (Timer - t0) < TIMEOUT_SEGUNDOS
        If fso.FileExists(rutaEsperada) Then Exit Do
        If fso.FolderExists(strSapDocs) Then
            If fso.FileExists(strSapDocs & nom) Then
                On Error Resume Next
                fso.CopyFile strSapDocs & nom, rutaEsperada, True
                If fso.FileExists(rutaEsperada) Then Exit Do
                On Error GoTo 0
            End If
        End If
        WScript.Sleep 500
    Loop
End Sub

Sub EsperarSincronizacion(sess)
    On Error Resume Next
    Dim i
    For i = 1 To 150
        If Not sess.Busy Then Exit For
        WScript.Sleep 100
    Next
    On Error GoTo 0
End Sub
`;

  downloadVbsFile('Descargar_999_y_SDIF_SAP.vbs', vbs);
}

/**
 * 2. BOT CONCILIADOR 999 -> PICKING (LT01):
 * Genera un .vbs con las órdenes de transporte exactas ya precargadas desde los cruces del Cíclico
 */
export function descargarBotConciliar999Lt01(items: InventarioItemConsolidado[]) {
  const conciliados = items.filter(i => i.conciliacion_999?.es_conciliado);

  const movimientos: Array<{
    sku: string;
    desc: string;
    lote: string;
    ubiOrigen: string;
    cantidad: number;
    unidad: string;
    tipDestino: string;
    ubiDestino: string;
  }> = [];

  for (const item of conciliados) {
    const info999 = item.conciliacion_999!;
    const firstLot = info999.items.find(x => x.stock_disponible < 0) || info999.items[0];
    movimientos.push({
      sku: item.sku,
      desc: item.descripcion.replace(/"/g, ''),
      lote: firstLot?.lote || 'ALZASTOCK',
      ubiOrigen: firstLot?.ubicacion || 'SCHROTT',
      cantidad: info999.unidades_conciliadas || info999.cajas_conciliadas,
      unidad: firstLot?.um || 'UN',
      tipDestino: item.tip_alm || 'PCG',
      ubiDestino: item.ubicacion || 'PICKING'
    });
  }

  const arrayDeclaration = movimientos.length > 0
    ? movimientos.map((m, idx) => 
        `movs(${idx}) = "${m.sku}|${m.lote}|${m.ubiOrigen}|${m.unidad}|${m.cantidad}|${m.tipDestino}|${m.ubiDestino}|${m.desc}"`
      ).join('\r\n    ')
    : `' Sin movimientos pre-cargados, se leera desde la hoja activa de Excel`;

  const vbs = `' =========================================================================
' BOT SAP GUI (.VBS): CONCILIACION AUTOMATICA DE 999 A PICKING (TRANSACCION LT01)
' CIAL Alimentos - Centro SGSJ / Almacen WM NCD
' Generado dinamicamente por Nexus Zonales
' =========================================================================
Option Explicit

Const TCODE       = "LT01"
Const N_ALMACEN   = "NCD"   ' LTAK-LGNUM
Const MOVIMIENTO  = "999"   ' LTAK-BWLVS
Const CENTRO      = "SGSJ"  ' LTAP-WERKS
Const ALMACEN     = "NCD1"  ' LTAP-LGORT
Const PROCEDENCIA = "999"   ' LTAP-VLTYP

Dim SapGuiAuto, sapApp, connection, session
On Error Resume Next
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Or Not IsObject(SapGuiAuto) Then
    MsgBox "No se encontro SAP GUI abierto. Abre SAP Logon e inicia sesion.", vbCritical, "Error SAP"
    WScript.Quit 1
End If

Set sapApp = SapGuiAuto.GetScriptingEngine
Dim conn
For Each conn In sapApp.Children
    If conn.Children.Count > 0 Then
        Set connection = conn
        Set session = connection.Children(0)
        Exit For
    End If
Next

If Not IsObject(session) Then
    MsgBox "No hay sesion activa de SAP.", vbCritical, "Error Sesion"
    WScript.Quit 1
End If
On Error GoTo 0

Dim totalMovs
totalMovs = ${movimientos.length}

If totalMovs > 0 Then
    Dim movs(${Math.max(0, movimientos.length - 1)})
    ${arrayDeclaration}

    Dim resp
    resp = MsgBox("Se ejecutaran " & totalMovs & " Ordenes de Transporte (LT01) en SAP para regularizar del Almacen 999 a Picking." & vbCrLf & vbCrLf & _
                  "Centro: " & CENTRO & " / Almacen WM: " & N_ALMACEN & vbCrLf & _
                  "¿Deseas iniciar la conciliacion automatica?", vbYesNo + vbQuestion, "Confirmar Conciliacion LT01 (999 -> Picking)")
    If resp <> vbYes Then WScript.Quit 0

    session.findById("wnd[0]").maximize
    session.findById("wnd[0]/tbar[0]/okcd").Text = "/n" & TCODE
    session.findById("wnd[0]").sendVKey 0
    Call EsperarSincronizacion(session)

    Dim idx, partes, material, lote, ubi_origen, unidad, cantidad, typ_destino, ubi_destino, procesados
    procesados = 0

    For idx = 0 To totalMovs - 1
        partes      = Split(movs(idx), "|")
        material    = partes(0)
        lote        = partes(1)
        ubi_origen  = partes(2)
        unidad      = partes(3)
        cantidad    = partes(4)
        typ_destino = partes(5)
        ubi_destino = partes(6)

        On Error Resume Next
        With session
            .findById("wnd[0]/usr/ctxtLTAK-LGNUM").Text = N_ALMACEN
            .findById("wnd[0]/usr/ctxtLTAK-BWLVS").Text = MOVIMIENTO

            .findById("wnd[0]/usr/ctxtLTAP-MATNR").Text = material
            .findById("wnd[0]/usr/txtRL03T-ANFME").Text  = CStr(cantidad)
            .findById("wnd[0]/usr/ctxtLTAP-ALTME").Text = unidad
            .findById("wnd[0]/usr/ctxtLTAP-WERKS").Text = CENTRO
            .findById("wnd[0]/usr/ctxtLTAP-LGORT").Text = ALMACEN
            .findById("wnd[0]/usr/ctxtLTAP-CHARG").Text = lote
            .findById("wnd[0]").sendVKey 0
            Call EsperarSincronizacion(session)

            .findById("wnd[0]/usr/chkRL03T-SQUIT").Selected = True
            .findById("wnd[0]/usr/ctxtLTAP-VLTYP").Text = PROCEDENCIA
            .findById("wnd[0]/usr/txtLTAP-VLPLA").Text  = ubi_origen
            .findById("wnd[0]/usr/ctxtLTAP-NLTYP").Text = typ_destino
            .findById("wnd[0]/usr/txtLTAP-NLPLA").Text  = ubi_destino

            .findById("wnd[0]").sendVKey 0
            Call EsperarSincronizacion(session)
            .findById("wnd[0]").sendVKey 0
            Call EsperarSincronizacion(session)
            procesados = procesados + 1
        End With
        On Error GoTo 0
    Next

    MsgBox "Proceso LT01 finalizado. Movimientos ejecutados: " & procesados & " de " & totalMovs, vbInformation, "Conciliacion 999 Terminada"
Else
    Dim xlApp, sh, lastRow, i
    On Error Resume Next
    Set xlApp = GetObject(, "Excel.Application")
    If Err.Number <> 0 Or Not IsObject(xlApp) Then
        MsgBox "No hay cruces activos de 999 en este inventario ni se encontro una hoja Excel abierta.", vbExclamation, "Sin datos para LT01"
        WScript.Quit 0
    End If
    Set sh = xlApp.ActiveWorkbook.ActiveSheet
    lastRow = sh.Cells(sh.Rows.Count, 1).End(-4162).Row
    On Error GoTo 0

    session.findById("wnd[0]").maximize
    session.findById("wnd[0]/tbar[0]/okcd").Text = "/n" & TCODE
    session.findById("wnd[0]").sendVKey 0

    For i = 3 To lastRow
        material    = Trim(CStr(sh.Cells(i, 1).Value))
        lote        = Trim(CStr(sh.Cells(i, 5).Value))
        ubi_origen  = Trim(CStr(sh.Cells(i, 9).Value))
        unidad      = Trim(CStr(sh.Cells(i, 15).Value))
        cantidad    = CDbl(sh.Cells(i, 16).Value)
        typ_destino = Trim(CStr(sh.Cells(i, 18).Value))
        ubi_destino = Trim(CStr(sh.Cells(i, 19).Value))

        If cantidad >= 1 And Len(material) > 0 Then
            With session
                .findById("wnd[0]/usr/ctxtLTAK-LGNUM").Text = N_ALMACEN
                .findById("wnd[0]/usr/ctxtLTAK-BWLVS").Text = MOVIMIENTO
                .findById("wnd[0]/usr/ctxtLTAP-MATNR").Text = material
                .findById("wnd[0]/usr/txtRL03T-ANFME").Text  = CStr(cantidad)
                .findById("wnd[0]/usr/ctxtLTAP-ALTME").Text = unidad
                .findById("wnd[0]/usr/ctxtLTAP-WERKS").Text = CENTRO
                .findById("wnd[0]/usr/ctxtLTAP-LGORT").Text = ALMACEN
                .findById("wnd[0]/usr/ctxtLTAP-CHARG").Text = lote
                .findById("wnd[0]").sendVKey 0
                .findById("wnd[0]/usr/chkRL03T-SQUIT").Selected = True
                .findById("wnd[0]/usr/ctxtLTAP-VLTYP").Text = PROCEDENCIA
                .findById("wnd[0]/usr/txtLTAP-VLPLA").Text  = ubi_origen
                .findById("wnd[0]/usr/ctxtLTAP-NLTYP").Text = typ_destino
                .findById("wnd[0]/usr/txtLTAP-NLPLA").Text  = ubi_destino
                .findById("wnd[0]").sendVKey 0
                .findById("wnd[0]").sendVKey 0
            End With
        End If
    Next
    MsgBox "Movimientos desde Excel terminados con exito.", vbInformation, "LT01 Finalizado"
End If

Sub EsperarSincronizacion(sess)
    On Error Resume Next
    Dim k
    For k = 1 To 150
        If Not sess.Busy Then Exit For
        WScript.Sleep 100
    Next
    On Error GoTo 0
End Sub
`;

  downloadVbsFile('Conciliar_999_a_Picking_LT01.vbs', vbs);
}

/**
 * 3. BOT TRASPASO MIGO POR BLOQUES (SDIF -> SGSJ):
 * Usa exactamente la arquitectura de Escáner Visual en 2 Fases en MIGO (A08 / R10 / Mov 301)
 */
export function descargarBotTraspasoSdifSgsj(items: InventarioItemConsolidado[]) {
  const conciliadosSdif = items.filter(i => i.conciliacion_sdif?.es_conciliado);

  // Construir las 9 columnas requeridas por BotMigo_PorBloques:
  // 1: Material (MAKTX)
  // 2: Cantidad (ERFMG)
  // 3: UM (ERFME)
  // 4: Almacén Origen (LGOBE) -> "SDIF"
  // 5: Lote Origen (CHARG)
  // 6: Centro Origen (NAME1) -> "SGSJ"
  // 7: Centro Destino (UMNAME1) -> "SGSJ"
  // 8: Almacén Destino (UMLGOBE) -> "NCD1"
  // 9: Lote Destino (UMCHA) -> mismo lote
  const filasMigo: Array<{
    mat: string;
    cant: number;
    um: string;
    lgobe: string;
    charg: string;
    name1: string;
    umname1: string;
    umlgobe: string;
    umcha: string;
  }> = [];

  for (const item of conciliadosSdif) {
    const infoSdif = item.conciliacion_sdif!;
    const firstLot = infoSdif.items[0];
    const lote = firstLot?.lote || '';
    filasMigo.push({
      mat: item.sku,
      cant: infoSdif.unidades_conciliadas || infoSdif.cajas_conciliadas,
      um: firstLot?.um || 'UN',
      lgobe: 'SDIF',
      charg: lote,
      name1: 'SGSJ',
      umname1: 'SGSJ',
      umlgobe: 'NCD1',
      umcha: lote
    });
  }

  const preloadCode = filasMigo.length > 0
    ? `totalDatos = ${filasMigo.length}\r\n    ReDim datosExcel(1 To totalDatos, 1 To 9)\r\n    ` +
      filasMigo.map((f, idx) => {
        const n = idx + 1;
        return [
          `datosExcel(${n}, 1) = "${f.mat}"`,
          `datosExcel(${n}, 2) = "${f.cant}"`,
          `datosExcel(${n}, 3) = "${f.um}"`,
          `datosExcel(${n}, 4) = "${f.lgobe}"`,
          `datosExcel(${n}, 5) = "${f.charg}"`,
          `datosExcel(${n}, 6) = "${f.name1}"`,
          `datosExcel(${n}, 7) = "${f.umname1}"`,
          `datosExcel(${n}, 8) = "${f.umlgobe}"`,
          `datosExcel(${n}, 9) = "${f.umcha}"`
        ].join(' : ');
      }).join('\r\n    ')
    : `totalDatos = 0`;

  const vbs = `' =========================================================================
' BOT SAP GUI (.VBS): TRASPASO MIGO POR BLOQUES (ESCANER VISUAL 2 FASES)
' CIAL Alimentos - Traspaso SDIF -> SGSJ (Accion A08 / R10 / Mov 301)
' Adaptado desde BotMigo_PorBloques para ejecucion directa o desde Excel
' =========================================================================
Option Explicit

' --- 1. CONFIGURACION DE COLUMNAS MIGO ---
Dim cMAKTX, cERFMG, cERFME, cLGOBE, cCHARG, cNAME1, cUMNAME1, cUMLGOBE, cUMCHA
cMAKTX   = "0" ' Material
cERFMG   = "1" ' Cantidad
cERFME   = "2" ' Unidad de medida
cLGOBE   = "3" ' Almacen Origen (SDIF)
cCHARG   = "4" ' Lote Origen
cNAME1   = "5" ' Centro Origen (SGSJ)
cUMNAME1 = "6" ' Centro Destino (SGSJ)
cUMLGOBE = "7" ' Almacen Destino (NCD1)
cUMCHA   = "8" ' Lote Destino

' --- 2. CONECTAR A SAP GUI ---
Dim SapGuiAuto, app, connection, session
On Error Resume Next
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Or Not IsObject(SapGuiAuto) Then
    MsgBox "No se encontro SAP GUI abierto. Abre SAP Logon e inicia sesion en CIAL.", vbCritical, "Error SAP"
    WScript.Quit 1
End If

Set app = SapGuiAuto.GetScriptingEngine
Dim conn
For Each conn In app.Children
    If conn.Children.Count > 0 Then
        Set connection = conn
        Set session = connection.Children(0)
        Exit For
    End If
Next
On Error GoTo 0

If Not IsObject(session) Then
    MsgBox "No se encontro una sesion activa de SAP.", vbCritical, "Error SAP"
    WScript.Quit 1
End If

' --- 3. CARGAR DATOS (PRE-CARGADOS DESDE NEXUS ZONALES O DESDE EXCEL ACTIVO) ---
Dim datosExcel()
Dim totalDatos, i, j
${preloadCode}

' Si no vienen datos incrustados desde la web, intentar leer de la hoja activa de Excel
If totalDatos = 0 Then
    Dim xlApp, ws, ultimaFila
    On Error Resume Next
    Set xlApp = GetObject(, "Excel.Application")
    If Err.Number = 0 And IsObject(xlApp) Then
        If Not xlApp.ActiveWorkbook Is Nothing Then
            Set ws = xlApp.ActiveWorkbook.ActiveSheet
            ultimaFila = ws.Cells(ws.Rows.Count, "A").End(-4162).Row ' xlUp
            If ultimaFila >= 2 Then
                ReDim datosExcel(1 To ultimaFila, 1 To 9)
                For i = 2 To ultimaFila
                    If ValNum(ws.Cells(i, 2).Value) > 0 And Trim(CStr(ws.Cells(i, 1).Value)) <> "" Then
                        totalDatos = totalDatos + 1
                        datosExcel(totalDatos, 1) = Trim(CStr(ws.Cells(i, 1).Value))
                        datosExcel(totalDatos, 2) = Trim(CStr(ws.Cells(i, 2).Value))
                        datosExcel(totalDatos, 3) = Trim(CStr(ws.Cells(i, 3).Value))
                        datosExcel(totalDatos, 4) = Trim(CStr(ws.Cells(i, 4).Value))
                        datosExcel(totalDatos, 5) = Trim(CStr(ws.Cells(i, 5).Value))
                        datosExcel(totalDatos, 6) = Trim(CStr(ws.Cells(i, 6).Value))
                        datosExcel(totalDatos, 7) = Trim(CStr(ws.Cells(i, 7).Value))
                        datosExcel(totalDatos, 8) = Trim(CStr(ws.Cells(i, 8).Value))
                        datosExcel(totalDatos, 9) = Trim(CStr(ws.Cells(i, 9).Value))
                    End If
                Next
            End If
        End If
    End If
    On Error GoTo 0
End If

If totalDatos = 0 Then
    MsgBox "No hay registros conciliados de SDIF ni una planilla Excel activa con filas para procesar en MIGO.", vbExclamation, "Sin datos para MIGO"
    WScript.Quit 0
End If

Dim resp
resp = MsgBox("Se cargaran " & totalDatos & " registros en MIGO (Traspaso A08 / R10 / Mov. 301) mediante Escaner Visual por bloques." & vbCrLf & vbCrLf & _
              "¿Deseas iniciar la carga en SAP?", vbYesNo + vbQuestion, "Bot MIGO Por Bloques")
If resp <> vbYes Then WScript.Quit 0

' --- 4. INICIAR TRANSACCION MIGO ---
session.findById("wnd[0]").maximize
If session.Info.Transaction <> "MIGO" Then
    On Error Resume Next
    session.findById("wnd[0]/tbar[0]/okcd").Text = "/nMIGO"
    session.findById("wnd[0]").sendVKey 0
    On Error GoTo 0
    WScript.Sleep 1000
End If

' --- 5. CONFIGURAR CABECERA MIGO (A08 / R10 / 301) ---
Call ConfigurarCabeceraMIGO(session, "A08", "R10", "301")
WScript.Sleep 1000

' --- 6. PROCESAMIENTO ESCANER (100% VISUAL EN 2 FASES) ---
Dim indiceActual, fallosConsecutivos, tID, tablaMigo
indiceActual = 1
fallosConsecutivos = 0

Do While indiceActual <= totalDatos
    tID = ObtenerRutaTablaMIGO(session)
    If tID = "" Then
        MsgBox "No se encontro la tabla de posiciones de MIGO.", vbCritical, "Tabla Perdida"
        WScript.Quit 1
    End If
    Set tablaMigo = session.findById(tID)

    ' Escanear todas las celdas vacias y editables en la vista actual
    Dim emptyRows()
    ReDim emptyRows(tablaMigo.VisibleRowCount)
    Dim emptyCount, r, celdaMaterial
    emptyCount = 0

    For r = 0 To tablaMigo.VisibleRowCount - 1
        Set celdaMaterial = Nothing
        On Error Resume Next
        Set celdaMaterial = session.findById(tID & "/ctxtGOITEM-MAKTX[" & cMAKTX & "," & r & "]")
        On Error GoTo 0

        If Not celdaMaterial Is Nothing Then
            If Trim(celdaMaterial.Text) = "" And celdaMaterial.Changeable Then
                emptyRows(emptyCount) = r
                emptyCount = emptyCount + 1
            End If
        End If
    Next

    If emptyCount > 0 Then
        fallosConsecutivos = 0

        Dim numToFill, guiRow
        numToFill = emptyCount
        If numToFill > (totalDatos - indiceActual + 1) Then
            numToFill = totalDatos - indiceActual + 1
        End If

        ' FASE 1: Llenar Material, Cantidad, UM, Almacenes y Centros
        For j = 0 To numToFill - 1
            guiRow = emptyRows(j)
            On Error Resume Next
            session.findById(tID & "/ctxtGOITEM-MAKTX[" & cMAKTX & "," & guiRow & "]").Text     = datosExcel(indiceActual + j, 1)
            session.findById(tID & "/txtGOITEM-ERFMG[" & cERFMG & "," & guiRow & "]").Text      = datosExcel(indiceActual + j, 2)
            session.findById(tID & "/ctxtGOITEM-ERFME[" & cERFME & "," & guiRow & "]").Text     = datosExcel(indiceActual + j, 3)
            session.findById(tID & "/ctxtGOITEM-LGOBE[" & cLGOBE & "," & guiRow & "]").Text     = datosExcel(indiceActual + j, 4)
            session.findById(tID & "/ctxtGOITEM-NAME1[" & cNAME1 & "," & guiRow & "]").Text     = datosExcel(indiceActual + j, 6)
            session.findById(tID & "/ctxtGOITEM-UMNAME1[" & cUMNAME1 & "," & guiRow & "]").Text = datosExcel(indiceActual + j, 7)
            session.findById(tID & "/ctxtGOITEM-UMLGOBE[" & cUMLGOBE & "," & guiRow & "]").Text = datosExcel(indiceActual + j, 8)
            On Error GoTo 0
        Next

        ' Enter para que SAP valide el material y desbloquee los campos de lote
        session.findById("wnd[0]").sendVKey 0
        Call EsperarSincronizacion(session)

        ' FASE 2: Lotes Origen y Destino
        tID = ObtenerRutaTablaMIGO(session)
        For j = 0 To numToFill - 1
            guiRow = emptyRows(j)
            On Error Resume Next
            If datosExcel(indiceActual + j, 5) <> "" Then
                session.findById(tID & "/ctxtGOITEM-CHARG[" & cCHARG & "," & guiRow & "]").Text = datosExcel(indiceActual + j, 5)
            End If
            If datosExcel(indiceActual + j, 9) <> "" Then
                session.findById(tID & "/ctxtGOITEM-UMCHA[" & cUMCHA & "," & guiRow & "]").Text = datosExcel(indiceActual + j, 9)
            End If
            On Error GoTo 0
        Next

        ' Enter final para asegurar el bloque
        session.findById("wnd[0]").sendVKey 0
        Call EsperarSincronizacion(session)

        indiceActual = indiceActual + numToFill
    Else
        fallosConsecutivos = fallosConsecutivos + 1
        If fallosConsecutivos > 3 Then
            MsgBox "MIGO no esta generando filas nuevas. Verifica si hay un mensaje de error o advertencia bloqueando la pantalla en SAP.", vbCritical, "Carga Detenida"
            WScript.Quit 1
        End If

        session.findById("wnd[0]").sendVKey 0
        Call EsperarSincronizacion(session)
        ' Salto de pagina (PageDown = VKey 82)
        session.findById("wnd[0]").sendVKey 82
        WScript.Sleep 1000
    End If
Loop

MsgBox "Carga masiva en MIGO finalizada con exito. Se procesaron " & totalDatos & " registros con el Escaner Visual.", vbInformation, "Exito MIGO"
WScript.Quit 0

' --- FUNCIONES AUXILIARES DINAMICAS PARA MIGO ---
Sub ConfigurarCabeceraMIGO(sess, accion, refDoc, bwart)
    Dim arrMain, subMain
    arrMain = Array("0006", "0008", "0007", "0005", "0004", "0003")
    On Error Resume Next
    For Each subMain In arrMain
        sess.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:" & subMain & "/subSUB_FIRSTLINE:SAPLMIGO:0010/cmbGODYNPRO-ACTION").Key = accion
        sess.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:" & subMain & "/subSUB_FIRSTLINE:SAPLMIGO:0010/cmbGODYNPRO-REFDOC").Key = refDoc
        sess.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:" & subMain & "/subSUB_HEADER:SAPLMIGO:0101/subSUB_HEADER:SAPLMIGO:0100/tabsTS_GOHEAD/tabpOK_GOHEAD_GENERAL/ssubSUB_TS_GOHEAD_GENERAL:SAPLMIGO:0112/ctxtGOHEAD-BWARTWA").Text = bwart
    Next
    sess.findById("wnd[0]").sendVKey 0
    On Error GoTo 0
End Sub

Function ObtenerRutaTablaMIGO(sess)
    Dim arrMain, arrItem, subMain, subItem, tmpTable
    arrMain = Array("0008", "0006", "0007", "0005", "0004", "0003")
    arrItem = Array("0200", "0201", "0202", "0203", "0204")
    On Error Resume Next
    For Each subMain In arrMain
        For Each subItem In arrItem
            Set tmpTable = Nothing
            Set tmpTable = sess.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:" & subMain & "/subSUB_ITEMLIST:SAPLMIGO:" & subItem & "/tblSAPLMIGOTV_GOITEM")
            If Not tmpTable Is Nothing Then
                ObtenerRutaTablaMIGO = "wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:" & subMain & "/subSUB_ITEMLIST:SAPLMIGO:" & subItem & "/tblSAPLMIGOTV_GOITEM"
                Exit Function
            End If
        Next
    Next
    On Error GoTo 0
    ObtenerRutaTablaMIGO = ""
End Function

Function ValNum(v)
    On Error Resume Next
    If IsNumeric(v) Then
        ValNum = CDbl(v)
    Else
        ValNum = 0
    End If
    On Error GoTo 0
End Function

Sub EsperarSincronizacion(sess)
    On Error Resume Next
    Dim k
    For k = 1 To 150
        If Not sess.Busy Then Exit For
        WScript.Sleep 100
    Next
    On Error GoTo 0
End Sub
`;

  downloadVbsFile('Bot_MIGO_Traspaso_SDIF.vbs', vbs);
}
