import { createIGClient, loadAccounts } from "../../utils/ig-client";

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

interface LiveUpdate {
  type: "positions" | "account" | "error";
  timestamp: string;
  accountId?: string;
  accountName?: string;
  positions?: Position[];
  account?: AccountData;
  error?: string;
}

// Track active connections and their polling intervals
const connections = new Map<any, NodeJS.Timeout>();

async function fetchLiveData(accountId?: string): Promise<LiveUpdate[]> {
  const accounts = await loadAccounts();
  console.log(`[WS] Loaded ${accounts.length} accounts, filtering for active`);

  const activeAccounts = accountId
    ? accounts.filter((a) => a.id === accountId && a.isActive)
    : accounts.filter((a) => a.isActive);

  console.log(`[WS] Found ${activeAccounts.length} active accounts to fetch`);

  const updates: LiveUpdate[] = [];

  for (const account of activeAccounts) {
    try {
      const client = await createIGClient(account.id);

      // Fetch positions
      const rawPositions = await client.getOpenPositions();
      const positions: Position[] = rawPositions.map((p: any) => ({
        dealId: p.position?.dealId || "",
        epic: p.market?.epic || "",
        instrumentName: p.market?.instrumentName || "",
        direction: p.position?.direction || "",
        size: parseFloat(p.position?.size || 0),
        openLevel: parseFloat(p.position?.level || 0),
        currentLevel:
          p.position?.direction === "SELL"
            ? parseFloat(p.market?.bid || 0)
            : parseFloat(p.market?.offer || 0),
        stopLevel: p.position?.stopLevel
          ? parseFloat(p.position.stopLevel)
          : null,
        limitLevel: p.position?.limitLevel
          ? parseFloat(p.position.limitLevel)
          : null,
        profitLoss: parseFloat(
          String(p.position?.profitAndLoss || "0").replace(/[^0-9.-]/g, "") ||
            "0"
        ),
        currency: p.position?.currency || "EUR",
        createdDate: p.position?.createdDate || "",
        accountId: account.id,
        accountName: account.name,
      }));

      // Fetch account info
      const accountInfo = await client.getAccountInfo();
      const accountData: AccountData = {
        balance: parseFloat(accountInfo?.balance?.balance || 0),
        available: parseFloat(accountInfo?.balance?.available || 0),
        profitLoss: parseFloat(accountInfo?.balance?.profitLoss || 0),
        deposit: parseFloat(accountInfo?.balance?.deposit || 0),
      };

      console.log(`[WS] ${account.name}: ${positions.length} positions, balance: ${accountData.balance}`);

      updates.push({
        type: "positions",
        timestamp: new Date().toISOString(),
        accountId: account.id,
        accountName: account.name,
        positions,
        account: accountData,
      });
    } catch (error: any) {
      console.error(`[WS] Error fetching ${account.name}:`, error.message);
      updates.push({
        type: "error",
        timestamp: new Date().toISOString(),
        accountId: account.id,
        accountName: account.name,
        error: error.message,
      });
    }
  }

  return updates;
}

export default defineWebSocketHandler({
  open(peer) {
    console.log("[WS] Client connected:", peer.id);

    // Send initial data immediately
    fetchLiveData().then((updates) => {
      for (const update of updates) {
        peer.send(JSON.stringify(update));
      }
    });

    // Set up polling interval (every 5 seconds)
    const interval = setInterval(async () => {
      try {
        const updates = await fetchLiveData();
        for (const update of updates) {
          peer.send(JSON.stringify(update));
        }
      } catch (error: any) {
        peer.send(
          JSON.stringify({
            type: "error",
            timestamp: new Date().toISOString(),
            error: error.message,
          })
        );
      }
    }, 5000);

    connections.set(peer, interval);
  },

  message(peer, message) {
    // Handle client messages (e.g., filter by account)
    try {
      const data = JSON.parse(message.text());

      if (data.type === "subscribe" && data.accountId) {
        // Client wants updates for a specific account
        console.log(`[WS] Client ${peer.id} subscribed to account:`, data.accountId);

        // Clear existing interval
        const existingInterval = connections.get(peer);
        if (existingInterval) {
          clearInterval(existingInterval);
        }

        // Set up new interval with account filter
        const interval = setInterval(async () => {
          try {
            const updates = await fetchLiveData(data.accountId);
            for (const update of updates) {
              peer.send(JSON.stringify(update));
            }
          } catch (error: any) {
            peer.send(
              JSON.stringify({
                type: "error",
                timestamp: new Date().toISOString(),
                error: error.message,
              })
            );
          }
        }, 5000);

        connections.set(peer, interval);

        // Send immediate update
        fetchLiveData(data.accountId).then((updates) => {
          for (const update of updates) {
            peer.send(JSON.stringify(update));
          }
        });
      }
    } catch {
      // Ignore invalid messages
    }
  },

  close(peer) {
    console.log("[WS] Client disconnected:", peer.id);

    // Clear the polling interval
    const interval = connections.get(peer);
    if (interval) {
      clearInterval(interval);
      connections.delete(peer);
    }
  },

  error(peer, error) {
    console.error("[WS] Error for client:", peer.id, error);
  },
});
