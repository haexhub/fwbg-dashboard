<script setup lang="ts">
import { useDukascopy, type DukascopySpread } from "~/composables/useDukascopy";

const { fetchSpreads, setSpread } = useDukascopy();

const rows = ref<DukascopySpread[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const savingSymbol = ref<string | null>(null);
// Per-symbol edit buffer for the override input (undefined = empty).
const edits = reactive<Record<string, number | undefined>>({});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await fetchSpreads();
    for (const r of rows.value) edits[r.symbol] = r.manual ?? undefined;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Spreads konnten nicht geladen werden";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function save(symbol: string) {
  savingSymbol.value = symbol;
  error.value = null;
  try {
    const value = edits[symbol] && edits[symbol]! > 0 ? edits[symbol]! : null;
    const updated = await setSpread(symbol, value);
    const i = rows.value.findIndex((r) => r.symbol === symbol);
    if (i >= 0) rows.value[i] = updated;
    edits[symbol] = updated.manual ?? undefined;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
  } finally {
    savingSymbol.value = null;
  }
}

function reset(symbol: string) {
  edits[symbol] = undefined;
  return save(symbol);
}

function fmt(v: number | null): string {
  return v == null ? "–" : String(v);
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-gray-500">
        Fixer Spread pro Asset fürs Backtesting. Override leer lassen = gemessener
        p90-Wert aus den Daten wird genutzt.
      </p>
      <UButton
        icon="i-heroicons-arrow-path"
        variant="ghost"
        size="xs"
        :loading="loading"
        @click="load"
      >
        Aktualisieren
      </UButton>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" :title="error" />

    <p v-if="!loading && rows.length === 0" class="text-sm text-gray-500">
      Noch keine Spreads gespeichert — lade zuerst Dukascopy-Daten.
    </p>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-gray-500 border-b border-gray-800">
          <tr>
            <th class="text-left py-2 pr-3 font-medium">Symbol</th>
            <th class="text-right py-2 px-3 font-medium">Gemessen (p90)</th>
            <th class="text-right py-2 px-3 font-medium">Override</th>
            <th class="text-right py-2 px-3 font-medium">Effektiv</th>
            <th class="py-2 pl-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.symbol" class="border-b border-gray-900">
            <td class="py-2 pr-3 font-mono text-white">{{ r.symbol }}</td>
            <td class="py-2 px-3 text-right font-mono text-gray-400">{{ fmt(r.measured) }}</td>
            <td class="py-2 px-3 text-right">
              <UInput
                v-model.number="edits[r.symbol]"
                type="number"
                step="0.00001"
                min="0"
                placeholder="–"
                size="xs"
                class="w-32 font-mono"
                @keyup.enter="save(r.symbol)"
              />
            </td>
            <td
              class="py-2 px-3 text-right font-mono"
              :class="r.manual != null ? 'text-primary-400' : 'text-gray-400'"
            >
              {{ fmt(r.effective) }}
            </td>
            <td class="py-2 pl-3 text-right whitespace-nowrap space-x-1">
              <UButton size="xs" :loading="savingSymbol === r.symbol" @click="save(r.symbol)">
                Speichern
              </UButton>
              <UButton
                v-if="r.manual != null"
                size="xs"
                variant="ghost"
                color="neutral"
                :disabled="savingSymbol === r.symbol"
                @click="reset(r.symbol)"
              >
                Zurücksetzen
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
