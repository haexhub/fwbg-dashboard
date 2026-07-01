# Datasource Adapter Interface

**Ziel:** Einheitliches Interface für alle Datenquellen, sodass das System (fwbg, fwbg-agents, dashboard) weiß welche Assets verfügbar sind — unabhängig von der Herkunft (CSV, REST, WebSocket, DB).

**Auslöser:** Research-Modal zeigt leeres Asset-Dropdown, weil es nur Criteria-YAMLs aus fwbg-agents kennt. Dukascopy-Daten und andere Quellen sind dem System nicht bekannt.

---

## Architektur

```
fwbg             → DataSourceAdapter interface + Implementierungen + GET /api/datasources/assets
fwbg-dashboard   → Proxy-Endpoint + Research-Modal-Update
fwbg-agents      → Nutzt fwbg-Endpoint (ruft fwbg auf statt eigene Datasource-Logik)
```

---

## Phase 1 — fwbg: DataSourceAdapter Interface

**Repo:** `fwbg` (Python), Branch von `develop`

### 1.1 AssetInfo-Datenmodell

```python
# fwbg/datasources/types.py (oder datasources/adapter.py)

from dataclasses import dataclass
from datetime import date

@dataclass
class AssetInfo:
    symbol: str            # "EURUSD"
    timeframes: list[str]  # ["MINUTE_1", "HOUR_1", "DAY_1"]
    date_from: date | None # frühestes verfügbares Datum
    date_to: date | None   # letztes verfügbares Datum
    source: str            # Name der Datasource-Instanz
    source_type: str       # "csv" | "rest" | "websocket" | "database"
```

### 1.2 Protocol / ABC

```python
# fwbg/datasources/adapter.py

from typing import Protocol, runtime_checkable
import pandas as pd

@runtime_checkable
class DataSourceAdapter(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def source_type(self) -> str: ...

    def list_assets(self) -> list[AssetInfo]:
        """Gibt alle verfügbaren Assets dieser Quelle zurück."""
        ...

    def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        start: date,
        end: date,
    ) -> pd.DataFrame:
        """Liefert OHLCV-Daten (Spalten: open, high, low, close, volume)."""
        ...
```

### 1.3 Adapter-Implementierungen

**CSVAdapter** (`fwbg/datasources/csv_adapter.py`):
- `list_assets()`: Scant Files die auf `file_pattern` matchen (Standard: `{SYMBOL}_{TF}.csv`)
- Parsed Dateinamen → symbol + timeframe
- Liest erstes/letztes Datum aus Datei für `date_from`/`date_to`
- `get_ohlcv()`: Liest entsprechende CSV-Datei

**RESTAdapter** (`fwbg/datasources/rest_adapter.py`):
- `list_assets()`: Ruft konfigurierbaren Discovery-Endpunkt auf ODER liest explizite `assets`-Liste aus Config
- Config-Erweiterung: `assets: list[{symbol, timeframes}]` (Fallback wenn kein Discovery-Endpoint)
- `get_ohlcv()`: Wie bisher

**WebSocketAdapter** (`fwbg/datasources/websocket_adapter.py`):
- `list_assets()`: Liest explizite `assets`-Liste aus Config (kann nicht auto-enumerated werden)
- Config-Erweiterung: `assets: list[{symbol, timeframes}]` — Pflichtfeld
- `get_ohlcv()`: n/a (Streaming, kein historischer Abruf) → raises `NotImplementedError`

**DBAdapter** (`fwbg/datasources/db_adapter.py`):
- `list_assets()`: Führt konfigurierbare Query aus, z.B. `SELECT DISTINCT symbol FROM ohlcv`
- Config-Erweiterung: `assets_query: str` (optional, Fallback: explizite `assets`-Liste)
- `get_ohlcv()`: Wie bisher

### 1.4 Adapter-Registry

```python
# fwbg/datasources/registry.py

def get_adapter(config: dict) -> DataSourceAdapter:
    match config["type"]:
        case "csv":       return CSVAdapter(config)
        case "rest":      return RESTAdapter(config)
        case "websocket": return WebSocketAdapter(config)
        case "database":  return DBAdapter(config)
        case _:           raise ValueError(f"Unknown source type: {config['type']}")
```

### 1.5 Neuer Endpunkt in fwbg

```
GET /api/datasources/assets
```

Response:
```json
{
  "assets": [
    {
      "symbol": "EURUSD",
      "timeframes": ["MINUTE_1", "HOUR_1"],
      "date_from": "2020-01-01",
      "date_to": "2025-12-31",
      "source": "dukascopy_fx",
      "source_type": "csv"
    }
  ],
  "by_source": {
    "dukascopy_fx": [ ... ],
    "my_rest_api":  [ ... ]
  }
}
```

Implementierung: Alle konfigurierten Datasources laden → Adapter instanziieren → `list_assets()` aufrufen → deduplizieren (gleicher symbol kann in mehreren Quellen vorkommen, beide behalten mit `source`-Angabe).

---

## Phase 2 — fwbg-dashboard: Proxy + Modal

**Repo:** `fwbg-dashboard`, Branch von `develop`

### 2.1 Neuer Proxy-Endpoint

```
server/api/datasources/assets.get.ts
```

```typescript
export default defineEventHandler(async () => {
  return fwbgFetch<AssetsResponse>("/api/datasources/assets");
});
```

Types in `types/datasource.ts` ergänzen:

```typescript
export interface AssetInfo {
  symbol: string;
  timeframes: string[];
  date_from: string | null;
  date_to: string | null;
  source: string;
  source_type: SourceType;
}

export interface AssetsResponse {
  assets: AssetInfo[];
  by_source: Record<string, AssetInfo[]>;
}
```

### 2.2 useDataSourceAssets Composable

```typescript
// composables/useDataSourceAssets.ts

export function useDataSourceAssets() {
  const { data, status, refresh } = useFetch<AssetsResponse>("/api/datasources/assets", {
    default: () => ({ assets: [], by_source: {} }),
  });

  const availableSymbols = computed(() =>
    [...new Set(data.value?.assets.map((a) => a.symbol) ?? [])]
  );

  return { data, status, refresh, availableSymbols };
}
```

### 2.3 ResearchBriefModal.vue aktualisieren

- `useDataSourceAssets()` statt nur `useAgentCriteria()` für die Asset-Optionen nutzen
- Dropdown zeigt: Criteria-Asset-Classes (aus fwbg-agents) + verfügbare Symbole (aus fwbg)
- Label "Asset Class" → "Asset / Asset Class" oder mit Tooltip erklären
- Hinweis-Text aus aktuellem Fix entfernen (wird durch echte Daten ersetzt)
- Ladestate im Dropdown anzeigen wenn Assets noch geladen werden

### 2.4 Hinweis-Text aus aktuellem Fix entfernen

Den in `ResearchBriefModal.vue` ergänzten `<p>` mit dem "Noch keine Klassen"-Text wieder entfernen, sobald Phase 2.3 umgesetzt ist.

---

## Phase 3 — fwbg-agents: fwbg-Assets nutzen

**Repo:** `fwbg-agents`, Branch von `develop`

- Researcher-Agent beim Start einen `list_assets()`-Call gegen fwbg machen lassen
- Damit weiß der Agent welche Symbole/Daten verfügbar sind und kann gezielter forschen
- `asset_class` im Research-Brief bleibt erhalten als Gruppierungs-/Scope-Konzept, aber der Agent
  kann nun die konkreten Symbole selbst auflösen

---

## Reihenfolge

1. **fwbg Phase 1** (Interface + CSV-Adapter + Endpunkt) — CSV deckt den Haupt-Use-Case (Dukascopy) ab
2. **fwbg-dashboard Phase 2** (Proxy + Composable + Modal) — sofort nutzbar nach Phase 1
3. **fwbg Phase 1 fortsetzung** (REST/WebSocket/DB-Adapter) — wenn weitere Quellen genutzt werden
4. **fwbg-agents Phase 3** — optionale Vertiefung, macht den Researcher smarter

## Offene Fragen

- Soll `asset_class` im Research-Brief komplett durch Symbole ersetzt werden, oder bleibt es als
  freies Gruppenkonzept neben den Symbolen bestehen?
- Wie soll mit Symbolen umgegangen werden die in mehreren Quellen verfügbar sind (z.B. EURUSD in
  CSV und REST)? Dedupliziert anzeigen oder alle Quellen einzeln auflisten?
- Performance: `list_assets()` für DB-Adapter kann bei großen Datenbanken langsam sein → Caching
  nötig?
