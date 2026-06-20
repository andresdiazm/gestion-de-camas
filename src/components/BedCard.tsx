import { Clock, Ambulance, Lock } from 'lucide-react';
import type { Bed } from '../types';
import { getEgresoStyle, PASE_LABELS } from '../types';
import { getOrigen } from '../constants';

function getCardStyle(bed: Bed): { bg: string; text: string; border: string } {
  if (bed.status === 'bloqueada')
    return { bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-600' };
  if (bed.status === 'libre')
    return { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-400' };
  if (bed.status === 'ocupada')
    return { bg: 'bg-white', text: 'text-slate-600', border: 'border-slate-200' };
  const { bg, text, border } = getEgresoStyle(bed.egreso!);
  return { bg, text, border };
}

export function elapsedShort(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

interface Props {
  bed: Bed;
  onClick: () => void;
}

export default function BedCard({ bed, onClick }: Props) {
  const { bg, text, border } = getCardStyle(bed);
  const isEgreso = bed.status === 'egreso';
  const origen = bed.asignacion ? getOrigen(bed.asignacion.origen) : null;
  const isTraslado = bed.egreso?.tipo === 'traslado';

  return (
    <button
      onClick={onClick}
      className={`${bg} ${text} border-2 ${border} rounded-xl p-2 flex flex-col items-center gap-0.5 min-h-[88px] shadow-sm active:scale-95 transition-transform w-full overflow-hidden`}
    >
      <div className="flex items-start justify-between w-full">
        <span className="font-bold text-sm leading-tight">{bed.id}</span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {bed.genero && (
            <span className="text-[13px] opacity-50 leading-none">{bed.genero === 'M' ? '♂' : '♀'}</span>
          )}
          {bed.status === 'bloqueada' && <Lock size={11} className="opacity-70" />}
          {isEgreso && (
            <span className="text-[9px] font-bold bg-white/20 px-1 rounded leading-tight">
              {isTraslado ? 'TRAS' : 'ALTA'}
            </span>
          )}
        </div>
      </div>

      {bed.status === 'bloqueada' && bed.bloqueo && (
        <p className="text-[9px] text-white/70 text-center leading-tight line-clamp-2 px-0.5 mt-0.5">
          {bed.bloqueo.motivo}
        </p>
      )}
      {bed.status === 'libre' && (
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90 mt-1">Libre</span>
      )}
      {bed.status === 'ocupada' && (
        <span className="text-[10px] text-slate-400 mt-1">Ocupada</span>
      )}

      {isEgreso && bed.egreso && (
        <>
          <span className="text-[8px] font-semibold text-white/80 text-center w-full truncate leading-tight">
            {PASE_LABELS[bed.egreso.pase]}
          </span>
          <div className="flex items-center gap-0.5 text-[10px] leading-tight w-full justify-center">
            <Clock size={9} className="flex-shrink-0" />
            <span>{elapsedShort(bed.egreso.hora_declaracion)}</span>
            {bed.egreso.hora_probable && (
              <span className="opacity-70 ml-0.5">{bed.egreso.hora_probable}</span>
            )}
          </div>
          {bed.egreso.necesita_ambulancia && (
            <Ambulance size={11} className="opacity-90" />
          )}
        </>
      )}

      {/* Asignacion badge — visible for libre and egreso */}
      {(bed.status === 'egreso' || bed.status === 'libre') && (
        origen ? (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${origen.bg} leading-tight mt-auto`}>
            {origen.short}
          </span>
        ) : (
          bed.status === 'egreso' && (
            <span className="text-[9px] text-white/40 leading-tight mt-auto">sin asignar</span>
          )
        )
      )}
    </button>
  );
}
