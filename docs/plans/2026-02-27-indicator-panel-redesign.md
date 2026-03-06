# Indicator Panel Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the chart indicator panel: one entry per plugin (no column-splitting), groups-first config view, and human-readable group labels from the backend.

**Architecture:** Three layers of changes: (1) SDK adds `get_column_group_labels()` to `BaseIndicator`, (2) fwbg API exposes it via `/api/plugins`, (3) Dashboard `IndicatorPanel.vue` removes browse-entry splitting and shows groups-first config. The two most complex plugins (trend, opening_range) get label implementations; others fall back to prefix-stripping.

**Tech Stack:** Python (fwbg-sdk, fwbg plugins, FastAPI), Vue 3/Nuxt 4 (IndicatorPanel.vue), TypeScript

---

### Task 1: Add `get_column_group_labels()` to BaseIndicator SDK

**Files:**
- Modify: `/home/haex/Projekte/fwbg/packages/fwbg-sdk/src/fwbg_sdk/indicators.py` (after line 220)

**Step 1: Add the method to BaseIndicator**

After the `get_plot_columns()` method (line 220), add:

```python
    def get_column_group_labels(self) -> dict:
        """
        Optionale menschenlesbare Labels für Feature-Gruppen.

        Gibt ein Mapping von Gruppen-Key (erster Token nach Prefix-Stripping)
        zu lesbarem Label zurück. Plugins die dies nicht implementieren
        bekommen automatisch den Key in Großbuchstaben als Fallback.

        Returns:
            Dict[str, str] z.B. {"adx": "ADX (Average Directional Index)"}
        """
        return {}
```

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add packages/fwbg-sdk/src/fwbg_sdk/indicators.py
git commit -m "feat(sdk): add get_column_group_labels() to BaseIndicator"
```

---

### Task 2: Expose `column_group_labels` in the plugins API

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/api/plugins.py` (function `_plugin_to_dict`)

**Step 1: Add column_group_labels extraction**

After the `plot_columns` block (after line 62), add a new block following the same defensive try/except pattern:

```python
    column_group_labels: dict[str, str] = {}
    if hasattr(plugin_cls, "get_column_group_labels"):
        try:
            column_group_labels = plugin_cls.get_column_group_labels()
        except TypeError:
            try:
                column_group_labels = plugin_cls().get_column_group_labels()
            except Exception:
                pass
```

**Step 2: Add to return dict**

In the return dict (around line 79), add:
```python
        "column_group_labels": column_group_labels,
```

**Step 3: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/api/plugins.py
git commit -m "feat(api): expose column_group_labels in plugins endpoint"
```

---

### Task 3: Implement labels for `opening_range` plugin

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/plugins/fwbg-core/indicators/opening_range/__init__.py`

**Step 1: Add `get_column_group_labels()` method to `OpeningRangeIndicator`**

Add after `get_param_schema()` (after line ~510):

```python
    def get_column_group_labels(self) -> dict:
        return {
            "s00": "Nikkei / ASX200 Open — 00:00 UTC",
            "s01": "Nikkei / HK50 Morning — 01:00 UTC",
            "s02": "All Asia Morning — 02:00 UTC",
            "s05": "Nikkei / HK50 Afternoon — 05:00 UTC",
            "s06": "DAX Pre-Market — 06:00 UTC",
            "s07": "Xetra / DAX Open — 07:00 UTC",
            "s08": "London Open — 08:00 UTC",
            "s09": "London Morning — 09:00 UTC",
            "s12": "NY Pre-Dawn — 12:00 UTC",
            "s13": "NY Pre-Market — 13:00 UTC",
            "s14": "NYSE Pre-Open — 14:00 UTC",
            "s15": "NYSE Open — 15:00 UTC",
        }
```

Note: Includes hours 9 and 15 which are in the default params `[8, 9, 14, 15]` but not in `_PIPELINE_SESSIONS`. Any session hour not in this mapping falls back to "S{HH}" in the frontend.

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/plugins/fwbg-core/indicators/opening_range/__init__.py
git commit -m "feat(opening_range): add column group labels for session hours"
```

---

### Task 4: Implement labels for `trend` plugin

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/plugins/fwbg-core/indicators/trend/__init__.py`

**Step 1: Add `get_column_group_labels()` method to `TrendIndicators`**

Add after `get_param_schema()`:

```python
    def get_column_group_labels(self) -> dict:
        return {
            "adx": "ADX (Average Directional Index)",
            "ema": "EMA Distance",
            "sma": "SMA Distance",
            "macd": "MACD",
            "cci": "CCI (Commodity Channel Index)",
            "aroon": "Aroon",
            "er": "Efficiency Ratio",
            "supertrend": "Supertrend",
        }
```

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/plugins/fwbg-core/indicators/trend/__init__.py
git commit -m "feat(trend): add column group labels"
```

---

### Task 5: Implement labels for `momentum` plugin

**Files:**
- Modify: `/home/haex/Projekte/fwbg/src/fwbg/plugins/fwbg-core/indicators/momentum/__init__.py`

**Step 1: Add `get_column_group_labels()` method**

```python
    def get_column_group_labels(self) -> dict:
        return {
            "rsi": "RSI (Relative Strength Index)",
            "stoch": "Stochastic Oscillator",
            "williams": "Williams %R",
            "uo": "Ultimate Oscillator",
            "roc": "Rate of Change",
        }
```

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg
git add src/fwbg/plugins/fwbg-core/indicators/momentum/__init__.py
git commit -m "feat(momentum): add column group labels"
```

---

### Task 6: Add `column_group_labels` to dashboard PluginInfo type

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/types/strategy.ts`

**Step 1: Add field to `PluginInfo` interface**

In `PluginInfo` (line ~87-101), add after `plot_columns?`:

```typescript
  column_group_labels?: Record<string, string>;
```

**Step 2: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add types/strategy.ts
git commit -m "feat: add column_group_labels to PluginInfo type"
```

---

### Task 7: Redesign IndicatorPanel browse list — one entry per plugin

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/components/chart/IndicatorPanel.vue`

**Step 1: Simplify `browseEntries` computed**

Replace the current `browseEntries` computed (lines 55-81) which splits plugins into sub-entries with a simple 1:1 mapping:

```typescript
const browseEntries = computed<BrowseEntry[]>(() => {
  return props.plugins.map((plugin) => ({
    id: plugin.fqn,
    label: plugin.name,
    plugin,
    pluginType: getPluginType(plugin),
  }));
});
```

The `BrowseEntry` interface (lines 34-41) can be simplified — remove `parentLabel` and `preSelectGroup` fields:

```typescript
interface BrowseEntry {
  id: string;
  label: string;
  plugin: PluginInfo;
  pluginType: "indicator" | "signal" | "both";
}
```

**Step 2: Remove `groupFeatureColumns` function (lines 43-53)**

This function is no longer needed — delete it.

**Step 3: Add plugin description to browse template**

In the browse entry template (around line 668-687), add the plugin description below the name:

```vue
<div
  v-for="entry in group.entries"
  :key="entry.id"
  class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
  @click="startConfig(entry)"
>
  <div class="flex-1 min-w-0">
    <span class="text-sm text-white">{{ entry.label }}</span>
    <p v-if="entry.plugin.description" class="text-xs text-gray-500 truncate">
      {{ entry.plugin.description }}
    </p>
  </div>
  <span
    v-if="entry.pluginType === 'signal' || entry.pluginType === 'both'"
    class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0"
  >
    SIG
  </span>
  <span
    v-if="entry.pluginType === 'indicator' || entry.pluginType === 'both'"
    class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 shrink-0"
  >
    IND
  </span>
</div>
```

**Step 4: Update `startConfig` to not use preSelectGroup**

In `startConfig` (line 178-189), remove the `preSelectGroupKey` references:

```typescript
function startConfig(entry: BrowseEntry) {
  configPlugin.value = entry.plugin;
  configParams.value = { ...entry.plugin.defaults };
  configTab.value = "plot";  // Groups first, not parameters
  availableColumns.value = [];
  selectedColumns.value = [];
  signalColumns.value = [];
  selectedSignals.value = [];
  columnsLoaded.value = false;
  fetchColumns();
}
```

Note: `configTab` defaults to `"plot"` now (groups first).

**Step 5: Remove `preSelectGroupKey` ref and usages**

Delete `const preSelectGroupKey = ref<string | null>(null);` (line 176) and all template references to it.

In `fetchColumns()` (line 196-247), replace the pre-select logic:

```typescript
// Pre-select all columns by default (no group pre-selection)
selectedColumns.value = [...availableColumns.value];
```

Remove the `if (preSelectGroupKey.value) { ... } else { ... }` block (lines 217-225).

**Step 6: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add components/chart/IndicatorPanel.vue
git commit -m "refactor: simplify browse list to one entry per plugin"
```

---

### Task 8: Redesign config view — groups first with labels

**Files:**
- Modify: `/home/haex/Projekte/fwbg-dashboard/components/chart/IndicatorPanel.vue`

**Step 1: Add label resolution for column groups**

Add a computed that resolves group labels using `column_group_labels` from the plugin, with fallback to the current `label.toUpperCase()` logic:

```typescript
const groupLabels = computed<Record<string, string>>(() => {
  const labels = configPlugin.value?.column_group_labels ?? {};
  const result: Record<string, string> = {};
  for (const group of columnGroups.value) {
    result[group.key] = labels[group.key] ?? group.label;
  }
  return result;
});
```

**Step 2: Update column groups template to use resolved labels**

In the column groups template (around line 497-541), replace `group.label` with `groupLabels[group.key]`:

```vue
<span class="text-xs font-semibold text-gray-400 tracking-wider flex-1">
  {{ groupLabels[group.key] }}
</span>
```

**Step 3: Reorder tabs — put Plot first**

Change the `configTabs` computed (line 166-174) to put Plot first:

```typescript
const configTabs = computed(() => [
  {
    label: "Columns",
    value: "plot",
    icon: "i-heroicons-chart-bar",
    badge: columnsLoaded.value ? `${totalSelected.value}/${availableColumns.value.length + signalColumns.value.length}` : undefined,
  },
  { label: "Parameters", value: "parameters", icon: "i-heroicons-adjustments-horizontal" },
]);
```

**Step 4: Update config header to always show plugin name**

In the config header (around line 401-412), simplify to always show the plugin name:

```vue
<div class="mb-4 flex items-center gap-2">
  <UButton
    icon="i-heroicons-arrow-left"
    variant="ghost"
    size="xs"
    @click="cancelConfig"
  />
  <h4 class="font-medium text-white">
    {{ configPlugin.name }}
  </h4>
</div>
```

**Step 5: Commit**

```bash
cd /home/haex/Projekte/fwbg-dashboard
git add components/chart/IndicatorPanel.vue
git commit -m "feat: groups-first config view with human-readable labels"
```

---

### Task 9: Verify end-to-end

**Step 1: Start fwbg backend**

```bash
cd /home/haex/Projekte/fwbg
.venv/bin/python -m fwbg.api
```

**Step 2: Verify API returns column_group_labels**

```bash
curl -s http://localhost:8420/api/plugins | python3 -m json.tool | grep -A5 column_group_labels
```

Expected: Opening Range should show session labels, Trend should show ADX/MACD etc.

**Step 3: Start dashboard**

```bash
cd /home/haex/Projekte/fwbg-dashboard
npm run dev
```

**Step 4: Test in browser**

1. Open chart view
2. Click "Indicators"
3. Verify: One entry per plugin (no S00/S01 splitting)
4. Click "Opening Range" → verify groups show "London Open — 08:00 UTC" etc. (not "S08")
5. Click "Trend" → verify groups show "ADX (Average Directional Index)" etc.
6. Change parameters → verify columns reload
7. Add indicator to chart → verify it works as before

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from e2e testing"
```
