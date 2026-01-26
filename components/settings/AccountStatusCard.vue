<script setup lang="ts">
import type { AccountInfo } from "~/types/settings";

const props = defineProps<{
  accountInfo: AccountInfo;
  accountName: string;
}>();

const emit = defineEmits<{
  toggleActive: [];
  emergencyStop: [];
  closePositions: [];
  update: [info: AccountInfo];
}>();

const togglingActive = ref(false);
const emergencyStopping = ref(false);
const showEmergencyConfirm = ref(false);
const closingPositions = ref(false);
const showClosePositionsConfirm = ref(false);
const restartingBot = ref(false);
const showRestartConfirm = ref(false);

const toggleAccountActive = async () => {
  togglingActive.value = true;
  try {
    const result = await $fetch<{ isActive: boolean }>(
      `/api/settings/${props.accountName}/toggle-active`,
      { method: "POST" }
    );
    emit("update", {
      ...props.accountInfo,
      metadata: { ...props.accountInfo.metadata, is_active: result.isActive },
    });
  } catch (error) {
    console.error("Failed to toggle account:", error);
  } finally {
    togglingActive.value = false;
  }
};

const emergencyStop = async () => {
  emergencyStopping.value = true;
  try {
    const result = await $fetch<{
      positionsClosed: number;
      positionsFailed: number;
      errors: string[];
      accountDeactivated: boolean;
    }>(`/api/settings/${props.accountName}/emergency-stop`, {
      method: "POST",
    });

    emit("update", {
      ...props.accountInfo,
      metadata: { ...props.accountInfo.metadata, is_active: false },
    });

    showEmergencyConfirm.value = false;

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

const closeAllPositions = async () => {
  closingPositions.value = true;
  try {
    const result = await $fetch<{
      positionsClosed: number;
      positionsFailed: number;
      errors: string[];
    }>(`/api/settings/${props.accountName}/reset`, {
      method: "POST",
      body: { closePositions: true },
    });

    showClosePositionsConfirm.value = false;

    if (result.positionsFailed > 0) {
      alert(
        `Positionen geschlossen: ${result.positionsClosed}\nFehlgeschlagen: ${result.positionsFailed}\n\nFehler:\n${result.errors.join("\n")}`
      );
    } else {
      alert(`${result.positionsClosed} Position(en) geschlossen.`);
    }
  } catch (error) {
    console.error("Close positions failed:", error);
    alert(
      `Positionen schließen fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    closingPositions.value = false;
  }
};

const isActive = computed(() => props.accountInfo.metadata.is_active !== false);

const restartBot = async () => {
  restartingBot.value = true;
  try {
    await $fetch("/api/bot/restart", { method: "POST" });
    showRestartConfirm.value = false;
    alert("Restart-Signal gesendet. Der Bot wird innerhalb von 5 Minuten neu gestartet.");
  } catch (error) {
    console.error("Bot restart failed:", error);
    alert(
      `Bot-Neustart fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    restartingBot.value = false;
  }
};
</script>

<template>
  <UCard
    :class="[
      'border-2',
      isActive ? 'border-green-600' : 'border-red-600',
    ]"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div
          :class="[
            'w-4 h-4 rounded-full',
            isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500',
          ]"
        />
        <div>
          <p class="text-lg font-semibold text-white">
            {{ accountInfo.metadata.account_name }}
          </p>
          <p class="text-sm text-gray-400">
            Status:
            <span :class="isActive ? 'text-green-400' : 'text-red-400'">
              {{ isActive ? "Aktiv" : "Inaktiv" }}
            </span>
            | {{ accountInfo.credentials.env }}
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <UButton
          :color="isActive ? 'success' : 'neutral'"
          :variant="isActive ? 'solid' : 'outline'"
          :loading="togglingActive"
          @click="toggleAccountActive"
        >
          {{ isActive ? "Deaktivieren" : "Aktivieren" }}
        </UButton>
        <UTooltip
          :text="`Schließt alle offenen Positionen sofort zum Marktpreis und deaktiviert den Account. Zukünftige Trades werden verhindert, bis der Account wieder aktiviert wird.`"
        >
          <UButton
            color="error"
            variant="solid"
            icon="i-heroicons-exclamation-triangle"
            @click="showEmergencyConfirm = true"
          >
            Notschalter
            <UIcon name="i-heroicons-information-circle" class="ml-1 w-4 h-4" />
          </UButton>
        </UTooltip>
        <UTooltip text="Schließt alle offenen Positionen ohne den Account zu deaktivieren">
          <UButton
            color="warning"
            variant="soft"
            icon="i-heroicons-x-mark"
            @click="showClosePositionsConfirm = true"
          >
            Positionen schließen
          </UButton>
        </UTooltip>
        <UTooltip text="Startet den Bot-Prozess neu (lädt Konfigurationen und Modelle neu)">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-arrow-path"
            @click="showRestartConfirm = true"
          >
            Bot neu starten
          </UButton>
        </UTooltip>
      </div>
    </div>
  </UCard>

  <!-- Close Positions Confirmation Modal -->
  <UModal v-model:open="showClosePositionsConfirm">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 text-yellow-500">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
            <span class="text-lg font-bold">Alle Positionen schließen?</span>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-gray-300">
            Diese Aktion wird alle offenen Positionen sofort zum Marktpreis schließen.
          </p>
          <p class="text-gray-400 text-sm">
            Der Account bleibt aktiv und kann weiter handeln.
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              @click="showClosePositionsConfirm = false"
            >
              Abbrechen
            </UButton>
            <UButton
              color="warning"
              :loading="closingPositions"
              @click="closeAllPositions"
            >
              Positionen schließen
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

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

  <!-- Bot Restart Confirmation Modal -->
  <UModal v-model:open="showRestartConfirm">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 text-blue-500">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6" />
            <span class="text-lg font-bold">Bot neu starten?</span>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-gray-300">
            Der Bot wird neu gestartet und:
          </p>
          <ul class="list-disc list-inside text-gray-400 space-y-1">
            <li>Alle Konfigurationen neu laden</li>
            <li>Die KI-Modelle neu trainieren</li>
            <li>Die IG-Session neu aufbauen</li>
          </ul>
          <p class="text-gray-500 text-sm">
            Der Neustart erfolgt innerhalb von maximal 5 Minuten.
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              @click="showRestartConfirm = false"
            >
              Abbrechen
            </UButton>
            <UButton
              color="primary"
              :loading="restartingBot"
              @click="restartBot"
            >
              Bot neu starten
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
