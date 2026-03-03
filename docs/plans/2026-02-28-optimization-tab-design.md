# Optimization-Tab & Grid-Umbau Design

## Ziel

Grid-Konfiguration von per-Asset-Klasse-Mapping in ein globales, exit-strategie-zentriertes System umbauen. Neues Optimization-Tab im Strategy-Editor.

## Kernentscheidungen

- **Keine per-Asset Grid-Konfiguration mehr** — eine Config gilt für alle Assets
- **`exit_params` werden Arrays** — `tp_mult: [1.5, 2.0]` statt `tp_mult: 2.0`. Ein Eintrag = fester Wert, mehrere = Grid-Search
- **Neues `optimization` Feld** für CT, Regime-Filter, min_rrr
- **`grids` Feld entfällt** komplett
- **Keine Legacy-Kompatibilität** — alle bestehenden Strategy-JSONs werden migriert
- **Separate Long/Short Grid-Werte** bleiben möglich über `long_`/`short_`-Prefixes in exit_params

## Neue Datenstruktur (Strategy-JSON)

```json
{
  "name": "orb-asx200",
  "datasource": "IG_CFD",
  "timeframe": "MINUTE_15",

  "pipeline": {
    "data_loading": [],
    "preprocessing": [],
    "indicators": [
      { "name": "opening_range", "params": { "range_bars": 2 } }
    ],
    "feature_selection": []
  },

  "exit_strategy": "orb_based",
  "exit_params": {
    "tp_mult": [1.5, 2.0, 2.5, 3.0],
    "sl_mult": [1.0],
    "atr_period": [14],
    "min_tp_pips": [8],
    "min_sl_pips": [5],
    "timeout_bars": [null, 24, 48]
  },

  "optimization": {
    "ct": [0.50, 0.55, 0.60],
    "min_rrr": 1.0,
    "regime_filter_grid": {
      "condition_grids": []
    }
  },

  "model": {
    "type": "signal",
    "architecture": "unified",
    "trade_directions": ["long", "short"]
  },

  "assets": {
    "filter": [],
    "exclude": []
  },

  "validation": { ... },
  "filters": { ... },
  "resources": { ... }
}
```

### Long/Short separate Grid-Werte

Wenn `model.architecture === "long_short_separate"`, können exit_params richtungsspezifische Overrides haben:

```json
{
  "exit_params": {
    "tp_mult": [1.5, 2.0, 2.5],
    "sl_mult": [1.0],
    "long_tp_mult": [2.0, 3.0, 4.0],
    "short_tp_mult": [1.5, 2.0],
    "long_sl_mult": [0.8, 1.0],
    "timeout_bars": [null]
  }
}
```

`long_*` / `short_*` überschreiben den Basis-Wert für die jeweilige Richtung. Ohne Prefix gilt der Wert für beide.

### Separate Long/Short CT

```json
{
  "optimization": {
    "ct": [0.50, 0.55, 0.60],
    "long_ct": [0.55, 0.60, 0.65],
    "short_ct": [0.50, 0.55]
  }
}
```

## Tab-Struktur

`Übersicht | Pipeline | Model | Optimization | Assets | Validation | Filters | Resources`

### Optimization-Tab Inhalt

1. **Exit-Strategie Grid**
   - Header zeigt aktive Exit-Strategie (z.B. "orb_based")
   - Parameter aus `exit_strategy.get_param_schema()` als Wertelisten
   - Jeder Parameter: Badges + Add-Input (wie bisheriger Grid-Editor)
   - Optional Long/Short-Tabs wenn `model.architecture === "long_short_separate"`

2. **Confidence Threshold**
   - Werteliste: `[0.50, 0.55, 0.60]`
   - Optional separate Long/Short CT

3. **Regime-Filter Grid**
   - Conditions: Column, Operator, Values, Directions, Else-Directions
   - Gleiche UI wie bisher

4. **Constraints**
   - `min_rrr`: Minimum Risk-Reward-Ratio (filtert Grid-Combos wo TP/SL < Schwelle)

### Assets-Tab (vereinfacht)

Nur noch:
- Datasource-Auswahl
- Timeframe-Auswahl
- Asset-Filter (nur diese handeln)
- Ausgeschlossene Assets

Kein Grid-Editor, keine Handelsparameter, keine Grid-Presets.

## Was wegfällt

### Frontend
- `config.grids` per-Asset-Klasse Mapping
- Grid-Presets und `StrategyPresetSelectorBar` im Assets-Tab
- Handelsparameter-Sektion (TP/SL/CT/Timeout/Regime) im Assets-Tab
- `GridEntry` Type in grids.vue
- Grid-Preset Logik in `strategyConfig.ts` (`applyGridPreset`, `detachGridPreset`, `computeGridOverrides`, `GRID_OVERRIDE_KEYS`)

### Backend
- `GridConfig` Dataclass (oder stark vereinfacht)
- `_parse_grids()` Preset-Resolution
- `strategy.get_grid(sym, asset_class)` per-Asset Lookup
- `_serialize_grid()` in strategies.py
- Per-Asset `indicator_overrides`, `model_hyperparameters`, `required_features`, `model_hyperparameters_grid` in GridConfig
- Grid-Presets Dateien in `strategies/grids/`

## Backend-Änderungen

### `core/config.py`

- `StrategyConfig.grids` → entfernen
- `StrategyConfig.optimization` → neu (ct, min_rrr, regime_filter_grid)
- `StrategyConfig.exit_params` → Dict[str, List] statt Dict[str, Any]
- `StrategyConfig.get_grid()` → entfernen
- `GridConfig` → entfernen oder durch einfache Datenklasse ersetzen die aus exit_params + optimization gebaut wird
- `StrategyConfig.from_dict()` → exit_params Werte zu Arrays konvertieren

### `core/context.py`

- `SimulationContext.create()` → Grid-Werte aus `exit_params` (Arrays) + `optimization` statt per-Asset GridConfig
- `grid_tp`, `grid_sl` → aus exit_params.tp_mult, exit_params.sl_mult
- `grid_ct` → aus optimization.ct
- Entferne: `long_grid_*`, `short_grid_*` per-Asset Felder → ersetze durch globale long/short aus exit_params

### `optimization/process.py`

- `process_symbol()` → kein `strategy.get_grid(sym, asset_class)` mehr
- Grid wird einmal global aus exit_params + optimization gebaut

### `optimization/grid_search.py`

- `_build_combo_tuples()` → iteriert über exit_params Arrays statt grid.tp/grid.sl

### `api/strategies.py`

- `_serialize_grid()` → entfernen
- `get_strategy()` → keine Grid-Preset-Resolution mehr, exit_params direkt durchreichen

## Migration

Alle bestehenden Strategy-JSONs unter `strategies/configs/` anpassen:
1. `exit_params` skalare Werte → Arrays: `tp_mult: 2.0` → `tp_mult: [2.0]`
2. Grid-Werte aus `grids` → in `exit_params` als Arrays (tp → tp_mult, sl → sl_mult)
3. CT, regime_filter_grid, min_rrr → in neues `optimization` Feld
4. `grids` Feld entfernen
5. Per-Asset overrides (indicator_overrides, model_hyperparameters, required_features) → in globale Config oder entfernen

Grid-Preset-Dateien unter `strategies/grids/` können nach Migration entfernt werden.
