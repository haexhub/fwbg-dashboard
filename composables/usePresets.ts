import type { PresetItem } from "~/types/preset";

/**
 * Composable for fetching and managing versioned presets for a strategy section.
 */
export function usePresets(section: string) {
  const { data: presets, status, refresh } = useFetch<PresetItem[]>(
    `/api/strategy/presets/${section}`,
    { default: () => [], server: false },
  );

  /** Create a new preset (always v1). Returns the created PresetItem. */
  async function createPreset(
    name: string,
    description: string,
    content: unknown,
  ): Promise<PresetItem> {
    const item = await $fetch<PresetItem>(`/api/strategy/presets/${section}`, {
      method: "POST",
      body: { name, description, content },
    });
    await refresh();
    return item;
  }

  /** Overwrite an existing preset's content (version unchanged). */
  async function savePreset(id: string, content: unknown): Promise<void> {
    await $fetch(`/api/strategy/presets/${section}/${id}`, {
      method: "PUT",
      body: content as Record<string, unknown>,
    });
    await refresh();
  }

  /** Create a new version of a preset with updated content. Returns the new PresetItem. */
  async function createVersion(id: string, content: unknown): Promise<PresetItem> {
    const item = await $fetch<PresetItem>(
      `/api/strategy/presets/${section}/${id}/version`,
      { method: "POST", body: content as Record<string, unknown> },
    );
    await refresh();
    return item;
  }

  /** Update preset metadata (name and description only; version unchanged). */
  async function updateMeta(id: string, name: string, description: string): Promise<PresetItem> {
    const item = await $fetch<PresetItem>(`/api/strategy/presets/${section}/${id}`, {
      method: "PATCH",
      body: { name, description },
    });
    await refresh();
    return item;
  }

  /** Delete a preset. scope='all' removes every version with the same display name. */
  async function deletePreset(id: string, scope: "one" | "all"): Promise<void> {
    await $fetch(`/api/strategy/presets/${section}/${id}`, {
      method: "DELETE",
      query: scope === "all" ? { scope: "all" } : {},
    });
    await refresh();
  }

  return { presets, status, refresh, createPreset, savePreset, createVersion, updateMeta, deletePreset };
}
