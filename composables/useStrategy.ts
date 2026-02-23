import type {
  StrategyConfig,
  PluginInstance,
  PluginInfo,
  PipelinePhase,
  PipelineEntry,
} from "~/types/strategy";

/**
 * Composable for managing a strategy's pipeline state in the kanban board.
 * Converts between the internal PluginInstance format and the fwbg JSON format.
 *
 * Undo/redo is handled by the strategy config store — this composable calls
 * store.commitSnapshot() before discrete mutations (add/remove/move).
 */
export function useStrategy() {
  const store = useStrategyConfigStore();

  // Plugin instances per phase (kanban internal state)
  const lanes = ref<Record<PipelinePhase, PluginInstance[]>>({
    data_loading: [],
    preprocessing: [],
    indicators: [],
    feature_selection: [],
    exit_strategies: [],
    risk_management: [],
  });

  // Currently selected plugin for config panel
  const selectedPlugin = ref<PluginInstance | null>(null);
  const configPanelOpen = ref(false);

  // Flag to prevent write-back loop during config → lanes sync
  const _syncingFromConfig = ref(false);

  /**
   * Rebuild lanes from the shared config (called on load and on undo/redo).
   */
  function syncFromConfig(plugins: PluginInfo[]) {
    if (!store.config) return;
    _syncingFromConfig.value = true;

    const toInstances = (
      entries: PipelineEntry[] | undefined,
      phase: PipelinePhase,
    ): PluginInstance[] => {
      return (entries ?? []).map((entry) => ({
        id: crypto.randomUUID(),
        fqn: resolvePluginFqn(entry.name, phase, plugins),
        name: entry.name,
        phase,
        params: { ...entry.params },
      }));
    };

    lanes.value.data_loading = toInstances(
      store.config.pipeline.data_loading,
      "data_loading",
    );
    lanes.value.preprocessing = toInstances(
      store.config.pipeline.preprocessing,
      "preprocessing",
    );
    lanes.value.indicators = toInstances(
      store.config.pipeline.indicators,
      "indicators",
    );
    lanes.value.feature_selection = toInstances(
      store.config.pipeline.feature_selection,
      "feature_selection",
    );

    if (store.config.exit_strategy) {
      lanes.value.exit_strategies = [
        {
          id: crypto.randomUUID(),
          fqn: resolvePluginFqn(
            store.config.exit_strategy,
            "exit_strategies",
            plugins,
          ),
          name: store.config.exit_strategy,
          phase: "exit_strategies",
          params: { ...(store.config.exit_params ?? {}) },
        },
      ];
    } else {
      lanes.value.exit_strategies = [];
    }

    lanes.value.risk_management = [];

    // Close config panel — lane IDs are regenerated
    selectedPlugin.value = null;
    configPanelOpen.value = false;

    nextTick(() => {
      _syncingFromConfig.value = false;
    });
  }

  /**
   * Convert kanban state back to fwbg strategy JSON format.
   */
  function toJson(): StrategyConfig {
    if (!store.config) throw new Error("No strategy loaded");

    const toEntries = (instances: PluginInstance[]): PipelineEntry[] =>
      instances.map((inst) => ({
        name: inst.name,
        params: { ...inst.params },
      }));

    const exitInstance = lanes.value.exit_strategies[0];

    return {
      ...store.config,
      pipeline: {
        data_loading: toEntries(lanes.value.data_loading),
        preprocessing: toEntries(lanes.value.preprocessing),
        indicators: toEntries(lanes.value.indicators),
        feature_selection: toEntries(lanes.value.feature_selection),
      },
      exit_strategy: exitInstance?.name ?? store.config.exit_strategy,
      exit_params: exitInstance?.params ?? store.config.exit_params,
    };
  }

  /**
   * Add a plugin from the palette to a lane.
   */
  function addPlugin(
    phase: PipelinePhase,
    plugin: PluginInfo,
    index?: number,
  ) {
    store.commitSnapshot();
    const instance: PluginInstance = {
      id: crypto.randomUUID(),
      fqn: plugin.fqn,
      name: plugin.name,
      phase,
      params: { ...plugin.defaults },
    };

    if (phase === "exit_strategies") {
      lanes.value[phase] = [instance];
    } else if (
      index != null &&
      index >= 0 &&
      index < lanes.value[phase].length
    ) {
      lanes.value[phase].splice(index, 0, instance);
    } else {
      lanes.value[phase].push(instance);
    }

    return instance;
  }

  /**
   * Remove a plugin from its lane.
   */
  function removePlugin(phase: PipelinePhase, instanceId: string) {
    store.commitSnapshot();
    lanes.value[phase] = lanes.value[phase].filter(
      (p) => p.id !== instanceId,
    );

    if (selectedPlugin.value?.id === instanceId) {
      selectedPlugin.value = null;
      configPanelOpen.value = false;
    }
  }

  /**
   * Update params for a plugin instance.
   */
  function updatePluginParams(
    phase: PipelinePhase,
    instanceId: string,
    params: Record<string, unknown>,
  ) {
    const instance = lanes.value[phase].find((p) => p.id === instanceId);
    if (instance) {
      store.commitSnapshot();
      instance.params = { ...params };
    }
  }

  /**
   * Open the config panel for a plugin instance.
   */
  function openConfig(instance: PluginInstance) {
    selectedPlugin.value = instance;
    configPanelOpen.value = true;
  }

  /**
   * Close the config panel.
   */
  function closeConfig() {
    configPanelOpen.value = false;
  }

  /**
   * Move a plugin within a lane to a new index.
   */
  function movePlugin(
    phase: PipelinePhase,
    instanceId: string,
    newIndex: number,
  ) {
    const items = lanes.value[phase];
    const currentIndex = items.findIndex((p) => p.id === instanceId);
    if (currentIndex === -1 || currentIndex === newIndex) return;

    store.commitSnapshot();
    const [item] = items.splice(currentIndex, 1);
    const adjustedIndex =
      newIndex > currentIndex ? newIndex - 1 : newIndex;
    items.splice(adjustedIndex, 0, item!);
  }

  return {
    lanes,
    selectedPlugin: readonly(selectedPlugin),
    configPanelOpen,
    syncFromConfig,
    _syncingFromConfig: readonly(_syncingFromConfig),
    toJson,
    addPlugin,
    removePlugin,
    movePlugin,
    updatePluginParams,
    openConfig,
    closeConfig,
  };
}

/**
 * Resolve a short plugin name to its FQN using the available plugins list.
 */
function resolvePluginFqn(
  name: string,
  phase: PipelinePhase,
  plugins: PluginInfo[],
): string {
  if (name.includes(":")) return name;

  const match = plugins.find(
    (p) => p.name === name && p.phase === phase,
  );
  if (match) return match.fqn;

  const anyMatch = plugins.find((p) => p.name === name);
  if (anyMatch) return anyMatch.fqn;

  return name;
}
