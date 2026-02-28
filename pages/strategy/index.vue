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

const columns = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "tags", label: "Tags" },
  { key: "actions", label: "" },
];
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

    <UCard>
      <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
        Loading strategies...
      </div>
      <div
        v-else-if="!strategies?.length"
        class="py-8 text-center text-gray-400"
      >
        No strategies found. Create one to get started.
      </div>
      <div v-else class="divide-y divide-gray-800">
        <div
          v-for="s in strategies"
          :key="s.filename"
          class="flex items-center justify-between px-4 py-3 hover:bg-gray-900/50 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/strategy/${s.filename}`"
              class="text-white font-medium hover:text-blue-400 transition-colors"
            >
              {{ s.name }}
            </NuxtLink>
            <p v-if="s.description" class="text-sm text-gray-400 truncate mt-0.5">
              {{ s.description }}
            </p>
            <div v-if="s.tags?.length" class="flex gap-1 mt-1">
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
          <div class="flex gap-1 ml-4">
            <NuxtLink :to="`/strategy/${s.filename}`">
              <UButton
                icon="i-heroicons-pencil-square"
                variant="ghost"
              />
            </NuxtLink>
            <UButton
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              @click="handleDelete(s.filename)"
            />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
