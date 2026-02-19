<script setup lang="ts">
import { watchDebounced } from "@vueuse/core";
import type { AccountInfo } from "~/types/settings";
import {
  BROKER_DEFINITIONS,
  currencyOptions,
  defaultMoneyManagement,
} from "~/types/settings";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [folderName: string];
}>();

const creatingAccount = ref(false);
const errorMessage = ref("");

// ── Form State ──
const accountName = ref("");
const brokerType = ref(BROKER_DEFINITIONS[0]!.type);
const env = ref(BROKER_DEFINITIONS[0]!.envOptions?.[0]?.value ?? "");
const currency = ref("EUR");
const credentials = ref<Record<string, string>>({});

const selectedBroker = computed(
  () => BROKER_DEFINITIONS.find((b) => b.type === brokerType.value)!
);

const brokerOptions = BROKER_DEFINITIONS.map((b) => ({
  label: b.label,
  value: b.type,
}));

// Reset credentials when broker changes
watch(brokerType, () => {
  credentials.value = {};
  env.value = selectedBroker.value.envOptions?.[0]?.value ?? "";
});

// ── Folder Name ──
function toFolderName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

const folderName = computed(() => toFolderName(accountName.value));

// ── Availability Check ──
const nameAvailable = ref<boolean | null>(null);
const checkingName = ref(false);

watchDebounced(
  folderName,
  async (name) => {
    if (!name) {
      nameAvailable.value = null;
      return;
    }
    checkingName.value = true;
    try {
      const result = await $fetch<{ available: boolean }>(
        "/api/settings/accounts-check",
        { query: { name } }
      );
      nameAvailable.value = result.available;
    } catch {
      nameAvailable.value = null;
    } finally {
      checkingName.value = false;
    }
  },
  { debounce: 300 }
);

// ── Validation ──
const canCreate = computed(() => {
  if (!folderName.value) return false;
  if (nameAvailable.value === false) return false;
  if (checkingName.value) return false;

  for (const field of selectedBroker.value.credentialFields) {
    if (field.required && !credentials.value[field.key]?.trim()) return false;
  }
  return true;
});

// ── Actions ──
function resetForm() {
  accountName.value = "";
  brokerType.value = BROKER_DEFINITIONS[0]!.type;
  env.value = BROKER_DEFINITIONS[0]!.envOptions?.[0]?.value ?? "";
  currency.value = "EUR";
  credentials.value = {};
  nameAvailable.value = null;
  errorMessage.value = "";
}

async function createAccount() {
  if (!canCreate.value) return;
  errorMessage.value = "";
  creatingAccount.value = true;

  const accountInfo: AccountInfo = {
    broker_type: brokerType.value,
    credentials: { ...credentials.value },
    money_management: { ...defaultMoneyManagement },
    metadata: {
      account_name: accountName.value.trim(),
      currency: currency.value,
      env: env.value,
      is_active: false,
    },
  };

  try {
    await $fetch("/api/settings/accounts", {
      method: "POST",
      body: {
        folderName: folderName.value,
        accountInfo,
      },
    });
    emit("created", folderName.value);
    emit("update:open", false);
    resetForm();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error);
  } finally {
    creatingAccount.value = false;
  }
}

function close() {
  emit("update:open", false);
  resetForm();
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard class="w-full max-w-2xl">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-user-plus" class="w-6 h-6 text-primary" />
            <span class="text-lg font-bold text-white">Neuen Account erstellen</span>
          </div>
        </template>

        <div class="space-y-4">
          <!-- Error Message -->
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :title="errorMessage"
            :close-button="{ onClick: () => (errorMessage = '') }"
          />

          <!-- Account Name -->
          <UFormField label="Account Name" required>
            <UInput
              v-model="accountName"
              placeholder="z.B. Demo Account"
              class="w-full"
              :color="nameAvailable === false ? 'error' : undefined"
            />
            <template #hint>
              <div class="flex items-center gap-2 text-xs">
                <template v-if="folderName">
                  <span class="text-gray-500">Ordner:</span>
                  <code class="font-mono text-gray-400">{{ folderName }}</code>
                  <UIcon
                    v-if="checkingName"
                    name="i-heroicons-arrow-path"
                    class="animate-spin text-gray-500"
                  />
                  <UIcon
                    v-else-if="nameAvailable === true"
                    name="i-heroicons-check-circle"
                    class="text-green-500"
                  />
                  <span
                    v-else-if="nameAvailable === false"
                    class="text-red-400"
                  >
                    Name bereits vergeben
                  </span>
                </template>
              </div>
            </template>
          </UFormField>

          <!-- Broker + Environment + Currency -->
          <div class="grid grid-cols-3 gap-4">
            <UFormField label="Broker">
              <USelect
                v-model="brokerType"
                :items="brokerOptions"
                class="w-full"
              />
            </UFormField>

            <UFormField v-if="selectedBroker.envOptions" label="Umgebung">
              <USelect
                v-model="env"
                :items="selectedBroker.envOptions"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Waehrung">
              <USelect
                v-model="currency"
                :items="currencyOptions"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Dynamic Credentials -->
          <div class="border-t border-gray-700 pt-4">
            <h4 class="text-sm font-medium text-gray-400 mb-3">Zugangsdaten</h4>
            <div class="space-y-3">
              <UFormField
                v-for="field in selectedBroker.credentialFields"
                :key="field.key"
                :label="field.label"
                :required="field.required"
              >
                <UInput
                  :model-value="credentials[field.key] ?? ''"
                  :type="field.type"
                  :placeholder="field.placeholder"
                  class="w-full font-mono"
                  @update:model-value="credentials[field.key] = $event as string"
                />
              </UFormField>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">
              Abbrechen
            </UButton>
            <UButton
              color="primary"
              :loading="creatingAccount"
              :disabled="!canCreate"
              @click="createAccount"
            >
              Account erstellen
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
