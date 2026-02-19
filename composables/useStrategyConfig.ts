import type { StrategyConfig } from "~/types/strategy";

/**
 * Shared strategy config state for sub-page editing.
 * Parent page loads the config; child pages read/write directly.
 */
export function useStrategyConfig() {
  const config = useState<StrategyConfig | null>("strategy-config", () => null);
  const filename = useState<string>("strategy-filename", () => "");
  const _snapshot = useState<string>("strategy-snapshot", () => "");

  const isDirty = computed(() => {
    if (!config.value) return false;
    return JSON.stringify(config.value) !== _snapshot.value;
  });

  async function load(name: string) {
    filename.value = name;
    const data = await $fetch<StrategyConfig>(
      `/api/strategy/strategies/${name}`
    );
    config.value = data;
    _snapshot.value = JSON.stringify(data);
  }

  async function save() {
    if (!config.value || !filename.value) return;
    await $fetch(`/api/strategy/strategies/${filename.value}`, {
      method: "PUT",
      body: config.value,
    });
    _snapshot.value = JSON.stringify(config.value);
  }

  function resetToSaved() {
    if (_snapshot.value) {
      config.value = JSON.parse(_snapshot.value);
    }
  }

  return { config, filename, isDirty, load, save, resetToSaved };
}
