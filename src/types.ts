export type Role = 'clinico' | 'ugp';
export type BedStatus = 'libre' | 'ocupada' | 'egreso' | 'bloqueada';
export type EgresoTipo = 'alta' | 'traslado';

export type EgresoPase =
  | 'declarado'       // médico declaró, paciente aún en cama
  | 'cama_liberada'   // paciente se fue físicamente
  | 'en_aseo'         // aseo en progreso
  | 'cama_lista'      // cama limpia, esperando paciente nuevo
  | 'paciente_en_cama'; // nuevo paciente acostado

export const PASE_ORDER: EgresoPase[] = [
  'declarado', 'cama_liberada', 'en_aseo', 'cama_lista', 'paciente_en_cama',
];

export const PASE_LABELS: Record<EgresoPase, string> = {
  declarado:        'Movimiento declarado',
  cama_liberada:    'Cama liberada',
  en_aseo:          'En aseo',
  cama_lista:       'Cama disponible',
  paciente_en_cama: 'Paciente acostado',
};

export type OrigenPaciente =
  | 'urgencia'
  | 'recuperacion'
  | 'tabla'
  | 'cdt'
  | 'rescate_externo'
  | 'traslado_interno';

export interface EgresoStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export function getEgresoStyle(egreso: EgresoData): EgresoStyle {
  const t = egreso.tipo === 'traslado';
  switch (egreso.pase) {
    case 'declarado':
      return   { bg: 'bg-red-500',     text: 'text-white', border: 'border-red-400',     dot: 'bg-red-500' };
    case 'cama_liberada':
      return   { bg: 'bg-orange-400',  text: 'text-white', border: 'border-orange-300',  dot: 'bg-orange-400' };
    case 'en_aseo':
      return   { bg: 'bg-amber-400',  text: 'text-white', border: 'border-amber-300',  dot: 'bg-amber-400' };
    case 'cama_lista':
      return   { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-400', dot: 'bg-emerald-500' };
    case 'paciente_en_cama':
      return   { bg: 'bg-slate-600',   text: 'text-white', border: 'border-slate-500',   dot: 'bg-slate-600' };
  }
}

export interface Asignacion {
  origen: OrigenPaciente;
  hora_asignacion: string;
  nota?: string;
}

export interface BloqueoData {
  motivo: string;
  hora_bloqueo: string;
}

export interface EgresoData {
  tipo: EgresoTipo;
  pase: EgresoPase;
  hora_pase: string;
  hora_probable: string;
  necesita_ambulancia: boolean;
  hora_declaracion: string;
  caso_entregado?: boolean;
  traslado_destino_servicio?: string;
  traslado_destino_cama?: string;
  pase_history?: Array<{ pase: EgresoPase; hora: string }>; // ordered log of each transition
}

export interface Observacion {
  texto: string;
  hora: string;
  rol: Role;
}

export interface Bed {
  id: string;
  status: BedStatus;
  genero?: 'M' | 'F';
  egreso?: EgresoData;
  bloqueo?: BloqueoData;
  asignacion?: Asignacion;
  observaciones?: Observacion[];
}
