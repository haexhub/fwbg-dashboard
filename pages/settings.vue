<script setup lang="ts">
import type { AccountInfo, AssetConfig, AssetsConfig } from "~/types/settings";

// Fetch accounts list
const { data: accountsData, refresh: refreshAccounts } = await useFetch<{
  accounts: string[];
}>("/api/settings/accounts");
const accounts = computed(() => accountsData.value?.accounts || []);

// Selected account from URL query
const route = useRoute();
const router = useRouter();

const selectedAccount = computed({
  get() {
    return (route.query.account as string) || accounts.value[0] || "";
  },
  set(account) {
    router.push({ query: { account } });
  },
});

// Build tabs from accounts
const tabs = computed(() =>
  accounts.value.map((acc) => ({
    label: acc,
    value: acc,
  }))
);

// Fetch account info when account changes
const {
  data: accountInfo,
  refresh: refreshAccountInfo,
  status: accountInfoStatus,
} = await useFetch<AccountInfo>(
  () => `/api/settings/${selectedAccount.value}/info`,
  {
    watch: [selectedAccount],
    immediate: !!selectedAccount.value,
  }
);

// Fetch assets when account changes
const {
  data: assetsData,
  refresh: refreshAssets,
  status: assetsStatus,
} = await useFetch<AssetsConfig>(
  () => `/api/settings/${selectedAccount.value}/assets`,
  {
    watch: [selectedAccount],
    immediate: !!selectedAccount.value,
  }
);

// Local state for editing
const editingInfo = ref<AccountInfo | null>(null);
const editingAssets = ref<AssetsConfig | null>(null);
const savingAssets = ref<string | null>(null);
const expandedAssets = ref<Set<string>>(new Set());

// Modal states
const showNewAccountModal = ref(false);
const showNewAssetForm = ref(false);
const showBulkImportModal = ref(false);

// Initialize editing state when data loads
watch(
  accountInfo,
  (newInfo) => {
    if (newInfo) {
      editingInfo.value = JSON.parse(JSON.stringify(newInfo));
    }
  },
  { immediate: true }
);

watch(
  assetsData,
  (newAssets) => {
    if (newAssets) {
      editingAssets.value = JSON.parse(JSON.stringify(newAssets));
    }
  },
  { immediate: true }
);

// Handle account info update from status card
const handleAccountInfoUpdate = (updatedInfo: AccountInfo) => {
  editingInfo.value = updatedInfo;
  refreshAccountInfo();
};

// Handle account info saved
const handleAccountInfoSaved = () => {
  refreshAccountInfo();
};

// Handle new account created
const handleAccountCreated = async (folderName: string) => {
  await refreshAccounts();
  selectedAccount.value = folderName;
};

// Handle new asset created
const handleAssetCreated = async (assetName: string) => {
  await refreshAssets();
  showNewAssetForm.value = false;
  expandedAssets.value.add(assetName);
};

// Save single asset
const saveAsset = async (assetName: string) => {
  if (!editingAssets.value || !selectedAccount.value) return;

  savingAssets.value = assetName;
  try {
    await $fetch(
      `/api/settings/${selectedAccount.value}/assets/${assetName}`,
      {
        method: "PUT",
        body: editingAssets.value[assetName],
      }
    );
    await refreshAssets();
  } catch (error) {
    console.error("Failed to save asset:", error);
  } finally {
    savingAssets.value = null;
  }
};

// Delete asset
const deleteAsset = async (assetName: string) => {
  if (!selectedAccount.value) return;

  if (!confirm(`Asset "${assetName}" wirklich löschen?`)) return;

  try {
    await $fetch(
      `/api/settings/${selectedAccount.value}/assets/${assetName}`,
      {
        method: "DELETE",
      }
    );
    await refreshAssets();
  } catch (error) {
    console.error("Failed to delete asset:", error);
  }
};

// Toggle asset expansion
const isExpanded = (assetName: string) => expandedAssets.value.has(assetName);

const setExpanded = (assetName: string, expanded: boolean) => {
  if (expanded) {
    expandedAssets.value.add(assetName);
  } else {
    expandedAssets.value.delete(assetName);
  }
};

// Update asset in editing state
const updateAsset = (assetName: string, asset: AssetConfig) => {
  if (editingAssets.value) {
    editingAssets.value[assetName] = asset;
  }
};
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-white">Settings</h1>
      <div class="flex gap-2">
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          @click="() => { showNewAccountModal = true }"
        >
          New Account
        </UButton>
      </div>
    </div>

      <!-- New Account Modal -->
      <SettingsNewAccountModal
        v-model:open="showNewAccountModal"
        @created="handleAccountCreated"
      />

      <!-- Account Tabs -->
      <UTabs
        v-if="accounts.length > 0"
        v-model="selectedAccount"
        :items="tabs"
        class="mb-4"
      />

      <!-- Loading State -->
      <div
        v-if="accountInfoStatus === 'pending' || assetsStatus === 'pending'"
        class="text-gray-400"
      >
        Lade Einstellungen...
      </div>

      <!-- No Accounts -->
      <UCard v-else-if="accounts.length === 0">
        <p class="text-gray-400">
          Keine Accounts gefunden. Stelle sicher, dass der accounts-Ordner
          korrekt gemountet ist.
        </p>
      </UCard>

      <!-- Account Settings -->
      <template v-else-if="editingInfo">
        <!-- Account Status & Emergency Controls -->
        <SettingsAccountStatusCard
          :account-info="editingInfo"
          :account-name="selectedAccount"
          @update="handleAccountInfoUpdate"
        />

        <!-- Account Info & Money Management -->
        <SettingsAccountInfoCard
          v-model="editingInfo"
          :account-name="selectedAccount"
          @save="handleAccountInfoSaved"
        />

        <!-- Assets Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-white">Assets</h2>
            <div class="flex gap-2">
              <UButton
                icon="i-heroicons-arrow-up-tray"
                variant="outline"
                @click="() => { showBulkImportModal = true }"
              >
                Import
              </UButton>
              <UButton
                icon="i-heroicons-plus"
                @click="() => { showNewAssetForm = !showNewAssetForm }"
              >
                Neues Asset
              </UButton>
            </div>
          </div>

          <!-- Bulk Import Modal -->
          <SettingsBulkImportModal
            v-model:open="showBulkImportModal"
            :account-name="selectedAccount"
            @imported="refreshAssets"
          />

          <!-- New Asset Form -->
          <SettingsNewAssetForm
            v-if="showNewAssetForm"
            :account-name="selectedAccount"
            @created="handleAssetCreated"
            @cancel="showNewAssetForm = false"
          />

          <!-- Asset Cards -->
          <SettingsAssetCard
            v-for="(asset, assetName) in editingAssets"
            :key="assetName"
            :asset-name="assetName as string"
            :model-value="asset"
            :account-name="selectedAccount"
            :expanded="isExpanded(assetName as string)"
            :saving="savingAssets === assetName"
            @update:model-value="updateAsset(assetName as string, $event)"
            @update:expanded="setExpanded(assetName as string, $event)"
            @save="saveAsset(assetName as string)"
            @delete="deleteAsset(assetName as string)"
          />
        </div>
      </template>
  </div>
</template>
