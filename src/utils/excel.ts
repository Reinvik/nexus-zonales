import * as XLSX from 'xlsx';
import { Desviacion, Product } from '../types';
import { formatChileanDate } from './date';

/**
 * Exporta el consolidado general de desviaciones a un archivo Excel (.xlsx)
 * con pestañas estructuradas idénticas a los requerimientos de Control de Existencias CIAL.
 * Orden exacto para Faltantes:
 * Zonal | Alm. | SKU | Descripción | UMV | Cant. | Kilos | Cod. Cliente | Nombre Cliente | N° Fact. SAP | Folio Ref. | Lote | Sector | Transporte | Fecha Dig-
 */
export const exportDeviationsToExcel = (items: Desviacion[], fileNamePrefix = 'Consolidado_Zonales') => {
  const wb = XLSX.utils.book_new();

  // 1. Faltantes (Orden exacto oficial CIAL)
  const faltantes = items.filter(i => i.tipo === 'faltante');
  const faltantesRows = faltantes.map(f => ({
    'Zonal': f.zonal,
    'Alm.': f.almacen,
    'SKU': f.sku,
    'Descripción': f.descripcion,
    'UMV': f.umv || 'UN',
    'Cant.': Number(f.cantidad || 0),
    'Kilos': Number(f.kilos || 0),
    'Cod. Cliente': f.cod_cliente || '',
    'Nombre Cliente': f.nombre_cliente || '',
    'N° Fact. SAP': f.num_factura || '',
    'Folio Ref.': f.folio_ref || '',
    'Lote': f.lote || '',
    'Sector': f.sector || '',
    'Transporte': f.transporte || '',
    'Fecha Dig-': formatChileanDate(f.fecha_dig || f.fecha),
    'Llegada Camión': f.fecha_llegada_camion ? `${formatChileanDate(f.fecha_llegada_camion)} ${f.hora_llegada_camion || ''}`.trim() : '',
    'Pallets Recibidos': f.pallets_recibidos ?? '',
    'Bandejas Recibidas': f.bandejas_recibidas ?? '',
    'NOTA CRÉDITO': f.estado_nc || 'Pendiente',
    'Anotaciones': f.anotaciones || '',
    'Semana': f.semana || ''
  }));
  const wsFaltantes = XLSX.utils.json_to_sheet(faltantesRows);
  XLSX.utils.book_append_sheet(wb, wsFaltantes, 'Faltantes');

  // 2. Sobrantes
  const sobrantes = items.filter(i => i.tipo === 'sobrante');
  const sobrantesRows = sobrantes.map(s => ({
    'Referencia': `${s.zonal}-${formatChileanDate(s.fecha_dig || s.fecha)}`,
    'Zonal': s.zonal,
    'Alm.': s.almacen,
    'SKU': s.sku,
    'Descripción': s.descripcion,
    'UMV': s.umv || 'UN',
    'Cant.': Number(s.cantidad || 0),
    'Kilos': Number(s.kilos || 0),
    'Lote': s.lote || '',
    'Sector': s.sector || '',
    'Transporte': s.transporte || '',
    'Fecha Dig-': formatChileanDate(s.fecha_dig || s.fecha),
    'Llegada Camión': s.fecha_llegada_camion ? `${formatChileanDate(s.fecha_llegada_camion)} ${s.hora_llegada_camion || ''}`.trim() : '',
    'Pallets Recibidos': s.pallets_recibidos ?? '',
    'Bandejas Recibidas': s.bandejas_recibidas ?? '',
    'Comentario': s.anotaciones || '',
    'Semana': s.semana || ''
  }));
  const wsSobrantes = XLSX.utils.json_to_sheet(sobrantesRows);
  XLSX.utils.book_append_sheet(wb, wsSobrantes, 'Sobrantes');

  // 3. Daño Mecánico
  const dano = items.filter(i => i.tipo === 'dano_mecanico');
  const danoRows = dano.map(d => ({
    'Zonal': d.zonal,
    'Almacén': d.almacen,
    'SKU': d.sku,
    'Descripción': d.descripcion,
    'UMV': d.umv || 'UN',
    'Cant.': Number(d.cantidad || 0),
    'Kilos': Number(d.kilos || 0),
    'Lote': d.lote || '',
    'Sector': d.sector || '',
    'Transporte': d.transporte || '',
    'Fecha Dig-': formatChileanDate(d.fecha_dig || d.fecha),
    'Llegada Camión': d.fecha_llegada_camion ? `${formatChileanDate(d.fecha_llegada_camion)} ${d.hora_llegada_camion || ''}`.trim() : '',
    'Pallets Recibidos': d.pallets_recibidos ?? '',
    'Bandejas Recibidas': d.bandejas_recibidas ?? '',
    'Anotaciones': d.anotaciones || '',
    'Semana': d.semana || ''
  }));
  const wsDano = XLSX.utils.json_to_sheet(danoRows);
  XLSX.utils.book_append_sheet(wb, wsDano, 'Daño Mecanico');

  // 4. Transporte
  const transp = items.filter(i => i.tipo === 'transporte');
  const transpRows = transp.map(t => ({
    'Zonal': t.zonal,
    'Almacén': t.almacen,
    'SKU': t.sku,
    'Descripción': t.descripcion,
    'UMV': t.umv || 'UN',
    'Cant.': Number(t.cantidad || 0),
    'Kilos': Number(t.kilos || 0),
    'Transporte': t.transporte || '',
    'Lote': t.lote || '',
    'Sector': t.sector || '',
    'Fecha Dig-': formatChileanDate(t.fecha_dig || t.fecha),
    'Llegada Camión': t.fecha_llegada_camion ? `${formatChileanDate(t.fecha_llegada_camion)} ${t.hora_llegada_camion || ''}`.trim() : '',
    'Pallets Recibidos': t.pallets_recibidos ?? '',
    'Bandejas Recibidas': t.bandejas_recibidas ?? '',
    'Anotaciones': t.anotaciones || '',
    'Semana': t.semana || ''
  }));
  const wsTransp = XLSX.utils.json_to_sheet(transpRows);
  XLSX.utils.book_append_sheet(wb, wsTransp, 'Transportes');

  // 5. Producto Cambiado
  const cambiados = items.filter(i => i.tipo === 'producto_cambiado');
  const cambiadosRows = cambiados.map(c => ({
    'Zonal': c.zonal,
    'Almacén': c.almacen,
    'SKU Esperado': c.sku,
    'Descripción Esperada': c.descripcion,
    'SKU Recibido (Físico)': c.producto_cambiado_sku || '',
    'Descripción Recibida': c.producto_cambiado_desc || '',
    'Cant.': Number(c.cantidad || 0),
    'Kilos': Number(c.kilos || 0),
    'Lote': c.lote || '',
    'Sector': c.sector || '',
    'Transporte': c.transporte || '',
    'N° Fact. SAP': c.num_factura || '',
    'Folio Ref.': c.folio_ref || '',
    'Fecha Dig-': formatChileanDate(c.fecha_dig || c.fecha),
    'Llegada Camión': c.fecha_llegada_camion ? `${formatChileanDate(c.fecha_llegada_camion)} ${c.hora_llegada_camion || ''}`.trim() : '',
    'Anotaciones': c.anotaciones || '',
    'Semana': c.semana || ''
  }));
  const wsCambiados = XLSX.utils.json_to_sheet(cambiadosRows);
  XLSX.utils.book_append_sheet(wb, wsCambiados, 'Productos Cambiados');

  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileNamePrefix}_${todayStr}.xlsx`);
};

/**
 * Parsea texto tabulado proveniente de portapapeles (Ctrl+V desde Excel)
 */
export const parsePastedMasterData = (rawText: string): { products: Product[]; errors: string[] } => {
  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const products: Product[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    return { products: [], errors: ['No se detectó contenido para procesar.'] };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
  const firstRowCols = lines[0].split(delimiter).map(c => c.trim().toLowerCase());
  let startIdx = 0;
  
  let idxSku = -1;
  let idxDesc = -1;
  let idxUmv = -1;
  let idxBruto = -1;
  let idxNeto = -1;
  let idxEstado = -1;
  let idxTipoPeso = -1;
  let idxCategoria = -1;

  for (let c = 0; c < firstRowCols.length; c++) {
    const colName = firstRowCols[c];
    if (colName.includes('material') || colName.includes('sku') || colName.includes('codigo') || colName.includes('código')) {
      idxSku = c;
    } else if (colName.includes('texto') || colName.includes('descrip')) {
      idxDesc = c;
    } else if (colName.includes('um') || colName.includes('unidad') || colName.includes('medida')) {
      idxUmv = c;
    } else if (colName.includes('bruto')) {
      idxBruto = c;
    } else if (colName.includes('neto')) {
      idxNeto = c;
    } else if (colName.includes('estado')) {
      idxEstado = c;
    } else if (colName.includes('tipo') || colName.includes('peso')) {
      idxTipoPeso = c;
    } else if (colName.includes('cat') || colName.includes('familia') || colName.includes('grupo')) {
      idxCategoria = c;
    }
  }

  const hasHeader = idxSku !== -1 || idxDesc !== -1;
  if (hasHeader) {
    startIdx = 1;
  } else {
    idxSku = 0;
    idxDesc = 1;
    idxUmv = 2;
    idxBruto = 3;
    idxNeto = 4;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = lines[i].split(delimiter).map(c => c.trim());
    const skuRaw = idxSku >= 0 && cols[idxSku] ? cols[idxSku].replace(/^0+/, '') || cols[idxSku] : (cols[0] || '');
    const cleanSku = skuRaw.trim();

    if (!cleanSku || isNaN(Number(cleanSku))) {
      continue;
    }

    const desc = (idxDesc >= 0 && cols[idxDesc]) ? cols[idxDesc] : (cols[1] || 'Sin descripción');
    const umv = (idxUmv >= 0 && cols[idxUmv]) ? cols[idxUmv].toUpperCase() : 'UN';
    const bruto = (idxBruto >= 0 && cols[idxBruto]) ? parseFloat(cols[idxBruto].replace(',', '.')) || 0 : 0;
    const neto = (idxNeto >= 0 && cols[idxNeto]) ? parseFloat(cols[idxNeto].replace(',', '.')) || 0 : 0;
    const estado = (idxEstado >= 0 && cols[idxEstado]) ? cols[idxEstado] : 'Activo';
    const tipoPeso = (idxTipoPeso >= 0 && cols[idxTipoPeso]) ? cols[idxTipoPeso] : (bruto > 0 && bruto % 1 !== 0 ? 'Peso Variable' : 'Peso Standard');
    const categoria = (idxCategoria >= 0 && cols[idxCategoria]) ? cols[idxCategoria] : 'GENERAL';

    products.push({
      sku: cleanSku,
      descripcion: desc,
      estado,
      bruto: Math.round(bruto * 1000) / 1000,
      neto: Math.round(neto * 1000) / 1000,
      unidad: umv,
      um_venta: umv,
      tipo_peso: tipoPeso,
      categoria
    });
  }

  if (products.length === 0) {
    errors.push('No se pudieron extraer productos válidos. Asegúrate de incluir el código SKU y la descripción.');
  }

  return { products, errors };
};
