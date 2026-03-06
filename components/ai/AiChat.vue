<script setup lang="ts">
interface TextPart {
  type: "text";
  content: string;
}
interface ToolPart {
  type: "tool";
  name: string;
  input?: unknown;
  status: "running" | "done" | "error";
  error?: string;
}
type MessagePart = TextPart | ToolPart;

interface Message {
  role: "user" | "assistant";
  parts: MessagePart[];
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

interface ModelConfig {
  id: string;
  label: string;
  provider: "anthropic" | "openai" | "google" | "deepseek";
  storageKey: string;
  keyHint: string;
  keyLabel: string;
  keyDocsUrl: string;
}

const MODELS: ModelConfig[] = [
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "anthropic",
    storageKey: "fwbg_anthropic_key",
    keyHint: "sk-ant-api03-...",
    keyLabel: "Anthropic",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    storageKey: "fwbg_anthropic_key",
    keyHint: "sk-ant-api03-...",
    keyLabel: "Anthropic",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    storageKey: "fwbg_anthropic_key",
    keyHint: "sk-ant-api03-...",
    keyLabel: "Anthropic",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    storageKey: "fwbg_openai_key",
    keyHint: "sk-proj-...",
    keyLabel: "OpenAI",
    keyDocsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    storageKey: "fwbg_openai_key",
    keyHint: "sk-proj-...",
    keyLabel: "OpenAI",
    keyDocsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "o3-mini",
    label: "o3-mini",
    provider: "openai",
    storageKey: "fwbg_openai_key",
    keyHint: "sk-proj-...",
    keyLabel: "OpenAI",
    keyDocsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    storageKey: "fwbg_google_key",
    keyHint: "AIzaSy...",
    keyLabel: "Google AI",
    keyDocsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    storageKey: "fwbg_google_key",
    keyHint: "AIzaSy...",
    keyLabel: "Google AI",
    keyDocsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "deepseek-chat",
    label: "DeepSeek Chat",
    provider: "deepseek",
    storageKey: "fwbg_deepseek_key",
    keyHint: "sk-...",
    keyLabel: "DeepSeek",
    keyDocsUrl: "https://platform.deepseek.com/api_keys",
  },
];

const MODEL_OPTIONS = MODELS.map((m) => ({
  label: `${m.label}  ·  ${m.keyLabel}`,
  value: m.id,
}));

const messages = ref<Message[]>([]);
const input = ref("");
const loading = ref(false);
const scrollEl = ref<HTMLElement>();
const apiHistory = ref<ApiMessage[]>([]);

// Model selection
const selectedModelId = ref(MODELS[0]!.id);
const selectedModel = computed(() => MODELS.find((m) => m.id === selectedModelId.value) ?? MODELS[0]!);

// API key state
const apiKeys = ref<Record<string, string>>({});
const apiKeyInput = ref("");
const showKeyInput = ref(false);
const keyError = ref("");

onMounted(() => {
  const storedModel = localStorage.getItem("fwbg_selected_model");
  if (storedModel && MODELS.find((m) => m.id === storedModel)) {
    selectedModelId.value = storedModel;
  }

  for (const m of MODELS) {
    const stored = localStorage.getItem(m.storageKey);
    if (stored) apiKeys.value[m.storageKey] = stored;
  }

  checkKeyForModel();
});

function checkKeyForModel() {
  const key = apiKeys.value[selectedModel.value.storageKey];
  showKeyInput.value = !key;
  keyError.value = "";
  apiKeyInput.value = "";
}

watch(selectedModelId, () => {
  localStorage.setItem("fwbg_selected_model", selectedModelId.value);
  checkKeyForModel();
});

function saveApiKey() {
  const k = apiKeyInput.value.trim();
  if (!k) {
    keyError.value = "Bitte API Key eingeben";
    return;
  }
  apiKeys.value[selectedModel.value.storageKey] = k;
  localStorage.setItem(selectedModel.value.storageKey, k);
  showKeyInput.value = false;
  keyError.value = "";
  apiKeyInput.value = "";
}

function resetKey() {
  const key = selectedModel.value.storageKey;
  delete apiKeys.value[key];
  localStorage.removeItem(key);
  showKeyInput.value = true;
  keyError.value = "";
  apiKeyInput.value = "";
}

const toolLabels: Record<string, string> = {
  list_strategies: "Strategien laden",
  get_strategy: "Strategie lesen",
  save_strategy: "Strategie speichern",
  start_run: "Run starten",
  get_run_status: "Run-Status prüfen",
  get_run_results: "Run-Ergebnisse laden",
  get_run_logs: "Run-Logs laden",
  list_recent_runs: "Letzte Runs laden",
  list_indicators: "Indikatoren laden",
  get_indicator_schema: "Indikator-Schema laden",
  list_exit_strategies: "Exit-Strategien laden",
};

async function submit() {
  const text = input.value.trim();
  if (!text || loading.value) return;
  input.value = "";

  messages.value.push({ role: "user", parts: [{ type: "text", content: text }] });
  apiHistory.value.push({ role: "user", content: text });

  loading.value = true;
  const assistantMsg: Message = { role: "assistant", parts: [] };
  messages.value.push(assistantMsg);

  let assistantText = "";
  let currentTool: ToolPart | null = null;

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiHistory.value,
        model: selectedModel.value.id,
        provider: selectedModel.value.provider,
        apiKey: apiKeys.value[selectedModel.value.storageKey] || undefined,
      }),
    });

    if (res.status === 401) {
      messages.value.splice(-2);
      apiHistory.value.pop();
      showKeyInput.value = true;
      const key = selectedModel.value.storageKey;
      delete apiKeys.value[key];
      localStorage.removeItem(key);
      return;
    }

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }

        if (event.type === "text") {
          assistantText += event.content as string;
          const textParts = assistantMsg.parts.filter((p) => p.type === "text") as TextPart[];
          if (textParts.length > 0) {
            textParts[textParts.length - 1]!.content = assistantText;
          } else {
            assistantMsg.parts.push({ type: "text", content: assistantText });
          }
          scrollToBottom();
        } else if (event.type === "tool_start") {
          currentTool = {
            type: "tool",
            name: event.name as string,
            input: event.input,
            status: "running",
          };
          assistantMsg.parts.push(currentTool);
          scrollToBottom();
        } else if (event.type === "tool_done") {
          if (currentTool && currentTool.name === (event.name as string)) {
            currentTool.status = "done";
          }
        } else if (event.type === "tool_error") {
          if (currentTool && currentTool.name === (event.name as string)) {
            currentTool.status = "error";
            currentTool.error = event.error as string;
          }
        } else if (event.type === "done") {
          if (assistantText) {
            apiHistory.value.push({ role: "assistant", content: assistantText });
          }
        } else if (event.type === "error") {
          assistantMsg.parts.push({
            type: "text",
            content: `Fehler: ${event.message as string}`,
          });
        }
      }
    }
  } catch (err) {
    assistantMsg.parts.push({
      type: "text",
      content: `Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollEl.value) {
      scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
    }
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}

function handleKeyInputKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") saveApiKey();
}

function clearChat() {
  messages.value = [];
  apiHistory.value = [];
}
</script>

<template>
  <div class="flex flex-col h-full bg-gray-950">

    <!-- API Key Setup Overlay -->
    <div v-if="showKeyInput" class="flex-1 flex items-center justify-center p-8">
      <div class="w-full max-w-md space-y-4">
        <div class="text-center space-y-2">
          <UIcon name="i-heroicons-key" class="w-10 h-10 text-gray-500 mx-auto" />
          <h2 class="text-base font-semibold text-gray-200">{{ selectedModel.keyLabel }} API Key</h2>
          <p class="text-sm text-gray-500">
            Benötigt für {{ selectedModel.label }}.
            Key holen unter
            <a
              :href="selectedModel.keyDocsUrl"
              target="_blank"
              class="text-blue-400 underline"
            >{{ selectedModel.keyDocsUrl.replace('https://', '') }}</a>
          </p>
        </div>

        <!-- Model selector inside key overlay -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 shrink-0">Modell:</span>
          <USelect
            v-model="selectedModelId"
            :items="MODEL_OPTIONS"
          value-key="value"
            size="sm"
            class="flex-1"
          />
        </div>

        <UInput
          v-model="apiKeyInput"
          type="password"
          :placeholder="selectedModel.keyHint"
          size="md"
          autofocus
          :ui="{ base: 'font-mono' }"
          @keydown="handleKeyInputKeydown"
        />

        <p v-if="keyError" class="text-xs text-red-400">{{ keyError }}</p>

        <UButton block @click="saveApiKey">
          Speichern & fortfahren
        </UButton>

        <p class="text-xs text-gray-600 text-center">
          Key wird nur lokal im Browser gespeichert (localStorage).
        </p>
      </div>
    </div>

    <!-- Chat UI -->
    <template v-else>
      <!-- Messages -->
      <div ref="scrollEl" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <!-- Empty state -->
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center gap-3 text-gray-500">
          <UIcon name="i-heroicons-sparkles" class="w-12 h-12 text-gray-600" />
          <div>
            <p class="font-medium text-gray-400">FWBG AI-Assistent</p>
            <p class="text-sm mt-1">Strategien konfigurieren, Runs starten, Ergebnisse analysieren</p>
          </div>
          <div class="text-xs text-gray-600 space-y-1 mt-2">
            <p>"Zeige mir die letzten Runs"</p>
            <p>"Starte einen Run für sr_trend_continuation"</p>
            <p>"Was lief schief bei Run 20260305_xxx?"</p>
            <p>"Erkläre die Ergebnisse des letzten Runs"</p>
          </div>
        </div>

        <!-- Message list -->
        <template v-for="(msg, i) in messages" :key="i">
          <!-- User -->
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <div class="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
              {{ msg.parts.find(p => p.type === 'text')?.content }}
            </div>
          </div>

          <!-- Assistant -->
          <div v-else class="flex gap-3 items-start">
            <div class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-blue-400" />
            </div>
            <div class="flex-1 space-y-2 min-w-0">
              <template v-for="(part, j) in msg.parts" :key="j">
                <div v-if="part.type === 'text'" class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                  {{ part.content }}
                  <span
                    v-if="loading && i === messages.length - 1 && j === msg.parts.length - 1"
                    class="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle"
                  />
                </div>
                <div v-else-if="part.type === 'tool'" class="flex items-center gap-2 text-xs text-gray-500 bg-gray-900 rounded-lg px-3 py-1.5 w-fit">
                  <UIcon
                    :name="part.status === 'running' ? 'i-heroicons-arrow-path' : part.status === 'error' ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
                    class="w-3.5 h-3.5 flex-shrink-0"
                    :class="{
                      'animate-spin text-blue-400': part.status === 'running',
                      'text-red-400': part.status === 'error',
                      'text-green-500': part.status === 'done',
                    }"
                  />
                  <span>{{ toolLabels[part.name] ?? part.name }}</span>
                  <span v-if="part.status === 'error'" class="text-red-400 ml-1">{{ part.error }}</span>
                </div>
              </template>

              <div v-if="loading && i === messages.length - 1 && msg.parts.length === 0" class="flex gap-1 py-1">
                <span class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style="animation-delay: 0ms" />
                <span class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style="animation-delay: 150ms" />
                <span class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style="animation-delay: 300ms" />
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Input -->
      <div class="border-t border-gray-800 p-3 flex gap-2 items-end">
        <USelect
          v-model="selectedModelId"
          :items="MODEL_OPTIONS"
          value-key="value"
          size="sm"
          class="w-44 shrink-0"
        />
        <UTextarea
          v-model="input"
          placeholder="Nachricht..."
          :rows="1"
          autoresize
          :maxrows="6"
          :disabled="loading"
          class="flex-1 text-sm"
          @keydown="handleKeydown"
        />
        <div class="flex gap-1">
          <UButton
            icon="i-heroicons-key"
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="loading"
            title="API Key ändern"
            @click="resetKey"
          />
          <UButton
            v-if="messages.length > 0"
            icon="i-heroicons-trash"
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="loading"
            @click="clearChat"
          />
          <UButton
            icon="i-heroicons-paper-airplane"
            size="sm"
            :disabled="!input.trim() || loading"
            :loading="loading"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </div>
</template>
