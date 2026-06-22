import { useState } from 'react';
import { Clock, Ambulance, ChevronLeft, ChevronRight, CheckCheck } from 'lucide-react';
import type { Bed, EgresoPase } from '../types';
import { PASE_LABELS, PASE_ORDER, getEgresoStyle } from '../types';
import { getOrigen } from '../constants';
import { elapsedShort } from './BedCard';

interface Props {
  beds: Bed[];
  onBedClick: (id: string) => void;
  onAvanzarPase: (id: string, pase: EgresoPase) => void;
  onCompletarCiclo: (id: string) => void;
}

const COLUMNS: Array<{ label: string; headerBg: string }> = [
  { label: 'Alta declarada',   headerBg: 'bg-red-500'     },
  { label: 'Cama liberada',    headerBg: 'bg-orange-400'  },
  { label: 'En aseo',          headerBg: 'bg-amber-400'   },
  { label: 'Disponible',       headerBg: 'bg-emerald-500' }, // cama_lista + libre
  { label: PASE_LABELS.paciente_en_cama, headerBg: 'bg-slate-600'   },
];

// Maps a bed to its column index (0–4), or -1 if not shown
function colOf(bed: Bed): number {
  if (bed.status === 'libre') return 3;
  if (bed.status !== 'egreso') return -1;
  return PASE_ORDER.indexOf(bed.egreso!.pase); // 0–4 matches COLUMNS exactly
}

function bedsForCol(beds: Bed[], idx: number): Bed[] {
  return beds
    .filter(b => colOf(b) === idx)
    .sort((a, b) => (a.egreso?.hora_declaracion ?? a.id) < (b.egreso?.hora_declaracion ?? b.id) ? -1 : 1);
}

export default function EstadoView({ beds, onBedClick, onAvanzarPase, onCompletarCiclo }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  const handleDrop = (targetIdx: number) => {
    if (!draggingId) return;
    const bed = beds.find(b => b.id === draggingId);
    if (!bed || bed.status !== 'egreso') return;
    const currentIdx = PASE_ORDER.indexOf(bed.egreso!.pase);
    if (targetIdx !== currentIdx && targetIdx >= 0 && targetIdx <= 4) {
      onAvanzarPase(draggingId, PASE_ORDER[targetIdx]);
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  return (
    <div className="flex-1 overflow-hidden pb-16">
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 px-3 pt-3 h-full" style={{ width: 'max-content' }}>
          {COLUMNS.map((col, colIdx) => {
            const colBeds = bedsForCol(beds, colIdx);
            const isOver = dragOverCol === colIdx;
            return (
              <div
                key={colIdx}
                className="w-40 flex flex-col flex-shrink-0 h-full"
                onDragOver={e => { e.preventDefault(); setDragOverCol(colIdx); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                onDrop={() => handleDrop(colIdx)}
              >
                {/* Header */}
                <div className={`${col.headerBg} rounded-xl px-3 py-2 mb-2 flex items-center justify-between flex-shrink-0 transition-opacity ${isOver ? 'opacity-80' : ''}`}>
                  <span className="text-white text-xs font-bold truncate pr-1">{col.label}</span>
                  <span className="bg-white/25 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {colBeds.length}
                  </span>
                </div>

                {/* Cards area */}
                <div className={`flex-1 overflow-y-auto space-y-2 pb-3 rounded-xl transition-colors ${isOver ? 'bg-slate-100' : ''}`}>
                  {colBeds.length === 0 && (
                    <p className={`text-[10px] text-center pt-6 ${isOver ? 'text-slate-400 font-medium' : 'text-slate-300'}`}>
                      {isOver ? 'Soltar aquí' : '—'}
                    </p>
                  )}
                  {colBeds.map(bed => (
                    <KanbanCard
                      key={bed.id}
                      bed={bed}
                      colIdx={colIdx}
                      isDragging={draggingId === bed.id}
                      onCardClick={() => onBedClick(bed.id)}
                      onDragStart={() => setDraggingId(bed.id)}
                      onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                      onMoveLeft={colIdx > 0
                        ? () => onAvanzarPase(bed.id, PASE_ORDER[colIdx - 1])
                        : undefined}
                      onMoveRight={colIdx < 4
                        ? () => onAvanzarPase(bed.id, PASE_ORDER[colIdx + 1])
                        : () => onCompletarCiclo(bed.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  bed: Bed;
  colIdx: number;
  isDragging: boolean;
  onCardClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void; // on last col, calls completarCiclo
}

function KanbanCard({ bed, colIdx, isDragging, onCardClick, onDragStart, onDragEnd, onMoveLeft, onMoveRight }: CardProps) {
  const isEgreso = bed.status === 'egreso';
  const isAlta   = bed.egreso?.tipo === 'alta';
  const origenInfo = bed.asignacion ? getOrigen(bed.asignacion.origen) : null;
  const stripe = isEgreso ? getEgresoStyle(bed.egreso!).bg : 'bg-emerald-500';

  return (
    <div
      draggable={isEgreso}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white border border-slate-100 rounded-xl shadow-sm transition-opacity ${isDragging ? 'opacity-25' : ''} ${isEgreso ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* Info area — tap to open detail */}
      <button onClick={onCardClick} className="w-full text-left p-2.5 flex gap-2">
        <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${stripe}`} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="font-bold text-sm text-slate-800">{bed.id}</span>
            <div className="flex items-center gap-1">
              {bed.genero && <span className="text-[11px] text-slate-400">{bed.genero === 'M' ? '♂' : '♀'}</span>}
              {isEgreso && (
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded text-white ${isAlta ? 'bg-amber-500' : 'bg-teal-500'}`}>
                  {isAlta ? 'ALTA' : 'TRAS'}
                </span>
              )}
            </div>
          </div>

          {isEgreso && bed.egreso && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock size={8} />
              <span>{elapsedShort(bed.egreso.hora_declaracion)}</span>
              {bed.egreso.hora_probable && <span className="text-slate-300">{bed.egreso.hora_probable}</span>}
              {bed.egreso.necesita_ambulancia && <Ambulance size={9} className="text-blue-400" />}
            </div>
          )}

          {origenInfo ? (
            <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white ${origenInfo.bg}`}>
              {origenInfo.short}
            </span>
          ) : isEgreso && (
            <span className="text-[9px] text-slate-300">sin asignar</span>
          )}
        </div>
      </button>

      {/* Move arrows — only for egreso beds */}
      {isEgreso && (
        <div className="flex border-t border-slate-100">
          <button
            onClick={e => { e.stopPropagation(); onMoveLeft?.(); }}
            disabled={!onMoveLeft}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-bl-xl transition-colors ${onMoveLeft ? 'active:bg-slate-100 text-slate-400' : 'text-slate-200 cursor-not-allowed'}`}
          >
            <ChevronLeft size={14} />
          </button>
          <div className="w-px bg-slate-100" />
          <button
            onClick={e => { e.stopPropagation(); onMoveRight?.(); }}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-br-xl transition-colors ${
              colIdx === 4
                ? 'active:bg-emerald-50 text-emerald-500'
                : 'active:bg-slate-100 text-slate-400'
            }`}
          >
            {colIdx === 4 ? <CheckCheck size={13} /> : <ChevronRight size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
