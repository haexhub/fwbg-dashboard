<script setup lang="ts">
import type { AssetConfig, MarketInfo } from "~/types/settings";
import { defaultAssetConfig } from "~/types/settings";

const props = defineProps<{
  accountName: string;
}>();

const emit = defineEmits<{
  created: [assetName: string];
  cancel: [];
}>();

const newAssetName = ref("");
const newAssetConfig = ref<AssetConfig>({ ...defaultAssetConfig });

// Market search
const marketSearchTerm = ref("");
const searchingMarkets = ref(false);
const availableMarkets = ref<MarketInfo[]>([]);
const marketSearchError = ref<string | null>(null);

const searchMarkets = async () => {
  if (!props.accountName || !marketSearchTerm.value || marketSearchTerm.value.length < 2) {
    availableMarkets.value = [];
    return;
  }

  searchingMarkets.value = true;
  marketSearchError.value = null;

  try {
    const result = await $fetch<{ markets: MarketInfo[] }>(
      `/api/settings/${props.accountName}/markets`,
      { query: { search: marketSearchTerm.value } }
    );
    availableMarkets.value = result.markets || [];
  } catch (error) {
    marketSearchError.value = error instanceof Error ? error.message : String(error);
    availableMarkets.value = [];
  } finally {
    searchingMarkets.value = false;
  }
};

// Debounce market search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSearchMarkets = () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchMarkets();
  }, 300);
};

const selectMarket = (market: MarketInfo) => {
  newAssetName.value = market.epic;
  availableMarkets.value = [];
  marketSearchTerm.value = "";
};

const addNewAsset = async () => {
  if (!props.accountName || !newAssetName.value) return;

  try {
    await $fetch(`/api/settings/${props.accountName}/assets`, {
      method: "POST",
      body: {
        name: newAssetName.value,
        config: newAssetConfig.value,
      },
    });
    emit("created", newAssetName.value);
    resetForm();
  } catch (error) {
    console.error("Failed to add asset:", error);
  }
};

const resetForm = () => {
  newAssetName.value = "";
  marketSearchTerm.value = "";
  availableMarkets.value = [];
  newAssetConfig.value = { ...defaultAssetConfig };
};

const cancel = () => {
  resetForm();
  emit("cancel");
};
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold text-white">Neues Asset</h3>
    </template>

    <div class="space-y-4">
      <!-- Market Search -->
      <UFormField label="Asset suchen (IG Markets)">
        <div class="relative">
          <UInput
            v-model="marketSearchTerm"
            placeholder="Suche nach EUR, GOLD, DAX..."
            class="w-full"
            :loading="searchingMarkets"
            @input="debouncedSearchMarkets"
          />
          <!-- Search Results Dropdown -->
          <div
            v-if="availableMarkets.length > 0"
            class="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            <button
              v-for="market in availableMarkets"
              :key="market.epic"
              type="button"
              class="w-full px-4 py-2 text-left hover:bg-gray-700 border-b border-gray-700 last:border-b-0"
              @click="selectMarket(market)"
            >
              <div class="font-medium text-white">{{ market.epic }}</div>
              <div class="text-sm text-gray-400">{{ market.instrumentName }}</div>
            </button>
          </div>
          <div v-if="marketSearchError" class="text-red-500 text-xs mt-1">
            {{ marketSearchError }}
          </div>
        </div>
      </UFormField>

      <!-- Selected Asset Name -->
      <UFormField label="Asset Name (Epic)">
        <UInput
          v-model="newAssetName"
          placeholder="z.B. CS.D.EURUSD.CFD.IP"
          class="w-full font-mono"
        />
        <template #hint>
          <span class="text-xs text-gray-500">
            Wähle ein Asset aus der Suche oder gib den Epic manuell ein
          </span>
        </template>
      </UFormField>

      <div class="flex gap-2">
        <UButton color="primary" :disabled="!newAssetName" @click="addNewAsset">
          Asset hinzufügen
        </UButton>
        <UButton variant="ghost" @click="cancel">
          Abbrechen
        </UButton>
      </div>
    </div>
  </UCard>
</template>
