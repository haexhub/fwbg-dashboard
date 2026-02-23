<script setup lang="ts">
import type {
  Account,
  AccountStatus,
  SlippageWarning,
  Position,
  AccountData,
  StatusSummary,
  LogsData,
} from "~/types/dashboard";
import { useLiveData } from "~/composables/useLiveData";

// Live data via WebSocket
const {
  allPositions: livePositions,
  accountSummary: liveAccountSummary,
  liveDataObj,
  isConnected: wsConnected,
  connect: wsConnect,
  subscribe: wsSubscribe,
} = useLiveData();

// Fetch all accounts
const { data: accountsData } = await useFetch<{ accounts: Account[] }>(
  "/api/accounts"
);
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
    const accountId =
      selectedAccountId.value !== "all" ? selectedAccountId.value : undefined;
    const url = accountId ? `/api/sync?accountId=${accountId}` : "/api/sync";
    await fetch(url, { method: "POST" });
    refreshPerformance();
  } catch (error) {
    console.error("Failed to sync trades:", error);
  } finally {
    syncing.value = false;
  }
};

// Build tabs from accounts
const tabs = computed(() => {
  const allTab = { label: "Alle Accounts", value: "all" };
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

const { data: statusData, refresh: refreshStatus } = await useFetch<
  | { accounts?: AccountStatus[]; summary?: StatusSummary }
  | AccountStatus
>("/api/status", {
  query: statusQuery,
  watch: [selectedAccountId],
});

// Normalize status data for display
const accountStatuses = computed<AccountStatus[]>(() => {
  if (!statusData.value) return [];
  if ("accounts" in statusData.value) {
    return statusData.value.accounts || [];
  }
  return [statusData.value as AccountStatus];
});

const statusSummary = computed<StatusSummary>(() => {
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

// Slippage warnings from all accounts (or selected account)
const slippageWarnings = computed(() => {
  const warnings: (SlippageWarning & { accountName: string })[] = [];
  for (const status of accountStatuses.value) {
    if (status.slippage_warnings && status.slippage_warnings.length > 0) {
      for (const warning of status.slippage_warnings) {
        warnings.push({ ...warning, accountName: status.accountName });
      }
    }
  }
  return warnings.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
});

// Unified performance data (shared components)
const { performance: livePerformance, refresh: refreshPerformance } =
  useLivePerformance(selectedAccountId);

const { data: logs, refresh: refreshLogs } = await useFetch<LogsData>(
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

// Auto-refresh every 30 seconds (for non-live data)
const refreshAll = () => {
  refreshStatus();
  refreshPerformance();
  refreshLogs();
};

onMounted(() => {
  wsConnect();
  syncTrades();

  const interval = setInterval(refreshAll, 30000);
  onUnmounted(() => clearInterval(interval));
});

// Subscribe to specific account when selection changes
watch(selectedAccountId, (newAccountId) => {
  wsSubscribe(newAccountId);
});

// Use live data for positions
const displayPositions = computed<Position[]>(() => {
  if (selectedAccountId.value === "all") {
    return livePositions.value.length > 0 ? [...livePositions.value] : [];
  }
  const accountData = liveDataObj.value[selectedAccountId.value];
  return accountData?.positions ? [...accountData.positions] : [];
});

// Use live data for account info
const displayAccountInfo = computed<AccountData | null>(() => {
  if (selectedAccountId.value === "all") {
    return liveAccountSummary.value.balance > 0
      ? liveAccountSummary.value
      : null;
  }
  const accountData = liveDataObj.value[selectedAccountId.value];
  return accountData?.account || null;
});

// Get selected account details
const selectedAccount = computed(() =>
  selectedAccountId.value && selectedAccountId.value !== "all"
    ? accounts.value.find((a) => a.id === selectedAccountId.value)
    : null
);
</script>

<template>
  <div class="space-y-6">
    <!-- Account Tabs -->
    <UTabs
      v-if="accounts.length > 0"
      v-model="selectedAccountId"
      :items="tabs"
      class="mb-4"
    />

    <!-- Slippage Warnings -->
    <DashboardSlippageWarningsCard :warnings="slippageWarnings" />

    <!-- Account Overview (when "Alle Accounts" selected) -->
    <DashboardAccountOverviewGrid
      v-if="selectedAccountId === 'all'"
      :accounts="accounts"
      :toggling-account="togglingAccount"
      @toggle="toggleAccount"
    />

    <!-- Single Account Header (when specific account selected) -->
    <div
      v-if="selectedAccount"
      class="flex items-center justify-between mb-4"
    >
      <div class="flex items-center gap-3">
        <div
          :class="[
            'w-3 h-3 rounded-full',
            selectedAccount.isActive ? 'bg-green-500' : 'bg-gray-500',
          ]"
        />
        <div>
          <p class="text-sm text-gray-400">{{ selectedAccount.accType }}</p>
          <p class="text-xs text-gray-500">
            {{ selectedAccount.pairsCount }} Pairs konfiguriert
          </p>
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

    <!-- Live Account Info Cards -->
    <DashboardLiveAccountCards
      :account-info="displayAccountInfo"
      :positions-count="displayPositions.length"
      :status-summary="statusSummary"
      :account-statuses="accountStatuses"
      :ws-connected="wsConnected"
      :show-all-accounts="selectedAccountId === 'all'"
    />

    <!-- Performance Cards (shared) -->
    <PerformanceStatCards v-if="livePerformance" :data="livePerformance" />

    <!-- Equity · Drawdown · Profit per Trade -->
    <PerformanceEquityPanel
      v-if="livePerformance?.equitySimulation.length"
      :simulation="livePerformance.equitySimulation"
      :profit-per-trade="livePerformance.profitPerTrade"
      :log-scale="false"
    />

    <!-- Fallback: simple equity curve when no simulation data -->
    <PerformanceEquityCurve
      v-else-if="livePerformance?.equityCurve.length"
      :points="livePerformance.equityCurve"
    />

    <!-- Open Positions Table -->
    <DashboardOpenPositionsTable
      :positions="displayPositions"
      :ws-connected="wsConnected"
    />

    <!-- Trade History (shared) -->
    <PerformanceTradeTable
      v-if="livePerformance"
      :trades="livePerformance.trades"
    />

    <!-- Bot Logs -->
    <DashboardBotLogsCard :logs="logs ?? null" @refresh="refreshLogs" />
  </div>
</template>
