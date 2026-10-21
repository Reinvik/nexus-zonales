import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Download, 
  Trash2, 
  ArrowUpDown,
  Truck,
  Calendar,
  Layers,
  Building2,
  Clock,
  Camera,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { Desviacion, EstadoNC, UsuarioCuenta } from '../types';
import { CIAL_ZONALES } from '../data/zonales';
import { exportDeviationsToExcel } from '../utils/excel';
import { formatChileanDate } from '../utils/date';

interface ConsolidatedViewProps {
  items: Desviacion[];
  onUpdateStatusNC: (id: string, newStatus: EstadoNC) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  currentUser?: UsuarioCuenta;
}

export const ConsolidatedView: React.FC<ConsolidatedViewProps> = ({
  items,
  onUpdateStatusNC,
  onDeleteItem,
  currentUser
}) => {
  // Filtros
  const [search, setSearch] = useState('');
  const [filterZonal, setFilterZonal] = useState('TODAS');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [filterEstadoNC, setFilterEstadoNC] = useState<string>('TODOS');
  const [filterFecha, setFilterFecha] = useState<string>('');

  // Orden
  const [sortField, setSortField] = useState<'fecha' | 'zonal' | 'cantidad' | 'kilos'>('fecha');
  const [sortAsc, setSortAsc] = useState(false);

  // Modal Visor de Fotos del Transporte
  const [previewPhotos, setPreviewPhotos] = useState<string[] | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);

  // Filtrado reactivo
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Búsqueda por texto
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = 
          item.sku.toLowerCase().includes(q) ||
          item.descripcion.toLowerCase().includes(q) ||
          (item.lote && item.lote.toLowerCase().includes(q)) ||
          (item.num_factura && item.num_factura.toLowerCase().includes(q)) ||
          (item.folio_ref && item.folio_ref.toLowerCase().includes(q)) ||
          (item.cod_cliente && item.cod_cliente.toLowerCase().includes(q)) ||
          (item.nombre_cliente && item.nombre_cliente.toLowerCase().includes(q)) ||
          (item.transporte && item.transporte.toLowerCase().includes(q)) ||
          item.zonal.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Filtro Zonal
      if (filterZonal !== 'TODAS' && item.zonal !== filterZonal) {
        return false;
      }

      // Filtro Tipo
      if (filterTipo !== 'TODOS' && item.tipo !== filterTipo) {
        return false;
      }

      // Filtro Estado NC
      if (filterEstadoNC !== 'TODOS' && (item.estado_nc || 'Pendiente') !== filterEstadoNC) {
        return false;
      }

      // Filtro Fecha
      if (filterFecha && item.fecha !== filterFecha && item.fecha_dig !== filterFecha) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'fecha') {
        const dateA = new Date(a.fecha_dig || a.fecha).getTime();
        const dateB = new Date(b.fecha_dig || b.fecha).getTime();
        return sortAsc ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'zonal') {
        return sortAsc ? a.zonal.localeCompare(b.zonal) : b.zonal.localeCompare(a.zonal);
      }
      if (sortField === 'cantidad') {
        return sortAsc ? a.cantidad - b.cantidad : b.cantidad - a.cantidad;
      }
      if (sortField === 'kilos') {
        return sortAsc ? a.kilos - b.kilos : b.kilos - a.kilos;
      }
      return 0;
    });
  }, [items, search, filterZonal, filterTipo, filterEstadoNC, filterFecha, sortField, sortAsc]);

  // Totales para métricas
  const totals = useMemo(() => {
    const faltantes = filteredItems.filter(i => i.tipo === 'faltante');
    const sobrantes = filteredItems.filter(i => i.tipo === 'sobrante');
    const dano = filteredItems.filter(i => i.tipo === 'dano_mecanico');
    const cambiados = filteredItems.filter(i => i.tipo === 'producto_cambiado');

    return {
      total: filteredItems.length,
      faltantesCount: faltantes.length,
      faltantesKg: faltantes.reduce((sum, i) => sum + i.kilos, 0),
      sobrantesCount: sobrantes.length,
      sobrantesKg: sobrantes.reduce((sum, i) => sum + i.kilos, 0),
      danoCount: dano.length,
      cambiadosCount: cambiados.length
    };
  }, [filteredItems]);

  const handleExport = () => {
    exportDeviationsToExcel(filteredItems);
  };

  const toggleSort = (field: 'fecha' | 'zonal' | 'cantidad' | 'kilos') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. Tarjetas de Resumen KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Faltantes */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">
            Faltantes
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-800">{totals.faltantesCount}</span>
            <span className="text-xs font-mono font-bold text-slate-500">{totals.faltantesKg.toFixed(1)} kg</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Diferencias en camión</span>
        </div>

        {/* Sobrantes */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs font-bold text-[#008744] uppercase tracking-wider block">
            Sobrantes
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-800">{totals.sobrantesCount}</span>
            <span className="text-xs font-mono font-bold text-slate-500">{totals.sobrantesKg.toFixed(1)} kg</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Mercadería sin guía</span>
        </div>

        {/* Daño Mecánico */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">
            Daño Mecánico
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-800">{totals.danoCount}</span>
            <span className="text-xs text-slate-400">casos</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Averías en transporte</span>
        </div>

        {/* Total Desviaciones */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
            Total Desviaciones
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-800">{totals.total}</span>
            <span className="text-xs text-slate-500 font-bold">registros</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Faltantes y sobrantes de camión</span>
        </div>
      </div>

      {/* 2. Barra de Filtros y Botón de Exportar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#008744]" />
              Consolidado General de Desviaciones
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualiza en tiempo real todos los reportes de sucursales con la estructura exacta de CIAL.
            </p>
          </div>

          <button
            onClick={handleExport}
            disabled={filteredItems.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel Oficial ({filteredItems.length})</span>
          </button>
        </div>

        {/* Fila de controles de filtrado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2">
          {/* Búsqueda */}
          <div className="relative md:col-span-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar SKU, descripción, factura SAP, cliente, lote..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Filtro Zonal */}
          <div>
            <select
              value={filterZonal}
              onChange={(e) => setFilterZonal(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="TODAS">Todas las Zonales</option>
              {CIAL_ZONALES.map(z => (
                <option key={z.code} value={z.zonal}>{z.zonal}</option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo */}
          <div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="TODOS">Todos los Tipos</option>
              <option value="faltante">🔴 Faltantes</option>
              <option value="sobrante">🟢 Sobrantes</option>
              <option value="dano_mecanico">🟡 Daño Mecánico</option>
            </select>
          </div>

          {/* Filtro Estado NC */}
          <div>
            <select
              value={filterEstadoNC}
              onChange={(e) => setFilterEstadoNC(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="TODOS">Cualquier Estado NC</option>
              <option value="Pendiente">Pendiente</option>
              <option value="NC Solicitada">NC Solicitada</option>
              <option value="NC lista">NC Lista</option>
              <option value="Conciliado">Conciliado</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Tabla Consolidada (Estructura idéntica al reporte CIAL) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">No se encontraron desviaciones registradas</p>
            <p className="text-xs text-slate-400">Ajusta los filtros o ingresa nuevos reportes desde el módulo de ingreso.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/90 text-slate-600 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 cursor-pointer hover:bg-slate-200" onClick={() => toggleSort('zonal')}>
                    <div className="flex items-center gap-1">
                      <span>Zonal</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="p-3">Alm.</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 text-center">UMV</th>
                  <th className="p-3 text-right cursor-pointer hover:bg-slate-200" onClick={() => toggleSort('cantidad')}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Cant.</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="p-3 text-right cursor-pointer hover:bg-slate-200" onClick={() => toggleSort('kilos')}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Kilos</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="p-3">Cod. Cliente</th>
                  <th className="p-3">Nombre Cliente</th>
                  <th className="p-3">N° Fact. SAP</th>
                  <th className="p-3">Folio Ref.</th>
                  <th className="p-3">Lote</th>
                  <th className="p-3">Sector</th>
                  <th className="p-3">Transporte</th>
                  <th className="p-3 cursor-pointer hover:bg-slate-200" onClick={() => toggleSort('fecha')}>
                    <div className="flex items-center gap-1">
                      <span>Fecha Dig-</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="p-3">Llegada Camión</th>
                  <th className="p-3">Estado NC</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold whitespace-nowrap">
                      {item.tipo === 'faltante' && <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">🔴 Faltante</span>}
                      {item.tipo === 'sobrante' && <span className="text-[#008744] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">🟢 Sobrante</span>}
                      {item.tipo === 'dano_mecanico' && <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">🟡 Daño</span>}
                    </td>

                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                      {item.zonal}
                    </td>

                    <td className="p-3 font-mono text-slate-600 font-bold whitespace-nowrap">
                      {item.almacen}
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {item.sku}
                    </td>

                    <td className="p-3 max-w-[220px]">
                      <div className="font-semibold text-slate-800 truncate" title={item.descripcion}>
                        {item.descripcion}
                      </div>
                    </td>

                    <td className="p-3 text-center font-bold whitespace-nowrap">
                      {item.umv || 'UN'}
                    </td>

                    <td className="p-3 text-right font-bold whitespace-nowrap">
                      {item.cantidad}
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {item.kilos} kg
                    </td>

                    <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                      {item.cod_cliente || '—'}
                    </td>

                    <td className="p-3 max-w-[160px] truncate text-slate-700" title={item.nombre_cliente || ''}>
                      {item.nombre_cliente || '—'}
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {item.num_factura || '—'}
                    </td>

                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.folio_ref || '—'}
                    </td>

                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.lote || '—'}
                    </td>

                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.sector || '—'}
                    </td>

                    <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                      {item.transporte || '—'}
                    </td>

                    <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                      {formatChileanDate(item.fecha_dig || item.fecha)}
                    </td>

                    <td className="p-3 whitespace-nowrap text-[11px] text-slate-600">
                      <div>
                        {item.fecha_llegada_camion ? (
                          <span className="font-semibold text-slate-800">
                            {formatChileanDate(item.fecha_llegada_camion)} • {item.hora_llegada_camion || ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </div>
                      {(item.pallets_recibidos !== undefined && item.pallets_recibidos !== null || item.bandejas_recibidas !== undefined && item.bandejas_recibidas !== null) && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {item.pallets_recibidos != null && <span>📦 {item.pallets_recibidos} plts</span>}
                          {item.pallets_recibidos != null && item.bandejas_recibidas != null && <span> • </span>}
                          {item.bandejas_recibidas != null && <span>🧺 {item.bandejas_recibidas} bdjs</span>}
                        </div>
                      )}
                      {item.fotos && item.fotos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPhotos(item.fotos!);
                            setActivePhotoIdx(0);
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded cursor-pointer transition-all border border-emerald-300 shadow-2xs"
                          title="Ver fotos adjuntas de la descarga"
                        >
                          <Camera className="w-3 h-3 text-emerald-700" />
                          <span>{item.fotos.length} {item.fotos.length === 1 ? 'foto' : 'fotos'}</span>
                        </button>
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <select
                        value={item.estado_nc || 'Pendiente'}
                        onChange={(e) => onUpdateStatusNC(item.id, e.target.value as EstadoNC)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                          item.estado_nc === 'NC lista'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : item.estado_nc === 'NC Solicitada'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : item.estado_nc === 'Conciliado'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="NC Solicitada">NC Solicitada</option>
                        <option value="NC lista">NC Lista</option>
                        <option value="Conciliado">Conciliado</option>
                      </select>
                    </td>

                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Visor de Fotos de Recepción del Camión */}
      {previewPhotos && previewPhotos.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
          onClick={() => setPreviewPhotos(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-3 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">
                  Fotos de Recepción y Descarga ({activePhotoIdx + 1} de {previewPhotos.length})
                </span>
              </div>
              <button
                onClick={() => setPreviewPhotos(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 max-h-[68vh] flex items-center justify-center overflow-hidden">
              <img 
                src={previewPhotos[activePhotoIdx]} 
                alt={`Foto camión ${activePhotoIdx + 1}`}
                className="max-h-[66vh] max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>

            {/* Selector de fotos si hay más de una */}
            {previewPhotos.length > 1 && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800 overflow-x-auto max-w-full">
                {previewPhotos.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhotoIdx(i)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      activePhotoIdx === i ? 'border-emerald-500 scale-105' : 'border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={f} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
