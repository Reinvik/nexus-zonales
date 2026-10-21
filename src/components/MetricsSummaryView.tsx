import React, { useMemo } from 'react';
import { 
  BarChart3, 
  ArrowRightLeft, 
  Building2, 
  TrendingDown, 
  TrendingUp, 
  Sparkles,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { Desviacion } from '../types';
import { CIAL_ZONALES } from '../data/zonales';

interface MetricsSummaryViewProps {
  items: Desviacion[];
}

export const MetricsSummaryView: React.FC<MetricsSummaryViewProps> = ({ items }) => {
  // Resumen por Zonal
  const zonalBreakdown = useMemo(() => {
    return CIAL_ZONALES.map(z => {
      const zonalItems = items.filter(i => i.zonal.toLowerCase() === z.zonal.toLowerCase());
      const faltantes = zonalItems.filter(i => i.tipo === 'faltante');
      const sobrantes = zonalItems.filter(i => i.tipo === 'sobrante');
      const dano = zonalItems.filter(i => i.tipo === 'dano_mecanico');
      const cambiados = zonalItems.filter(i => i.tipo === 'producto_cambiado');

      const faltantesKg = faltantes.reduce((sum, i) => sum + i.kilos, 0);
      const sobrantesKg = sobrantes.reduce((sum, i) => sum + i.kilos, 0);
      const balanceKg = sobrantesKg - faltantesKg;

      return {
        ...z,
        totalItems: zonalItems.length,
        faltantesCount: faltantes.length,
        faltantesKg,
        sobrantesCount: sobrantes.length,
        sobrantesKg,
        balanceKg,
        danoCount: dano.length,
        cambiadosCount: cambiados.length
      };
    }).sort((a, b) => b.totalItems - a.totalItems);
  }, [items]);

  // Detección automática de cruces / descalces entre zonales (mismo SKU en misma semana)
  const potentialCrosses = useMemo(() => {
    const crosses: {
      sku: string;
      descripcion: string;
      semana: string;
      zonalFaltante: string;
      cantFaltante: number;
      zonalSobrante: string;
      cantSobrante: number;
    }[] = [];

    const faltantes = items.filter(i => i.tipo === 'faltante');
    const sobrantes = items.filter(i => i.tipo === 'sobrante');

    faltantes.forEach(f => {
      // Buscar si otra zonal tuvo sobrante del mismo SKU en la misma semana
      const match = sobrantes.find(s => 
        s.sku === f.sku && 
        s.zonal !== f.zonal && 
        (s.semana === f.semana || s.fecha === f.fecha)
      );

      if (match) {
        // Evitar duplicados en el reporte
        const exists = crosses.some(c => 
          c.sku === f.sku && 
          c.zonalFaltante === f.zonal && 
          c.zonalSobrante === match.zonal
        );

        if (!exists) {
          crosses.push({
            sku: f.sku,
            descripcion: f.descripcion,
            semana: f.semana || 'Semana Actual',
            zonalFaltante: f.zonal,
            cantFaltante: f.cantidad,
            zonalSobrante: match.zonal,
            cantSobrante: match.cantidad
          });
        }
      }
    });

    return crosses;
  }, [items]);

  return (
    <div className="space-y-6">

      {/* 1. Alertas de Cruce Inteligente entre Zonales */}
      {potentialCrosses.length > 0 && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-blue-900">
                Posibles Cruces de Camión Detectados ({potentialCrosses.length})
              </h4>
              <p className="text-xs text-blue-700">
                El sistema detectó productos con faltante en una sucursal y sobrante en otra durante la misma semana.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {potentialCrosses.slice(0, 4).map((c, idx) => (
              <div key={idx} className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                      SKU {c.sku}
                    </span>
                    <span className="font-bold text-slate-800 truncate max-w-[200px]" title={c.descripcion}>
                      {c.descripcion}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                    <span className="text-rose-600 font-bold">−{c.cantFaltante} en {c.zonalFaltante}</span>
                    <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                    <span className="text-[#008744] font-bold">+{c.cantSobrante} en {c.zonalSobrante}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold">
                  {c.semana}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Cuadratura y Balance por Zonal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#008744]" />
              Balance de Cuadratura por Zonal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativa entre mercadería faltante y sobrante en cada centro zonal de CIAL.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/90 text-slate-600 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Zonal / Almacén</th>
                <th className="p-3 text-center">Faltantes</th>
                <th className="p-3 text-right">Kilos Faltantes</th>
                <th className="p-3 text-center">Sobrantes</th>
                <th className="p-3 text-right">Kilos Sobrantes</th>
                <th className="p-3 text-right">Balance Neto (kg)</th>
                <th className="p-3 text-center">Daño Mec.</th>
                <th className="p-3 text-center">Prod. Camb.</th>
                <th className="p-3 text-center">Total Casos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {zonalBreakdown.map(z => (
                <tr key={z.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-bold text-slate-800">
                    <div>{z.zonal}</div>
                    <div className="text-[10px] text-slate-400 font-mono font-normal">Alm: {z.almacen}</div>
                  </td>

                  <td className="p-3 text-center font-bold text-rose-600">
                    {z.faltantesCount > 0 ? z.faltantesCount : '—'}
                  </td>

                  <td className="p-3 text-right font-mono text-rose-700 font-semibold">
                    {z.faltantesKg > 0 ? `${z.faltantesKg.toFixed(1)} kg` : '—'}
                  </td>

                  <td className="p-3 text-center font-bold text-[#008744]">
                    {z.sobrantesCount > 0 ? z.sobrantesCount : '—'}
                  </td>

                  <td className="p-3 text-right font-mono text-[#008744] font-semibold">
                    {z.sobrantesKg > 0 ? `${z.sobrantesKg.toFixed(1)} kg` : '—'}
                  </td>

                  <td className="p-3 text-right font-mono font-black">
                    {z.balanceKg !== 0 ? (
                      <span className={z.balanceKg > 0 ? 'text-[#008744]' : 'text-rose-600'}>
                        {z.balanceKg > 0 ? `+${z.balanceKg.toFixed(1)}` : z.balanceKg.toFixed(1)} kg
                      </span>
                    ) : '0.0 kg'}
                  </td>

                  <td className="p-3 text-center text-amber-700 font-medium">
                    {z.danoCount > 0 ? z.danoCount : '—'}
                  </td>

                  <td className="p-3 text-center text-blue-700 font-medium">
                    {z.cambiadosCount > 0 ? z.cambiadosCount : '—'}
                  </td>

                  <td className="p-3 text-center font-extrabold text-slate-900">
                    {z.totalItems}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
