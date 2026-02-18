<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  strategyName: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  started: [jobId: string];
}>();

const { startRun } = useRuns();

const assetClasses = ref<string[]>([]);
const customAssets = ref("");
const description = ref("");
const starting = ref(false);

const assetClassOptions = [
  { label: "FOREX", value: "FOREX" },
  { label: "INDEX", value: "INDEX" },
  { label: "COMMODITY", value: "COMMODITY" },
  { label: "CRYPTO", value: "CRYPTO" },
];

async function handleStart() {
  starting.value = true;
  try {
    const opts: {
      strategy_name: string;
      assets?: string[];
      asset_classes?: string[];
      description?: string;
    } = {
      strategy_name: props.strategyName,
    };

    if (assetClasses.value.length) {
      opts.asset_classes = assetClasses.value;
    }

    if (customAssets.value.trim()) {
      opts.assets = customAssets.value
        .split(",")
        .map((a) => a.trim().toUpperCase())
        .filter(Boolean);
    }

    if (description.value.trim()) {
      opts.description = description.value.trim();
    }

    const result = await startRun(opts);
    emit("started", result.job_id);
    emit("update:open", false);
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold text-white">Start Run</h3>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="text-sm text-gray-400">
          Strategy:
          <span class="text-white font-medium">{{ strategyName }}</span>
        </div>

        <UFormField label="Description (optional)">
          <UInput v-model="description" placeholder="Run description..." />
        </UFormField>

        <UFormField label="Asset Classes">
          <div class="flex gap-2 flex-wrap">
            <UButton
              v-for="opt in assetClassOptions"
              :key="opt.value"
              :variant="assetClasses.includes(opt.value) ? 'solid' : 'outline'"
              size="sm"
              @click="
                assetClasses.includes(opt.value)
                  ? (assetClasses = assetClasses.filter((c) => c !== opt.value))
                  : assetClasses.push(opt.value)
              "
            >
              {{ opt.label }}
            </UButton>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Leave empty to test all configured assets
          </p>
        </UFormField>

        <UFormField label="Specific Assets (optional)">
          <UInput
            v-model="customAssets"
            placeholder="EURUSD, GBPUSD, GOLD..."
          />
          <p class="text-xs text-gray-500 mt-1">
            Comma-separated. Overrides asset class filter.
          </p>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" @click="emit('update:open', false)">
          Cancel
        </UButton>
        <UButton :loading="starting" @click="handleStart">
          Start Run
        </UButton>
      </div>
    </template>
  </UModal>
</template>
