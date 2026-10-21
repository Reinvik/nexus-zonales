import { Product } from '../types';

/**
 * Extrae la información de empaque, unidades por caja y peso real de la caja o unidad.
 * Maneja los patrones de descripción CIAL:
 * - "8X1 KG" -> 8 UN x 1 KG = 8 KG
 * - "12X250 GR" -> 12 UN x 0.25 KG = 3 KG
 * - "4X10X100 GR" -> 40 UN x 0.1 KG = 4 KG
 * - "CAJA 24 UN" -> 24 UN
 * - "CAJA 3 KLS" con peso unitario
 */
export function getProductPackagingInfo(prod: {
  descripcion: string;
  um_venta?: string;
  unidad?: string;
  neto?: number;
  bruto?: number;
}): {
  um: string;
  factor: number;
  unidadesPorCajaText: string;
  pesoCaja: number;
  pesoUnitario: number;
  esCaja: boolean;
} {
  const um = (prod.um_venta || prod.unidad || 'UN').toUpperCase().trim();
  const esCaja = um === 'CJ';
  const clean = (prod.descripcion || '').replace(/calibre\s*\d+\s*[xX]\s*\d+/gi, '');

  let factor = 1;

  // 1. Triple factor: ej. "4x10x100" -> 4 * 10 = 40
  const triple = clean.match(/(\d+)\s*[xX]\s*(\d+)\s*[xX]/i);
  if (triple) {
    factor = parseInt(triple[1], 10) * parseInt(triple[2], 10);
  } else {
    // 2. Estándar: "8X1 KG", "CJ 08X250G", "12X250", "CAJA 20 X 1 KG"
    const match = clean.match(/(?:CAJA|CJ)?\s*(\d+)\s*[xX]\s*(?:\d+|[\d,.]+\s*(?:KG|KLS|KGS|K|GR|GRS|G|LT|LTS|CC|UN))/i);
    if (match) {
      factor = parseInt(match[1], 10);
    } else {
      // 3. "CAJA 24 UN" / "CJ 24UN" / "24 UNIDADES"
      const unMatch = clean.match(/(?:CAJA|CJ)?\s*(\d+)\s*(?:UNIDADES|UNID|UN|PZA|PZAS)\b/i);
      if (unMatch && parseInt(unMatch[1], 10) > 1) {
        factor = parseInt(unMatch[1], 10);
      } else {
        // 4. "CAJA 3 KLS" / "CAJA 5KG" con neto unitario
        const kgBox = clean.match(/CAJA\s*([\d,.]+)\s*(?:KG|KLS|KGS|K)\b/i);
        if (kgBox && prod.neto && prod.neto > 0) {
          const totKg = parseFloat(kgBox[1].replace(',', '.'));
          factor = Math.round(totKg / prod.neto);
        }
      }
    }
  }

  if (factor <= 0 || factor > 1000) factor = 1;

  const baseUnitWeight = (prod.neto && prod.neto > 0 ? prod.neto : (prod.bruto || 0));
  const pesoUnitario = prod.bruto && prod.bruto > 0 ? prod.bruto : baseUnitWeight;

  let pesoCaja = 0;
  if (esCaja) {
    if (factor > 1) {
      pesoCaja = Math.round(factor * baseUnitWeight * 1000) / 1000;
    } else {
      pesoCaja = baseUnitWeight || pesoUnitario || 0;
    }
  } else {
    pesoCaja = pesoUnitario;
  }

  const unidadesPorCajaText = esCaja 
    ? (factor > 1 ? `${factor} UN` : '1 UN') 
    : (um === 'UN' ? '1 UN' : '—');

  return {
    um,
    factor,
    unidadesPorCajaText,
    pesoCaja,
    pesoUnitario,
    esCaja
  };
}
