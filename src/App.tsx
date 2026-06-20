import { useState, useEffect, useCallback } from 'react';
import { Hospital, RefreshCw, BedDouble, ClipboardList, LayoutList } from 'lucide-react';
import type { Bed, Role, EgresoPase, EgresoTipo, OrigenPaciente, Observacion } from './types';
import { loadBeds, saveBeds, loadRole, saveRole } from './store';
import { SERVICIOS, type ServicioId } from './constants';
import RoleSelector from './components/RoleSelector';
import BedCard from './components/BedCard';
import BedDetail from './components/BedDetail';
import AsignacionView from './components/AsignacionView';
import EstadoView from './components/EstadoView';

type Filter = 'todas' | 'movimientos' | 'disponibles' | 'bloqueadas';
type AppTab = 'camas' | 'asignacion' | 'estado';

export default function App() {
  const [beds, setBeds] = useState<Bed[]>(loadBeds);
  const [role, setRole] = useState<Role | null>(() => loadRole() as Role | null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todas');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<AppTab>('camas');
  const [servicio, setServicio] = useState<ServicioId>('medicina');
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
    updateBed(id, b => b.egreso
      ? { ...b, egreso: { ...b.egreso, pase: nuevoPase, hora_pase: now } }
      : b
    );
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
  const sinAsignarCount = serviceBeds.filter(b =>
    (b.status === 'egreso' || b.status === 'libre') && !b.asignacion
  ).length;

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
  const isUgp = role === 'ugp';

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      <header className="bg-[#1e3a5f] text-white px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Hospital size={18} />
            <span className="font-bold text-sm tracking-wide">Gestión de Camas</span>
          </div>
          <button onClick={() => setRole(null)} className="bg-white/15 active:bg-white/10 rounded-full px-3.5 py-1.5 text-xs font-semibold">
            {role === 'clinico' ? '👩‍⚕️ Clínico' : '🏥 UGP'}
          </button>
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
                {displayBeds.map(bed => <BedCard key={bed.id} bed={bed} onClick={() => setSelectedId(bed.id)} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* Asignación tab (UGP only) */}
      {isUgp && tab === 'asignacion' && (
        <div className="flex flex-col flex-1 overflow-hidden pb-16">
          <div className="px-4 pt-3 pb-1 flex-shrink-0 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-700">Asignación de pacientes</h2>
            <p className="text-xs text-slate-400">{srv.label} · {srv.range}</p>
          </div>
          <AsignacionView
            beds={serviceBeds}
            allBeds={beds}
            onAsignar={asignarPaciente}
            onQuitarAsignacion={quitarAsignacion}
          />
        </div>
      )}

      {/* Estado tab */}
      {tab === 'estado' && (
        <EstadoView beds={serviceBeds} onBedClick={setSelectedId} onAvanzarPase={avanzarPase} />
      )}

      {/* Bottom nav (all roles) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-30">
        <button onClick={() => setTab('camas')} className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab === 'camas' ? 'text-[#1e3a5f]' : 'text-slate-400'}`}>
          <BedDouble size={22} />
          <span className="text-[10px] font-semibold">Camas</span>
        </button>
        {isUgp && (
          <button onClick={() => setTab('asignacion')} className={`flex-1 py-3 flex flex-col items-center gap-0.5 relative ${tab === 'asignacion' ? 'text-[#1e3a5f]' : 'text-slate-400'}`}>
            <ClipboardList size={22} />
            <span className="text-[10px] font-semibold">Asignación</span>
            {sinAsignarCount > 0 && (
              <span className="absolute top-1.5 right-4 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">
                {sinAsignarCount}
              </span>
            )}
          </button>
        )}
        <button onClick={() => setTab('estado')} className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab === 'estado' ? 'text-[#1e3a5f]' : 'text-slate-400'}`}>
          <LayoutList size={22} />
          <span className="text-[10px] font-semibold">Estado</span>
        </button>
      </nav>

      {selectedBed && (
        <BedDetail
          bed={selectedBed}
          role={role}
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
