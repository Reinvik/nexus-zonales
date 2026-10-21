import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Search, 
  ClipboardPaste, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  X,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { Product } from '../types';
import { parsePastedMasterData } from '../utils/excel';

interface MasterProductsViewProps {
  products: Product[];
  onSyncProducts: (newProducts: Product[]) => Promise<boolean>;
  isSyncing: boolean;
}

export const MasterProductsView: React.FC<MasterProductsViewProps> = ({
  products,
  onSyncProducts,
  isSyncing
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [showModal, setShowModal] = useState(false);

  // Estados del modal de Copiar y Pegar
  const [pastedText, setPastedText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Product[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Categorías únicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtrado de la tabla principal
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = p.sku.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (selectedCategory !== 'TODAS' && p.categoria !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [products, search, selectedCategory]);

  // Manejo de pegado en el textarea
  const handleTextChange = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setParsedPreview([]);
      setParseErrors([]);
      return;
    }

    const { products: parsed, errors } = parsePastedMasterData(text);
    setParsedPreview(parsed);
    setParseErrors(errors);
  };

  // Manejo de subida de archivo Excel (.xlsx)
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a texto tabulado para reutilizar el parser
        const csvText = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
        handleTextChange(csvText);
      } catch (err) {
        setParseErrors([`Error al leer el archivo Excel: ${err}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmSync = async () => {
    if (parsedPreview.length === 0) return;
    const ok = await onSyncProducts(parsedPreview);
    if (ok) {
      confetti({
        particleCount: 70,
        spread: 50,
        origin: { y: 0.5 }
      });
      setShowModal(false);
      setPastedText('');
      setParsedPreview([]);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header del Módulo con botón para Copiar y Pegar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#008744]" />
              Maestro de Productos CIAL ({products.length} productos)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Catálogo oficial sincronizado para evitar tipeos manuales y errores en códigos SKU.
            </p>
          </div>

          <button
            onClick={() => {
              setShowModal(true);
              setPastedText('');
              setParsedPreview([]);
              setParseErrors([]);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Copiar y Pegar desde Excel</span>
          </button>
        </div>

        {/* Filtros de búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="relative sm:col-span-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código SKU o nombre de producto..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="TODAS">Todas las Categorías ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Productos del Maestro */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/90 text-slate-600 uppercase font-black text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Descripción de Material</th>
                <th className="p-3">Categoría</th>
                <th className="p-3 text-center">UMV</th>
                <th className="p-3 text-right">Peso Neto</th>
                <th className="p-3 text-right">Peso Bruto</th>
                <th className="p-3 text-center">Tipo Peso</th>
                <th className="p-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.slice(0, 100).map(p => (
                <tr key={p.sku} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-900">{p.sku}</td>
                  <td className="p-3 font-semibold text-slate-800">{p.descripcion}</td>
                  <td className="p-3 text-slate-500">{p.categoria || '—'}</td>
                  <td className="p-3 text-center font-bold">{p.um_venta || p.unidad}</td>
                  <td className="p-3 text-right font-mono font-semibold">{p.neto} kg</td>
                  <td className="p-3 text-right font-mono text-slate-500">{p.bruto} kg</td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      p.tipo_peso.includes('Variable')
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {p.tipo_peso}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      p.estado === 'Bloqueado'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-[#008744]'
                    }`}>
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProducts.length > 100 && (
          <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
            Mostrando los primeros 100 resultados de {filteredProducts.length} productos. Usa el buscador para filtrar.
          </div>
        )}
      </div>

      {/* Modal de Copiar y Pegar desde Excel */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#e6f4ea] text-[#008744] rounded-xl">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-800">
                    Actualizar Maestro: Copiar y Pegar desde Excel
                  </h4>
                  <p className="text-xs text-slate-500">
                    Copia las celdas directamente desde Excel o SAP y pégalas aquí.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Instrucción rápida */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#008744] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Instrucciones simples:</span>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    1. En Excel, selecciona las filas (con o sin cabecera) y presiona <strong>Ctrl + C</strong>.<br />
                    2. Haz clic en el recuadro abajo y presiona <strong>Ctrl + V</strong>.<br />
                    3. El sistema reconocerá automáticamente columnas como Material, Descripción, Unidad, Peso Bruto y Neto.
                  </p>
                </div>
              </div>

              {/* Área de Pegado y Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pega aquí el contenido de Excel (Ctrl + V) o arrastra un archivo .xlsx:
                </label>
                
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl transition-all ${
                    dragActive ? 'border-[#008744] bg-[#e6f4ea]/30' : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Pega las filas copiadas desde Excel aquí..."
                    className="w-full p-3 bg-transparent text-xs font-mono text-slate-800 focus:outline-none resize-none"
                  />

                  {/* Botón de subida alternativa */}
                  <div className="p-2.5 bg-slate-100/70 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">
                      ¿Prefieres subir el archivo completo?
                    </span>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 cursor-pointer transition-colors shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-[#008744]" />
                      <span>Subir archivo .xlsx</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Errores de parseo */}
              {parseErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
                  {parseErrors.map((err, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Previsualización en Vivo de lo parseado */}
              {parsedPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#008744]" />
                      {parsedPreview.length} productos detectados listos para sincronizar
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Previsualización de los primeros 5:
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-[11px] text-slate-700">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-black text-[9px]">
                        <tr>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Descripción</th>
                          <th className="p-2">UMV</th>
                          <th className="p-2 text-right">Neto (kg)</th>
                          <th className="p-2 text-right">Bruto (kg)</th>
                          <th className="p-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {parsedPreview.slice(0, 5).map(p => (
                          <tr key={p.sku} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-900">{p.sku}</td>
                            <td className="p-2 font-sans font-medium text-slate-800 truncate max-w-xs">{p.descripcion}</td>
                            <td className="p-2">{p.um_venta || p.unidad}</td>
                            <td className="p-2 text-right">{p.neto}</td>
                            <td className="p-2 text-right">{p.bruto}</td>
                            <td className="p-2 font-sans">{p.estado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Footer con Acciones */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmSync}
                disabled={parsedPreview.length === 0 || isSyncing}
                className="inline-flex items-center gap-2 px-6 py-2 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sincronizando Catálogo...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar y Sincronizar ({parsedPreview.length} Productos)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
