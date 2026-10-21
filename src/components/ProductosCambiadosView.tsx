import React, { useState, useMemo } from 'react';
import { 
  ArrowRightLeft, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Calendar, 
  Layers, 
  FileText,
  Boxes,
  Truck,
  RotateCcw
} from 'lucide-react';
import { Desviacion, EstadoNC } from '../types';
import { formatChileanDate } from '../utils/date';
import { exportDeviationsToExcel } from '../utils/excel';

interface ProductosCambiadosViewProps {
  items: Desviacion[];
  onUpdateStatusNC: (id: string, newStatus: EstadoNC) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const ProductosCambiadosView: React.FC<ProductosCambiadosViewProps> = ({
  items,
  onUpdateStatusNC
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZonal, setFilterZonal] = useState('TODAS');
  const [filterEstadoNC, setFilterEstadoNC] = useState<string>('TODOS');

  // Solo ítems de tipo producto_cambiado
  const changedItems = useMemo(() => {
    return items.filter(i => i.tipo === 'producto_cambiado');
  }, [items]);

  // Lista única de zonales con productos cambiados
  const zonalesConCambios = useMemo(() => {
    const set = new Set(changedItems.map(i => i.zonal));
    return Array.from(set).sort();
  }, [changedItems]);

  // Filtrado
  const filtered = useMemo(() => {
    return changedItems.filter(item => {
      // Búsqueda
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match = 
          item.sku.toLowerCase().includes(q) ||
          item.descripcion.toLowerCase().includes(q) ||
          (item.producto_cambiado_sku && item.producto_cambiado_sku.toLowerCase().includes(q)) ||
          (item.producto_cambiado_desc && item.producto_cambiado_desc.toLowerCase().includes(q)) ||
          item.zonal.toLowerCase().includes(q) ||
          (item.num_factura && item.num_factura.toLowerCase().includes(q));
        if (!match) return false;
      }

      // Filtro Zonal
      if (filterZonal !== 'TODAS' && item.zonal !== filterZonal) {
        return false;
      }

      // Filtro Estado NC
      if (filterEstadoNC !== 'TODOS' && item.estado_nc !== filterEstadoNC) {
        return false;
      }

      return true;
    });
  }, [changedItems, searchTerm, filterZonal, filterEstadoNC]);

  // Totales y KPIs
  const totalKilos = useMemo(() => {
    return filtered.reduce((acc, i) => acc + (i.kilos || 0), 0);
  }, [filtered]);

  const totalCajas = useMemo(() => {
    return filtered.reduce((acc, i) => acc + (i.cantidad || 0), 0);
  }, [filtered]);

  return (
    <div className="space-y-6">
      
      {/* Header del Módulo Centralizado Santiago */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-xs">
              <ArrowRightLeft className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Gestión Centralizada de Productos Cambiados
                </h2>
                <span className="bg-emerald-100 text-[#008744] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300 uppercase">
                  Exclusivo SGSJ Santiago
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Control y regularización de discrepancias de despacho: producto facturado vs producto físico recibido en sucursales.
              </p>
            </div>
          </div>

          <button
            onClick={() => exportDeviationsToExcel(filtered, 'Reporte_Productos_Cambiados_SGSJ.xlsx')}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 bg-[#008744] hover:bg-[#006e37] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Exportar a Excel</span>
          </button>
        </div>

        {/* Tarjetas KPI de Productos Cambiados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Casos Reportados</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{filtered.length}</span>
            <span className="text-[10px] text-slate-400">Total discrepancias</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Kilos Afectados</span>
            <span className="text-xl font-black text-blue-600 mt-0.5 block">{totalKilos.toFixed(1)} <span className="text-xs font-medium text-slate-500">kg</span></span>
            <span className="text-[10px] text-slate-400">Peso físico en tránsito</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Cajas Desviadas</span>
            <span className="text-xl font-black text-indigo-600 mt-0.5 block">{totalCajas} <span className="text-xs font-medium text-slate-500">CJ</span></span>
            <span className="text-[10px] text-slate-400">Unidades de empaque</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Zonales Involucradas</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">{zonalesConCambios.length}</span>
            <span className="text-[10px] text-slate-400">Sucursales receptoras</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, producto esperado, recibido o factura..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro Zonal */}
          <select
            value={filterZonal}
            onChange={e => setFilterZonal(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="TODAS">Todas las Zonales</option>
            {zonalesConCambios.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          {/* Filtro Estado NC */}
          <select
            value={filterEstadoNC}
            onChange={e => setFilterEstadoNC(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="NC Solicitada">NC Solicitada</option>
            <option value="NC lista">NC lista</option>
            <option value="Conciliado">Conciliado</option>
          </select>
        </div>
      </div>

      {/* Tabla Comparativa de Productos Cambiados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-3.5">Fecha / Zonal</th>
                <th className="py-3 px-3.5">Factura / Transporte</th>
                <th className="py-3 px-3.5 bg-amber-50/60 text-amber-900 border-l border-r border-amber-200">
                  🔴 Producto Facturado (Esperado)
                </th>
                <th className="py-3 px-3.5 bg-blue-50/60 text-blue-900 border-r border-blue-200">
                  🟢 Producto Físico (Recibido)
                </th>
                <th className="py-3 px-3.5 text-center">Cant. / Kilos</th>
                <th className="py-3 px-3.5 text-center">Lote Físico</th>
                <th className="py-3 px-3.5 text-center">Estado NC</th>
                <th className="py-3 px-3.5 text-center">Acción Regularización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No hay registros de productos cambiados con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Fecha y Zonal */}
                    <td className="py-3 px-3.5">
                      <span className="font-bold text-slate-800 block">{item.zonal}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{formatChileanDate(item.fecha)}</span>
                    </td>

                    {/* Factura / Transporte */}
                    <td className="py-3 px-3.5">
                      <span className="font-mono font-bold text-slate-700 block">
                        Fac: {item.num_factura || 'S/N'}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[120px] block">
                        {item.transporte || 'CD Central'}
                      </span>
                    </td>

                    {/* Producto Facturado (Esperado) */}
                    <td className="py-3 px-3.5 bg-amber-50/20 border-l border-r border-amber-100">
                      <span className="font-mono font-bold text-amber-900 block">
                        SKU: {item.producto_cambiado_sku || 'No especificado'}
                      </span>
                      <span className="text-xs text-slate-700 font-semibold block truncate max-w-[200px]" title={item.producto_cambiado_desc}>
                        {item.producto_cambiado_desc || 'Sin descripción'}
                      </span>
                    </td>

                    {/* Producto Físico (Recibido) */}
                    <td className="py-3 px-3.5 bg-blue-50/20 border-r border-blue-100">
                      <span className="font-mono font-bold text-blue-900 block">
                        SKU: {item.sku}
                      </span>
                      <span className="text-xs text-slate-800 font-bold block truncate max-w-[200px]" title={item.descripcion}>
                        {item.descripcion}
                      </span>
                    </td>

                    {/* Cantidad y Kilos */}
                    <td className="py-3 px-3.5 text-center">
                      <span className="font-bold text-slate-800 block">
                        {item.cantidad} {item.umv}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {item.kilos} kg
                      </span>
                    </td>

                    {/* Lote */}
                    <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-700">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {item.lote || 'S/L'}
                      </span>
                    </td>

                    {/* Estado NC */}
                    <td className="py-3 px-3.5 text-center">
                      <select
                        value={item.estado_nc || 'Pendiente'}
                        onChange={(e) => onUpdateStatusNC(item.id, e.target.value as EstadoNC)}
                        className={`text-[10px] font-black px-2 py-1 rounded-full border cursor-pointer ${
                          item.estado_nc === 'Conciliado'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : item.estado_nc === 'NC lista'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : item.estado_nc === 'NC Solicitada'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="NC Solicitada">NC Solicitada</option>
                        <option value="NC lista">NC lista</option>
                        <option value="Conciliado">Conciliado</option>
                      </select>
                    </td>

                    {/* Acción rápida */}
                    <td className="py-3 px-3.5 text-center">
                      <button
                        onClick={() => {
                          const next = item.estado_nc === 'Conciliado' ? 'Pendiente' : 'Conciliado';
                          onUpdateStatusNC(item.id, next as EstadoNC);
                        }}
                        className="inline-flex items-center gap-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 transition-all cursor-pointer"
                        title="Marcar como conciliado en CD"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{item.estado_nc === 'Conciliado' ? 'Reabrir' : 'Conciliar CD'}</span>
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
