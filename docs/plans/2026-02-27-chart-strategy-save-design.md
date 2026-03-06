# Design: Strategie aus Chart speichern

## Überblick

Ein neuer "Strategie speichern"-Button in der Chart-Toolbar öffnet eine Sidebar, die die aktiven Indikatoren zusammenfasst. Der User gibt Name + Beschreibung ein und speichert eine neue Strategie mit:

- **Name + Beschreibung** (User-Eingabe)
- **Asset** (Source, Symbol, Timeframe — automatisch aus aktuellem Chart)
- **Indikatoren-Pipeline** (alle aktiven Indikatoren mit FQN + konfigurierten Parametern — aus Chart)

Nach dem Speichern bleibt der User im Chart. Ein "Strategie bearbeiten"-Button navigiert zur Strategy Pipeline-View.

## Komponenten

### 1. Toolbar-Button

- Neuer Button "Strategie speichern" in der Chart-Toolbar
- Nur aktiv wenn mindestens ein Indikator im Chart aktiv ist
- Öffnet die Sidebar

### 2. Sidebar (Slideover)

- **Name** — Textfeld (required)
- **Beschreibung** — Textfeld (optional)
- **Asset-Info** — Anzeige: Source, Symbol, Timeframe (read-only, aus Chart übernommen)
- **Indikator-Liste** — Alle aktiven Indikatoren mit Name/FQN + kompakte Param-Übersicht (read-only)
- **"Speichern"-Button** — Erstellt die Strategie via API
- **"Strategie bearbeiten"-Button** — Erscheint nach erfolgreichem Speichern, navigiert zu `/strategy/[name]/pipeline`

### 3. API

- Nutzt bestehenden `POST /api/strategy/strategies` Endpoint
- Payload: Name, Description, Pipeline (Indikatoren + Params), Asset-Config

## Datenfluss

```
Chart (activeIndicators + source/symbol/timeframe)
  → Sidebar zeigt Zusammenfassung
  → User gibt Name + Beschreibung ein
  → POST /api/strategy/strategies mit Pipeline-JSON
  → Toast "Strategie erstellt"
  → "Strategie bearbeiten"-Button wird sichtbar
```

## Scope / Nicht-Scope

### In Scope
- Toolbar-Button mit disabled-State
- Slideover-Sidebar mit Formular + Indikator-Übersicht
- Speichern via bestehender Strategy-API
- Navigation zur Strategy View nach Speichern
- Toast-Feedback

### Nicht in Scope
- Parameter-Bearbeitung in der Sidebar (passiert im IndicatorPanel)
- Exit-Strategies, Model, Validation etc. (wird in Strategy View konfiguriert)
- Bearbeiten bestehender Strategien aus dem Chart
