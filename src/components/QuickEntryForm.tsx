import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Minus, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Send, 
  Calendar,
  Clock,
  Layers,
  Truck,
  FileText,
  User,
  Lock,
  Unlock,
  ChevronDown,
  Sparkles,
  Camera,
  Upload,
  X,
  Image as ImageIcon,
  Package,
  Boxes
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DesviacionTipo, Product, StagedItem, UsuarioCuenta, ZonalInfo } from '../types';
import { CIAL_ZONALES } from '../data/zonales';
import { getTodayChile, getISOWeekNumber, getChileTimeString, getZonalLote } from '../utils/date';
import { searchClients, getClientNameByCode, searchTransports } from '../data/clients';
import { getProductPackagingInfo } from '../utils/productUtils';

interface QuickEntryFormProps {
  products: Product[];
  selectedZonal: string;
  onZonalChange: (zonalName: string) => void;
  onSubmitItems: (items: StagedItem[]) => Promise<boolean>;
  isSubmitting: boolean;
  currentUser?: UsuarioCuenta;
}

export const QuickEntryForm: React.FC<QuickEntryFormProps> = ({
  products,
  selectedZonal,
  onZonalChange,
  onSubmitItems,
  isSubmitting,
  currentUser
}) => {
  // Configuración de la Zonal / Cuenta activa
  const currentZonalInfo = useMemo(() => {
    return CIAL_ZONALES.find(z => z.zonal === selectedZonal) || CIAL_ZONALES[0];
  }, [selectedZonal]);

  // Estado de bloqueo de Cuenta (para que recuerde Viña, Copiapó, etc.)
  const [isAccountLocked, setIsAccountLocked] = useState<boolean>(() => {
    return localStorage.getItem('nexus_zonales_account_locked') === 'true';
  });

  // 1. Datos de Recepción del Camión (A nivel de camión para heredar automáticamente)
  const [transporteCamion, setTransporteCamion] = useState<string>('');
  const [fechaLlegadaCamion, setFechaLlegadaCamion] = useState<string>(getTodayChile());
  const [horaLlegadaCamion, setHoraLlegadaCamion] = useState<string>(() => {
    const timeStr = getChileTimeString();
    return timeStr.slice(0, 5); // HH:MM
  });
  const [folioRefCamion, setFolioRefCamion] = useState<string>('');
  const [palletsRecibidos, setPalletsRecibidos] = useState<string>('');
  const [bandejasRecibidas, setBandejasRecibidas] = useState<string>('');

  // Fotos de recepción del camión y descarga
  const [fotosCamion, setFotosCamion] = useState<string[]>([]);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sugerencias de transporte
  const [transportSuggestions, setTransportSuggestions] = useState<string[]>([]);
  const [isTransportOpen, setIsTransportOpen] = useState(false);
  const transportContainerRef = useRef<HTMLDivElement>(null);

  // 2. Tipo de Desviación
  const [tipo, setTipo] = useState<DesviacionTipo>('faltante');
  const [fechaDig, setFechaDig] = useState<string>(getTodayChile());

  // 3. Búsqueda de Producto Principal
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 4. Datos Numéricos y Trazabilidad Comercial
  const [cantidad, setCantidad] = useState<number>(1);
  const [kilos, setKilos] = useState<number>(0);
  const [lote, setLote] = useState<string>('');
  const [sector, setSector] = useState<string>('');
  const [pasillo, setPasillo] = useState<string>('');

  // Trazabilidad SAP / Cliente
  const [numFactura, setNumFactura] = useState<string>('');
  const [folioRef, setFolioRef] = useState<string>('');
  const [codCliente, setCodCliente] = useState<string>('');
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [clientSuggestions, setClientSuggestions] = useState<{ code: string; name: string }[]>([]);
  const [isClientOpen, setIsClientOpen] = useState(false);
  const clientContainerRef = useRef<HTMLDivElement>(null);

  const [anotaciones, setAnotaciones] = useState<string>('');

  // Lista de Ítems en cola de envío de esta sesión
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-fijar Lote oficial CIAL ([Almacén][DD][MM], ej: VMSJ2010) y Sector cuando cambia Zonal o Fecha de Llegada del Camión
  useEffect(() => {
    if (currentZonalInfo) {
      const autoLote = getZonalLote(currentZonalInfo.almacen, fechaLlegadaCamion);
      setLote(autoLote);
      setSector(`${currentZonalInfo.sectorPrefix}010`);
    }
  }, [currentZonalInfo, fechaLlegadaCamion]);

  // Si se ingresa Folio Ref en la cabecera del camión, heredar a la desviación si está vacía
  useEffect(() => {
    if (folioRefCamion && !folioRef) {
      setFolioRef(folioRefCamion);
    }
  }, [folioRefCamion]);

  // Auto-calcular Kilos cuando cambia producto o cantidad (considerando peso de caja si UMV es CJ)
  useEffect(() => {
    if (selectedProduct) {
      const info = getProductPackagingInfo(selectedProduct);
      const effectiveWeight = info.pesoCaja > 0 ? info.pesoCaja : (selectedProduct.bruto || selectedProduct.neto || 1);
      if (effectiveWeight > 0) {
        setKilos(Number((effectiveWeight * cantidad).toFixed(3)));
      }
    }
  }, [selectedProduct, cantidad]);

  // Auto-completar Nombre Cliente al ingresar Cod. Cliente
  const handleCodClienteChange = (codeVal: string) => {
    setCodCliente(codeVal);
    const matchedName = getClientNameByCode(codeVal);
    if (matchedName) {
      setNombreCliente(matchedName);
    }
    // Sugerencias
    if (codeVal.trim().length >= 2) {
      const results = searchClients(codeVal);
      setClientSuggestions(results);
      setIsClientOpen(results.length > 0);
    } else {
      setIsClientOpen(false);
    }
  };

  const handleNombreClienteChange = (nameVal: string) => {
    setNombreCliente(nameVal);
    if (nameVal.trim().length >= 2) {
      const results = searchClients(nameVal);
      setClientSuggestions(results);
      setIsClientOpen(results.length > 0);
    } else {
      setIsClientOpen(false);
    }
  };

  const handleSelectClient = (c: { code: string; name: string }) => {
    setCodCliente(c.code);
    setNombreCliente(c.name);
    setIsClientOpen(false);
  };

  // Manejo de Transporte y Autocompletado
  const handleTransporteChange = (val: string) => {
    setTransporteCamion(val);
    if (val.trim().length >= 1) {
      const results = searchTransports(val);
      setTransportSuggestions(results);
      setIsTransportOpen(results.length > 0);
    } else {
      setIsTransportOpen(false);
    }
  };

  // Cerrar desplegables al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (clientContainerRef.current && !clientContainerRef.current.contains(e.target as Node)) {
        setIsClientOpen(false);
      }
      if (transportContainerRef.current && !transportContainerRef.current.contains(e.target as Node)) {
        setIsTransportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return products
      .filter(p => p.sku.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q))
      .slice(0, 10);
  }, [products, searchQuery]);

  // Comprimir imagen a tamaño y calidad web óptimos
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1200;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Carga de Fotos del Transporte y Descarga
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImage(files[i]);
        newPhotos.push(compressed);
      } catch (err) {
        console.error('Error procesando imagen:', err);
      }
    }

    if (newPhotos.length > 0) {
      setFotosCamion(prev => [...prev, ...newPhotos]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFotosCamion(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setSearchQuery(`${prod.sku} — ${prod.descripcion}`);
    setIsSearchOpen(false);
    setFormError(null);
  };

  // Bloquear / Desbloquear cuenta
  const toggleAccountLock = () => {
    const nextState = !isAccountLocked;
    setIsAccountLocked(nextState);
    localStorage.setItem('nexus_zonales_account_locked', String(nextState));
  };

  // Agregar ítem al lote de sesión
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProduct) {
      setFormError('Debes seleccionar un producto válido del maestro.');
      return;
    }

    if (cantidad <= 0) {
      setFormError('La cantidad debe ser mayor a 0.');
      return;
    }

    const isFaltante = tipo === 'faltante';
    const effectiveFolio = isFaltante 
      ? (folioRef.trim() || folioRefCamion.trim()) 
      : folioRef.trim();

    const newItem: StagedItem = {
      tempId: Math.random().toString(36).substring(2, 9),
      tipo,
      sku: selectedProduct.sku,
      descripcion: selectedProduct.descripcion,
      umv: selectedProduct.um_venta || selectedProduct.unidad || 'UN',
      cantidad: Number(cantidad),
      kilos: Number(kilos) || 0,
      tipo_peso: selectedProduct.tipo_peso,
      lote: lote.trim() || getZonalLote(currentZonalInfo.almacen, fechaLlegadaCamion),
      pasillo: pasillo.trim(),
      sector: sector.trim() || `${currentZonalInfo.sectorPrefix}010`,
      cod_cliente: isFaltante ? codCliente.trim() : '',
      nombre_cliente: isFaltante ? nombreCliente.trim() : '',
      num_factura: isFaltante ? numFactura.trim() : '',
      folio_ref: effectiveFolio,
      transporte: transporteCamion.trim(),
      fecha_llegada_camion: fechaLlegadaCamion,
      hora_llegada_camion: horaLlegadaCamion,
      pallets_recibidos: palletsRecibidos !== '' ? Number(palletsRecibidos) : undefined,
      bandejas_recibidas: bandejasRecibidas !== '' ? Number(bandejasRecibidas) : undefined,
      fotos: fotosCamion,
      fecha_dig: fechaDig,
      anotaciones: anotaciones.trim()
    };

    setStagedItems(prev => [newItem, ...prev]);

    // Limpiar campos específicos de este ítem
    setSelectedProduct(null);
    setSearchQuery('');
    setCantidad(1);
    setKilos(0);
    setNumFactura('');
    setCodCliente('');
    setNombreCliente('');
    setAnotaciones('');
  };

  const handleRemoveStagedItem = (tempId: string) => {
    setStagedItems(prev => prev.filter(i => i.tempId !== tempId));
  };

  const handleSubmitBatch = async () => {
    if (stagedItems.length === 0) return;
    const ok = await onSubmitItems(stagedItems);
    if (ok) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
      setStagedItems([]);
      setFotosCamion([]);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Módulo de Automatización: Cuenta Zonal Bloqueada */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#e6f4ea] text-[#008744] rounded-xl border border-[#a3cfb6]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-800">
                  Mi Sucursal Zonal: <span className="text-[#008744] font-black">{currentZonalInfo.zonal}</span>
                </h2>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-mono font-bold px-2 py-0.5 rounded border border-slate-300">
                  Alm: {currentZonalInfo.almacen}
                </span>
                {isAccountLocked && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                    <Lock className="w-3 h-3" /> Fija / Automática
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAccountLocked 
                  ? 'Zonal y Almacén bloqueados automáticamente. Todos los reportes se registrarán para tu sucursal.'
                  : 'Selecciona tu sucursal una sola vez. La aplicación recordará tu cuenta automáticamente.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAccountLocked ? (
              <div className="relative min-w-[200px]">
                <select
                  value={selectedZonal}
                  onChange={(e) => onZonalChange(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#008744] cursor-pointer appearance-none"
                >
                  {CIAL_ZONALES.map(z => (
                    <option key={z.code} value={z.zonal}>
                      {z.zonal} ({z.almacen})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : null}

            <button
              type="button"
              onClick={toggleAccountLock}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isAccountLocked 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-[#e6f4ea] hover:bg-[#d4edd9] text-[#008744] border-[#a3cfb6]'
              }`}
              title={isAccountLocked ? 'Desbloquear para cambiar sucursal' : 'Fijar esta sucursal como mi cuenta'}
            >
              {isAccountLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Cambiar</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Fijar como Mi Cuenta</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Cabecera de Recepción del Camión (Automatización a nivel de Camión / Descarga) */}
      <div className="bg-gradient-to-r from-emerald-50/80 to-slate-50 border border-emerald-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-emerald-200/70 pb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#008744]" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">
                Datos de Recepción del Camión
              </h3>
              <span className="text-[11px] text-slate-500">
                Se ingresan una sola vez por camión y se heredan automáticamente en todos los ítems de esta descarga.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-lg">
            <span>Fecha Dig-: {fechaDig}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {/* Transporte con Autocompletado */}
          <div className="relative" ref={transportContainerRef}>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Transporte</span>
              <span className="text-[10px] text-emerald-700 font-semibold">Empresa / Patente</span>
            </label>
            <input
              type="text"
              value={transporteCamion}
              onChange={(e) => handleTransporteChange(e.target.value)}
              onFocus={() => {
                if (transporteCamion.length >= 1) setIsTransportOpen(true);
              }}
              placeholder="Ej: BALTAZAR, MATURANA, 3156476..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />

            {/* Dropdown de transportes frecuentes */}
            {isTransportOpen && transportSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-50 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {transportSuggestions.map((t, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setTransporteCamion(t);
                      setIsTransportOpen(false);
                    }}
                    className="p-2 text-xs font-bold text-slate-700 hover:bg-[#e6f4ea] cursor-pointer"
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fecha Llegada Camión */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Fecha Llegada Camión</span>
            </label>
            <input
              type="date"
              value={fechaLlegadaCamion}
              onChange={(e) => setFechaLlegadaCamion(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>

          {/* Hora Llegada Camión con botón "Ahora" */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Hora Llegada</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const hh = String(now.getHours()).padStart(2, '0');
                  const mm = String(now.getMinutes()).padStart(2, '0');
                  setHoraLlegadaCamion(`${hh}:${mm}`);
                }}
                className="text-[10px] text-emerald-700 font-extrabold hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200 px-1.5 py-0.2 rounded cursor-pointer transition-all"
                title="Fijar la hora actual exacta de llegada"
              >
                ⏰ Ahora
              </button>
            </div>
            <input
              type="time"
              value={horaLlegadaCamion}
              onChange={(e) => setHoraLlegadaCamion(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>

          {/* Folio Ref / Guía Camión (opcional común) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Folio Ref. General / Guía
            </label>
            <input
              type="text"
              value={folioRefCamion}
              onChange={(e) => setFolioRefCamion(e.target.value)}
              placeholder="Ej: 46600526"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>

          {/* Cantidad de Pallets Recibidos */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-emerald-700" />
                <span>Pallets Recibidos</span>
              </span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-1 rounded">Cant.</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={palletsRecibidos}
              onChange={(e) => setPalletsRecibidos(e.target.value)}
              placeholder="Ej: 26"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>

          {/* Bandejas Recibidas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-emerald-700" />
                <span>Bandejas Recibidas</span>
              </span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-1 rounded">Cant.</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={bandejasRecibidas}
              onChange={(e) => setBandejasRecibidas(e.target.value)}
              placeholder="Ej: 480"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>
        </div>

        {/* 📸 Fotos del Transporte & Descarga */}
        <div className="mt-3 pt-3 border-t border-emerald-200/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-extrabold text-slate-800">
                Fotos de Recepción del Camión (Sellos, Termógrafo, Estado de Carga)
              </span>
              {fotosCamion.length > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {fotosCamion.length} {fotosCamion.length === 1 ? 'foto' : 'fotos'}
                </span>
              )}
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="foto-camion-input"
              />
              <label
                htmlFor="foto-camion-input"
                className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ Subir / Tomar Fotos</span>
              </label>
            </div>
          </div>

          {/* Miniaturas de fotos */}
          {fotosCamion.length > 0 ? (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {fotosCamion.map((foto, idx) => (
                <div 
                  key={idx} 
                  className="relative group rounded-xl overflow-hidden border border-slate-300 w-20 h-20 bg-slate-100 shadow-xs"
                >
                  <img 
                    src={foto} 
                    alt={`Foto transporte ${idx + 1}`} 
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedPreviewImage(foto)}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-xs cursor-pointer hover:bg-rose-700 transition-all"
                    title="Eliminar foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-white text-[9px] text-center font-bold py-0.2">
                    Foto {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300/80 rounded-xl p-3 text-center bg-emerald-50/40 hover:bg-emerald-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-900 font-semibold">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Haz clic aquí o en "+ Subir / Tomar Fotos" para adjuntar evidencia fotográfica del camión.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Selector de Tipo de Desviación: Faltantes y Sobrantes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5">
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
          Tipo de Desviación a Registrar
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Faltante */}
          <button
            type="button"
            onClick={() => setTipo('faltante')}
            className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              tipo === 'faltante'
                ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm ring-2 ring-rose-400/30 font-extrabold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-xl mb-1">🔴</span>
            <span className="text-sm font-extrabold">Faltante</span>
            <span className="text-[10px] text-slate-400 font-normal">Falta producto en el camión al descargar</span>
          </button>

          {/* Sobrante */}
          <button
            type="button"
            onClick={() => setTipo('sobrante')}
            className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              tipo === 'sobrante'
                ? 'bg-emerald-50 border-[#008744] text-[#008744] shadow-sm ring-2 ring-emerald-400/30 font-extrabold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-xl mb-1">🟢</span>
            <span className="text-sm font-extrabold">Sobrante</span>
            <span className="text-[10px] text-slate-400 font-normal">Sobra producto físico en descarga</span>
          </button>

          {/* Daño Mecánico */}
          <button
            type="button"
            onClick={() => setTipo('dano_mecanico')}
            className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              tipo === 'dano_mecanico'
                ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm ring-2 ring-amber-400/30 font-extrabold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-xl mb-1">🟡</span>
            <span className="text-sm font-extrabold">Daño Mecánico</span>
            <span className="text-[10px] text-slate-400 font-normal">Caja golpeada o averiada en viaje</span>
          </button>
        </div>
      </div>

      {/* 4. Formulario de Detalle del Ítem */}
      <form onSubmit={handleAddItem} className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 space-y-4">
        
        {/* Encabezado del Formulario con Zonal Automática */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800 uppercase tracking-wide">
              {tipo === 'faltante' ? '🔴 Detalle del Faltante' : `Registro de ${tipo}`}
            </span>
            <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
              {currentZonalInfo.zonal} ({currentZonalInfo.almacen})
            </span>
          </div>
          <span className="text-slate-400 font-mono">
            Semana: {getISOWeekNumber(fechaDig)}
          </span>
        </div>

        {/* Buscador de Producto Principal */}
        <div className="relative" ref={searchContainerRef}>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            SKU / Producto Oficial (Buscar por Código o Nombre)
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
                if (selectedProduct && !e.target.value.includes(selectedProduct.sku)) {
                  setSelectedProduct(null);
                }
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Escribe ej: 6770, 3071, 3854, QUESO GAUDA, ARROLLADO..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#008744] focus:border-[#008744]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Menú flotante de resultados predictivos */}
          {isSearchOpen && filteredProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto z-50 divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <div
                  key={p.sku}
                  onClick={() => handleSelectProduct(p)}
                  className="p-3 hover:bg-[#e6f4ea] transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                        SKU {p.sku}
                      </span>
                      <span className="font-bold text-xs text-slate-800">{p.descripcion}</span>
                    </div>
                    {(() => {
                      const info = getProductPackagingInfo(p);
                      return (
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                          <span>UMV: <strong className="text-slate-700">{info.um}</strong></span>
                          {info.esCaja && (
                            <span className="bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                              {info.unidadesPorCajaText} / CJ
                            </span>
                          )}
                          <span>Peso: <strong>{info.pesoCaja} kg{info.esCaja ? '/caja' : ''}</strong></span>
                          <span className="text-slate-400">({p.tipo_peso})</span>
                        </div>
                      );
                    })()}
                  </div>
                  {p.estado === 'Bloqueado' && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                      Bloqueado
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fila 1: Cantidad, UMV, Kilos, Lote, Sector */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Cantidad */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cantidad ({selectedProduct?.um_venta || selectedProduct?.unidad || 'UN'})
            </label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setCantidad(prev => Math.max(1, prev - 1))}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-l-xl border border-r-0 border-slate-300 transition-all cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min="0.1"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
                className="w-full text-center py-2 bg-slate-50 border-y border-slate-300 text-xs font-black text-slate-900 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setCantidad(prev => prev + 1)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-r-xl border border-l-0 border-slate-300 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Kilos (Auto-calculados y editables) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Kilos</span>
              {selectedProduct && (
                <span className="text-[10px] text-emerald-700 font-semibold">
                  Sugerido ({getProductPackagingInfo(selectedProduct).pesoCaja} kg/{(selectedProduct.um_venta || selectedProduct.unidad || 'UN')})
                </span>
              )}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={kilos}
              onChange={(e) => setKilos(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#008744]"
              placeholder="0.00"
            />
          </div>

          {/* Lote (Formato Oficial CIAL: Almacén + DD + MM) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Lote</span>
              <span className="text-[10px] text-emerald-700 font-mono font-bold" title="Formato oficial: Almacén + Día + Mes">
                {currentZonalInfo.almacen}DDMM
              </span>
            </label>
            <input
              type="text"
              value={lote}
              onChange={(e) => setLote(e.target.value.toUpperCase())}
              placeholder={`Ej: ${getZonalLote(currentZonalInfo.almacen, fechaLlegadaCamion)}`}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>

          {/* Sector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sector
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value.toUpperCase())}
              placeholder={`Ej: ${currentZonalInfo.sectorPrefix}015`}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>

          {/* Pasillo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pasillo / Ubicación
            </label>
            <input
              type="text"
              value={pasillo}
              onChange={(e) => setPasillo(e.target.value)}
              placeholder="Ej: 0142901"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#008744]"
            />
          </div>
        </div>

        {/* Fila 2: Trazabilidad Comercial & Facturación SAP (Exclusivo para Faltantes para emisión de Nota de Crédito) */}
        {tipo === 'faltante' && (
          <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-rose-600" />
                Trazabilidad Comercial SAP (Exclusivo Faltantes para Nota de Crédito)
              </span>
              <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded border border-rose-200">
                Requerido para emitir NC en SAP
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* N° Fact. SAP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  N° Fact. SAP
                </label>
                <input
                  type="text"
                  value={numFactura}
                  onChange={(e) => setNumFactura(e.target.value.trim())}
                  placeholder="Ej: 197349126"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Folio Ref. */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Folio Ref.</span>
                  {folioRefCamion && (
                    <button
                      type="button"
                      onClick={() => setFolioRef(folioRefCamion)}
                      className="text-[10px] text-rose-700 font-bold hover:underline"
                    >
                      Copiar de Camión
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  value={folioRef}
                  onChange={(e) => setFolioRef(e.target.value.trim())}
                  placeholder="Ej: 46600526"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Cod. Cliente con Autocompletado */}
              <div className="relative" ref={clientContainerRef}>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cod. Cliente
                </label>
                <input
                  type="text"
                  value={codCliente}
                  onChange={(e) => handleCodClienteChange(e.target.value)}
                  placeholder="Ej: 1200531, 1216210..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                />

                {isClientOpen && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-50 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {clientSuggestions.map((c) => (
                      <div
                        key={c.code}
                        onClick={() => handleSelectClient(c)}
                        className="p-2 text-xs hover:bg-rose-50 cursor-pointer"
                      >
                        <span className="font-mono font-bold text-slate-900">{c.code}</span>
                        <div className="text-[11px] text-slate-600 truncate">{c.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nombre Cliente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Cliente
                </label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => handleNombreClienteChange(e.target.value)}
                  placeholder="Ej: WALMART, SUPERMERCADO..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Anotaciones / Causa */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Anotaciones / Causa de la desviación
          </label>
          <input
            type="text"
            value={anotaciones}
            onChange={(e) => setAnotaciones(e.target.value)}
            placeholder="Ej: Falta en pallet precintado, caja no subió en CD..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
          />
        </div>

        {/* Error de validación */}
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Botón Agregar a la lista */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-sm font-bold shadow-sm transition-all active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar a la Lista de Envío</span>
          </button>
        </div>
      </form>

      {/* 5. Lista de Ítems en Sesión (Cola antes de enviar al CD) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#008744]" />
              Ítems en Sesión de Descarga ({stagedItems.length})
            </h3>
            <p className="text-xs text-slate-500">
              Revisa los productos ingresados en este camión antes de confirmar el envío al CD.
            </p>
          </div>

          {stagedItems.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Total Kilos</span>
                <span className="text-sm font-black text-slate-800">
                  {stagedItems.reduce((acc, curr) => acc + curr.kilos, 0).toFixed(2)} kg
                </span>
              </div>

              <button
                type="button"
                onClick={handleSubmitBatch}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-sm font-black shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando...' : `Confirmar y Enviar al CD (${stagedItems.length})`}</span>
              </button>
            </div>
          )}
        </div>

        {stagedItems.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">No hay ítems en la cola de envío</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Usa el formulario superior para agregar faltantes, sobrantes o daños de este camión.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase font-black text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Zonal / Alm</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3 text-right">Kilos</th>
                  <th className="p-3">N° Fact. SAP</th>
                  <th className="p-3">Folio Ref.</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Lote / Sector</th>
                  <th className="p-3">Transporte</th>
                  <th className="p-3">Llegada Camión</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stagedItems.map((item) => (
                  <tr key={item.tempId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold whitespace-nowrap">
                      {item.tipo === 'faltante' && <span className="text-rose-600">🔴 Faltante</span>}
                      {item.tipo === 'sobrante' && <span className="text-[#008744]">🟢 Sobrante</span>}
                      {item.tipo === 'dano_mecanico' && <span className="text-amber-600">🟡 Daño</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap font-bold text-slate-800">
                      {currentZonalInfo.zonal} <span className="font-mono text-slate-400 font-normal">({currentZonalInfo.almacen})</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{item.sku}</td>
                    <td className="p-3 max-w-[200px]">
                      <div className="font-semibold text-slate-800 truncate" title={item.descripcion}>
                        {item.descripcion}
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold whitespace-nowrap">{item.cantidad} {item.umv}</td>
                    <td className="p-3 text-right font-mono font-semibold whitespace-nowrap">{item.kilos} kg</td>
                    <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">{item.num_factura || '—'}</td>
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{item.folio_ref || '—'}</td>
                    <td className="p-3 max-w-[150px] truncate" title={item.nombre_cliente ? `${item.cod_cliente} - ${item.nombre_cliente}` : ''}>
                      {item.cod_cliente ? `${item.cod_cliente}` : '—'}
                      {item.nombre_cliente && <span className="text-[10px] text-slate-400 block truncate">{item.nombre_cliente}</span>}
                    </td>
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.lote} / {item.sector}
                    </td>
                    <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{item.transporte || '—'}</td>
                    <td className="p-3 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-800">
                        {item.fecha_llegada_camion} • {item.hora_llegada_camion}
                      </div>
                      {(item.pallets_recibidos !== undefined || item.bandejas_recibidas !== undefined) && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {item.pallets_recibidos !== undefined && <span>📦 {item.pallets_recibidos} plts</span>}
                          {item.pallets_recibidos !== undefined && item.bandejas_recibidas !== undefined && <span> • </span>}
                          {item.bandejas_recibidas !== undefined && <span>🧺 {item.bandejas_recibidas} bdjs</span>}
                        </div>
                      )}
                      {item.fotos && item.fotos.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewImage(item.fotos![0])}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                            title="Ver fotos del camión"
                          >
                            <Camera className="w-3 h-3 text-emerald-700" />
                            <span>{item.fotos.length} {item.fotos.length === 1 ? 'foto' : 'fotos'}</span>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveStagedItem(item.tempId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Quitar ítem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Lightbox de Foto en Pantalla Completa */}
      {selectedPreviewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute -top-10 right-0 text-white bg-slate-800/80 hover:bg-slate-700 p-2 rounded-full cursor-pointer transition-all"
              title="Cerrar foto"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={selectedPreviewImage} 
              alt="Vista previa de recepción de transporte" 
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-white/90 text-xs mt-3 font-semibold bg-black/60 px-3 py-1 rounded-full">
              Fotografía de Recepción del Camión — CIAL Alimentos (Haz clic afuera para cerrar)
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
