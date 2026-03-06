# Chart Strategy Save — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to save the current chart indicator configuration as a new strategy, directly from the chart view.

**Architecture:** A new "Strategie speichern" button in the chart toolbar opens a USlideover component that shows a summary of active indicators + asset info. The user enters a name/description, saves via existing `POST /api/strategy/strategies`, and can navigate to the strategy pipeline view to continue editing.

**Tech Stack:** Vue 3, Nuxt 4, Nuxt UI (USlideover, UFormField, UInput, UButton, UBadge), Pinia, existing fwbg strategy API

---

### Task 1: Create the ChartStrategySave slideover component

**Files:**
- Create: `components/chart/StrategySave.vue`

**Step 1: Create the component**

```vue
<script setup lang="ts">
import type { ActiveIndicator } from "~/types/chart";

const props = defineProps<{
  open: boolean;
  source: string;
  symbol: string;
  timeframe: string;
  activeIndicators: ActiveIndicator[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const toast = useToast();

const strategyName = ref("");
const strategyDescription = ref("");
const status = ref<"idle" | "saving" | "saved" | "error">("idle");
const savedFilename = ref("");
const errorMessage = ref("");

const canSave = computed(
  () => strategyName.value.trim().length > 0 && status.value !== "saving",
);

// De-duplicate indicators by FQN (same indicator can appear as plot + signal)
const uniqueIndicators = computed(() => {
  const seen = new Set<string>();
  return props.activeIndicators.filter((ind) => {
    if (seen.has(ind.fqn)) return false;
    seen.add(ind.fqn);
    return true;
  });
});

// Build non-default params display for an indicator
function displayParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "Defaults";
  return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
}

async function save() {
  if (!canSave.value) return;
  status.value = "saving";
  errorMessage.value = "";

  // Build pipeline entries from active indicators (de-duplicated by FQN)
  const seen = new Set<string>();
  const indicators = props.activeIndicators
    .filter((ind) => {
      if (seen.has(ind.fqn)) return false;
      seen.add(ind.fqn);
      return true;
    })
    .map((ind) => ({
      name: ind.name.replace(/ \(signal\)$/, ""),
      params: ind.params,
    }));

  try {
    const res = await $fetch<{ filename: string }>("/api/strategy/strategies", {
      method: "POST",
      body: {
        name: strategyName.value.trim(),
        data: {
          description: strategyDescription.value.trim() || undefined,
          datasource: props.source,
          pipeline: {
            indicators,
            preprocessing: [],
            feature_selection: [],
            data_loading: [],
          },
          exit_strategy: "fixed",
          exit_params: { tp: 50, sl: 50 },
          model: {
            type: "xgboost",
            architecture: "long_short_separate",
            trade_directions: ["long", "short"],
            hyperparameters: {},
          },
          grids: {},
          validation: { method: "walk_forward", folds: 8 },
          filters: {},
          resources: {},
        },
      },
    });

    savedFilename.value = res.filename;
    status.value = "saved";
    toast.add({
      title: "Strategie erstellt",
      description: `"${strategyName.value}" wurde gespeichert.`,
      color: "success",
    });
  } catch (e: unknown) {
    status.value = "error";
    const err = e as { statusMessage?: string; message?: string; data?: { detail?: string; message?: string } };
    errorMessage.value =
      err?.data?.detail ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? "Fehler beim Speichern";
  }
}

function openStrategy() {
  if (savedFilename.value) {
    navigateTo(`/strategy/${savedFilename.value}/pipeline`);
  }
}

// Reset state when slideover opens
watch(
  () => props.open,
  (open) => {
    if (open) {
      strategyName.value = "";
      strategyDescription.value = "";
      status.value = "idle";
      savedFilename.value = "";
      errorMessage.value = "";
    }
  },
);
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">Strategie speichern</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Aktuelle Indikatoren als neue Strategie speichern
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-5 p-1">
        <!-- Name -->
        <UFormField label="Name" required>
          <UInput
            v-model="strategyName"
            placeholder="z.B. Trend Momentum V1"
            :disabled="status === 'saving' || status === 'saved'"
            class="w-full"
          />
        </UFormField>

        <!-- Description -->
        <UFormField label="Beschreibung">
          <UTextarea
            v-model="strategyDescription"
            placeholder="Kurze Beschreibung der Strategie…"
            :disabled="status === 'saving' || status === 'saved'"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Asset Info -->
        <div>
          <div class="text-sm text-gray-400 mb-2">Asset</div>
          <div class="flex gap-2">
            <UBadge :label="source" variant="subtle" />
            <UBadge :label="symbol" variant="subtle" color="primary" />
            <UBadge :label="timeframe" variant="subtle" color="success" />
          </div>
        </div>

        <!-- Indicator List -->
        <div>
          <div class="text-sm text-gray-400 mb-2">
            Indikatoren ({{ uniqueIndicators.length }})
          </div>
          <div class="space-y-2">
            <div
              v-for="ind in uniqueIndicators"
              :key="ind.fqn"
              class="rounded-md bg-gray-800/60 border border-gray-700/40 px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-white">{{ ind.name }}</span>
                <UBadge :label="ind.fqn" variant="subtle" size="xs" />
              </div>
              <p class="text-xs text-gray-500 mt-1 font-mono truncate">
                {{ displayParams(ind.params) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div v-if="status === 'error'" class="rounded-md bg-red-900/30 border border-red-700/40 p-3">
          <p class="text-sm text-red-300">{{ errorMessage }}</p>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-2">
          <UButton
            v-if="status !== 'saved'"
            :loading="status === 'saving'"
            :disabled="!canSave"
            icon="i-lucide-save"
            block
            @click="save"
          >
            Strategie speichern
          </UButton>

          <template v-if="status === 'saved'">
            <UButton
              icon="i-lucide-external-link"
              variant="soft"
              block
              @click="openStrategy"
            >
              Strategie bearbeiten
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </USlideover>
</template>
```

**Step 2: Verify the component file was created**

Run: `ls -la components/chart/StrategySave.vue`
Expected: File exists

**Step 3: Commit**

```bash
git add components/chart/StrategySave.vue
git commit -m "feat: add ChartStrategySave slideover component"
```

---

### Task 2: Add "Strategie speichern" button to Chart Toolbar

**Files:**
- Modify: `components/chart/Toolbar.vue`

**Step 1: Add new emit and prop check**

In `Toolbar.vue`, add to the emits:
```typescript
"save-strategy": [];
```

Add to the props:
```typescript
hasActiveIndicators: boolean;
```

**Step 2: Add the button in the template**

After the "Indicators" button (line ~258), before the "Ranges" popover, add:

```vue
<!-- Save as Strategy -->
<UTooltip text="Aktuelle Indikatoren als Strategie speichern">
  <UButton
    icon="i-lucide-save"
    :variant="hasActiveIndicators ? 'ghost' : 'ghost'"
    :disabled="!hasActiveIndicators"
    @click="emit('save-strategy')"
  >
    Strategie speichern
  </UButton>
</UTooltip>
```

**Step 3: Commit**

```bash
git add components/chart/Toolbar.vue
git commit -m "feat: add save strategy button to chart toolbar"
```

---

### Task 3: Wire up the slideover in chart.vue

**Files:**
- Modify: `pages/chart.vue`

**Step 1: Add state for slideover**

After `indicatorPanelOpen` ref (line ~87), add:

```typescript
const strategySaveOpen = ref(false);
```

**Step 2: Pass props to ChartToolbar**

Add to the `<ChartToolbar>` props:
```
:has-active-indicators="activeIndicators.length > 0"
```

Add to the `<ChartToolbar>` event handlers:
```
@save-strategy="strategySaveOpen = true"
```

**Step 3: Add the slideover component in the template**

After the `<ChartIndicatorPanel>` closing tag (line ~628), add:

```vue
<!-- Strategy Save Slideover -->
<ChartStrategySave
  :open="strategySaveOpen"
  :source="source"
  :symbol="symbol"
  :timeframe="timeframe"
  :active-indicators="activeIndicators"
  @update:open="strategySaveOpen = $event"
/>
```

**Step 4: Commit**

```bash
git add pages/chart.vue
git commit -m "feat: wire up strategy save slideover in chart view"
```

---

### Task 4: Manual testing

**Step 1: Start the dev server**

Run: `npm run dev` (or whatever the project uses)

**Step 2: Test the full flow**

1. Open chart view
2. Add 1-2 indicators to the chart
3. Click "Strategie speichern" button in toolbar
4. Verify slideover opens with:
   - Name + Description fields
   - Asset badges (source, symbol, timeframe)
   - Indicator list with FQN + params
5. Enter a name, click "Strategie speichern"
6. Verify toast notification appears
7. Verify "Strategie bearbeiten" button appears
8. Click it — verify navigation to `/strategy/[name]/pipeline`
9. Verify the strategy shows the saved indicators in the pipeline kanban

**Step 3: Test edge cases**

- Button disabled when no indicators active
- Duplicate strategy name shows error (409)
- Fields disabled after saving

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from manual testing"
```
