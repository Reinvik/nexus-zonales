export interface CiclicoTotales {
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
  monto_negativo: number;
  monto_positivo: number;
  monto_total_bruto: number;
  monto_conciliado_999: number;
  monto_conciliado_sdif: number;
  monto_total_conciliado: number;
  monto_final_descuadre: number;
}

export interface CiclicoLoteDetalle {
  lote: string;
  cant_sistema: number;
  cant_contada: number;
  diferencia: number;
  precio: number;
  dif_precio: number;
  um?: string;
  fecha_lote?: string;
  contador?: string;
  clasificacion?: string;
}

export interface Conciliacion999Info {
  encontrado: boolean;
  es_conciliado: boolean;            // Solo true si hay sobrante en cíclico (diferencia > 0)
  cajas_conciliadas: number;         // Tope: min(sobrante_cj, abs(cajas_en_999))
  unidades_conciliadas: number;      // En UN
  total_stock_disponible: number;    // En UN
  total_cajas_equivalentes: number;  // En CJ
  valor_conciliado: number;          // Monto en $ conciliado
  items: Array<{
    centro: string;
    almacen: string;
    lote: string;
    ubicacion: string;
    stock_disponible: number;
    um: string;
    fe_caduc?: string;
    peso?: number;
  }>;
  accion_sugerida: string;
  es_compensable: boolean;
}

export interface ConciliacionSdifInfo {
  encontrado: boolean;
  es_conciliado: boolean;            // Solo true si hay sobrante en cíclico (diferencia > 0)
  cajas_conciliadas: number;         // Tope: min(sobrante_cj, cajas_sdif)
  unidades_conciliadas: number;      // En UN
  total_libre_util: number;          // En UN
  total_cajas_equivalentes: number;  // En CJ
  total_valor: number;
  valor_conciliado: number;          // Monto en $ conciliado
  items: Array<{
    lote: string;
    almacen: string;
    libre_util: number;
    um: string;
    valor: number;
    zonal_estimada?: string;
  }>;
  accion_sugerida: string;
}

export type EstadoDiferencia = 
  | 'faltante'        // dife < 0
  | 'sobrante'        // dife > 0
  | 'descuadre_lotes' // dife == 0 pero con líneas positivas y negativas de lote
  | 'cuadrado';       // todo en 0

export interface InventarioItemConsolidado {
  sku: string;
  descripcion: string;
  ubicacion: string;
  almacen: string;
  tip_alm: string;
  docto?: string;
  cant_sistema: number;
  cant_contada: number;
  diferencia: number;
  um: string;
  factor_empaque: number;
  diferencia_unidades: number;
  kilos_equivalentes: number;
  precio_unitario: number;
  dif_precio: number;
  estado: EstadoDiferencia;
  lotes_desglose: CiclicoLoteDetalle[];
  conciliacion_999?: Conciliacion999Info;
  conciliacion_sdif?: ConciliacionSdifInfo;
}

export interface CiclicoMetadata {
  titulo?: string;
  fecha_reporte?: string;
  hora_reporte?: string;
  usuario?: string;
  almacen?: string;
  tip_alm?: string;
}

export interface InventarioCiclicoAuditoria {
  id: string;
  fecha: string;
  hora: string;
  usuario: string;
  almacen: string;
  tipo_almacen: string;
  total_lineas: number;
  total_sistema: number;
  total_contado: number;
  diferencia_neta: number;
  dif_precio_total: number;
  items_con_diferencia: number;
  sobrantes_conciliados_999: number;
  sobrantes_conciliados_sdif: number;
  resumen_json?: {
    total_skus: number;
    total_faltantes_sku: number;
    total_sobrantes_sku: number;
    total_descuadre_lotes: number;
    total_cuadrados: number;
    metadata?: CiclicoMetadata;
  };
  detalles_json?: InventarioItemConsolidado[];
  created_at?: string;
}
