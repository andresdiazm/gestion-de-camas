import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import type { Bed, OrigenPaciente } from '../types';
import { PASE_LABELS } from '../types';
import { ORIGENES } from '../constants';

function elapsedFull(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface Props {
  bed: Bed;
  allBeds?: Bed[];
  onSave: (origen: OrigenPaciente, nota: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function AsignacionSheet({ bed, allBeds, onSave, onRemove, onClose }: Props) {
  const [selected, setSelected] = useState<OrigenPaciente | null>(
    bed.asignacion?.origen ?? null,
  );
  const [nota, setNota] = useState(bed.asignacion?.nota ?? '');
  const [pickedBed, setPickedBed] = useState<string | null>(
    bed.asignacion?.origen === 'traslado_interno' ? (bed.asignacion?.nota ?? null) : null,
  );

  const isEdit = !!bed.asignacion;
  const isAlta = bed.egreso?.tipo === 'alta';
  const isLibre = bed.status === 'libre';
  const isTrasladoInterno = selected === 'traslado_interno';

  // Beds already claimed as traslado source by another destination bed (via nota)
  const manuallyAssignedSources = new Set(
    (allBeds ?? [])
      .filter(b => b.id !== bed.id && b.asignacion?.origen === 'traslado_interno' && b.asignacion.nota)
      .map(b => b.asignacion!.nota!)
  );

  // Beds eligible as traslado source: egreso+traslado, not already claimed, excluding self
  const trasladoOpts = (allBeds ?? [])
    .filter(b =>
      b.id !== bed.id &&
      b.status === 'egreso' &&
      b.egreso?.tipo === 'traslado' &&
      !b.egreso.traslado_destino_cama &&
      !manuallyAssignedSources.has(b.id)
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  const handlePickBed = (b: Bed) => {
    setPickedBed(b.id);
    setNota(b.id);
  };

  const handleSelectOrigen = (origen: OrigenPaciente) => {
    setSelected(origen);
    if (origen !== 'traslado_interno') {
      setPickedBed(null);
      // keep nota if editing a non-traslado, clear if switching away from traslado
      if (selected === 'traslado_interno') setNota('');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Asignación · Cama {bed.id}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {isLibre ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-emerald-500">LIBRE</span>
              ) : (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${isAlta ? 'bg-amber-400' : 'bg-teal-500'}`}>
                  {isAlta ? 'ALTA' : 'TRASLADO'}
                </span>
              )}
              {bed.egreso && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock size={11} />
                  {elapsedFull(bed.egreso.hora_declaracion)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full bg-slate-100 active:bg-slate-200">
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-600">
            {isEdit ? 'Cambiar origen del paciente' : 'Seleccionar origen del paciente'}
          </p>

          {/* Origen grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {ORIGENES.map(o => {
              const isSelected = selected === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => handleSelectOrigen(o.value)}
                  className={`rounded-2xl py-4 px-3 font-bold text-sm transition-all active:scale-95 ${
                    isSelected
                      ? `${o.bg} text-white ring-4 ${o.ring} shadow-lg`
                      : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {/* Traslado interno — bed picker */}
          {isTrasladoInterno && trasladoOpts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-teal-600">
                Cama de origen
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {trasladoOpts.map(b => {
                  const isPicked = pickedBed === b.id;
                  const isLibreBed = b.status === 'libre';
                  const bIsAlta = b.egreso?.tipo === 'alta';
                  return (
                    <button
                      key={b.id}
                      onClick={() => handlePickBed(b)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-colors ${
                        isPicked
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-slate-100 bg-slate-50 active:bg-slate-100'
                      }`}
                    >
                      <span className="font-bold text-sm text-slate-800 w-14 flex-shrink-0">{b.id}</span>
                      {isLibreBed ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-emerald-500">LIBRE</span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${bIsAlta ? 'bg-amber-400' : 'bg-teal-500'}`}>
                          {bIsAlta ? 'ALTA' : 'TRAS'}
                        </span>
                      )}
                      {b.egreso && (
                        <span className="text-[10px] text-slate-400 truncate">
                          {PASE_LABELS[b.egreso.pase]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nota / nombre */}
          {selected && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {isTrasladoInterno ? 'Cama de origen' : 'Cama o nombre del paciente'}
                <span className="font-normal normal-case tracking-normal text-slate-400 ml-1">(opcional)</span>
              </label>
              <input
                type="text"
                value={nota}
                onChange={e => { setNota(e.target.value); if (isTrasladoInterno) setPickedBed(null); }}
                placeholder={isTrasladoInterno ? 'Ej: 502-1' : 'Ej: 502-1, Juan Pérez...'}
                className="w-full border-2 border-slate-200 focus:border-blue-400 rounded-xl px-4 py-3 text-sm focus:outline-none"
                autoFocus={!isEdit && !isTrasladoInterno}
              />
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              onClick={() => selected && onSave(selected, nota.trim())}
              disabled={!selected}
              className={`w-full rounded-xl py-4 font-bold text-base transition-colors ${
                selected
                  ? 'bg-[#1e3a5f] text-white active:bg-blue-900 shadow-md'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isEdit ? 'Actualizar asignación' : 'Confirmar asignación'}
            </button>

            {isEdit && (
              <button
                onClick={onRemove}
                className="w-full border-2 border-red-200 text-red-400 rounded-xl py-3 font-medium active:bg-red-50"
              >
                Quitar asignación
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
