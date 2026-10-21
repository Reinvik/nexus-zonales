import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Building2, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { UsuarioCuenta, RolUsuario } from '../types';
import { CIAL_ZONALES } from '../data/zonales';

interface UserManagementViewProps {
  users: UsuarioCuenta[];
  currentUser: UsuarioCuenta;
  onSaveUser: (user: UsuarioCuenta) => Promise<boolean>;
  onDeleteUser: (userId: string) => Promise<boolean>;
  onSwitchUser: (user: UsuarioCuenta) => void;
  onRefreshUsers: () => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
  onSwitchUser,
  onRefreshUsers
}) => {
  // Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioCuenta | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [zonalCode, setZonalCode] = useState('VMSJ');
  const [rol, setRol] = useState<RolUsuario>('operador_zonal');
  const [pin, setPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Abrir modal para crear
  const handleOpenCreate = () => {
    setEditingUser(null);
    setUsername('');
    setNombre('');
    setEmail('');
    setZonalCode('VMSJ');
    setRol('operador_zonal');
    setPin('1234');
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (user: UsuarioCuenta) => {
    setEditingUser(user);
    setUsername(user.username);
    setNombre(user.nombre);
    setEmail(user.email || '');
    setZonalCode(user.zonal_code);
    setRol(user.rol);
    setPin(user.pin || '1234');
    setIsModalOpen(true);
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !nombre.trim()) {
      alert('Por favor completa el nombre y nombre de usuario.');
      return;
    }

    const zonalObj = CIAL_ZONALES.find(z => z.code === zonalCode) || CIAL_ZONALES[0];

    const userPayload: UsuarioCuenta = {
      id: editingUser ? editingUser.id : `user-${Date.now()}`,
      username: username.trim().toLowerCase(),
      nombre: nombre.trim(),
      email: email.trim() || undefined,
      zonal_code: zonalObj.code,
      zonal_nombre: zonalObj.zonal,
      rol,
      pin: pin.trim() || '1234',
      activo: true,
      updated_at: new Date().toISOString()
    };

    setIsSubmitting(true);
    const success = await onSaveUser(userPayload);
    setIsSubmitting(false);

    if (success) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header del Módulo */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-emerald-100 text-[#008744] rounded-2xl shadow-xs">
              <Users className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Gestión de Cuentas & Asignación de Zonales
                </h2>
                <span className="bg-emerald-100 text-[#008744] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300 uppercase">
                  Admin SGSJ
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Crea cuentas y asigna sucursales estrictas. Cada zonal solo podrá ver e ingresar información de su propio almacén.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshUsers}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-300"
              title="Refrescar usuarios"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-[#008744] hover:bg-[#006e37] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Nueva Cuenta</span>
            </button>
          </div>
        </div>

        {/* Resumen de Accesos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Cuentas</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{users.length}</span>
            <span className="text-[10px] text-slate-400">Usuarios registrados</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Operadores Zonales</span>
            <span className="text-xl font-black text-indigo-600 mt-0.5 block">
              {users.filter(u => u.rol === 'operador_zonal').length}
            </span>
            <span className="text-[10px] text-slate-400">Acceso restringido a su zonal</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Administradores Centrales</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">
              {users.filter(u => u.rol === 'admin_santiago').length}
            </span>
            <span className="text-[10px] text-slate-400">Acceso CD Santiago y global</span>
          </div>
        </div>
      </div>

      {/* Tabla de Cuentas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Nombre Completo</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">Zonal Asignada (Estricta)</th>
                <th className="py-3 px-4 text-center">Rol de Acceso</th>
                <th className="py-3 px-4 text-center">PIN</th>
                <th className="py-3 px-4 text-center">Simular / Probar</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => {
                const isCurrent = user.id === currentUser.id;
                const isAdmin = user.rol === 'admin_santiago';

                return (
                  <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${isCurrent ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                    
                    {/* Username */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      @{user.username}
                      {isCurrent && (
                        <span className="ml-2 text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-full uppercase">
                          Tú
                        </span>
                      )}
                    </td>

                    {/* Nombre */}
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {user.nombre}
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {user.email || '—'}
                    </td>

                    {/* Zonal Asignada */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        isAdmin 
                          ? 'bg-emerald-50 text-[#008744] border-emerald-300' 
                          : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{user.zonal_code} — {user.zonal_nombre}</span>
                      </span>
                    </td>

                    {/* Rol */}
                    <td className="py-3 px-4 text-center">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-emerald-300">
                          <ShieldCheck className="w-3 h-3 text-emerald-700" />
                          Admin SGSJ (Global)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-300">
                          <Lock className="w-3 h-3 text-slate-500" />
                          Operador Zonal
                        </span>
                      )}
                    </td>

                    {/* PIN */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                      ••••
                    </td>

                    {/* Simular / Cambiar */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSwitchUser(user)}
                        disabled={isCurrent}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                        title={`Simular sesión como ${user.nombre}`}
                      >
                        {isCurrent ? 'Sesión Actual' : 'Entrar como...'}
                      </button>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                          title="Editar cuenta y zonal"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {user.username !== 'amella' && (
                          <button
                            onClick={() => {
                              if (confirm(`¿Seguro que deseas eliminar la cuenta de ${user.nombre}?`)) {
                                onDeleteUser(user.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                            title="Eliminar cuenta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Cuenta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-100 text-[#008744] rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingUser ? 'Editar Cuenta & Reasignar Zonal' : 'Crear Nueva Cuenta Zonal'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Define la sucursal a la que tendrá acceso este usuario.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre Completo / Sucursal
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Operaciones Viña del Mar"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008744]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Usuario (Login)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="vina"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().trim())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008744]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    PIN de Acceso
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="1234"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-[#008744]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email Institucional (Opcional)
                </label>
                <input
                  type="email"
                  placeholder="usuario@cialalimentos.cl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008744]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Zonal Asignada (Acceso Exclusivo)
                </label>
                <select
                  value={zonalCode}
                  onChange={e => setZonalCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008744]"
                >
                  {CIAL_ZONALES.map(z => (
                    <option key={z.code} value={z.code}>
                      {z.code} — {z.zonal}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  El usuario solo podrá ver e ingresar información de esta sucursal.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rol de Permisos
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    rol === 'operador_zonal' 
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="rol"
                      value="operador_zonal"
                      checked={rol === 'operador_zonal'}
                      onChange={() => setRol('operador_zonal')}
                      className="hidden"
                    />
                    <Lock className="w-3.5 h-3.5" />
                    <span>Operador Zonal</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    rol === 'admin_santiago' 
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="rol"
                      value="admin_santiago"
                      checked={rol === 'admin_santiago'}
                      onChange={() => setRol('admin_santiago')}
                      className="hidden"
                    />
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Admin SGSJ</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#008744] hover:bg-[#006e37] text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Crear Cuenta')}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
