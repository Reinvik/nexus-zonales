import { ZonalInfo } from '../types';

export const CIAL_ZONALES: ZonalInfo[] = [
  { code: 'SGSJ', zonal: 'Santiago (CD Frío)', almacen: 'SGSJ', sectorPrefix: 'SG' },
  { code: 'ARSJ', zonal: 'Arica', almacen: 'ARSJ', sectorPrefix: 'AR' },
  { code: 'IQSJ', zonal: 'Iquique', almacen: 'IQSJ', sectorPrefix: 'IQ' },
  { code: 'CLSJ', zonal: 'Calama', almacen: 'CLSJ', sectorPrefix: 'CL' },
  { code: 'ANSJ', zonal: 'Antofagasta', almacen: 'ANSJ', sectorPrefix: 'AN' },
  { code: 'CPSJ', zonal: 'Copiapó', almacen: 'CPSJ', sectorPrefix: 'CP' },
  { code: 'LSSJ', zonal: 'La Serena', almacen: 'LSSJ', sectorPrefix: 'LS' },
  { code: 'FLSJ', zonal: 'San Felipe', almacen: 'FLSJ', sectorPrefix: 'FL' },
  { code: 'VMSJ', zonal: 'Viña del Mar', almacen: 'VMSJ', sectorPrefix: 'VM' },
  { code: 'SASJ', zonal: 'San Antonio', almacen: 'SASJ', sectorPrefix: 'SA' },
  { code: 'RGSJ', zonal: 'Rancagua', almacen: 'RGSJ', sectorPrefix: 'RG' },
  { code: 'SFSJ', zonal: 'San Fernando', almacen: 'SFSJ', sectorPrefix: 'SF' },
  { code: 'TLSJ', zonal: 'Talca', almacen: 'TLSJ', sectorPrefix: 'TL' },
  { code: 'CHSJ', zonal: 'Chillán', almacen: 'CHSJ', sectorPrefix: 'CH' },
  { code: 'CNSJ', zonal: 'Concepción', almacen: 'CNSJ', sectorPrefix: 'CN' },
  { code: 'LASJ', zonal: 'Los Ángeles', almacen: 'LASJ', sectorPrefix: 'LA' },
  { code: 'TMSJ', zonal: 'Temuco', almacen: 'TMSJ', sectorPrefix: 'TM' },
  { code: 'OSSJ', zonal: 'Osorno', almacen: 'OSSJ', sectorPrefix: 'OS' },
  { code: 'PMSJ', zonal: 'Puerto Montt', almacen: 'PMSJ', sectorPrefix: 'PM' },
  { code: 'CYSJ', zonal: 'Coyhaique', almacen: 'CYSJ', sectorPrefix: 'CY' },
  { code: 'PASJ', zonal: 'Punta Arenas', almacen: 'PASJ', sectorPrefix: 'PA' },
];

export const getZonalByCode = (code: string): ZonalInfo | undefined => {
  return CIAL_ZONALES.find(z => z.code.toUpperCase() === code.toUpperCase() || z.almacen.toUpperCase() === code.toUpperCase());
};

export const getZonalByName = (name: string): ZonalInfo | undefined => {
  const norm = name.trim().toLowerCase();
  return CIAL_ZONALES.find(z => z.zonal.toLowerCase() === norm);
};
