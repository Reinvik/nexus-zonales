import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { QuickEntryForm } from './components/QuickEntryForm';
import { ConsolidatedView } from './components/ConsolidatedView';
import { MasterProductsView } from './components/MasterProductsView';
import { MetricsSummaryView } from './components/MetricsSummaryView';
import { CiclicoView } from './components/CiclicoView';
import { UserManagementView } from './components/UserManagementView';
import { LoginModal } from './components/LoginModal';
import { CiclicoItem, Desviacion, EstadoNC, Product, StagedItem, SyncMeta, UsuarioCuenta } from './types';
import { 
  InventarioCiclicoAuditoria, 
  CiclicoMetadata, 
  CiclicoTotales, 
  InventarioItemConsolidado 
} from './types/ciclico';
import { supabase } from './lib/supabase';
import { getISOWeekNumber, getTodayChile } from './utils/date';
import initialProductsData from './data/products.json';
import initialCiclicoData from './data/ciclico.json';
import { CIAL_ZONALES } from './data/zonales';
import { DEFAULT_USERS } from './data/defaultUsers';

export default function App() {
  // 1. Usuarios y Control de Acceso por Zonal
  const [users, setUsers] = useState<UsuarioCuenta[]>(() => {
    const cached = localStorage.getItem('nexus_zonales_users_cache');
    return cached ? JSON.parse(cached) : DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UsuarioCuenta>(() => {
    const cachedUser = localStorage.getItem('nexus_zonales_current_user');
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch {
        return DEFAULT_USERS[0];
      }
    }
    return DEFAULT_USERS[0]; // Ariel Mella (SGSJ Santiago) por defecto
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // 2. Navegación por pestañas
  const [activeTab, setActiveTab] = useState<'entry' | 'consolidated' | 'ciclico' | 'users' | 'master' | 'metrics'>(() => {
    return currentUser.rol === 'admin_santiago' ? 'ciclico' : 'entry';
  });

  // Zonal activa en el formulario
  const [selectedZonal, setSelectedZonal] = useState<string>(() => {
    return currentUser.zonal_nombre || 'Santiago (CD Frío)';
  });

  // Catálogo de Productos
  const [products, setProducts] = useState<Product[]>(initialProductsData as Product[]);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);

  // Inventario Cíclico (SDIF / 999)
  const [ciclicoItems, setCiclicoItems] = useState<CiclicoItem[]>(() => {
    const cached = localStorage.getItem('nexus_zonales_ciclico_cache');
    return cached ? JSON.parse(cached) : (initialCiclicoData as CiclicoItem[]);
  });

  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(() => {
    const cached = localStorage.getItem('nexus_zonales_sync_meta_cache');
    return cached ? JSON.parse(cached) : {
      modulo: 'ciclico',
      ultima_actualizacion: '2026-10-20T19:30:00.000Z',
      total_registros: (initialCiclicoData as CiclicoItem[]).length,
      actualizado_por: 'Ariel Mella (SGSJ)'
    };
  });

  const [isSyncingCiclico, setIsSyncingCiclico] = useState(false);

  // Historial Diario de Cíclicos Persistidos (Sincronizado entre todos los PCs)
  const [ciclicoHistorial, setCiclicoHistorial] = useState<InventarioCiclicoAuditoria[]>(() => {
    const cached = localStorage.getItem('nexus_zonales_ciclico_historial_cache');
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoadingCiclicoHistorial, setIsLoadingCiclicoHistorial] = useState(false);

  // Registro de Desviaciones
  const [deviations, setDeviations] = useState<Desviacion[]>([]);
  const [isLoadingDeviations, setIsLoadingDeviations] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincronizar Zonal al cambiar usuario
  useEffect(() => {
    if (currentUser.rol === 'operador_zonal') {
      setSelectedZonal(currentUser.zonal_nombre);
      // Permitir entry, consolidated, ciclico, master a zonales
      if (!['entry', 'consolidated', 'ciclico', 'master'].includes(activeTab)) {
        setActiveTab('entry');
      }
    }
  }, [currentUser, activeTab]);

  // Cambiar Zonal (solo admin puede cambiar libremente)
  const handleZonalChange = (zonalName: string) => {
    if (currentUser.rol === 'admin_santiago') {
      setSelectedZonal(zonalName);
      localStorage.setItem('nexus_zonales_default_zonal', zonalName);
    }
  };

  // Cargar Cuentas de Usuario desde Supabase
  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('zonales_usuarios')
        .select('*')
        .order('nombre');

      if (!error && data && data.length > 0) {
        setUsers(data as UsuarioCuenta[]);
        localStorage.setItem('nexus_zonales_users_cache', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Usando lista de usuarios local:', err);
    }
  }, []);

  // Cargar Desviaciones desde Supabase
  const fetchDeviations = useCallback(async () => {
    setIsLoadingDeviations(true);
    try {
      const { data, error } = await supabase
        .from('zonales_desviaciones')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) {
        console.warn('Error fetching from Supabase, usando respaldo local:', error);
        const cached = localStorage.getItem('nexus_zonales_local_deviations');
        if (cached) setDeviations(JSON.parse(cached));
      } else if (data) {
        setDeviations(data as Desviacion[]);
        localStorage.setItem('nexus_zonales_local_deviations', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Network error fetching deviations:', err);
    } finally {
      setIsLoadingDeviations(false);
    }
  }, []);

  // Cargar Maestro de Productos actualizado
  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('zonales_maestro_productos')
        .select('*');

      if (!error && data && data.length > 0) {
        setProducts(data as Product[]);
      }
    } catch (err) {
      console.warn('Network error fetching products from Supabase:', err);
    }
  }, []);

  // Cargar Inventario Cíclico desde Supabase
  const fetchCiclico = useCallback(async () => {
    try {
      const { data: metaData } = await supabase
        .from('zonales_sync_meta')
        .select('*')
        .eq('modulo', 'ciclico')
        .maybeSingle();

      if (metaData) {
        setSyncMeta(metaData as SyncMeta);
        localStorage.setItem('nexus_zonales_sync_meta_cache', JSON.stringify(metaData));
      }

      // Paginar: Supabase limita a 1000 filas por consulta
      const pageSize = 1000;
      const data: any[] = [];
      let error: any = null;
      for (let from = 0; ; from += pageSize) {
        const { data: page, error: pageError } = await supabase
          .from('zonales_inventario_ciclico')
          .select('*')
          .order('id')
          .range(from, from + pageSize - 1);
        if (pageError) { error = pageError; break; }
        if (!page || page.length === 0) break;
        data.push(...page);
        if (page.length < pageSize) break;
      }

      if (!error && data.length > 0) {
        setCiclicoItems(data as CiclicoItem[]);
        localStorage.setItem('nexus_zonales_ciclico_cache', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Network error fetching ciclico from Supabase:', err);
    }
  }, []);

  // Cargar Historial Diario de Cíclicos Persistidos
  const fetchCiclicoHistorial = useCallback(async () => {
    setIsLoadingCiclicoHistorial(true);
    try {
      const { data, error } = await supabase
        .from('zonales_inventario_ciclico_historial')
        .select('*')
        .order('fecha', { ascending: false });

      if (!error && data) {
        setCiclicoHistorial(data as InventarioCiclicoAuditoria[]);
        localStorage.setItem('nexus_zonales_ciclico_historial_cache', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Network error fetching ciclico historial from Supabase:', err);
    } finally {
      setIsLoadingCiclicoHistorial(false);
    }
  }, []);

  // Guardar Cíclico Oficial del Día en la Nube
  const handleSaveCiclicoDelDia = async (payload: {
    fecha: string;
    rawText: string;
    metadata: CiclicoMetadata;
    totales: CiclicoTotales;
    itemsConsolidados: InventarioItemConsolidado[];
  }): Promise<boolean> => {
    try {
      const record = {
        fecha: payload.fecha,
        hora: payload.metadata.hora_reporte || new Date().toLocaleTimeString('es-CL'),
        usuario: currentUser.username || payload.metadata.usuario || 'AMELLA',
        almacen: payload.metadata.almacen || 'NCD',
        tipo_almacen: payload.metadata.tip_alm || 'PCG',
        total_lineas: payload.itemsConsolidados.length,
        total_sistema: payload.totales.total_sistema,
        total_contado: payload.totales.total_contado,
        diferencia_neta: payload.totales.diferencia_neta,
        dif_precio_total: payload.totales.dif_precio_total,
        items_con_diferencia: payload.totales.total_faltantes + payload.totales.total_sobrantes,
        sobrantes_conciliados_999: payload.totales.sobrantes_conciliados_999,
        sobrantes_conciliados_sdif: payload.totales.sobrantes_conciliados_sdif,
        raw_ciclico: payload.rawText,
        resumen_json: {
          total_skus: payload.totales.total_skus,
          total_faltantes_sku: payload.totales.total_faltantes,
          total_sobrantes_sku: payload.totales.total_sobrantes,
          total_descuadre_lotes: payload.totales.total_descuadre_lotes,
          total_cuadrados: payload.totales.total_cuadrados,
          monto_negativo: payload.totales.monto_negativo,
          monto_positivo: payload.totales.monto_positivo,
          monto_total_bruto: payload.totales.monto_total_bruto,
          monto_total_conciliado: payload.totales.monto_total_conciliado,
          monto_final_descuadre: payload.totales.monto_final_descuadre,
          guardado_por: currentUser.nombre,
          fecha_guardado: new Date().toISOString()
        },
        detalles_json: payload.itemsConsolidados.map(item => ({
          sku: item.sku,
          descripcion: item.descripcion,
          cant_sistema: item.cant_sistema,
          cant_contada: item.cant_contada,
          diferencia: item.diferencia,
          dif_precio: item.dif_precio,
          estado: item.estado,
          lotes: item.lotes_desglose
        }))
      };

      const { error } = await supabase
        .from('zonales_inventario_ciclico_historial')
        .upsert([record], { onConflict: 'fecha' });

      if (error) {
        console.error('Error guardando ciclico del dia en Supabase:', error);
        return false;
      }

      await fetchCiclicoHistorial();
      return true;
    } catch (err) {
      console.error('Error general guardando ciclico del dia:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDeviations();
    fetchProducts();
    fetchCiclico();
    fetchCiclicoHistorial();

    // Suscripción Realtime para reflejar cambios automáticamente entre múltiples computadores
    const channel = supabase
      .channel('zonales_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zonales_inventario_ciclico_historial' }, () => {
        fetchCiclicoHistorial();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zonales_inventario_ciclico' }, () => {
        fetchCiclico();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zonales_desviaciones' }, () => {
        fetchDeviations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers, fetchDeviations, fetchProducts, fetchCiclico, fetchCiclicoHistorial]);

  // Cambiar Cuenta Activa
  const handleSelectUser = (user: UsuarioCuenta) => {
    setCurrentUser(user);
    localStorage.setItem('nexus_zonales_current_user', JSON.stringify(user));
    setSelectedZonal(user.zonal_nombre);

    // Si es zonal, restringir pestañas prohibidas
    if (user.rol === 'operador_zonal') {
      setActiveTab('entry');
    }
  };

  // Guardar / Actualizar Usuario
  const handleSaveUser = async (userPayload: UsuarioCuenta): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('zonales_usuarios')
        .upsert([{
          id: userPayload.id.startsWith('user-') ? undefined : userPayload.id,
          username: userPayload.username,
          nombre: userPayload.nombre,
          email: userPayload.email,
          zonal_code: userPayload.zonal_code,
          zonal_nombre: userPayload.zonal_nombre,
          rol: userPayload.rol,
          pin: userPayload.pin,
          activo: true
        }], { onConflict: 'username' });

      if (error) {
        console.warn('Error guardando en Supabase, guardando localmente:', error);
      }

      setUsers(prev => {
        const idx = prev.findIndex(u => u.username === userPayload.username || u.id === userPayload.id);
        let updated: UsuarioCuenta[];
        if (idx >= 0) {
          updated = [...prev];
          updated[idx] = userPayload;
        } else {
          updated = [...prev, userPayload];
        }
        localStorage.setItem('nexus_zonales_users_cache', JSON.stringify(updated));
        return updated;
      });

      // Si el usuario editado es el actual, actualizarlo
      if (currentUser.username === userPayload.username || currentUser.id === userPayload.id) {
        setCurrentUser(userPayload);
        localStorage.setItem('nexus_zonales_current_user', JSON.stringify(userPayload));
      }

      return true;
    } catch (err) {
      console.error('Error guardando usuario:', err);
      return false;
    }
  };

  // Eliminar Usuario
  const handleDeleteUser = async (userId: string): Promise<boolean> => {
    try {
      await supabase
        .from('zonales_usuarios')
        .delete()
        .eq('id', userId);

      setUsers(prev => {
        const updated = prev.filter(u => u.id !== userId);
        localStorage.setItem('nexus_zonales_users_cache', JSON.stringify(updated));
        return updated;
      });
      return true;
    } catch (err) {
      console.error('Error eliminando usuario:', err);
      return false;
    }
  };

  // Manejo de envío de ítems desde el formulario rápido
  const handleSubmitItems = async (stagedItems: StagedItem[]): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      // Usar siempre la zonal fija del operador si es zonal
      const effectiveZonal = currentUser.rol === 'operador_zonal' 
        ? currentUser.zonal_nombre 
        : selectedZonal;

      const zonalObj = CIAL_ZONALES.find(z => z.zonal === effectiveZonal) || CIAL_ZONALES[0];
      const today = getTodayChile();

      const newRecords = stagedItems.map(item => ({
        tipo: item.tipo,
        fecha: item.fecha_dig || today,
        fecha_dig: item.fecha_dig || today,
        fecha_llegada_camion: item.fecha_llegada_camion || null,
        hora_llegada_camion: item.hora_llegada_camion || null,
        pallets_recibidos: item.pallets_recibidos ?? null,
        bandejas_recibidas: item.bandejas_recibidas ?? null,
        semana: getISOWeekNumber(item.fecha_dig || today),
        zonal: zonalObj.zonal,
        almacen: zonalObj.almacen,
        sku: item.sku,
        descripcion: item.descripcion,
        umv: item.umv,
        cantidad: item.cantidad,
        kilos: item.kilos,
        lote: item.lote,
        sector: item.sector,
        pasillo: item.pasillo,
        cod_cliente: item.cod_cliente,
        nombre_cliente: item.nombre_cliente,
        num_factura: item.num_factura,
        folio_ref: item.folio_ref,
        transporte: item.transporte,
        estado_nc: 'Pendiente' as EstadoNC,
        anotaciones: item.anotaciones,
        fotos: item.fotos || [],
        producto_cambiado_sku: item.producto_cambiado_sku,
        producto_cambiado_desc: item.producto_cambiado_desc,
        creado_por: currentUser.username
      }));

      // Inserción en Supabase
      const { data, error } = await supabase
        .from('zonales_desviaciones')
        .insert(newRecords)
        .select();

      if (error) {
        console.warn('Error insertando en Supabase, guardando en local:', error);
        const localCreated: Desviacion[] = newRecords.map((r, i) => ({
          ...r,
          id: `local-${Date.now()}-${i}`,
          created_at: new Date().toISOString()
        })) as Desviacion[];

        const updated = [...localCreated, ...deviations];
        setDeviations(updated);
        localStorage.setItem('nexus_zonales_local_deviations', JSON.stringify(updated));
      } else if (data) {
        setDeviations(prev => [...(data as Desviacion[]), ...prev]);
      }

      return true;
    } catch (err) {
      console.error('Error general enviando reporte:', err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actualizar Estado de Nota de Crédito
  const handleUpdateStatusNC = async (id: string, newStatus: EstadoNC) => {
    setDeviations(prev => prev.map(item => item.id === id ? { ...item, estado_nc: newStatus } : item));
    try {
      await supabase
        .from('zonales_desviaciones')
        .update({ estado_nc: newStatus })
        .eq('id', id);
    } catch (err) {
      console.error('Error actualizando estado NC:', err);
    }
  };

  // Eliminar un registro
  const handleDeleteItem = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
    setDeviations(prev => prev.filter(i => i.id !== id));
    try {
      await supabase
        .from('zonales_desviaciones')
        .delete()
        .eq('id', id);
    } catch (err) {
      console.error('Error eliminando desviación:', err);
    }
  };

  // Sincronizar Catálogo desde Copiar y Pegar
  const handleSyncProducts = async (newProducts: Product[]): Promise<boolean> => {
    setIsSyncingProducts(true);
    try {
      const map = new Map<string, Product>();
      products.forEach(p => map.set(p.sku, p));
      newProducts.forEach(p => map.set(p.sku, p));
      const combined = Array.from(map.values());
      setProducts(combined);

      const batchSize = 100;
      for (let i = 0; i < newProducts.length; i += batchSize) {
        const batch = newProducts.slice(i, i + batchSize).map(p => ({
          sku: p.sku,
          descripcion: p.descripcion,
          estado: p.estado || 'Activo',
          bruto: p.bruto || 0,
          neto: p.neto || 0,
          unidad: p.unidad || 'UN',
          um_venta: p.um_venta || p.unidad || 'UN',
          tipo_peso: p.tipo_peso || 'Peso Standard',
          categoria: p.categoria || 'GENERAL',
          updated_at: new Date().toISOString()
        }));

        await supabase
          .from('zonales_maestro_productos')
          .upsert(batch, { onConflict: 'sku' });
      }

      return true;
    } catch (err) {
      console.error('Error sincronizando catálogo:', err);
      return false;
    } finally {
      setIsSyncingProducts(false);
    }
  };

  // Sincronizar Inventario Cíclico (Pegar desde SAP MB52)
  const handleSyncCiclico = async (newItems: CiclicoItem[]): Promise<boolean> => {
    setIsSyncingCiclico(true);
    try {
      const map = new Map<string, CiclicoItem>();
      ciclicoItems.forEach(item => {
        const key = `${item.material}_${item.almacen}_${item.lote || ''}`;
        map.set(key, item);
      });
      newItems.forEach(item => {
        const key = `${item.material}_${item.almacen}_${item.lote || ''}`;
        map.set(key, item);
      });
      const combined = Array.from(map.values());
      setCiclicoItems(combined);
      localStorage.setItem('nexus_zonales_ciclico_cache', JSON.stringify(combined));

      const nowIso = new Date().toISOString();
      const updatedMeta: SyncMeta = {
        modulo: 'ciclico',
        ultima_actualizacion: nowIso,
        total_registros: combined.length,
        actualizado_por: currentUser.nombre
      };
      setSyncMeta(updatedMeta);
      localStorage.setItem('nexus_zonales_sync_meta_cache', JSON.stringify(updatedMeta));

      // Guardar meta en Supabase
      await supabase
        .from('zonales_sync_meta')
        .upsert([updatedMeta], { onConflict: 'modulo' });

      // Guardar batch en Supabase en bloques de 100
      // Reemplazar snapshot de los almacenes cargados para evitar duplicados
      const almacenes = Array.from(new Set(newItems.map(i => i.almacen)));
      const { error: delError } = await supabase
        .from('zonales_inventario_ciclico')
        .delete()
        .in('almacen', almacenes);
      if (delError) throw delError;

      const batchSize = 100;
      for (let i = 0; i < newItems.length; i += batchSize) {
        const batch = newItems.slice(i, i + batchSize).map(item => ({
          material: item.material,
          texto_breve: item.texto_breve,
          almacen: item.almacen,
          lote: item.lote,
          zonal: item.zonal,
          cantidad: item.cantidad,
          umb: item.umb,
          valor_total: item.valor_total,
          en_calidad: item.en_calidad || 0,
          estado: item.estado || 'Pendiente'
        }));

        const { error: insError } = await supabase
          .from('zonales_inventario_ciclico')
          .insert(batch);
        if (insError) throw insError;
      }

      return true;
    } catch (err) {
      console.error('Error sincronizando inventario cíclico:', err);
      return false;
    } finally {
      setIsSyncingCiclico(false);
    }
  };

  // Filtrado de desviaciones según la cuenta activa
  const visibleDeviations = useMemo(() => {
    if (currentUser.rol === 'operador_zonal') {
      return deviations.filter(d => d.zonal.toLowerCase() === currentUser.zonal_nombre.toLowerCase());
    }
    return deviations;
  }, [deviations, currentUser]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col font-sans select-none antialiased">
      
      {/* Header Corporativo CIAL con Control de Cuentas */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedZonal={selectedZonal}
        totalRecordsCount={visibleDeviations.length}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onRefreshData={fetchDeviations}
        isRefreshing={isLoadingDeviations}
      />

      {/* Cuerpo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        
        {/* 1. Ingreso de Desviaciones */}
        {activeTab === 'entry' && (
          <QuickEntryForm
            products={products}
            selectedZonal={selectedZonal}
            onZonalChange={handleZonalChange}
            onSubmitItems={handleSubmitItems}
            isSubmitting={isSubmitting}
            currentUser={currentUser}
          />
        )}

        {/* 2. Consolidado (General o de Sucursal) */}
        {activeTab === 'consolidated' && (
          <ConsolidatedView
            items={visibleDeviations}
            onUpdateStatusNC={handleUpdateStatusNC}
            onDeleteItem={handleDeleteItem}
            currentUser={currentUser}
          />
        )}

        {/* 3. Inventario Cíclico CD & Zonales (SDIF / 999) */}
        {activeTab === 'ciclico' && (
          <CiclicoView
            items={ciclicoItems}
            syncMeta={syncMeta}
            onSyncCiclico={handleSyncCiclico}
            isSyncing={isSyncingCiclico}
            currentUser={currentUser}
            products={products}
            ciclicoHistorial={ciclicoHistorial}
            isLoadingHistorial={isLoadingCiclicoHistorial}
            onSaveCiclicoDelDia={handleSaveCiclicoDelDia}
            onRefreshCiclicoHistorial={fetchCiclicoHistorial}
          />
        )}

        {/* 5. Gestión de Cuentas & Asignar Zonales (Exclusivo SGSJ Santiago) */}
        {activeTab === 'users' && currentUser.rol === 'admin_santiago' && (
          <UserManagementView
            users={users}
            currentUser={currentUser}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
            onSwitchUser={handleSelectUser}
            onRefreshUsers={fetchUsers}
          />
        )}

        {/* 6. Maestro de Productos */}
        {activeTab === 'master' && (
          <MasterProductsView
            products={products}
            onSyncProducts={handleSyncProducts}
            isSyncing={isSyncingProducts}
          />
        )}

        {/* 7. Cuadratura y Resumen (Exclusivo SGSJ Santiago) */}
        {activeTab === 'metrics' && currentUser.rol === 'admin_santiago' && (
          <MetricsSummaryView
            items={deviations}
          />
        )}
      </main>

      {/* Modal de Inicio de Sesión / Cambio de Cuenta */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
      />

      {/* Footer CIAL */}
      <footer className="bg-slate-200/60 border-t border-slate-300/80 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 CIAL Alimentos S.A. — CD Frío Outbound / Inbound</span>
          <span className="font-mono text-[11px] text-slate-400">
            Sesión: <strong>{currentUser.nombre}</strong> ({currentUser.zonal_code}) • {currentUser.rol === 'admin_santiago' ? 'Admin SGSJ' : 'Operador Zonal'}
          </span>
        </div>
      </footer>
    </div>
  );
}
