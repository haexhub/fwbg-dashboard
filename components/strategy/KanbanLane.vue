<script setup lang="ts">
import { makeDroppable } from "@vue-dnd-kit/core";
import type { IDnDProviderExternal } from "@vue-dnd-kit/core";
import { PHASE_LABELS, PHASE_ICONS, PHASE_COLORS } from "~/types/strategy";
import type {
  PluginInfo,
  PluginInstance,
  PipelinePhase,
} from "~/types/strategy";

const props = defineProps<{
  phase: PipelinePhase;
  items: PluginInstance[];
  availableCount: number;
}>();

const emit = defineEmits<{
  addPlugin: [plugin: PluginInfo, index: number | undefined];
  movePlugin: [instanceId: string, targetIndex: number];
  removePlugin: [instanceId: string];
  configurePlugin: [instance: PluginInstance];
}>();

const collapsed = ref(false);
const laneRef = ref<HTMLElement | null>(null);

// ── Pointer tracking via requestAnimationFrame ──
// The DnD provider's pointer ref may be mutated in-place, so
// a Vue computed won't reliably re-evaluate. We poll instead.
const activeProvider = shallowRef<IDnDProviderExternal | null>(null);
const dropInsertIndex = ref(0);
let rafId: number | null = null;

function calcDropIndex(pointerY: number): number {
  if (!laneRef.value) return props.items.length;
  const cards = laneRef.value.querySelectorAll("[data-lane-card]");
  if (!cards.length) return 0;

  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i]!.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (pointerY < midY) return i;
  }
  return props.items.length;
}

function startTracking() {
  const tick = () => {
    if (!activeProvider.value) return;
    const y = activeProvider.value.pointer.value?.current?.y;
    if (y != null) {
      dropInsertIndex.value = calcDropIndex(y);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopTracking() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

const { isDragOver } = makeDroppable(
  laneRef,
  {
    groups: [props.phase, "lane-reorder"],
    events: {
      onEnter: (event) => {
        activeProvider.value = event.provider;
        startTracking();
      },
      onLeave: () => {
        stopTracking();
        activeProvider.value = null;
      },
      onDrop: (event) => {
        const insertIndex = dropInsertIndex.value;
        stopTracking();
        activeProvider.value = null;

        const payload = event.payload;
        if (!payload) return;

        const item = payload.items[payload.index];
        const dropData = payload.dropData as
          | { source: "palette" }
          | { source: "lane"; instanceId: string; phase: string }
          | undefined;

        if (!dropData || !item) return;

        if (dropData.source === "palette") {
          const idx =
            insertIndex < props.items.length ? insertIndex : undefined;
          emit("addPlugin", item as PluginInfo, idx);
        } else if (dropData.source === "lane") {
          emit("movePlugin", dropData.instanceId, insertIndex);
        }
      },
    },
  },
  () => [props.items, { phase: props.phase }]
);

onUnmounted(stopTracking);

// Build display list with placeholder inserted at drop position
interface DisplayItem {
  key: string;
  isPlaceholder: boolean;
  instance?: PluginInstance;
}

const displayItems = computed<DisplayItem[]>(() => {
  const result: DisplayItem[] = props.items.map((inst) => ({
    key: inst.id,
    isPlaceholder: false,
    instance: inst,
  }));

  if (activeProvider.value) {
    result.splice(dropInsertIndex.value, 0, {
      key: "__drop_placeholder__",
      isPlaceholder: true,
    });
  }

  return result;
});
</script>

<template>
  <!-- Collapsed: narrow vertical strip -->
  <div
    v-if="collapsed"
    class="shrink-0 w-10 rounded-lg border border-gray-700 bg-gray-900/50 flex flex-col items-center cursor-pointer select-none transition-all"
    @click="collapsed = false"
  >
    <div class="py-3">
      <UIcon name="i-heroicons-chevron-right" class="text-gray-400" />
    </div>
    <div class="flex-1 flex items-center">
      <span
        class="text-xs font-medium text-gray-500 whitespace-nowrap"
        style="writing-mode: vertical-lr; transform: rotate(180deg)"
      >
        {{ PHASE_LABELS[phase] }}
      </span>
    </div>
    <div class="py-2">
      <UBadge
        v-if="items.length > 0"
        :color="(PHASE_COLORS[phase] as any)"
        variant="subtle"
        size="xs"
      >
        {{ items.length }}
      </UBadge>
    </div>
  </div>

  <!-- Expanded -->
  <div
    v-else
    ref="laneRef"
    class="shrink-0 w-56 rounded-lg border transition-all flex flex-col"
    :class="{
      'border-blue-500/50 bg-blue-500/5': isDragOver,
      'border-gray-700 bg-gray-900/50': !isDragOver,
    }"
  >
    <!-- Lane Header -->
    <div
      class="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0"
    >
      <div class="flex items-center gap-2">
        <UIcon :name="PHASE_ICONS[phase]" class="text-gray-400" />
        <span class="text-sm font-medium text-white">
          {{ PHASE_LABELS[phase] }}
        </span>
        <UBadge
          :color="items.length > 0 ? (PHASE_COLORS[phase] as any) : 'neutral'"
          variant="subtle"
          size="xs"
        >
          {{ items.length }}
        </UBadge>
      </div>
      <UIcon
        name="i-heroicons-chevron-left"
        class="text-gray-500 text-xs cursor-pointer select-none"
        @click="collapsed = true"
      />
    </div>

    <!-- Lane Content -->
    <TransitionGroup
      name="lane-card"
      tag="div"
      class="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 relative"
    >
      <div v-for="item in displayItems" :key="item.key">
        <div
          v-if="item.isPlaceholder"
          class="h-10 border-2 border-dashed border-blue-500/40 rounded-md bg-blue-500/5"
        />
        <StrategyLanePluginCard
          v-else
          :instance="item.instance!"
          :phase="phase"
          data-lane-card
          @configure="emit('configurePlugin', item.instance!)"
          @remove="emit('removePlugin', item.instance!.id)"
        />
      </div>

      <div
        v-if="!items.length && !activeProvider"
        key="__empty__"
        class="text-center text-gray-600 text-xs py-4"
      >
        Drop plugins here
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.lane-card-move {
  transition: transform 200ms ease;
}

.lane-card-enter-active {
  transition: all 200ms ease;
}

.lane-card-leave-active {
  transition: all 150ms ease;
  position: absolute;
  width: calc(100% - 16px);
}

.lane-card-enter-from,
.lane-card-leave-to {
  opacity: 0;
  transform: scaleY(0);
}
</style>
