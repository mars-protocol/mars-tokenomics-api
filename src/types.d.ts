interface TokenConfig {
  symbol: string;
  denom: string;
  decimals: number;
}

interface DailyTokenomicsData {
  date: string;
  burned_supply: string;
  treasury_supply: string;
  price_usd: number;
  on_chain_liquidity_usd: number;
  burned_supply_usd: number;
  treasury_supply_usd: number;
  updated_at?: string; // ISO timestamp of when this data was stored/updated (optional for backward compatibility)
}

interface TokenomicsResponse {
  data: {
    burned_supply: Array<{ date: string; amount: string; value_usd?: number }>;
    treasury_supply: Array<{
      date: string;
      amount: string;
      value_usd?: number;
    }>;
    price_usd: Array<{ date: string; value_usd: number }>;
    on_chain_liquidity_usd: Array<{ date: string; value_usd: number }>;
  };
  meta: {
    token: TokenConfig;
    last_updated: string; // ISO timestamp of when data was actually fetched/stored
    total_records: number;
    days_requested: number;
  };
}

interface WalletBalance {
  denom: string;
  amount: string;
}

interface WalletBalanceResponse {
  balances: WalletBalance[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

interface AstroportPool {
  chainId: string;
  poolAddress: string;
  poolType: string;
  assets: Array<{
    amount: string;
    denom: string;
    symbol: string;
    description: string;
    decimals: number;
    priceUSD: number;
  }>;
  totalLiquidityUSD: number;
  dayVolumeUSD: number;
  dayLpFeesUSD: number;
}

interface CoinGeckoResponse {
  id: string;
  symbol: string;
  name: string;
  market_data: {
    current_price: {
      usd: number;
    };
  };
}

interface DataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  usedFallback?: boolean;
}

type DaysParam = "30" | "90" | "180" | "all";
