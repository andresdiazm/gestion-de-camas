# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, hot-reload)
npm run build      # tsc + vite build (production bundle + PWA assets)
npm run preview    # Serve production build locally
npx tsc --noEmit   # Type-check without building (use after every change)
```

There are no tests or linter configured.

## Architecture

Mobile-first PWA for clinical bed management. **All state is localStorage-only** — no backend, no sync between devices (accepted for v1).

### Data flow

```
localStorage ──(loadBeds / migrateBed)──► App state (useState<Bed[]>)
                                              │
                                    ──(saveBeds on every change)──► localStorage
```

`App.tsx` owns all state and passes callbacks down. There is no context or external state manager.

### Core model (`src/types.ts`)

- `Bed` — top-level entity. Fields: `id` (string, e.g. `"601-1"`), `status`, `genero` (`'M' | 'F'`), optional `egreso`, `bloqueo`, `asignacion`.
- `asignacion` lives at **bed level**, not inside `EgresoData`. A libre or egreso bed can both have an incoming patient pre-assigned. `Asignacion` carries `origen`, `hora_asignacion`, and optional `nota` (cama o nombre del paciente).
- `EgresoData` carries `tipo` (`alta` | `traslado`), a linear phase `pase: EgresoPase`, `hora_pase`, `caso_entregado` (independent boolean flag), and optional `traslado_destino_servicio` / `traslado_destino_cama`.
- `caso_entregado` is **not a sequential step** — it's a parallel flag that either role can toggle at any point during an egreso.

### Egreso phase model (`EgresoPase`)

The discharge lifecycle is a **linear 5-step enum** (not a free-form checklist):

```
declarado → cama_liberada → en_aseo → cama_lista → paciente_en_cama
```

| Pase | Who can advance | Button label |
|---|---|---|
| `declarado` → `cama_liberada` | Clínico o UGP | "Confirmar que el paciente se fue" |
| `cama_liberada` → `en_aseo` | Solo UGP | "Solicitar aseo" |
| `en_aseo` → `cama_lista` | Solo UGP | "Aseo completado" |
| `cama_lista` → `paciente_en_cama` | Solo UGP | "Paciente en cama" |
| `paciente_en_cama` → `completarCiclo` | Solo UGP | "Ciclo completo" |

`getEgresoStyle(egreso)` in `types.ts` is the **single source of truth** for egreso colors. Do not derive colors from pase values elsewhere.

### Egreso color palette

| Pase | Alta | Traslado |
|---|---|---|
| `declarado` | amber-400 | cyan-400 |
| `cama_liberada` | orange-400 | orange-400 |
| `en_aseo` | orange-500 | teal-500 |
| `cama_lista` | violet-500 | violet-500 |
| `paciente_en_cama` | blue-500 | blue-500 |

### Services and beds (`src/constants.ts`)

15 beds split into two services:
- **Medicina** (`601–602`): `601-1` … `601-6`, `602-1` … `602-3` (9 beds)
- **UTI** (`501–503`): `501-1`, `501-2`, `502-1`, `502-2`, `503-1`, `503-2` (6 beds)

`SERVICIOS`, `ServicioId`, `getServicioForBed(bedId)`, `ORIGENES`, and `getOrigen(value)` are defined here.

### Store / migration (`src/store.ts`)

localStorage key: `altas_beds_v4`. Key exports:
- `loadBeds()` / `saveBeds()` — read/write beds array.
- `initBeds()` — builds default occupied beds from `SERVICIOS`.
- `loadRole()` / `saveRole()` — persist role selection (`altas_role_v1` key).
- `migrateBed()` — handles backwards compatibility across all historical formats. Calls `migrateChecklistToPase()` which converts v1 (milestones), v2 (step string), v3 (checklist booleans), and v4-early (`'entregado'` pase) → current `EgresoPase`. Also migrates `paciente_entregado` → `caso_entregado`.

**Always update `migrateBed` and `migrateChecklistToPase` when adding new fields to `Bed` or `EgresoData`.**

### Roles

- **Clínico**: declares alta or traslado from an occupied bed; can advance `declarado → cama_liberada`; toggles `caso_entregado`; can cancel a declared egreso.
- **UGP**: assigns incoming patients to libre/egreso beds; advances all pases from `cama_liberada` onward; marks beds libre/ocupada/bloqueada; completes the cycle.

### Key interactions

- **Declaring a traslado with a destination**: `declararEgreso` in `App.tsx` updates two beds atomically in a single `setBeds` call — the source bed becomes `egreso`, and the destination bed receives `asignacion: { origen: 'traslado_interno' }` automatically.
- **Completing a cycle** (`completarCiclo`): if the bed has an `asignacion`, status becomes `ocupada`; otherwise `libre`. Only available to UGP once `pase === 'paciente_en_cama'`.
- **Cama bloqueada**: clears egreso and asignacion; only UGP can unblock.
- **`caso_entregado`**: independent toggle shown in `BedDetail` during egreso — does not affect phase progression.

### App.tsx callbacks

| Callback | Who uses it | Effect |
|---|---|---|
| `declararEgreso` | Clínico | Sets source to egreso; auto-assigns destination on traslado |
| `avanzarPase` | Both (role-gated) | Advances `egreso.pase` to the next step |
| `toggleCasoEntregado` | Both | Toggles `egreso.caso_entregado` flag |
| `asignarPaciente` | UGP | Sets `bed.asignacion` (with optional `nota`) |
| `quitarAsignacion` | UGP | Clears `bed.asignacion` |
| `cancelarAlta` | Both | Reverts egreso bed to ocupada |
| `completarCiclo` | UGP | Ends egreso: libre or ocupada depending on asignacion |
| `marcarLibre` | UGP | Forces bed to libre |
| `marcarOcupada` | UGP | Forces bed to ocupada |
| `setGenero` | Both | Updates `bed.genero` |
| `bloquearCama` | UGP | Sets bloqueada + motivo |
| `desbloquearCama` | UGP | Restores to libre |

### Component responsibilities

| Component | Role |
|---|---|
| `App.tsx` | All state, all action callbacks, service tab filtering, bottom nav (3 tabs) |
| `BedCard.tsx` | Compact grid card — calls `getEgresoStyle()` for color, pase-based progress bar, origen badge. Exports `elapsedShort`. |
| `BedDetail.tsx` | Bottom sheet — linear phase progression with single "next step" button (role-gated), `CasoEntregadoToggle` (parallel flag), `EgresoForm`, `BloqueoSection`, `AsignacionInline` as local sub-components |
| `AsignacionSheet.tsx` | Shared overlay for selecting patient origin + optional nota (used from BedDetail and AsignacionView) |
| `AsignacionView.tsx` | UGP "Asignación" tab — lists unassigned and assigned beds sorted by urgency |
| `EstadoView.tsx` | "Estado de camas" tab — filterable list of all beds by status/pase; visible to both roles |
| `RoleSelector.tsx` | Initial role selection screen |

### Tabs and filters

**App tabs** (`AppTab`): `'camas'` · `'asignacion'` · `'estado'` — shared between both roles (UGP sees all three, clínico sees camas + estado).

**Camas filter** (`Filter`): `'todas'` · `'movimientos'` (egreso beds) · `'disponibles'` (libre) · `'bloqueadas'`

**Origen filter** (`OrigenFilter`): any `OrigenPaciente` value or `'sin_asignar'` (beds with egreso/libre status and no asignacion).

### Styling

Tailwind CSS v3. Color for egreso beds always comes from `getEgresoStyle()` in `types.ts` — never hardcode egreso colors in components.
