import { useState, useEffect, useCallback, useRef } from 'react';
import { Hospital, RefreshCw, BedDouble, LayoutList, Plus, X, Lock, Search, HelpCircle, FileText } from 'lucide-react';
import type { Bed, Role, EgresoPase, EgresoTipo, OrigenPaciente, Observacion } from './types';
import { getEgresoStyle, PASE_LABELS } from './types';
import { loadBeds, saveBeds, loadRole, saveRole } from './store';
import { SERVICIOS, type ServicioId, getOrigen } from './constants';
import RoleSelector from './components/RoleSelector';
import BedCard from './components/BedCard';
import BedDetail from './components/BedDetail';
import EstadoView from './components/EstadoView';

type Filter = 'todas' | 'movimientos' | 'disponibles' | 'bloqueadas';
type AppTab = 'camas' | 'estado';

export default function App() {
  const [beds, setBeds] = useState<Bed[]>(loadBeds);
  const [role, setRole] = useState<Role | null>(() => loadRole() as Role | null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todas');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<AppTab>('camas');
  const [servicio, setServicio] = useState<ServicioId>('medicina');
  const [showBedPicker, setShowBedPicker] = useState(false);
  const [showGlosario, setShowGlosario] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'camas' | 'estado'>('camas');
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { saveBeds(beds); }, [beds]);

  const handleRoleSelect = useCallback((r: Role) => { saveRole(r); setRole(r); }, []);

  const updateBed = useCallback((id: string, fn: (b: Bed) => Bed) => {
    setBeds(prev => prev.map(b => b.id === id ? fn(b) : b));
  }, []);

  const declararEgreso = useCallback((
    id: string, tipo: EgresoTipo, hora_probable: string, necesita_ambulancia: boolean,
    destinoServicio?: string, destinoCama?: string,
  ) => {
    const now = new Date().toISOString();
    setBeds(prev => prev.map(b => {
      if (b.id === id) {
        return {
          ...b,
          status: 'egreso' as const,
          egreso: {
            tipo, hora_probable, necesita_ambulancia,
            hora_declaracion: now,
            pase: 'declarado' as const,
            hora_pase: now,
            traslado_destino_servicio: destinoServicio,
            traslado_destino_cama: destinoCama,
            pase_history: [{ pase: 'declarado' as const, hora: now }],
          },
          asignacion: undefined,
        };
      }
      if (tipo === 'traslado' && destinoCama && b.id === destinoCama) {
        return { ...b, asignacion: { origen: 'traslado_interno' as const, hora_asignacion: now } };
      }
      return b;
    }));
  }, []);

  const avanzarPase = useCallback((id: string, nuevoPase: EgresoPase) => {
    const now = new Date().toISOString();
    updateBed(id, b => {
      if (!b.egreso) return b;
      const prevHistory = b.egreso.pase_history ?? [{ pase: b.egreso.pase, hora: b.egreso.hora_declaracion }];
      return {
        ...b,
        egreso: {
          ...b.egreso,
          pase: nuevoPase,
          hora_pase: now,
          pase_history: [...prevHistory, { pase: nuevoPase, hora: now }],
        },
      };
    });
  }, [updateBed]);

  const toggleCasoEntregado = useCallback((id: string) => {
    updateBed(id, b => b.egreso
      ? { ...b, egreso: { ...b.egreso, caso_entregado: !b.egreso.caso_entregado } }
      : b
    );
  }, [updateBed]);

  const asignarPaciente = useCallback((id: string, origen: OrigenPaciente, nota?: string) => {
    updateBed(id, b => ({ ...b, asignacion: { origen, hora_asignacion: new Date().toISOString(), nota: nota || undefined } }));
  }, [updateBed]);

  const quitarAsignacion = useCallback((id: string) => {
    updateBed(id, b => ({ ...b, asignacion: undefined }));
  }, [updateBed]);

  const cancelarAlta = useCallback((id: string) => {
    updateBed(id, b => ({ ...b, status: 'ocupada', egreso: undefined, asignacion: undefined }));
    setSelectedId(null);
  }, [updateBed]);

  const completarCiclo = useCallback((id: string) => {
    updateBed(id, b => ({ ...b, status: b.asignacion ? 'ocupada' : 'libre', egreso: undefined, asignacion: undefined }));
    setSelectedId(null);
  }, [updateBed]);

  const marcarLibre = useCallback((id: string) => {
    updateBed(id, b => ({ ...b, status: 'libre', egreso: undefined, asignacion: undefined }));
    setSelectedId(null);
  }, [updateBed]);

  const marcarOcupada = useCallback((id: string) => {
    updateBed(id, b => ({ ...b, status: 'ocupada', egreso: undefined, asignacion: undefined }));
    setSelectedId(null);
  }, [updateBed]);

  const setGenero = useCallback((id: string, genero: 'M' | 'F' | undefined) => {
    updateBed(id, b => ({ ...b, genero }));
  }, [updateBed]);

  const bloquearCama = useCallback((id: string, motivo: string) => {
    updateBed(id, b => ({ ...b, status: 'bloqueada', egreso: undefined, asignacion: undefined, bloqueo: { motivo, hora_bloqueo: new Date().toISOString() } }));
    setSelectedId(null);
  }, [updateBed]);

  const desbloquearCama = useCallback((id: string) => {
    updateBed(id, b => ({ ...b, status: 'libre', bloqueo: undefined }));
    setSelectedId(null);
  }, [updateBed]);

  const agregarObservacion = useCallback((id: string, texto: string) => {
    if (!role) return;
    const obs: Observacion = { texto, hora: new Date().toISOString(), rol: role };
    updateBed(id, b => ({ ...b, observaciones: [...(b.observaciones ?? []), obs] }));
  }, [updateBed, role]);

  if (!role) return <RoleSelector onSelect={handleRoleSelect} />;

  const srv = SERVICIOS.find(s => s.id === servicio)!;
  const serviceBeds = beds.filter(b => srv.beds.includes(b.id));

  const movimientosCount = serviceBeds.filter(b => b.status === 'egreso').length;
  const disponiblesCount = serviceBeds.filter(b => b.status === 'libre').length;
  const bloqueadasCount = serviceBeds.filter(b => b.status === 'bloqueada').length;
  let displayBeds = serviceBeds.filter(b => {
    if (filter === 'movimientos' && b.status !== 'egreso') return false;
    if (filter === 'disponibles' && b.status !== 'libre') return false;
    if (filter === 'bloqueadas' && b.status !== 'bloqueada') return false;
    if (search) return b.id.includes(search);
    return true;
  });

  if (filter === 'movimientos') {
    displayBeds = [...displayBeds].sort((a, b) => {
      const ta = a.egreso?.hora_declaracion ?? '';
      const tb = b.egreso?.hora_declaracion ?? '';
      return ta < tb ? -1 : 1;
    });
  }

  const selectedBed = beds.find(b => b.id === selectedId) ?? null;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      <header className="bg-[#1e3a5f] text-white px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Hospital size={18} />
            <span className="font-bold text-sm tracking-wide">Gestión de Camas</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => generateReport(beds)} className="bg-white/15 active:bg-white/10 rounded-full p-1.5" title="Exportar PDF">
              <FileText size={16} />
            </button>
            <button onClick={() => setShowGlosario(true)} className="bg-white/15 active:bg-white/10 rounded-full p-1.5" title="Definiciones">
              <HelpCircle size={16} />
            </button>
            <button onClick={() => setRole(null)} className="bg-white/15 active:bg-white/10 rounded-full px-3.5 py-1.5 text-xs font-semibold">
              {role === 'clinico' ? '👩‍⚕️ Clínico' : '🏥 UGP'}
            </button>
          </div>
        </div>
        <div className="flex">
          {SERVICIOS.map(s => (
            <button
              key={s.id}
              onClick={() => setServicio(s.id)}
              className={`flex-1 py-2 text-xs font-bold tracking-wide border-b-2 transition-colors ${servicio === s.id ? 'border-white text-white' : 'border-transparent text-blue-300'}`}
            >
              {s.label} <span className="opacity-50 text-[10px]">{s.range}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="bg-[#1e3a5f] px-4 pb-3 flex gap-5 flex-shrink-0">
        <span className="text-sm"><span className="font-bold text-amber-300 text-base">{movimientosCount}</span><span className="text-blue-300 ml-1.5">movimientos</span></span>
        <span className="text-sm"><span className="font-bold text-emerald-300 text-base">{disponiblesCount}</span><span className="text-blue-300 ml-1.5">disponibles</span></span>
        {bloqueadasCount > 0 && <span className="text-sm"><span className="font-bold text-slate-300 text-base">{bloqueadasCount}</span><span className="text-blue-300 ml-1.5">bloqueadas</span></span>}
      </div>

      {/* Camas tab */}
      {tab === 'camas' && (
        <>
          <div className="bg-white border-b border-slate-200 px-3 py-2.5 flex gap-2 items-center flex-shrink-0">
            <input
              type="text" placeholder="Buscar cama"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-28 border-2 border-slate-200 focus:border-blue-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            />
            <div className="flex rounded-lg overflow-hidden border-2 border-slate-200 flex-1">
              {(['todas', 'movimientos', 'disponibles', 'bloqueadas'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${filter === f ? 'bg-[#1e3a5f] text-white' : 'bg-white text-slate-500'}`}
                >
                  {f === 'todas' && 'Todas'}
                  {f === 'movimientos' && <>Movimientos{movimientosCount > 0 && <span className={`ml-1 rounded-full px-1.5 text-[10px] ${filter === 'movimientos' ? 'bg-amber-400' : 'bg-amber-100 text-amber-700'}`}>{movimientosCount}</span>}</>}
                  {f === 'disponibles' && <>Disponibles{disponiblesCount > 0 && <span className={`ml-1 rounded-full px-1.5 text-[10px] ${filter === 'disponibles' ? 'bg-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>{disponiblesCount}</span>}</>}
                  {f === 'bloqueadas' && <>Bloqueadas{bloqueadasCount > 0 && <span className={`ml-1 rounded-full px-1.5 text-[10px] ${filter === 'bloqueadas' ? 'bg-slate-400' : 'bg-slate-100 text-slate-600'}`}>{bloqueadasCount}</span>}</>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 pb-20">
            {displayBeds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <RefreshCw size={28} className="mb-2 opacity-30" /><p className="text-sm">Sin resultados</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {displayBeds.map(bed => <BedCard key={bed.id} bed={bed} onClick={() => { setSelectedSource('camas'); setSelectedId(bed.id); }} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* Estado tab */}
      {tab === 'estado' && (
        <EstadoView
          beds={serviceBeds}
          onBedClick={id => { setSelectedSource('estado'); setSelectedId(id); }}
          onAvanzarPase={avanzarPase}
          onCompletarCiclo={completarCiclo}
        />
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-30 h-16">
        <button onClick={() => setTab('camas')} className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab === 'camas' ? 'text-[#1e3a5f]' : 'text-slate-400'}`}>
          <BedDouble size={22} />
          <span className="text-[10px] font-semibold">Camas</span>
        </button>

        {/* FAB central */}
        <div className="flex-1 flex items-center justify-center relative">
          <button
            onClick={() => setShowBedPicker(true)}
            className="absolute -top-6 w-14 h-14 bg-[#1e3a5f] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-white"
          >
            <Plus size={26} className="text-white" />
          </button>
        </div>

        <button onClick={() => setTab('estado')} className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab === 'estado' ? 'text-[#1e3a5f]' : 'text-slate-400'}`}>
          <LayoutList size={22} />
          <span className="text-[10px] font-semibold">Estado</span>
        </button>
      </nav>

      {/* Glosario */}
      {showGlosario && <GlosarioSheet onClose={() => setShowGlosario(false)} />}

      {/* Bed picker sheet */}
      {showBedPicker && (
        <BedPickerSheet
          beds={beds}
          onSelect={id => { setSelectedSource('camas'); setSelectedId(id); setShowBedPicker(false); }}
          onClose={() => setShowBedPicker(false)}
        />
      )}

      {selectedBed && (
        <BedDetail
          bed={selectedBed}
          role={role}
          simplified={selectedSource === 'camas'}
          onClose={() => setSelectedId(null)}
          onDeclararEgreso={declararEgreso}
          onAvanzarPase={avanzarPase}
          onToggleCasoEntregado={toggleCasoEntregado}
          onCancelarAlta={cancelarAlta}
          onCompletarCiclo={completarCiclo}
          onMarcarLibre={marcarLibre}
          onMarcarOcupada={marcarOcupada}
          onBloquear={bloquearCama}
          onDesbloquear={desbloquearCama}
          onAsignar={asignarPaciente}
          onQuitarAsignacion={quitarAsignacion}
          onSetGenero={setGenero}
          onAgregarObservacion={agregarObservacion}
          allBeds={beds}
        />
      )}
    </div>
  );
}

// ── PDF Report ───────────────────────────────────────────────────────────────

function generateReport(beds: Bed[]) {
  const now = new Date();

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const elapsed = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  };

  // Returns timestamp for a given pase from history, or fallback for legacy records
  const getPaseHora = (e: NonNullable<Bed['egreso']>, pase: string): string | null => {
    if (e.pase_history) return e.pase_history.find(h => h.pase === pase)?.hora ?? null;
    if (pase === 'declarado') return e.hora_declaracion;
    if (pase === e.pase) return e.hora_pase;
    return null;
  };

  const egresoBeds = [...beds.filter(b => b.status === 'egreso')]
    .sort((a, b) => a.egreso!.hora_declaracion < b.egreso!.hora_declaracion ? -1 : 1);
  const libreBeds = beds.filter(b => b.status === 'libre');
  const bloqBeds  = beds.filter(b => b.status === 'bloqueada');
  const bedsObs   = beds.filter(b => b.observaciones && b.observaciones.length > 0);

  const PHASES: Array<{ pase: string; label: string; color: string }> = [
    { pase: 'declarado',        label: 'Alta indicada',    color: '#ef4444' },
    { pase: 'cama_liberada',    label: 'Cama liberada',    color: '#fb923c' },
    { pase: 'en_aseo',          label: 'Inicio aseo',      color: '#f59e0b' },
    { pase: 'cama_lista',       label: 'Cama disponible',  color: '#10b981' },
    { pase: 'paciente_en_cama', label: 'Paciente acostado',color: '#475569' },
  ];

  const egresoRows = egresoBeds.map(b => {
    const e = b.egreso!;
    const cIdx = PHASES.findIndex(p => p.pase === e.pase);
    const origenInfo = b.asignacion ? getOrigen(b.asignacion.origen) : null;
    const destino = e.tipo === 'traslado'
      ? [SERVICIOS.find(s => s.id === e.traslado_destino_servicio)?.label, e.traslado_destino_cama ? `c.${e.traslado_destino_cama}` : ''].filter(Boolean).join(' ')
      : '';

    const phaseCells = PHASES.map((ph, idx) => {
      const hora = getPaseHora(e, ph.pase);
      const active = idx === cIdx;
      const past   = idx < cIdx;
      if (!hora) return `<td style="color:#d1d5db;text-align:center">—</td>`;
      const style = active
        ? `font-weight:700;color:${ph.color}`
        : past ? 'color:#64748b' : 'color:#94a3b8';
      return `<td style="${style};text-align:center;white-space:nowrap">${fmtTime(hora)}</td>`;
    }).join('');

    return `<tr>
      <td><strong>${b.id}</strong>${b.genero ? ` <span style="color:#94a3b8">${b.genero === 'M' ? '♂' : '♀'}</span>` : ''}</td>
      <td><span class="badge ${e.tipo}">${e.tipo === 'alta' ? 'Alta' : 'Trasl.'}</span>${destino ? `<br><span style="font-size:9px;color:#64748b">${destino}</span>` : ''}</td>
      ${phaseCells}
      <td style="text-align:center">${e.caso_entregado ? '<span style="color:#16a34a;font-weight:700">✓</span>' : '<span style="color:#cbd5e1">—</span>'}</td>
      <td>${origenInfo ? origenInfo.label : '—'}${b.asignacion?.nota ? `<br><span style="font-size:9px;color:#94a3b8">${b.asignacion.nota}</span>` : ''}</td>
    </tr>`;
  }).join('');

  const obsSection = bedsObs.map(b => `
    <div class="obs-block">
      <div class="obs-bed">Cama ${b.id}</div>
      ${[...(b.observaciones ?? [])].reverse().map(o => `
        <div class="obs-item">
          <span class="obs-tag ${o.rol}">${o.rol === 'clinico' ? 'Clínico' : 'UGP'}</span>
          <span class="obs-hora">${fmtTime(o.hora)}</span>
          <span class="obs-text">${o.texto}</span>
        </div>`).join('')}
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Movimientos · ${now.toLocaleDateString('es-CL')}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;color:#1e293b;padding:20px 24px;background:#fff}
  h1{font-size:16px;font-weight:800;color:#1e3a5f}
  .meta{color:#64748b;font-size:9px;margin-top:2px}
  h2{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin:16px 0 6px;padding-bottom:3px;border-bottom:2px solid #e2e8f0}
  .summary{display:flex;gap:8px;margin:10px 0}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;text-align:center}
  .box .n{font-size:18px;font-weight:800;line-height:1}
  .box .l{font-size:8px;text-transform:uppercase;color:#94a3b8;margin-top:1px}
  table{width:100%;border-collapse:collapse}
  th{text-align:center;font-size:8px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;padding:5px 6px;background:#f8fafc;border-bottom:2px solid #e2e8f0;white-space:nowrap}
  th.left{text-align:left}
  td{padding:5px 6px;border-bottom:1px solid #f1f5f9;vertical-align:middle;font-size:10px}
  tr:last-child td{border-bottom:none}
  tr:nth-child(even){background:#fafafa}
  .badge{display:inline-block;padding:1px 5px;border-radius:9999px;font-size:8px;font-weight:800;color:#fff;white-space:nowrap}
  .badge.alta{background:#f59e0b}
  .badge.traslado{background:#0d9488}
  .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
  .chip{border-radius:5px;padding:2px 8px;font-size:9px;font-weight:600}
  .chip.libre{background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46}
  .chip.bloq{background:#f1f5f9;border:1px solid #94a3b8;color:#334155}
  .obs-block{margin-bottom:6px;page-break-inside:avoid}
  .obs-bed{font-weight:700;font-size:10px;color:#1e3a5f;margin-bottom:3px}
  .obs-item{display:flex;align-items:baseline;gap:5px;padding:3px 7px;background:#f8fafc;border-left:3px solid #cbd5e1;margin-bottom:2px;border-radius:0 4px 4px 0}
  .obs-tag{font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;white-space:nowrap}
  .obs-tag.clinico{background:#dbeafe;color:#1d4ed8}
  .obs-tag.ugp{background:#ede9fe;color:#5b21b6}
  .obs-hora{color:#94a3b8;font-size:8px;white-space:nowrap}
  .footer{margin-top:16px;padding-top:6px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:8px;display:flex;justify-content:space-between}
  @media print{body{padding:10px 14px}@page{size:A4 landscape;margin:.6cm}}
</style>
</head>
<body>
  <h1>Resumen de Movimientos</h1>
  <div class="meta">Generado el ${now.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} a las ${fmtTime(now.toISOString())}</div>

  <div class="summary">
    <div class="box"><div class="n" style="color:#ef4444">${egresoBeds.length}</div><div class="l">En movimiento</div></div>
    <div class="box"><div class="n" style="color:#10b981">${libreBeds.length}</div><div class="l">Disponibles</div></div>
    <div class="box"><div class="n" style="color:#475569">${bloqBeds.length}</div><div class="l">Bloqueadas</div></div>
    <div class="box"><div class="n" style="color:#334155">${beds.filter(b => b.status === 'ocupada').length}</div><div class="l">Ocupadas</div></div>
  </div>

  ${egresoBeds.length > 0 ? `
  <h2>Camas en movimiento (${egresoBeds.length})</h2>
  <table>
    <thead><tr>
      <th class="left">Cama</th>
      <th class="left">Tipo</th>
      <th style="color:#ef4444">Alta<br>indicada</th>
      <th style="color:#fb923c">Cama<br>liberada</th>
      <th style="color:#f59e0b">Inicio<br>aseo</th>
      <th style="color:#10b981">Cama<br>disponible</th>
      <th style="color:#475569">Paciente<br>acostado</th>
      <th>Entrega<br>clínica</th>
      <th class="left">Asignado a</th>
    </tr></thead>
    <tbody>${egresoRows}</tbody>
  </table>` : ''}

  ${libreBeds.length > 0 ? `
  <h2>Disponibles (${libreBeds.length})</h2>
  <div class="chips">
    ${libreBeds.map(b => `<span class="chip libre">${b.id}${b.asignacion ? ' · asignada' : ''}</span>`).join('')}
  </div>` : ''}

  ${bloqBeds.length > 0 ? `
  <h2>Bloqueadas (${bloqBeds.length})</h2>
  <div class="chips">
    ${bloqBeds.map(b => `<span class="chip bloq">${b.id} · ${b.bloqueo?.motivo ?? ''} (hace ${elapsed(b.bloqueo!.hora_bloqueo)})</span>`).join('')}
  </div>` : ''}

  ${bedsObs.length > 0 ? `<h2>Observaciones</h2>${obsSection}` : ''}

  <div class="footer">
    <span>Gestión de Camas · ${SERVICIOS.map(s => s.label).join(' / ')}</span>
    <span>Refleja el estado al momento de generación</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Habilita las ventanas emergentes para generar el reporte'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── Bed picker ────────────────────────────────────────────────────────────────

function BedPickerSheet({ beds, onSelect, onClose }: {
  beds: Bed[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.trim()
    ? beds.filter(b => b.id.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <Search size={18} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar cama (ej: 601-2)"
            className="flex-1 text-base focus:outline-none text-slate-800 placeholder-slate-400"
          />
          <button onClick={onClose} className="p-2 rounded-full bg-slate-100 active:bg-slate-200 flex-shrink-0">
            <X size={16} className="text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {query.trim() === '' && (
            <p className="text-sm text-slate-400 text-center py-12">Escribe el número de cama</p>
          )}
          {query.trim() !== '' && results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-12">Sin resultados para "{query}"</p>
          )}
          {results.map(b => {
            const isEgreso = b.status === 'egreso';
            const eStyle = isEgreso ? getEgresoStyle(b.egreso!) : null;
            const stripe = eStyle?.bg
              ?? (b.status === 'libre' ? 'bg-emerald-500'
                : b.status === 'bloqueada' ? 'bg-slate-700'
                : 'bg-slate-300');
            const statusLabel = b.status === 'ocupada' ? 'Ocupada'
              : b.status === 'libre' ? 'Disponible'
              : b.status === 'bloqueada' ? 'Bloqueada'
              : `${b.egreso!.tipo === 'alta' ? 'Alta' : 'Traslado'} · ${PASE_LABELS[b.egreso!.pase]}`;
            return (
              <button
                key={b.id}
                onClick={() => onSelect(b.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-slate-50 border-b border-slate-50 text-left"
              >
                <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${stripe}`} />
                <span className="font-bold text-base text-slate-800 w-16 flex-shrink-0">{b.id}</span>
                <span className="text-sm text-slate-500 flex-1">{statusLabel}</span>
                {b.status === 'bloqueada' && <Lock size={13} className="text-slate-400 flex-shrink-0" />}
                {b.genero && <span className="text-slate-400 flex-shrink-0">{b.genero === 'M' ? '♂' : '♀'}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

const GLOSARIO = [
  {
    label: 'Alta declarada',
    bg: 'bg-red-500',
    def: 'El médico indica el alta, pero el paciente sigue utilizando su cama. Incluye entrega de documentación, fármacos y educación al paciente.',
  },
  {
    label: 'Cama liberada',
    bg: 'bg-orange-400',
    def: 'El paciente hace efectivo el egreso hospitalario. La unidad aún requiere gestión de aseo.',
  },
  {
    label: 'En aseo',
    bg: 'bg-amber-400',
    def: 'Personal de aseo se encuentra realizando la limpieza de la unidad y/o el proceso de secado.',
  },
  {
    label: 'Disponible',
    bg: 'bg-emerald-500',
    def: 'Cama disponible y lista para recibir al próximo paciente.',
  },
  {
    label: 'Paciente acostado',
    bg: 'bg-slate-600',
    def: 'El paciente asignado ya se encuentra instalado en su cama.',
  },
];

function GlosarioSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Definiciones operativas</h2>
            <p className="text-xs text-slate-400 mt-0.5">Flujo de gestión de camas</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-100 active:bg-slate-200">
            <X size={18} className="text-slate-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {GLOSARIO.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className={`w-2 mt-1 self-stretch rounded-full flex-shrink-0 ${item.bg}`} style={{ minHeight: '100%' }} />
              <div className="flex-1">
                <span className={`inline-block text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full mb-1 ${item.bg}`}>
                  {item.label}
                </span>
                <p className="text-sm text-slate-600 leading-relaxed">{item.def}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
