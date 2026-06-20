import { Stethoscope, Building2 } from 'lucide-react';
import type { Role } from '../types';

interface Props {
  onSelect: (role: Role) => void;
}

export default function RoleSelector({ onSelect }: Props) {
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🏥</div>
        <h1 className="text-3xl font-bold text-white mb-1">Gestión de Altas</h1>
        <p className="text-blue-300 text-sm font-medium">Servicio Medicina · 6001–6100</p>
      </div>

      <p className="text-blue-200 text-sm mb-5 font-medium tracking-wide uppercase">¿Quién eres?</p>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => onSelect('clinico')}
          className="w-full bg-white text-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xl active:scale-95 transition-transform"
        >
          <div className="bg-amber-100 p-3 rounded-xl flex-shrink-0">
            <Stethoscope size={28} className="text-amber-600" />
          </div>
          <div className="text-left">
            <div className="font-bold text-lg">Equipo Clínico</div>
            <div className="text-slate-500 text-sm">Declara altas y actualiza estado del paciente</div>
          </div>
        </button>

        <button
          onClick={() => onSelect('ugp')}
          className="w-full bg-white text-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xl active:scale-95 transition-transform"
        >
          <div className="bg-blue-100 p-3 rounded-xl flex-shrink-0">
            <Building2 size={28} className="text-blue-600" />
          </div>
          <div className="text-left">
            <div className="font-bold text-lg">UGP</div>
            <div className="text-slate-500 text-sm">Gestiona camas, aseo e ingreso de pacientes</div>
          </div>
        </button>
      </div>

      <p className="text-blue-700 text-xs mt-10 text-center">
        Datos guardados localmente en este dispositivo
      </p>
    </div>
  );
}
