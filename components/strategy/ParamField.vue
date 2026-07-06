<script setup lang="ts">
import type { ParamSchema } from "~/types/strategy";

const props = defineProps<{
  name: string;
  schema: ParamSchema;
  modelValue: unknown;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

// For list types, manage as comma-separated string
const listString = computed({
  get: () => {
    if (Array.isArray(value.value)) return value.value.join(", ");
    return "";
  },
  set: (s: string) => {
    const parts = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (props.schema.type === "list[int]") {
      emit(
        "update:modelValue",
        parts.map((p) => parseInt(p, 10)).filter((n) => !isNaN(n))
      );
    } else if (props.schema.type === "list[float]") {
      emit(
        "update:modelValue",
        parts.map((p) => parseFloat(p)).filter((n) => !isNaN(n))
      );
    } else {
      emit("update:modelValue", parts);
    }
  },
});

// Choices for select/choice fields
const choiceItems = computed(() =>
  (props.schema.choices ?? []).map((c) => ({ label: String(c), value: String(c) }))
);

// Multi-select for list[int] with choices
const isMultiSelect = computed(() =>
  props.schema.type === "list[int]" && (props.schema.choices?.length ?? 0) > 0
);

const selectedSet = computed(() => new Set((value.value as number[] | null) ?? []));

function toggleOption(val: string | number) {
  const num = Number(val);
  const current = new Set(selectedSet.value);
  if (current.has(num)) {
    current.delete(num);
  } else {
    current.add(num);
  }
  // Preserve order from choices array
  const ordered = (props.schema.choices ?? [])
    .map((c) => Number(c))
    .filter((n) => current.has(n));
  emit("update:modelValue", ordered);
}

function selectAll() {
  const ordered = (props.schema.choices ?? []).map((c) => Number(c));
  emit("update:modelValue", ordered);
}

function selectNone() {
  emit("update:modelValue", []);
}

const selectedCount = computed(() => ((value.value as number[]) ?? []).length);

function optionLabel(val: string | number): string {
  const key = String(val);
  return props.schema.choice_labels?.[key] ?? key;
}

// ── Session ranges editor ──
type SessionEntry = { name: string; start: number; end: number };

const sessionEntries = computed<SessionEntry[]>(() => {
  const raw = value.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, number[]>).map(([name, range]) => ({
    name,
    start: range[0] ?? 0,
    end: range[1] ?? 0,
  }));
});

function emitSessions(entries: SessionEntry[]) {
  const obj: Record<string, number[]> = {};
  for (const e of entries) {
    const key = e.name.trim().toLowerCase().replace(/\s+/g, "_");
    if (key) obj[key] = [e.start, e.end];
  }
  emit("update:modelValue", obj);
}

function updateSession(idx: number, field: keyof SessionEntry, val: string | number) {
  const entries = [...sessionEntries.value];
  const updated = { ...entries[idx], [field]: field === "name" ? val : Number(val) } as SessionEntry;
  entries[idx] = updated;
  emitSessions(entries);
}

function removeSession(idx: number) {
  emitSessions(sessionEntries.value.filter((_, i) => i !== idx));
}

function addSession() {
  emitSessions([...sessionEntries.value, { name: "new_session", start: 0, end: 8 }]);
}

const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  label: `${String(i).padStart(2, "0")}:00`,
  value: String(i),
}));
</script>

<template>
  <div class="space-y-1">
    <!-- Name -->
    <div class="text-sm font-medium text-gray-200">{{ name }}</div>

    <!-- Description -->
    <p v-if="schema.description" class="text-xs text-gray-500 leading-relaxed">
      {{ schema.description }}
    </p>

    <!-- Input + range hint -->
    <div class="flex items-center gap-2 pt-0.5">
      <!-- Boolean -->
      <USwitch
        v-if="schema.type === 'bool'"
        :model-value="!!value"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Choice / Select -->
      <USelect
        v-else-if="schema.type === 'choice'"
        :model-value="String(value ?? '')"
        :items="choiceItems"
        value-key="value"
        class="w-full"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Integer -->
      <UInput
        v-else-if="schema.type === 'int'"
        type="number"
        :model-value="value as number"
        :min="schema.min"
        :max="schema.max"
        :step="schema.step ?? 1"
        @update:model-value="emit('update:modelValue', parseInt(String($event), 10) || 0)"
      />

      <!-- Float -->
      <UInput
        v-else-if="schema.type === 'float'"
        type="number"
        :model-value="value as number"
        :min="schema.min"
        :max="schema.max"
        :step="schema.step ?? 0.01"
        @update:model-value="emit('update:modelValue', parseFloat(String($event)) || 0)"
      />

      <!-- List[int] with choices: multi-select popover -->
      <UPopover v-else-if="isMultiSelect">
        <UButton variant="outline" class="w-full justify-between">
          <span v-if="selectedCount > 0" class="text-sm">{{ selectedCount }} ausgewählt</span>
          <span v-else class="text-sm text-gray-500">Keine Auswahl</span>
          <UBadge v-if="selectedCount > 0" :label="String(selectedCount)" color="primary" variant="subtle" class="ml-1" />
        </UButton>
        <template #content>
          <div class="p-3 space-y-1 w-64">
            <div
              v-for="choice in schema.choices"
              :key="choice"
              class="flex items-center gap-2 cursor-pointer hover:bg-gray-800/50 rounded px-2 py-1"
              @click="toggleOption(choice)"
            >
              <span
                class="text-sm flex-1"
                :class="selectedSet.has(Number(choice)) ? 'text-white' : 'text-gray-500'"
              >
                {{ optionLabel(choice) }}
              </span>
              <USwitch
                :model-value="selectedSet.has(Number(choice))"
                size="sm"
                @click.stop
                @update:model-value="toggleOption(choice)"
              />
            </div>
            <USeparator class="my-2" />
            <div class="flex gap-2">
              <UButton size="xs" variant="ghost" @click="selectAll">All</UButton>
              <UButton size="xs" variant="ghost" @click="selectNone">None</UButton>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- List types (comma separated input) -->
      <UInput
        v-else-if="schema.type.startsWith('list[')"
        v-model="listString"
        :placeholder="`e.g. ${Array.isArray(schema.default) ? schema.default.join(', ') : ''}`"
      />

      <!-- String (default) -->
      <UInput
        v-else-if="schema.type !== 'session_ranges' && schema.type !== 'dict'"
        :model-value="String(value ?? '')"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Range hint inline -->
      <span v-if="schema.min != null || schema.max != null" class="text-[11px] text-gray-600 whitespace-nowrap shrink-0">
        {{ schema.min ?? '…' }}–{{ schema.max ?? '…' }}
        <template v-if="schema.step">({{ schema.step }})</template>
      </span>
    </div>

    <!-- Session ranges editor -->
    <div v-if="schema.type === 'session_ranges' || schema.type === 'dict'" class="space-y-2 pt-1">
      <div
        v-for="(entry, idx) in sessionEntries"
        :key="idx"
        class="flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-2"
      >
        <UInput
          :model-value="entry.name"
          size="sm"
          class="w-32"
          placeholder="Name"
          @update:model-value="updateSession(idx, 'name', String($event))"
        />
        <USelect
          :model-value="String(entry.start)"
          :items="hourOptions"
          value-key="value"
          size="sm"
          class="w-24"
          @update:model-value="updateSession(idx, 'start', $event)"
        />
        <span class="text-xs text-gray-500">–</span>
        <USelect
          :model-value="String(entry.end)"
          :items="hourOptions"
          value-key="value"
          size="sm"
          class="w-24"
          @update:model-value="updateSession(idx, 'end', $event)"
        />
        <span class="text-[10px] text-gray-600 whitespace-nowrap">
          {{ entry.start < entry.end ? `${entry.end - entry.start}h` : `${24 - entry.start + entry.end}h ↻` }}
        </span>
        <UButton
          icon="i-heroicons-x-mark"
          size="xs"
          variant="ghost"
          color="error"
          @click="removeSession(idx)"
        />
      </div>
      <UButton size="xs" variant="outline" icon="i-heroicons-plus" @click="addSession">
        Session
      </UButton>
    </div>
  </div>
</template>
