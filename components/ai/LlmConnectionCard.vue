<script setup lang="ts">
const { status, unreachable, startLogin, submitCode, reset } = useLlmConnection();

const codeInput = ref("");
const submitting = ref(false);
const starting = ref(false);
const actionError = ref("");

const isConnected = computed(
  () =>
    !!status.value?.credentialsExist &&
    (status.value?.state === "idle" || status.value?.state === "done")
);
const isAwaitingCode = computed(() => status.value?.state === "awaiting-code");
const isError = computed(() => status.value?.state === "error");

async function handleStart() {
  starting.value = true;
  actionError.value = "";
  try {
    await startLogin();
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string };
    actionError.value = err?.statusMessage ?? err?.message ?? "Login konnte nicht gestartet werden";
  } finally {
    starting.value = false;
  }
}

async function handleSubmitCode() {
  if (!codeInput.value.trim()) return;
  submitting.value = true;
  actionError.value = "";
  try {
    await submitCode(codeInput.value.trim());
    codeInput.value = "";
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string };
    actionError.value = err?.statusMessage ?? err?.message ?? "Code konnte nicht übernommen werden";
  } finally {
    submitting.value = false;
  }
}

async function handleReset() {
  actionError.value = "";
  await reset();
  codeInput.value = "";
}

async function handleRetry() {
  await handleReset();
  await handleStart();
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-primary" />
          <span class="text-base font-semibold text-white">Claude-Verbindung</span>
        </div>
        <UBadge v-if="unreachable" color="error" variant="subtle">Proxy nicht erreichbar</UBadge>
        <UBadge v-else-if="isConnected" color="success" variant="subtle">Verbunden</UBadge>
        <UBadge v-else-if="isAwaitingCode" color="warning" variant="subtle">Code ausstehend</UBadge>
        <UBadge v-else-if="isError" color="error" variant="subtle">Fehler</UBadge>
        <UBadge v-else color="neutral" variant="subtle">Nicht verbunden</UBadge>
      </div>
    </template>

    <div class="space-y-4">
      <UAlert
        v-if="unreachable"
        color="error"
        variant="subtle"
        title="haex-claude-proxy nicht erreichbar"
        description="Der Proxy-Container scheint nicht zu laufen oder ist nicht erreichbar. Weder die Agents (Researcher, Translator, ...) noch der AI-Assistent hier können ohne ihn LLM-Aufrufe machen."
      />

      <template v-else-if="isConnected">
        <p class="text-sm text-gray-400">
          Claude ist über haex-claude-proxy verbunden. Sowohl die Agents (Researcher, Translator, ...) als auch der AI-Assistent unten nutzen diese eine Verbindung.
        </p>
        <UButton variant="outline" color="neutral" :loading="starting" @click="handleStart">
          Neu verbinden
        </UButton>
      </template>

      <template v-else-if="isAwaitingCode && status?.oauthUrl">
        <ol class="text-sm text-gray-400 space-y-2 list-decimal list-inside">
          <li>Im Claude-Login einloggen und mit dem gewünschten Account bestätigen.</li>
          <li>
            Auf der danach angezeigten Seite auf <strong>Copy</strong> klicken (nicht die angezeigte
            6-stellige Nummer abtippen) und den kopierten Code unten einfügen.
          </li>
        </ol>
        <UButton :to="status.oauthUrl" target="_blank" icon="i-heroicons-arrow-top-right-on-square">
          Claude-Login öffnen →
        </UButton>
        <UFormField label="Code">
          <div class="flex gap-2">
            <UInput v-model="codeInput" placeholder="Code einfügen" class="flex-1" @keyup.enter="handleSubmitCode" />
            <UButton color="primary" :loading="submitting" :disabled="!codeInput.trim()" @click="handleSubmitCode">
              Bestätigen
            </UButton>
          </div>
        </UFormField>
        <UButton variant="ghost" color="neutral" size="sm" @click="handleReset">Abbrechen</UButton>
      </template>

      <template v-else-if="isError">
        <UAlert color="error" variant="subtle" :title="status?.errorMessage ?? 'Unbekannter Fehler'" />
        <UButton color="primary" :loading="starting" @click="handleRetry">Erneut versuchen</UButton>
      </template>

      <template v-else>
        <p class="text-sm text-gray-400">
          Claude ist noch nicht verbunden. Weder Agents noch der AI-Assistent unten können LLM-Aufrufe machen,
          bevor die Verbindung hergestellt ist.
        </p>
        <UButton color="primary" :loading="starting" @click="handleStart">Mit Claude verbinden</UButton>
      </template>

      <UAlert v-if="actionError" color="error" variant="subtle" :title="actionError" />
    </div>
  </UCard>
</template>
