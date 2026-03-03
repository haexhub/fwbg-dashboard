# Optimization-Tab & Grid-Umbau Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-asset-class grid configuration with a global, exit-strategy-centric system. Create a new Optimization tab in the strategy editor.

**Architecture:** `exit_params` values become arrays (one entry = fixed, multiple = grid search). The `grids` field is removed entirely. A new `optimization` section holds CT, regime_filter_grid, and min_rrr. `exit_modifier_params_grid` and `model_hyperparameters_grid` move from GridConfig into the `optimization` section.

**Tech Stack:** Python (fwbg core), Nuxt 4 / Vue 3 (fwbg-dashboard), JSON strategy configs

**Repos:**
- Backend: `/home/haex/Projekte/fwbg`
- Frontend: `/home/haex/Projekte/fwbg-dashboard`

---

## Phase 1: Backend Config Refactor

### Task 1: Add OptimizationConfig dataclass

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/core/config.py`

**Step 1: Write OptimizationConfig**

Add after `RegimeFilterGridConfig` (line 76):

```python
@dataclass
class OptimizationConfig:
    """Global optimization parameters for grid search."""

    ct: list[float] = field(default_factory=lambda: [0.5])
    long_ct: list[float] | None = None
    short_ct: list[float] | None = None
    min_rrr: float | None = None
    regime_filter_grid: RegimeFilterGridConfig = field(
        default_factory=RegimeFilterGridConfig
    )
    exit_modifier_params_grid: list[dict] | None = None
    model_hyperparameters_grid: list[dict] | None = None

    @classmethod
    def from_dict(cls, data: dict | None) -> "OptimizationConfig":
        if not data:
            return cls()
        rfg = data.get("regime_filter_grid")
        regime = (
            RegimeFilterGridConfig.from_dict(rfg)
            if rfg
            else RegimeFilterGridConfig()
        )
        ct = data.get("ct", [0.5])
        if isinstance(ct, (int, float)):
            ct = [ct]

        long_ct = data.get("long_ct")
        if isinstance(long_ct, (int, float)):
            long_ct = [long_ct]

        short_ct = data.get("short_ct")
        if isinstance(short_ct, (int, float)):
            short_ct = [short_ct]

        emp = data.get("exit_modifier_params_grid")
        if isinstance(emp, dict):
            emp = [emp]

        mhg = data.get("model_hyperparameters_grid")
        if isinstance(mhg, dict):
            mhg = [mhg]

        return cls(
            ct=ct,
            long_ct=long_ct,
            short_ct=short_ct,
            min_rrr=data.get("min_rrr"),
            regime_filter_grid=regime,
            exit_modifier_params_grid=emp,
            model_hyperparameters_grid=mhg,
        )
```

**Step 2: Run existing tests to verify no breakage**

```bash
cd /home/haex/Projekte/fwbg && python -m pytest tests/test_config_presets.py -v --tb=short
```

**Step 3: Commit**

```bash
git add src/fwbg/core/config.py
git commit -m "feat: add OptimizationConfig dataclass"
```

---

### Task 2: Update StrategyConfig — remove grids, add optimization, update exit_params

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/core/config.py`

**Step 1: Update StrategyConfig fields**

In `StrategyConfig` dataclass (line ~478):

- Remove `grids: Dict[str, GridConfig]` field
- Change `exit_params: Dict[str, Any]` → `exit_params: Dict[str, list]`
- Add `optimization: OptimizationConfig` field
- Remove `get_grid()` method (lines 581-592)

```python
@dataclass
class StrategyConfig:
    name: str
    pipeline: dict
    exit_strategy: str
    exit_params: dict[str, list]  # Changed: values are always lists
    model: dict
    validation: dict
    filters: dict
    resources: dict
    optimization: OptimizationConfig = field(default_factory=OptimizationConfig)  # New
    exit_modifier: str | None = None
    exit_modifier_params: dict | None = None
    risk_management: str | None = None
    risk_params: dict | None = None
    assets: dict | None = None
    regime_filter: str | None = None
    datasource: str | None = None
    timeframe: str | None = None
    description: str = ""
    tags: list[str] = field(default_factory=list)
    hypothesis: str = ""
    expected_outcome: str = ""
    # grids field REMOVED
```

**Step 2: Add helper to normalize exit_params values to lists**

```python
def _normalize_exit_params(params: dict) -> dict[str, list]:
    """Convert all exit_params values to lists. Scalar → [scalar]."""
    result = {}
    for key, value in params.items():
        if isinstance(value, list):
            result[key] = value
        else:
            result[key] = [value]
    return result
```

**Step 3: Update `from_dict()` (lines 532-571)**

Replace the grids resolution with optimization parsing. Remove `_parse_grids()` call. Add `_normalize_exit_params()` call.

```python
@classmethod
def from_dict(cls, data: dict, strategy_dir: str | None = None) -> "StrategyConfig":
    # Resolve string preset references
    if strategy_dir:
        for key in ("pipeline", "exit_params", "model", "validation",
                     "filters", "resources", "risk_params"):
            if key in data:
                data[key] = _resolve_section(data[key], key, strategy_dir)

    # Normalize exit_params to arrays
    exit_params = _normalize_exit_params(data.get("exit_params", {}))

    # Parse optimization
    optimization = OptimizationConfig.from_dict(data.get("optimization"))

    return cls(
        name=data.get("name", ""),
        pipeline=data.get("pipeline", {}),
        exit_strategy=data.get("exit_strategy", ""),
        exit_params=exit_params,
        model=data.get("model", {}),
        validation=data.get("validation", {}),
        filters=data.get("filters", {}),
        resources=data.get("resources", {}),
        optimization=optimization,
        exit_modifier=data.get("exit_modifier"),
        exit_modifier_params=data.get("exit_modifier_params"),
        risk_management=data.get("risk_management"),
        risk_params=data.get("risk_params"),
        assets=data.get("assets"),
        regime_filter=data.get("regime_filter"),
        datasource=data.get("datasource"),
        timeframe=data.get("timeframe"),
        description=data.get("description", ""),
        tags=data.get("tags", []),
        hypothesis=data.get("hypothesis", ""),
        expected_outcome=data.get("expected_outcome", ""),
    )
```

**Step 4: Remove get_grid() method** (lines 581-592)

Delete entirely. Also remove `get_indicators()` indicator_overrides merge logic that references grid (lines 609-631) — indicators should use their own params from the pipeline config directly.

**Step 5: Commit**

```bash
git add src/fwbg/core/config.py
git commit -m "refactor: remove grids from StrategyConfig, add optimization"
```

---

### Task 3: Remove GridConfig and _parse_grids

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/core/config.py`

**Step 1: Remove GridConfig dataclass** (lines 79-197)

Delete the entire `GridConfig` class.

**Step 2: Remove _parse_grids() function** (lines 412-474)

Delete entirely.

**Step 3: Remove _load_json_preset() if only used by _parse_grids**

Check if `_load_json_preset()` is used elsewhere. If only used by `_parse_grids()`, remove it too.

**Step 4: Clean up imports**

Remove any imports that are no longer needed after removing GridConfig.

**Step 5: Run tests (expect failures — we'll fix tests later)**

```bash
cd /home/haex/Projekte/fwbg && python -m pytest tests/test_config_presets.py -v --tb=short 2>&1 | head -50
```

Note failures for Phase 8.

**Step 6: Commit**

```bash
git add src/fwbg/core/config.py
git commit -m "refactor: remove GridConfig and _parse_grids"
```

---

## Phase 2: Backend Integration

### Task 4: Update SimulationContext.create()

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/core/context.py`

**Step 1: Update create() to use exit_params + optimization**

Current code (line 157): `grid = strategy.get_grid(asset.symbol, asset.asset_class)`

Replace with direct access to strategy.exit_params and strategy.optimization:

```python
@classmethod
def create(cls, asset, strategy) -> "SimulationContext":
    # Grid values from exit_params (arrays)
    ep = strategy.exit_params

    # TP/SL from exit_params — use tp_mult/sl_mult keys, fall back to tp/sl
    grid_tp = ep.get("tp_mult", ep.get("tp", [1.0, 1.5, 2.0, 2.5]))
    grid_sl = ep.get("sl_mult", ep.get("sl", [1.0, 1.5, 2.0]))
    grid_timeout = ep.get("timeout_bars", [None])

    # Long/Short overrides from exit_params prefixes
    long_tp = ep.get("long_tp_mult", ep.get("long_tp"))
    long_sl = ep.get("long_sl_mult", ep.get("long_sl"))
    short_tp = ep.get("short_tp_mult", ep.get("short_tp"))
    short_sl = ep.get("short_sl_mult", ep.get("short_sl"))

    separate = any([long_tp, long_sl, short_tp, short_sl])

    # CT, regime from optimization
    opt = strategy.optimization
    grid_ct = opt.ct
    long_ct = opt.long_ct
    short_ct = opt.short_ct
    regime = opt.regime_filter_grid

    # Exit modifier params grid from optimization
    grid_exit_modifier_params = opt.exit_modifier_params_grid
    grid_model_hyperparameters = opt.model_hyperparameters_grid

    # ... rest of context creation, using the extracted values above
```

**Step 2: Remove all references to `strategy.get_grid()`**

Replace any remaining `grid.xxx` references with the extracted variables.

**Step 3: Update total_grid_combinations()** (lines 291-306)

This should still work since it reads from self.grid_tp/grid_sl etc. — just verify field names match.

**Step 4: Commit**

```bash
git add src/fwbg/core/context.py
git commit -m "refactor: SimulationContext uses exit_params + optimization"
```

---

### Task 5: Update process.py

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/optimization/process.py`

**Step 1: Remove grid = strategy.get_grid() call** (line 149)

Delete `grid = strategy.get_grid(sym, asset.asset_class)`.

**Step 2: Remove indicator_overrides from grid** (line 181)

`indicator_overrides=grid.indicator_overrides` → remove this parameter or pass empty dict.

Indicators now get their params from the pipeline config, not from per-asset grid overrides.

**Step 3: Remove grid.exit_modifier_params_grid / grid.model_hyperparameters_grid usage** (lines 238-241)

These now come from `strategy.optimization` and are already handled in SimulationContext.create().

**Step 4: Commit**

```bash
git add src/fwbg/optimization/process.py
git commit -m "refactor: remove per-asset grid lookup from process.py"
```

---

### Task 6: Update grid_search.py

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/optimization/grid_search.py`

**Step 1: Verify _build_combo_tuples() works with new context**

`_build_combo_tuples()` (line 244) already iterates over `ctx.grid_tp`, `ctx.grid_sl`, etc. Since SimulationContext fields are still named the same, this should work without changes.

Verify that `grid.tp` / `grid.sl` references are actually `ctx.grid_tp` / `ctx.grid_sl` — they should be since the function takes `ctx` as parameter.

**Step 2: Check for any GridConfig imports**

Remove any `from fwbg.core.config import GridConfig` imports.

**Step 3: Commit (if changes needed)**

```bash
git add src/fwbg/optimization/grid_search.py
git commit -m "refactor: remove GridConfig references from grid_search"
```

---

## Phase 3: Backend API

### Task 7: Clean up strategies.py

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/api/strategies.py`

**Step 1: Remove _serialize_grid()** (lines 24-48)

Delete the entire function.

**Step 2: Remove grid resolution from get_strategy()** (lines 99-125)

Remove the `grids_raw` parsing, `_parse_grids()` call, and grid serialization. Remove `grids` from refs tracking.

Updated `get_strategy()`:

```python
@router.get("/{name}")
def get_strategy(name: str) -> dict:
    strategies_dir = get_strategies_dir()
    filepath = strategies_dir / f"{name}.json"

    if not filepath.exists():
        raise HTTPException(404, f"Strategy not found: {name}")

    try:
        data = json.loads(filepath.read_text())
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Invalid JSON in strategy file: {e}")

    # Extract preset refs BEFORE resolving
    refs: dict = {}
    _simple_sections = ["pipeline", "exit_params", "model", "validation", "filters", "resources", "risk_params"]
    for key in _simple_sections:
        if key in data and isinstance(data[key], str):
            refs[key] = data[key]

    # Resolve string preset references to inline dicts
    strategy_dir = str(filepath.parent.resolve())
    for key, section_dir in SECTION_FIELD_DIRS.items():
        if key in data:
            data[key] = _resolve_section(data[key], section_dir, strategy_dir)

    data["_refs"] = refs
    return data
```

**Step 3: Remove _parse_grids import**

Remove `from fwbg.core.config import _parse_grids` from imports (line 8).

**Step 4: Commit**

```bash
git add src/fwbg/api/strategies.py
git commit -m "refactor: remove grid serialization from strategies API"
```

---

### Task 8: Update presets.py

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/api/presets.py`

**Step 1: Remove "grids" from SECTION_DIRS** (line 27)

Remove the `"grids": "grids"` entry. Grid presets are no longer used. Keep `"regime_filters"` since it's still used in optimization.

**Step 2: Update migrate_strategy_refs()**

Remove the entire "Grid assignments" section (lines 242-264) that handles grid preset ref migration.

**Step 3: Commit**

```bash
git add src/fwbg/api/presets.py
git commit -m "refactor: remove grids from preset sections"
```

---

## Phase 4: Strategy Config Migration

### Task 9: Write migration script

**Files:**
- Create: `/home/haex/Projekte/fwbg/scripts/migrate_to_optimization.py`

This script converts all existing strategy configs from the old format to the new format.

**Step 1: Write the migration script**

```python
#!/usr/bin/env python3
"""Migrate strategy configs from per-asset grids to global exit_params arrays + optimization.

Reads each strategy JSON, resolves grid presets, merges grid values into exit_params,
creates optimization section, removes grids field, writes back.
"""
import json
import sys
from pathlib import Path

STRATEGIES_DIR = Path(__file__).parent.parent / "strategies"
CONFIGS_DIR = STRATEGIES_DIR / "configs"
GRIDS_DIR = STRATEGIES_DIR / "grids"
EXIT_PARAMS_DIR = STRATEGIES_DIR / "exit_params"
REGIME_FILTERS_DIR = STRATEGIES_DIR / "regime_filters"


def load_preset(directory: Path, name: str) -> dict:
    """Load a preset file, stripping _meta."""
    filepath = directory / f"{name}.json"
    if not filepath.exists():
        # Try without _v suffix
        matches = sorted(directory.glob(f"{name}*.json"))
        if matches:
            filepath = matches[-1]
        else:
            print(f"  WARNING: Preset not found: {directory}/{name}.json")
            return {}
    data = json.loads(filepath.read_text())
    data.pop("_meta", None)
    return data


def resolve_grid_assignment(assignment, grids_dir: Path) -> dict:
    """Resolve a grid assignment (string or dict with preset) to a flat dict."""
    if isinstance(assignment, str):
        return load_preset(grids_dir, assignment)
    elif isinstance(assignment, dict):
        if "preset" in assignment:
            base = load_preset(grids_dir, assignment["preset"])
            overrides = {k: v for k, v in assignment.items() if k != "preset"}
            base.update(overrides)
            return base
        return assignment
    return {}


def ensure_list(value):
    """Convert scalar to single-element list."""
    if value is None:
        return [None]
    if isinstance(value, list):
        return value
    return [value]


def migrate_strategy(filepath: Path) -> bool:
    """Migrate a single strategy config. Returns True if modified."""
    data = json.loads(filepath.read_text())

    if "optimization" in data and "grids" not in data:
        print(f"  SKIP (already migrated): {filepath.name}")
        return False

    # 1. Resolve exit_params (might be a preset string)
    exit_params_raw = data.get("exit_params", {})
    if isinstance(exit_params_raw, str):
        exit_params = load_preset(EXIT_PARAMS_DIR, exit_params_raw)
    else:
        exit_params = dict(exit_params_raw)

    # 2. Resolve grids — pick the FIRST assignment as representative
    #    (since we're going global, merge all unique values)
    grids_raw = data.get("grids", {})
    merged_grid = {}

    if isinstance(grids_raw, dict):
        assignments = grids_raw.get("assignments", {})
        for asset_class, assignment in assignments.items():
            resolved = resolve_grid_assignment(assignment, GRIDS_DIR)
            # Merge: union of all values across asset classes
            for key, value in resolved.items():
                if key in ("indicator_overrides", "required_features",
                           "model_hyperparameters"):
                    continue  # Skip per-asset fields
                if key not in merged_grid:
                    merged_grid[key] = value
                elif isinstance(value, list) and isinstance(merged_grid[key], list):
                    # Union of values, preserve order
                    existing = set(str(v) for v in merged_grid[key])
                    for v in value:
                        if str(v) not in existing:
                            merged_grid[key].append(v)

    # 3. Build new exit_params (all values as arrays)
    new_exit_params = {}

    # Start with exit_params from preset
    for key, value in exit_params.items():
        new_exit_params[key] = ensure_list(value)

    # Merge grid tp/sl into exit_params as tp_mult/sl_mult
    if "tp" in merged_grid:
        tp_values = merged_grid.pop("tp")
        new_exit_params["tp_mult"] = ensure_list(tp_values)
    if "sl" in merged_grid:
        sl_values = merged_grid.pop("sl")
        new_exit_params["sl_mult"] = ensure_list(sl_values)

    # Long/short overrides from grid
    for prefix in ("long_", "short_"):
        for param in ("tp", "sl"):
            key = f"{prefix}{param}"
            if key in merged_grid:
                new_exit_params[f"{prefix}{param}_mult"] = ensure_list(merged_grid.pop(key))

    # Timeout from grid → exit_params
    if "timeout_bars" in merged_grid:
        new_exit_params["timeout_bars"] = ensure_list(merged_grid.pop("timeout_bars"))

    # 4. Build optimization section
    optimization = {}

    # CT from grid
    if "ct" in merged_grid:
        optimization["ct"] = ensure_list(merged_grid.pop("ct"))
    if "long_ct" in merged_grid:
        optimization["long_ct"] = ensure_list(merged_grid.pop("long_ct"))
    if "short_ct" in merged_grid:
        optimization["short_ct"] = ensure_list(merged_grid.pop("short_ct"))

    # Regime filter from grids (strategy-level)
    regime_raw = grids_raw.get("regime_filter_grid") if isinstance(grids_raw, dict) else None
    if regime_raw:
        if isinstance(regime_raw, str):
            regime_data = load_preset(REGIME_FILTERS_DIR, regime_raw)
            optimization["regime_filter_grid"] = regime_data
        else:
            optimization["regime_filter_grid"] = regime_raw

    # Exit modifier params grid from grid
    if "exit_modifier_params_grid" in merged_grid:
        emp = merged_grid.pop("exit_modifier_params_grid")
        if emp:
            optimization["exit_modifier_params_grid"] = emp

    # Model hyperparameters grid from grid
    if "model_hyperparameters_grid" in merged_grid:
        mhg = merged_grid.pop("model_hyperparameters_grid")
        if mhg:
            optimization["model_hyperparameters_grid"] = mhg

    # 5. Update strategy data
    data["exit_params"] = new_exit_params
    if optimization:
        data["optimization"] = optimization

    # Remove grids
    data.pop("grids", None)

    # Remove per-asset indicator_overrides, model_hyperparameters, required_features
    # (these were in GridConfig but are no longer supported)

    # 6. Write back
    filepath.write_text(json.dumps(data, indent=2) + "\n")
    print(f"  MIGRATED: {filepath.name}")
    return True


def main():
    print("Migrating strategy configs...")
    migrated = 0
    for f in sorted(CONFIGS_DIR.glob("*.json")):
        try:
            if migrate_strategy(f):
                migrated += 1
        except Exception as e:
            print(f"  ERROR: {f.name}: {e}")

    print(f"\nDone. Migrated {migrated} files.")


if __name__ == "__main__":
    main()
```

**Step 2: Run migration (dry-run first — review output)**

```bash
cd /home/haex/Projekte/fwbg && python scripts/migrate_to_optimization.py
```

**Step 3: Review migrated files**

Spot-check 2-3 migrated strategy configs to verify:
- `exit_params` has all values as arrays
- `optimization` has ct, regime_filter_grid, etc.
- `grids` field is removed
- No data was lost

**Step 4: Migrate exit_params presets to array format**

The exit_params preset files (in `strategies/exit_params/`) still have scalar values. Update them to use arrays since `_normalize_exit_params()` handles this in code, but the presets should match the new convention.

```bash
cd /home/haex/Projekte/fwbg
for f in strategies/exit_params/*.json; do
  python -c "
import json, sys
data = json.loads(open('$f').read())
meta = data.pop('_meta', None)
for k, v in list(data.items()):
    if not isinstance(v, list):
        data[k] = [v]
if meta:
    data = {'_meta': meta, **data}
open('$f', 'w').write(json.dumps(data, indent=2) + '\n')
print(f'Updated: $f')
"
done
```

**Step 5: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add scripts/migrate_to_optimization.py strategies/configs/ strategies/exit_params/
git commit -m "feat: migrate strategy configs to exit_params arrays + optimization"
```

---

## Phase 5: Frontend Types & Store

### Task 10: Update StrategyConfig type

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/types/strategy.ts:127-171`

**Step 1: Update StrategyConfig interface**

```typescript
export interface StrategyConfig {
  _refs?: import("~/types/preset").StrategyRefs;
  name: string;
  description?: string;
  tags?: string[];
  hypothesis?: string;
  expected_outcome?: string;
  datasource?: string;
  timeframe?: string;
  pipeline: {
    indicators?: PipelineEntry[];
    preprocessing?: PipelineEntry[];
    feature_selection?: PipelineEntry[];
    data_loading?: PipelineEntry[];
  };
  exit_strategy: string;
  exit_params: Record<string, unknown[]>;  // Values are always arrays
  risk_management?: string;
  risk_params?: Record<string, unknown>;
  model: {
    type: string;
    architecture: string;
    trade_directions: string[];
    hyperparameters: Record<string, unknown>;
  };
  // grids REMOVED
  optimization?: {
    ct?: number[];
    long_ct?: number[];
    short_ct?: number[];
    min_rrr?: number;
    regime_filter_grid?: {
      condition_grids: Array<{
        column: string;
        operator: string;
        values: (number | null)[];
        directions: number;
        else_directions: number;
      }>;
    };
    exit_modifier_params_grid?: Record<string, unknown>[];
    model_hyperparameters_grid?: Record<string, unknown>[];
  };
  assets?: {
    filter?: string[];
    exclude?: string[];
  };
  validation: Record<string, unknown>;
  filters: Record<string, unknown>;
  resources: Record<string, unknown>;
}
```

**Step 2: Remove GridEntry type from grids.vue** (lines 89-109)

This type will no longer be needed after the grids.vue simplification.

**Step 3: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add types/strategy.ts
git commit -m "refactor: update StrategyConfig type, remove grids, add optimization"
```

---

### Task 11: Clean up strategyConfig.ts store

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/stores/strategyConfig.ts`

**Step 1: Remove grid-related code**

- Remove `GRID_OVERRIDE_KEYS` (line 9)
- Remove `computeGridOverrides()` (lines 12-24)
- Remove grid reconstruction from `buildSavePayload()` (lines 48-68) — keep only simple section refs
- Remove `applyGridPreset()` (lines 252-264)
- Remove `detachGridPreset()` (lines 269-273)
- Remove `applyRegimeFilterPreset()` if it exists

**Step 2: Simplify buildSavePayload()**

```typescript
function buildSavePayload(config: StrategyConfig): Record<string, unknown> {
  const refs: StrategyRefs = config._refs ?? {};
  const { _refs: _unusedRefs, ...base } = config as unknown as Record<string, unknown>;
  void _unusedRefs;
  const payload = { ...base } as Record<string, unknown>;

  // Simple section refs: replace inline object with string ref
  const simpleSections = [
    "pipeline", "model", "exit_params", "validation",
    "filters", "resources", "risk_params",
  ] as const;
  for (const key of simpleSections) {
    const ref = refs[key as keyof typeof refs] as string | undefined;
    if (ref) payload[key] = ref;
  }

  // No grid reconstruction needed — grids field removed

  return payload;
}
```

**Step 3: Remove applyGridPreset/detachGridPreset from store return**

Remove these from the returned store object and any exports.

**Step 4: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add stores/strategyConfig.ts
git commit -m "refactor: remove grid preset logic from strategy store"
```

---

### Task 12: Update StrategyRefs type

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/types/preset.ts` (or wherever StrategyRefs is defined)

**Step 1: Remove grids-related ref types**

Remove `grids` and `grids_regime_filter` from `StrategyRefs`. These were used to track per-asset grid preset references.

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add types/preset.ts
git commit -m "refactor: remove grid refs from StrategyRefs type"
```

---

## Phase 6: Frontend Optimization Tab

### Task 13: Create optimization.vue page

**Files:**
- Create: `/home/haex/Projekte/fwbg-dashboard/pages/strategy/[name]/optimization.vue`

This tab contains:
1. **Exit Strategy Grid** — Shows exit_params as editable value lists (badges + add input)
2. **Confidence Threshold** — CT value list from optimization.ct
3. **Regime Filter Grid** — Condition grids editor (moved from grids.vue)
4. **Constraints** — min_rrr input
5. **Exit Modifier Grid** — exit_modifier_params_grid entries (if present)
6. **Model Hyperparameters Grid** — model_hyperparameters_grid entries (if present)

**Step 1: Create the optimization.vue page**

```vue
<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);

const pluginStore = usePluginStore();
const { plugins } = storeToRefs(pluginStore);
pluginStore.load();

// Ensure optimization exists
watch(config, (c) => {
  if (c && !c.optimization) {
    c.optimization = { ct: [0.5] };
  }
}, { immediate: true });

// Exit strategy plugin info (for param schema)
const exitPluginInfo = computed(() => {
  if (!config.value?.exit_strategy || !plugins.value) return null;
  return plugins.value.find(
    (p) => p.name === config.value!.exit_strategy || p.fqn.endsWith(`:${config.value!.exit_strategy}`)
  ) ?? null;
});

// Parameter schema for exit strategy
const exitParamSchema = computed(() => exitPluginInfo.value?.param_schema ?? {});

// Editable exit param keys (from schema)
const exitParamKeys = computed(() => Object.keys(exitParamSchema.value));

// ── Value list helpers ──────────────────────────────────────────────────────
const newValues = ref<Record<string, string>>({});

function addValue(key: string, target: Record<string, unknown[]>) {
  const raw = newValues.value[key]?.trim();
  if (!raw) return;
  const parsed = raw === "null" ? null : Number(raw);
  if (parsed !== null && isNaN(parsed)) return;
  if (!target[key]) target[key] = [];
  target[key].push(parsed);
  newValues.value[key] = "";
}

function removeValue(key: string, index: number, target: Record<string, unknown[]>) {
  target[key]?.splice(index, 1);
}

// ── Long/Short prefix helpers ───────────────────────────────────────────────
const showLongShort = computed(() =>
  config.value?.model?.architecture === "long_short_separate"
);

// ── Regime Filter Grid ──────────────────────────────────────────────────────
type ConditionGrid = {
  column: string;
  operator: string;
  values: (number | null)[];
  directions: number;
  else_directions: number;
};

const OPERATORS = [">=", "<=", ">", "<", "==", "!="];
const newConditionValue = ref<Record<number, string>>({});

function addCondition() {
  if (!config.value?.optimization) return;
  if (!config.value.optimization.regime_filter_grid) {
    config.value.optimization.regime_filter_grid = { condition_grids: [] };
  }
  config.value.optimization.regime_filter_grid.condition_grids.push({
    column: "",
    operator: ">=",
    values: [],
    directions: 6,
    else_directions: 0,
  });
}

function removeCondition(index: number) {
  config.value?.optimization?.regime_filter_grid?.condition_grids.splice(index, 1);
}

function addConditionValue(ci: number) {
  const raw = newConditionValue.value[ci]?.trim();
  if (!raw) return;
  const parsed = raw === "null" ? null : Number(raw);
  if (parsed !== null && isNaN(parsed)) return;
  config.value?.optimization?.regime_filter_grid?.condition_grids[ci]?.values.push(parsed);
  newConditionValue.value[ci] = "";
}

function removeConditionValue(ci: number, vi: number) {
  config.value?.optimization?.regime_filter_grid?.condition_grids[ci]?.values.splice(vi, 1);
}

function removeRegimeFilterGrid() {
  if (config.value?.optimization) {
    config.value.optimization.regime_filter_grid = undefined;
  }
}

// ── Exit Modifier Params Grid ───────────────────────────────────────────────
function addExitModifierEntry() {
  if (!config.value?.optimization) return;
  if (!config.value.optimization.exit_modifier_params_grid) {
    config.value.optimization.exit_modifier_params_grid = [];
  }
  config.value.optimization.exit_modifier_params_grid.push({});
}

function removeExitModifierEntry(index: number) {
  config.value?.optimization?.exit_modifier_params_grid?.splice(index, 1);
}

// ── Grid Combinations Count ─────────────────────────────────────────────────
const gridCombinations = computed(() => {
  if (!config.value) return 0;
  const ep = config.value.exit_params ?? {};
  const opt = config.value.optimization ?? {};

  let combos = 1;
  for (const values of Object.values(ep)) {
    if (Array.isArray(values) && values.length > 0) combos *= values.length;
  }
  if (Array.isArray(opt.ct) && opt.ct.length > 0) combos *= opt.ct.length;
  if (opt.exit_modifier_params_grid?.length) combos *= opt.exit_modifier_params_grid.length;
  if (opt.model_hyperparameters_grid?.length) combos *= opt.model_hyperparameters_grid.length;
  if (opt.regime_filter_grid?.condition_grids?.length) {
    for (const cond of opt.regime_filter_grid.condition_grids) {
      if (cond.values.length > 0) combos *= cond.values.length;
    }
  }
  return combos;
});
</script>

<template>
  <div v-if="config" class="space-y-6 p-1">

    <!-- Grid Combinations Summary -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-medium text-white">Optimization</h2>
      <UBadge variant="subtle" color="info" size="lg">
        {{ gridCombinations.toLocaleString() }} Kombinationen
      </UBadge>
    </div>

    <!-- Exit Strategy Grid -->
    <UCard>
      <template #header>
        <div class="space-y-1">
          <h3 class="text-lg font-medium text-white">
            Exit-Strategie: {{ config.exit_strategy || '—' }}
          </h3>
          <p class="text-xs text-gray-500">
            Parameter als Wertelisten. Ein Eintrag = fester Wert, mehrere = Grid-Search.
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <div v-for="key in exitParamKeys" :key="key">
          <label class="block text-sm font-medium text-gray-300 mb-1">
            {{ key }}
            <span v-if="exitParamSchema[key]?.description" class="text-gray-500 font-normal">
              — {{ exitParamSchema[key].description }}
            </span>
          </label>
          <div class="flex flex-wrap gap-2 items-center">
            <UBadge
              v-for="(val, vi) in (config.exit_params[key] ?? [])"
              :key="vi"
              variant="subtle"
              color="neutral"
              size="md"
              class="cursor-pointer"
              @click="removeValue(key, vi, config.exit_params)"
            >
              {{ val === null ? 'null' : val }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
            </UBadge>
            <div class="flex gap-1">
              <UInput
                v-model="newValues[key]"
                :placeholder="exitParamSchema[key]?.step ? `Step: ${exitParamSchema[key].step}` : '+'"
                class="w-28"
                @keydown.enter="addValue(key, config.exit_params)"
              />
              <UButton variant="ghost" @click="addValue(key, config.exit_params)">+</UButton>
            </div>
          </div>
        </div>

        <!-- Long/Short overrides -->
        <template v-if="showLongShort">
          <UDivider label="Long/Short Overrides" />
          <p class="text-xs text-gray-500">
            Optional: Richtungsspezifische Werte überschreiben den Basis-Wert.
          </p>
          <div v-for="key in exitParamKeys" :key="`ls-${key}`" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-green-400 mb-1">long_{{ key }}</label>
              <div class="flex flex-wrap gap-1 items-center">
                <UBadge
                  v-for="(val, vi) in (config.exit_params[`long_${key}`] ?? [])"
                  :key="vi" variant="subtle" color="success" size="sm" class="cursor-pointer"
                  @click="removeValue(`long_${key}`, vi, config.exit_params)"
                >
                  {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                </UBadge>
                <div class="flex gap-1">
                  <UInput v-model="newValues[`long_${key}`]" placeholder="+" class="w-20"
                    @keydown.enter="addValue(`long_${key}`, config.exit_params)" />
                  <UButton size="xs" variant="ghost" @click="addValue(`long_${key}`, config.exit_params)">+</UButton>
                </div>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-red-400 mb-1">short_{{ key }}</label>
              <div class="flex flex-wrap gap-1 items-center">
                <UBadge
                  v-for="(val, vi) in (config.exit_params[`short_${key}`] ?? [])"
                  :key="vi" variant="subtle" color="error" size="sm" class="cursor-pointer"
                  @click="removeValue(`short_${key}`, vi, config.exit_params)"
                >
                  {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                </UBadge>
                <div class="flex gap-1">
                  <UInput v-model="newValues[`short_${key}`]" placeholder="+" class="w-20"
                    @keydown.enter="addValue(`short_${key}`, config.exit_params)" />
                  <UButton size="xs" variant="ghost" @click="addValue(`short_${key}`, config.exit_params)">+</UButton>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </UCard>

    <!-- Confidence Threshold -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-medium text-white">Confidence Threshold</h3>
      </template>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">CT</label>
          <div class="flex flex-wrap gap-2 items-center">
            <UBadge
              v-for="(val, vi) in (config.optimization?.ct ?? [])"
              :key="vi" variant="subtle" color="neutral" size="md" class="cursor-pointer"
              @click="config.optimization!.ct?.splice(vi, 1)"
            >
              {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
            </UBadge>
            <div class="flex gap-1">
              <UInput v-model="newValues['ct']" placeholder="0.50" class="w-28"
                @keydown.enter="() => { if (config.optimization) addValue('ct', config.optimization as any) }" />
              <UButton variant="ghost" @click="() => { if (config.optimization) addValue('ct', config.optimization as any) }">+</UButton>
            </div>
          </div>
        </div>

        <!-- Separate Long/Short CT -->
        <template v-if="showLongShort">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-green-400 mb-1">Long CT</label>
              <div class="flex flex-wrap gap-1 items-center">
                <UBadge
                  v-for="(val, vi) in (config.optimization?.long_ct ?? [])"
                  :key="vi" variant="subtle" color="success" size="sm" class="cursor-pointer"
                  @click="config.optimization!.long_ct?.splice(vi, 1)"
                >
                  {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                </UBadge>
                <div class="flex gap-1">
                  <UInput v-model="newValues['long_ct']" placeholder="+" class="w-20"
                    @keydown.enter="() => { if (config.optimization) addValue('long_ct', config.optimization as any) }" />
                  <UButton size="xs" variant="ghost"
                    @click="() => { if (config.optimization) addValue('long_ct', config.optimization as any) }">+</UButton>
                </div>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-red-400 mb-1">Short CT</label>
              <div class="flex flex-wrap gap-1 items-center">
                <UBadge
                  v-for="(val, vi) in (config.optimization?.short_ct ?? [])"
                  :key="vi" variant="subtle" color="error" size="sm" class="cursor-pointer"
                  @click="config.optimization!.short_ct?.splice(vi, 1)"
                >
                  {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                </UBadge>
                <div class="flex gap-1">
                  <UInput v-model="newValues['short_ct']" placeholder="+" class="w-20"
                    @keydown.enter="() => { if (config.optimization) addValue('short_ct', config.optimization as any) }" />
                  <UButton size="xs" variant="ghost"
                    @click="() => { if (config.optimization) addValue('short_ct', config.optimization as any) }">+</UButton>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </UCard>

    <!-- Constraints -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-medium text-white">Constraints</h3>
      </template>

      <UFormField label="Minimum Risk-Reward-Ratio" description="Filtert Grid-Kombinationen mit TP/SL < Schwelle">
        <UInput
          :model-value="config.optimization?.min_rrr ?? ''"
          type="number"
          step="0.1"
          placeholder="z.B. 1.0"
          class="w-40"
          @update:model-value="(v) => { if (config.optimization) config.optimization.min_rrr = v ? Number(v) : undefined }"
        />
      </UFormField>
    </UCard>

    <!-- Regime Filter Grid -->
    <UCard v-if="config.optimization?.regime_filter_grid">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-white">Regime Filter Grid</h3>
          <UButton icon="i-heroicons-trash" variant="ghost" color="error" @click="removeRegimeFilterGrid">
            Entfernen
          </UButton>
        </div>
      </template>

      <div class="space-y-3">
        <div
          v-for="(cond, ci) in config.optimization.regime_filter_grid.condition_grids"
          :key="ci"
          class="border border-gray-700 rounded-lg p-3 space-y-3"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-400">Bedingung {{ ci + 1 }}</span>
            <div class="flex-1" />
            <UButton icon="i-heroicons-trash" variant="ghost" color="error" @click="removeCondition(ci)" />
          </div>

          <div class="flex gap-2">
            <UInput v-model="cond.column" placeholder="Spalte (z.B. trend_adx_14)" class="flex-1" />
            <USelect v-model="cond.operator" :items="OPERATORS" class="w-24" />
          </div>

          <div>
            <p class="text-xs text-gray-500 mb-1">Werte</p>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge
                v-for="(val, vi) in cond.values"
                :key="vi" variant="subtle" color="neutral" size="md" class="cursor-pointer"
                @click="removeConditionValue(ci, vi)"
              >
                {{ val === null ? 'null' : val }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newConditionValue[ci]" placeholder="+ (oder 'null')" class="w-28" @keydown.enter="addConditionValue(ci)" />
                <UButton variant="ghost" @click="addConditionValue(ci)">+</UButton>
              </div>
            </div>
          </div>

          <div class="flex gap-3">
            <UFormField label="Richtungen" class="flex-1">
              <UInput v-model.number="cond.directions" type="number" class="w-full" />
            </UFormField>
            <UFormField label="Else-Richtungen" class="flex-1">
              <UInput v-model.number="cond.else_directions" type="number" class="w-full" />
            </UFormField>
          </div>
        </div>

        <UButton variant="soft" icon="i-heroicons-plus" @click="addCondition">
          Bedingung hinzufügen
        </UButton>
      </div>
    </UCard>
    <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addCondition">
      Regime Filter Grid hinzufügen
    </UButton>

    <!-- Exit Modifier Params Grid -->
    <UCard v-if="config.exit_modifier">
      <template #header>
        <h3 class="text-lg font-medium text-white">Exit Modifier Grid ({{ config.exit_modifier }})</h3>
      </template>

      <div class="space-y-3">
        <div
          v-for="(entry, ei) in (config.optimization?.exit_modifier_params_grid ?? [])"
          :key="ei"
          class="border border-gray-700 rounded-lg p-3"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-gray-400">Variante {{ ei + 1 }}</span>
            <div class="flex-1" />
            <UButton icon="i-heroicons-trash" variant="ghost" color="error" size="xs" @click="removeExitModifierEntry(ei)" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <UFormField v-for="(val, key) in entry" :key="key" :label="String(key)">
              <UInput
                :model-value="val"
                type="number"
                step="0.1"
                class="w-full"
                @update:model-value="(v) => (entry as any)[key] = Number(v)"
              />
            </UFormField>
          </div>
        </div>

        <UButton variant="soft" icon="i-heroicons-plus" @click="addExitModifierEntry">
          Variante hinzufügen
        </UButton>
      </div>
    </UCard>

  </div>
</template>
```

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add pages/strategy/\\[name\\]/optimization.vue
git commit -m "feat: add Optimization tab page"
```

---

### Task 14: Add Optimization tab to navigation

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/pages/strategy/[name].vue:114-122`

**Step 1: Add Optimization tab between Model and Assets**

```typescript
const tabs = [
  { label: "Übersicht", to: `/strategy/${strategyName.value}` },
  { label: "Pipeline", to: `/strategy/${strategyName.value}/pipeline` },
  { label: "Model", to: `/strategy/${strategyName.value}/model` },
  { label: "Optimization", to: `/strategy/${strategyName.value}/optimization` },
  { label: "Assets", to: `/strategy/${strategyName.value}/grids` },
  { label: "Validation", to: `/strategy/${strategyName.value}/validation` },
  { label: "Filters", to: `/strategy/${strategyName.value}/filters` },
  { label: "Resources", to: `/strategy/${strategyName.value}/resources` },
];
```

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add pages/strategy/\\[name\\].vue
git commit -m "feat: add Optimization tab to strategy navigation"
```

---

## Phase 7: Frontend Assets Tab Cleanup

### Task 15: Simplify grids.vue to assets-only

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/pages/strategy/[name]/grids.vue`

**Step 1: Remove everything except Datasource & Assets section**

The grids.vue page should only contain:
- Datasource selector
- Timeframe selector
- Asset filter (multi-select)
- Excluded assets (multi-select)

Remove:
- Grid preset selector bar (lines 421-430)
- Handelsparameter section (lines 432-710) — the entire asset class selector, TP/SL/CT/timeout badge editors
- Regime filter grid section (lines 715-791) — moved to optimization.vue
- All `GridEntry` type and grid-related computed properties
- `selectedClass`, `assetClasses`, `addClass`, `removeClass`, grid value manipulation functions
- All grid badge add/remove functions

Keep:
- `datasourceItems` computed
- `timeframeItems` computed
- `availableSymbols` computed
- `assetFilter` / `assetExclude` computed getters/setters
- The Datasource & Assets UCard (lines 360-419)
- The StrategyPresetSelectorBar for the page if it's used for a non-grid preset

The resulting page should be ~100-150 lines max.

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add pages/strategy/\\[name\\]/grids.vue
git commit -m "refactor: simplify Assets tab to datasource/timeframe/assets only"
```

---

## Phase 8: Backend Tests

### Task 16: Update test_config_presets.py

**Files:**
- Modify: `/home/haex/Projekte/fwbg/tests/test_config_presets.py`

**Step 1: Update TestStrategyWithPresets tests**

- `test_exit_params_string_ref` (line 151): Verify exit_params values are now arrays after resolution
- `TestBackwardCompatibility`: Update to expect arrays in exit_params
- Remove any GridConfig-related assertions

**Step 2: Add OptimizationConfig tests**

```python
class TestOptimizationConfig:
    def test_from_dict_empty(self):
        opt = OptimizationConfig.from_dict(None)
        assert opt.ct == [0.5]
        assert opt.min_rrr is None
        assert opt.regime_filter_grid.condition_grids == []

    def test_from_dict_with_values(self):
        opt = OptimizationConfig.from_dict({
            "ct": [0.50, 0.55, 0.60],
            "min_rrr": 1.0,
            "regime_filter_grid": {
                "condition_grids": [
                    {"column": "trend_adx_14", "operator": ">=", "values": [25]}
                ]
            }
        })
        assert opt.ct == [0.50, 0.55, 0.60]
        assert opt.min_rrr == 1.0
        assert len(opt.regime_filter_grid.condition_grids) == 1

    def test_scalar_ct_converted_to_list(self):
        opt = OptimizationConfig.from_dict({"ct": 0.55})
        assert opt.ct == [0.55]

    def test_long_short_ct(self):
        opt = OptimizationConfig.from_dict({
            "ct": [0.5],
            "long_ct": [0.55, 0.60],
            "short_ct": 0.50,
        })
        assert opt.long_ct == [0.55, 0.60]
        assert opt.short_ct == [0.50]
```

**Step 3: Add exit_params normalization tests**

```python
class TestNormalizeExitParams:
    def test_scalar_to_list(self):
        result = _normalize_exit_params({"atr_period": 14, "min_tp_pips": 8})
        assert result == {"atr_period": [14], "min_tp_pips": [8]}

    def test_list_unchanged(self):
        result = _normalize_exit_params({"tp_mult": [1.5, 2.0]})
        assert result == {"tp_mult": [1.5, 2.0]}

    def test_mixed(self):
        result = _normalize_exit_params({
            "tp_mult": [1.5, 2.0],
            "atr_period": 14,
        })
        assert result == {"tp_mult": [1.5, 2.0], "atr_period": [14]}
```

**Step 4: Run tests**

```bash
cd /home/haex/Projekte/fwbg && python -m pytest tests/test_config_presets.py -v
```

**Step 5: Commit**

```bash
git add tests/test_config_presets.py
git commit -m "test: update config preset tests for optimization refactor"
```

---

### Task 17: Update test_grid_presets.py

**Files:**
- Modify: `/home/haex/Projekte/fwbg/tests/test_grid_presets.py`

**Step 1: Remove or heavily refactor**

Most tests in this file test GridConfig, _parse_grids, and per-asset grid resolution — all removed. Options:
- Delete the entire file if all tests are now irrelevant
- Keep RegimeFilterGridConfig tests (TestRegimeFilterPresets) if regime filter resolution still happens in config.py

**Step 2: Run tests**

```bash
cd /home/haex/Projekte/fwbg && python -m pytest tests/test_grid_presets.py -v 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add tests/test_grid_presets.py
git commit -m "test: remove obsolete grid preset tests"
```

---

### Task 18: Fix remaining test failures

**Step 1: Run full test suite**

```bash
cd /home/haex/Projekte/fwbg && python -m pytest --tb=short 2>&1 | tail -40
```

**Step 2: Fix any import errors (GridConfig, _parse_grids, get_grid)**

Grep for remaining references:

```bash
cd /home/haex/Projekte/fwbg && grep -rn "GridConfig\|_parse_grids\|get_grid\|\.grids" src/ tests/ --include="*.py" | grep -v __pycache__ | grep -v ".pyc"
```

Fix each file:
- Remove imports of deleted classes/functions
- Update code that used `strategy.get_grid()` to use `strategy.exit_params` / `strategy.optimization`
- Update code that used `grid.indicator_overrides` to remove or use pipeline params

**Step 3: Run tests again until passing**

```bash
cd /home/haex/Projekte/fwbg && python -m pytest --tb=short
```

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve remaining test failures after grid removal"
```

---

## Phase 9: Frontend Cleanup & E2E Tests

### Task 19: Update frontend API proxy and tests

**Files:**
- Check: `/home/haex/Projekte/fwbg-dashboard/server/api/strategy/` — remove any grid-specific proxy endpoints
- Check: `/home/haex/Projekte/fwbg-dashboard/tests/e2e/strategy-api.spec.ts` — update assertions

**Step 1: Check for grid-specific API routes in dashboard**

```bash
cd /home/haex/Projekte/fwbg-dashboard && find server/api -name "*.ts" | xargs grep -l "grid" 2>/dev/null
```

Remove any endpoints that proxy grid preset operations if no longer needed.

**Step 2: Update e2e tests**

Review `tests/e2e/strategy-api.spec.ts` for assertions about `grids` field. Update to expect `optimization` and array-valued `exit_params`.

**Step 3: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add server/api/ tests/
git commit -m "test: update e2e tests for optimization refactor"
```

---

### Task 20: Verify full stack integration

**Step 1: Start backend**

```bash
cd /home/haex/Projekte/fwbg && .venv/bin/python -m fwbg.api.main
```

**Step 2: Start frontend**

```bash
cd /home/haex/Projekte/fwbg-dashboard && npx nuxt dev
```

**Step 3: Manual verification checklist**

- [ ] Load a strategy → no errors
- [ ] Navigate to Optimization tab → renders correctly
- [ ] Exit params show as badge lists with add/remove
- [ ] CT shows as badge list
- [ ] Regime filter grid works (add/remove conditions)
- [ ] Navigate to Assets tab → only datasource/timeframe/filter/exclude
- [ ] Save strategy → JSON has exit_params as arrays, optimization section, no grids
- [ ] Reload strategy → values preserved

**Step 4: Final commit if any fixes needed**

---

## Task Order Summary

| # | Task | Phase | Repo |
|---|------|-------|------|
| 1 | Add OptimizationConfig | Config | fwbg |
| 2 | Update StrategyConfig fields | Config | fwbg |
| 3 | Remove GridConfig, _parse_grids | Config | fwbg |
| 4 | Update SimulationContext.create | Integration | fwbg |
| 5 | Update process.py | Integration | fwbg |
| 6 | Update grid_search.py | Integration | fwbg |
| 7 | Clean up strategies.py | API | fwbg |
| 8 | Update presets.py | API | fwbg |
| 9 | Migration script + run | Migration | fwbg |
| 10 | Update StrategyConfig type | Frontend | dashboard |
| 11 | Clean up strategyConfig.ts | Frontend | dashboard |
| 12 | Update StrategyRefs type | Frontend | dashboard |
| 13 | Create optimization.vue | Frontend | dashboard |
| 14 | Add Optimization tab | Frontend | dashboard |
| 15 | Simplify grids.vue | Frontend | dashboard |
| 16 | Update test_config_presets.py | Tests | fwbg |
| 17 | Update test_grid_presets.py | Tests | fwbg |
| 18 | Fix remaining test failures | Tests | fwbg |
| 19 | Update frontend tests | Tests | dashboard |
| 20 | Full stack verification | Verify | both |
