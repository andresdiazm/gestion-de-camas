# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, hot-reload)
npm run build      # tsc + vite build (production bundle + PWA assets)
npm run preview    # Serve production build locally
npx tsc --noEmit   # Type-check without building (run after every change)
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

- `Bed` — top-level entity. Fields: `id` (string, e.g. `"601-1"`), `status`, `genero` (`'M' | 'F'`), optional `egreso`, `bloqueo`, `asignacion`, `observaciones`.
- `asignacion` lives at **bed level**, not inside `EgresoData`. A libre or egreso bed can both have an incoming patient pre-assigned. `Asignacion` carries `origen`, `hora_asignacion`, and optional `nota`.
- `EgresoData` carries `tipo` (`alta` | `traslado`), a linear phase `pase: EgresoPase`, `hora_pase`, `hora_declaracion`, `caso_entregado` (independent boolean flag), optional `traslado_destino_*`, and **`pase_history`** — an ordered log of every phase transition: `Array<{ pase: EgresoPase; hora: string }>`. Initialized with `declarado` on `declararEgreso`; each `avanzarPase` call appends the new entry. Old records without `pase_history` fall back to `hora_declaracion` / `hora_pase` for the PDF report.
- `Observacion` — `{ texto, hora, rol }`. Accumulated in `bed.observaciones[]`, never overwritten. Both roles can add observations.
- `caso_entregado` is **not a sequential step** — it's a parallel flag either role can toggle at any point during an egreso.

### Egreso phase model (`EgresoPase`)

Linear 5-step enum:

```
declarado → cama_liberada → en_aseo → cama_lista → paciente_en_cama
```

**Both roles (Clínico and UGP) can advance all pases.** The only role distinction is that only UGP can assign incoming patients (`asignarPaciente` / `quitarAsignacion`).

| Pase | Display label |
|---|---|
| `declarado` | Alta declarada |
| `cama_liberada` | Cama liberada |
| `en_aseo` | En aseo |
| `cama_lista` | Cama disponible |
| `paciente_en_cama` | Paciente acostado |

`getEgresoStyle(egreso)` in `types.ts` is the **single source of truth** for egreso colors. Do not derive colors from pase values elsewhere.

### Egreso color palette

| Pase | Color |
|---|---|
| `declarado` | red-500 |
| `cama_liberada` | orange-400 |
| `en_aseo` | amber-400 |
| `cama_lista` | emerald-500 (same as libre) |
| `paciente_en_cama` | slate-600 |

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
- `migrateBed()` — handles backwards compatibility across all historical formats. Preserves `observaciones` and `pase_history`.

**Always update `migrateBed` when adding new fields to `Bed` or `EgresoData`.**

### Roles

- **Clínico and UGP**: identical capabilities — declare alta/traslado, mark libre/ocupada/bloqueada, cancel egreso, toggle `caso_entregado`, add observations.
- **UGP only**: assign / remove incoming patient (`asignarPaciente`, `quitarAsignacion`). The `AsignacionSheet` is only reachable by UGP.
- **Phase advancement** (pase transitions + `completarCiclo`): kanban only — via drag-and-drop or ◀▶ buttons in `EstadoView`. Not available from `BedDetail`.

### Key interactions

- **Declaring a traslado with a destination**: `declararEgreso` in `App.tsx` updates two beds atomically — the source becomes `egreso`, the destination receives `asignacion: { origen: 'traslado_interno' }` automatically.
- **Completing a cycle** (`completarCiclo`): triggered from the kanban ▶ button on the last column (`paciente_en_cama`). If the bed has an `asignacion`, status becomes `ocupada`; otherwise `libre`.
- **Cama bloqueada**: clears egreso and asignacion.
- **Traslado interno bed picker** (`AsignacionSheet`): when `traslado_interno` is selected, shows only beds with `egreso.tipo === 'traslado'` as selectable sources.

### App.tsx callbacks

| Callback | Effect |
|---|---|
| `declararEgreso` | Sets source to egreso; initializes `pase_history`; auto-assigns destination on traslado |
| `avanzarPase` | Advances `egreso.pase`; appends to `pase_history` |
| `toggleCasoEntregado` | Toggles `egreso.caso_entregado` flag |
| `asignarPaciente` | Sets `bed.asignacion` — **UGP only** |
| `quitarAsignacion` | Clears `bed.asignacion` — **UGP only** |
| `cancelarAlta` | Reverts egreso bed to ocupada |
| `completarCiclo` | Ends egreso: libre or ocupada depending on asignacion |
| `marcarLibre` | Forces bed to libre |
| `marcarOcupada` | Forces bed to ocupada |
| `setGenero` | Updates `bed.genero` |
| `bloquearCama` | Sets bloqueada + motivo |
| `desbloquearCama` | Restores to libre |
| `agregarObservacion` | Appends `Observacion` to `bed.observaciones[]` |

### Component responsibilities

| Component | Role |
|---|---|
| `App.tsx` | All state, all callbacks, service tab filtering, bottom nav (2 tabs + FAB). Inline: `BedPickerSheet`, `GlosarioSheet`, `generateReport` |
| `BedCard.tsx` | Compact grid card — color from `getEgresoStyle()`, shows pase label text. Exports `elapsedShort`. |
| `BedDetail.tsx` | Bottom sheet. Accepts `simplified` prop — see below. Sub-components: `CasoEntregadoToggle`, `EgresoForm`, `BloqueoSection`, `AsignacionInline`, `ObservacionesSection`, `PaseProgress`. |
| `AsignacionSheet.tsx` | Overlay for selecting patient origin + optional nota. When `traslado_interno`: shows bed picker filtered to traslado-only sources. Requires `allBeds` prop. |
| `EstadoView.tsx` | **Kanban board** — 5 columns; libre beds in column 3 ("Disponible"); ocupada/bloqueada hidden. Drag-and-drop + ◀▶ buttons. ▶ on last column calls `completarCiclo`. |
| `RoleSelector.tsx` | Initial role selection screen |

### BedDetail `simplified` prop

`BedDetail` has two modes controlled by `simplified: boolean` (default `false`). App.tsx tracks `selectedSource: 'camas' | 'estado'` to decide which to pass.

| Mode | Source | Shows |
|---|---|---|
| `simplified = true` | Camas tab / FAB | Declare alta/traslado (ocupada), `CasoEntregadoToggle` (egreso), `AsignacionInline` (UGP), `ObservacionesSection`, status info |
| `simplified = false` | Estado tab card click | All management actions: desbloquear, marcarLibre/Ocupada, bloquear, cancelarAlta. **No** pase-advance buttons (those are kanban-only). |

### Navigation

**App tabs** (`AppTab`): `'camas'` · `'estado'` — same for both roles.

**Header buttons** (top-right): PDF report (`generateReport`) · glosario (`GlosarioSheet`) · role selector.

**FAB (`+` button)**: center of bottom nav. Opens `BedPickerSheet` — a search-by-ID sheet that filters all beds in real time and opens `BedDetail` in simplified mode.

**Camas filter** (`Filter`): `'todas'` · `'movimientos'` (egreso) · `'disponibles'` (libre) · `'bloqueadas'`

### Kanban (EstadoView)

Columns (left → right, matching `PASE_ORDER`):

| Index | Column label | Color | Contents |
|---|---|---|---|
| 0 | Alta declarada | red-500 | egreso pase=declarado |
| 1 | Cama liberada | orange-400 | egreso pase=cama_liberada |
| 2 | En aseo | amber-400 | egreso pase=en_aseo |
| 3 | Disponible | emerald-500 | egreso pase=cama_lista **+ libre beds** |
| 4 | Paciente acostado | slate-600 | egreso pase=paciente_en_cama |

Column index maps 1:1 to `PASE_ORDER` index. ▶ on column 4 calls `onCompletarCiclo` instead of advancing a pase.

### PDF report (`generateReport` in App.tsx)

Generates an HTML document and triggers `window.print()` (A4 landscape). Covers all beds across both services (not filtered by current tab). Sections: resumen (counts), camas en movimiento (table with one row per bed and a column per phase timestamp), disponibles, bloqueadas, observaciones.

Phase timestamps come from `egreso.pase_history`; falls back to `hora_declaracion` / `hora_pase` for beds that predate the field. The active pase column is bold in the phase's color; past phases in grey; pending as `—`.

### Styling

Tailwind CSS v3. Color for egreso beds always comes from `getEgresoStyle()` in `types.ts` — never hardcode egreso colors in components.
