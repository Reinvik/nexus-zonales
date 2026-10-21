import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
  Info,
  Tablet,
  SlidersHorizontal,
  Save,
  Edit3,
  ClipboardCheck,
  Undo2,
  MapPin,
  Minus,
  Plus,
  Calendar,
  Cloud,
  Database
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CiclicoItem, SyncMeta, UsuarioCuenta, Product } from '../types';
import { 
  InventarioItemConsolidado, 
  CiclicoMetadata, 
  CiclicoTotales,
  InventarioCiclicoAuditoria
} from '../types/ciclico';
import { CIAL_ZONALES } from '../data/zonales';
import { SAMPLE_CICLICO_RAW } from '../data/sampleCiclicoData';
import { getTodayChile, formatChileanDate } from '../utils/date';
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
  ciclicoHistorial?: InventarioCiclicoAuditoria[];
  isLoadingHistorial?: boolean;
  onSaveCiclicoDelDia?: (payload: {
    fecha: string;
    rawText: string;
    metadata: CiclicoMetadata;
    totales: CiclicoTotales;
    itemsConsolidados: InventarioItemConsolidado[];
  }) => Promise<boolean>;
  onRefreshCiclicoHistorial?: () => Promise<void>;
}

export const CiclicoView: React.FC<CiclicoViewProps> = ({
  items,
  syncMeta,
  onSyncCiclico,
  isSyncing,
  currentUser,
  products = [],
  ciclicoHistorial = [],
  isLoadingHistorial = false,
  onSaveCiclicoDelDia,
  onRefreshCiclicoHistorial
}) => {
  // 1. Navegación entre Sub-Pestañas: Resultado Cíclico vs MB52 Externos
  const [activeSubTab, setActiveSubTab] = useState<'resultado' | 'sdif' | '999'>('resultado');

  // 2. Control de Fecha y Persistencia Diaria (Sincronizado con Supabase)
  const [selectedFecha, setSelectedFecha] = useState<string>(() => {
    return getTodayChile();
  });
  const [modalFecha, setModalFecha] = useState<string>(() => getTodayChile());
  const [isSavingDailyCiclico, setIsSavingDailyCiclico] = useState<boolean>(false);

  // Estado del Cíclico Raw (persistido en memoria y sincronizado en la nube)
  const [rawCiclico, setRawCiclico] = useState<string>(() => {
    return localStorage.getItem('nexus_zonales_raw_ciclico') || SAMPLE_CICLICO_RAW;
  });

  // Sincronizar automáticamente el cíclico activo cuando el historial cambia en Supabase
  useEffect(() => {
    if (ciclicoHistorial && ciclicoHistorial.length > 0) {
      // 1. Buscar si existe registro guardado para la fecha seleccionada
      const foundCurrent = ciclicoHistorial.find(h => {
        const clean = h.fecha ? h.fecha.split('T')[0] : '';
        return clean === selectedFecha;
      });

      if (foundCurrent && foundCurrent.raw_ciclico) {
        setRawCiclico(foundCurrent.raw_ciclico);
        return;
      }

      // 2. Si no hay registro con texto para selectedFecha pero hay otros guardados,
      // seleccionar el más reciente con contenido
      const latest = ciclicoHistorial.find(h => Boolean(h.raw_ciclico));
      if (latest && latest.raw_ciclico) {
        const cleanLatest = latest.fecha.split('T')[0];
        setSelectedFecha(cleanLatest);
        setRawCiclico(latest.raw_ciclico);
      }
    }
  }, [ciclicoHistorial]);

  // Cambiar día seleccionado
  const handleSelectFecha = (fecha: string) => {
    setSelectedFecha(fecha);
    const item = ciclicoHistorial?.find(h => {
      const clean = h.fecha ? h.fecha.split('T')[0] : '';
      return clean === fecha;
    });
    if (item && item.raw_ciclico) {
      setRawCiclico(item.raw_ciclico);
      localStorage.setItem('nexus_zonales_raw_ciclico', item.raw_ciclico);
    }
  };

  // Ítem activo del historial para mostrar metadatos (quién guardó, hora)
  const activeHistorialItem = useMemo(() => {
    return ciclicoHistorial?.find(h => {
      const clean = h.fecha ? h.fecha.split('T')[0] : '';
      return clean === selectedFecha;
    });
  }, [ciclicoHistorial, selectedFecha]);

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

  // Estados para la Revisión / Auditoría en Tablet del Supervisor (Top N SKUs con más diferencias)
  const [supervisorRevisions, setSupervisorRevisions] = useState<Record<string, { cant_contada: number; notas?: string; supervisor_nombre?: string }>>(() => {
    const cached = localStorage.getItem('nexus_supervisor_revisions');
    return cached ? JSON.parse(cached) : {};
  });
  const [isTabletReviewOpen, setIsTabletReviewOpen] = useState<boolean>(false);
  const [topNCount, setTopNCount] = useState<number>(10);
  const [draftRevisions, setDraftRevisions] = useState<Record<string, { cant_contada: number; notas?: string }>>({});

  // 3. Procesamiento y Consolidación Automática del Cíclico con 999 y SDIF (+ Reconteo Supervisor)
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
      products,
      supervisorRevisions
    );

    return {
      itemsConsolidados: consolidado.items,
      metadataCiclico: metadata,
      totalesCiclico: consolidado.totales as CiclicoTotales
    };
  }, [rawCiclico, items, products, supervisorRevisions]);

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

  // Detectar fecha automáticamente al pegar el texto
  const handlePastedCiclicoChange = (text: string) => {
    setPastedCiclicoText(text);
    setCiclicoParseError('');
    const { metadata } = parseCiclicoRawText(text);
    if (metadata.fecha_reporte) {
      const parts = metadata.fecha_reporte.split(/[\/\-\.]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // DD/MM/YYYY -> YYYY-MM-DD
          setModalFecha(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        } else if (parts[0].length === 4) {
          // YYYY-MM-DD
          setModalFecha(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
        }
      }
    }
  };

  const handleCiclicoFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        handlePastedCiclicoChange(content);
      } catch (err) {
        setCiclicoParseError(`Error leyendo archivo: ${err}`);
      }
    };
    reader.readAsText(file);
  };

  // Guardar nuevo Cíclico en la Nube y en Estado Local
  const handleSavePastedCiclico = async () => {
    if (!pastedCiclicoText.trim()) {
      setCiclicoParseError('Debes pegar o cargar el contenido del reporte.');
      return;
    }
    const { metadata, rows } = parseCiclicoRawText(pastedCiclicoText);
    if (rows.length === 0) {
      setCiclicoParseError('No se detectaron filas válidas de inventario cíclico. Verifica el formato.');
      return;
    }

    setIsSavingDailyCiclico(true);
    setCiclicoParseError('');
    try {
      // 1. Consolidar temporalmente para obtener totales y conciliaciones exactas
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

      const consolidado = consolidarInventario(rows, rows999, rowsSdif, products);

      // 2. Persistir en la Nube (Supabase) para que esté disponible en todos los PCs
      if (onSaveCiclicoDelDia) {
        const ok = await onSaveCiclicoDelDia({
          fecha: modalFecha,
          rawText: pastedCiclicoText,
          metadata,
          totales: consolidado.totales as CiclicoTotales,
          itemsConsolidados: consolidado.items
        });

        if (!ok) {
          setCiclicoParseError('Error guardando en la nube. Revisa la conexión e intenta nuevamente.');
          return;
        }
      }

      setRawCiclico(pastedCiclicoText);
      setSelectedFecha(modalFecha);
      localStorage.setItem('nexus_zonales_raw_ciclico', pastedCiclicoText);
      setShowCiclicoModal(false);
      setPastedCiclicoText('');
      setCiclicoParseError('');
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
    } catch (err) {
      setCiclicoParseError(`Error procesando reporte: ${err}`);
    } finally {
      setIsSavingDailyCiclico(false);
    }
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

  // Top SKUs con diferencias seleccionados para auditoría del supervisor (Tablet)
  const topItemsForReview = useMemo(() => {
    return [...itemsConsolidados]
      .filter(item => {
        const origDife = item.revision_supervisor?.diferencia_original ?? item.diferencia;
        return origDife !== 0 || item.revisado_supervisor || item.lotes_desglose.some(l => l.diferencia !== 0);
      })
      .sort((a, b) => {
        const difA = Math.abs(a.revision_supervisor?.diferencia_original ?? a.diferencia);
        const difB = Math.abs(b.revision_supervisor?.diferencia_original ?? b.diferencia);
        if (difB !== difA) return difB - difA;
        return Math.abs(b.dif_precio) - Math.abs(a.dif_precio);
      })
      .slice(0, topNCount === 999 ? undefined : topNCount);
  }, [itemsConsolidados, topNCount]);

  const countItemsWithDifferences = useMemo(() => {
    return itemsConsolidados.filter(i => {
      const origDife = i.revision_supervisor?.diferencia_original ?? i.diferencia;
      return origDife !== 0 || i.revisado_supervisor;
    }).length;
  }, [itemsConsolidados]);

  // Abrir Modal Tablet con borrador inicial
  const handleOpenTabletReview = () => {
    const initialDrafts: Record<string, { cant_contada: number; notas?: string }> = {};
    topItemsForReview.forEach(item => {
      if (supervisorRevisions[item.sku]) {
        initialDrafts[item.sku] = { ...supervisorRevisions[item.sku] };
      } else {
        initialDrafts[item.sku] = {
          cant_contada: item.cant_contada,
          notas: ''
        };
      }
    });
    setDraftRevisions(initialDrafts);
    setIsTabletReviewOpen(true);
  };

  // Modificar valor en el borrador de la tablet
  const handleDraftChange = (sku: string, newCount: number, notes?: string) => {
    setDraftRevisions(prev => ({
      ...prev,
      [sku]: {
        cant_contada: Math.max(0, newCount),
        notas: notes !== undefined ? notes : prev[sku]?.notas || ''
      }
    }));
  };

  // Aplicar Reconteos del Supervisor
  const handleApplySupervisorRevisions = () => {
    const newRevisions = { ...supervisorRevisions };
    Object.entries(draftRevisions).forEach(([sku, rev]) => {
      newRevisions[sku] = {
        cant_contada: Number(rev.cant_contada),
        notas: rev.notas?.trim(),
        supervisor_nombre: currentUser?.nombre || 'Supervisor CD'
      };
    });
    setSupervisorRevisions(newRevisions);
    localStorage.setItem('nexus_supervisor_revisions', JSON.stringify(newRevisions));
    setIsTabletReviewOpen(false);
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
  };

  // Deshacer / Restablecer Conteo Original
  const handleClearSupervisorRevisions = () => {
    if (window.confirm('¿Deseas eliminar las modificaciones de reconteo del supervisor y volver al 1er conteo original del cíclico?')) {
      setSupervisorRevisions({});
      localStorage.removeItem('nexus_supervisor_revisions');
      confetti({ particleCount: 30, spread: 50 });
    }
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
    let idxTipoAlm = -1;
    let idxVal = -1;

    for (let c = 0; c < firstRowCols.length; c++) {
      const colName = firstRowCols[c];
      // 1. Descripción primero para que 'descripción material' no sea absorbido por 'material'
      if (colName.includes('texto') || colName.includes('descrip') || colName.includes('denominac') || colName === 'maktx') {
        idxDesc = c;
      } else if (colName.includes('tipo almac') || colName.includes('tip.alm') || colName.includes('tipo alm') || colName === 'nltyp') {
        idxTipoAlm = c;
      } else if (colName === 'material' || colName === 'sku' || colName.includes('codigo') || colName.includes('código') || colName === 'matnr' || (colName.includes('material') && !colName.includes('descrip'))) {
        idxMat = c;
      } else if (colName.includes('disponible') || colName.includes('libre') || colName.includes('cant') || colName.includes('stock') || colName === 'clabs') {
        idxCant = c;
      } else if (colName.includes('umb') || colName.includes('unidad') || colName === 'un' || colName === 'meins') {
        idxUmb = c;
      } else if (colName.includes('lote') || colName === 'charg') {
        idxLote = c;
      } else if (colName.includes('almac') || colName.includes('alm') || colName === 'lgort') {
        idxAlm = c;
      } else if (colName.includes('valor') || colName.includes('peso') || colName.includes('import') || colName === 'dmbtr') {
        idxVal = c;
      }
    }

    const hasHeader = idxMat !== -1 || idxDesc !== -1 || idxCant !== -1;
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
      
      let cant = 0;
      if (idxCant >= 0 && cols[idxCant]) {
        const rawCant = cols[idxCant].trim().replace(/\s+/g, '');
        cant = parseFloat(rawCant.replace(',', '.')) || 0;
      }

      const umb = idxUmb >= 0 && cols[idxUmb] ? cols[idxUmb].toUpperCase() : 'UN';
      const lote = idxLote >= 0 && cols[idxLote] ? cols[idxLote] : '';
      
      let alm = defaultAlm;
      if (idxTipoAlm >= 0 && cols[idxTipoAlm]?.includes('999')) {
        alm = '999';
      } else if (idxAlm >= 0 && cols[idxAlm]) {
        const rawAlm = cols[idxAlm].toUpperCase();
        if (rawAlm.includes('999')) alm = '999';
        else if (rawAlm.includes('SDIF')) alm = 'SDIF';
        else alm = defaultAlm;
      }

      let val = 0;
      if (idxVal >= 0 && cols[idxVal]) {
        val = parseFloat(cols[idxVal].trim().replace(/\s+/g, '').replace(',', '.')) || 0;
      }

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
      errors.push('No se pudieron extraer registros válidos. Verifica que las columnas incluyan el código de Material y la Cantidad o Stock disponible.');
    }

    setParsedPreviewMb52(result);
    setParseErrorsMb52(errors);
  };

  const handleMb52FileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvText = XLSX.utils.sheet_to_csv(firstSheet, { FS: '\t' });
        setPastedMb52Text(csvText);
        parsePastedMb52(csvText, targetAlmacenModal);
      } catch (err) {
        setParseErrorsMb52([`Error leyendo archivo Excel: ${err}`]);
      }
    };
    reader.readAsArrayBuffer(file);
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
            <div className="flex items-center gap-2 flex-wrap">
              <Boxes className="w-5 h-5 text-[#008744]" />
              <h2 className="text-base font-extrabold text-slate-800">
                Inventario Cíclico CD Frío (Picking) & Almacenes 999 / SDIF
              </h2>
              <span className="text-[10px] bg-emerald-100 text-[#008744] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                SGSJ Santiago CD
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                <Cloud className="w-3 h-3 text-blue-600" />
                Persistencia en la Nube Activa
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cuadratura física de picking por SKU y conciliación compensada con diferencias de almacenes externos.
            </p>
          </div>

          {/* Selector de Historial Diario Persistido en Supabase y Botones de Acción */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200/90 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-xs font-black text-slate-700">Día:</span>
              <select
                value={selectedFecha}
                onChange={e => handleSelectFecha(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 py-1 px-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer max-w-[210px] truncate"
              >
                {ciclicoHistorial && ciclicoHistorial.length > 0 ? (
                  ciclicoHistorial.map(h => {
                    const cleanDate = h.fecha ? h.fecha.split('T')[0] : '';
                    return (
                      <option key={h.id || h.fecha} value={cleanDate}>
                        {formatChileanDate(cleanDate)} {cleanDate === getTodayChile() ? '(Hoy)' : ''} — {h.usuario || 'AMELLA'}
                      </option>
                    );
                  })
                ) : (
                  <option value={selectedFecha}>{formatChileanDate(selectedFecha)} (Hoy)</option>
                )}
              </select>

              {onRefreshCiclicoHistorial && (
                <button
                  onClick={() => onRefreshCiclicoHistorial()}
                  title="Refrescar historial desde la nube"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistorial ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setModalFecha(getTodayChile());
                setShowCiclicoModal(true);
                setPastedCiclicoText('');
                setCiclicoParseError('');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Cargar o actualizar el reporte cíclico del día en la nube"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Cargar Cíclico del Día</span>
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
          
          {/* Banner de Fecha Activa y Persistencia en la Nube */}
          <div className="bg-emerald-50/70 border border-emerald-200/90 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span className="font-bold text-slate-700">
                Inventario Cíclico del Día:
              </span>
              <span className="font-black text-emerald-950 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300 font-mono text-xs shadow-2xs">
                {formatChileanDate(selectedFecha)}
              </span>
              {selectedFecha === getTodayChile() ? (
                <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-2xs">
                  HOY
                </span>
              ) : (
                <span className="bg-slate-200 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-full">
                  HISTÓRICO
                </span>
              )}
              {activeHistorialItem?.usuario && (
                <span className="text-[11px] text-slate-500 font-medium">
                  Guardado por: <strong className="text-slate-800">{activeHistorialItem.usuario}</strong> ({activeHistorialItem.hora || ''})
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-lg border border-emerald-200/60">
              <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sincronizado en la nube (compartido en tiempo real en todos los PCs)</span>
            </div>
          </div>
          
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

          {/* BANNER AUDITORÍA EN TERRENO (TABLET): RECONTEO TOP N SKUS */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-indigo-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-3 bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 rounded-2xl shrink-0">
                <Tablet className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold text-white text-sm sm:text-base">
                    Auditoría en Terreno (Tablet) — Reconteo de Supervisor
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {countItemsWithDifferences} SKUs con descuadre
                  </span>
                  {Object.keys(supervisorRevisions).length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ {Object.keys(supervisorRevisions).length} auditados
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl">
                  Inspección física en rack de los SKUs con mayores diferencias. El supervisor ajusta el reconteo real para modificar la diferencia final y habilitar la cascada de conciliación (<strong>999 CD</strong> y luego <strong>SDIF Zonales</strong>).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Selector de Top N */}
              <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 text-xs">
                <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top:</span>
                {[5, 10, 15, 20, 999].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTopNCount(n)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      topNCount === n
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    {n === 999 ? 'Todos' : n}
                  </button>
                ))}
              </div>

              {/* Botón Abrir Tablet */}
              <button
                type="button"
                onClick={handleOpenTabletReview}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Tablet className="w-4 h-4 text-indigo-200" />
                <span>Auditar en Tablet ({topItemsForReview.length})</span>
              </button>

              {/* Botón Deshacer / Resetear si existen cambios */}
              {Object.keys(supervisorRevisions).length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSupervisorRevisions}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  title="Restablecer todos los reconteos al 1er conteo original del operador"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Restablecer</span>
                </button>
              )}
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
                            
                            {/* Botón Desplegar Lotes / Auditoría */}
                            <td className="p-3 text-center">
                              {item.lotes_desglose.length > 1 || item.revisado_supervisor ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedSku(isExpanded ? null : item.sku)}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Ver detalle por lotes o reconteo supervisor"
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
                              <div className="flex flex-col items-end">
                                <span>{item.cant_contada}</span>
                                {item.revisado_supervisor && (
                                  <span 
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 mt-0.5"
                                    title={`Reconteo en Terreno por ${item.revision_supervisor?.supervisor_nombre || 'Supervisor'}. Conteo original: ${item.revision_supervisor?.cant_contada_original} CJ.`}
                                  >
                                    <ClipboardCheck className="w-2.5 h-2.5 text-amber-700" />
                                    <span>Sup. ({item.revision_supervisor?.cant_contada_original} ➔ {item.cant_contada})</span>
                                  </span>
                                )}
                              </div>
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

                          {/* Detalle Expandido de Lotes y Auditoría */}
                          {isExpanded && (item.lotes_desglose.length > 0 || item.revisado_supervisor) && (
                            <tr className="bg-slate-50/90 border-y border-slate-200">
                              <td colSpan={11} className="p-4 pl-12">
                                {/* Banner de Auditoría del Supervisor si fue revisado */}
                                {item.revisado_supervisor && item.revision_supervisor && (
                                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                    <div className="flex items-start gap-2.5">
                                      <div className="p-1.5 bg-amber-200/80 text-amber-800 rounded-lg shrink-0 mt-0.5">
                                        <ClipboardCheck className="w-4 h-4 text-amber-800" />
                                      </div>
                                      <div>
                                        <div className="font-bold text-xs flex items-center gap-2">
                                          <span>Auditoría Física en Terreno ({item.revision_supervisor.supervisor_nombre || 'Supervisor CD'})</span>
                                          <span className="text-[10px] text-amber-700 font-mono font-normal">
                                            {item.revision_supervisor.fecha_revision}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-amber-900 mt-0.5">
                                          1er Conteo Operador: <strong>{item.revision_supervisor.cant_contada_original} CJ</strong> (Dif: {item.revision_supervisor.diferencia_original} CJ) ➔ 
                                          Reconteo Físico Supervisor: <strong>{item.revision_supervisor.cant_contada_supervisor} CJ</strong> (Dif Real: <strong>{item.revision_supervisor.diferencia_supervisor > 0 ? `+${item.revision_supervisor.diferencia_supervisor}` : item.revision_supervisor.diferencia_supervisor} CJ</strong>).
                                        </p>
                                        {item.revision_supervisor.notas && (
                                          <p className="text-[11px] text-amber-950 font-medium italic mt-1 bg-amber-100/70 border border-amber-200/60 px-2.5 py-1 rounded-md">
                                            "{item.revision_supervisor.notas}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleOpenTabletReview}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>Editar en Tablet</span>
                                    </button>
                                  </div>
                                )}

                                {item.lotes_desglose.length > 0 && (
                                  <>
                                    <div className="text-[11px] font-bold text-slate-700 mb-2">
                                      Desglose de Conteo por Lote de este Producto (Auditoría SAP):
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
                                  </>
                                )}
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

            <div className="flex flex-wrap items-center gap-2">
              {activeSubTab === 'sdif' && (
                <a
                  href="/Inventario_SDIF_CIAL.xlsx"
                  download="Inventario_SDIF_CIAL.xlsx"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#008744] border border-emerald-300 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Descargar base maestra de inventario SDIF en Excel"
                >
                  <Download className="w-4 h-4 text-[#008744]" />
                  <span>Descargar Base SDIF (.xlsx)</span>
                </a>
              )}

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
              {/* Selector de Fecha del Inventario Cíclico */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <label className="text-xs font-black text-emerald-950 block">
                      Fecha del Cíclico (Día de Conteo):
                    </label>
                    <span className="text-[11px] text-emerald-800">
                      Se guardará en la nube para esta fecha y persistirá en todos los PCs.
                    </span>
                  </div>
                </div>
                <input
                  type="date"
                  value={modalFecha}
                  onChange={e => setModalFecha(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                />
              </div>

              {/* Opción para subir archivo de texto o TSV de SAP */}
              <div className="p-3 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl transition-all text-center">
                <input
                  type="file"
                  id="ciclico-file-upload"
                  accept=".txt,.tsv,.csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.[0]) {
                      handleCiclicoFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="ciclico-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1"
                >
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Cargar archivo exportado de SAP (o pegar abajo)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Haz clic aquí si guardaste el reporte en archivo de texto o TSV
                  </span>
                </label>
              </div>

              <textarea
                value={pastedCiclicoText}
                onChange={e => handlePastedCiclicoChange(e.target.value)}
                rows={8}
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
                disabled={isSavingDailyCiclico}
                className="px-5 py-2 bg-[#008744] hover:bg-[#007038] disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                {isSavingDailyCiclico ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando en la Nube...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Guardar Cíclico en la Nube y Cuadrar</span>
                  </>
                )}
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
              {/* Opción 1: Subir Archivo Excel o Texto */}
              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl transition-all text-center">
                <input
                  type="file"
                  id="mb52-file-upload"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.[0]) {
                      handleMb52FileUpload(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="mb52-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Cargar archivo Excel (.xlsx) o texto exportado de SAP
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Haz clic aquí para seleccionar el archivo exportado de SAP (MB52 o LX02)
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[10px] font-black uppercase text-slate-400">O pegar texto directamente</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              <textarea
                value={pastedMb52Text}
                onChange={e => {
                  setPastedMb52Text(e.target.value);
                  parsePastedMb52(e.target.value, targetAlmacenModal);
                }}
                rows={6}
                placeholder="Pega aquí los datos de SAP MB52 o LX02 (Material, Texto breve, Libre utilización, Lote, Almacén, Valor...)"
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

      {/* ========================================================================= */}
      {/* MODAL AUDITORÍA EN TABLET (TOP N SKUS CON DIFERENCIAS - SUPERVISOR)       */}
      {/* ========================================================================= */}
      {isTabletReviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700 max-w-5xl w-full h-[94vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-600/30">
                  <Tablet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Auditoría en Terreno — Tablet Supervisor
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Picking Outbound (PCG)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Inspección física en rack. Ajusta el reconteo real para modificar la diferencia y habilitar la cascada (<strong>999 CD ➔ SDIF Zonales</strong>).
                  </p>
                </div>
              </div>

              {/* Selector de Top N + Botón Cerrar */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1 text-xs">
                  <span className="px-2 text-[10px] font-bold text-slate-400 uppercase">Top:</span>
                  {[5, 10, 15, 20, 999].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTopNCount(n)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        topNCount === n
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {n === 999 ? 'Todos' : n}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsTabletReviewOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Cerrar sin guardar cambios"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Cards de SKUs Táctiles */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-900/90">
              {topItemsForReview.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">No hay SKUs con diferencias para auditar.</p>
                  <p className="text-xs text-slate-500 mt-1">Todos los productos del inventario se encuentran perfectamente cuadrados ($0 impacto).</p>
                </div>
              ) : (
                topItemsForReview.map((item, index) => {
                  const draft = draftRevisions[item.sku] ?? {
                    cant_contada: supervisorRevisions[item.sku]?.cant_contada ?? item.cant_contada,
                    notas: supervisorRevisions[item.sku]?.notas ?? ''
                  };
                  const currentCount = draft.cant_contada;
                  const originalCount = item.revision_supervisor?.cant_contada_original ?? item.cant_contada;
                  const draftDife = currentCount - item.cant_sistema;
                  const draftDifePrecio = draftDife * item.precio_unitario;
                  const isModified = currentCount !== originalCount;

                  return (
                    <div 
                      key={item.sku}
                      className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                        isModified 
                          ? 'bg-slate-800/95 border-indigo-500/70 shadow-lg shadow-indigo-950/40' 
                          : 'bg-slate-800/50 border-slate-700/70 hover:border-slate-600'
                      }`}
                    >
                      {/* Top Bar de la Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-black">
                            #{index + 1}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-black">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                            {item.ubicacion || 'Sin Ubic.'}
                          </span>
                          <span className="font-mono font-black text-sm text-white">
                            SKU: {item.sku}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 font-mono">
                            ${item.precio_unitario.toLocaleString('es-CL')} / CJ
                          </span>
                          {isModified && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white shadow-xs">
                              Modificado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Descripción del Producto */}
                      <div className="py-2.5 text-sm font-bold text-slate-200">
                        {item.descripcion}
                        <span className="text-xs text-slate-400 font-normal ml-2">
                          (Factor: {item.factor_empaque} UN/CJ)
                        </span>
                      </div>

                      {/* Grilla Comparativa Táctil */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                        {/* 1. Cantidad Sistema SAP */}
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 text-center flex flex-col justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            1. Sistema SAP
                          </span>
                          <div className="text-2xl font-black font-mono text-slate-200 my-1">
                            {item.cant_sistema}
                          </div>
                          <span className="text-[10px] text-slate-400">Cajas teóricas</span>
                        </div>

                        {/* 2. Primer Conteo Operador */}
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 text-center flex flex-col justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            2. 1er Conteo Operador
                          </span>
                          <div className="text-2xl font-black font-mono text-slate-300 my-1">
                            {originalCount}
                          </div>
                          <span className={`text-[10px] font-mono font-bold ${
                            originalCount - item.cant_sistema < 0 ? 'text-rose-400' : (originalCount - item.cant_sistema > 0 ? 'text-blue-400' : 'text-emerald-400')
                          }`}>
                            Dif: {originalCount - item.cant_sistema > 0 ? `+${originalCount - item.cant_sistema}` : originalCount - item.cant_sistema} CJ
                          </span>
                        </div>

                        {/* 3. Reconteo Físico Supervisor (Stepper Táctil) */}
                        <div className="bg-slate-900/95 p-3 rounded-xl border-2 border-indigo-500/80 col-span-2 md:col-span-1 shadow-inner flex flex-col justify-between">
                          <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider block text-center">
                            3. Reconteo Físico Supervisor
                          </span>
                          
                          <div className="flex items-center justify-center gap-2 my-1.5">
                            <button
                              type="button"
                              onClick={() => handleDraftChange(item.sku, Math.max(0, currentCount - 1), draft.notas)}
                              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-black text-lg border border-slate-600 transition-all cursor-pointer"
                              title="Restar 1 caja"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            
                            <input
                              type="number"
                              min="0"
                              value={isNaN(currentCount) ? '' : currentCount}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                handleDraftChange(item.sku, isNaN(val) ? 0 : val, draft.notas);
                              }}
                              className="w-20 h-10 text-center bg-slate-950 border border-indigo-500/60 rounded-xl font-mono text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />

                            <button
                              type="button"
                              onClick={() => handleDraftChange(item.sku, currentCount + 1, draft.notas)}
                              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-black text-lg border border-slate-600 transition-all cursor-pointer"
                              title="Sumar 1 caja"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Botones de Acción Rápida */}
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDraftChange(item.sku, item.cant_sistema, draft.notas)}
                              className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              title="Ajustar a la cantidad teórica del sistema (Cuadrar)"
                            >
                              ✓ Cuadrar ({item.cant_sistema})
                            </button>
                            {isModified && (
                              <button
                                type="button"
                                onClick={() => handleDraftChange(item.sku, originalCount, draft.notas)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                title="Volver al primer conteo reportado por el operador"
                              >
                                ↩ 1er Conteo ({originalCount})
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4. Diferencia Real Resultante */}
                        <div className={`p-3 rounded-xl border text-center flex flex-col justify-between ${
                          draftDife === 0 
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                            : draftDife < 0 
                              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                              : 'bg-blue-950/40 border-blue-500/50 text-blue-300'
                        }`}>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider block">
                              4. Diferencia Real
                            </span>
                            <div className="text-2xl font-black font-mono my-1">
                              {draftDife > 0 ? `+${draftDife}` : draftDife} CJ
                            </div>
                            <div className="text-xs font-mono font-bold">
                              {draftDifePrecio < 0 
                                ? `- $${Math.abs(draftDifePrecio).toLocaleString('es-CL')}` 
                                : (draftDifePrecio > 0 ? `+ $${draftDifePrecio.toLocaleString('es-CL')}` : '$0')}
                            </div>
                          </div>
                          <div className="mt-2">
                            {draftDife === 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                                100% Cuadrado
                              </span>
                            )}
                            {draftDife < 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/30 text-rose-300 border border-rose-500/40">
                                Faltante Real
                              </span>
                            )}
                            {draftDife > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/30 text-blue-300 border border-blue-500/40" title="Habilita conciliación con Almacén 999 y luego SDIF">
                                Sobrante Real ➔ Cruce
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Campo de Notas de Terreno */}
                      <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-slate-500 shrink-0" />
                        <input
                          type="text"
                          placeholder="Notas de terreno (ej: pallet mal rotulado, producto en doble fondo, lote cruzado con 008...)"
                          value={draft.notas || ''}
                          onChange={e => handleDraftChange(item.sku, currentCount, e.target.value)}
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">SKUs en Revisión:</span>
                  <span className="font-mono font-black text-white text-sm">{topItemsForReview.length} productos</span>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Modificados:</span>
                  <span className="font-mono font-black text-indigo-400 text-sm">
                    {Object.keys(draftRevisions).filter(sku => {
                      const item = itemsConsolidados.find(i => i.sku === sku);
                      const orig = item?.revision_supervisor?.cant_contada_original ?? item?.cant_contada;
                      return draftRevisions[sku]?.cant_contada !== orig;
                    }).length} SKUs ajustados
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsTabletReviewOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplySupervisorRevisions}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#008744] hover:bg-emerald-600 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4 text-white" />
                  <span>Aplicar Revisión y Conciliar</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
