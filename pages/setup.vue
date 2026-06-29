<script setup lang="ts">
// Guided, skippable first-run wizard. Reuses the existing building blocks
// (datasource add-form, IG account modal, Claude connection card) instead of
// reinventing them — see /datasources, /settings and /ai. Non-blocking: the
// "Später" button dismisses onboarding (cookie) and the global middleware then
// stops redirecting here.
const router = useRouter();
const toast = useToast();
const { data: setup, steps, isComplete, dismissed, refresh } = useSetupStatus();

const wizardSteps = [
  { key: "welcome", label: "Willkommen", icon: "i-heroicons-rocket-launch" },
  { key: "data", label: "Datenquelle", icon: "i-heroicons-circle-stack" },
  { key: "broker", label: "Broker", icon: "i-heroicons-building-library" },
  { key: "llm", label: "Claude", icon: "i-heroicons-cpu-chip" },
  { key: "done", label: "Fertig", icon: "i-heroicons-check-badge" },
] as const;

const stepIndex = ref(0);
const current = computed(() => wizardSteps[stepIndex.value]!);
const isLast = computed(() => stepIndex.value === wizardSteps.length - 1);

async function next() {
  if (stepIndex.value < wizardSteps.length - 1) stepIndex.value++;
  await refresh();
}
function prev() {
  if (stepIndex.value > 0) stepIndex.value--;
}
function goTo(i: number) {
  stepIndex.value = i;
  refresh();
}

function skip() {
  dismissed.value = true;
  router.push("/");
}
function finish() {
  dismissed.value = true;
  router.push("/agents");
}

// ── Data step: add-source slideover (same flow as pages/datasources.vue) ──
const sourceSlideover = ref(false);
const savingSource = ref(false);
const sourceError = ref<string | null>(null);
async function handleSourceSubmit(payload: Record<string, unknown>) {
  savingSource.value = true;
  sourceError.value = null;
  try {
    await $fetch("/api/datasources", { method: "POST", body: payload });
    sourceSlideover.value = false;
    await refresh();
    toast.add({ title: "Datenquelle angelegt", color: "success" });
  } catch (e) {
    sourceError.value = e instanceof Error ? e.message : "Fehler beim Speichern";
  } finally {
    savingSource.value = false;
  }
}

// Dukascopy path creates the source + downloads inside the form; close + refresh.
async function handleSourceDone() {
  sourceSlideover.value = false;
  await refresh();
}

// ── Broker step: IG account modal ──
const brokerModalOpen = ref(false);
async function handleBrokerCreated() {
  brokerModalOpen.value = false;
  await refresh();
  toast.add({ title: "Broker-Account angelegt", color: "success" });
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Header: title + skip -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-primary" />
        <h1 class="text-xl font-semibold text-white">Einrichtung</h1>
      </div>
      <UButton variant="ghost" color="neutral" @click="skip">Später</UButton>
    </div>

    <!-- Step indicator -->
    <div class="flex items-center">
      <template v-for="(s, i) in wizardSteps" :key="s.key">
        <button
          class="flex flex-col items-center gap-1 px-2"
          @click="goTo(i)"
        >
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
            :class="[
              i === stepIndex
                ? 'border-primary bg-primary/20 text-primary'
                : i < stepIndex
                  ? 'border-green-600 bg-green-600/20 text-green-400'
                  : 'border-gray-700 text-gray-500',
            ]"
          >
            <UIcon :name="s.icon" class="h-5 w-5" />
          </span>
          <span
            class="text-xs"
            :class="i === stepIndex ? 'text-white' : 'text-gray-500'"
          >
            {{ s.label }}
          </span>
        </button>
        <div
          v-if="i < wizardSteps.length - 1"
          class="h-px flex-1 mx-1"
          :class="i < stepIndex ? 'bg-green-700' : 'bg-gray-800'"
        />
      </template>
    </div>

    <!-- Step content -->
    <UCard>
      <!-- 0 · Welcome -->
      <template v-if="current.key === 'welcome'">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-white">Willkommen bei FWBG</h2>
          <p class="text-sm text-gray-400">
            In drei kurzen Schritten ist deine Instanz einsatzbereit. Danach kann
            die Agenten-Pipeline (Researcher → Translator → Backtest → Analyse)
            loslegen.
          </p>
          <ul class="space-y-2 text-sm text-gray-300">
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-circle-stack" class="text-primary" />
              <span><strong>Datenquelle</strong> – historische Kursdaten zum Backtesten.</span>
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-building-library" class="text-primary" />
              <span><strong>Broker</strong> (optional) – für Paper-/Live-Trading.</span>
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-cpu-chip" class="text-primary" />
              <span><strong>Claude</strong> – damit die Agents denken können.</span>
            </li>
          </ul>
        </div>
      </template>

      <!-- 1 · Data source -->
      <template v-else-if="current.key === 'data'">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Datenquelle anlegen</h2>
            <UBadge v-if="setup?.hasDataSource" color="success" variant="subtle">
              erledigt
            </UBadge>
          </div>
          <p class="text-sm text-gray-400">
            Lade CSV-Dateien hoch, binde eine REST-/URL-Quelle an oder hole dir
            (später) Dukascopy-Daten. Du kannst mehrere Quellen anlegen.
          </p>
          <UButton icon="i-heroicons-plus" @click="sourceSlideover = true">
            Datenquelle hinzufügen
          </UButton>
        </div>
      </template>

      <!-- 2 · Broker -->
      <template v-else-if="current.key === 'broker'">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Broker verbinden</h2>
            <UBadge :color="setup?.hasBroker ? 'success' : 'neutral'" variant="subtle">
              {{ setup?.hasBroker ? "erledigt" : "optional" }}
            </UBadge>
          </div>
          <p class="text-sm text-gray-400">
            Verbinde einen IG-Markets-Account für Paper- und Live-Trading. Nur
            nötig, wenn Strategien echt traden sollen – zum reinen Backtesten
            kannst du diesen Schritt überspringen.
          </p>
          <UButton icon="i-heroicons-plus" @click="brokerModalOpen = true">
            Broker-Account hinzufügen
          </UButton>
        </div>
      </template>

      <!-- 3 · LLM -->
      <template v-else-if="current.key === 'llm'">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-white">Claude verbinden</h2>
          <AiLlmConnectionCard />
        </div>
      </template>

      <!-- 4 · Done -->
      <template v-else>
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-white">
            {{ isComplete ? "Alles bereit 🎉" : "Fast geschafft" }}
          </h2>
          <p class="text-sm text-gray-400">
            {{
              isComplete
                ? "Deine Instanz ist einsatzbereit. Starte deine erste Research im Agents-Dashboard."
                : "Es fehlt noch das Nötigste. Du kannst die offenen Punkte jetzt oder später erledigen."
            }}
          </p>
          <ul class="space-y-3">
            <li v-for="s in steps" :key="s.key" class="flex items-start gap-3">
              <UIcon
                :name="s.done ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'"
                :class="s.done ? 'text-green-500' : 'text-gray-600'"
                class="w-5 h-5 mt-0.5 shrink-0"
              />
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-white">{{ s.label }}</span>
                  <UBadge v-if="!s.required" color="neutral" variant="subtle" size="xs">
                    optional
                  </UBadge>
                </div>
                <p class="text-xs text-gray-500">{{ s.description }}</p>
              </div>
            </li>
          </ul>
        </div>
      </template>

      <!-- Footer nav -->
      <template #footer>
        <div class="flex items-center justify-between">
          <UButton
            v-if="stepIndex > 0"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-arrow-left"
            @click="prev"
          >
            Zurück
          </UButton>
          <span v-else />

          <div class="flex items-center gap-2">
            <UButton variant="ghost" color="neutral" @click="skip">Später</UButton>
            <UButton
              v-if="!isLast"
              icon="i-heroicons-arrow-right"
              trailing
              @click="next"
            >
              Weiter
            </UButton>
            <UButton
              v-else
              color="primary"
              icon="i-heroicons-rocket-launch"
              @click="finish"
            >
              Zum Agents-Dashboard
            </UButton>
          </div>
        </div>
      </template>
    </UCard>

    <!-- Add-source slideover (reuses the /datasources add form) -->
    <USlideover v-model:open="sourceSlideover" title="Datenquelle hinzufügen">
      <template #body>
        <div class="p-4">
          <UAlert
            v-if="sourceError"
            color="error"
            variant="subtle"
            :title="sourceError"
            class="mb-4"
          />
          <DatasourcesAddSourceForm
            @submit="handleSourceSubmit"
            @done="handleSourceDone"
            @cancel="sourceSlideover = false"
          />
        </div>
      </template>
    </USlideover>

    <!-- IG account modal (reuses /settings new-account modal) -->
    <SettingsNewAccountModal
      v-model:open="brokerModalOpen"
      @created="handleBrokerCreated"
    />
  </div>
</template>
