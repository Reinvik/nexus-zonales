export type DesviacionTipo = 
  | 'faltante' 
  | 'sobrante' 
  | 'dano_mecanico' 
  | 'producto_cambiado' 
  | 'transporte';

export type EstadoNC = 
  | 'Pendiente' 
  | 'NC Solicitada' 
  | 'NC lista' 
  | 'Conciliado';

export type RolUsuario = 'admin_santiago' | 'operador_zonal' | 'auditor_calidad';

export interface UsuarioCuenta {
  id: string;
  username: string;
  nombre: string;
  email?: string;
  zonal_code: string;
  zonal_nombre: string;
  rol: RolUsuario;
  pin?: string;
  activo: boolean;
  updated_at?: string;
}

export interface Product {
  sku: string;
  descripcion: string;
  estado: string;
  bruto: number;
  neto: number;
  unidad: string;
  um_venta: string;
  tipo_peso: string;
  categoria: string;
}

export interface ZonalInfo {
  code: string;       // e.g. CPSJ
  zonal: string;      // e.g. Copiapó
  almacen: string;    // e.g. CPSJ
  sectorPrefix: string; // e.g. CP
}

export interface ClientInfo {
  code: string;
  name: string;
}

export interface CiclicoItem {
  id?: string;
  material: string;      // SKU
  texto_breve: string;   // Descripción
  almacen: string;       // 'SDIF' | '999'
  lote: string;          // ej: VMSJ2010
  zonal: string;         // ej: Viña del Mar
  cantidad: number;      // Libre utilización
  umb: string;           // UN / KG / CJ
  valor_total: number;   // Valor libre utilización ($)
  en_calidad?: number;
  estado: string;        // 'Conciliado' | 'Pendiente' | 'Nota Crédito' | 'Ajuste'
  fecha_sap?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SyncMeta {
  modulo: string;
  ultima_actualizacion: string;
  total_registros: number;
  actualizado_por: string;
}

export interface Desviacion {
  id: string;
  tipo: DesviacionTipo;
  fecha: string;               // YYYY-MM-DD
  fecha_dig?: string;          // Fecha Dig-
  fecha_llegada_camion?: string; // Fecha de llegada del camión
  hora_llegada_camion?: string;  // Hora de llegada del camión (ej: 08:30)
  pallets_recibidos?: number;    // Cantidad de pallets recibidos del camión
  bandejas_recibidas?: number;   // Cantidad de bandejas recibidas del camión
  semana?: string;             // e.g. "Sem 42"
  zonal: string;
  almacen: string;
  sku: string;
  descripcion: string;
  umv: string;
  cantidad: number;
  kilos: number;
  lote?: string;
  sector?: string;
  pasillo?: string;
  cod_cliente?: string;
  nombre_cliente?: string;
  num_factura?: string;        // N° Fact. SAP
  folio_ref?: string;          // Folio Ref.
  transporte?: string;
  estado_nc?: EstadoNC;
  nc_manual?: string;
  anotaciones?: string;
  fotos?: string[];
  producto_cambiado_sku?: string;
  producto_cambiado_desc?: string;
  creado_por?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StagedItem {
  tempId: string;
  tipo: DesviacionTipo;
  sku: string;
  descripcion: string;
  umv: string;
  cantidad: number;
  kilos: number;
  tipo_peso: string;
  lote: string;
  pasillo: string;
  sector: string;
  cod_cliente: string;
  nombre_cliente: string;
  num_factura: string;
  folio_ref: string;
  transporte: string;
  fecha_llegada_camion: string;
  hora_llegada_camion: string;
  pallets_recibidos?: number;
  bandejas_recibidas?: number;
  fecha_dig: string;
  anotaciones: string;
  fotos?: string[];
  producto_cambiado_sku?: string;
  producto_cambiado_desc?: string;
}
