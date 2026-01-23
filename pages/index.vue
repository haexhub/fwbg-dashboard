<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";

interface Account {
  id: string;
  name: string;
  isActive: boolean;
  accType: "DEMO" | "LIVE" | "UNKNOWN";
  pairsCount: number;
}

interface AccountStatus {
  accountId: string;
  accountName: string;
  isAlive: boolean;
  lastHeartbeatAgo: number;
  status: string;
  active_pairs_count: number;
  active_epics: string[];
  account_mode: string;
}

interface Trade {
  timestamp: string;
  epic: string;
  signal: string;
  size: number;
  pnl: number;
  accountId?: string;
  accountName?: string;
}

interface Performance {
  winRate: number;
  totalPnl: number;
  closedTrades: number;
  maxDrawdown: number;
}

interface AccountInfo {
  balance: number;
  available: number;
  profitLoss: number;
  deposit: number;
}

interface AccountInfoResult {
  accountId: string;
  accountName: string;
  timestamp?: string;
  account?: AccountInfo;
}

interface Position {
  dealId: string;
  epic: string;
  instrumentName: string;
  direction: string;
  size: number;
  openLevel: number;
  currentLevel: number;
  stopLevel: number | null;
  limitLevel: number | null;
  profitLoss: number;
  currency: string;
  createdDate: string;
  accountId?: string;
  accountName?: string;
}

// App version from runtime config
const { appVersion } = useRuntimeConfig().public;

// Fetch all accounts
const { data: accountsData } = await useFetch<{ accounts: Account[] }>("/api/accounts");
const accounts = computed(() => accountsData.value?.accounts || []);

// Selected account from URL query param ("all" = all accounts)
const route = useRoute();
const router = useRouter();

const selectedAccountId = computed({
  get() {
    return (route.query.account as string) || "all";
  },
  set(account) {
    router.push({
      query: account === "all" ? {} : { account },
    });
  },
});

// Toggle account active state
const togglingAccount = ref<string | null>(null);
const toggleAccount = async (accountId: string) => {
  togglingAccount.value = accountId;
  try {
    await fetch(`/api/accounts/${accountId}/toggle`, { method: "POST" });
    // Refresh accounts list
    await refreshNuxtData("accounts");
  } catch (error) {
    console.error("Failed to toggle account:", error);
  } finally {
    togglingAccount.value = null;
  }
};

// Sync trades from IG API
const syncing = ref(false);
const syncTrades = async () => {
  syncing.value = true;
  try {
    const accountId = selectedAccountId.value !== "all" ? selectedAccountId.value : undefined;
    const url = accountId ? `/api/sync?accountId=${accountId}` : "/api/sync";
    await fetch(url, { method: "POST" });
    // Refresh trades and performance after sync
    await refreshTrades();
    await refreshPerformance();
  } catch (error) {
    console.error("Failed to sync trades:", error);
  } finally {
    syncing.value = false;
  }
};

// Build tabs from accounts
const tabs = computed(() => {
  const allTab = {
    label: "Alle Accounts",
    value: "all",
  };
  const accountTabs = accounts.value.map((acc) => ({
    label: acc.name,
    value: acc.id,
  }));
  return [allTab, ...accountTabs];
});

// Fetch data based on selected account
const statusQuery = computed(() =>
  selectedAccountId.value && selectedAccountId.value !== "all"
    ? { accountId: selectedAccountId.value }
    : {}
);
const { data: statusData, refresh: refreshStatus } = await useFetch<{
  accounts?: AccountStatus[];
  summary?: { total: number; online: number; offline: number };
} | AccountStatus>("/api/status", {
  query: statusQuery,
  watch: [selectedAccountId],
});

// Normalize status data for display
const accountStatuses = computed(() => {
  if (!statusData.value) return [];
  if ("accounts" in statusData.value) {
    return statusData.value.accounts || [];
  }
  return [statusData.value as AccountStatus];
});

const statusSummary = computed(() => {
  if (!statusData.value) return { total: 0, online: 0, offline: 0 };
  if ("summary" in statusData.value) {
    return statusData.value.summary || { total: 0, online: 0, offline: 0 };
  }
  const status = statusData.value as AccountStatus;
  return {
    total: 1,
    online: status.isAlive ? 1 : 0,
    offline: status.isAlive ? 0 : 1,
  };
});

const { data: performance, refresh: refreshPerformance } = await useFetch<Performance>(
  "/api/performance",
  {
    query: statusQuery,
    watch: [selectedAccountId],
  }
);

// Fetch account info (balance, margin, etc.)
const { data: accountInfoData, refresh: refreshAccountInfo } = await useFetch<{
  accounts?: AccountInfoResult[];
  summary?: AccountInfo;
} | AccountInfoResult>("/api/account-info", {
  query: statusQuery,
  watch: [selectedAccountId],
});

// Normalize account info for display
const accountInfo = computed(() => {
  if (!accountInfoData.value) return null;
  if ("summary" in accountInfoData.value) {
    return accountInfoData.value.summary;
  }
  return (accountInfoData.value as AccountInfoResult).account;
});

// Fetch open positions with details
const { data: positionsData, refresh: refreshPositions } = await useFetch<{
  positions: Position[];
  summary?: { totalPositions: number; totalProfitLoss: number };
}>("/api/positions", {
  query: statusQuery,
  watch: [selectedAccountId],
});

const { data: trades, refresh: refreshTrades } = await useFetch<{ trades: Trade[] }>(
  "/api/trades",
  {
    query: computed(() => ({
      limit: 20,
      ...(selectedAccountId.value && selectedAccountId.value !== "all"
        ? { accountId: selectedAccountId.value }
        : {}),
    })),
    watch: [selectedAccountId],
  }
);

const { data: logs, refresh: refreshLogs } = await useFetch<{ logs: string[] }>(
  "/api/logs",
  {
    query: computed(() => ({
      lines: 50,
      ...(selectedAccountId.value && selectedAccountId.value !== "all"
        ? { accountId: selectedAccountId.value }
        : {}),
    })),
    watch: [selectedAccountId],
  }
);

// Auto-refresh every 30 seconds
const refreshAll = () => {
  refreshStatus();
  refreshPerformance();
  refreshTrades();
  refreshLogs();
  refreshAccountInfo();
  refreshPositions();
};

onMounted(() => {
  const interval = setInterval(refreshAll, 30000);
  onUnmounted(() => clearInterval(interval));
});

const formatEpic = (epic: string) => {
  const match = epic.match(/CS\.D\.(\w{3})(\w{3})/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return epic;
};

const columns: TableColumn<Trade>[] = [
  { accessorKey: "timestamp", header: "Zeit" },
  {
    accessorKey: "epic",
    header: "Pair",
    cell: ({ row }) => formatEpic(row.original.epic),
  },
  { accessorKey: "signal", header: "Signal" },
  { accessorKey: "size", header: "Size" },
  { accessorKey: "pnl", header: "P&L" },
];

// Columns for open positions table
const positionColumns: TableColumn<Position>[] = [
  {
    accessorKey: "epic",
    header: "Pair",
    cell: ({ row }) => formatEpic(row.original.epic),
  },
  { accessorKey: "direction", header: "Richtung" },
  { accessorKey: "size", header: "Größe" },
  {
    accessorKey: "openLevel",
    header: "Eröffnung",
    cell: ({ row }) => row.original.openLevel.toFixed(5),
  },
  {
    accessorKey: "currentLevel",
    header: "Aktuell",
    cell: ({ row }) => row.original.currentLevel.toFixed(5),
  },
  {
    accessorKey: "stopLevel",
    header: "Stop",
    cell: ({ row }) => row.original.stopLevel?.toFixed(5) || "-",
  },
  {
    accessorKey: "limitLevel",
    header: "Limit",
    cell: ({ row }) => row.original.limitLevel?.toFixed(5) || "-",
  },
  { accessorKey: "profitLoss", header: "G/V" },
];

// Add account column when showing all accounts
const columnsWithAccount = computed(() => {
  if (selectedAccountId.value && selectedAccountId.value !== "all") return columns;
  return [
    ...columns.slice(0, 1),
    { accessorKey: "accountName", header: "Account" },
    ...columns.slice(1),
  ];
});

// Get account by ID
const getAccountById = (id: string) => accounts.value.find((a) => a.id === id);

// Currently selected account details
const selectedAccount = computed(() =>
  selectedAccountId.value && selectedAccountId.value !== "all"
    ? getAccountById(selectedAccountId.value)
    : null
);
</script>

<template>
  <div class="min-h-screen bg-gray-950 p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-baseline gap-3">
          <h1 class="text-2xl font-bold text-white">FWBG Trading Dashboard</h1>
          <span class="text-xs text-gray-500">v{{ appVersion }}</span>
        </div>
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-cloud-arrow-down"
            :loading="syncing"
            @click="syncTrades"
          >
            Sync IG
          </UButton>
          <UButton icon="i-heroicons-arrow-path" @click="refreshAll">
            Refresh
          </UButton>
        </div>
      </div>

      <!-- Account Tabs -->
      <UTabs
        v-if="accounts.length > 0"
        v-model="selectedAccountId"
        :items="tabs"
        class="mb-4"
      />

      <!-- Account Overview (when "Alle Accounts" selected) -->
      <div v-if="selectedAccountId === 'all'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <UCard v-for="acc in accounts" :key="acc.id">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-3 h-3 rounded-full',
                  acc.isActive ? 'bg-green-500' : 'bg-gray-500',
                ]"
              />
              <div>
                <p class="text-lg font-semibold text-white">{{ acc.name }}</p>
                <p class="text-xs text-gray-500">
                  {{ acc.accType }} | {{ acc.pairsCount }} Pairs
                </p>
              </div>
            </div>
            <UButton
              :color="acc.isActive ? 'success' : 'neutral'"
              :variant="acc.isActive ? 'solid' : 'outline'"
              :loading="togglingAccount === acc.id"
              size="sm"
              @click="toggleAccount(acc.id)"
            >
              {{ acc.isActive ? "Aktiv" : "Inaktiv" }}
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Single Account Header (when specific account selected) -->
      <div v-if="selectedAccount" class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div
            :class="[
              'w-3 h-3 rounded-full',
              selectedAccount.isActive ? 'bg-green-500' : 'bg-gray-500',
            ]"
          />
          <div>
            <p class="text-sm text-gray-400">{{ selectedAccount.accType }}</p>
            <p class="text-xs text-gray-500">{{ selectedAccount.pairsCount }} Pairs konfiguriert</p>
          </div>
        </div>
        <UButton
          :color="selectedAccount.isActive ? 'success' : 'neutral'"
          :variant="selectedAccount.isActive ? 'solid' : 'outline'"
          :loading="togglingAccount === selectedAccount.id"
          @click="toggleAccount(selectedAccount.id)"
        >
          {{ selectedAccount.isActive ? "Aktiv" : "Inaktiv" }}
        </UButton>
      </div>

      <!-- Account Info Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Balance -->
        <UCard>
          <p class="text-sm text-gray-400">Kontostand</p>
          <p class="text-2xl font-bold text-white">
            {{ accountInfo?.balance?.toFixed(2) || "0.00" }} €
          </p>
          <p class="text-xs text-gray-500">
            Einlage: {{ accountInfo?.deposit?.toFixed(2) || "0.00" }} €
          </p>
        </UCard>

        <!-- Available -->
        <UCard>
          <p class="text-sm text-gray-400">Verfügbar</p>
          <p class="text-2xl font-bold text-white">
            {{ accountInfo?.available?.toFixed(2) || "0.00" }} €
          </p>
          <p class="text-xs text-gray-500">
            Margin gebunden: {{ ((accountInfo?.balance || 0) - (accountInfo?.available || 0)).toFixed(2) }} €
          </p>
        </UCard>

        <!-- Unrealized P&L -->
        <UCard>
          <p class="text-sm text-gray-400">Offener G/V</p>
          <p
            :class="[
              'text-2xl font-bold',
              (accountInfo?.profitLoss || 0) >= 0
                ? 'text-green-500'
                : 'text-red-500',
            ]"
          >
            {{ (accountInfo?.profitLoss || 0) >= 0 ? "+" : ""
            }}{{ accountInfo?.profitLoss?.toFixed(2) || "0.00" }} €
          </p>
          <p class="text-xs text-gray-500">
            {{ positionsData?.positions?.length || 0 }} offene Position(en)
          </p>
        </UCard>

        <!-- Bot Status -->
        <UCard>
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                statusSummary.online > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500',
              ]"
            />
            <div>
              <p class="text-sm text-gray-400">Bot Status</p>
              <p class="text-lg font-semibold text-white">
                {{ statusSummary.online > 0 ? "Online" : "Offline" }}
              </p>
              <p v-if="selectedAccountId === 'all'" class="text-xs text-gray-500">
                {{ statusSummary.online }}/{{ statusSummary.total }} Accounts aktiv
              </p>
              <p v-else class="text-xs text-gray-500">
                {{ accountStatuses[0]?.account_mode || 'UNKNOWN' }} Mode
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Performance Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Win Rate -->
        <UCard>
          <p class="text-sm text-gray-400">Win Rate</p>
          <p class="text-2xl font-bold text-white">
            {{ performance?.winRate?.toFixed(1) || 0 }}%
          </p>
          <p class="text-xs text-gray-500">
            {{ performance?.closedTrades || 0 }} Trades geschlossen
          </p>
        </UCard>

        <!-- Total P&L -->
        <UCard>
          <p class="text-sm text-gray-400">Realisierter G/V</p>
          <p
            :class="[
              'text-2xl font-bold',
              (performance?.totalPnl || 0) >= 0
                ? 'text-green-500'
                : 'text-red-500',
            ]"
          >
            {{ (performance?.totalPnl || 0) >= 0 ? "+" : ""
            }}{{ performance?.totalPnl?.toFixed(2) || "0.00" }} €
          </p>
          <p class="text-xs text-gray-500">
            Max Drawdown: {{ performance?.maxDrawdown?.toFixed(2) || "0.00" }} €
          </p>
        </UCard>
      </div>

      <!-- Open Positions Table -->
      <UCard v-if="positionsData?.positions && positionsData.positions.length > 0">
        <template #header>
          <h2 class="text-lg font-semibold text-white">Offene Positionen</h2>
        </template>

        <UTable :columns="positionColumns" :data="positionsData.positions">
          <template #direction-cell="{ row }">
            <UBadge :color="row.original.direction === 'BUY' ? 'success' : 'error'">
              {{ row.original.direction }}
            </UBadge>
          </template>
          <template #profitLoss-cell="{ row }">
            <span
              :class="[
                'font-semibold',
                row.original.profitLoss > 0
                  ? 'text-green-500'
                  : row.original.profitLoss < 0
                    ? 'text-red-500'
                    : 'text-gray-400',
              ]"
            >
              {{ row.original.profitLoss > 0 ? "+" : "" }}{{ row.original.profitLoss.toFixed(2) }} €
            </span>
          </template>
        </UTable>
      </UCard>

      <!-- Main Content -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Trade History -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-white">Trade History</h2>
          </template>

          <UTable :columns="columnsWithAccount" :data="(trades?.trades as Trade[]) || []">
            <template #epic-cell="{ row }">
              {{ formatEpic(row.original.epic) }}
            </template>
            <template #signal-cell="{ row }">
              <UBadge :color="row.original.signal === 'BUY' ? 'success' : 'error'">
                {{ row.original.signal }}
              </UBadge>
            </template>
            <template #pnl-cell="{ row }">
              <span
                :class="[
                  row.original.pnl > 0
                    ? 'text-green-500'
                    : row.original.pnl < 0
                      ? 'text-red-500'
                      : 'text-gray-400',
                ]"
              >
                {{ row.original.pnl === 0 ? "Open" : `${row.original.pnl > 0 ? "+" : ""}${row.original.pnl.toFixed(2)} €` }}
              </span>
            </template>
          </UTable>
        </UCard>

        <!-- Logs -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-white">Bot Logs</h2>
          </template>

          <div
            class="h-96 overflow-y-auto bg-gray-900 rounded p-3 font-mono text-xs"
          >
            <div
              v-for="(line, i) in logs?.logs"
              :key="i"
              :class="[
                'py-0.5',
                line.includes('ERROR')
                  ? 'text-red-400'
                  : line.includes('WARNING')
                    ? 'text-yellow-400'
                    : 'text-gray-300',
              ]"
            >
              {{ line }}
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
