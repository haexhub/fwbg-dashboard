<script setup lang="ts">
/**
 * Small global indicator of the Claude (haex-claude-proxy) connection
 * state — visible on every page via the header, links through to the
 * detailed connection card on /agents.
 */
const { status, unreachable } = useLlmConnection();

const isConnected = computed(
  () =>
    !!status.value?.credentialsExist &&
    (status.value?.state === "idle" || status.value?.state === "done")
);

const color = computed<"success" | "warning" | "error" | "neutral">(() => {
  if (unreachable.value) return "error";
  if (isConnected.value) return "success";
  if (status.value?.state === "error") return "error";
  return "warning";
});

const label = computed(() => {
  if (unreachable.value) return "Claude: nicht erreichbar";
  if (isConnected.value) return "Claude: verbunden";
  if (status.value?.state === "error") return "Claude: Fehler";
  return "Claude: nicht verbunden";
});
</script>

<template>
  <NuxtLink to="/agents">
    <UBadge :color="color" variant="subtle" class="cursor-pointer whitespace-nowrap shrink-0">
      {{ label }}
    </UBadge>
  </NuxtLink>
</template>
