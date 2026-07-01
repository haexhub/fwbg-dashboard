# Strategy-First Research Redesign

**Ziel:** Den Research-Prozess von *asset-zuerst* auf *strategie-zuerst* umstellen. Der Researcher findet
Strategien weitgehend **asset-unabhängig**, bereitet sie strukturiert + mit Quellen auf und legt sie in
eine einsehbare Queue. Der fwbg-Agent testet je Strategie zuerst die empfohlenen Assets und weicht bei
Fehlschlag selbstständig auf andere aus. Historische Daten werden **on-demand** beschafft — kein
Vorab-Download.

**Bezug:** Baut auf [2026-06-30-datasource-adapter-interface.md](./2026-06-30-datasource-adapter-interface.md)
auf (dessen Kern — `GET /api/datasources/assets` + Dashboard-Modal — ist bereits umgesetzt, siehe Status).

---

## Kern-Shift

Heute ist das Asset **von Anfang an** in Hypothese/Strategie eingebacken (`asset_class` ist Pflicht-Input
für `/research/brief`, wird auf der Strategy-Row gespeichert). Künftig ist die **Strategie die primäre
Entität** und das **Asset eine Test-Dimension zur Laufzeit**. `asset_class` wird zu einer *optionalen,
per Dropdown eingeschränkten* Such-/Scope-Angabe — nicht zur Identität der Strategie.

---

## Getroffene Entscheidungen (verbindlich)

1. **Single Source of Truth = fwbg-Backend-API.** Das Asset-Klassen-/Symbol-Mapping wird **nicht** zwischen
   fwbg (`AssetRegistry`) und fwbg-agents (`SYMBOL_ASSET_CLASS`) gespiegelt und **nicht** in eine Shared-Lib
   ausgelagert. Agent *und* Dashboard lesen es aus fwbg. Grund: die *nutzbare* Antwort (was existiert / ist
   verfügbar) ist laufzeit- und datenabhängig — nur das Backend weiß das.
2. **Constrained Inputs.** Überall wo ein kontrolliertes Vokabular existiert → **Dropdown aus dem Backend**.
   Free-Text nur für echt offenen Kontext (Brief-Beschreibung, Quellen-`rationale`/`key_points`).
3. **`asset_class` optional + constrained** im Research-Brief (leer = asset-agnostische Discovery). Wenn
   gesetzt, gegen fwbg-Vokabular validiert. Free-Text-`asset_class` wird abgeschafft.
4. **`suggested_universe`** — strukturierte Asset-Empfehlung je Strategie (Schema unten).
5. **Quellen erstklassig** — persistiert, über API zurückgegeben, im Dashboard klickbar; pro Quelle
   `key_points` (was konkret entnommen wurde). Ohne Websuche-Key: Strategie klar als „nur Model-Knowledge"
   markieren statt Fake-URLs.
6. **Onboarding-Secrets (Option A).** Nötige Keys (Websuche etc.) werden im Onboarding erfasst, in einem
   file-backed Store abgelegt (Klartext-JSON, konsistent mit heutigen Broker-Credentials), zur Laufzeit
   gelesen (kein Restart), mit Env-Fallback.
7. **Queue = angereicherte Review-Liste** (kein autonomer Scheduler in dieser Runde). Wiederverwendung der
   bestehenden Strategien-Ansicht (`state=proposed`), angereichert um Empfehlungen + Quellen + Aktionen.
8. **Websuche** über Tavily (primär) + Brave (Fallback) — bereits im agents-Code vorhanden, nur Keys fehlen.
9. **On-Demand-Daten autonom.** Der Agent darf historische Daten **ohne Rückfrage** über die
   eingerichteten Datenquellen ziehen (kein Größen-/Zeit-Gate) — die Quellen sind bewusst konfiguriert und
   damit für den Agent freigegeben. Sinnvolle Implementierungs-Guardrails bleiben (nur benötigten
   Timeframe/Zeitraum holen, cachen statt neu ziehen, Quelle muss das Symbol/die Klasse können — heute
   Dukascopy = FX; für nicht abgedeckte Klassen sauber „keine Daten" melden statt hängen).

---

## Ziel-Architektur (3 Repos)

```
fwbg            Single Source: /api/assets/classes, /api/assets, /api/datasources/assets
                On-Demand-Daten: "ensure data" (symbol, timeframe) -> Quelle auflösen/holen (Dukascopy…)
fwbg-agents     Researcher (asset-agnostisch, Quellen) -> Strategie(PROPOSED) mit suggested_universe
                adaptiver Runner (empfohlene Assets -> fwbg, Fallback-Expansion), Secrets-Store
fwbg-dashboard  constrained Research-Formular, Queue-/Detail-Ansicht mit Quellen, Onboarding-Secrets
```

---

## Schemas & Endpoints (konkret)

### fwbg — Asset-Registry (Single Source) — ✅ umgesetzt (PR #27)
```
GET /api/assets/classes -> { "classes": ["FOREX","INDEX","COMMODITY","CRYPTO"],
                             "by_class": { "FOREX": ["AUDUSD","EURUSD",…], … } }
GET /api/assets         -> { "assets": [ {symbol, asset_class, currencies}, … ] }
```
(Ergänzt `GET /api/datasources/assets` = Verfügbarkeit; diese = Klassifizierung.)

### fwbg-agents — Researcher-Hypothese (Ergänzungen)
```jsonc
"suggested_universe": [
  { "scope": "asset_class", "value": "FOREX",  "timeframe": "H1",  "rationale": "trendige Sessions, enge Spreads" },
  { "scope": "symbol",      "value": "EURUSD", "timeframe": "M15", "rationale": "hohe Liquidität für Breakouts" }
]
// scope: "symbol" | "asset_class"; value gegen fwbg-Vokabular validiert; timeframe aus Timeframe-Enum (optional)

"sources": [
  { "url": "https://…", "title": "…", "why_relevant": "…",
    "key_points": ["Breakouts nach London-Open haben Edge X", "…"] }
]
// bestehendes {url,title,why_relevant} + neu key_points: list[str]
// wenn keine Websuche: url = "n/a (model knowledge)" + Strategie-Flag "model_knowledge_only": true
```

### fwbg-agents — Research-Brief (geändert)
```
POST /research/brief  { asset_class?: str|null,   // optional, gegen fwbg-Vokabular validiert
                        symbols?: string[],        // optionale konkrete Constraints
                        strategy_family_hint?: str,
                        free_text_brief?: str }     // z.B. "open breakout ranges"
```

### fwbg-agents — Secrets-Store (neu)
```
GET  /agents/secrets           -> { keys: { tavily: {set: bool}, brave: {set: bool}, … } }  // nie Werte zurückgeben
PUT  /agents/secrets           { tavily?: str, brave?: str, … }
// file-backed (data/secrets.json im agents-Volume), von research.py zur Laufzeit gelesen, Env-Fallback
```

---

## Phasen & Status

| Phase | Repo | Inhalt | Status |
|---|---|---|---|
| **0** | fwbg / stack | Compose-Persistenz-Fix (`FWBG_DATA_DIR`), v2.6.0 deployt | ✅ PR #26 merged, live |
| **1a** | fwbg | `/api/assets/classes` + `/api/assets` (Single Source) | ✅ **PR #27 (offen)** |
| **1b** | fwbg-agents | gespiegeltes Map raus → fwbg-API; `asset_class` optional; `suggested_universe` (+Alembic-Migration, Prompt); Quellen erstklassig (`key_points`, model-knowledge-Guardrail) | ⏳ |
| **1c** | fwbg | On-Demand-Daten-Grundlage: `DataSourceAdapter`-Interface formalisieren (aus dem 2026-06-30-Doc) + `ensure data`-Endpoint (nur CSV/Dukascopy zuerst) | ⏳ |
| **1d** | fwbg-agents + fwbg-dashboard | Onboarding-Secrets (Option A): agents Secrets-Store + `/agents/secrets`; Dashboard-Proxy + Onboarding-Schritt „Service-Keys" + Settings; `BRAVE_API_KEY` in compose | ⏳ |
| **1e** | fwbg-dashboard | constrained Research-Formular (Dropdowns aus fwbg) + Free-Text-Brief; Queue-/Detail-Ansicht mit Quellen; **ein** Release | ⏳ |
| **2 (später)** | fwbg-agents | adaptiver Runner: `suggested_universe` an fwbg (`assets`/`asset_classes`) übergeben; „ensure data" vor Lauf; bei Fehlschlag Expansion auf andere Symbole der Klasse | ⏳ |
| **3 (optional)** | fwbg-agents | kontinuierlicher Researcher/Scheduler (füllt Queue autonom) | offen |

Abhängigkeiten: 1b/1e brauchen 1a. 1e (strategie-zuerst-Formular) braucht 1b (`asset_class` optional).
„Echte Quellen" brauchen 1d (Websuche-Key). Phase 2 braucht 1c (On-Demand-Daten).

---

## Offene Fragen / bewusst vertagt

- **Quellen-Abdeckung je Klasse (Phase 1c/2):** auto-fetch ist entschieden (autonom, kein Gate). Offen
  bleibt nur, *welche* Quellen welche Klassen abdecken — heute nur Dukascopy = FX. Nicht abgedeckte Klassen
  (Indizes/Krypto/Aktien) sind bis zur Anbindung weiterer Adapter nicht auto-fetchbar → sauber melden.
- **Adaptive Expansion (Phase 2):** nur gleiche Klasse oder klassenübergreifend? Max. Anzahl Assets/Budget?
- **Secrets-Verschlüsselung:** aktuell Klartext (wie Accounts). Später Master-Key-Verschlüsselung?
- **Multi-Source-Symbole:** dedupliziert anzeigen (aktuell) vs. je Quelle auflisten. (aus 2026-06-30-Doc)
- **DB-Adapter `list_assets()` Performance/Caching** — erst relevant bei REST/DB-Quellen. (aus 2026-06-30-Doc)
- **Kontinuierlicher Researcher (Phase 3):** on-demand vs. geplant — später.

---

## Referenz: relevante Dateien

- **fwbg:** `src/fwbg/api/assets.py` (neu), `src/fwbg/data/assets.py` (AssetRegistry), `src/fwbg/core/data_sources.py`,
  `src/fwbg/api/datasources.py`, `docker-compose.yml`.
- **fwbg-agents:** `agents/researcher.py`, `agents/prompts/researcher.md`, `orchestrator/hypotheses.py`,
  `agents/calibrator.py` (SYMBOL_ASSET_CLASS raus), `api/research.py`, `api/agents_config.py` (Muster),
  `tools/agent_config.py` (file-backed Muster), `tools/fwbg_client.py`, `persistence/models.py` + Alembic,
  `config.py`.
- **fwbg-dashboard:** `pages/setup.vue`, `components/agents/ResearchBriefModal.vue`,
  `pages/agents/strategies/index.vue` (Queue), `composables/useDataSourceAssets.ts`,
  `server/utils/claude-proxy-api.ts` (Proxy-Muster), `server/api/agents/*`.
