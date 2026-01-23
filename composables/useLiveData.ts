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

interface AccountData {
  balance: number;
  available: number;
  profitLoss: number;
  deposit: number;
}

interface AccountLiveData {
  accountId: string;
  accountName: string;
  positions: Position[];
  account: AccountData;
  lastUpdate: string;
}

export function useLiveData() {
  // Use a reactive object with account IDs as keys for better reactivity
  const liveDataObj = ref<Record<string, AccountLiveData>>({});
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  const ws = ref<WebSocket | null>(null);

  // Combined positions from all accounts
  const allPositions = computed(() => {
    const positions: Position[] = [];
    for (const data of Object.values(liveDataObj.value)) {
      positions.push(...data.positions);
    }
    return positions;
  });

  // Combined account summary
  const accountSummary = computed(() => {
    let balance = 0;
    let available = 0;
    let profitLoss = 0;
    let deposit = 0;

    for (const data of Object.values(liveDataObj.value)) {
      balance += data.account.balance;
      available += data.account.available;
      profitLoss += data.account.profitLoss;
      deposit += data.account.deposit;
    }

    return { balance, available, profitLoss, deposit };
  });

  // Get data for a specific account - returns the account data directly
  const getAccountData = (accountId: string): AccountLiveData | null => {
    return liveDataObj.value[accountId] || null;
  };

  function connect(accountId?: string) {
    if (import.meta.server) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/positions`;

    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
      isConnected.value = true;
      error.value = null;
      console.log("[WS] Connected");

      // Subscribe to specific account if provided
      if (accountId && accountId !== "all" && ws.value) {
        ws.value.send(JSON.stringify({ type: "subscribe", accountId }));
      }
    };

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Received:", data.type, data.accountId, data.account?.balance);

        if (data.type === "positions" && data.accountId) {
          // Create a new object to trigger Vue reactivity
          liveDataObj.value = {
            ...liveDataObj.value,
            [data.accountId]: {
              accountId: data.accountId,
              accountName: data.accountName,
              positions: data.positions || [],
              account: data.account || { balance: 0, available: 0, profitLoss: 0, deposit: 0 },
              lastUpdate: data.timestamp,
            },
          };
          console.log("[WS] Updated liveData, accounts:", Object.keys(liveDataObj.value).length, "balance:", data.account?.balance);
        } else if (data.type === "error") {
          console.error("[WS] Server error:", data.error);
        }
      } catch (e) {
        console.error("[WS] Failed to parse message:", e);
      }
    };

    ws.value.onerror = (e) => {
      console.error("[WS] Error:", e);
      error.value = "WebSocket connection error";
    };

    ws.value.onclose = () => {
      isConnected.value = false;
      console.log("[WS] Disconnected");

      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (!isConnected.value) {
          connect(accountId);
        }
      }, 5000);
    };
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
  }

  function subscribe(accountId: string) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      if (accountId === "all") {
        // Reconnect without filter
        disconnect();
        connect();
      } else {
        ws.value.send(JSON.stringify({ type: "subscribe", accountId }));
      }
    }
  }

  return {
    liveDataObj: readonly(liveDataObj),
    allPositions,
    accountSummary,
    getAccountData,
    isConnected: readonly(isConnected),
    error: readonly(error),
    connect,
    disconnect,
    subscribe,
  };
}
