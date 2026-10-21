import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  Layers, 
  FileSpreadsheet, 
  Boxes, 
  BarChart3, 
  PlusCircle, 
  CheckCircle2, 
  RefreshCw, 
  Building2, 
  ClipboardCheck,
  ArrowRightLeft,
  Users,
  Lock,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import cialLogo from '../assets/cial-alimentos-logo.png';
import { getChileTimeString } from '../utils/date';
import { UsuarioCuenta } from '../types';

interface HeaderProps {
  activeTab: 'entry' | 'consolidated' | 'ciclico' | 'users' | 'master' | 'metrics';
  setActiveTab: (tab: 'entry' | 'consolidated' | 'ciclico' | 'users' | 'master' | 'metrics') => void;
  selectedZonal: string;
  totalRecordsCount: number;
  currentUser: UsuarioCuenta;
  onOpenLoginModal: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedZonal,
  totalRecordsCount,
  currentUser,
  onOpenLoginModal,
  onRefreshData,
  isRefreshing
}) => {
  const [chileTime, setChileTime] = useState<string>('');
  const isAdmin = currentUser.rol === 'admin_santiago';

  useEffect(() => {
    const update = () => setChileTime(getChileTimeString());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#008744] text-white shadow-md border-b-2 border-[#005a2e] sticky top-0 z-40 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo y Título CIAL */}
          <div className="flex items-center gap-3.5">
            <div className="bg-white p-1 rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <img 
                src={cialLogo} 
                alt="CiAL Alimentos" 
                className="w-11 h-11 object-contain" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-wider leading-none">
                  NEXUS ZONALES
                </h1>
                <span className="text-[10px] bg-emerald-800 text-emerald-100 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-700/60">
                  CIAL Alimentos
                </span>
              </div>
              <span className="text-[11px] text-emerald-100 font-medium tracking-wide block mt-0.5">
                Control de Desviaciones, Faltantes y Sobrantes en Sucursales
              </span>
            </div>
          </div>

          {/* Selector de Usuario Activo, Zonal y Reloj */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            
            {/* Botón de Cuenta de Usuario Activo */}
            <button
              onClick={onOpenLoginModal}
              className="flex items-center gap-2.5 bg-emerald-900/80 hover:bg-emerald-950 border border-emerald-500/70 px-3 py-1.5 rounded-xl text-emerald-100 transition-all cursor-pointer shadow-xs text-left"
              title="Haz clic para cambiar de cuenta o sucursal"
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                isAdmin ? 'bg-amber-400 text-amber-950' : 'bg-indigo-300 text-indigo-950'
              }`}>
                {currentUser.zonal_code.slice(0, 2)}
              </div>

              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-white text-xs">{currentUser.nombre}</span>
                  {isAdmin ? (
                    <span className="text-[9px] bg-emerald-800 text-emerald-200 px-1 py-0.2 rounded font-black border border-emerald-600/60">
                      SGSJ
                    </span>
                  ) : (
                    <span className="text-[9px] bg-indigo-900 text-indigo-200 px-1 py-0.2 rounded font-black border border-indigo-700/60 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      {currentUser.zonal_code}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-emerald-300 block font-medium">
                  {isAdmin ? 'Acceso Global Santiago' : `Zonal: ${currentUser.zonal_nombre}`} • Cambiar
                </span>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-emerald-400 opacity-70 ml-0.5" />
            </button>

            {/* Reloj Santiago */}
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-900/50 border border-emerald-700/50 px-2.5 py-1.5 rounded-lg text-emerald-100 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>{chileTime || 'Santiago, CL'}</span>
            </div>

            {/* Estado En Línea */}
            <div className="flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-700/60 px-2.5 py-1.5 rounded-lg text-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="font-medium text-[11px]">En Línea</span>
            </div>

            {onRefreshData && (
              <button
                onClick={onRefreshData}
                disabled={isRefreshing}
                className="p-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 rounded-lg border border-emerald-600/50 transition-all cursor-pointer disabled:opacity-50"
                title="Actualizar datos desde la nube"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Barra de Módulos / Tabs con Control de Acceso Estricto */}
        <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-emerald-600/50 overflow-x-auto no-scrollbar">
          
          {/* 1. Ingreso de Desviaciones (Disponible para todos) */}
          <button
            onClick={() => setActiveTab('entry')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'entry'
                ? 'bg-white text-[#008744] shadow-sm font-extrabold'
                : 'text-emerald-100 hover:bg-emerald-800/60'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Ingreso de Desviaciones</span>
          </button>

          {/* 2. Consolidado (Para SGSJ: General; Para Zonal: Solo su sucursal) */}
          <button
            onClick={() => setActiveTab('consolidated')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'consolidated'
                ? 'bg-white text-[#008744] shadow-sm font-extrabold'
                : 'text-emerald-100 hover:bg-emerald-800/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Consolidado General' : `Consolidado (${currentUser.zonal_nombre})`}</span>
            {totalRecordsCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'consolidated' ? 'bg-emerald-100 text-[#008744]' : 'bg-emerald-800 text-emerald-200'
              }`}>
                {totalRecordsCount}
              </span>
            )}
          </button>

          {/* 3. Inventario Cíclico & 999 / SDIF */}
          <button
            onClick={() => setActiveTab('ciclico')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'ciclico'
                ? 'bg-white text-[#008744] shadow-sm font-extrabold'
                : 'text-emerald-100 hover:bg-emerald-800/60'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>Inventario Cíclico</span>
            <span className="text-[9px] bg-amber-400 text-slate-900 font-black px-1.5 py-0.2 rounded-full uppercase">
              SDIF / 999
            </span>
          </button>

          {/* 5. Gestión de Cuentas & Zonales (EXCLUSIVO SGSJ Santiago) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'users'
                  ? 'bg-white text-[#008744] shadow-sm font-extrabold'
                  : 'text-emerald-100 hover:bg-emerald-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              <span>Asignar Cuentas</span>
            </button>
          )}

          {/* 6. Maestro de Productos (Disponible para todos para consulta) */}
          <button
            onClick={() => setActiveTab('master')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'master'
                ? 'bg-white text-[#008744] shadow-sm font-extrabold'
                : 'text-emerald-100 hover:bg-emerald-800/60'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Maestro de Productos</span>
          </button>

          {/* 7. Cuadratura y Resumen (EXCLUSIVO SGSJ Santiago) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'metrics'
                  ? 'bg-white text-[#008744] shadow-sm font-extrabold'
                  : 'text-emerald-100 hover:bg-emerald-800/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Cuadratura y Cruces</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
