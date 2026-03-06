# Signal Composer — Visual Rule Builder for Buy/Sell Signals

> **Date:** 2026-03-02
> **Status:** Design approved

## Goal

Replace manual `signal_column_long/short` hyperparameter configuration with a visual nested rule builder. Users compose buy/sell signals from indicator outputs using AND/OR logic, column comparisons, crossings, and value checks. An ML model can optionally run on top of composed signals to learn when the strategy works best.

## Data Model

Signal rules are stored in `strategy.json` under a new top-level key `signal_rules`:

```json
{
  "signal_rules": {
    "long": {
      "operator": "AND",
      "conditions": [
        { "type": "signal_active", "column": "orb_breakout_up" },
        { "type": "value_check", "column": "rsi_14", "op": "<", "value": 70 },
        {
          "type": "group",
          "operator": "OR",
          "conditions": [
            { "type": "crossing", "column_a": "ema_9", "direction": "above", "column_b": "ema_21" },
            { "type": "col_compare", "column_a": "close", "op": ">", "column_b": "vwap" }
          ]
        }
      ]
    },
    "short": {
      "operator": "AND",
      "conditions": [
        { "type": "signal_active", "column": "orb_breakout_down" }
      ]
    }
  }
}
```

### Condition Types

| Type | Fields | Description |
|------|--------|-------------|
| `signal_active` | `column` | Binary signal column == 1 |
| `value_check` | `column`, `op`, `value` | Column vs. fixed value (==, !=, <, >, <=, >=) |
| `col_compare` | `column_a`, `op`, `column_b` | Column A vs. Column B with operator |
| `crossing` | `column_a`, `direction`, `column_b` | Column A crosses above/below Column B (current vs previous bar) |
| `group` | `operator`, `conditions` | Nested AND/OR group (recursive) |

### Column Name Resolution

Columns in rules use **short suffixes** (e.g. `breakout_up`, `rsi_14`). At evaluation time, the evaluator resolves these to full column names by matching suffixes against available DataFrame columns. This makes rules resilient to indicator parameter changes (prefix changes like `rb12_cf3_prb6_` don't break rules).

## Backend Architecture

### 1. Signal Rules Evaluator

New module: `fwbg/src/fwbg/signals/evaluator.py`

```python
def evaluate_rules(rules: dict, df: pd.DataFrame) -> pd.Series:
    """Recursively evaluate nested signal rules → boolean Series."""
    op = rules.get("operator", "AND")
    results = [evaluate_condition(c, df) for c in rules["conditions"]]
    if op == "AND":
        return reduce(lambda a, b: a & b, results)
    else:
        return reduce(lambda a, b: a | b, results)

def evaluate_condition(cond: dict, df: pd.DataFrame) -> pd.Series:
    match cond["type"]:
        case "signal_active":
            col = resolve_column(cond["column"], df.columns)
            return df[col].fillna(0) == 1
        case "value_check":
            col = resolve_column(cond["column"], df.columns)
            return _apply_op(df[col], cond["op"], cond["value"])
        case "col_compare":
            col_a = resolve_column(cond["column_a"], df.columns)
            col_b = resolve_column(cond["column_b"], df.columns)
            return _apply_op(df[col_a], cond["op"], df[col_b])
        case "crossing":
            col_a = resolve_column(cond["column_a"], df.columns)
            col_b = resolve_column(cond["column_b"], df.columns)
            if cond["direction"] == "above":
                return (df[col_a] > df[col_b]) & (df[col_a].shift(1) <= df[col_b].shift(1))
            else:
                return (df[col_a] < df[col_b]) & (df[col_a].shift(1) >= df[col_b].shift(1))
        case "group":
            return evaluate_rules(cond, df)

def resolve_column(short_name: str, columns) -> str:
    """Resolve short suffix to full column name."""
    if short_name in columns:
        return short_name
    matches = [c for c in columns if c.endswith(f"_{short_name}") or c.endswith(short_name)]
    if matches:
        return matches[0]
    raise KeyError(f"Column '{short_name}' not found")
```

### 2. Composer Indicator (Auto-Injected)

When `signal_rules` exists in strategy config, the pipeline auto-injects a virtual indicator that:
1. Runs **after** all other indicators (needs their output columns)
2. Calls `evaluate_rules()` for long and short
3. Produces `_composed_signal_long` and `_composed_signal_short` columns (values 0.0 / 1.0)

The `SignalModel` reads these composed columns automatically — no `signal_column_long/short` hyperparameters needed.

### 3. API Endpoints

#### `GET /api/strategy/{name}/available-columns`

Returns all columns produced by indicators configured in the strategy's pipeline, grouped by indicator with human-readable labels.

```json
{
  "groups": [
    {
      "fqn": "fwbg-core:orb",
      "label": "Opening Range Breakout",
      "columns": [
        { "name": "breakout_up", "full_name": "rb1_orb_s08_breakout_up", "label": "ORB Breakout Up", "type": "signal" },
        { "name": "breakout_down", "full_name": "rb1_orb_s08_breakout_down", "label": "ORB Breakout Down", "type": "signal" },
        { "name": "or_high", "full_name": "rb1_orb_s08_or_high", "label": "Opening Range High", "type": "plot" },
        { "name": "range", "full_name": "rb1_orb_s08_range", "label": "Opening Range Size", "type": "plot" }
      ]
    },
    {
      "fqn": "fwbg-core:trend",
      "label": "Trend Indicators",
      "columns": [
        { "name": "direction", "full_name": "trend_supertrend_direction", "label": "Supertrend Direction", "type": "signal" },
        { "name": "adx_14", "full_name": "trend_adx_14", "label": "ADX (14)", "type": "plot" }
      ]
    },
    {
      "fqn": "price",
      "label": "Preis",
      "columns": [
        { "name": "close", "full_name": "close", "label": "Close", "type": "plot" },
        { "name": "high", "full_name": "high", "label": "High", "type": "plot" },
        { "name": "low", "full_name": "low", "label": "Low", "type": "plot" }
      ]
    }
  ]
}
```

Column labels come from `get_column_group_labels()` on each indicator plugin (already exists in SDK). For individual columns, derive labels by stripping prefix and formatting the suffix.

#### `POST /api/signal-preview`

Request:
```json
{
  "strategy_name": "orb_retest_v3",
  "symbol": "NAS100",
  "timeframe": "1h",
  "rules": { "operator": "AND", "conditions": [...] },
  "direction": "long",
  "limit": 5000
}
```

Response:
```json
{
  "match_count": 142,
  "total_bars": 5000,
  "timestamps": [1698652800, 1698739200, ...]
}
```

## Frontend Architecture

### Location: Model Tab (conditional)

The signal rule editor replaces the generic hyperparameter key-value editor when signal rules are relevant. The model tab shows:

- **Always:** Model type, architecture, trade directions
- **When `signal_rules` defined OR model.type == "signal":** Signal Rule Builder
- **When model.type is ML (xgboost etc.) WITHOUT signal_rules:** Standard hyperparameter editor
- **When model.type is ML WITH signal_rules:** Signal Rule Builder + info that rules are used as features

### Components

```
components/strategy/
  SignalRuleEditor.vue      — Main wrapper: Long/Short sections + preview count
  SignalRuleGroup.vue       — AND/OR group with nested conditions (recursive)
  SignalCondition.vue       — Single condition row (type dropdown → matching fields)

composables/
  useSignalColumns.ts       — Fetches available columns, provides grouped/labeled data
```

#### `SignalRuleEditor.vue`
- Receives `v-model` bound to `config.signal_rules`
- Fetches columns via `useSignalColumns(strategyName)`
- Renders two `<StrategySignalRuleGroup>` — one for long, one for short
- Shows match count preview ("142 Long / 138 Short Matches")
- "Preview auf Chart" button triggers `POST /api/signal-preview`

#### `SignalRuleGroup.vue`
- AND/OR toggle (UButtonGroup)
- List of `<StrategySignalCondition>` components
- Nested `<StrategySignalRuleGroup>` for type=group (recursive)
- "+ Bedingung" and "+ Gruppe" buttons
- Each row has a delete button

#### `SignalCondition.vue`
- First dropdown: condition type (Signal aktiv, Wert-Check, Spalten-Vergleich, Crossing)
- Based on type, shows relevant fields:
  - `signal_active`: Column dropdown (filtered to signal columns)
  - `value_check`: Column dropdown + operator dropdown + value input
  - `col_compare`: Column dropdown + operator dropdown + Column dropdown
  - `crossing`: Column dropdown + "kreuzt über/unter" dropdown + Column dropdown

#### Column Dropdowns
- Grouped by indicator using `<USelectMenu>` with groups
- Show human-readable labels, store short suffix as value
- Signal columns visually distinguished from plot/price columns

### `useSignalColumns.ts`

```typescript
interface ColumnInfo {
  name: string;       // short suffix for storage
  fullName: string;   // full DataFrame column name
  label: string;      // human-readable display label
  type: "signal" | "plot";
}

interface ColumnGroup {
  fqn: string;
  label: string;
  columns: ColumnInfo[];
}

export function useSignalColumns(strategyName: MaybeRef<string>) {
  const groups = ref<ColumnGroup[]>([]);
  // GET /api/strategy/{name}/available-columns
  // Provides: allColumns, signalColumns, columnItems (for dropdown)
}
```

## Strategy Config Changes

### TypeScript (`types/strategy.ts`)

```typescript
// New types
interface SignalCondition {
  type: "signal_active" | "value_check" | "col_compare" | "crossing" | "group";
  column?: string;
  column_a?: string;
  column_b?: string;
  op?: string;
  value?: number;
  direction?: "above" | "below";
  operator?: "AND" | "OR";
  conditions?: SignalCondition[];
}

interface SignalRuleSet {
  operator: "AND" | "OR";
  conditions: SignalCondition[];
}

// Add to StrategyConfig
interface StrategyConfig {
  // ... existing fields ...
  signal_rules?: {
    long?: SignalRuleSet;
    short?: SignalRuleSet;
  };
}
```

### Python (`config.py`)

Add `signal_rules: Optional[dict]` to `StrategyConfig`. Serialized/deserialized as-is (dict passthrough).

## Hybrid Mode: Signal Rules + ML

Signal rules are **independent of model type**. They always produce `_composed_signal_long/short` columns as features in the DataFrame.

| Model Type | Behavior |
|------------|----------|
| `signal` | Composed signal → direct trade (probability 1.0 where signal fires, CT ≥ 0.5) |
| `xgboost` / `lightgbm` | Composed signal columns are features. ML learns when the signal works well. CT filters quality. |

**Workflow:**
1. Define signal rules in the editor (e.g., ORB Breakout + Trend bullish)
2. Start with `model.type = "signal"` to validate the base strategy
3. Switch to `model.type = "xgboost"` — same rules, ML optimizes timing
4. ML answers: "Skip this ORB signal when volatility is high" or "Scale-in works only in trending markets"

No separate "hybrid" model type needed. The presence of `signal_rules` + ML model type creates the hybrid behavior automatically.

## Implementation Tasks

### Task 1: Backend — Signal Rules Evaluator
- Create `fwbg/src/fwbg/signals/__init__.py` + `evaluator.py`
- Implement `evaluate_rules()`, `evaluate_condition()`, `resolve_column()`
- Unit tests for all condition types + nesting + column resolution

### Task 2: Backend — Composer Indicator
- Auto-inject into pipeline when `signal_rules` present
- Runs after all other indicators
- Produces `_composed_signal_long` / `_composed_signal_short`
- Wire `SignalModel` to read composed columns by default

### Task 3: Backend — Available Columns API
- `GET /api/strategy/{name}/available-columns`
- Load strategy config → iterate pipeline indicators → collect columns
- Derive labels from `get_column_group_labels()` + suffix formatting
- Include price columns (close, high, low, open)

### Task 4: Backend — Signal Preview API
- `POST /api/signal-preview`
- Load indicator data for symbol/timeframe
- Evaluate rules → return match timestamps + count

### Task 5: Backend — Config Changes
- Add `signal_rules` to `StrategyConfig` (Python)
- Passthrough serialization in `to_dict()` / `from_dict()`

### Task 6: Frontend — Types + Composable
- Add `SignalCondition`, `SignalRuleSet` types to `strategy.ts`
- Add `signal_rules` to `StrategyConfig`
- Create `useSignalColumns.ts` composable

### Task 7: Frontend — Signal Rule Editor Components
- `SignalRuleEditor.vue` — main wrapper with Long/Short sections
- `SignalRuleGroup.vue` — AND/OR group (recursive)
- `SignalCondition.vue` — single condition row with type-specific fields
- Column dropdowns grouped by indicator with readable labels

### Task 8: Frontend — Model Tab Integration
- Modify `model.vue` to conditionally show rule editor vs hyperparameter editor
- Show rule editor when `signal_rules` defined or model.type == "signal"
- Show info text for ML + signal_rules hybrid mode

### Task 9: Frontend — Preview Integration
- Match count display in rule editor
- "Preview auf Chart" button
- Chart markers for signal matches
