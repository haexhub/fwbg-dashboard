<script setup lang="ts">
import type { AccountData, StatusSummary, AccountStatus } from "~/types/dashboard";
import { formatNumber, formatPnL } from "~/types/dashboard";

defineProps<{
  accountInfo: AccountData | null;
  positionsCount: number;
  statusSummary: StatusSummary;
  accountStatuses: AccountStatus[];
  wsConnected: boolean;
  showAllAccounts: boolean;
}>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <!-- Balance -->
    <UCard>
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-400">Kontostand</p>
        <div
          v-if="wsConnected"
          class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
          title="Live"
        />
      </div>
      <p class="text-2xl font-bold text-white">
        {{ formatNumber(accountInfo?.balance || 0) }} €
      </p>
      <p class="text-xs text-gray-500">
        Einlage: {{ formatNumber(accountInfo?.deposit || 0) }} €
      </p>
    </UCard>

    <!-- Available -->
    <UCard>
      <p class="text-sm text-gray-400">Verfügbar</p>
      <p class="text-2xl font-bold text-white">
        {{ formatNumber(accountInfo?.available || 0) }} €
      </p>
      <p class="text-xs text-gray-500">
        Margin gebunden:
        {{
          formatNumber(
            (accountInfo?.balance || 0) - (accountInfo?.available || 0)
          )
        }}
        €
      </p>
    </UCard>

    <!-- Unrealized P&L -->
    <UCard>
      <p class="text-sm text-gray-400">Offener G/V</p>
      <p
        :class="[
          'text-2xl font-bold',
          (accountInfo?.profitLoss || 0) >= 0 ? 'text-green-500' : 'text-red-500',
        ]"
      >
        {{ formatPnL(accountInfo?.profitLoss || 0, "EUR") }}
      </p>
      <p class="text-xs text-gray-500">{{ positionsCount }} offene Position(en)</p>
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
          <p v-if="showAllAccounts" class="text-xs text-gray-500">
            {{ statusSummary.online }}/{{ statusSummary.total }} Accounts aktiv
          </p>
          <p v-else class="text-xs text-gray-500">
            {{ accountStatuses[0]?.account_mode || "UNKNOWN" }} Mode
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
