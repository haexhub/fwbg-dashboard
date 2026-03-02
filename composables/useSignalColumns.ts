import type {
  AvailableColumnsResponse,
  ColumnGroup,
  ColumnInfo,
} from "~/types/strategy";

export function useSignalColumns(strategyName: MaybeRef<string>) {
  const groups = ref<ColumnGroup[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetch() {
    const name = toValue(strategyName);
    if (!name) return;

    loading.value = true;
    error.value = null;
    try {
      const data = await $fetch<AvailableColumnsResponse>(
        `/api/signal-composer/available-columns/${encodeURIComponent(name)}`,
      );
      groups.value = data.groups;
    } catch (e: any) {
      error.value = e?.message ?? "Failed to load columns";
      groups.value = [];
    } finally {
      loading.value = false;
    }
  }

  const allColumns = computed<ColumnInfo[]>(() =>
    groups.value.flatMap((g) => g.columns),
  );

  const signalColumns = computed<ColumnInfo[]>(() =>
    allColumns.value.filter((c) => c.type === "signal"),
  );

  /** Flat items for USelect dropdown, grouped by indicator. */
  const columnItems = computed(() =>
    groups.value.map((g) => ({
      label: g.label,
      items: g.columns.map((c) => ({
        label: c.label,
        value: c.name,
        description: c.full_name,
      })),
    })),
  );

  /** Signal-only items for USelect dropdown. */
  const signalColumnItems = computed(() =>
    groups.value
      .map((g) => ({
        label: g.label,
        items: g.columns
          .filter((c) => c.type === "signal")
          .map((c) => ({
            label: c.label,
            value: c.name,
            description: c.full_name,
          })),
      }))
      .filter((g) => g.items.length > 0),
  );

  return {
    groups,
    allColumns,
    signalColumns,
    columnItems,
    signalColumnItems,
    loading,
    error,
    fetch,
  };
}
