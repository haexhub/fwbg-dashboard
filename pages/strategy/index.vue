<script setup lang="ts">
import type { StrategySummary } from "~/types/strategy";

const { strategies, status, createStrategy, deleteStrategy } = useStrategies();

const newName = ref("");
const creating = ref(false);

async function handleCreate() {
  if (!newName.value.trim()) return;
  creating.value = true;
  try {
    const result = await createStrategy(newName.value.trim(), {
      name: newName.value.trim(),
      pipeline: { indicators: [], preprocessing: [], feature_selection: [], data_loading: [] },
      exit_strategies: [
        { name: "fixed", params: { tp_mult: 2.0, sl_mult: 1.0 }, ct: [0.5] },
      ],
      model: {
        type: "xgboost",
        architecture: "long_short_separate",
        trade_directions: ["long", "short"],
        hyperparameters: {},
      },
      optimization: {},
      validation: { method: "walk_forward", folds: 8 },
      filters: {},
      resources: {},
    });
    newName.value = "";
    navigateTo(`/strategy/${result.filename}`);
  } finally {
    creating.value = false;
  }
}

async function handleDelete(filename: string) {
  if (!confirm(`Delete strategy "${filename}"?`)) return;
  await deleteStrategy(filename);
}

// ── Iteration grouping ──
// Convention: <base>__it<N>   e.g. "liquiditysweepfade__forex__001__it001"
function parseIteration(name: string): { base: string; iteration: string | null } {
  const match = name.match(/^(.+)__(it\d+)$/);
  return match ? { base: match[1]!, iteration: match[2]! } : { base: name, iteration: null };
}

interface StrategyGroup {
  baseName: string;
  iterations: StrategySummary[];
  allTags: string[];
}

const strategyGroups = computed<StrategyGroup[]>(() => {
  const map = new Map<string, StrategySummary[]>();
  for (const s of strategies.value ?? []) {
    const { base } = parseIteration(s.name);
    if (!map.has(base)) map.set(base, []);
    map.get(base)!.push(s);
  }
  return Array.from(map.entries())
    .map(([baseName, iters]) => {
      const sorted = [...iters].sort((a, b) => a.name.localeCompare(b.name));
      const tagSet = new Set<string>();
      sorted.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
      return { baseName, iterations: sorted, allTags: Array.from(tagSet) };
    })
    .sort((a, b) => a.baseName.localeCompare(b.baseName));
});

// ── Open/close state ──
const openGroups = ref<string[]>([]);

function toggleGroup(baseName: string) {
  const idx = openGroups.value.indexOf(baseName);
  if (idx >= 0) openGroups.value.splice(idx, 1);
  else openGroups.value.push(baseName);
}

function isOpen(baseName: string) {
  return openGroups.value.includes(baseName);
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Strategies</h2>
      <div class="flex gap-2">
        <UInput
          v-model="newName"
          placeholder="New strategy name..."
          @keyup.enter="handleCreate"
        />
        <UButton
          icon="i-heroicons-plus"
          :loading="creating"
          :disabled="!newName.trim()"
          @click="handleCreate"
        >
          Create
        </UButton>
      </div>
    </div>

    <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
      Loading strategies...
    </div>
    <div v-else-if="!strategyGroups.length" class="py-8 text-center text-gray-400">
      No strategies found. Create one to get started.
    </div>

    <div v-else class="space-y-2">
      <UCard
        v-for="group in strategyGroups"
        :key="group.baseName"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <!-- Accordion header -->
        <button
          class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-900/50 transition-colors"
          @click="toggleGroup(group.baseName)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-white font-medium">{{ group.baseName }}</span>
              <UBadge color="neutral" variant="subtle" size="xs">
                {{ group.iterations.length }}
                {{ group.iterations.length === 1 ? "Iteration" : "Iterationen" }}
              </UBadge>
            </div>
            <div v-if="group.allTags.length" class="flex flex-wrap gap-1 mt-1.5">
              <UBadge
                v-for="tag in group.allTags.slice(0, 8)"
                :key="tag"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ tag }}
              </UBadge>
              <span v-if="group.allTags.length > 8" class="text-xs text-gray-500 self-center">
                +{{ group.allTags.length - 8 }}
              </span>
            </div>
          </div>
          <UIcon
            :name="isOpen(group.baseName) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
            class="text-gray-400 shrink-0 ml-4 w-4 h-4"
          />
        </button>

        <!-- Accordion body: one row per iteration -->
        <div v-if="isOpen(group.baseName)" class="border-t border-gray-800">
          <div
            v-for="s in group.iterations"
            :key="s.filename"
            class="flex items-center justify-between px-6 py-2.5 border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30 transition-colors"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="`/strategy/${s.filename}`"
                  class="font-mono text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {{ parseIteration(s.name).iteration ?? s.name }}
                </NuxtLink>
              </div>
              <p v-if="s.description" class="text-xs text-gray-400 truncate mt-0.5">
                {{ s.description }}
              </p>
              <div v-if="s.tags?.length" class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="tag in s.tags"
                  :key="tag"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                >
                  {{ tag }}
                </UBadge>
              </div>
            </div>
            <div class="flex gap-1 ml-4 shrink-0">
              <NuxtLink :to="`/strategy/${s.filename}`">
                <UButton icon="i-heroicons-pencil-square" variant="ghost" size="xs" />
              </NuxtLink>
              <UButton
                icon="i-heroicons-trash"
                variant="ghost"
                color="error"
                size="xs"
                @click="handleDelete(s.filename)"
              />
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
