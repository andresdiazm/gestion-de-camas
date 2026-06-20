import type { OrigenPaciente } from './types';

export const SERVICIOS = [
  {
    id: 'medicina' as const,
    label: 'Medicina',
    range: '601–602',
    beds: ['601-1', '601-2', '601-3', '601-4', '601-5', '601-6', '602-1', '602-2', '602-3'],
  },
  {
    id: 'uti' as const,
    label: 'UTI',
    range: '501–503',
    beds: ['501-1', '501-2', '502-1', '502-2', '503-1', '503-2'],
  },
];

export type ServicioId = typeof SERVICIOS[number]['id'];

export function getServicioForBed(bedId: string): ServicioId {
  for (const s of SERVICIOS) {
    if (s.beds.includes(bedId)) return s.id;
  }
  return 'medicina';
}

export const ORIGENES: Array<{
  value: OrigenPaciente;
  label: string;
  short: string;
  bg: string;
  ring: string;
}> = [
  { value: 'urgencia',         label: 'Urgencia',          short: 'URG',   bg: 'bg-red-500',    ring: 'ring-red-400' },
  { value: 'recuperacion',     label: 'Recuperación',      short: 'REC',   bg: 'bg-orange-500', ring: 'ring-orange-400' },
  { value: 'tabla',            label: 'Tabla',             short: 'TABLA', bg: 'bg-blue-600',   ring: 'ring-blue-500' },
  { value: 'cdt',              label: 'CDT',               short: 'CDT',   bg: 'bg-green-600',  ring: 'ring-green-500' },
  { value: 'rescate_externo',  label: 'Rescate externo',   short: 'RESC',  bg: 'bg-purple-600', ring: 'ring-purple-500' },
  { value: 'traslado_interno', label: 'Traslado interno',  short: 'INT',   bg: 'bg-teal-600',   ring: 'ring-teal-500' },
];

export function getOrigen(value: OrigenPaciente) {
  return ORIGENES.find(o => o.value === value);
}
