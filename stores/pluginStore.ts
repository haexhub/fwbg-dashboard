import { defineStore } from "pinia";
import type { PluginInfo, PipelinePhase } from "~/types/strategy";

export const usePluginStore = defineStore("plugins", () => {
  const plugins = ref<PluginInfo[]>([]);
  const status = ref<"idle" | "pending" | "success" | "error">("idle");

  async function load() {
    if (status.value === "success" || status.value === "pending") return;
    status.value = "pending";
    try {
      plugins.value = await $fetch<PluginInfo[]>("/api/plugins");
      status.value = "success";
    } catch {
      status.value = "error";
    }
  }

  async function refresh() {
    status.value = "pending";
    try {
      plugins.value = await $fetch<PluginInfo[]>("/api/plugins");
      status.value = "success";
    } catch {
      status.value = "error";
    }
  }

  const pluginsByPhase = computed(() => {
    const map: Partial<Record<PipelinePhase, PluginInfo[]>> = {};
    for (const p of plugins.value) {
      if (!map[p.phase]) map[p.phase] = [];
      map[p.phase]!.push(p);
    }
    return map;
  });

  function getPlugin(fqn: string): PluginInfo | undefined {
    return plugins.value.find((p) => p.fqn === fqn);
  }

  return { plugins, pluginsByPhase, status, load, refresh, getPlugin };
});
