import { defineStore } from "pinia";
import { watchDebounced } from "@vueuse/core";
import type { StrategyConfig } from "~/types/strategy";

const MAX_UNDO = 50;
const DEBOUNCE_MS = 300;

/**
 * Build the payload to send to the API, substituting string refs back
 * for sections that have an active preset reference.
 */
function buildSavePayload(config: StrategyConfig): Record<string, unknown> {
  const refs = config._refs ?? {};
  const { _refs, ...base } = config as unknown as Record<string, unknown>;
  const payload = { ...base } as Record<string, unknown>;

  const simpleSections = ["pipeline", "model", "exit_params", "validation", "filters", "resources", "risk_params"] as const;
  for (const key of simpleSections) {
    const ref = refs[key as keyof typeof refs] as string | undefined;
    if (ref) payload[key] = ref;
  }

  return payload;
}

export const useStrategyConfigStore = defineStore("strategy-config", () => {
  // ── Core state ──
  const config = ref<StrategyConfig | null>(null);
  const filename = ref("");
  const _snapshot = ref(""); // JSON of last saved state

  // ── Undo/Redo stacks ──
  const _undoStack = ref<string[]>([]);
  const _redoStack = ref<string[]>([]);
  const _isRestoring = ref(false);
  let _lastKnown = ""; // previous config JSON (not reactive, internal)

  // Re-initialize _lastKnown on client after SSR hydration (plain variable is not serialized)
  if (import.meta.client && _snapshot.value) {
    _lastKnown = _snapshot.value;
  }

  // ── Computed ──
  const isDirty = computed(() => {
    if (!config.value) return false;
    return JSON.stringify(config.value) !== _snapshot.value;
  });
  const canUndo = computed(() => _undoStack.value.length > 0);
  const canRedo = computed(() => _redoStack.value.length > 0);

  // ── Change capture via watchDebounced (VueUse) ──
  watchDebounced(
    () => (config.value ? JSON.stringify(config.value) : ""),
    (currentJson) => {
      if (_isRestoring.value || !currentJson || currentJson === _lastKnown)
        return;
      if (_lastKnown) {
        _undoStack.value.push(_lastKnown);
        if (_undoStack.value.length > MAX_UNDO) _undoStack.value.shift();
        _redoStack.value = [];
      }
      _lastKnown = currentJson;
    },
    { debounce: DEBOUNCE_MS },
  );

  // ── Actions ──

  /** Immediately capture current state for undo (call before discrete operations). */
  function commitSnapshot() {
    if (_isRestoring.value || !config.value) return;
    const current = JSON.stringify(config.value);
    if (current === _lastKnown) return;
    if (_lastKnown) {
      _undoStack.value.push(_lastKnown);
      if (_undoStack.value.length > MAX_UNDO) _undoStack.value.shift();
      _redoStack.value = [];
    }
    _lastKnown = current;
  }

  function undo() {
    if (!_undoStack.value.length || !config.value) return;
    _isRestoring.value = true;

    // Capture current state for redo
    const current = JSON.stringify(config.value);
    _redoStack.value.push(current);

    // Restore previous state
    const previous = _undoStack.value.pop()!;
    config.value = JSON.parse(previous);
    _lastKnown = previous;

    nextTick(() => {
      _isRestoring.value = false;
    });
  }

  function redo() {
    if (!_redoStack.value.length || !config.value) return;
    _isRestoring.value = true;

    // Capture current state for undo
    const current = JSON.stringify(config.value);
    _undoStack.value.push(current);

    // Restore next state
    const next = _redoStack.value.pop()!;
    config.value = JSON.parse(next);
    _lastKnown = next;

    nextTick(() => {
      _isRestoring.value = false;
    });
  }

  async function load(name: string) {
    filename.value = name;
    const data = await $fetch<StrategyConfig>(
      `/api/strategy/strategies/${name}`,
    );

    _isRestoring.value = true;
    config.value = data;
    _snapshot.value = JSON.stringify(data);
    _lastKnown = _snapshot.value;
    _undoStack.value = [];
    _redoStack.value = [];

    nextTick(() => {
      _isRestoring.value = false;
    });
  }

  async function save() {
    if (!config.value || !filename.value) return;
    const payload = buildSavePayload(config.value);
    await $fetch(`/api/strategy/strategies/${filename.value}`, {
      method: "PUT",
      body: payload,
    });
    _snapshot.value = JSON.stringify(config.value);
    _lastKnown = _snapshot.value;

    // Notify other tabs
    _channel?.postMessage({ type: "saved", filename: filename.value });
  }

  function resetToSaved() {
    if (!_snapshot.value) return;
    _isRestoring.value = true;
    config.value = JSON.parse(_snapshot.value);
    _lastKnown = _snapshot.value;
    _undoStack.value = [];
    _redoStack.value = [];

    nextTick(() => {
      _isRestoring.value = false;
    });
  }

  /**
   * Apply a preset to a simple section (model, pipeline, validation, etc.).
   * Stores the ref name in _refs and loads the content into the section.
   */
  function applyPreset(section: string, name: string, content: Record<string, unknown>) {
    if (!config.value) return;
    commitSnapshot();
    if (!config.value._refs) config.value._refs = {};
    (config.value._refs as Record<string, unknown>)[section] = name;
    (config.value as Record<string, unknown>)[section] = content;
  }

  /**
   * Remove the preset reference for a section (section becomes inline/custom).
   */
  function detachPreset(section: string) {
    if (!config.value?._refs) return;
    commitSnapshot();
    delete (config.value._refs as Record<string, unknown>)[section];
  }

  // ── Cross-tab sync via BroadcastChannel ──
  const _channel = import.meta.client
    ? new BroadcastChannel("fwbg-strategy-sync")
    : null;

  if (_channel) {
    _channel.onmessage = (event) => {
      if (
        event.data?.type === "saved" &&
        event.data.filename === filename.value
      ) {
        load(filename.value);
      }
    };
  }

  return {
    config,
    filename,
    isDirty,
    canUndo,
    canRedo,
    load,
    save,
    resetToSaved,
    undo,
    redo,
    commitSnapshot,
    applyPreset,
    detachPreset,
    isRestoring: computed(() => _isRestoring.value),
  };
});
