import type {
  StrategyConfig,
  PluginInstance,
  PluginInfo,
  PipelinePhase,
  PipelineEntry,
} from "~/types/strategy";
import { PIPELINE_PHASES } from "~/types/strategy";

/**
 * Composable for managing a strategy's pipeline state in the kanban board.
 * Converts between the internal PluginInstance format and the fwbg JSON format.
 */
export function useStrategy() {
  const strategy = ref<StrategyConfig | null>(null);
  const isDirty = ref(false);

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

  // ── Undo / Reset ──
  type LanesSnapshot = Record<PipelinePhase, PluginInstance[]>;
  const undoStack = ref<LanesSnapshot[]>([]);
  const canUndo = computed(() => undoStack.value.length > 0);
  let _savedSnapshot: LanesSnapshot | null = null;

  function _cloneLanes(): LanesSnapshot {
    const snap = {} as LanesSnapshot;
    for (const phase of PIPELINE_PHASES) {
      snap[phase] = lanes.value[phase].map((p) => ({
        ...p,
        params: { ...p.params },
      }));
    }
    return snap;
  }

  function _pushUndo() {
    undoStack.value.push(_cloneLanes());
    // Keep max 50 entries
    if (undoStack.value.length > 50) undoStack.value.shift();
  }

  function _restoreLanes(snapshot: LanesSnapshot) {
    for (const phase of PIPELINE_PHASES) {
      lanes.value[phase] = snapshot[phase].map((p) => ({
        ...p,
        params: { ...p.params },
      }));
    }
  }

  function undo() {
    const prev = undoStack.value.pop();
    if (!prev) return;
    _restoreLanes(prev);
    isDirty.value = undoStack.value.length > 0 || _savedSnapshot !== null;
  }

  function resetToSaved() {
    if (!_savedSnapshot) return;
    _restoreLanes(_savedSnapshot);
    undoStack.value = [];
    isDirty.value = false;
  }

  /**
   * Load a strategy JSON into the kanban state.
   */
  function loadFromJson(config: StrategyConfig, plugins: PluginInfo[]) {
    strategy.value = config;

    // Helper to convert pipeline entries to PluginInstances
    const toInstances = (
      entries: PipelineEntry[] | undefined,
      phase: PipelinePhase
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
      config.pipeline.data_loading,
      "data_loading"
    );
    lanes.value.preprocessing = toInstances(
      config.pipeline.preprocessing,
      "preprocessing"
    );
    lanes.value.indicators = toInstances(
      config.pipeline.indicators,
      "indicators"
    );
    lanes.value.feature_selection = toInstances(
      config.pipeline.feature_selection,
      "feature_selection"
    );

    // Exit strategy is a single item
    if (config.exit_strategy) {
      lanes.value.exit_strategies = [
        {
          id: crypto.randomUUID(),
          fqn: resolvePluginFqn(
            config.exit_strategy,
            "exit_strategies",
            plugins
          ),
          name: config.exit_strategy,
          phase: "exit_strategies",
          params: { ...(config.exit_params ?? {}) },
        },
      ];
    } else {
      lanes.value.exit_strategies = [];
    }

    // Risk management not in current strategy JSON but we support it
    lanes.value.risk_management = [];

    _savedSnapshot = _cloneLanes();
    undoStack.value = [];
    isDirty.value = false;
  }

  /**
   * Convert kanban state back to fwbg strategy JSON format.
   */
  function toJson(): StrategyConfig {
    if (!strategy.value) throw new Error("No strategy loaded");

    const toEntries = (instances: PluginInstance[]): PipelineEntry[] =>
      instances.map((inst) => ({
        name: inst.name,
        params: { ...inst.params },
      }));

    const exitInstance = lanes.value.exit_strategies[0];

    return {
      ...strategy.value,
      pipeline: {
        data_loading: toEntries(lanes.value.data_loading),
        preprocessing: toEntries(lanes.value.preprocessing),
        indicators: toEntries(lanes.value.indicators),
        feature_selection: toEntries(lanes.value.feature_selection),
      },
      exit_strategy: exitInstance?.name ?? strategy.value.exit_strategy,
      exit_params: exitInstance?.params ?? strategy.value.exit_params,
    };
  }

  /**
   * Add a plugin from the palette to a lane.
   */
  function addPlugin(phase: PipelinePhase, plugin: PluginInfo, index?: number) {
    _pushUndo();
    const instance: PluginInstance = {
      id: crypto.randomUUID(),
      fqn: plugin.fqn,
      name: plugin.name,
      phase,
      params: { ...plugin.defaults },
    };

    // Exit strategies lane allows only one plugin
    if (phase === "exit_strategies") {
      lanes.value[phase] = [instance];
    } else if (index != null && index >= 0 && index < lanes.value[phase].length) {
      lanes.value[phase].splice(index, 0, instance);
    } else {
      lanes.value[phase].push(instance);
    }

    isDirty.value = true;
    return instance;
  }

  /**
   * Remove a plugin from its lane.
   */
  function removePlugin(phase: PipelinePhase, instanceId: string) {
    _pushUndo();
    lanes.value[phase] = lanes.value[phase].filter(
      (p) => p.id !== instanceId
    );
    isDirty.value = true;

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
    params: Record<string, unknown>
  ) {
    const instance = lanes.value[phase].find((p) => p.id === instanceId);
    if (instance) {
      _pushUndo();
      instance.params = { ...params };
      isDirty.value = true;
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
    newIndex: number
  ) {
    const items = lanes.value[phase];
    const currentIndex = items.findIndex((p) => p.id === instanceId);
    if (currentIndex === -1 || currentIndex === newIndex) return;

    _pushUndo();
    const [item] = items.splice(currentIndex, 1);
    const adjustedIndex =
      newIndex > currentIndex ? newIndex - 1 : newIndex;
    items.splice(adjustedIndex, 0, item!);
    isDirty.value = true;
  }

  /**
   * Update strategy metadata.
   */
  function updateMetadata(updates: Partial<StrategyConfig>) {
    if (!strategy.value) return;
    Object.assign(strategy.value, updates);
    isDirty.value = true;
  }

  return {
    strategy: readonly(strategy),
    lanes,
    isDirty: readonly(isDirty),
    canUndo,
    selectedPlugin: readonly(selectedPlugin),
    configPanelOpen,
    loadFromJson,
    toJson,
    addPlugin,
    removePlugin,
    movePlugin,
    updatePluginParams,
    openConfig,
    closeConfig,
    updateMetadata,
    undo,
    resetToSaved,
  };
}

/**
 * Resolve a short plugin name to its FQN using the available plugins list.
 */
function resolvePluginFqn(
  name: string,
  phase: PipelinePhase,
  plugins: PluginInfo[]
): string {
  // Already FQN
  if (name.includes(":")) return name;

  // Find by name and phase
  const match = plugins.find(
    (p) => p.name === name && p.phase === phase
  );
  if (match) return match.fqn;

  // Find by name only
  const anyMatch = plugins.find((p) => p.name === name);
  if (anyMatch) return anyMatch.fqn;

  return name;
}
