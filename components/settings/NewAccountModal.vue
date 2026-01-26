<script setup lang="ts">
import type { AccountInfo } from "~/types/settings";
import { defaultAccountInfo, currencyOptions, envOptions } from "~/types/settings";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [folderName: string];
}>();

const creatingAccount = ref(false);
const folderName = ref("");
const accountInfo = ref<AccountInfo>(JSON.parse(JSON.stringify(defaultAccountInfo)));

const resetForm = () => {
  folderName.value = "";
  accountInfo.value = JSON.parse(JSON.stringify(defaultAccountInfo));
};

const createAccount = async () => {
  if (!folderName.value || !accountInfo.value.metadata.account_name) {
    alert("Bitte Ordnernamen und Account-Namen eingeben");
    return;
  }

  creatingAccount.value = true;
  try {
    await $fetch("/api/settings/accounts", {
      method: "POST",
      body: {
        folderName: folderName.value,
        accountInfo: accountInfo.value,
      },
    });
    emit("created", folderName.value);
    emit("update:open", false);
    resetForm();
  } catch (error) {
    console.error("Failed to create account:", error);
    alert(`Fehler beim Erstellen des Accounts: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    creatingAccount.value = false;
  }
};

const close = () => {
  emit("update:open", false);
  resetForm();
};
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
          <!-- Folder Name -->
          <UFormField label="Ordnername" required>
            <UInput
              v-model="folderName"
              placeholder="z.B. demo oder live_main"
              class="w-full font-mono"
            />
            <template #hint>
              <span class="text-xs text-gray-500">
                Der Ordnername wird im Dateisystem verwendet (keine Leerzeichen)
              </span>
            </template>
          </UFormField>

          <!-- Account Name -->
          <UFormField label="Account Name" required>
            <UInput
              v-model="accountInfo.metadata.account_name"
              placeholder="z.B. Demo Account"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Umgebung">
              <USelect
                v-model="accountInfo.credentials.env"
                :items="envOptions"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Währung">
              <USelect
                v-model="accountInfo.metadata.currency"
                :items="currencyOptions"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Credentials -->
          <div class="border-t border-gray-700 pt-4">
            <h4 class="text-sm font-medium text-gray-400 mb-3">Credentials</h4>
            <div class="space-y-4">
              <UFormField label="API Key">
                <UInput
                  v-model="accountInfo.credentials.api_key"
                  placeholder="IG API Key"
                  class="w-full font-mono"
                />
              </UFormField>

              <div class="grid grid-cols-2 gap-4">
                <UFormField label="Username">
                  <UInput
                    v-model="accountInfo.credentials.username"
                    placeholder="IG Username"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Password">
                  <UInput
                    v-model="accountInfo.credentials.password"
                    type="password"
                    placeholder="IG Password"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </div>

          <!-- Money Management -->
          <div class="border-t border-gray-700 pt-4">
            <h4 class="text-sm font-medium text-gray-400 mb-3">Money Management</h4>
            <div class="grid grid-cols-3 gap-4">
              <UFormField label="Max Margin Usage">
                <UInput
                  v-model.number="accountInfo.money_management.max_margin_usage"
                  type="number"
                  step="0.01"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Min Lot Size">
                <UInput
                  v-model.number="accountInfo.money_management.min_lot_size"
                  type="number"
                  step="0.01"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Emergency Stop %">
                <UInput
                  v-model.number="accountInfo.money_management.emergency_stop_pct"
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
            <UButton variant="ghost" @click="close">
              Abbrechen
            </UButton>
            <UButton
              color="primary"
              :loading="creatingAccount"
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
