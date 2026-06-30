import { describe, it, expect } from "vitest";
import {
  earliestAvailable,
  type DukascopyInstrument,
} from "../../composables/useDukascopy";

const eurusd: DukascopyInstrument = {
  symbol: "EURUSD",
  id: "EUR/USD",
  description: "Euro vs US Dollar",
  group: "Forex",
  historyStart: { minute: "2003-05-04", hourly: "2003-05-04", daily: "1973-03-01" },
};
const btcusd: DukascopyInstrument = {
  symbol: "BTCUSD",
  id: "BTC/USD",
  description: "Bitcoin vs US Dollar",
  group: "Krypto",
  historyStart: { minute: "2017-06-01", hourly: "2017-06-01", daily: "2017-06-01" },
};

describe("earliestAvailable", () => {
  it("returns null when nothing is selected", () => {
    expect(earliestAvailable([], "HOUR_1")).toBeNull();
  });

  it("uses the granularity that matches the timeframe", () => {
    // EUR/USD: daily history goes back much further than minute history.
    expect(earliestAvailable([eurusd], "DAY_1")).toBe("1973-03-01");
    expect(earliestAvailable([eurusd], "MINUTE_1")).toBe("2003-05-04");
    expect(earliestAvailable([eurusd], "HOUR_4")).toBe("2003-05-04");
  });

  it("returns the most restrictive (latest) start across the selection", () => {
    // BTC starts in 2017, EUR/USD daily in 1973 -> the common floor is 2017.
    expect(earliestAvailable([eurusd, btcusd], "DAY_1")).toBe("2017-06-01");
    expect(earliestAvailable([eurusd, btcusd], "MINUTE_1")).toBe("2017-06-01");
  });

  it("ignores instruments without a start for the granularity", () => {
    const partial: DukascopyInstrument = {
      ...btcusd,
      historyStart: { minute: null, hourly: "2017-06-01", daily: "2017-06-01" },
    };
    expect(earliestAvailable([eurusd, partial], "MINUTE_1")).toBe("2003-05-04");
  });
});
