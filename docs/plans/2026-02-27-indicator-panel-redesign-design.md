# Design: Indicator Panel Redesign

## Probleme (Status Quo)

1. **Browse-Liste splittet Plugins in kryptische Sub-Einträge** — Opening Range wird zu "S00", "S01" etc. basierend auf statischen `feature_columns` Metadaten
2. **Mismatch zwischen Metadaten und Berechnung** — S00 angeklickt, aber s08/s09/s14/s15 Columns angezeigt, weil Default-Params andere Sessions haben
3. **Column-Auswahl ist eine Wand aus technischen Namen** — 30+ Checkboxen mit Namen wie `s08_breakout_up`
4. **Reihenfolge falsch** — Parameter zuerst, aber die meisten User wollen nur "MACD hinzufügen" mit Defaults

## Design

### Browse-Liste

- **Ein Eintrag pro Plugin** (kein Feature-Column-Splitting mehr)
- Plugin-Name, Beschreibung, Typ-Badges (SIG/IND)
- Filter (Alle/Indikatoren/Signale) und Suche bleiben

### Config-View (nach Klick auf Plugin)

**Neue Reihenfolge:**

1. **Feature-Gruppen-Auswahl (primär)**
   - Gruppen-Checkboxen aus tatsächlich berechneten Columns (nicht Metadaten)
   - Labels aus `column_group_labels` (Backend), Fallback auf Prefix-Logik
   - Aufklappbar: einzelne Columns mit Checkbox + Farbpicker
   - Signal-Columns als eigene Sektion unten

2. **Parameter (sekundär)**
   - Ausklappbarer Bereich unter den Gruppen
   - Parameter-Änderung → Columns neu laden → Gruppen aktualisieren

3. **Add-Button**
   - "X Columns + Y Signals hinzufügen"

### Backend: `get_column_group_labels()`

Neue optionale Methode in `BaseIndicator` (fwbg-sdk):

```python
def get_column_group_labels(self) -> dict[str, str]:
    """Optional: human-readable labels for column groups."""
    return {}
```

- Opening Range liefert z.B. `{"s08": "London Open — 08:00 UTC"}`
- Trend liefert z.B. `{"adx": "ADX (Average Directional Index)", "macd": "MACD"}`
- Plugins ohne Implementierung → `{}` → Frontend nutzt Prefix-Logik

API-Endpoint `/api/plugins` liefert neues optionales Feld `column_group_labels: Record<string, string>` in PluginInfo.

## Datenfluss

```
Browse-Liste (1:1 Plugin-Einträge)
  → Klick auf "Opening Range"
  → fetchColumns() mit Default-Params
  → API liefert echte plot_columns + signal_columns
  → Gruppierung aus echten Columns + Labels aus column_group_labels
  → User wählt Gruppen (aufklappbar: einzelne Columns)
  → Optional: Parameter ändern → fetchColumns() erneut
  → "Hinzufügen" → Chart
```

## Was sich ändert

- Browse-Liste: Kein Feature-Column-Splitting
- Config-View: Gruppen zuerst, Parameter sekundär
- Backend SDK: `get_column_group_labels()` + API-Feld
- Mismatch-Bug gelöst (Gruppierung auf echten Columns)

## Was gleich bleibt

- Chart-Rendering, Indicator-Registration, Signal-Handling
- API-Endpoint `/api/chart/indicator`
- `useChartIndicatorActions` Composable
- Farbpicker, Overlay-Toggle, Add-Button-Logik
