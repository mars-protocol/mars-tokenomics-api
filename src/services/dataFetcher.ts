// Types are now globally available from src/types.d.ts
import {
  CHAIN_ID,
  COINGECKO_MARS_ID,
  ENDPOINTS,
  MARS_TOKEN,
  RETRY_CONFIG,
  WALLETS,
} from "../config/constants";

class DataFetcher {
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    parser: (response: Response) => Promise<T> = (r) => r.json()
  ): Promise<FetchResult<T>> {
    let lastError: string = "";

    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        console.log(
          `Fetching ${url} (attempt ${attempt}/${RETRY_CONFIG.MAX_RETRIES})`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            "User-Agent": "mars-tokenomics-api/1.0.0",
            Accept: "application/json",
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await parser(response);
        return { success: true, data };
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === "AbortError") {
            lastError = "Request timeout (10s)";
          } else {
            lastError = error.message;
          }
        } else {
          lastError = "Unknown error";
        }
        console.error(`Attempt ${attempt} failed for ${url}:`, lastError);

        if (attempt < RETRY_CONFIG.MAX_RETRIES) {
          const delay =
            RETRY_CONFIG.RETRY_DELAY *
            Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return { success: false, error: lastError };
  }

  async fetchWalletBalance(address: string): Promise<FetchResult<string>> {
    const url = `${ENDPOINTS.NEUTRON_REST}/cosmos/bank/v1beta1/balances/${address}`;
    const result = await this.fetchWithRetry<WalletBalanceResponse>(url);

    if (result.success && result.data) {
      const marsBalance = result.data.balances.find(
        (balance) => balance.denom === MARS_TOKEN.denom
      );

      if (marsBalance) {
        // Normalize by shifting by decimals
        const normalizedAmount = this.normalizeAmount(
          marsBalance.amount,
          MARS_TOKEN.decimals
        );
        return { success: true, data: normalizedAmount };
      } else {
        return { success: true, data: "0" };
      }
    }

    return { success: false, error: result.error };
  }

  async fetchBurnedSupply(): Promise<FetchResult<string>> {
    return this.fetchWalletBalance(WALLETS.BURN_ADDRESS);
  }

  async fetchTreasurySupply(): Promise<FetchResult<string>> {
    return this.fetchWalletBalance(WALLETS.TREASURY_ADDRESS);
  }

  async fetchMarsPrice(): Promise<FetchResult<number>> {
    const url = `${ENDPOINTS.COINGECKO_BASE}/coins/${COINGECKO_MARS_ID}`;

    const result = await this.fetchWithRetry<CoinGeckoResponse>(url);

    if (result.success && result.data?.market_data?.current_price?.usd) {
      return {
        success: true,
        data: result.data.market_data.current_price.usd,
      };
    }

    return {
      success: false,
      error: result.error || "Price data not available",
    };
  }

  async fetchOnChainLiquidity(): Promise<FetchResult<number>> {
    const url = `${ENDPOINTS.ASTROPORT_POOLS}?chainId=${CHAIN_ID}`;
    const result = await this.fetchWithRetry<AstroportPool[]>(url);

    if (result.success && result.data) {
      const marsLiquidityUSD = result.data
        .filter((pool) =>
          pool.assets.some(
            (asset) =>
              asset.denom === MARS_TOKEN.denom ||
              asset.symbol === MARS_TOKEN.symbol
          )
        )
        .reduce((total, pool) => total + pool.totalLiquidityUSD, 0);

      return { success: true, data: marsLiquidityUSD };
    }

    return { success: false, error: result.error };
  }

  async fetchAllData(): Promise<FetchResult<DailyTokenomicsData>> {
    const date = new Date().toISOString().split("T")[0];

    console.log(`Fetching all tokenomics data for ${date}`);

    // Fetch all data concurrently
    const [
      burnedSupplyResult,
      treasurySupplyResult,
      priceResult,
      liquidityResult,
    ] = await Promise.all([
      this.fetchBurnedSupply(),
      this.fetchTreasurySupply(),
      this.fetchMarsPrice(),
      this.fetchOnChainLiquidity(),
    ]);

    // Check for any failures
    const failures: string[] = [];
    if (!burnedSupplyResult.success)
      failures.push(`Burned supply: ${burnedSupplyResult.error}`);
    if (!treasurySupplyResult.success)
      failures.push(`Treasury supply: ${treasurySupplyResult.error}`);
    if (!priceResult.success) failures.push(`Price: ${priceResult.error}`);
    if (!liquidityResult.success)
      failures.push(`Liquidity: ${liquidityResult.error}`);

    if (failures.length > 0) {
      return {
        success: false,
        error: `Failed to fetch: ${failures.join(", ")}`,
      };
    }

    const price = priceResult.data!;
    const burnedSupply = burnedSupplyResult.data!;
    const treasurySupply = treasurySupplyResult.data!;

    const data: DailyTokenomicsData = {
      date,
      burned_supply: burnedSupply,
      treasury_supply: treasurySupply,
      price_usd: price, // Keep full precision for price
      on_chain_liquidity_usd: Math.round(liquidityResult.data! * 100) / 100,
      burned_supply_usd:
        Math.round(parseFloat(burnedSupply) * price * 100) / 100,
      treasury_supply_usd:
        Math.round(parseFloat(treasurySupply) * price * 100) / 100,
      updated_at: new Date().toISOString(),
    };

    return { success: true, data };
  }

  private normalizeAmount(amount: string, decimals: number): string {
    const amountBigInt = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const normalized = amountBigInt / divisor;
    return normalized.toString();
  }
}

export const dataFetcher = new DataFetcher();
