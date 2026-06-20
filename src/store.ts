import type { Bed, BedStatus, EgresoTipo, EgresoPase, Asignacion, BloqueoData, Observacion } from './types';
import { SERVICIOS } from './constants';

const BEDS_KEY = 'altas_beds_v4';
const ROLE_KEY = 'altas_role_v1';

// ── Migration helpers ────────────────────────────────────────────────

function migrateChecklistToPase(egreso: Record<string, unknown>): EgresoPase {
  // v4 format: already has pase field
  if (typeof egreso.pase === 'string') {
    const p = egreso.pase as string;
    // 'entregado' was briefly a pase value, map it back to declarado
    if (p === 'entregado') return 'declarado';
    return p as EgresoPase;
  }

  // v3 format: checklist boolean bag
  const c = egreso.checklist as Record<string, boolean> | undefined;

  // v2 format: step string
  if (!c && typeof egreso.step === 'string') {
    const step = egreso.step as string;
    if (step === 'paciente_acostado' || step === 'paciente_en_cama') return 'paciente_en_cama';
    if (step === 'cama_lista' || step === 'cama_entregada') return 'cama_lista';
    if (step === 'en_aseo' || step === 'cama_aseo' || step === 'aseo_solicitado') return 'en_aseo';
    if (step === 'cama_liberada') return 'cama_liberada';
    return 'declarado';
  }

  // v1 format: milestones object
  if (!c) {
    const m = egreso.milestones as Record<string, boolean> | undefined;
    if (!m) return 'declarado';
    if (m.paciente_en_cama || m.paciente_recibido) return 'paciente_en_cama';
    if (m.cama_entregada) return 'cama_lista';
    if (m.cama_aseo || m.aseo_solicitado) return 'en_aseo';
    if (m.cama_liberada) return 'cama_liberada';
    return 'declarado';
  }

  // v3 checklist
  if (c.paciente_acostado)             return 'paciente_en_cama';
  if (c.cama_lista)                    return 'cama_lista';
  if (c.en_aseo || c.aseo_solicitado) return 'en_aseo';
  if (c.cama_liberada)                 return 'cama_liberada';
  return 'declarado';
}

function migrateBed(raw: Record<string, unknown>): Bed {
  const status = (raw.status as BedStatus) ?? 'ocupada';
  const egreso = raw.egreso as Record<string, unknown> | undefined;

  const asignacion: Asignacion | undefined =
    (raw.asignacion as Asignacion | undefined) ??
    (egreso?.asignacion as Asignacion | undefined);

  const bed: Bed = { id: raw.id as string, status };

  if (raw.genero === 'M' || raw.genero === 'F') bed.genero = raw.genero;
  if (asignacion) bed.asignacion = asignacion;
  if (raw.bloqueo) bed.bloqueo = raw.bloqueo as BloqueoData;
  if (Array.isArray(raw.observaciones)) bed.observaciones = raw.observaciones as Observacion[];

  if (egreso) {
    const pase = migrateChecklistToPase(egreso);
    const casoEntregado =
      (egreso.caso_entregado as boolean | undefined) ??
      (egreso.paciente_entregado as boolean | undefined) ??
      undefined;
    bed.egreso = {
      tipo:                  ((egreso.tipo as string) ?? 'alta') as EgresoTipo,
      pase,
      hora_pase:             (egreso.hora_pase as string) ?? (egreso.hora_declaracion as string) ?? new Date().toISOString(),
      hora_probable:         (egreso.hora_probable as string) ?? '',
      necesita_ambulancia:   (egreso.necesita_ambulancia as boolean) ?? false,
      hora_declaracion:      (egreso.hora_declaracion as string) ?? new Date().toISOString(),
      caso_entregado:        casoEntregado || undefined,
      traslado_destino_servicio: egreso.traslado_destino_servicio as string | undefined,
      traslado_destino_cama:     egreso.traslado_destino_cama as string | undefined,
    };
  }

  return bed;
}

// ── Public API ───────────────────────────────────────────────────────

export function initBeds(): Bed[] {
  return SERVICIOS.flatMap(s => s.beds.map(id => ({ id, status: 'ocupada' as const })));
}

const VALID_IDS = new Set(SERVICIOS.flatMap(s => s.beds));

export function loadBeds(): Bed[] {
  try {
    const raw = localStorage.getItem(BEDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>[];
      if (parsed.length > 0 && !VALID_IDS.has(parsed[0].id as string)) return initBeds();
      return parsed.map(migrateBed);
    }
  } catch { /* ignore */ }
  return initBeds();
}

export function saveBeds(beds: Bed[]): void {
  try { localStorage.setItem(BEDS_KEY, JSON.stringify(beds)); } catch { /* ignore */ }
}

export function loadRole(): string | null { return localStorage.getItem(ROLE_KEY); }
export function saveRole(role: string): void { localStorage.setItem(ROLE_KEY, role); }
