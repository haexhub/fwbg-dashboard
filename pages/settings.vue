<script setup lang="ts">
interface AccountInfo {
  credentials: {
    api_key: string;
    username: string;
    password: string;
    env: "DEMO" | "LIVE";
  };
  money_management: {
    max_margin_usage: number;
    min_lot_size: number;
    emergency_stop_pct: number;
  };
  metadata: {
    account_name: string;
    currency: string;
    is_active: boolean;
  };
}

interface EnsembleModel {
  tp_mult: number;
  sl_mult: number;
  conf_thresh: number;
  weight: number;
}

interface AssetConfig {
  kelly_risk: number;
  point_value: number;
  spread: number;
  tp_mult: number;
  sl_mult: number;
  conf_thresh: number;
  features: string[];
  good_hours: number[];
  ensemble: EnsembleModel[];
  dd_scaling: Record<string, number>;
}

type AssetsConfig = Record<string, AssetConfig>;

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
const showPassword = ref(false);
const savingInfo = ref(false);
const savingAssets = ref<string | null>(null);
const expandedAssets = ref<Set<string>>(new Set());
const togglingActive = ref(false);
const emergencyStopping = ref(false);
const showEmergencyConfirm = ref(false);

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

// Save account info
const saveAccountInfo = async () => {
  if (!editingInfo.value || !selectedAccount.value) return;

  savingInfo.value = true;
  try {
    await $fetch(`/api/settings/${selectedAccount.value}/info`, {
      method: "PUT",
      body: editingInfo.value,
    });
    await refreshAccountInfo();
  } catch (error) {
    console.error("Failed to save account info:", error);
  } finally {
    savingInfo.value = false;
  }
};

// Toggle account active state
const toggleAccountActive = async () => {
  if (!selectedAccount.value) return;

  togglingActive.value = true;
  try {
    const result = await $fetch<{ isActive: boolean }>(
      `/api/settings/${selectedAccount.value}/toggle-active`,
      { method: "POST" }
    );
    await refreshAccountInfo();
    if (editingInfo.value) {
      editingInfo.value.metadata.is_active = result.isActive;
    }
  } catch (error) {
    console.error("Failed to toggle account:", error);
  } finally {
    togglingActive.value = false;
  }
};

// Emergency stop - close all positions and deactivate
const emergencyStop = async () => {
  if (!selectedAccount.value) return;

  emergencyStopping.value = true;
  try {
    const result = await $fetch<{
      positionsClosed: number;
      positionsFailed: number;
      errors: string[];
      accountDeactivated: boolean;
    }>(`/api/settings/${selectedAccount.value}/emergency-stop`, {
      method: "POST",
    });

    await refreshAccountInfo();
    if (editingInfo.value) {
      editingInfo.value.metadata.is_active = false;
    }

    showEmergencyConfirm.value = false;

    // Show result
    if (result.positionsFailed > 0) {
      alert(
        `Notschalter ausgeführt!\n\nPositionen geschlossen: ${result.positionsClosed}\nFehlgeschlagen: ${result.positionsFailed}\n\nFehler:\n${result.errors.join("\n")}`
      );
    } else {
      alert(
        `Notschalter ausgeführt!\n\n${result.positionsClosed} Position(en) geschlossen.\nAccount deaktiviert.`
      );
    }
  } catch (error) {
    console.error("Emergency stop failed:", error);
    alert(
      `Notschalter fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    emergencyStopping.value = false;
  }
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
const toggleAsset = (assetName: string) => {
  if (expandedAssets.value.has(assetName)) {
    expandedAssets.value.delete(assetName);
  } else {
    expandedAssets.value.add(assetName);
  }
};

// Toggle hour in good_hours
const toggleHour = (assetName: string, hour: number) => {
  if (!editingAssets.value) return;

  const asset = editingAssets.value[assetName];
  if (!asset) return;
  const index = asset.good_hours.indexOf(hour);
  if (index >= 0) {
    asset.good_hours.splice(index, 1);
  } else {
    asset.good_hours.push(hour);
    asset.good_hours.sort((a, b) => a - b);
  }
};

// Add feature
const newFeature = ref<Record<string, string>>({});
const addFeature = (assetName: string) => {
  if (!editingAssets.value || !newFeature.value[assetName]) return;

  const asset = editingAssets.value[assetName];
  if (!asset) return;
  if (!asset.features.includes(newFeature.value[assetName])) {
    asset.features.push(newFeature.value[assetName]);
  }
  newFeature.value[assetName] = "";
};

// Remove feature
const removeFeature = (assetName: string, feature: string) => {
  if (!editingAssets.value) return;

  const asset = editingAssets.value[assetName];
  if (!asset) return;
  const index = asset.features.indexOf(feature);
  if (index >= 0) {
    asset.features.splice(index, 1);
  }
};

// Add ensemble model
const addEnsemble = (assetName: string) => {
  if (!editingAssets.value) return;

  const asset = editingAssets.value[assetName];
  if (!asset) return;
  asset.ensemble.push({
    tp_mult: asset.tp_mult,
    sl_mult: asset.sl_mult,
    conf_thresh: asset.conf_thresh + 0.05,
    weight: 0.25,
  });
};

// Remove ensemble model
const removeEnsemble = (assetName: string, index: number) => {
  if (!editingAssets.value) return;

  const asset = editingAssets.value[assetName];
  if (!asset) return;
  asset.ensemble.splice(index, 1);
};

// Add DD scaling level
const newDdLevel = ref<Record<string, string>>({});
const newDdScale = ref<Record<string, number>>({});
const addDdScaling = (assetName: string) => {
  if (
    !editingAssets.value ||
    !newDdLevel.value[assetName] ||
    newDdScale.value[assetName] === undefined
  )
    return;

  const asset = editingAssets.value[assetName];
  if (!asset) return;
  asset.dd_scaling[newDdLevel.value[assetName]] = newDdScale.value[assetName];
  newDdLevel.value[assetName] = "";
  newDdScale.value[assetName] = 0.5;
};

// Remove DD scaling level
const removeDdScaling = (assetName: string, level: string) => {
  if (!editingAssets.value) return;

  const asset = editingAssets.value[assetName];
  if (!asset) return;
  delete asset.dd_scaling[level];
};

// New asset form
const showNewAssetForm = ref(false);
const newAssetName = ref("");
const newAssetConfig = ref<AssetConfig>({
  kelly_risk: 0.02,
  point_value: 1.0,
  spread: 1.0,
  tp_mult: 50,
  sl_mult: 50,
  conf_thresh: 0.55,
  features: [],
  good_hours: Array.from({ length: 24 }, (_, i) => i),
  ensemble: [],
  dd_scaling: { "10": 0.5, "20": 0.25 },
});

const addNewAsset = async () => {
  if (!selectedAccount.value || !newAssetName.value) return;

  try {
    await $fetch(`/api/settings/${selectedAccount.value}/assets`, {
      method: "POST",
      body: {
        name: newAssetName.value,
        config: newAssetConfig.value,
      },
    });
    await refreshAssets();
    showNewAssetForm.value = false;
    newAssetName.value = "";
    expandedAssets.value.add(newAssetName.value);
  } catch (error) {
    console.error("Failed to add asset:", error);
  }
};

// Currency options
const currencyOptions = [
  { label: "EUR", value: "EUR" },
  { label: "USD", value: "USD" },
  { label: "GBP", value: "GBP" },
  { label: "CHF", value: "CHF" },
  { label: "JPY", value: "JPY" },
];

// Environment options
const envOptions = [
  { label: "DEMO", value: "DEMO" },
  { label: "LIVE", value: "LIVE" },
];

// Hours array for grid
const hours = Array.from({ length: 24 }, (_, i) => i);

// New account form
const showNewAccountForm = ref(false);
const creatingAccount = ref(false);
const newAccountFolderName = ref("");
const newAccountInfo = ref<AccountInfo>({
  credentials: {
    api_key: "",
    username: "",
    password: "",
    env: "DEMO",
  },
  money_management: {
    max_margin_usage: 0.9,
    min_lot_size: 0.1,
    emergency_stop_pct: 0.15,
  },
  metadata: {
    account_name: "",
    currency: "EUR",
    is_active: false,
  },
});

const resetNewAccountForm = () => {
  newAccountFolderName.value = "";
  newAccountInfo.value = {
    credentials: {
      api_key: "",
      username: "",
      password: "",
      env: "DEMO",
    },
    money_management: {
      max_margin_usage: 0.9,
      min_lot_size: 0.1,
      emergency_stop_pct: 0.15,
    },
    metadata: {
      account_name: "",
      currency: "EUR",
      is_active: false,
    },
  };
};

const createNewAccount = async () => {
  if (!newAccountFolderName.value || !newAccountInfo.value.metadata.account_name) {
    alert("Bitte Ordnernamen und Account-Namen eingeben");
    return;
  }

  creatingAccount.value = true;
  try {
    await $fetch("/api/settings/accounts", {
      method: "POST",
      body: {
        folderName: newAccountFolderName.value,
        info: newAccountInfo.value,
      },
    });
    await refreshAccounts();
    showNewAccountForm.value = false;
    resetNewAccountForm();
    // Select the new account
    selectedAccount.value = newAccountFolderName.value;
  } catch (error) {
    console.error("Failed to create account:", error);
    alert(
      `Fehler beim Erstellen des Accounts: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    creatingAccount.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-gray-950 p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">Settings</h1>
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-plus"
            @click="showNewAccountForm = true"
          >
            Neuer Account
          </UButton>
          <NuxtLink to="/">
            <UButton icon="i-heroicons-arrow-left" variant="ghost">
              Zurück zum Dashboard
            </UButton>
          </NuxtLink>
        </div>
      </div>

      <!-- New Account Modal -->
      <UModal v-model:open="showNewAccountForm">
        <template #content>
          <UCard class="w-full max-w-2xl">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-plus" class="w-6 h-6 text-primary" />
                <span class="text-lg font-bold text-white">Neuen Account erstellen</span>
              </div>
            </template>

            <div class="space-y-4">
              <UFormField label="Ordnername" hint="Wird als Ordnername verwendet (z.B. main_demo, live_account)">
                <UInput
                  v-model="newAccountFolderName"
                  placeholder="z.B. main_demo"
                  class="w-full font-mono"
                />
              </UFormField>

              <div class="border-t border-gray-700 pt-4">
                <h4 class="text-sm font-medium text-gray-400 mb-3">Account Info</h4>
                <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Account Name">
                    <UInput
                      v-model="newAccountInfo.metadata.account_name"
                      placeholder="z.B. Demo Account"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Währung">
                    <USelect
                      v-model="newAccountInfo.metadata.currency"
                      :items="currencyOptions"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Umgebung">
                    <USelect
                      v-model="newAccountInfo.credentials.env"
                      :items="envOptions"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <div class="border-t border-gray-700 pt-4">
                <h4 class="text-sm font-medium text-gray-400 mb-3">Credentials</h4>
                <div class="space-y-4">
                  <UFormField label="API Key">
                    <UInput
                      v-model="newAccountInfo.credentials.api_key"
                      placeholder="IG API Key"
                      class="w-full font-mono"
                    />
                  </UFormField>

                  <div class="grid grid-cols-2 gap-4">
                    <UFormField label="Username">
                      <UInput
                        v-model="newAccountInfo.credentials.username"
                        placeholder="IG Username"
                        class="w-full"
                      />
                    </UFormField>

                    <UFormField label="Password">
                      <UInput
                        v-model="newAccountInfo.credentials.password"
                        type="password"
                        placeholder="IG Password"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>

              <div class="border-t border-gray-700 pt-4">
                <h4 class="text-sm font-medium text-gray-400 mb-3">Money Management</h4>
                <div class="grid grid-cols-3 gap-4">
                  <UFormField label="Max Margin Usage">
                    <UInput
                      v-model.number="newAccountInfo.money_management.max_margin_usage"
                      type="number"
                      step="0.01"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Min Lot Size">
                    <UInput
                      v-model.number="newAccountInfo.money_management.min_lot_size"
                      type="number"
                      step="0.01"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Emergency Stop %">
                    <UInput
                      v-model.number="newAccountInfo.money_management.emergency_stop_pct"
                      type="number"
                      step="0.01"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </div>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton
                  variant="ghost"
                  @click="showNewAccountForm = false; resetNewAccountForm()"
                >
                  Abbrechen
                </UButton>
                <UButton
                  color="primary"
                  :loading="creatingAccount"
                  @click="createNewAccount"
                >
                  Account erstellen
                </UButton>
              </div>
            </template>
          </UCard>
        </template>
      </UModal>

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
        <UCard
          :class="[
            'border-2',
            editingInfo.metadata.is_active !== false
              ? 'border-green-600'
              : 'border-red-600',
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div
                :class="[
                  'w-4 h-4 rounded-full',
                  editingInfo.metadata.is_active !== false
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-red-500',
                ]"
              />
              <div>
                <p class="text-lg font-semibold text-white">
                  {{ editingInfo.metadata.account_name }}
                </p>
                <p class="text-sm text-gray-400">
                  Status:
                  <span
                    :class="
                      editingInfo.metadata.is_active !== false
                        ? 'text-green-400'
                        : 'text-red-400'
                    "
                  >
                    {{
                      editingInfo.metadata.is_active !== false
                        ? "Aktiv"
                        : "Inaktiv"
                    }}
                  </span>
                  | {{ editingInfo.credentials.env }}
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <UButton
                :color="
                  editingInfo.metadata.is_active !== false
                    ? 'success'
                    : 'neutral'
                "
                :variant="
                  editingInfo.metadata.is_active !== false ? 'solid' : 'outline'
                "
                :loading="togglingActive"
                @click="toggleAccountActive"
              >
                {{
                  editingInfo.metadata.is_active !== false
                    ? "Deaktivieren"
                    : "Aktivieren"
                }}
              </UButton>
              <UButton
                color="error"
                variant="solid"
                icon="i-heroicons-exclamation-triangle"
                @click="showEmergencyConfirm = true"
              >
                Notschalter
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Emergency Stop Confirmation Modal -->
        <UModal v-model:open="showEmergencyConfirm">
          <template #content>
            <UCard>
              <template #header>
                <div class="flex items-center gap-2 text-red-500">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6" />
                  <span class="text-lg font-bold">Notschalter aktivieren?</span>
                </div>
              </template>

              <div class="space-y-4">
                <p class="text-gray-300">
                  Diese Aktion wird:
                </p>
                <ul class="list-disc list-inside text-gray-400 space-y-1">
                  <li>Alle offenen Positionen sofort zum Marktpreis schließen</li>
                  <li>Den Account deaktivieren</li>
                </ul>
                <p class="text-yellow-500 text-sm">
                  Der Account muss danach manuell wieder aktiviert werden.
                </p>
              </div>

              <template #footer>
                <div class="flex justify-end gap-2">
                  <UButton
                    variant="ghost"
                    @click="showEmergencyConfirm = false"
                  >
                    Abbrechen
                  </UButton>
                  <UButton
                    color="error"
                    :loading="emergencyStopping"
                    @click="emergencyStop"
                  >
                    Notschalter ausführen
                  </UButton>
                </div>
              </template>
            </UCard>
          </template>
        </UModal>

        <!-- Account Info & Money Management -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Account Info -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-white">Account Info</h2>
            </template>

            <div class="space-y-4">
              <UFormField label="Account Name">
                <UInput
                  v-model="editingInfo.metadata.account_name"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Währung">
                <USelect
                  v-model="editingInfo.metadata.currency"
                  :items="currencyOptions"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Umgebung">
                <USelect
                  v-model="editingInfo.credentials.env"
                  :items="envOptions"
                  class="w-full"
                />
              </UFormField>
            </div>
          </UCard>

          <!-- Money Management -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-white">Money Management</h2>
            </template>

            <div class="space-y-4">
              <UFormField label="Max Margin Usage">
                <UInput
                  v-model.number="editingInfo.money_management.max_margin_usage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  class="w-full"
                />
                <template #hint>
                  <span class="text-xs text-gray-500"
                    >0-1 (z.B. 0.9 = 90%)</span
                  >
                </template>
              </UFormField>

              <UFormField label="Min Lot Size">
                <UInput
                  v-model.number="editingInfo.money_management.min_lot_size"
                  type="number"
                  step="0.01"
                  min="0.01"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Emergency Stop %">
                <UInput
                  v-model.number="
                    editingInfo.money_management.emergency_stop_pct
                  "
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  class="w-full"
                />
                <template #hint>
                  <span class="text-xs text-gray-500"
                    >0-1 (z.B. 0.15 = 15%)</span
                  >
                </template>
              </UFormField>
            </div>
          </UCard>
        </div>

        <!-- Credentials -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold text-white">Credentials</h2>
              <UButton
                :loading="savingInfo"
                color="primary"
                @click="saveAccountInfo"
              >
                Account speichern
              </UButton>
            </div>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UFormField label="API Key">
              <UInput
                v-model="editingInfo.credentials.api_key"
                :type="showPassword ? 'text' : 'password'"
                class="w-full font-mono"
              />
            </UFormField>

            <UFormField label="Username">
              <UInput
                v-model="editingInfo.credentials.username"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Password">
              <div class="flex gap-2">
                <UInput
                  v-model="editingInfo.credentials.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="w-full"
                />
                <UButton
                  :icon="
                    showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'
                  "
                  variant="ghost"
                  @click="showPassword = !showPassword"
                />
              </div>
            </UFormField>
          </div>
        </UCard>

        <!-- Assets Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-white">Assets</h2>
            <UButton
              icon="i-heroicons-plus"
              @click="showNewAssetForm = !showNewAssetForm"
            >
              Neues Asset
            </UButton>
          </div>

          <!-- New Asset Form -->
          <UCard v-if="showNewAssetForm">
            <template #header>
              <h3 class="text-lg font-semibold text-white">Neues Asset</h3>
            </template>

            <div class="space-y-4">
              <UFormField label="Asset Name">
                <UInput
                  v-model="newAssetName"
                  placeholder="z.B. EURUSD, DOW30"
                  class="w-full"
                />
              </UFormField>

              <div class="flex gap-2">
                <UButton color="primary" @click="addNewAsset">
                  Asset hinzufügen
                </UButton>
                <UButton variant="ghost" @click="showNewAssetForm = false">
                  Abbrechen
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- Asset Cards -->
          <UCard
            v-for="(asset, assetName) in editingAssets"
            :key="assetName"
            class="overflow-hidden"
          >
            <!-- Asset Header -->
            <template #header>
              <div
                class="flex items-center justify-between"
                :data-testid="`asset-header-${assetName}`"
              >
                <button
                  type="button"
                  class="flex items-center gap-3 cursor-pointer hover:opacity-80"
                  :data-testid="`expand-${assetName}`"
                  @click="toggleAsset(assetName as string)"
                >
                  <UIcon
                    :name="
                      expandedAssets.has(assetName as string)
                        ? 'i-heroicons-chevron-down'
                        : 'i-heroicons-chevron-right'
                    "
                    class="text-gray-400"
                  />
                  <h3 class="text-lg font-semibold text-white">
                    {{ assetName }}
                  </h3>
                  <UBadge color="neutral" variant="subtle">
                    {{ asset.features.length }} Features
                  </UBadge>
                </button>
                <div class="flex gap-2">
                  <UButton
                    :loading="savingAssets === assetName"
                    size="sm"
                    color="primary"
                    @click="saveAsset(assetName as string)"
                  >
                    Speichern
                  </UButton>
                  <UButton
                    size="sm"
                    color="error"
                    variant="ghost"
                    icon="i-heroicons-trash"
                    @click="deleteAsset(assetName as string)"
                  />
                </div>
              </div>
            </template>

            <!-- Asset Content (Expanded) -->
            <div
              v-if="expandedAssets.has(assetName as string)"
              class="space-y-6"
            >
              <!-- Basic Settings -->
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <UFormField label="Kelly Risk">
                  <UInput
                    v-model.number="asset.kelly_risk"
                    type="number"
                    step="0.001"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Point Value">
                  <UInput
                    v-model.number="asset.point_value"
                    type="number"
                    step="0.0001"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Spread">
                  <UInput
                    v-model.number="asset.spread"
                    type="number"
                    step="0.0001"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="TP Mult">
                  <UInput
                    v-model.number="asset.tp_mult"
                    type="number"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="SL Mult">
                  <UInput
                    v-model.number="asset.sl_mult"
                    type="number"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Conf Thresh">
                  <UInput
                    v-model.number="asset.conf_thresh"
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <!-- Features -->
              <div>
                <h4 class="text-sm font-medium text-gray-400 mb-2">Features</h4>
                <div class="flex flex-wrap gap-2 mb-2">
                  <UBadge
                    v-for="feature in asset.features"
                    :key="feature"
                    color="primary"
                    variant="subtle"
                    class="cursor-pointer"
                    @click="removeFeature(assetName as string, feature)"
                  >
                    {{ feature }}
                    <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                  </UBadge>
                </div>
                <div class="flex gap-2">
                  <UInput
                    v-model="newFeature[assetName as string]"
                    placeholder="Feature hinzufügen..."
                    size="sm"
                    @keyup.enter="addFeature(assetName as string)"
                  />
                  <UButton
                    size="sm"
                    icon="i-heroicons-plus"
                    @click="addFeature(assetName as string)"
                  />
                </div>
              </div>

              <!-- Good Hours -->
              <div>
                <h4 class="text-sm font-medium text-gray-400 mb-2">
                  Trading Hours
                </h4>
                <div class="grid grid-cols-12 gap-1">
                  <button
                    v-for="hour in hours"
                    :key="hour"
                    :class="[
                      'w-full aspect-square rounded text-xs font-medium transition-colors',
                      asset.good_hours.includes(hour)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-500 hover:bg-gray-700',
                    ]"
                    @click="toggleHour(assetName as string, hour)"
                  >
                    {{ hour }}
                  </button>
                </div>
              </div>

              <!-- Ensemble Models -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-medium text-gray-400">
                    Ensemble Models
                  </h4>
                  <UButton
                    size="xs"
                    icon="i-heroicons-plus"
                    @click="addEnsemble(assetName as string)"
                  >
                    Hinzufügen
                  </UButton>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(ensemble, idx) in asset.ensemble"
                    :key="idx"
                    class="flex items-center gap-2 p-2 bg-gray-900 rounded"
                  >
                    <UFormField label="TP" class="w-20">
                      <UInput
                        v-model.number="ensemble.tp_mult"
                        type="number"
                        size="sm"
                      />
                    </UFormField>
                    <UFormField label="SL" class="w-20">
                      <UInput
                        v-model.number="ensemble.sl_mult"
                        type="number"
                        size="sm"
                      />
                    </UFormField>
                    <UFormField label="Conf" class="w-24">
                      <UInput
                        v-model.number="ensemble.conf_thresh"
                        type="number"
                        step="0.01"
                        size="sm"
                      />
                    </UFormField>
                    <UFormField label="Weight" class="w-24">
                      <UInput
                        v-model.number="ensemble.weight"
                        type="number"
                        step="0.01"
                        size="sm"
                      />
                    </UFormField>
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-heroicons-trash"
                      class="mt-5"
                      @click="removeEnsemble(assetName as string, idx)"
                    />
                  </div>
                  <p
                    v-if="asset.ensemble.length === 0"
                    class="text-gray-500 text-sm"
                  >
                    Keine Ensemble-Modelle konfiguriert
                  </p>
                </div>
              </div>

              <!-- Drawdown Scaling -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-medium text-gray-400">
                    Drawdown Scaling
                  </h4>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(scale, level) in asset.dd_scaling"
                    :key="level"
                    class="flex items-center gap-2 p-2 bg-gray-900 rounded"
                  >
                    <span class="text-white w-24">{{ level }}%</span>
                    <span class="text-gray-400">→</span>
                    <span class="text-white">{{ scale }}x</span>
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-heroicons-trash"
                      @click="removeDdScaling(assetName as string, level as string)"
                    />
                  </div>
                </div>
                <div class="flex gap-2 mt-2">
                  <UInput
                    v-model="newDdLevel[assetName as string]"
                    placeholder="Level %"
                    size="sm"
                    class="w-24"
                  />
                  <UInput
                    v-model.number="newDdScale[assetName as string]"
                    type="number"
                    step="0.05"
                    placeholder="Scale"
                    size="sm"
                    class="w-24"
                  />
                  <UButton
                    size="sm"
                    icon="i-heroicons-plus"
                    @click="addDdScaling(assetName as string)"
                  />
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </template>
    </div>
  </div>
</template>
