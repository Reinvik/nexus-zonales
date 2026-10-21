# Nexus Zonales — CIAL Alimentos

Aplicación web operacional del ecosistema **Nexus** para el registro, control y consolidación en tiempo real de faltantes, sobrantes, daño mecánico y productos cambiados en las 20 sucursales zonales de **CIAL Alimentos** (de Arica a Punta Arenas).

Reemplaza el flujo manual de correos en Excel y consolidación por bot de Outlook, eliminando:
* Errores de tipeo de códigos SKU (catálogo en vivo con autocompletado predictivo).
* Errores de formato de fecha o años desactualizados (selector nativo Santiago, CL).
* Omisión de la sucursal / zonal en los reportes (almacenes y lotes prefijados automáticamente).
* Bloqueos de archivos por concurrencia en Excel.

---

## 🚀 Características Principales

1. **Ingreso Rápido de Desviaciones (Zonales):**
   - Selector intuitivo de sucursal (guarda la preferencia en el dispositivo).
   - Clasificación visual por tipo: `🔴 Faltante`, `🟢 Sobrante`, `🟡 Daño Mecánico`, `🔵 Prod. Cambiado`, `🟠 Transporte`.
   - Búsqueda instantánea en catálogo de 1.888 productos por SKU o nombre.
   - Cálculo automático sugerido de Kilos según peso unitario del maestro (editable para peso variable).
   - Cola de sesión de descarga para revisar múltiples ítems antes de enviar al CD.

2. **Consolidado General en Vivo (CD Frío / Control de Existencias):**
   - Visualización de todas las sucursales sin depender de recepción de correos.
   - Filtros por Zonal, Tipo, Rango de Fecha y Estado de Nota de Crédito.
   - Gestión de estado NC (`Pendiente`, `NC Solicitada`, `NC lista`, `Conciliado`).
   - Botón de **Exportación a Excel** con la estructura exacta requerida por la macro de Desviaciones Zonales.

3. **Maestro de Productos y Actualizador "Copiar y Pegar":**
   - Catálogo completo pre-cargado con 1.888 productos.
   - Modal para actualizar copiando filas desde Excel (`Ctrl + C`) y pegándolas directamente en la app (`Ctrl + V`).
   - Soporte para arrastrar archivos `.xlsx`.
   - Previsualización en vivo antes de sincronizar a la base de datos Supabase.

4. **Cuadratura y Cruces Semanales:**
   - Tabla comparativa de balance neto por sucursal.
   - Algoritmo de detección de posibles cruces de camión (mismo SKU con faltante en Zonal A y sobrante en Zonal B en la misma semana).

---

## 🛠️ Tecnologías

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4.
* **Componentes & Iconos:** Lucide React, Canvas Confetti.
* **Procesamiento Excel:** SheetJS (`xlsx`).
* **Backend & Base de Datos:** Supabase PostgreSQL con RLS y persistencia local (offline resilience).

---

## 💻 Ejecución Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en puerto 3016
npm run dev

# Compilar para producción
npm run build
```
