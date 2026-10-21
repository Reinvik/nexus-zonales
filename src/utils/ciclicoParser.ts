import * as XLSX from 'xlsx';
import { 
  CiclicoMetadata, 
  InventarioItemConsolidado, 
  EstadoDiferencia, 
  Conciliacion999Info, 
  ConciliacionSdifInfo,
  CiclicoTotales,
  SupervisorRevision
} from '../types/ciclico';
import { Product } from '../types';
import { FACTORES_EMPAQUE } from '../data/factoresEmpaque';

/**
 * Parsea un número en formato chileno / SAP (ej: "40,000", "1.258.750", "-475.000", "4.924,000")
 */
export function parseChileanNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let s = String(val).trim();
  if (!s || s === '-' || s === '0') return 0;

  // Si tiene formato con puntos de miles y comas decimales (ej: 4.924,000 o -1.258.750)
  // Caso 1: tiene coma y punto, p.ej. 4.924,000
  if (s.includes('.') && s.includes(',')) {
    // Si la coma está después del punto, punto es mil y coma decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Caso inverso (coma mil, punto decimal)
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Si solo tiene coma: en SAP "40,000" suele ser 40 con 3 decimales
    // pero si tiene 3 dígitos tras la coma, es decimal: 40,000 -> 40
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    // Si solo tiene punto:
    // En números como "475.000" o "-1.258.750", el punto representa separador de miles!
    // Si tiene exactamente 3 dígitos tras el punto y no tiene decimales explícitos,
    // o supera 1000 en monto:
    const parts = s.split('.');
    if (parts.length > 2) {
      // Múltiples puntos, ej -1.258.750 -> miles
      s = s.replace(/\./g, '');
    } else if (parts[1] && parts[1].length === 3) {
      // Podría ser mil (475.000 = cuatrocientos setenta y cinco mil pesos)
      // En precios / montos de SAP en Chile se usan pesos enteros sin centavos.
      s = s.replace('.', '');
    }
  }

  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Mapeo de prefijos de lote zonal a nombre de sucursal
 */
export const ZONAL_PREFIX_MAP: Record<string, string> = {
  'ANSJ': 'Antofagasta',
  'ARSJ': 'Arica',
  'IQSJ': 'Iquique',
  'CPSJ': 'Copiapó',
  'LSSJ': 'La Serena',
  'LASJ': 'La Serena',
  'OVSJ': 'Ovalle',
  'VMSJ': 'Viña del Mar',
  'VASJ': 'Valparaíso',
  'SFSJ': 'San Felipe',
  'RGSJ': 'Rancagua',
  'SCSJ': 'Santa Cruz',
  'TLSJ': 'Talca',
  'CRSJ': 'Curicó',
  'LNSJ': 'Linares',
  'CNSJ': 'Chillán',
  'CHSJ': 'Chillán',
  'CCSJ': 'Concepción',
  'LOSJ': 'Los Ángeles',
  'TMSJ': 'Temuco',
  'VDSJ': 'Valdivia',
  'OSSJ': 'Osorno',
  'PMSJ': 'Puerto Montt',
  'CASJ': 'Castro',
  'CYSJ': 'Coyhaique',
  'PASJ': 'Punta Arenas'
};

/**
 * Deduce la Zonal a partir del lote (ej: "ANSJ1410" -> "Antofagasta")
 */
export function inferZonalFromLote(lote: string): string {
  if (!lote) return '';
  const upper = lote.toUpperCase().trim();
  for (const [prefix, name] of Object.entries(ZONAL_PREFIX_MAP)) {
    if (upper.startsWith(prefix)) return name;
  }
  return '';
}

/**
 * Extrae el factor de empaque (unidades por caja) desde la descripción del material o del catálogo
 */
/**
 * Factores de empaque (UN por CJ). El maestro (src/data/factoresEmpaque.ts) tiene prioridad
 * sobre la inferencia por texto de la descripción. Los overrides manuales pisan al maestro.
 */
export const FACTOR_EMPAQUE_OVERRIDES: Record<string, number> = {};

export function extractPackagingFactor(desc: string, _sku?: string, _productsMap?: Map<string, Product>): number {
  const skuKey = _sku ? String(_sku).trim().replace(/^0+/, '') : '';
  const overrideFactor = skuKey ? (FACTOR_EMPAQUE_OVERRIDES[skuKey] ?? FACTORES_EMPAQUE[skuKey]) : undefined;
  if (overrideFactor) return overrideFactor;
  if (!desc) return 1;

  // Evitar confundir calibres con unidades (ej. "calibre 7x7")
  const cleanDesc = desc.replace(/calibre\s*\d+\s*[xX]\s*\d+/gi, '');

  // 1. Caso triple: "4x10x100" -> 4 * 10 = 40
  const tripleMatch = cleanDesc.match(/(\d+)\s*[xX]\s*(\d+)\s*[xX]/);
  if (tripleMatch) {
    return parseInt(tripleMatch[1], 10) * parseInt(tripleMatch[2], 10);
  }

  // 2. Caso estándar: "24x90", "20x500", "5x1 kg", "10x1 kg", "14x250", "50x48", "3 UNIDADES 25x120"
  // Buscamos (\d+) seguido de X y tamaño
  const match = cleanDesc.match(/(\d+)\s*[xX]\s*(?:\d+|[\d,.]+\s*(?:KG|GR|G|K|LB))/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val > 0 && val <= 500) return val;
  }

  // 3. Caso "3 UNIDADES" u otros patrones numéricos
  const unMatch = cleanDesc.match(/(\d+)\s*(?:UNIDADES|UNID|UN|PZA|PZAS)\b/i);
  if (unMatch) {
    const val = parseInt(unMatch[1], 10);
    if (val > 1) return val;
  }

  return 1;
}

/**
 * Parsea el reporte del Monitor de Inventario por Posición (texto copiado o TSV)
 */
export function parseCiclicoRawText(text: string): {
  metadata: CiclicoMetadata;
  rows: any[];
} {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const metadata: CiclicoMetadata = {
    titulo: 'Monitor de Inventario por posición',
    almacen: 'NCD',
    tip_alm: 'PCG'
  };

  const dataRows: any[] = [];
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar metadatos en cabecera
    if (line.includes('Fecha Reporte:') || line.includes('Usuario:')) {
      const fechaMatch = line.match(/Fecha\s*Reporte:\s*([\d\/\-\.]+)/i);
      if (fechaMatch) metadata.fecha_reporte = fechaMatch[1];
      const horaMatch = line.match(/Hora:\s*([\d\:]+)/i);
      if (horaMatch) metadata.hora_reporte = horaMatch[1];
      const userMatch = line.match(/Usuario:\s*([^\s]+)/i);
      if (userMatch) metadata.usuario = userMatch[1];
    }

    // Detectar fila de encabezados
    if (line.includes('Docto.') && (line.includes('Material') || line.includes('Ubicación') || line.includes('Cant. Sistema'))) {
      headerIndex = i;
      headers = line.split('\t').map(h => h.trim().toLowerCase());
      continue;
    }

    if (headerIndex !== -1 && i > headerIndex) {
      const cols = line.split('\t');
      // Si la fila no tiene columnas suficientes, ignorar
      if (cols.length < 5) continue;

      // Si es la fila de totales finales (ej: "4.924,000 4.729,000 -3,000 ...")
      if (cols.every(c => !c.trim() || !isNaN(Number(c.trim().replace(/\./g, '').replace(',', '.'))))) {
        const hasNumbers = cols.filter(c => c.trim().length > 0);
        if (hasNumbers.length > 0 && hasNumbers.length <= 6) {
          // Es la fila de totales, omitir del detalle
          continue;
        }
      }

      dataRows.push(cols);
    }
  }

  // Si no encontró cabecera con tabulaciones, intentar parsing directo de columnas estándar
  if (dataRows.length === 0 && lines.length > 0) {
    for (const line of lines) {
      if (line.startsWith('Docto') || line.startsWith('Monitor') || line.startsWith('Fecha')) continue;
      const cols = line.split('\t');
      if (cols.length >= 8) {
        dataRows.push(cols);
      }
    }
  }

  return { metadata, rows: dataRows };
}

/**
 * Parsea el reporte de Almacén 999 (Diferencias CD)
 */
export function parse999RawText(text: string): any[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rows: any[] = [];
  let isAfterHeader = false;

  for (const line of lines) {
    if (line.toLowerCase().includes('material') && line.toLowerCase().includes('stock disponible')) {
      isAfterHeader = true;
      continue;
    }
    if (!isAfterHeader && line.toLowerCase().includes('material')) {
      isAfterHeader = true;
      continue;
    }

    const cols = line.split('\t');
    if (cols.length >= 7) {
      const sku = cols[0]?.trim();
      if (!sku || isNaN(Number(sku))) continue;

      rows.push({
        sku,
        centro: cols[1]?.trim() || '',
        almacen: cols[2]?.trim() || '999',
        lote: cols[4]?.trim() || '',
        descripcion: cols[6]?.trim() || '',
        tipo_almacen: cols[7]?.trim() || '999',
        ubicacion: cols[8]?.trim() || '',
        stock_disponible: parseChileanNumber(cols[9]),
        um: cols[10]?.trim() || 'UN',
        fe_caduc: cols[11]?.trim() || '',
        peso: parseChileanNumber(cols[12])
      });
    }
  }

  return rows;
}

/**
 * Parsea el reporte de SDIF (Almacén de diferencias zonales)
 */
export function parseSdifRawText(text: string): any[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rows: any[] = [];
  let isAfterHeader = false;

  for (const line of lines) {
    if (line.toLowerCase().includes('material') && (line.toLowerCase().includes('libre utilización') || line.toLowerCase().includes('libre utilizacion'))) {
      isAfterHeader = true;
      continue;
    }

    const cols = line.split('\t');
    if (cols.length >= 5) {
      const sku = cols[0]?.trim();
      if (!sku || isNaN(Number(sku))) continue;

      rows.push({
        sku,
        descripcion: cols[1]?.trim() || '',
        libre_util: parseChileanNumber(cols[2]),
        um: cols[3]?.trim() || 'UN',
        lote: cols[4]?.trim() || '',
        almacen: cols[5]?.trim() || 'SDIF',
        valor: parseChileanNumber(cols[6]),
        zonal_estimada: inferZonalFromLote(cols[4]?.trim() || '')
      });
    }
  }

  return rows;
}

/**
 * Consolidación completa de Inventario Cíclico + Cruce 999 + Cruce SDIF
 */
const normSku = (s: any): string => String(s ?? '').trim().replace(/^0+/, '');

export function consolidarInventario(
  ciclicoRawRows: any[],
  almacen999Rows: any[],
  sdifRows: any[],
  productsList: Product[] = [],
  supervisorOverrides?: Record<string, { cant_contada: number; notas?: string; supervisor_nombre?: string }>
): {
  items: InventarioItemConsolidado[];
  totales: {
    total_sistema: number;
    total_contado: number;
    diferencia_neta: number;
    dif_precio_total: number;
    total_skus: number;
    total_faltantes: number;
    total_sobrantes: number;
    total_descuadre_lotes: number;
    total_cuadrados: number;
    sobrantes_conciliados_999: number;
    sobrantes_conciliados_sdif: number;
    monto_negativo?: number;
    monto_positivo?: number;
    monto_total_bruto?: number;
    monto_conciliado_999?: number;
    monto_conciliado_sdif?: number;
    monto_total_conciliado?: number;
    monto_final_descuadre?: number;
  };
} {
  const productsMap = new Map<string, Product>();
  productsList.forEach(p => productsMap.set(p.sku, p));

  // 1. Agrupar filas del cíclico por SKU
  const skuGroups = new Map<string, any[]>();

  for (const cols of ciclicoRawRows) {
    // Si la fila tiene el formato estándar de 19 columnas:
    // 0: Docto, 1: Status, 2: Version, 3: Almacen, 4: Tip.Alm, 5: Ubicacion, 
    // 6: Material (SKU), 7: Descripcion, 8: UM, 9: Lote, 10: Contador, 11: Clasif,
    // 12: UM, 13: Fecha, 14: Cant. Sistema, 15: Cant.alt.Conta, 16: Dife, 17: Precio, 18: Dif Precio
    const sku = cols[6]?.trim();
    if (!sku) continue;

    if (!skuGroups.has(sku)) {
      skuGroups.set(sku, []);
    }
    skuGroups.get(sku)!.push(cols);
  }

  // 2. Indexar datos de Almacén 999 por SKU
  const map999 = new Map<string, any[]>();
  for (const r of almacen999Rows) {
    const k = normSku(r.sku);
    if (!map999.has(k)) map999.set(k, []);
    map999.get(k)!.push({ ...r, stock_disponible: Number(r.stock_disponible) || 0 });
  }

  // 3. Indexar datos de SDIF por SKU
  const mapSdif = new Map<string, any[]>();
  for (const r of sdifRows) {
    const k = normSku(r.sku);
    if (!mapSdif.has(k)) mapSdif.set(k, []);
    mapSdif.get(k)!.push({ ...r, libre_util: Number(r.libre_util) || 0, valor: Number(r.valor) || 0 });
  }

  const items: InventarioItemConsolidado[] = [];
  let sumSistema = 0;
  let sumContado = 0;
  let sumDiferencia = 0;
  let sumDifPrecio = 0;
  let countFaltantes = 0;
  let countSobrantes = 0;
  let countDescuadreLotes = 0;
  let countCuadrados = 0;
  let countConciliados999 = 0;
  let countConciliadosSdif = 0;
  let sumMontoNegativo = 0;
  let sumMontoPositivo = 0;
  let sumMontoConciliado999 = 0;
  let sumMontoConciliadoSdif = 0;

  for (const [sku, rows] of skuGroups.entries()) {
    const first = rows[0];
    const docto = first[0]?.trim() || '';
    const almacen = first[3]?.trim() || 'NCD';
    const tip_alm = first[4]?.trim() || 'PCG';
    const ubicacion = first[5]?.trim() || '';
    const descripcion = first[7]?.trim() || '';
    const um = first[8]?.trim() || first[12]?.trim() || 'CJ';
    const precio = parseChileanNumber(first[17]);

    const factorEmpaque = extractPackagingFactor(descripcion, sku, productsMap);
    const prodCatalog = productsMap.get(sku);
    const pesoNetoUnit = prodCatalog?.neto || prodCatalog?.bruto || 0;

    let totalSistemaSku = 0;
    let totalContadoSku = 0;
    let totalDifeSku = 0;
    let totalDifPrecioSku = 0;
    let hasNonZeroLines = false;

    const lotesDesglose = rows.map(r => {
      const lote = r[9]?.trim() || 'SIN LOTE';
      const cant_sis = parseChileanNumber(r[14]);
      const cant_con = parseChileanNumber(r[15]);
      const dife = parseChileanNumber(r[16]);
      const linePrecio = parseChileanNumber(r[17]) || precio;
      const lineDifPrecio = r[18] ? parseChileanNumber(r[18]) : dife * factorEmpaque * linePrecio;

      totalSistemaSku += cant_sis;
      totalContadoSku += cant_con;
      totalDifeSku += dife;
      totalDifPrecioSku += lineDifPrecio;

      if (dife !== 0 || cant_sis !== 0 || cant_con !== 0) {
        hasNonZeroLines = true;
      }

      return {
        lote,
        cant_sistema: cant_sis,
        cant_contada: cant_con,
        diferencia: dife,
        precio: linePrecio,
        dif_precio: lineDifPrecio,
        um: r[8]?.trim() || um,
        fecha_lote: r[13]?.trim() || '',
        contador: r[10]?.trim() || '',
        clasificacion: r[11]?.trim() || ''
      };
    });

    // Si existe reconteo del supervisor para este SKU, se aplica como conteo efectivo
    const revSupervisor = supervisorOverrides?.[sku];
    let cantContadaFinal = totalContadoSku;
    let difeFinal = totalDifeSku;
    let difeUnidadesFinal = totalDifeSku * factorEmpaque;
    let difPrecioFinal = totalDifPrecioSku;
    let revisadoSupervisor = false;

    if (revSupervisor !== undefined) {
      cantContadaFinal = revSupervisor.cant_contada;
      difeFinal = cantContadaFinal - totalSistemaSku;
      difeUnidadesFinal = difeFinal * factorEmpaque;
      difPrecioFinal = difeUnidadesFinal * precio;
      revisadoSupervisor = true;
    }

    // Determinar Estado (En Picking el lote no importa: si la diferencia total es 0, el SKU está cuadrado)
    let estado: EstadoDiferencia = 'cuadrado';
    if (difeFinal < 0) {
      estado = 'faltante';
      countFaltantes++;
      sumMontoNegativo += difPrecioFinal;
    } else if (difeFinal > 0) {
      estado = 'sobrante';
      countSobrantes++;
      sumMontoPositivo += difPrecioFinal;
    } else {
      estado = 'cuadrado';
      countCuadrados++;
      if (hasNonZeroLines) {
        countDescuadreLotes++;
      }
    }

    sumSistema += totalSistemaSku;
    sumContado += cantContadaFinal;
    sumDiferencia += difeFinal;
    sumDifPrecio += difPrecioFinal;

    // Kilos equivalentes
    const kilosEquivalentes = pesoNetoUnit > 0 ? Number((difeUnidadesFinal * pesoNetoUnit).toFixed(2)) : 0;

    // Conciliación con Almacén 999 (Diferencias CD)
    // REGLA CIAL: La conciliación solo existe si hay sobrante en el cíclico (diferencia > 0)
    // y se puede conciliar hasta la cantidad del sobrante.
    let conciliacion999: Conciliacion999Info | undefined;
    let cajasConciliadas999 = 0;
    const items999 = (map999.get(normSku(sku)) || []).filter(it => it.stock_disponible > 0); // Los negativos son errores: se ignoran
    if (items999.length > 0) {
      const totalStock999 = items999.reduce((acc, curr) => acc + curr.stock_disponible, 0);
      const totalCajas999 = factorEmpaque > 0 ? Number((totalStock999 / factorEmpaque).toFixed(2)) : totalStock999;
      
      const haySobrante = difeFinal > 0;
      let esConciliado = false;
      let unidadesConciliadas = 0;
      let valorConciliado999 = 0;
      let accion = '';

      if (haySobrante && totalStock999 > 0) {
        // PRIORIDAD 999: solo stock positivo. Se concilia HASTA el monto del sobrante.
        // Las cajas en picking son enteras (sin decimales): Math.floor para no conciliar fracciones de caja.
        const maxCajasPosibles = factorEmpaque > 0 ? Math.floor(totalStock999 / factorEmpaque) : Math.floor(totalStock999);
        cajasConciliadas999 = Math.min(Math.floor(difeFinal), maxCajasPosibles);
        unidadesConciliadas = cajasConciliadas999 * factorEmpaque;
        valorConciliado999 = Math.round(cajasConciliadas999 * factorEmpaque * precio);
        if (cajasConciliadas999 > 0) {
          esConciliado = true;
          countConciliados999++;
          sumMontoConciliado999 += valorConciliado999;
          accion = `Conciliado con 999: ${cajasConciliadas999} CJ (${unidadesConciliadas} UN) del stock positivo en 999. Valor: $${valorConciliado999.toLocaleString('es-CL')}`;
        } else {
          accion = `Stock en 999 (${totalStock999} UN) insuficiente para completar 1 CJ entera (${factorEmpaque} UN/CJ).`;
        }
      } else if (difeFinal <= 0) {
        accion = `Sin sobrante en cíclico. Existencia en 999: ${totalCajas999} CJ (${totalStock999} UN). No aplica conciliación.`;
      } else {
        accion = `Registrado en 999 con stock 0.`;
      }

      conciliacion999 = {
        encontrado: true,
        es_conciliado: esConciliado,
        cajas_conciliadas: cajasConciliadas999,
        unidades_conciliadas: unidadesConciliadas,
        total_stock_disponible: totalStock999,
        total_cajas_equivalentes: totalCajas999,
        valor_conciliado: valorConciliado999,
        items: items999.map(it => ({
          centro: it.centro,
          almacen: it.almacen,
          lote: it.lote,
          ubicacion: it.ubicacion,
          stock_disponible: it.stock_disponible,
          um: it.um,
          fe_caduc: it.fe_caduc,
          peso: it.peso
        })),
        accion_sugerida: accion,
        es_compensable: esConciliado
      };
    }

    // Conciliación con Almacén SDIF (Diferencias Zonales)
    // REGLA CIAL CASCADA: Se concilia con el SOBRANTE REMANENTE tras haber conciliado primero con 999
    let conciliacionSdif: ConciliacionSdifInfo | undefined;
    const itemsSdif = mapSdif.get(normSku(sku));
    if (itemsSdif && itemsSdif.length > 0) {
      const totalLibreUtil = itemsSdif.reduce((acc, curr) => acc + curr.libre_util, 0);
      const totalCajasSdif = factorEmpaque > 0 ? Number((totalLibreUtil / factorEmpaque).toFixed(2)) : totalLibreUtil;
      const totalValorSdif = itemsSdif.reduce((acc, curr) => acc + curr.valor, 0);
      const zonalesList = Array.from(new Set(itemsSdif.map(i => i.zonal_estimada).filter(Boolean)));

      // Sobrante remanente disponible tras conciliar con 999
      const sobranteRemanenteParaSdif = Math.max(0, difeFinal - cajasConciliadas999);
      const haySobranteParaSdif = sobranteRemanenteParaSdif > 0 && totalCajasSdif > 0;
      let esConciliadoSdif = false;
      let cajasConciliadasSdif = 0;
      let unidadesConciliadasSdif = 0;
      let valorConciliadoSdif = 0;
      let accion = '';

      if (haySobranteParaSdif) {
        // Concilia hasta la cantidad del sobrante remanente (Cajas enteras sin decimales)
        const maxCajasSdifEnteras = factorEmpaque > 0 ? Math.floor(totalLibreUtil / factorEmpaque) : Math.floor(totalLibreUtil);
        cajasConciliadasSdif = Math.min(Math.floor(sobranteRemanenteParaSdif), maxCajasSdifEnteras);
        unidadesConciliadasSdif = cajasConciliadasSdif * factorEmpaque;
        valorConciliadoSdif = Math.round(cajasConciliadasSdif * factorEmpaque * precio);
        if (cajasConciliadasSdif > 0) {
          esConciliadoSdif = true;
          countConciliadosSdif++;
          sumMontoConciliadoSdif += valorConciliadoSdif;
          accion = `Conciliado con SDIF: ${cajasConciliadasSdif} CJ (${unidadesConciliadasSdif} UN) de saldo zonal tras cruce 999. Valor: $${valorConciliadoSdif.toLocaleString('es-CL')}`;
          if (zonalesList.length > 0) accion += ` Zonales: ${zonalesList.join(', ')}.`;
        } else {
          accion = `Saldo SDIF insuficiente para completar 1 CJ entera (${factorEmpaque} UN/CJ).`;
        }
      } else if (difeFinal > 0 && cajasConciliadas999 >= difeFinal) {
        accion = `Sobrante (+${difeFinal} CJ) compensado totalmente en Almacén 999. Registro informativo SDIF: ${totalCajasSdif} CJ (${totalLibreUtil} UN).`;
        if (zonalesList.length > 0) accion += ` Zonales: ${zonalesList.join(', ')}.`;
      } else if (difeFinal <= 0) {
        accion = `Sin sobrante en cíclico. Registro informativo SDIF: ${totalCajasSdif} CJ (${totalLibreUtil} UN) valorizado en $${totalValorSdif.toLocaleString('es-CL')}.`;
        if (zonalesList.length > 0) accion += ` Zonales: ${zonalesList.join(', ')}.`;
      } else {
        accion = `Registrado en SDIF con saldo 0.`;
      }

      conciliacionSdif = {
        encontrado: true,
        es_conciliado: esConciliadoSdif,
        cajas_conciliadas: cajasConciliadasSdif,
        unidades_conciliadas: unidadesConciliadasSdif,
        total_libre_util: totalLibreUtil,
        total_cajas_equivalentes: totalCajasSdif,
        total_valor: totalValorSdif,
        valor_conciliado: valorConciliadoSdif,
        items: itemsSdif.map(it => ({
          lote: it.lote,
          almacen: it.almacen,
          libre_util: it.libre_util,
          um: it.um,
          valor: it.valor,
          zonal_estimada: it.zonal_estimada
        })),
        accion_sugerida: accion
      };
    }

    items.push({
      sku,
      descripcion,
      ubicacion,
      almacen,
      tip_alm,
      docto,
      cant_sistema: totalSistemaSku,
      cant_contada: cantContadaFinal,
      diferencia: difeFinal,
      um,
      factor_empaque: factorEmpaque,
      diferencia_unidades: difeUnidadesFinal,
      kilos_equivalentes: kilosEquivalentes,
      precio_unitario: precio,
      dif_precio: difPrecioFinal,
      estado,
      lotes_desglose: lotesDesglose,
      conciliacion_999: conciliacion999,
      conciliacion_sdif: conciliacionSdif,
      revisado_supervisor: revisadoSupervisor,
      revision_supervisor: revisadoSupervisor ? {
        cant_contada_original: totalContadoSku,
        diferencia_original: totalDifeSku,
        cant_contada_supervisor: cantContadaFinal,
        diferencia_supervisor: difeFinal,
        notas: revSupervisor?.notas,
        supervisor_nombre: revSupervisor?.supervisor_nombre
      } : undefined
    });
  }

  // Ordenar de Mayor Diferencia a Mayor Sobrante:
  // Faltantes (< 0) -> Cuadrados (0) -> Sobrantes (> 0)
  items.sort((a, b) => {
    if (a.diferencia !== b.diferencia) {
      return a.diferencia - b.diferencia;
    }
    if (a.dif_precio !== b.dif_precio) {
      return a.dif_precio - b.dif_precio;
    }
    return Number(a.sku) - Number(b.sku);
  });

  return {
    items,
    totales: {
      total_sistema: sumSistema,
      total_contado: sumContado,
      diferencia_neta: sumDiferencia,
      dif_precio_total: sumDifPrecio,
      total_skus: items.length,
      total_faltantes: countFaltantes,
      total_sobrantes: countSobrantes,
      total_descuadre_lotes: countDescuadreLotes,
      total_cuadrados: countCuadrados,
      sobrantes_conciliados_999: countConciliados999,
      sobrantes_conciliados_sdif: countConciliadosSdif,
      monto_negativo: sumMontoNegativo,
      monto_positivo: sumMontoPositivo,
      monto_total_bruto: sumMontoNegativo + sumMontoPositivo,
      monto_conciliado_999: sumMontoConciliado999,
      monto_conciliado_sdif: sumMontoConciliadoSdif,
      monto_total_conciliado: sumMontoConciliado999 + sumMontoConciliadoSdif,
      monto_final_descuadre: (sumMontoNegativo + sumMontoPositivo) + (sumMontoConciliado999 + sumMontoConciliadoSdif)
    }
  };
}

/**
 * Exporta el reporte completo consolidado a un archivo Excel (.xlsx) estructurado
 */
export function exportarCiclicoAExcel(
  items: InventarioItemConsolidado[],
  metadata: CiclicoMetadata,
  totales: any
) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen Ejecutivo
  const resumenData = [
    ['INFORME DE INVENTARIO CÍCLICO Y CONCILIACIÓN ZONAL / CD'],
    ['CIAL ALIMENTOS S.A. — CONTROL DE EXISTENCIAS Y DESVIACIONES'],
    [],
    ['Fecha Reporte:', metadata.fecha_reporte || new Date().toLocaleDateString('es-CL')],
    ['Hora Reporte:', metadata.hora_reporte || new Date().toLocaleTimeString('es-CL')],
    ['Usuario Auditor:', metadata.usuario || 'AMELLA'],
    ['Almacén / Tipo:', `${metadata.almacen || 'NCD'} / ${metadata.tip_alm || 'PCG'}`],
    [],
    ['CUADRATURA CÍCLICO (PICKING)', '', ''],
    ['Negativo', 'Positivo', 'Total'],
    [totales.monto_negativo, totales.monto_positivo, totales.monto_total_bruto],
    [],
    ['CONCILIACIÓN CD & ZONALES', '', ''],
    ['Conciliado 999', 'Conciliado SDIF', 'Total'],
    [totales.monto_conciliado_999, totales.monto_conciliado_sdif, totales.monto_total_conciliado],
    [],
    ['Faltante Neto Final No Compensado ($):', totales.monto_final_descuadre, 'Saldo remanente tras cruce 999 y SDIF'],
    [],
    ['INDICADORES CLAVE (KPIs)', 'VALOR', 'UNIDAD / DETALLE'],
    ['Total SKUs Auditados', totales.total_skus, 'Productos evaluados en inventario'],
    ['Cantidad Total Sistema', totales.total_sistema, 'Cajas registradas en sistema'],
    ['Cantidad Total Contada', totales.total_contado, 'Cajas físicas contadas en terreno'],
    ['Diferencia Neta de Cajas', totales.diferencia_neta, totales.diferencia_neta === 0 ? 'Cuadrado exacto' : (totales.diferencia_neta < 0 ? 'Faltante Neto' : 'Sobrante Neto')],
    ['Impacto Financiero Neto ($)', totales.dif_precio_total, `$ ${totales.dif_precio_total.toLocaleString('es-CL')}`],
    ['SKUs con Faltante Real', totales.total_faltantes, 'Productos con descuadre negativo'],
    ['SKUs con Sobrante Real', totales.total_sobrantes, 'Productos con stock físico adicional'],
    ['SKUs Cuadrados (Neto 0)', totales.total_cuadrados, 'Productos con conteo cuadrado (el lote no afecta picking)'],
    ['Sobrantes Conciliados con Almacén 999', totales.sobrantes_conciliados_999, 'Cruces encontrados en diferencias CD'],
    ['Coincidencias con Almacén SDIF', totales.sobrantes_conciliados_sdif, 'Cruces encontrados en diferencias zonales'],
    [],
    ['DIAGNÓSTICO AUTOMÁTICO:'],
    [totales.diferencia_neta === 0 && totales.total_faltantes === 0 
      ? '✅ El inventario se encuentra 100% cuadrado en saldo neto.' 
      : `⚠️ Se detectó una diferencia neta de ${totales.diferencia_neta} cajas ($ ${totales.dif_precio_total.toLocaleString('es-CL')}). Se recomienda aplicar las acciones sugeridas con los almacenes 999 y SDIF.`]
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Ejecutivo');

  // Hoja 2: Informe de Diferencias a Sobrantes (Consolidado por SKU)
  const headersConsolidado = [
    'Material (SKU)',
    'Descripción del Material',
    'Ubicación',
    'Almacén',
    'Cant. Sistema (CJ)',
    'Cant. Contada (CJ)',
    'Diferencia (CJ)',
    'Factor Empaque (UN/CJ)',
    'Diferencia (UN)',
    'Kilos Eq.',
    'Precio Unitario ($)',
    'Dif. Precio Total ($)',
    'Estado Auditoría',
    'Almacén 999 (Diferencias CD)',
    'Almacén SDIF (Diferencias Zonales)'
  ];

  const rowsConsolidado = items.map(item => [
    item.sku,
    item.descripcion,
    item.ubicacion,
    item.almacen,
    item.cant_sistema,
    item.cant_contada,
    item.diferencia,
    item.factor_empaque,
    item.diferencia_unidades,
    item.kilos_equivalentes,
    item.precio_unitario,
    item.dif_precio,
    item.estado === 'descuadre_lotes' 
      ? 'Cruces Lote (Saldo 0)' 
      : item.estado === 'faltante' 
        ? 'Faltante Real' 
        : item.estado === 'sobrante' 
          ? 'Sobrante Real' 
          : 'Cuadrado',
    item.conciliacion_999?.es_conciliado 
      ? item.conciliacion_999.accion_sugerida 
      : (item.diferencia <= 0 ? 'No aplica (Sin sobrante en cíclico)' : (item.conciliacion_999?.encontrado ? `Ref. informativa: ${item.conciliacion_999.total_cajas_equivalentes} CJ (${item.conciliacion_999.total_stock_disponible} UN)` : 'Sin registro en 999')),
    item.conciliacion_sdif?.es_conciliado 
      ? item.conciliacion_sdif.accion_sugerida 
      : (item.diferencia <= 0 ? 'No aplica (Sin sobrante en cíclico)' : (item.conciliacion_sdif?.encontrado ? `Ref. informativa: ${item.conciliacion_sdif.total_cajas_equivalentes} CJ (${item.conciliacion_sdif.total_libre_util} UN)` : 'Sin registro en SDIF'))
  ]);

  const wsConsolidado = XLSX.utils.aoa_to_sheet([headersConsolidado, ...rowsConsolidado]);
  XLSX.utils.book_append_sheet(wb, wsConsolidado, 'Diferencias a Sobrantes');

  // Hoja 3: Detalle por Lote del Inventario Cíclico
  const headersLotes = [
    'Material (SKU)',
    'Descripción',
    'Ubicación',
    'Lote',
    'Fecha Lote',
    'Cant. Sistema',
    'Cant. Contada',
    'Diferencia',
    'Precio Unit.',
    'Dif. Precio ($)',
    'Contador',
    'Clasificación'
  ];

  const rowsLotes: any[] = [];
  for (const item of items) {
    for (const lot of item.lotes_desglose) {
      rowsLotes.push([
        item.sku,
        item.descripcion,
        item.ubicacion,
        lot.lote,
        lot.fecha_lote || '',
        lot.cant_sistema,
        lot.cant_contada,
        lot.diferencia,
        lot.precio,
        lot.dif_precio,
        lot.contador || '',
        lot.clasificacion || ''
      ]);
    }
  }

  const wsLotes = XLSX.utils.aoa_to_sheet([headersLotes, ...rowsLotes]);
  XLSX.utils.book_append_sheet(wb, wsLotes, 'Detalle por Lote');

  // Hoja 4: Conciliación Almacén 999 (Solo si hubo sobrantes conciliados)
  const headers999 = [
    'Material (SKU)',
    'Descripción',
    'Sobrante Cíclico (CJ)',
    'Cajas Conciliadas (CJ)',
    'Unidades Conciliadas (UN)',
    'Stock Disp. 999 (UN)',
    'Cajas Eq. 999 (CJ)',
    'Lote 999',
    'Ubicación 999',
    'Acción'
  ];

  const rows999: any[] = [];
  for (const item of items) {
    if (item.conciliacion_999?.es_conciliado) {
      for (const it of item.conciliacion_999.items) {
        rows999.push([
          item.sku,
          item.descripcion,
          item.diferencia,
          item.conciliacion_999.cajas_conciliadas,
          item.conciliacion_999.unidades_conciliadas,
          it.stock_disponible,
          item.factor_empaque > 0 ? Number((it.stock_disponible / item.factor_empaque).toFixed(2)) : it.stock_disponible,
          it.lote,
          it.ubicacion,
          item.conciliacion_999.accion_sugerida
        ]);
      }
    }
  }

  if (rows999.length > 0) {
    const ws999 = XLSX.utils.aoa_to_sheet([headers999, ...rows999]);
    XLSX.utils.book_append_sheet(wb, ws999, 'Conciliación 999');
  }

  // Hoja 5: Conciliación Almacén SDIF (Solo si hubo sobrantes conciliados)
  const headersSdif = [
    'Material (SKU)',
    'Descripción',
    'Sobrante Cíclico (CJ)',
    'Cajas Conciliadas (CJ)',
    'Unidades Conciliadas (UN)',
    'Total Libre Util. SDIF (UN)',
    'Total Cajas Eq. SDIF (CJ)',
    'Lote SDIF',
    'Zonal Origen',
    'Valor ($)',
    'Acción'
  ];

  const rowsSdif: any[] = [];
  for (const item of items) {
    if (item.conciliacion_sdif?.es_conciliado) {
      for (const it of item.conciliacion_sdif.items) {
        rowsSdif.push([
          item.sku,
          item.descripcion,
          item.diferencia,
          item.conciliacion_sdif.cajas_conciliadas,
          item.conciliacion_sdif.unidades_conciliadas,
          it.libre_util,
          item.factor_empaque > 0 ? Number((it.libre_util / item.factor_empaque).toFixed(2)) : it.libre_util,
          it.lote,
          it.zonal_estimada || 'Zonal no especificada',
          it.valor,
          item.conciliacion_sdif.accion_sugerida
        ]);
      }
    }
  }

  if (rowsSdif.length > 0) {
    const wsSdif = XLSX.utils.aoa_to_sheet([headersSdif, ...rowsSdif]);
    XLSX.utils.book_append_sheet(wb, wsSdif, 'Conciliación SDIF');
  }

  // Descargar archivo
  const fechaStr = (metadata.fecha_reporte || new Date().toISOString().split('T')[0]).replace(/[\/\:]/g, '-');
  XLSX.writeFile(wb, `Informe_Inventario_Ciclico_Conciliado_${fechaStr}.xlsx`);
}
