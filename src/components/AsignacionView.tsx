import { useState } from 'react';
import { Clock } from 'lucide-react';
import type { Bed, OrigenPaciente } from '../types';
import { PASE_LABELS } from '../types';
import { ORIGENES, getOrigen } from '../constants';
import { elapsedShort } from './BedCard';
import AsignacionSheet from './AsignacionSheet';

type AsignFilter = OrigenPaciente | 'sin_asignar' | null;

interface Props {
  beds: Bed[];
  allBeds: Bed[];
  onAsignar: (id: string, origen: OrigenPaciente, nota?: string) => void;
  onQuitarAsignacion: (id: string) => void;
}

function estadoLabel(bed: Bed): { text: string; cls: string } {
  if (bed.status === 'libre') return { text: 'Disponible', cls: 'text-emerald-600' };
  if (bed.status === 'egreso' && bed.egreso) {
    const tipo = bed.egreso.tipo === 'alta' ? 'Alta' : 'Traslado';
    return { text: `${tipo} · ${PASE_LABELS[bed.egreso.pase]}`, cls: 'text-slate-600' };
  }
  return { text: '—', cls: 'text-slate-400' };
}

export default function AsignacionView({ beds, allBeds, onAsignar, onQuitarAsignacion }: Props) {
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<AsignFilter>(null);

  const asignables = beds.filter(b => b.status === 'egreso' || b.status === 'libre');

  const sorted = [...asignables].sort((a, b) => {
    const aAsig = !!a.asignacion;
    const bAsig = !!b.asignacion;
    if (aAsig !== bAsig) return aAsig ? 1 : -1;
    if (a.status === 'libre' && b.status !== 'libre') return -1;
    if (a.status !== 'libre' && b.status === 'libre') return 1;
    const ta = a.egreso?.hora_declaracion ?? '';
    const tb = b.egreso?.hora_declaracion ?? '';
    return ta < tb ? -1 : 1;
  });

  const filtered = sorted.filter(b => {
    if (filtro === 'sin_asignar') return !b.asignacion;
    if (filtro) return b.asignacion?.origen === filtro;
    return true;
  });

  const sheetBed = sheetId ? beds.find(b => b.id === sheetId) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Filter chips */}
      <div className="flex gap-2 px-3 py-2.5 overflow-x-auto flex-shrink-0 border-b border-slate-100 bg-white">
        <button
          onClick={() => setFiltro(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filtro === null ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}
        >
          Todas
        </button>
        <button
          onClick={() => setFiltro(filtro === 'sin_asignar' ? null : 'sin_asignar')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filtro === 'sin_asignar' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}
        >
          Sin asignar
        </button>
        {ORIGENES.map(o => (
          <button
            key={o.value}
            onClick={() => setFiltro(filtro === o.value ? null : o.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filtro === o.value ? `${o.bg} text-white` : 'bg-slate-100 text-slate-500'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
            Sin camas para el filtro seleccionado
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-20">Cama</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Asignación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(bed => {
                const estado = estadoLabel(bed);
                const origenInfo = bed.asignacion ? getOrigen(bed.asignacion.origen) : null;
                const isLibre = bed.status === 'libre';
                const isAlta = bed.egreso?.tipo === 'alta';

                return (
                  <tr
                    key={bed.id}
                    onClick={() => setSheetId(bed.id)}
                    className="border-b border-slate-100 active:bg-slate-50 cursor-pointer"
                  >
                    {/* Cama */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{bed.id}</div>
                      {isLibre ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white bg-emerald-500">LIBRE</span>
                      ) : (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${isAlta ? 'bg-amber-400' : 'bg-teal-500'}`}>
                          {isAlta ? 'ALTA' : 'TRAS'}
                        </span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium ${estado.cls}`}>{estado.text}</span>
                      {bed.egreso && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                          <Clock size={9} />
                          {elapsedShort(bed.egreso.hora_declaracion)}
                          {bed.egreso.hora_probable && (
                            <span className="text-slate-300 ml-0.5">{bed.egreso.hora_probable}</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Asignación */}
                    <td className="px-3 py-3">
                      {origenInfo ? (
                        <div>
                          <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full text-white ${origenInfo.bg}`}>
                            {origenInfo.label}
                          </span>
                          {bed.asignacion?.nota && (
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                              {bed.asignacion.nota}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 border-2 border-dashed border-slate-200 px-2.5 py-1 rounded-full">
                          Sin asignar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {sheetBed && (
        <AsignacionSheet
          bed={sheetBed}
          allBeds={allBeds}
          onSave={(origen, nota) => { onAsignar(sheetBed.id, origen, nota); setSheetId(null); }}
          onRemove={() => { onQuitarAsignacion(sheetBed.id); setSheetId(null); }}
          onClose={() => setSheetId(null)}
        />
      )}
    </div>
  );
}
