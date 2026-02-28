# Multiple Exit Strategies Design

## Goal

Replace the single `exit_strategy` + `exit_params` grid-array model with an `exit_strategies` array where each entry is an independent, fully-configured exit strategy instance. Each instance becomes a grid element for the optimizer.

## JSON Format

```json
{
  "exit_strategies": [
    {
      "name": "orb_based",
      "params": {
        "tp_mult": 1.5,
        "sl_mult": 1.0,
        "tp_mode": "atr",
        "atr_period": 14
      },
      "ct": [0.5, 0.55],
      "min_rrr": 1.0,
      "exit_modifier": "trailing_stop",
      "exit_modifier_params": {
        "breakeven_trigger": 0.5,
        "trail_atr_mult": 0.5
      }
    },
    {
      "name": "orb_based",
      "params": {
        "tp_mult": 2.0,
        "sl_mult": 1.0,
        "tp_mode": "range"
      },
      "ct": [0.45, 0.5]
    }
  ]
}
```

Each instance has **fixed params** (scalars, no arrays). CT remains an array — the only dimension the optimizer searches per instance.

### Fields removed from StrategyConfig

- `exit_strategy` (str)
- `exit_params` (dict with grid arrays)
- `exit_modifier` / `exit_modifier_params`
- `optimization.ct`
- `optimization.min_rrr`
- `optimization.exit_modifier_params_grid`

No backwards compatibility. No legacy fallbacks.

## Backend Architecture

### ExitStrategyConfig dataclass (`core/config.py`)

```python
@dataclass
class ExitStrategyConfig:
    name: str                           # Plugin name, e.g. "orb_based"
    params: Dict[str, Any]              # Fixed params (scalars)
    ct: List[float] = field(default_factory=lambda: [0.5])
    min_rrr: float = 0
    exit_modifier: Optional[str] = None
    exit_modifier_params: Dict[str, Any] = field(default_factory=dict)
```

### StrategyConfig changes

```python
@dataclass
class StrategyConfig:
    # Remove: exit_strategy, exit_params, exit_modifier, exit_modifier_params
    exit_strategies: List[ExitStrategyConfig] = field(default_factory=list)
    # ...rest stays
```

### SimulationContext changes (`core/context.py`)

```python
# Remove: exit_strategy, exit_params, grid_tp, grid_sl, exit_modifier, exit_modifier_params,
#          grid_exit_modifier_params
# Add:
ctx.exit_strategies: List[ExitStrategyConfig]
```

### Grid Search changes (`optimization/grid_search.py`)

`_build_combo_tuples()` iterates over exit strategy instances instead of tp×sl×timeout:

```python
for exit_cfg in ctx.exit_strategies:
    for ct in exit_cfg.ct:
        for model_hp_variant in ctx.grid_model_hyperparameters:
            combo = (exit_cfg, ct, model_hp_variant, ...)
```

RRR filtering uses `exit_cfg.min_rrr` against the instance's own tp/sl params.

### Plugin changes

- `iterate_grid()` on BaseExitStrategy: remove (no longer needed)
- `compute_targets()` / `resolve_distances()`: unchanged (already work with fixed params)
- `get_param_schema()` / `get_default_params()`: unchanged (used by Dashboard UI)

### Target cache key

```python
def _target_cache_key(exit_cfg, ctx):
    return (
        exit_cfg.name,
        tuple(sorted(exit_cfg.params.items())),
        exit_cfg.exit_modifier or "",
        tuple(sorted(exit_cfg.exit_modifier_params.items())),
        ctx.model_hyperparameters.get("sl_dist_column", ""),
    )
```

## Dashboard UI

### Pipeline Tab

- Exit-Strategies lane allows **multiple instances**
- Each card shows: plugin name + compact param summary
- Click opens sidebar with **all** params (no grid-filter needed)
- CT values + min_rrr + exit_modifier configured in sidebar
- Duplicate button on each card for creating variants

### Optimization Tab

Simplified — exit-related sections removed:
- ~~Exit Strategy grid~~ → gone
- ~~CT section~~ → gone (per instance now)
- ~~Exit Modifier Grid~~ → gone (per instance now)
- Remaining: Regime Filter Grid, Model HP Grid

### TypeScript types

```typescript
interface ExitStrategyInstance {
  name: string;
  params: Record<string, unknown>;
  ct?: number[];
  min_rrr?: number;
  exit_modifier?: string;
  exit_modifier_params?: Record<string, unknown>;
}

interface StrategyConfig {
  // Remove: exit_strategy, exit_params
  exit_strategies: ExitStrategyInstance[];
  // ...rest stays
}
```

### useStrategy composable

`syncFromConfig()` / `toJson()` syncs N exit strategy instances to/from the lane (same pattern as indicators — each instance has a unique ID).

## Migration Script

One-time script converts existing strategy JSONs:

```
Input:
  exit_strategy: "orb_based"
  exit_params: { tp_mult: [1.5, 2.0], sl_mult: [1.0], tp_mode: "atr" }
  exit_modifier: "trailing_stop"
  exit_modifier_params: { breakeven_trigger: 0.5 }
  optimization: { ct: [0.5, 0.55], min_rrr: 1.0 }

Output:
  exit_strategies: [
    { name: "orb_based",
      params: { tp_mult: 1.5, sl_mult: 1.0, tp_mode: "atr" },
      ct: [0.5, 0.55], min_rrr: 1.0,
      exit_modifier: "trailing_stop",
      exit_modifier_params: { breakeven_trigger: 0.5 } },
    { name: "orb_based",
      params: { tp_mult: 2.0, sl_mult: 1.0, tp_mode: "atr" },
      ct: [0.5, 0.55], min_rrr: 1.0,
      exit_modifier: "trailing_stop",
      exit_modifier_params: { breakeven_trigger: 0.5 } }
  ]
```

Cartesian product of grid arrays → individual instances. CT, min_rrr, modifier copied to each.

Removes old fields: `exit_strategy`, `exit_params`, `optimization.ct`, `optimization.min_rrr`, `optimization.exit_modifier_params_grid`.

## Files to Change

### fwbg (Python backend)

| File | Change |
|------|--------|
| `core/config.py` | Add `ExitStrategyConfig`, update `StrategyConfig`, update `from_dict()` |
| `core/context.py` | Replace single exit fields with `exit_strategies` list |
| `optimization/grid_search.py` | Rewrite `_build_combo_tuples()`, update `_target_cache_key()` |
| `optimization/targets.py` | Update `compute_targets_cached()` to accept `ExitStrategyConfig` |
| `fwbg-sdk/exit_strategies.py` | Remove `iterate_grid()` from `BaseExitStrategy` |
| All exit strategy plugins | Remove `iterate_grid()` implementations |
| `scripts/migrate_strategies.py` | New migration script |
| Tests | Update for new format |

### fwbg-dashboard (Nuxt)

| File | Change |
|------|--------|
| `types/strategy.ts` | Add `ExitStrategyInstance`, update `StrategyConfig` |
| `composables/useStrategy.ts` | Multi-instance sync for exit_strategies lane |
| `components/strategy/PluginConfigPanel.vue` | Show all params + CT/modifier/min_rrr section |
| `pages/strategy/[name]/pipeline.vue` | Allow multiple exit strategies in lane |
| `pages/strategy/[name]/optimization.vue` | Remove exit strategy/CT/modifier sections |
| `stores/strategyConfigStore.ts` | Update save/load for new format |
