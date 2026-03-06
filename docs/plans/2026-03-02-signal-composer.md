# Signal Composer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Visual nested rule builder for composing buy/sell signals from indicator outputs, replacing manual signal_column_long/short hyperparameters.

**Architecture:** Signal rules stored as JSON in strategy config. Backend evaluator recursively computes composed signal columns. Frontend nested rule builder in Model tab with column discovery from pipeline indicators. ML models can use composed signals as features.

**Tech Stack:** Python/FastAPI (backend), Pandas (evaluator), Nuxt 4/Vue 3/Nuxt UI 4.4 (frontend), Pinia (state)

**Design doc:** `docs/plans/2026-03-02-signal-composer-design.md`

---

## Task 1: Backend — Config Passthrough for `signal_rules`

Add `signal_rules` field to Python StrategyConfig. Dict passthrough — no parsing, just store and serialize.

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/core/config.py`

**Step 1: Add field to StrategyConfig dataclass**

In `/home/haex/Projekte/fwbg/src/fwbg/core/config.py`, add field after line 398 (`expected_outcome`):

```python
# Signal rules for composed entry signals (visual rule builder)
signal_rules: Optional[Dict[str, Any]] = None
```

**Step 2: Wire into `from_dict()` (line 420-439)**

Add to the `cls(...)` constructor call, after `expected_outcome=`:

```python
signal_rules=data.get("signal_rules"),
```

**Step 3: Wire into `to_dict()` (line 476-524)**

Add to the returned dict, after `"expected_outcome"`:

```python
"signal_rules": self.signal_rules,
```

**Step 4: Add signal_rules to SimulationContext**

In `/home/haex/Projekte/fwbg/src/fwbg/core/context.py`, add field after `required_features` (line 122):

```python
# Signal rules for composed entry signals (from strategy config)
signal_rules: Optional[dict] = None
```

In `SimulationContext.create()` (around line 177), add to the `cls(...)` call:

```python
signal_rules=getattr(strategy, 'signal_rules', None),
```

**Step 5: Verify**

```bash
cd /home/haex/Projekte/fwbg && .venv/bin/python -c "
from fwbg.core.config import StrategyConfig
cfg = StrategyConfig.from_dict({'signal_rules': {'long': {'operator': 'AND', 'conditions': [{'type': 'signal_active', 'column': 'test'}]}}})
assert cfg.signal_rules is not None
d = cfg.to_dict()
assert d['signal_rules']['long']['operator'] == 'AND'
print('OK: signal_rules roundtrip works')
"
```

**Step 6: Commit**

```bash
git add src/fwbg/core/config.py src/fwbg/core/context.py
git commit -m "feat: add signal_rules passthrough to StrategyConfig"
```

---

## Task 2: Backend — Signal Rules Evaluator (TDD)

Core evaluation logic: recursively evaluate nested rules against a DataFrame.

**Files:**
- Create: `/home/haex/Projekte/fwbg/src/fwbg/signals/__init__.py`
- Create: `/home/haex/Projekte/fwbg/src/fwbg/signals/evaluator.py`
- Create: `/home/haex/Projekte/fwbg/tests/signals/test_evaluator.py`

**Step 1: Create package and write failing tests**

Create `/home/haex/Projekte/fwbg/src/fwbg/signals/__init__.py`:
```python
"""Signal composition — evaluate rule-based entry signals."""
from .evaluator import evaluate_rules, resolve_column

__all__ = ["evaluate_rules", "resolve_column"]
```

Create `/home/haex/Projekte/fwbg/tests/signals/__init__.py` (empty).

Create `/home/haex/Projekte/fwbg/tests/signals/test_evaluator.py`:
```python
"""Tests for the signal rules evaluator."""
import numpy as np
import pandas as pd
import pytest

from fwbg.signals.evaluator import evaluate_rules, evaluate_condition, resolve_column


@pytest.fixture
def sample_df():
    """DataFrame with typical indicator columns."""
    idx = pd.date_range("2024-01-01", periods=10, freq="h")
    return pd.DataFrame({
        "rb1_orb_s08_breakout_up": [0, 0, 1, 1, 0, 0, 1, 0, 0, 1],
        "rb1_orb_s08_breakout_down": [0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
        "trend_adx_14": [10, 15, 25, 30, 35, 20, 18, 40, 22, 28],
        "mom_rsi_14": [50, 55, 70, 80, 30, 45, 60, 25, 35, 65],
        "ema_9": [100, 101, 103, 105, 104, 102, 103, 106, 107, 108],
        "ema_21": [100, 100, 101, 102, 103, 103, 104, 104, 105, 106],
        "close": [100, 102, 104, 106, 103, 101, 103, 107, 108, 110],
    }, index=idx)


class TestResolveColumn:
    def test_exact_match(self, sample_df):
        assert resolve_column("close", sample_df.columns) == "close"

    def test_suffix_match(self, sample_df):
        assert resolve_column("breakout_up", sample_df.columns) == "rb1_orb_s08_breakout_up"

    def test_suffix_match_with_underscore(self, sample_df):
        assert resolve_column("rsi_14", sample_df.columns) == "mom_rsi_14"

    def test_not_found_raises(self, sample_df):
        with pytest.raises(KeyError, match="nonexistent"):
            resolve_column("nonexistent", sample_df.columns)


class TestSignalActive:
    def test_basic(self, sample_df):
        cond = {"type": "signal_active", "column": "breakout_up"}
        result = evaluate_condition(cond, sample_df)
        expected = pd.Series([False, False, True, True, False, False, True, False, False, True],
                             index=sample_df.index)
        pd.testing.assert_series_equal(result, expected, check_names=False)


class TestValueCheck:
    def test_less_than(self, sample_df):
        cond = {"type": "value_check", "column": "rsi_14", "op": "<", "value": 40}
        result = evaluate_condition(cond, sample_df)
        assert result.sum() == 3  # indices 4,7,8 → rsi: 30,25,35

    def test_greater_equal(self, sample_df):
        cond = {"type": "value_check", "column": "adx_14", "op": ">=", "value": 30}
        result = evaluate_condition(cond, sample_df)
        assert result.sum() == 3  # indices 3,4,7 → adx: 30,35,40

    def test_equals(self, sample_df):
        cond = {"type": "value_check", "column": "close", "op": "==", "value": 104}
        result = evaluate_condition(cond, sample_df)
        assert result.sum() == 1


class TestColCompare:
    def test_greater_than(self, sample_df):
        cond = {"type": "col_compare", "column_a": "ema_9", "op": ">", "column_b": "ema_21"}
        result = evaluate_condition(cond, sample_df)
        # ema_9 > ema_21: indices where 9 is strictly above 21
        assert result.iloc[0] == False  # 100 == 100
        assert result.iloc[3] == True   # 105 > 102


class TestCrossing:
    def test_crosses_above(self, sample_df):
        cond = {"type": "crossing", "column_a": "ema_9", "direction": "above", "column_b": "ema_21"}
        result = evaluate_condition(cond, sample_df)
        # Crossing above: ema_9 was <= ema_21, now ema_9 > ema_21
        # At index 1: ema_9=101 > ema_21=100, prev: ema_9=100 <= ema_21=100 → True
        assert result.iloc[0] == False  # first bar can't cross (no prev)
        assert result.iloc[1] == True   # 101>100, prev 100<=100

    def test_crosses_below(self, sample_df):
        cond = {"type": "crossing", "column_a": "ema_9", "direction": "below", "column_b": "ema_21"}
        result = evaluate_condition(cond, sample_df)
        # Looking for where ema_9 drops below ema_21
        # Check that it's a boolean series with no errors
        assert result.dtype == bool


class TestNestedRules:
    def test_and_group(self, sample_df):
        rules = {
            "operator": "AND",
            "conditions": [
                {"type": "signal_active", "column": "breakout_up"},
                {"type": "value_check", "column": "adx_14", "op": ">=", "value": 25},
            ]
        }
        result = evaluate_rules(rules, sample_df)
        # breakout_up=1 at [2,3,6,9] AND adx>=25 at [2,3,4,7,9]
        # Intersection: [2,3,9]
        assert result.sum() == 3

    def test_or_group(self, sample_df):
        rules = {
            "operator": "OR",
            "conditions": [
                {"type": "signal_active", "column": "breakout_up"},
                {"type": "signal_active", "column": "breakout_down"},
            ]
        }
        result = evaluate_rules(rules, sample_df)
        # breakout_up at [2,3,6,9], breakout_down at [1,4,8]
        # Union: [1,2,3,4,6,8,9] = 7
        assert result.sum() == 7

    def test_nested_group(self, sample_df):
        """AND with nested OR group."""
        rules = {
            "operator": "AND",
            "conditions": [
                {"type": "value_check", "column": "adx_14", "op": ">=", "value": 25},
                {
                    "type": "group",
                    "operator": "OR",
                    "conditions": [
                        {"type": "signal_active", "column": "breakout_up"},
                        {"type": "signal_active", "column": "breakout_down"},
                    ]
                }
            ]
        }
        result = evaluate_rules(rules, sample_df)
        # adx>=25 at [2,3,4,7,9] AND (breakout_up OR breakout_down) at [1,2,3,4,6,8,9]
        # Intersection: [2,3,4,9]
        assert result.sum() == 4

    def test_empty_conditions(self, sample_df):
        rules = {"operator": "AND", "conditions": []}
        result = evaluate_rules(rules, sample_df)
        # Empty AND = all True (vacuous truth)
        assert result.all()


class TestEdgeCases:
    def test_nan_in_signal_column(self):
        df = pd.DataFrame({
            "sig": [1, np.nan, 0, 1, np.nan],
        })
        cond = {"type": "signal_active", "column": "sig"}
        result = evaluate_condition(cond, df)
        # NaN should be treated as 0 (no signal)
        assert list(result) == [True, False, False, True, False]

    def test_nan_in_value_check(self):
        df = pd.DataFrame({
            "val": [10, np.nan, 30, np.nan, 50],
        })
        cond = {"type": "value_check", "column": "val", "op": ">", "value": 20}
        result = evaluate_condition(cond, df)
        # NaN comparisons → False
        assert list(result) == [False, False, True, False, True]
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/haex/Projekte/fwbg && .venv/bin/python -m pytest tests/signals/test_evaluator.py -v
```
Expected: FAIL (module not found)

**Step 3: Implement evaluator**

Create `/home/haex/Projekte/fwbg/src/fwbg/signals/evaluator.py`:
```python
"""Recursive evaluator for nested signal composition rules.

Evaluates rules defined in strategy.signal_rules against a DataFrame
of indicator columns. Produces a boolean Series indicating where
the composed signal fires.

Supports: signal_active, value_check, col_compare, crossing, group (nested).
"""
from functools import reduce
from typing import Any, Union

import pandas as pd


_OPS = {
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
    "<":  lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    ">":  lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
}


def resolve_column(short_name: str, columns) -> str:
    """Resolve a short column suffix to a full DataFrame column name.

    Tries exact match first, then suffix match. This makes rules resilient
    to indicator parameter changes that alter column prefixes.
    """
    if short_name in columns:
        return short_name
    suffix = f"_{short_name}"
    matches = [c for c in columns if c.endswith(suffix)]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        return matches[0]
    raise KeyError(f"Column '{short_name}' not found in {list(columns)}")


def evaluate_rules(rules: dict, df: pd.DataFrame) -> pd.Series:
    """Recursively evaluate nested signal rules into a boolean Series."""
    conditions = rules.get("conditions", [])
    if not conditions:
        return pd.Series(True, index=df.index, dtype=bool)

    results = [evaluate_condition(c, df) for c in conditions]
    op = rules.get("operator", "AND")
    if op == "AND":
        return reduce(lambda a, b: a & b, results)
    return reduce(lambda a, b: a | b, results)


def evaluate_condition(cond: dict, df: pd.DataFrame) -> pd.Series:
    """Evaluate a single condition against a DataFrame."""
    ctype = cond["type"]

    if ctype == "signal_active":
        col = resolve_column(cond["column"], df.columns)
        return df[col].fillna(0) == 1

    if ctype == "value_check":
        col = resolve_column(cond["column"], df.columns)
        return _apply_op(df[col], cond["op"], cond["value"])

    if ctype == "col_compare":
        col_a = resolve_column(cond["column_a"], df.columns)
        col_b = resolve_column(cond["column_b"], df.columns)
        return _apply_op(df[col_a], cond["op"], df[col_b])

    if ctype == "crossing":
        col_a = resolve_column(cond["column_a"], df.columns)
        col_b = resolve_column(cond["column_b"], df.columns)
        a, b = df[col_a], df[col_b]
        if cond["direction"] == "above":
            return (a > b) & (a.shift(1) <= b.shift(1))
        return (a < b) & (a.shift(1) >= b.shift(1))

    if ctype == "group":
        return evaluate_rules(cond, df)

    raise ValueError(f"Unknown condition type: {ctype}")


def _apply_op(
    left: pd.Series,
    op: str,
    right: Union[pd.Series, Any],
) -> pd.Series:
    """Apply a comparison operator, returning bool Series."""
    fn = _OPS.get(op)
    if fn is None:
        raise ValueError(f"Unknown operator: {op}")
    return fn(left, right).fillna(False).astype(bool)
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/haex/Projekte/fwbg && .venv/bin/python -m pytest tests/signals/test_evaluator.py -v
```

**Step 5: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/signals/ tests/signals/
git commit -m "feat: signal rules evaluator with recursive nested evaluation"
```

---

## Task 3: Backend — Pipeline Integration (Composer)

When `signal_rules` exists in strategy config, auto-inject composed signal columns into the feature DataFrame.

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/optimization/signal_fold.py`
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/optimization/process_fold.py`
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/plugins/fwbg-core/models/signal/__init__.py`

**Step 1: Inject composed signals in `_prepare_fold_common()`**

In `/home/haex/Projekte/fwbg/src/fwbg/optimization/process_fold.py`, after indicators are computed and features are built (around end of function before return), add signal composition:

```python
# Compose signal rules into _composed_signal_long/short columns
signal_rules = getattr(ctx, "signal_rules", None)
if signal_rules:
    from fwbg.signals.evaluator import evaluate_rules
    for direction in ("long", "short"):
        rules = signal_rules.get(direction)
        if rules and rules.get("conditions"):
            col_name = f"_composed_signal_{direction}"
            for target_df in (train_df, test_df):
                mask = evaluate_rules(rules, target_df)
                target_df[col_name] = mask.astype(float)
```

This must be placed AFTER all indicator columns exist in train_df/test_df but BEFORE the return dict is built. Check the exact location by reading the function — it should go after the feature pool cleaning (inf/NaN exclusion) block.

**Step 2: Update SignalModel to auto-detect composed columns**

In `/home/haex/Projekte/fwbg/src/fwbg/plugins/fwbg-core/models/signal/__init__.py`, modify `train()` method. After the existing signal_column resolution (lines 52-55), add fallback:

```python
# Fallback: use composed signal columns from signal_rules evaluator
if not self._signal_col:
    composed = f"_composed_signal_{training_context.direction}"
    if composed in features.columns:
        self._signal_col = composed
```

**Step 3: Update signal_fold to add composed columns to required_features**

In `/home/haex/Projekte/fwbg/src/fwbg/optimization/signal_fold.py`, in `prepare_signal_fold_data()`, after the auto-resolve block (line 82), add:

```python
# If signal_rules defined, add composed columns to required features
signal_rules = getattr(ctx, "signal_rules", None)
if signal_rules:
    for direction in ("long", "short"):
        rules = signal_rules.get(direction)
        if rules and rules.get("conditions"):
            col_name = f"_composed_signal_{direction}"
            if col_name not in ctx.required_features:
                ctx.required_features.append(col_name)
```

**Step 4: Update SimulationContext.create() to auto-set required_features for composed signals**

In `/home/haex/Projekte/fwbg/src/fwbg/core/context.py`, in the `create()` classmethod, after the signal_column auto-add block (line 167), add:

```python
# Auto-add composed signal columns when signal_rules are defined
sr = getattr(strategy, 'signal_rules', None)
if sr:
    for direction in ("long", "short"):
        rules = sr.get(direction)
        if rules and rules.get("conditions"):
            col = f"_composed_signal_{direction}"
            if col not in req_feats:
                req_feats.append(col)
```

**Step 5: Test the integration**

```bash
cd /home/haex/Projekte/fwbg && .venv/bin/python -c "
from fwbg.signals.evaluator import evaluate_rules
import pandas as pd
import numpy as np

df = pd.DataFrame({
    'rb1_orb_s08_breakout_up': [0,0,1,1,0],
    'trend_adx_14': [10,25,30,15,35],
})
rules = {
    'operator': 'AND',
    'conditions': [
        {'type': 'signal_active', 'column': 'breakout_up'},
        {'type': 'value_check', 'column': 'adx_14', 'op': '>=', 'value': 25},
    ]
}
result = evaluate_rules(rules, df)
assert list(result) == [False, False, True, False, False]
print('OK: composed signal works')
"
```

**Step 6: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/optimization/process_fold.py src/fwbg/optimization/signal_fold.py \
        src/fwbg/plugins/fwbg-core/models/signal/__init__.py src/fwbg/core/context.py
git commit -m "feat: auto-inject composed signal columns from signal_rules"
```

---

## Task 4: Backend — Available Columns API

Endpoint that returns all columns from configured indicators, grouped with labels.

**Files:**
- Create: `/home/haex/Projekte/fwbg/src/fwbg/api/signal_composer.py`
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/api/__init__.py`

**Step 1: Create signal_composer API module**

Create `/home/haex/Projekte/fwbg/src/fwbg/api/signal_composer.py`:
```python
"""API endpoints for the signal composer (rule builder)."""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from fwbg.api.deps import get_strategies_dir, get_plugin_registry

router = APIRouter(prefix="/signal-composer", tags=["signal-composer"])


def _format_column_label(col_name: str, prefix_len: int) -> str:
    """Turn a raw column name into a readable label."""
    stripped = col_name[prefix_len:].lstrip("_") if prefix_len else col_name
    return stripped.replace("_", " ").title()


def _find_common_prefix_len(columns: list[str]) -> int:
    """Find common prefix length across column names."""
    if not columns or len(columns) == 1:
        return 0
    # Find the shared prefix up to the last underscore
    prefix = columns[0]
    for col in columns[1:]:
        while not col.startswith(prefix):
            last_sep = prefix.rfind("_")
            if last_sep <= 0:
                return 0
            prefix = prefix[:last_sep + 1]
    return len(prefix)


@router.get("/available-columns/{strategy_name}")
def available_columns(strategy_name: str) -> dict[str, Any]:
    """Return all columns from configured indicators, grouped with labels.

    Computes a small sample of data to discover actual column names
    produced by each indicator with its configured parameters.
    """
    import json
    from pathlib import Path

    strategies_dir = get_strategies_dir()
    path = Path(strategies_dir) / f"{strategy_name}.json"
    if not path.exists():
        raise HTTPException(404, f"Strategy '{strategy_name}' not found")

    strategy_data = json.loads(path.read_text())
    indicators = strategy_data.get("pipeline", {}).get("indicators", [])

    if not indicators:
        return {"groups": [_price_columns_group()]}

    registry = get_plugin_registry()
    groups = []

    for ind_cfg in indicators:
        name = ind_cfg.get("name", "")
        params = ind_cfg.get("params", {})
        if not name:
            continue

        fqn = name if ":" in name else registry.resolve_name(name)
        try:
            plugin_cls = registry.get(fqn)
        except Exception:
            continue

        # Get column metadata from plugin class
        try:
            instance = plugin_cls()
            signal_cols = instance.get_signal_columns() if hasattr(instance, "get_signal_columns") else []
            feature_cols = instance.get_feature_columns() if hasattr(instance, "get_feature_columns") else []
            group_labels = instance.get_column_group_labels() if hasattr(instance, "get_column_group_labels") else {}
        except TypeError:
            signal_cols = plugin_cls.get_signal_columns() if hasattr(plugin_cls, "get_signal_columns") else []
            feature_cols = plugin_cls.get_feature_columns() if hasattr(plugin_cls, "get_feature_columns") else []
            group_labels = plugin_cls.get_column_group_labels() if hasattr(plugin_cls, "get_column_group_labels") else {}

        signal_set = set(signal_cols or [])
        all_cols = list(feature_cols or [])
        if not all_cols:
            continue

        prefix_len = _find_common_prefix_len(all_cols)

        columns = []
        for col in all_cols:
            short = col[prefix_len:].lstrip("_") if prefix_len else col
            label = _format_column_label(col, prefix_len)
            col_type = "signal" if col in signal_set else "plot"
            columns.append({
                "name": short,
                "full_name": col,
                "label": label,
                "type": col_type,
            })

        plugin_label = plugin_cls.name if hasattr(plugin_cls, "name") else fqn.split(":")[-1]
        groups.append({
            "fqn": fqn,
            "label": plugin_label.replace("_", " ").title(),
            "group_labels": group_labels,
            "columns": columns,
        })

    # Always include price columns
    groups.append(_price_columns_group())

    return {"groups": groups}


def _price_columns_group() -> dict:
    """Built-in price column group."""
    return {
        "fqn": "price",
        "label": "Preis",
        "group_labels": {},
        "columns": [
            {"name": "close", "full_name": "C", "label": "Close", "type": "plot"},
            {"name": "high", "full_name": "H", "label": "High", "type": "plot"},
            {"name": "low", "full_name": "L", "label": "Low", "type": "plot"},
            {"name": "open", "full_name": "O", "label": "Open", "type": "plot"},
        ],
    }
```

**Step 2: Register router in app**

In `/home/haex/Projekte/fwbg/src/fwbg/api/__init__.py`, add import:
```python
from fwbg.api.signal_composer import router as signal_composer_router
```

Add to `create_app()`:
```python
app.include_router(signal_composer_router, prefix="/api")
```

**Step 3: Test endpoint**

```bash
cd /home/haex/Projekte/fwbg && .venv/bin/python -c "
from fwbg.api.signal_composer import available_columns
# Will need a strategy file to test properly — verify module imports:
print('Module loads OK')
"
```

With running API:
```bash
curl http://localhost:8420/api/signal-composer/available-columns/orb_retest_v3 | python -m json.tool
```

**Step 4: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/api/signal_composer.py src/fwbg/api/__init__.py
git commit -m "feat: available-columns API for signal composer"
```

---

## Task 5: Backend — Signal Preview API

Endpoint to preview signal rule matches against real data.

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/api/signal_composer.py`

**Step 1: Add preview endpoint**

Append to `/home/haex/Projekte/fwbg/src/fwbg/api/signal_composer.py`:

```python
class SignalPreviewRequest(BaseModel):
    strategy_name: str
    symbol: str
    timeframe: str = "HOUR"
    source: str = "forexsb"
    rules: dict  # SignalRuleSet: {operator, conditions}
    direction: str = "long"
    limit: int = 5000


@router.post("/preview")
def signal_preview(req: SignalPreviewRequest) -> dict[str, Any]:
    """Preview signal rule matches against real indicator data.

    Computes indicators for the strategy's pipeline, evaluates the rules,
    and returns match count + timestamps.
    """
    import json
    from pathlib import Path
    from fwbg.pipeline.features import compute_indicator_pool
    from fwbg.signals.evaluator import evaluate_rules

    # Load strategy to get indicator configs
    strategies_dir = get_strategies_dir()
    path = Path(strategies_dir) / f"{req.strategy_name}.json"
    if not path.exists():
        raise HTTPException(404, f"Strategy '{req.strategy_name}' not found")

    strategy_data = json.loads(path.read_text())
    indicators = strategy_data.get("pipeline", {}).get("indicators", [])

    # Load OHLCV data (same pattern as chart.py compute_indicator)
    from fwbg.api.chart import _load_ohlcv_data
    df = _load_ohlcv_data(req.symbol, req.timeframe, req.source, req.limit)

    # Compute indicators
    if indicators:
        df = compute_indicator_pool(df, indicators)

    # Evaluate rules
    if not req.rules.get("conditions"):
        return {"match_count": 0, "total_bars": len(df), "timestamps": []}

    mask = evaluate_rules(req.rules, df)
    match_timestamps = [int(ts.timestamp()) for ts in df.index[mask]]

    return {
        "match_count": int(mask.sum()),
        "total_bars": len(df),
        "timestamps": match_timestamps,
    }
```

Note: `_load_ohlcv_data` may need to be extracted as a shared helper from `chart.py`. If it doesn't exist as a separate function, extract the data loading logic from `chart.py`'s `compute_indicator()` endpoint (lines 350-397) into a shared function, or inline the data loading here following the same pattern.

**Step 2: Test**

```bash
curl -X POST http://localhost:8420/api/signal-composer/preview \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "orb_retest_v3",
    "symbol": "NAS100",
    "timeframe": "HOUR",
    "rules": {
      "operator": "AND",
      "conditions": [{"type": "signal_active", "column": "breakout_up"}]
    },
    "direction": "long",
    "limit": 2000
  }' | python -m json.tool
```

**Step 3: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/api/signal_composer.py
git commit -m "feat: signal preview API endpoint"
```

---

## Task 6: Frontend — Types + API Proxy + Composable

Foundation types, Nitro proxy, and column discovery composable.

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/types/strategy.ts`
- Create: `/home/haex/Projekte/fwbg-dashboard/server/api/signal-composer/available-columns/[name].get.ts`
- Create: `/home/haex/Projekte/fwbg-dashboard/server/api/signal-composer/preview.post.ts`
- Create: `/home/haex/Projekte/fwbg-dashboard/composables/useSignalColumns.ts`

**Step 1: Add TypeScript types**

In `/home/haex/Projekte/fwbg-dashboard/types/strategy.ts`, add before the `StrategySummary` interface (line 202):

```typescript
// ──────────────────────────────────────────────
// Signal Composer Types
// ──────────────────────────────────────────────

export type SignalConditionType =
  | "signal_active"
  | "value_check"
  | "col_compare"
  | "crossing"
  | "group";

export interface SignalCondition {
  type: SignalConditionType;
  column?: string;
  column_a?: string;
  column_b?: string;
  op?: string;
  value?: number;
  direction?: "above" | "below";
  operator?: "AND" | "OR";
  conditions?: SignalCondition[];
}

export interface SignalRuleSet {
  operator: "AND" | "OR";
  conditions: SignalCondition[];
}

export interface SignalRules {
  long?: SignalRuleSet;
  short?: SignalRuleSet;
}

export interface ColumnInfo {
  name: string;
  full_name: string;
  label: string;
  type: "signal" | "plot";
}

export interface ColumnGroup {
  fqn: string;
  label: string;
  group_labels: Record<string, string>;
  columns: ColumnInfo[];
}

export interface AvailableColumnsResponse {
  groups: ColumnGroup[];
}

export interface SignalPreviewResponse {
  match_count: number;
  total_bars: number;
  timestamps: number[];
}
```

Add `signal_rules` to the `StrategyConfig` interface (after `model` block, line 180):

```typescript
signal_rules?: SignalRules;
```

**Step 2: Create API proxies**

Create `/home/haex/Projekte/fwbg-dashboard/server/api/signal-composer/available-columns/[name].get.ts`:
```typescript
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  return fwbgFetch(`/api/signal-composer/available-columns/${name}`);
});
```

Create `/home/haex/Projekte/fwbg-dashboard/server/api/signal-composer/preview.post.ts`:
```typescript
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch("/api/signal-composer/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
});
```

**Step 3: Create `useSignalColumns.ts` composable**

Create `/home/haex/Projekte/fwbg-dashboard/composables/useSignalColumns.ts`:
```typescript
import type {
  AvailableColumnsResponse,
  ColumnGroup,
  ColumnInfo,
} from "~/types/strategy";

export function useSignalColumns(strategyName: MaybeRef<string>) {
  const groups = ref<ColumnGroup[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetch() {
    const name = toValue(strategyName);
    if (!name) return;

    loading.value = true;
    error.value = null;
    try {
      const data = await $fetch<AvailableColumnsResponse>(
        `/api/signal-composer/available-columns/${encodeURIComponent(name)}`,
      );
      groups.value = data.groups;
    } catch (e: any) {
      error.value = e?.message ?? "Failed to load columns";
      groups.value = [];
    } finally {
      loading.value = false;
    }
  }

  const allColumns = computed<ColumnInfo[]>(() =>
    groups.value.flatMap((g) => g.columns),
  );

  const signalColumns = computed<ColumnInfo[]>(() =>
    allColumns.value.filter((c) => c.type === "signal"),
  );

  /** Flat items for USelect dropdown, grouped by indicator. */
  const columnItems = computed(() =>
    groups.value.map((g) => ({
      label: g.label,
      items: g.columns.map((c) => ({
        label: c.label,
        value: c.name,
        description: c.full_name,
      })),
    })),
  );

  /** Signal-only items for USelect dropdown. */
  const signalColumnItems = computed(() =>
    groups.value
      .map((g) => ({
        label: g.label,
        items: g.columns
          .filter((c) => c.type === "signal")
          .map((c) => ({
            label: c.label,
            value: c.name,
            description: c.full_name,
          })),
      }))
      .filter((g) => g.items.length > 0),
  );

  return {
    groups,
    allColumns,
    signalColumns,
    columnItems,
    signalColumnItems,
    loading,
    error,
    fetch,
  };
}
```

**Step 4: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add types/strategy.ts server/api/signal-composer/ composables/useSignalColumns.ts
git commit -m "feat: signal composer types, API proxy, column composable"
```

---

## Task 7: Frontend — Signal Rule Editor Components

The main UI: recursive nested rule builder.

**Files:**
- Create: `/home/haex/Projekte/fwbg-dashboard/components/strategy/SignalCondition.vue`
- Create: `/home/haex/Projekte/fwbg-dashboard/components/strategy/SignalRuleGroup.vue`
- Create: `/home/haex/Projekte/fwbg-dashboard/components/strategy/SignalRuleEditor.vue`

**Step 1: Create SignalCondition.vue**

This is a single condition row. The type dropdown determines which fields are shown.

Create `/home/haex/Projekte/fwbg-dashboard/components/strategy/SignalCondition.vue`:
```vue
<script setup lang="ts">
import type { SignalCondition } from "~/types/strategy";

const props = defineProps<{
  modelValue: SignalCondition;
  columnItems: { label: string; items: { label: string; value: string }[] }[];
  signalColumnItems: { label: string; items: { label: string; value: string }[] }[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SignalCondition];
  remove: [];
}>();

const condition = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const conditionTypes = [
  { label: "Signal aktiv", value: "signal_active" },
  { label: "Wert-Check", value: "value_check" },
  { label: "Spalten-Vergleich", value: "col_compare" },
  { label: "Crossing", value: "crossing" },
];

const operators = [
  { label: "==", value: "==" },
  { label: "!=", value: "!=" },
  { label: "<", value: "<" },
  { label: "<=", value: "<=" },
  { label: ">", value: ">" },
  { label: ">=", value: ">=" },
];

const crossDirections = [
  { label: "kreuzt über", value: "above" },
  { label: "kreuzt unter", value: "below" },
];

function updateField(field: string, value: any) {
  emit("update:modelValue", { ...condition.value, [field]: value });
}

function changeType(type: string) {
  // Reset fields when type changes
  const base: SignalCondition = { type: type as SignalCondition["type"] };
  if (type === "signal_active") base.column = "";
  if (type === "value_check") {
    base.column = "";
    base.op = "==";
    base.value = 1;
  }
  if (type === "col_compare") {
    base.column_a = "";
    base.op = ">";
    base.column_b = "";
  }
  if (type === "crossing") {
    base.column_a = "";
    base.direction = "above";
    base.column_b = "";
  }
  emit("update:modelValue", base);
}
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <!-- Condition Type -->
    <USelect
      :model-value="condition.type"
      :items="conditionTypes"
      value-key="value"
      class="w-40"
      @update:model-value="changeType"
    />

    <!-- Signal Active: just a column picker -->
    <template v-if="condition.type === 'signal_active'">
      <USelectMenu
        :model-value="condition.column"
        :items="signalColumnItems"
        value-key="value"
        placeholder="Signal wählen..."
        class="w-52"
        @update:model-value="updateField('column', $event)"
      />
      <span class="text-sm text-gray-400">ist aktiv</span>
    </template>

    <!-- Value Check: column op value -->
    <template v-if="condition.type === 'value_check'">
      <USelectMenu
        :model-value="condition.column"
        :items="columnItems"
        value-key="value"
        placeholder="Spalte..."
        class="w-44"
        @update:model-value="updateField('column', $event)"
      />
      <USelect
        :model-value="condition.op"
        :items="operators"
        value-key="value"
        class="w-20"
        @update:model-value="updateField('op', $event)"
      />
      <UInput
        :model-value="String(condition.value ?? '')"
        type="number"
        step="any"
        class="w-24"
        @update:model-value="updateField('value', Number($event))"
      />
    </template>

    <!-- Column Compare: column_a op column_b -->
    <template v-if="condition.type === 'col_compare'">
      <USelectMenu
        :model-value="condition.column_a"
        :items="columnItems"
        value-key="value"
        placeholder="Spalte A..."
        class="w-44"
        @update:model-value="updateField('column_a', $event)"
      />
      <USelect
        :model-value="condition.op"
        :items="operators"
        value-key="value"
        class="w-20"
        @update:model-value="updateField('op', $event)"
      />
      <USelectMenu
        :model-value="condition.column_b"
        :items="columnItems"
        value-key="value"
        placeholder="Spalte B..."
        class="w-44"
        @update:model-value="updateField('column_b', $event)"
      />
    </template>

    <!-- Crossing: column_a crosses above/below column_b -->
    <template v-if="condition.type === 'crossing'">
      <USelectMenu
        :model-value="condition.column_a"
        :items="columnItems"
        value-key="value"
        placeholder="Spalte A..."
        class="w-44"
        @update:model-value="updateField('column_a', $event)"
      />
      <USelect
        :model-value="condition.direction"
        :items="crossDirections"
        value-key="value"
        class="w-36"
        @update:model-value="updateField('direction', $event)"
      />
      <USelectMenu
        :model-value="condition.column_b"
        :items="columnItems"
        value-key="value"
        placeholder="Spalte B..."
        class="w-44"
        @update:model-value="updateField('column_b', $event)"
      />
    </template>

    <!-- Delete button -->
    <UButton
      icon="i-heroicons-x-mark"
      variant="ghost"
      color="error"
      size="xs"
      @click="emit('remove')"
    />
  </div>
</template>
```

**Step 2: Create SignalRuleGroup.vue (recursive)**

Create `/home/haex/Projekte/fwbg-dashboard/components/strategy/SignalRuleGroup.vue`:
```vue
<script setup lang="ts">
import type { SignalCondition, SignalRuleSet } from "~/types/strategy";

const props = defineProps<{
  modelValue: SignalRuleSet;
  label: string;
  columnItems: { label: string; items: { label: string; value: string }[] }[];
  signalColumnItems: { label: string; items: { label: string; value: string }[] }[];
  depth?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SignalRuleSet];
}>();

const rules = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const depth = computed(() => props.depth ?? 0);

function toggleOperator() {
  emit("update:modelValue", {
    ...rules.value,
    operator: rules.value.operator === "AND" ? "OR" : "AND",
  });
}

function updateCondition(index: number, cond: SignalCondition) {
  const updated = [...rules.value.conditions];
  updated[index] = cond;
  emit("update:modelValue", { ...rules.value, conditions: updated });
}

function removeCondition(index: number) {
  const updated = rules.value.conditions.filter((_, i) => i !== index);
  emit("update:modelValue", { ...rules.value, conditions: updated });
}

function addCondition() {
  const newCond: SignalCondition = { type: "signal_active", column: "" };
  emit("update:modelValue", {
    ...rules.value,
    conditions: [...rules.value.conditions, newCond],
  });
}

function addGroup() {
  const newGroup: SignalCondition = {
    type: "group",
    operator: "OR",
    conditions: [{ type: "signal_active", column: "" }],
  };
  emit("update:modelValue", {
    ...rules.value,
    conditions: [...rules.value.conditions, newGroup],
  });
}

function updateNestedGroup(index: number, nested: SignalRuleSet) {
  const updated = [...rules.value.conditions];
  updated[index] = { type: "group", ...nested };
  emit("update:modelValue", { ...rules.value, conditions: updated });
}

function removeGroup(index: number) {
  removeCondition(index);
}
</script>

<template>
  <div
    class="rounded-lg border p-3 space-y-2"
    :class="depth === 0 ? 'border-gray-700 bg-gray-900/50' : 'border-gray-700/50 bg-gray-800/30'"
  >
    <!-- Header: label + AND/OR toggle -->
    <div class="flex items-center gap-2">
      <span v-if="depth === 0" class="text-sm font-medium text-gray-300">{{ label }}</span>
      <UButton
        size="xs"
        :variant="rules.operator === 'AND' ? 'solid' : 'outline'"
        @click="toggleOperator"
      >
        {{ rules.operator === "AND" ? "ALLE (AND)" : "EINE (OR)" }}
      </UButton>
    </div>

    <!-- Conditions -->
    <div class="space-y-2 pl-2">
      <template v-for="(cond, i) in rules.conditions" :key="i">
        <!-- Nested group -->
        <template v-if="cond.type === 'group'">
          <div class="relative">
            <StrategySignalRuleGroup
              :model-value="{ operator: cond.operator ?? 'AND', conditions: cond.conditions ?? [] }"
              label=""
              :column-items="columnItems"
              :signal-column-items="signalColumnItems"
              :depth="depth + 1"
              @update:model-value="updateNestedGroup(i, $event)"
            />
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="error"
              size="xs"
              class="absolute top-2 right-2"
              @click="removeGroup(i)"
            />
          </div>
        </template>

        <!-- Regular condition -->
        <template v-else>
          <div class="flex items-center gap-1">
            <span
              v-if="i > 0"
              class="text-xs text-gray-500 w-10 text-center shrink-0"
            >
              {{ rules.operator }}
            </span>
            <span v-else class="w-10 shrink-0" />
            <StrategySignalCondition
              :model-value="cond"
              :column-items="columnItems"
              :signal-column-items="signalColumnItems"
              @update:model-value="updateCondition(i, $event)"
              @remove="removeCondition(i)"
            />
          </div>
        </template>
      </template>
    </div>

    <!-- Add buttons -->
    <div class="flex gap-2 pl-12">
      <UButton variant="soft" size="xs" icon="i-heroicons-plus" @click="addCondition">
        Bedingung
      </UButton>
      <UButton
        v-if="depth < 2"
        variant="soft"
        size="xs"
        icon="i-heroicons-folder-plus"
        @click="addGroup"
      >
        Gruppe
      </UButton>
    </div>
  </div>
</template>
```

**Step 3: Create SignalRuleEditor.vue (main wrapper)**

Create `/home/haex/Projekte/fwbg-dashboard/components/strategy/SignalRuleEditor.vue`:
```vue
<script setup lang="ts">
import type { SignalRules, SignalRuleSet, SignalPreviewResponse } from "~/types/strategy";

const props = defineProps<{
  modelValue?: SignalRules;
  strategyName: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SignalRules];
}>();

const { columnItems, signalColumnItems, loading: columnsLoading, fetch: fetchColumns } = useSignalColumns(
  () => props.strategyName,
);

onMounted(fetchColumns);

const rules = computed({
  get: () => props.modelValue ?? {},
  set: (v) => emit("update:modelValue", v),
});

const emptyRuleSet = (): SignalRuleSet => ({
  operator: "AND",
  conditions: [],
});

const longRules = computed({
  get: () => rules.value.long ?? emptyRuleSet(),
  set: (v) => emit("update:modelValue", { ...rules.value, long: v }),
});

const shortRules = computed({
  get: () => rules.value.short ?? emptyRuleSet(),
  set: (v) => emit("update:modelValue", { ...rules.value, short: v }),
});

// Preview
const preview = ref<{ long: number; short: number } | null>(null);
const previewLoading = ref(false);

async function loadPreview() {
  previewLoading.value = true;
  try {
    const [longRes, shortRes] = await Promise.all(
      (["long", "short"] as const).map((dir) => {
        const r = dir === "long" ? longRules.value : shortRules.value;
        if (!r.conditions.length) return { match_count: 0, total_bars: 0, timestamps: [] };
        return $fetch<SignalPreviewResponse>("/api/signal-composer/preview", {
          method: "POST",
          body: {
            strategy_name: props.strategyName,
            rules: r,
            direction: dir,
          },
        });
      }),
    );
    preview.value = { long: longRes.match_count, short: shortRes.match_count };
  } catch {
    preview.value = null;
  } finally {
    previewLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="columnsLoading" class="text-sm text-gray-500">
      Spalten werden geladen...
    </div>

    <template v-else>
      <StrategySignalRuleGroup
        v-model="longRules"
        label="LONG"
        :column-items="columnItems"
        :signal-column-items="signalColumnItems"
      />

      <StrategySignalRuleGroup
        v-model="shortRules"
        label="SHORT"
        :column-items="columnItems"
        :signal-column-items="signalColumnItems"
      />

      <!-- Preview -->
      <div class="flex items-center gap-3">
        <UButton
          variant="soft"
          size="sm"
          :loading="previewLoading"
          icon="i-heroicons-eye"
          @click="loadPreview"
        >
          Preview
        </UButton>
        <span v-if="preview" class="text-sm text-gray-400">
          <span class="text-green-400">{{ preview.long }} Long</span> /
          <span class="text-red-400">{{ preview.short }} Short</span> Matches
        </span>
      </div>
    </template>
  </div>
</template>
```

**Step 4: Verify components load**

Start dev server and navigate to strategy page. The components won't be visible yet (wired in Task 8) but should compile without errors:

```bash
cd /home/haex/Projekte/fwbg-dashboard && npx nuxi typecheck
```

**Step 5: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add components/strategy/SignalCondition.vue \
      components/strategy/SignalRuleGroup.vue \
      components/strategy/SignalRuleEditor.vue
git commit -m "feat: signal rule editor components (condition, group, editor)"
```

---

## Task 8: Frontend — Model Tab Integration

Wire the signal rule editor into the existing model page.

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/pages/strategy/[name]/model.vue`

**Step 1: Add signal_rules reactive binding and conditional rendering**

Modify `/home/haex/Projekte/fwbg-dashboard/pages/strategy/[name]/model.vue`:

1. Add imports and computed for filename:
```typescript
const route = useRoute();
const strategyName = computed(() => String(route.params.name));
```

2. Add computed to detect signal mode:
```typescript
const hasSignalRules = computed(() =>
  config.value?.signal_rules &&
  (config.value.signal_rules.long?.conditions?.length ||
   config.value.signal_rules.short?.conditions?.length)
);

const showRuleEditor = computed(() =>
  config.value?.model?.type === "signal" || hasSignalRules.value
);
```

3. In the template, replace the entire Hyperparameter `<UCard>` block (lines 112-163) with conditional rendering:

```vue
<!-- Signal Rule Editor (when signal model or signal_rules exist) -->
<UCard v-if="showRuleEditor">
  <template #header>
    <h3 class="text-lg font-medium text-white">Signal Rules</h3>
    <p v-if="config.model.type !== 'signal'" class="text-sm text-gray-400 mt-1">
      Regeln werden als Features für das ML-Modell verwendet.
    </p>
  </template>
  <StrategySignalRuleEditor
    :model-value="config.signal_rules"
    :strategy-name="strategyName"
    @update:model-value="config.signal_rules = $event"
  />
</UCard>

<!-- Standard Hyperparameters (when NOT using signal rules) -->
<UCard v-else>
  <template #header>
    <h3 class="text-lg font-medium text-white">Hyperparameter</h3>
  </template>
  <!-- ... existing hyperparameter editor code ... -->
</UCard>
```

4. Initialize signal_rules when switching to signal model type:
```typescript
watch(() => config.value?.model?.type, (newType) => {
  if (newType === "signal" && !config.value?.signal_rules) {
    config.value!.signal_rules = {
      long: { operator: "AND", conditions: [] },
      short: { operator: "AND", conditions: [] },
    };
  }
});
```

**Step 2: Test in browser**

1. Open strategy page with a signal model → rule editor should appear
2. Open strategy page with xgboost model → standard hyperparameter editor should appear
3. Switch model type to "signal" → rule editor should appear with empty rules
4. Add conditions → verify they're saved to config

**Step 3: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add pages/strategy/[name]/model.vue
git commit -m "feat: integrate signal rule editor into model tab"
```

---

## Task 9: Frontend — Polish & Edge Cases

Final polish: handle edge cases, ensure save/load roundtrip works.

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/composables/useStrategy.ts` (if signal_rules needs special handling in toJson/syncFromConfig)
- Modify: `/home/haex/Projekte/fwbg-dashboard/stores/strategyConfig.ts` (if needed)

**Step 1: Verify save/load roundtrip**

1. Open strategy → add signal rules → save
2. Reload page → rules should still be there
3. Check that `signal_rules` appears in the saved JSON

The `strategyConfig` store uses `buildSavePayload()` to serialize. Since `signal_rules` is a top-level key on `StrategyConfig` and the store sends the full config object, it should work automatically. Verify:

```bash
# After saving through the UI, check the strategy file:
cat /home/haex/Projekte/fwbg/strategies/<strategy_name>.json | python -m json.tool | grep -A 20 signal_rules
```

**Step 2: Handle missing signal_rules gracefully**

In `useStrategy.ts`, the `toJson()` function builds the strategy config from lanes. If `signal_rules` lives on the config store directly (not in a lane), ensure it's preserved during toJson → verify that `store.config.signal_rules` is included in the save payload.

Check `stores/strategyConfig.ts`'s `buildSavePayload()` — if it filters keys, ensure `signal_rules` passes through.

**Step 3: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add -u
git commit -m "fix: signal rules save/load roundtrip edge cases"
```

---

## Verification Checklist

1. **Evaluator tests**: `cd /home/haex/Projekte/fwbg && .venv/bin/python -m pytest tests/signals/test_evaluator.py -v`
2. **Existing tests pass**: `.venv/bin/python -m pytest tests/ -x --timeout=120`
3. **Available columns API**: `curl http://localhost:8420/api/signal-composer/available-columns/<strategy_name>`
4. **Preview API**: POST to `/api/signal-composer/preview` with rules → get match count
5. **Config roundtrip**: Save strategy with signal_rules → reload → rules preserved
6. **UI: Signal model**: rule editor shows, standard hyperparams hidden
7. **UI: ML model + rules**: rule editor shows with ML info text
8. **UI: ML model no rules**: standard hyperparams show
9. **UI: Add conditions**: each type renders correct fields
10. **UI: Nested groups**: can create AND inside OR groups, max depth 2
11. **UI: Column dropdowns**: grouped by indicator, readable labels
12. **End-to-end**: Run optimization with signal_rules → composed columns used → trades generated
