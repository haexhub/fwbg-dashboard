import type { PluginInfo, PipelinePhase } from "~/types/strategy";

/**
 * Composable for fetching and filtering plugins from the fwbg API.
 */
export function usePlugins() {
  const {
    data: plugins,
    status,
    refresh,
  } = useFetch<PluginInfo[]>("/api/strategy/plugins", {
    default: () => [],
  });

  const pluginsByPhase = computed(() => {
    const map: Partial<Record<PipelinePhase, PluginInfo[]>> = {};
    for (const p of plugins.value ?? []) {
      if (!map[p.phase]) map[p.phase] = [];
      map[p.phase]!.push(p);
    }
    return map;
  });

  const getPlugin = (fqn: string): PluginInfo | undefined => {
    return plugins.value?.find((p) => p.fqn === fqn);
  };

  return {
    plugins,
    pluginsByPhase,
    status,
    refresh,
    getPlugin,
  };
}
