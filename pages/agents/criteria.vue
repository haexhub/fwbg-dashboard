<script setup lang="ts">
import type { CriteriaDetailResponse } from "~/types/agents";

const toast = useToast();
const { criteriaList, getCriteria, updateCriteria } = useAgentCriteria();

const selectedAssetClass = ref("");
watch(
  criteriaList,
  (list) => {
    if (list?.asset_classes.length && !selectedAssetClass.value) {
      selectedAssetClass.value = list.asset_classes[0] ?? "";
    }
  },
  { immediate: true },
);

const tabs = computed(() =>
  (criteriaList.value?.asset_classes ?? []).map((ac) => ({ label: ac, value: ac })),
);

const detail = ref<CriteriaDetailResponse | null>(null);
const yamlText = ref("");
const loadingDetail = ref(false);
const saving = ref(false);
const saveError = ref("");

async function loadCriteria() {
  if (!selectedAssetClass.value) return;
  loadingDetail.value = true;
  saveError.value = "";
  try {
    detail.value = await getCriteria(selectedAssetClass.value);
    yamlText.value = detail.value.yaml_text;
  } finally {
    loadingDetail.value = false;
  }
}

watch(selectedAssetClass, loadCriteria, { immediate: true });

const isDirty = computed(() => detail.value != null && yamlText.value !== detail.value.yaml_text);

async function save() {
  if (!selectedAssetClass.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    await updateCriteria(selectedAssetClass.value, { yaml_text: yamlText.value });
    await loadCriteria();
    toast.add({
      title: "Gespeichert",
      description: `Criteria für ${selectedAssetClass.value} aktualisiert.`,
      color: "success",
    });
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string; data?: { detail?: string; message?: string } };
    saveError.value =
      err?.data?.detail ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? "Speichern fehlgeschlagen";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-white">Criteria</h2>

    <div v-if="!tabs.length" class="py-16 text-center text-gray-400">
      No criteria files found.
    </div>

    <template v-else>
      <UTabs v-model="selectedAssetClass" :items="tabs" />

      <div v-if="loadingDetail" class="py-8 text-center text-gray-400">
        Lade Criteria...
      </div>

      <div v-else-if="detail" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- YAML editor: the API accepts raw yaml_text directly, so v1 skips
             pulling in a YAML-parsing dependency for a structured form. -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-400">YAML</h3>
              <UButton size="xs" :loading="saving" :disabled="!isDirty" @click="save">
                Save
              </UButton>
            </div>
          </template>
          <UTextarea v-model="yamlText" :rows="24" class="w-full font-mono text-xs" />
          <p v-if="saveError" class="text-sm text-red-400 mt-2">{{ saveError }}</p>
        </UCard>

        <!-- Structured read-only view -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-medium text-gray-400">Structured (read-only)</h3>
          </template>
          <pre class="text-xs text-gray-300 bg-gray-950 rounded p-3 overflow-x-auto">{{ JSON.stringify(detail.criteria, null, 2) }}</pre>
        </UCard>
      </div>
    </template>
  </div>
</template>
