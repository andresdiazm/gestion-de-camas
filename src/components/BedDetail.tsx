import { useState } from 'react';
import {
  X, Clock, Ambulance, AlertTriangle, CheckCircle2, Circle,
  ChevronRight, ArrowLeftRight, Lock, Unlock, ArrowRight,
} from 'lucide-react';
import type { Bed, Role, EgresoTipo, EgresoPase, OrigenPaciente, Observacion } from '../types';
import { PASE_ORDER, PASE_LABELS, getEgresoStyle } from '../types';
import { getOrigen, SERVICIOS, getServicioForBed } from '../constants';
import AsignacionSheet from './AsignacionSheet';

function elapsedFull(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface Props {
  bed: Bed;
  role: Role;
  simplified?: boolean; // true = Camas tab (declare only); false = Estado tab (full management)
  onClose: () => void;
  onDeclararEgreso: (
    id: string, tipo: EgresoTipo, hora: string, ambulancia: boolean,
    destinoServicio?: string, destinoCama?: string,
  ) => void;
  onAvanzarPase: (id: string, pase: EgresoPase) => void;
  onToggleCasoEntregado: (id: string) => void;
  onCancelarAlta: (id: string) => void;
  onCompletarCiclo: (id: string) => void;
  onMarcarLibre: (id: string) => void;
  onMarcarOcupada: (id: string) => void;
  onBloquear: (id: string, motivo: string) => void;
  onDesbloquear: (id: string) => void;
  onAsignar: (id: string, origen: OrigenPaciente, nota?: string) => void;
  onQuitarAsignacion: (id: string) => void;
  onSetGenero: (id: string, genero: 'M' | 'F' | undefined) => void;
  onAgregarObservacion: (id: string, texto: string) => void;
  allBeds: Bed[];
}

// Which pases each role can advance to
function canAdvance(role: Role, from: EgresoPase, to: EgresoPase): boolean {
  const transitions: Record<EgresoPase, Role[]> = {
    declarado:        [],           // nobody advances TO declarado (only declararEgreso sets this)
    cama_liberada:    ['clinico', 'ugp'],
    en_aseo:          ['clinico', 'ugp'],
    cama_lista:       ['clinico', 'ugp'],
    paciente_en_cama: ['clinico', 'ugp'],
  };
  const currentIdx = PASE_ORDER.indexOf(from);
  const targetIdx = PASE_ORDER.indexOf(to);
  return targetIdx === currentIdx + 1 && transitions[to].includes(role);
}

const NEXT_PASE_LABELS: Record<EgresoPase, string> = {
  declarado:        'Confirmar que el paciente se fue',
  cama_liberada:    'Solicitar aseo',
  en_aseo:          'Aseo completado',
  cama_lista:       'Paciente en cama',
  paciente_en_cama: '',  // no next — triggers completarCiclo
};

export default function BedDetail({
  bed, role, simplified = false, onClose,
  onDeclararEgreso, onAvanzarPase, onToggleCasoEntregado,
  onCancelarAlta, onCompletarCiclo,
  onMarcarLibre, onMarcarOcupada,
  onBloquear, onDesbloquear,
  onAsignar, onQuitarAsignacion,
  onSetGenero, onAgregarObservacion, allBeds,
}: Props) {
  const [tipoForm, setTipoForm] = useState<EgresoTipo | null>(null);
  const [hora, setHora] = useState('');
  const [ambulancia, setAmbulancia] = useState(false);
  const [destinoServicio, setDestinoServicio] = useState('');
  const [destinoCama, setDestinoCama] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showBloqueo, setShowBloqueo] = useState(false);
  const [motivoBloqueo, setMotivoBloqueo] = useState('');
  const [showAsignacion, setShowAsignacion] = useState(false);
  const [obsTexto, setObsTexto] = useState('');

  const currentServicio = getServicioForBed(bed.id);
  const destinoOptions = SERVICIOS.filter(s => s.id !== currentServicio);

  const openForm = (tipo: EgresoTipo) => {
    setTipoForm(tipo);
    setHora('');
    setAmbulancia(false);
    if (tipo === 'traslado') {
      setDestinoServicio(destinoOptions[0]?.id ?? '');
      setDestinoCama('');
    }
  };

  const handleConfirmar = () => {
    if (!tipoForm) return;
    onDeclararEgreso(
      bed.id, tipoForm, hora, ambulancia,
      tipoForm === 'traslado' ? destinoServicio : undefined,
      tipoForm === 'traslado' ? destinoCama : undefined,
    );
    setTipoForm(null);
  };

  const handleBloquear = () => {
    if (!motivoBloqueo.trim()) return;
    onBloquear(bed.id, motivoBloqueo.trim());
    setShowBloqueo(false);
    setMotivoBloqueo('');
  };

  const isAlta = bed.egreso?.tipo === 'alta';
  const origenInfo = bed.asignacion ? getOrigen(bed.asignacion.origen) : undefined;
  const canAsignar = role === 'ugp' && (bed.status === 'libre' || bed.status === 'egreso');
  const showAsignacionInfo = bed.asignacion || canAsignar;

  const egresoColor = isAlta ? 'text-amber-800' : 'text-teal-800';
  const egresoBg = isAlta ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200';

  // Egreso phase navigation
  const currentPase = bed.egreso?.pase;
  const currentPaseIdx = currentPase ? PASE_ORDER.indexOf(currentPase) : -1;
  const nextPase = currentPase && currentPaseIdx < PASE_ORDER.length - 1
    ? PASE_ORDER[currentPaseIdx + 1]
    : null;
  const canAdvanceNow = currentPase && nextPase
    ? canAdvance(role, currentPase, nextPase)
    : false;
  const canCompletarCiclo = currentPase === 'paciente_en_cama';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Cama {bed.id}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {bed.status === 'libre' && 'Disponible'}
              {bed.status === 'ocupada' && 'Ocupada'}
              {bed.status === 'bloqueada' && <span className="text-slate-600 flex items-center gap-1"><Lock size={11} /> Bloqueada</span>}
              {bed.status === 'egreso' && (
                <span className={egresoColor}>
                  {isAlta ? 'Alta' : 'Traslado'} · {PASE_LABELS[currentPase!]}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {(['M', 'F', undefined] as const).map((g) => (
                <button
                  key={g ?? 'none'}
                  onClick={() => onSetGenero(bed.id, g)}
                  className={`px-2.5 py-1.5 text-sm transition-colors ${bed.genero === g ? 'bg-slate-600 text-white' : 'bg-white text-slate-400 active:bg-slate-50'}`}
                >
                  {g === 'M' ? '♂' : g === 'F' ? '♀' : '—'}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2.5 rounded-full bg-slate-100 active:bg-slate-200">
              <X size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">

          {/* ── BLOQUEADA ── */}
          {bed.status === 'bloqueada' && (
            <div className="p-5 space-y-3">
              <div className="bg-slate-700 text-white rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2 opacity-70 text-sm">
                  <Lock size={14} />
                  <span>Bloqueada hace {elapsedFull(bed.bloqueo!.hora_bloqueo)}</span>
                </div>
                <p className="font-semibold text-base">{bed.bloqueo!.motivo}</p>
              </div>
              {!simplified && (
                <button onClick={() => onDesbloquear(bed.id)} className="w-full bg-emerald-500 text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2 active:bg-emerald-600 shadow-md">
                  <Unlock size={18} /> Desbloquear cama
                </button>
              )}
            </div>
          )}

          {/* ── LIBRE ── */}
          {bed.status === 'libre' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" />
                <span className="font-medium text-emerald-800">Cama disponible para asignación</span>
              </div>
              {showAsignacionInfo && <AsignacionInline origenInfo={origenInfo} nota={bed.asignacion?.nota} canEdit={canAsignar} onOpen={() => setShowAsignacion(true)} />}
              {!simplified && (
                <>
                  <button onClick={() => onMarcarOcupada(bed.id)} className="w-full bg-slate-700 text-white rounded-xl py-3.5 font-semibold active:bg-slate-800">
                    Marcar como ocupada
                  </button>
                  <BloqueoSection show={showBloqueo} motivo={motivoBloqueo} onMotivo={setMotivoBloqueo}
                    onOpen={() => setShowBloqueo(true)} onClose={() => { setShowBloqueo(false); setMotivoBloqueo(''); }}
                    onConfirm={handleBloquear} />
                </>
              )}
            </div>
          )}

          {/* ── OCUPADA ── */}
          {bed.status === 'ocupada' && (
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <Circle size={22} className="text-slate-400 flex-shrink-0" />
                <span className="font-medium text-slate-600">Cama ocupada</span>
              </div>

              {tipoForm === null && (
                <div className="flex gap-2">
                  <button onClick={() => openForm('alta')} className="flex-1 bg-amber-500 text-white rounded-xl py-4 font-bold text-sm flex items-center justify-center gap-1.5 active:bg-amber-600 shadow-md">
                    Declarar Alta <ChevronRight size={16} />
                  </button>
                  <button onClick={() => openForm('traslado')} className="flex-1 bg-teal-500 text-white rounded-xl py-4 font-bold text-sm flex items-center justify-center gap-1.5 active:bg-teal-600 shadow-md">
                    <ArrowLeftRight size={15} /> Traslado
                  </button>
                </div>
              )}

              {tipoForm !== null && (
                <EgresoForm tipo={tipoForm} hora={hora} ambulancia={ambulancia}
                  destinoServicio={destinoServicio} destinoCama={destinoCama} destinoOptions={destinoOptions}
                  onHora={setHora} onAmbulancia={setAmbulancia}
                  onDestino={(s, c) => { setDestinoServicio(s); setDestinoCama(c); }}
                  onConfirm={handleConfirmar} onCancel={() => setTipoForm(null)} />
              )}

              {!simplified && tipoForm === null && (
                <>
                  <button onClick={() => onMarcarLibre(bed.id)} className="w-full border-2 border-slate-200 text-slate-600 rounded-xl py-3 font-medium">
                    Marcar como libre
                  </button>
                  <BloqueoSection show={showBloqueo} motivo={motivoBloqueo} onMotivo={setMotivoBloqueo}
                    onOpen={() => setShowBloqueo(true)} onClose={() => { setShowBloqueo(false); setMotivoBloqueo(''); }}
                    onConfirm={handleBloquear} />
                </>
              )}
            </div>
          )}

          {/* ── EGRESO ── */}
          {bed.status === 'egreso' && bed.egreso && (
            <div className="p-5 space-y-4">

              {/* Header info */}
              <div className={`border rounded-xl p-4 space-y-2 ${egresoBg}`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 ${egresoColor}`}>
                    <Clock size={15} />
                    <span className="text-sm font-medium">Hace {elapsedFull(bed.egreso.hora_declaracion)}</span>
                  </div>
                  {bed.egreso.hora_probable && (
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${isAlta ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
                      {isAlta ? 'Egreso' : 'Traslado'} {bed.egreso.hora_probable}
                    </span>
                  )}
                </div>
                {bed.egreso.necesita_ambulancia && (
                  <div className="flex items-center gap-2 text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    <Ambulance size={15} />
                    <span className="text-sm font-semibold">Requiere ambulancia</span>
                  </div>
                )}
                {!isAlta && bed.egreso.traslado_destino_servicio && (
                  <div className="flex items-center gap-2 text-teal-700 bg-white/70 rounded-lg px-3 py-2">
                    <ArrowLeftRight size={14} />
                    <span className="text-sm font-semibold">
                      Destino: {SERVICIOS.find(s => s.id === bed.egreso!.traslado_destino_servicio)?.label ?? bed.egreso.traslado_destino_servicio}
                      {bed.egreso.traslado_destino_cama && ` · Cama ${bed.egreso.traslado_destino_cama}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Asignacion */}
              {showAsignacionInfo && <AsignacionInline origenInfo={origenInfo} nota={bed.asignacion?.nota} canEdit={canAsignar} onOpen={() => setShowAsignacion(true)} />}

              {/* Entrega del caso — flag independiente */}
              <CasoEntregadoToggle
                done={!!bed.egreso.caso_entregado}
                canToggle={true}
                onToggle={() => onToggleCasoEntregado(bed.id)}
              />

              {/* Phase progress — always informational */}
              <PaseProgress egreso={bed.egreso} />

              {/* Management actions — Estado tab only */}
              {!simplified && (
                <div className="space-y-2 pt-1">
                  {!confirmCancel ? (
                    <button onClick={() => setConfirmCancel(true)} className="w-full flex items-center justify-center gap-2 border-2 border-red-200 text-red-400 rounded-xl py-3 font-medium">
                      <AlertTriangle size={15} /> Cancelar {isAlta ? 'alta' : 'traslado'}
                    </button>
                  ) : (
                    <div className="space-y-2 bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-red-700 text-center">¿Cancelar el {isAlta ? 'alta' : 'traslado'}?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmCancel(false)} className="flex-1 border-2 border-slate-200 rounded-xl py-2.5 text-slate-600 font-semibold">No, volver</button>
                        <button onClick={() => onCancelarAlta(bed.id)} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 font-bold">Sí, cancelar</button>
                      </div>
                    </div>
                  )}
                  <BloqueoSection show={showBloqueo} motivo={motivoBloqueo} onMotivo={setMotivoBloqueo}
                    onOpen={() => setShowBloqueo(true)} onClose={() => { setShowBloqueo(false); setMotivoBloqueo(''); }}
                    onConfirm={handleBloquear} />
                </div>
              )}
            </div>
          )}

          {/* ── OBSERVACIONES (todas las camas) ── */}
          <ObservacionesSection
            observaciones={bed.observaciones}
            texto={obsTexto}
            onTexto={setObsTexto}
            onAgregar={() => {
              if (!obsTexto.trim()) return;
              onAgregarObservacion(bed.id, obsTexto.trim());
              setObsTexto('');
            }}
          />
        </div>
      </div>

      {showAsignacion && canAsignar && (
        <AsignacionSheet
          bed={bed}
          allBeds={allBeds}
          onSave={(origen, nota) => { onAsignar(bed.id, origen, nota); setShowAsignacion(false); }}
          onRemove={() => { onQuitarAsignacion(bed.id); setShowAsignacion(false); }}
          onClose={() => setShowAsignacion(false)}
        />
      )}
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function formatObsHora(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return isToday ? time : `${d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })} ${time}`;
}

interface ObservacionesSectionProps {
  observaciones?: Observacion[];
  texto: string;
  onTexto: (v: string) => void;
  onAgregar: () => void;
}

function ObservacionesSection({ observaciones, texto, onTexto, onAgregar }: ObservacionesSectionProps) {
  const lista = observaciones ? [...observaciones].reverse() : [];
  return (
    <div className="px-5 pt-2 pb-6 space-y-3 border-t border-slate-100 mt-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 pt-2">Observaciones</h3>

      {/* Form */}
      <div className="flex gap-2 items-end">
        <textarea
          value={texto}
          onChange={e => onTexto(e.target.value)}
          placeholder="Agregar observación..."
          rows={2}
          className="flex-1 border-2 border-slate-200 focus:border-blue-400 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
        />
        <button
          onClick={onAgregar}
          disabled={!texto.trim()}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${texto.trim() ? 'bg-[#1e3a5f] text-white active:bg-blue-900' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
        >
          Agregar
        </button>
      </div>

      {/* Log */}
      {lista.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-1">Sin observaciones registradas</p>
      ) : (
        <div className="space-y-2">
          {lista.map((obs, i) => (
            <div key={i} className="bg-slate-50 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${obs.rol === 'clinico' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {obs.rol === 'clinico' ? 'Clínico' : 'UGP'}
                </span>
                <span className="text-[10px] text-slate-400">{formatObsHora(obs.hora)}</span>
              </div>
              <p className="text-sm text-slate-700 leading-snug">{obs.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CasoEntregadoToggle({ done, canToggle, onToggle }: { done: boolean; canToggle: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={canToggle ? onToggle : undefined}
      disabled={!canToggle}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-colors ${
        done
          ? 'bg-green-50 border-green-400'
          : canToggle
            ? 'bg-white border-slate-200 active:bg-slate-50'
            : 'bg-white border-slate-100 opacity-50'
      }`}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500' : 'bg-slate-200'}`}>
        {done
          ? <CheckCircle2 size={15} className="text-white" />
          : <Circle size={15} className="text-slate-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-green-800' : 'text-slate-700'}`}>Entrega del caso</p>
        <p className="text-xs text-slate-400">Handoff clínico al equipo siguiente</p>
      </div>
      {done && <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Completada</span>}
    </button>
  );
}

function PaseProgress({ egreso }: { egreso: NonNullable<Bed['egreso']> }) {
  const currentIdx = PASE_ORDER.indexOf(egreso.pase);
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Flujo de alta</h3>
      <div className="space-y-1">
        {PASE_ORDER.map((pase, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const style = getEgresoStyle({ ...egreso, pase });
          return (
            <div key={pase} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
              active ? `${style.bg} text-white` : done ? 'bg-slate-50' : 'bg-white'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-emerald-500' : active ? 'bg-white/30' : 'bg-slate-200'
              }`}>
                {done
                  ? <CheckCircle2 size={14} className="text-white" />
                  : <span className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-400'}`}>{idx + 1}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-semibold ${done ? 'text-slate-400 line-through' : active ? 'text-white' : 'text-slate-400'}`}>
                  {PASE_LABELS[pase]}
                </span>
              </div>
              {active && (
                <span className="text-[10px] text-white/70 flex-shrink-0">
                  hace {Math.floor((Date.now() - new Date(egreso.hora_pase).getTime()) / 60000)}m
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AsignacionInlineProps {
  origenInfo: ReturnType<typeof getOrigen>;
  nota?: string;
  canEdit: boolean;
  onOpen: () => void;
}

function AsignacionInline({ origenInfo, nota, canEdit, onOpen }: AsignacionInlineProps) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-bold uppercase tracking-widest px-1 text-indigo-600">Asignación de ingreso</h3>
      {canEdit ? (
        <button onClick={onOpen}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-colors ${origenInfo ? 'bg-white border-slate-200' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className="flex items-center gap-3 min-w-0">
            {origenInfo ? (
              <>
                <span className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold text-white ${origenInfo.bg}`}>{origenInfo.label}</span>
                {nota
                  ? <span className="text-sm text-slate-600 truncate">{nota}</span>
                  : <span className="text-xs text-slate-400">Origen asignado</span>
                }
              </>
            ) : (
              <>
                <Circle size={20} className="text-indigo-300 flex-shrink-0" />
                <span className="text-sm font-semibold text-indigo-600">Asignar paciente entrante</span>
              </>
            )}
          </div>
          <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
        </button>
      ) : (
        origenInfo && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-100 bg-indigo-50">
            <span className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold text-white ${origenInfo.bg}`}>{origenInfo.label}</span>
            {nota
              ? <span className="text-sm text-slate-700 truncate">{nota}</span>
              : <span className="text-xs text-slate-500">Origen asignado</span>
            }
          </div>
        )
      )}
    </div>
  );
}

interface EgresoFormProps {
  tipo: EgresoTipo;
  hora: string;
  ambulancia: boolean;
  destinoServicio: string;
  destinoCama: string;
  destinoOptions: typeof SERVICIOS;
  onHora: (v: string) => void;
  onAmbulancia: (v: boolean) => void;
  onDestino: (srv: string, cama: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function EgresoForm({ tipo, hora, ambulancia, destinoServicio, destinoCama, destinoOptions, onHora, onAmbulancia, onDestino, onConfirm, onCancel }: EgresoFormProps) {
  const isTraslado = tipo === 'traslado';
  return (
    <div className={`border rounded-2xl p-4 space-y-4 ${isTraslado ? 'bg-teal-50 border-teal-200' : 'bg-amber-50 border-amber-200'}`}>
      <h3 className={`font-bold text-base ${isTraslado ? 'text-teal-800' : 'text-amber-800'}`}>
        {isTraslado ? 'Declarar traslado' : 'Declarar alta'}
      </h3>

      <div>
        <label className="text-sm font-medium text-slate-600 block mb-1.5">Hora probable de egreso</label>
        <input type="time" value={hora} onChange={e => onHora(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-blue-400 rounded-xl px-4 py-3 text-lg font-medium focus:outline-none" />
      </div>

      {isTraslado && (
        <div>
          <label className="text-sm font-medium text-slate-600 block mb-1.5">Destino del traslado</label>
          <div className="flex gap-2">
            <select value={destinoServicio} onChange={e => onDestino(e.target.value, destinoCama)}
              className="flex-1 border-2 border-slate-200 focus:border-teal-400 rounded-xl px-3 py-3 font-semibold text-slate-700 focus:outline-none bg-white">
              {destinoOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input type="text" value={destinoCama} placeholder="Cama"
              onChange={e => onDestino(destinoServicio, e.target.value)}
              className="w-28 border-2 border-slate-200 focus:border-teal-400 rounded-xl px-3 py-3 text-base font-medium focus:outline-none" />
          </div>
          {destinoCama && (
            <p className="text-xs text-teal-600 mt-1.5 font-medium">
              ✓ Cama {destinoCama} recibirá asignación automática de traslado interno
            </p>
          )}
        </div>
      )}

      <button type="button" onClick={() => onAmbulancia(!ambulancia)} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Ambulance size={18} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Requiere ambulancia</span>
        </div>
        <div className={`w-12 h-6 rounded-full transition-colors ${ambulancia ? 'bg-blue-500' : 'bg-slate-200'} flex items-center px-0.5`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${ambulancia ? 'translate-x-6' : ''}`} />
        </div>
      </button>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 border-2 border-slate-200 rounded-xl py-3 text-slate-600 font-semibold">Volver</button>
        <button onClick={onConfirm} className={`flex-1 text-white rounded-xl py-3 font-bold ${isTraslado ? 'bg-teal-500 active:bg-teal-600' : 'bg-amber-500 active:bg-amber-600'}`}>
          Confirmar
        </button>
      </div>
    </div>
  );
}

interface BloqueoSectionProps {
  show: boolean; motivo: string;
  onMotivo: (v: string) => void; onOpen: () => void; onClose: () => void; onConfirm: () => void;
}

function BloqueoSection({ show, motivo, onMotivo, onOpen, onClose, onConfirm }: BloqueoSectionProps) {
  return !show ? (
    <button onClick={onOpen} className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-400 rounded-xl py-3 text-sm font-medium active:bg-slate-50">
      <Lock size={14} /> Bloquear cama
    </button>
  ) : (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Lock size={15} /> Motivo del bloqueo</h3>
      <textarea value={motivo} onChange={e => onMotivo(e.target.value)}
        placeholder="Ej: Mantención, limpieza profunda, reserva para procedimiento..."
        className="w-full border-2 border-slate-200 focus:border-slate-400 rounded-xl p-3 text-sm resize-none h-20 focus:outline-none" autoFocus />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 border-2 border-slate-200 rounded-xl py-2.5 text-slate-600 font-semibold">Cancelar</button>
        <button onClick={onConfirm} disabled={!motivo.trim()}
          className={`flex-1 rounded-xl py-2.5 font-bold ${motivo.trim() ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
          Bloquear
        </button>
      </div>
    </div>
  );
}
