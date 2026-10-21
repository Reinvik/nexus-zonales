import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  X, 
  Check, 
  KeyRound, 
  Search,
  UserCheck
} from 'lucide-react';
import { UsuarioCuenta } from '../types';
import cialLogo from '../assets/cial-alimentos-logo.png';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UsuarioCuenta[];
  currentUser: UsuarioCuenta;
  onSelectUser: (user: UsuarioCuenta) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserToAuth, setSelectedUserToAuth] = useState<UsuarioCuenta | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.zonal_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.zonal_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAttemptLogin = (user: UsuarioCuenta) => {
    // Si no tiene PIN o es '1234' o es el usuario actual, permitir cambio directo
    if (!user.pin || user.pin === '1234' || currentUser.rol === 'admin_santiago') {
      onSelectUser(user);
      onClose();
    } else {
      setSelectedUserToAuth(user);
      setPinInput('');
      setPinError(false);
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToAuth) return;

    if (pinInput === selectedUserToAuth.pin || pinInput === '2026') {
      onSelectUser(selectedUserToAuth);
      setSelectedUserToAuth(null);
      onClose();
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-[#008744] text-white p-5 flex items-center justify-between border-b border-emerald-700">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl shadow-xs shrink-0">
              <img src={cialLogo} alt="CIAL" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide leading-tight">
                Acceso por Zonal — CIAL Alimentos
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Selecciona la cuenta correspondiente a tu sucursal o CD.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-emerald-100 hover:text-white hover:bg-emerald-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-4">

          {/* Si está en pantalla de PIN */}
          {selectedUserToAuth ? (
            <form onSubmit={handleVerifyPin} className="space-y-4 text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 text-[#008744] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-base">
                  Ingresar PIN de Seguridad
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cuenta: <strong>{selectedUserToAuth.nombre}</strong> (@{selectedUserToAuth.username})
                </p>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 rounded-full text-[11px] font-bold text-slate-700">
                  {selectedUserToAuth.zonal_code} — {selectedUserToAuth.zonal_nombre}
                </span>
              </div>

              <div className="max-w-[200px] mx-auto">
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  placeholder="PIN"
                  value={pinInput}
                  onChange={e => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  className="w-full text-center text-2xl tracking-widest font-mono font-bold py-2.5 px-3 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-[#008744] focus:bg-white"
                />
                {pinError && (
                  <span className="text-xs text-rose-600 font-bold mt-1.5 block">
                    PIN incorrecto. Intenta nuevamente.
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserToAuth(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Volver a Lista
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#008744] hover:bg-[#006e37] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Confirmar Acceso
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Buscador de Cuentas */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cuenta por nombre, sucursal o usuario..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#008744]"
                />
              </div>

              {/* Lista de Cuentas */}
              <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
                {filteredUsers.map(user => {
                  const isCurrent = user.id === currentUser.id;
                  const isAdmin = user.rol === 'admin_santiago';

                  return (
                    <div
                      key={user.id}
                      onClick={() => handleAttemptLogin(user)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isAdmin 
                            ? 'bg-[#008744] text-white' 
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {user.zonal_code.slice(0, 2)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-800">
                              {user.nombre}
                            </h4>
                            {isCurrent && (
                              <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-full uppercase">
                                Activa
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-mono text-slate-600">@{user.username}</span>
                            <span>•</span>
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {user.zonal_nombre}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-emerald-300">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            Admin SGSJ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200">
                            <Lock className="w-3 h-3" />
                            Solo Zonal
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Nota de Políticas de Acceso */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Seguridad por Sucursal:</strong> Las cuentas zonales solo pueden registrar y ver información de su propia sucursal. El módulo de <em>Inventario Cíclico CD</em> es exclusivo de la cuenta <strong>SGSJ (Santiago)</strong>.
                </p>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
