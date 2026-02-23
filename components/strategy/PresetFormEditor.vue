<script setup lang="ts">
// Explicit self-import for recursion
import PresetFormEditor from "./PresetFormEditor.vue";

const props = defineProps<{
  modelValue: Record<string, unknown>;
  depth?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, unknown>];
}>();

function set(key: string, value: unknown) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

function typeOf(value: unknown) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) {
    // Arrays of objects → show as JSON textarea
    if (value.some((v) => v !== null && typeof v === "object")) return "array-complex";
    return "array";
  }
  if (typeof value === "object") return "object";
  return "string";
}

function arrayToString(arr: unknown[]): string {
  return arr.map((v) => (v === null ? "null" : String(v))).join(", ");
}

function parseArray(raw: string): unknown[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "")
    .map((v) => {
      if (v === "null") return null;
      if (v === "true") return true;
      if (v === "false") return false;
      const n = Number(v);
      return isNaN(n) ? v : n;
    });
}
</script>

<template>
  <div class="space-y-3">
    <template v-for="(value, key) in modelValue" :key="key">
      <!-- Boolean → toggle -->
      <div v-if="typeOf(value) === 'boolean'" class="flex items-center justify-between py-0.5">
        <span class="text-sm text-gray-300">{{ key }}</span>
        <USwitch
          :model-value="value as boolean"
          @update:model-value="set(String(key), $event)"
        />
      </div>

      <!-- Number → number input -->
      <UFormField v-else-if="typeOf(value) === 'number'" :label="String(key)">
        <UInput
          type="number"
          :model-value="String(value)"
          class="w-full"
          @update:model-value="set(String(key), Number($event))"
        />
      </UFormField>

      <!-- String → text input -->
      <UFormField v-else-if="typeOf(value) === 'string'" :label="String(key)">
        <UInput
          :model-value="String(value)"
          class="w-full"
          @update:model-value="set(String(key), $event)"
        />
      </UFormField>

      <!-- Array of objects → card editor -->
      <div v-else-if="typeOf(value) === 'array-complex'">
        <p class="text-xs text-gray-500 font-semibold uppercase mb-2">{{ key }}</p>
        <StrategyPresetArrayEditor
          :model-value="value as Record<string, unknown>[]"
          @update:model-value="set(String(key), $event)"
        />
      </div>

      <!-- Array → comma-separated input -->
      <UFormField v-else-if="typeOf(value) === 'array'" :label="`${String(key)}`">
        <UInput
          :model-value="arrayToString(value as unknown[])"
          placeholder="1, 2, 3"
          class="w-full font-mono text-xs"
          @update:model-value="set(String(key), parseArray(String($event)))"
        />
        <template #hint>kommagetrennt</template>
      </UFormField>

      <!-- Nested object → recursive (max depth 2) -->
      <div v-else-if="typeOf(value) === 'object' && (depth ?? 0) < 2">
        <p class="text-xs text-gray-500 font-semibold uppercase mb-2">{{ key }}</p>
        <div class="pl-3 border-l border-gray-700 space-y-3">
          <PresetFormEditor
            :model-value="value as Record<string, unknown>"
            :depth="(depth ?? 0) + 1"
            @update:model-value="set(String(key), $event)"
          />
        </div>
      </div>

      <!-- Fallback (null, deep objects) → inline JSON input -->
      <UFormField v-else :label="String(key)">
        <UInput
          :model-value="JSON.stringify(value)"
          class="w-full font-mono text-xs"
          @update:model-value="
            (() => { try { set(String(key), JSON.parse($event as string)); } catch { set(String(key), $event); } })()"
        />
      </UFormField>
    </template>
  </div>
</template>
