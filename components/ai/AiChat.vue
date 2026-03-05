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
  // raw text for sending back to API
  rawText?: string;
}

// API message format
interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

const messages = ref<Message[]>([]);
const input = ref("");
const loading = ref(false);
const scrollEl = ref<HTMLElement>();

// history sent to API (text only, no tool display)
const apiHistory = ref<ApiMessage[]>([]);

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

  // Add user message
  messages.value.push({ role: "user", parts: [{ type: "text", content: text }], rawText: text });
  apiHistory.value.push({ role: "user", content: text });

  loading.value = true;

  // Add empty assistant message to fill
  const assistantMsg: Message = { role: "assistant", parts: [] };
  messages.value.push(assistantMsg);

  let assistantText = "";
  let currentTool: ToolPart | null = null;

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiHistory.value }),
    });

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
          // update or create text part
          const textParts = assistantMsg.parts.filter((p) => p.type === "text") as TextPart[];
          if (textParts.length > 0) {
            textParts[textParts.length - 1].content = assistantText;
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

function clearChat() {
  messages.value = [];
  apiHistory.value = [];
  assistantText = "";
}

let assistantText = "";
</script>

<template>
  <div class="flex flex-col h-full bg-gray-950">
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
              <!-- Text part -->
              <div v-if="part.type === 'text'" class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                {{ part.content }}
                <!-- Cursor while streaming last message -->
                <span
                  v-if="loading && i === messages.length - 1 && j === msg.parts.length - 1"
                  class="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle"
                />
              </div>

              <!-- Tool call -->
              <div v-else-if="part.type === 'tool'" class="flex items-center gap-2 text-xs text-gray-500 bg-gray-900 rounded-lg px-3 py-1.5 w-fit">
                <UIcon
                  :name="part.status === 'running'
                    ? 'i-heroicons-arrow-path'
                    : part.status === 'error'
                      ? 'i-heroicons-x-circle'
                      : 'i-heroicons-check-circle'"
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

            <!-- Loading indicator if no content yet -->
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
  </div>
</template>
