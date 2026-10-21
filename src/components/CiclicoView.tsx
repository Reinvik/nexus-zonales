import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Search, 
  ClipboardPaste, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Clock, 
  Building2, 
  Filter, 
  Download, 
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Check,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CiclicoItem, SyncMeta, UsuarioCuenta, Product } from '../types';
import { InventarioItemConsolidado, CiclicoMetadata, CiclicoTotales } from '../types/ciclico';
import { CIAL_ZONALES } from '../data/zonales';
import { SAMPLE_CICLICO_RAW } from '../data/sampleCiclicoData';
import { 
  parseCiclicoRawText, 
  consolidarInventario, 
  exportarCiclicoAExcel 
} from '../utils/ciclicoParser';
import {
  descargarBotExtractorSap,
  descargarBotConciliar999Lt01,
  descargarBotTraspasoSdifSgsj
} from '../utils/sapBotGenerator';

interface CiclicoViewProps {
  items: CiclicoItem[];
  syncMeta: SyncMeta | null;
  onSyncCiclico: (newItems: CiclicoItem[]) => Promise<boolean>;
  isSyncing: boolean;
  currentUser?: UsuarioCuenta;
  products?: Product[];
}

export const CiclicoView: React.FC<CiclicoViewProps> = ({
  items,
  syncMeta,
  onSyncCiclico,
  isSyncing,
  currentUser,
  products = []
}) => {
  // 1. Navegación entre Sub-Pestañas: Resultado Cíclico vs MB52 Externos
  const [activeSubTab, setActiveSubTab] = useState<'resultado' | 'sdif' | '999'>('resultado');

  // 2. Estado del Cíclico Raw (persistido en localStorage)
  const [rawCiclico, setRawCiclico] = useState<string>(() => {
    return localStorage.getItem('nexus_zonales_raw_ciclico') || SAMPLE_CICLICO_RAW;
  });

  // Modal para Cargar / Pegar Monitor de Inventario Cíclico (SAP)
  const [showCiclicoModal, setShowCiclicoModal] = useState<boolean>(false);
  const [pastedCiclicoText, setPastedCiclicoText] = useState<string>('');
  const [ciclicoParseError, setCiclicoParseError] = useState<string>('');

  // Filtros del Resultado Cíclico
  const [ciclicoSearch, setCiclicoSearch] = useState<string>('');
  const [ciclicoFilterEstado, setCiclicoFilterEstado] = useState<string>('TODOS');
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  // Filtros de las pestañas SDIF / 999
  const [selectedZonal, setSelectedZonal] = useState<string>('TODAS');
  const [selectedEstado, setSelectedEstado] = useState<string>('TODOS');
  const [searchExternal, setSearchExternal] = useState<string>('');

  // Modal de actualización MB52 (SDIF / 999)
  const [showMb52Modal, setShowMb52Modal] = useState<boolean>(false);
  const [pastedMb52Text, setPastedMb52Text] = useState<string>('');
  const [targetAlmacenModal, setTargetAlmacenModal] = useState<'SDIF' | '999'>('SDIF');
  const [parsedPreviewMb52, setParsedPreviewMb52] = useState<CiclicoItem[]>([]);
  const [parseErrorsMb52, setParseErrorsMb52] = useState<string[]>([]);

  // 3. Procesamiento y Consolidación Automática del Cíclico con 999 y SDIF
  const { itemsConsolidados, metadataCiclico, totalesCiclico } = useMemo(() => {
    const { metadata, rows: ciclicoRows } = parseCiclicoRawText(rawCiclico);

    // Separar los items de MB52 para 999 y SDIF
    const rows999 = items
      .filter(i => i.almacen === '999')
      .map(i => ({
        sku: i.material,
        centro: 'SGSJ',
        almacen: '999',
        lote: i.lote,
        descripcion: i.texto_breve,
        stock_disponible: i.cantidad,
        um: i.umb,
        ubicacion: 'CD'
      }));

    const rowsSdif = items
      .filter(i => i.almacen === 'SDIF')
      .map(i => ({
        sku: i.material,
        descripcion: i.texto_breve,
        libre_util: i.cantidad,
        um: i.umb,
        lote: i.lote,
        almacen: 'SDIF',
        valor: i.valor_total,
        zonal_estimada: i.zonal
      }));

    const consolidado = consolidarInventario(
      ciclicoRows,
      rows999,
      rowsSdif,
      products
    );

    return {
      itemsConsolidados: consolidado.items,
      metadataCiclico: metadata,
      totalesCiclico: consolidado.totales as CiclicoTotales
    };
  }, [rawCiclico, items, products]);

  // Filtrado de la lista del Cíclico Consolidado
  const filteredCiclicoItems = useMemo(() => {
    return itemsConsolidados.filter(item => {
      // Filtro por Estado
      if (ciclicoFilterEstado === 'FALTANTES' && item.diferencia >= 0) return false;
      if (ciclicoFilterEstado === 'SOBRANTES' && item.diferencia <= 0) return false;
      if (ciclicoFilterEstado === 'CUADRADOS' && item.diferencia !== 0) return false;
      if (ciclicoFilterEstado === 'CONCILIADOS_999' && !item.conciliacion_999?.es_conciliado) return false;
      if (ciclicoFilterEstado === 'CONCILIADOS_SDIF' && !item.conciliacion_sdif?.es_conciliado) return false;

      // Buscador
      if (ciclicoSearch.trim()) {
        const q = ciclicoSearch.toLowerCase();
        const match = 
          item.sku.toLowerCase().includes(q) ||
          item.descripcion.toLowerCase().includes(q) ||
          item.ubicacion.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [itemsConsolidados, ciclicoFilterEstado, ciclicoSearch]);

  // Filtrado de la tabla MB52 (SDIF o 999)
  const filteredExternalItems = useMemo(() => {
    const targetAlm = activeSubTab === 'sdif' ? 'SDIF' : '999';
    return items.filter(item => {
      if (item.almacen !== targetAlm) return false;
      if (selectedZonal !== 'TODAS' && item.zonal !== selectedZonal) return false;
      if (selectedEstado !== 'TODOS' && item.estado !== selectedEstado) return false;

      if (searchExternal.trim()) {
        const q = searchExternal.toLowerCase();
        const match = 
          item.material.toLowerCase().includes(q) ||
          item.texto_breve.toLowerCase().includes(q) ||
          (item.lote && item.lote.toLowerCase().includes(q)) ||
          (item.zonal && item.zonal.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [items, activeSubTab, selectedZonal, selectedEstado, searchExternal]);

  // Métricas generales de MB52
  const metrics = useMemo(() => {
    const sdifItems = items.filter(i => i.almacen === 'SDIF');
    const items999 = items.filter(i => i.almacen === '999');

    const totalValorSdif = sdifItems.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
    const totalCantSdif = sdifItems.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

    const totalValor999 = items999.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
    const totalCant999 = items999.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

    return {
      totalCount: items.length,
      sdifCount: sdifItems.length,
      sdifCant: totalCantSdif,
      sdifValor: totalValorSdif,
      count999: items999.length,
      cant999: totalCant999,
      valor999: totalValor999
    };
  }, [items]);

  // Formato de última actualización
  const formattedLastUpdate = useMemo(() => {
    if (!syncMeta?.ultima_actualizacion) return 'Actualizado hoy';
    try {
      const d = new Date(syncMeta.ultima_actualizacion);
      return new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(d);
    } catch {
      return syncMeta.ultima_actualizacion;
    }
  }, [syncMeta]);

  // Guardar nuevo Cíclico Pegado
  const handleSavePastedCiclico = () => {
    if (!pastedCiclicoText.trim()) {
      setCiclicoParseError('Debes pegar el contenido del reporte.');
      return;
    }
    const { rows } = parseCiclicoRawText(pastedCiclicoText);
    if (rows.length === 0) {
      setCiclicoParseError('No se detectaron filas válidas de inventario cíclico. Verifica el formato.');
      return;
    }
    setRawCiclico(pastedCiclicoText);
    localStorage.setItem('nexus_zonales_raw_ciclico', pastedCiclicoText);
    setShowCiclicoModal(false);
    setPastedCiclicoText('');
    setCiclicoParseError('');
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
  };

  // Restablecer al Cíclico inicial
  const handleResetToSampleCiclico = () => {
    if (window.confirm('¿Deseas restablecer el inventario cíclico a los datos estándar de prueba?')) {
      setRawCiclico(SAMPLE_CICLICO_RAW);
      localStorage.removeItem('nexus_zonales_raw_ciclico');
      confetti({ particleCount: 40, spread: 50 });
    }
  };

  // Exportar Excel Consolidado Oficial
  const handleExportOfficialExcel = () => {
    exportarCiclicoAExcel(itemsConsolidados, metadataCiclico, totalesCiclico);
  };

  // Parser de datos MB52 (SDIF / 999)
  const parsePastedMb52 = (rawText: string, defaultAlm: 'SDIF' | '999') => {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    const result: CiclicoItem[] = [];
    const errors: string[] = [];

    if (lines.length === 0) {
      setParsedPreviewMb52([]);
      setParseErrorsMb52(['No se detectó contenido para procesar.']);
      return;
    }

    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const firstRowCols = lines[0].split(delimiter).map(c => c.trim().toLowerCase());
    
    let startIdx = 0;
    let idxMat = -1;
    let idxDesc = -1;
    let idxCant = -1;
    let idxUmb = -1;
    let idxLote = -1;
    let idxAlm = -1;
    let idxVal = -1;

    for (let c = 0; c < firstRowCols.length; c++) {
      const colName = firstRowCols[c];
      if (colName.includes('material') || colName.includes('sku')) idxMat = c;
      else if (colName.includes('texto') || colName.includes('descrip')) idxDesc = c;
      else if (colName.includes('libre') || colName.includes('cant')) idxCant = c;
      else if (colName.includes('umb') || colName.includes('unidad')) idxUmb = c;
      else if (colName.includes('lote')) idxLote = c;
      else if (colName.includes('almac') || colName.includes('alm')) idxAlm = c;
      else if (colName.includes('valor')) idxVal = c;
    }

    const hasHeader = idxMat !== -1 || idxDesc !== -1;
    if (hasHeader) {
      startIdx = 1;
    } else {
      idxMat = 0;
      idxDesc = 1;
      idxCant = 2;
      idxUmb = 3;
      idxLote = 4;
      idxAlm = 5;
      idxVal = 6;
    }

    const zonalMap: Record<string, string> = {
      'AR': 'Arica', 'IQ': 'Iquique', 'CL': 'Calama', 'AN': 'Antofagasta',
      'CP': 'Copiapó', 'LS': 'La Serena', 'FL': 'San Felipe', 'VM': 'Viña del Mar',
      'SA': 'San Antonio', 'RG': 'Rancagua', 'SF': 'San Fernando', 'TL': 'Talca',
      'CH': 'Chillán', 'CN': 'Concepción', 'LA': 'Los Ángeles', 'TM': 'Temuco',
      'OS': 'Osorno', 'PM': 'Puerto Montt', 'CY': 'Coyhaique', 'PA': 'Punta Arenas'
    };

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim());
      const rawMat = idxMat >= 0 && cols[idxMat] ? cols[idxMat].replace(/^0+/, '') : (cols[0] || '');
      const mat = rawMat.trim();

      if (!mat || isNaN(Number(mat))) continue;

      const desc = idxDesc >= 0 && cols[idxDesc] ? cols[idxDesc] : (cols[1] || 'Sin descripción');
      const cant = idxCant >= 0 && cols[idxCant] ? parseFloat(cols[idxCant].replace(',', '.')) || 0 : 0;
      const umb = idxUmb >= 0 && cols[idxUmb] ? cols[idxUmb].toUpperCase() : 'UN';
      const lote = idxLote >= 0 && cols[idxLote] ? cols[idxLote] : '';
      const rawAlm = idxAlm >= 0 && cols[idxAlm] ? cols[idxAlm].toUpperCase() : defaultAlm;
      const alm = rawAlm.includes('999') ? '999' : (rawAlm.includes('SDIF') ? 'SDIF' : defaultAlm);
      const val = idxVal >= 0 && cols[idxVal] ? parseFloat(cols[idxVal].replace(',', '.')) || 0 : 0;

      const prefix = lote.slice(0, 2).toUpperCase();
      const zonal = zonalMap[prefix] || (currentUser ? currentUser.zonal_nombre : 'Santiago');

      result.push({
        material: mat,
        texto_breve: desc,
        almacen: alm,
        lote,
        zonal,
        cantidad: cant,
        umb,
        valor_total: Math.round(val * 100) / 100,
        en_calidad: 0,
        estado: 'Pendiente'
      });
    }

    if (result.length === 0) {
      errors.push('No se pudieron extraer registros válidos. Asegúrate de incluir el Material/SKU y la cantidad.');
    }

    setParsedPreviewMb52(result);
    setParseErrorsMb52(errors);
  };

  const handleConfirmSyncMb52 = async () => {
    if (parsedPreviewMb52.length === 0) return;
    const ok = await onSyncCiclico(parsedPreviewMb52);
    if (ok) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
      setShowMb52Modal(false);
      setPastedMb52Text('');
      setParsedPreviewMb52([]);
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. Header del Módulo con Sub-Navegación y Acciones Rápidas */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#008744]" />
              <h2 className="text-base font-extrabold text-slate-800">
                Inventario Cíclico CD Frío (Picking) & Almacenes 999 / SDIF
              </h2>
              <span className="text-[10px] bg-emerald-100 text-[#008744] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                SGSJ Santiago CD
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cuadratura física de picking por SKU y conciliación compensada con diferencias de almacenes externos.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setShowCiclicoModal(true);
                setPastedCiclicoText('');
                setCiclicoParseError('');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Pegar nuevo reporte Monitor de inventario de SAP"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Cargar / Pegar Cíclico</span>
            </button>

            <button
              onClick={handleExportOfficialExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#008744] border border-emerald-300 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="Descargar informe consolidado con las 2 tablas en Excel"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel Oficial</span>
            </button>

            <button
              onClick={handleResetToSampleCiclico}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Restablecer cíclico inicial"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de Sub-Pestañas */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-slate-100/90 rounded-xl">
            <button
              onClick={() => setActiveSubTab('resultado')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeSubTab === 'resultado'
                  ? 'bg-white text-emerald-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>🎯 Resultado Cíclico (Picking)</span>
              <span className="text-[10px] bg-emerald-100 text-[#008744] px-1.5 py-0.2 rounded-full font-bold">
                {totalesCiclico.total_skus} SKUs
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('sdif')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeSubTab === 'sdif'
                  ? 'bg-white text-emerald-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📦 Almacén SDIF (Zonales)</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                {metrics.sdifCount}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('999')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeSubTab === '999'
                  ? 'bg-white text-amber-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⚠️ Almacén 999 (CD / Schrott)</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                {metrics.count999}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Última sync MB52: <span className="font-mono font-bold text-slate-700">{formattedLastUpdate}</span>
          </div>
        </div>

        {/* Barra de Bots de Automatización SAP GUI (1-Clic) */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-extrabold text-slate-700">
              Bots SAP GUI (1-Clic):
            </span>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              Descarga o ejecuta conciliaciones directas en SAP con los datos actuales pre-cargados.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={descargarBotExtractorSap}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Descarga el script .vbs que extrae LX02 (999) + MB52 (SDIF) al Escritorio"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>1. Extraer 999 + SDIF (.vbs)</span>
            </button>

            <button
              onClick={() => descargarBotConciliar999Lt01(itemsConsolidados)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Genera el bot .vbs con los ítems conciliados para crear las OT en LT01 (De 999 a Picking)"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>2. Conciliar 999 → Picking (LT01) ({totalesCiclico.sobrantes_conciliados_999})</span>
            </button>

            <button
              onClick={() => descargarBotTraspasoSdifSgsj(itemsConsolidados)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-black shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Genera el bot .vbs con Escáner Visual MIGO (A08 / R10 / Mov 301) para traspasar del almacén SDIF a SGSJ"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>3. Traspasar SDIF → SGSJ (MIGO 301) ({totalesCiclico.sobrantes_conciliados_sdif})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: RESULTADO CÍCLICO & CONCILIACIÓN CON LAS 2 TABLAS OFICIALES     */}
      {/* ========================================================================= */}
      {activeSubTab === 'resultado' && (
        <div className="space-y-5">
          
          {/* BLOQUE OFICIAL: LAS DOS TABLAS EJECUTIVAS CIAL (IDÉNTICAS AL REPORTE) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* TABLA 1: CUADRATURA FÍSICA DEL CÍCLICO (PICKING) */}
            <div className="rounded-2xl overflow-hidden border-2 border-[#008744] shadow-sm bg-white">
              <div className="bg-[#008744] text-white px-4 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Cuadratura Cíclico (Picking)</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                  {metadataCiclico.fecha_reporte ? `Fecha: ${metadataCiclico.fecha_reporte}` : 'Físico CD'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#008744] text-white text-xs font-black border-t border-emerald-600/60">
                      <th className="py-2.5 px-3 border-r border-emerald-600/60 w-1/3">Negativo</th>
                      <th className="py-2.5 px-3 border-r border-emerald-600/60 w-1/3">Positivo</th>
                      <th className="py-2.5 px-3 w-1/3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white font-mono font-black text-base divide-y divide-slate-100">
                    <tr>
                      <td className="py-4 px-3 text-rose-600 border-r border-slate-200">
                        {totalesCiclico.monto_negativo === 0 ? '$ 0' : `- $ ${Math.abs(totalesCiclico.monto_negativo).toLocaleString('es-CL')}`}
                      </td>
                      <td className="py-4 px-3 text-blue-600 border-r border-slate-200">
                        $ {totalesCiclico.monto_positivo.toLocaleString('es-CL')}
                      </td>
                      <td className={`py-4 px-3 font-extrabold ${
                        totalesCiclico.monto_total_bruto < 0 ? 'text-rose-700' : 'text-slate-900'
                      }`}>
                        {totalesCiclico.monto_total_bruto < 0 
                          ? `$ (${Math.abs(totalesCiclico.monto_total_bruto).toLocaleString('es-CL')})` 
                          : `$ ${totalesCiclico.monto_total_bruto.toLocaleString('es-CL')}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
                <span>Diferencia física neta: <strong>{totalesCiclico.diferencia_neta > 0 ? `+${totalesCiclico.diferencia_neta}` : totalesCiclico.diferencia_neta} cajas</strong></span>
                <span className="font-semibold text-slate-600">{totalesCiclico.total_faltantes} Faltantes | {totalesCiclico.total_sobrantes} Sobrantes</span>
              </div>
            </div>

            {/* TABLA 2: CONCILIACIONES Y COMPENSACIONES EXTERNAS */}
            <div className="rounded-2xl overflow-hidden border-2 border-[#008744] shadow-sm bg-white">
              <div className="bg-[#008744] text-white px-4 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Conciliación Externa</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                  Compensación 999 & SDIF
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#008744] text-white text-xs font-black border-t border-emerald-600/60">
                      <th className="py-2.5 px-3 border-r border-emerald-600/60 w-1/3">Conciliado 999</th>
                      <th className="py-2.5 px-3 border-r border-emerald-600/60 w-1/3">Conciliado SDIF</th>
                      <th className="py-2.5 px-3 w-1/3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white font-mono font-black text-base divide-y divide-slate-100">
                    <tr>
                      <td className="py-4 px-3 text-indigo-700 border-r border-slate-200">
                        $ {totalesCiclico.monto_conciliado_999.toLocaleString('es-CL')}
                      </td>
                      <td className="py-4 px-3 text-purple-700 border-r border-slate-200">
                        $ {totalesCiclico.monto_conciliado_sdif.toLocaleString('es-CL')}
                      </td>
                      <td className="py-4 px-3 text-emerald-700 font-extrabold">
                        $ {totalesCiclico.monto_total_conciliado.toLocaleString('es-CL')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
                <span>Cruces exitosos: <strong>{totalesCiclico.sobrantes_conciliados_999} en CD | {totalesCiclico.sobrantes_conciliados_sdif} en Zonales</strong></span>
                <span className="font-semibold text-emerald-700">Monto compensado</span>
              </div>
            </div>

          </div>

          {/* BANNER INFORMATIVO: CRITERIO DE PICKING & BALANCE FINAL */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-950">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#008744] text-white rounded-xl shrink-0 shadow-xs">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-emerald-900 block text-sm">
                  Criterio de Picking Aplicado: Control por SKU
                </span>
                <p className="text-emerald-800/90 mt-0.5">
                  En picking el lote no genera descuadre. <strong>{totalesCiclico.total_cuadrados} SKUs</strong> tienen saldo neto en 0 y se computan como <strong>100% Cuadrados ($0 impacto)</strong>.
                </p>
              </div>
            </div>

            <div className="bg-white px-3.5 py-2 rounded-xl border border-emerald-200/80 shadow-2xs shrink-0 font-mono text-right">
              <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">
                Faltante Neto Final tras Conciliación:
              </span>
              <span className={`text-sm font-black ${
                totalesCiclico.monto_final_descuadre < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {totalesCiclico.monto_final_descuadre < 0 
                  ? `$ (${Math.abs(totalesCiclico.monto_final_descuadre).toLocaleString('es-CL')})` 
                  : `$ ${totalesCiclico.monto_final_descuadre.toLocaleString('es-CL')}`}
              </span>
            </div>
          </div>

          {/* BARRA DE FILTROS Y BÚSQUEDA DEL CÍCLICO */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Material (SKU), descripción o ubicación..."
                value={ciclicoSearch}
                onChange={e => setCiclicoSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#008744]"
              />
              {ciclicoSearch && (
                <button 
                  onClick={() => setCiclicoSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Píldoras de Estado */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'TODOS', label: 'Todos', count: itemsConsolidados.length },
                { id: 'FALTANTES', label: 'Faltantes', count: totalesCiclico.total_faltantes, color: 'text-rose-700 bg-rose-50 border-rose-200' },
                { id: 'SOBRANTES', label: 'Sobrantes', count: totalesCiclico.total_sobrantes, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { id: 'CONCILIADOS_999', label: 'Cruce 999', count: totalesCiclico.sobrantes_conciliados_999, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                { id: 'CONCILIADOS_SDIF', label: 'Cruce SDIF', count: totalesCiclico.sobrantes_conciliados_sdif, color: 'text-purple-700 bg-purple-50 border-purple-200' },
                { id: 'CUADRADOS', label: 'Cuadrados (0)', count: totalesCiclico.total_cuadrados, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setCiclicoFilterEstado(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    ciclicoFilterEstado === f.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : f.color || 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

          </div>

          {/* TABLA DE SKUS CONSOLIDADOS DEL CÍCLICO */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-8"></th>
                    <th className="p-3">Material (SKU)</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 text-center">Ubic.</th>
                    <th className="p-3 text-right">Cant. Sist (CJ)</th>
                    <th className="p-3 text-right">Contado (CJ)</th>
                    <th className="p-3 text-right">Diferencia</th>
                    <th className="p-3 text-right">Precio ($)</th>
                    <th className="p-3 text-right">Dif. Precio ($)</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3">Conciliación CD / Zonales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredCiclicoItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No se encontraron productos para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredCiclicoItems.map((item) => {
                      const isExpanded = expandedSku === item.sku;
                      return (
                        <React.Fragment key={item.sku}>
                          <tr className={`hover:bg-slate-50/80 transition-colors ${
                            item.diferencia < 0 ? 'bg-rose-50/20' : (item.diferencia > 0 ? 'bg-blue-50/20' : '')
                          }`}>
                            
                            {/* Botón Desplegar Lotes */}
                            <td className="p-3 text-center">
                              {item.lotes_desglose.length > 1 ? (
                                <button
                                  onClick={() => setExpandedSku(isExpanded ? null : item.sku)}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Ver detalle por lotes"
                                >
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                              ) : null}
                            </td>

                            {/* SKU */}
                            <td className="p-3 font-mono font-black text-slate-900 whitespace-nowrap">
                              {item.sku}
                            </td>

                            {/* Descripción */}
                            <td className="p-3 max-w-[260px]">
                              <div className="font-bold text-slate-800 truncate" title={item.descripcion}>
                                {item.descripcion}
                              </div>
                              <span className="text-[10px] text-slate-400">Factor: {item.factor_empaque} UN/CJ</span>
                            </td>

                            {/* Ubicación */}
                            <td className="p-3 text-center font-mono font-bold text-slate-600 whitespace-nowrap">
                              {item.ubicacion || '—'}
                            </td>

                            {/* Cant Sistema */}
                            <td className="p-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                              {item.cant_sistema}
                            </td>

                            {/* Cant Contada */}
                            <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {item.cant_contada}
                            </td>

                            {/* Diferencia CJ y UN */}
                            <td className="p-3 text-right whitespace-nowrap">
                              <span className={`font-mono font-black ${
                                item.diferencia < 0 ? 'text-rose-600' : (item.diferencia > 0 ? 'text-blue-600' : 'text-slate-500')
                              }`}>
                                {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia} CJ
                              </span>
                              {item.diferencia !== 0 && (
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  {item.diferencia_unidades > 0 ? `+${item.diferencia_unidades}` : item.diferencia_unidades} UN
                                </span>
                              )}
                            </td>

                            {/* Precio */}
                            <td className="p-3 text-right font-mono text-slate-600 whitespace-nowrap">
                              ${item.precio_unitario.toLocaleString('es-CL')}
                            </td>

                            {/* Dif Precio */}
                            <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                              <span className={item.dif_precio < 0 ? 'text-rose-600' : (item.dif_precio > 0 ? 'text-blue-600' : 'text-slate-400')}>
                                {item.dif_precio < 0 
                                  ? `- $${Math.abs(item.dif_precio).toLocaleString('es-CL')}` 
                                  : (item.dif_precio > 0 ? `+ $${item.dif_precio.toLocaleString('es-CL')}` : '$0')}
                              </span>
                            </td>

                            {/* Estado Badge */}
                            <td className="p-3 text-center whitespace-nowrap">
                              {item.diferencia < 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  Faltante
                                </span>
                              ) : item.diferencia > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                                  Sobrante
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-[#008744] border border-emerald-300">
                                  Cuadrado
                                </span>
                              )}
                            </td>

                            {/* Conciliación Externa */}
                            <td className="p-3">
                              <div className="space-y-1">
                                {item.conciliacion_999?.es_conciliado && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200">
                                    <span>⚠️ Cruce 999:</span>
                                    <span>+{item.conciliacion_999.cajas_conciliadas} CJ (${item.conciliacion_999.valor_conciliado.toLocaleString('es-CL')})</span>
                                  </span>
                                )}
                                {item.conciliacion_sdif?.es_conciliado && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200">
                                    <span>📦 Cruce SDIF:</span>
                                    <span>+{item.conciliacion_sdif.cajas_conciliadas} CJ (${item.conciliacion_sdif.valor_conciliado.toLocaleString('es-CL')})</span>
                                  </span>
                                )}
                                {!item.conciliacion_999?.es_conciliado && !item.conciliacion_sdif?.es_conciliado && (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </div>
                            </td>

                          </tr>

                          {/* Detalle Expandido de Lotes */}
                          {isExpanded && item.lotes_desglose.length > 0 && (
                            <tr className="bg-slate-50/90 border-y border-slate-200">
                              <td colSpan={11} className="p-4 pl-12">
                                <div className="text-[11px] font-bold text-slate-700 mb-2">
                                  Desglose de Conteo por Lote de este Producto (Auditoría):
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {item.lotes_desglose.map((l, lIdx) => (
                                    <div key={lIdx} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs text-[11px]">
                                      <div className="flex justify-between items-center font-mono font-bold text-slate-800">
                                        <span>Lote: {l.lote}</span>
                                        <span className={l.diferencia < 0 ? 'text-rose-600' : (l.diferencia > 0 ? 'text-blue-600' : 'text-slate-500')}>
                                          {l.diferencia > 0 ? `+${l.diferencia}` : l.diferencia} CJ
                                        </span>
                                      </div>
                                      <div className="text-slate-500 text-[10px] mt-0.5 flex justify-between">
                                        <span>Sist: {l.cant_sistema} | Cont: {l.cant_contada}</span>
                                        <span>{l.fecha_lote || ''}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
              <span>Mostrando {filteredCiclicoItems.length} de {itemsConsolidados.length} SKUs evaluados.</span>
              <span className="font-mono text-slate-600">SGSJ Santiago CD — Picking Outbound</span>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTAS 2 Y 3: ALMACENES MB52 EXTERNOS (SDIF y 999)                       */}
      {/* ========================================================================= */}
      {(activeSubTab === 'sdif' || activeSubTab === '999') && (
        <div className="space-y-4">
          
          {/* Header de la pestaña MB52 */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-800">
                  {activeSubTab === 'sdif' ? '📦 Stock Almacén SDIF (Diferencias Zonales)' : '⚠️ Stock Almacén 999 (Ajustes CD / Schrott)'}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeSubTab === 'sdif' ? 'bg-emerald-100 text-[#008744]' : 'bg-amber-100 text-amber-800'
                }`}>
                  {filteredExternalItems.length} registros
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeSubTab === 'sdif' 
                  ? 'Existencias reportadas por las sucursales zonales para conciliar con sobrantes de despacho.' 
                  : 'Existencias y faltantes del CD registrados en cuenta puente 999 para regularización.'}
              </p>
            </div>

            <button
              onClick={() => {
                setTargetAlmacenModal(activeSubTab === 'sdif' ? 'SDIF' : '999');
                setShowMb52Modal(true);
                setPastedMb52Text('');
                setParsedPreviewMb52([]);
                setParseErrorsMb52([]);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Actualizar MB52 ({activeSubTab === 'sdif' ? 'SDIF' : '999'})</span>
            </button>
          </div>

          {/* Filtros MB52 */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-wrap items-center gap-3">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Material, lote o zonal..."
                value={searchExternal}
                onChange={e => setSearchExternal(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#008744]"
              />
            </div>

            {/* Filtro Zonal */}
            {activeSubTab === 'sdif' && (
              <select
                value={selectedZonal}
                onChange={e => setSelectedZonal(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="TODAS">Todas las Zonales</option>
                {CIAL_ZONALES.map(z => (
                  <option key={z.code} value={z.zonal}>{z.zonal}</option>
                ))}
              </select>
            )}

            {/* Filtro Estado */}
            <select
              value={selectedEstado}
              onChange={e => setSelectedEstado(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Conciliar">Conciliar</option>
              <option value="Conciliado">Conciliado</option>
            </select>
          </div>

          {/* Tabla MB52 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Material (SKU)</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Lote</th>
                    <th className="p-3">Zonal / Ubic</th>
                    <th className="p-3 text-right">Cantidad Libre</th>
                    <th className="p-3 text-center">UMB</th>
                    <th className="p-3 text-right">Valorización ($)</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredExternalItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No hay registros en almacén {activeSubTab === 'sdif' ? 'SDIF' : '999'}.
                      </td>
                    </tr>
                  ) : (
                    filteredExternalItems.slice(0, 150).map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-black text-slate-900 whitespace-nowrap">
                          {item.material}
                        </td>
                        <td className="p-3 max-w-[280px]">
                          <div className="font-bold text-slate-800 truncate" title={item.texto_breve}>
                            {item.texto_breve}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {item.lote || '—'}
                        </td>
                        <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                          {item.zonal}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900 whitespace-nowrap">
                          {item.cantidad}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-500">
                          {item.umb}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          ${Math.round(item.valor_total).toLocaleString('es-CL')}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.estado.toLowerCase().includes('concili')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredExternalItems.length > 150 && (
              <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
                Mostrando los primeros 150 de {filteredExternalItems.length} registros. Usa los filtros para acotar.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CARGAR / PEGAR MONITOR DE INVENTARIO CÍCLICO (SAP)              */}
      {/* ========================================================================= */}
      {showCiclicoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-[#008744] rounded-xl">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Cargar / Pegar Monitor de Inventario Cíclico
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pega directamente las filas copiadas desde SAP (Monitor de inventario por posición) o archivo TSV/Excel.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCiclicoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <textarea
                value={pastedCiclicoText}
                onChange={e => setPastedCiclicoText(e.target.value)}
                rows={10}
                placeholder="Pega aquí el reporte copiado desde SAP... (Docto, Material, Cant. Sistema, Cant. Contada, Dife, Precio, Dif Precio...)"
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#008744]"
              />

              {ciclicoParseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{ciclicoParseError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setShowCiclicoModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePastedCiclico}
                className="px-5 py-2 bg-[#008744] hover:bg-[#007038] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Procesar y Cuadrar Inventario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ACTUALIZAR STOCK MB52 (SDIF / 999)                              */}
      {/* ========================================================================= */}
      {showMb52Modal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Actualizar MB52 — Almacén {targetAlmacenModal}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pega el reporte copiado desde SAP MB52 para el almacén seleccionado.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowMb52Modal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <textarea
                value={pastedMb52Text}
                onChange={e => {
                  setPastedMb52Text(e.target.value);
                  parsePastedMb52(e.target.value, targetAlmacenModal);
                }}
                rows={8}
                placeholder="Pega aquí los datos de SAP MB52 (Material, Texto breve, Libre utilización, Lote, Almacén, Valor...)"
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#008744]"
              />

              {parsedPreviewMb52.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Se detectaron {parsedPreviewMb52.length} registros listos para actualizar en almacén {targetAlmacenModal}.</span>
                </div>
              )}

              {parseErrorsMb52.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                  {parseErrorsMb52.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setShowMb52Modal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSyncMb52}
                disabled={parsedPreviewMb52.length === 0 || isSyncing}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {isSyncing ? 'Guardando...' : `Confirmar y Cargar (${parsedPreviewMb52.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
