// Types are now globally available from src/types.d.ts

export const MARS_TOKEN: TokenConfig = {
  symbol: 'MARS',
  denom: 'factory/neutron1ndu2wvkrxtane8se2tr48gv7nsm46y5gcqjhux/MARS',
  decimals: 6,
};

export const CHAIN_ID = 'neutron-1';

export const ENDPOINTS = {
  NEUTRON_REST: 'https://rest-lb.neutron.org',
  MARS_TOTAL_SUPPLY: 'https://status.marsprotocol.io/ts',
  MARS_CIRCULATING_SUPPLY: 'https://status.marsprotocol.io/cs',
  COINGECKO_BASE: 'https://api.coingecko.com/api/v3',
  ASTROPORT_POOLS: 'https://app.astroport.fi/api/pools',
} as const;

export const WALLETS = {
  BURN_ADDRESS: 'neutron1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhufaa6',
  TREASURY_ADDRESS: 'neutron1yv9veqnaxt3xwafnfdtr9r995m50ad6039lduux5huay6nhnef8sapq3zp',
} as const;

export const COINGECKO_MARS_ID = 'mars-protocol-a7fcbcfb-fd61-4017-92f0-7ee9f9cc6da3';

export const VALIDATION_THRESHOLDS = {
  MAX_DAILY_CHANGE_PERCENT: 50, // 50% max daily change
  MIN_PRICE_USD: 0.0001, // Minimum reasonable price
  MAX_PRICE_USD: 1000, // Maximum reasonable price
  MIN_SUPPLY: 1000000, // Minimum reasonable supply (1M tokens)
  MAX_SUPPLY: 100000000000, // Maximum reasonable supply (100B tokens)
} as const;

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  BACKOFF_MULTIPLIER: 2,
} as const;

export const BLOB_CONFIG = {
  CONTAINER_NAME: 'mars-tokenomics-data',
  FILE_PREFIX: 'daily-data',
} as const;
