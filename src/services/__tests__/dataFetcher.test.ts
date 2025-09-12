import { dataFetcher } from '../dataFetcher';
import { ENDPOINTS, WALLETS, COINGECKO_MARS_ID, MARS_TOKEN } from '../../config/constants';

// Mock fetch
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('DataFetcher', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetchTotalSupply', () => {
    it('should fetch and return total supply', async () => {
      const mockSupply = '1000000000';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockSupply,
      } as Response);

      const result = await dataFetcher.fetchTotalSupply();

      expect(mockFetch).toHaveBeenCalledWith(
        ENDPOINTS.MARS_TOTAL_SUPPLY,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'mars-tokenomics-api/1.0.0',
            'Accept': 'application/json',
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(mockSupply);
    });

    it('should handle fetch errors with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '1000000000',
        } as Response);

      const result = await dataFetcher.fetchTotalSupply();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await dataFetcher.fetchTotalSupply();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('fetchCirculatingSupply', () => {
    it('should fetch and return circulating supply', async () => {
      const mockSupply = '800000000';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockSupply,
      } as Response);

      const result = await dataFetcher.fetchCirculatingSupply();

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockSupply);
    });
  });

  describe('fetchWalletBalance', () => {
    it('should fetch and normalize wallet balance', async () => {
      const mockResponse = {
        balances: [
          {
            denom: MARS_TOKEN.denom,
            amount: '1000000000000', // 1M tokens with 6 decimals
          },
          {
            denom: 'other-token',
            amount: '500000',
          },
        ],
        pagination: { next_key: null, total: '2' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await dataFetcher.fetchWalletBalance('test-address');

      expect(result.success).toBe(true);
      expect(result.data).toBe('1000000'); // Normalized: 1000000000000 / 10^6
    });

    it('should return 0 when MARS token not found', async () => {
      const mockResponse = {
        balances: [
          {
            denom: 'other-token',
            amount: '500000',
          },
        ],
        pagination: { next_key: null, total: '1' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await dataFetcher.fetchWalletBalance('test-address');

      expect(result.success).toBe(true);
      expect(result.data).toBe('0');
    });
  });

  describe('fetchMarsPrice', () => {
    it('should fetch and return MARS price', async () => {
      const mockResponse = {
        id: 'mars-protocol',
        symbol: 'mars',
        name: 'Mars Protocol',
        market_data: {
          current_price: {
            usd: 0.15,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await dataFetcher.fetchMarsPrice();

      expect(mockFetch).toHaveBeenCalledWith(
        `${ENDPOINTS.COINGECKO_BASE}/coins/${COINGECKO_MARS_ID}`,
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(0.15);
    });

    it('should handle missing price data', async () => {
      const mockResponse = {
        id: 'mars-protocol',
        symbol: 'mars',
        name: 'Mars Protocol',
        market_data: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await dataFetcher.fetchMarsPrice();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Price data not available');
    });
  });

  describe('fetchOnChainLiquidity', () => {
    it('should fetch and calculate MARS liquidity', async () => {
      const mockPools = [
        {
          chainId: 'neutron-1',
          poolAddress: 'pool1',
          assets: [
            { denom: MARS_TOKEN.denom, symbol: 'MARS' },
            { denom: 'other-token', symbol: 'OTHER' },
          ],
          totalLiquidityUSD: 100000,
        },
        {
          chainId: 'neutron-1',
          poolAddress: 'pool2',
          assets: [
            { denom: MARS_TOKEN.denom, symbol: 'MARS' },
            { denom: 'another-token', symbol: 'ANOTHER' },
          ],
          totalLiquidityUSD: 50000,
        },
        {
          chainId: 'neutron-1',
          poolAddress: 'pool3',
          assets: [
            { denom: 'token1', symbol: 'TOKEN1' },
            { denom: 'token2', symbol: 'TOKEN2' },
          ],
          totalLiquidityUSD: 75000,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPools,
      } as Response);

      const result = await dataFetcher.fetchOnChainLiquidity();

      expect(result.success).toBe(true);
      expect(result.data).toBe(150000); // 100000 + 50000 (only MARS pools)
    });

    it('should return 0 when no MARS pools found', async () => {
      const mockPools = [
        {
          chainId: 'neutron-1',
          poolAddress: 'pool1',
          assets: [
            { denom: 'token1', symbol: 'TOKEN1' },
            { denom: 'token2', symbol: 'TOKEN2' },
          ],
          totalLiquidityUSD: 100000,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPools,
      } as Response);

      const result = await dataFetcher.fetchOnChainLiquidity();

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });
  });

  describe('fetchAllData', () => {
    it('should fetch all data successfully', async () => {
      // Mock all API calls
      mockFetch
        // Total supply
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '1000000000',
        } as Response)
        // Circulating supply
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '800000000',
        } as Response)
        // Burned supply (wallet balance)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            balances: [{ denom: MARS_TOKEN.denom, amount: '50000000000' }],
            pagination: { next_key: null, total: '1' },
          }),
        } as Response)
        // Treasury supply (wallet balance)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            balances: [{ denom: MARS_TOKEN.denom, amount: '150000000000' }],
            pagination: { next_key: null, total: '1' },
          }),
        } as Response)
        // Price
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            market_data: { current_price: { usd: 0.15 } },
          }),
        } as Response)
        // Liquidity
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              assets: [{ denom: MARS_TOKEN.denom, symbol: 'MARS' }],
              totalLiquidityUSD: 100000,
            },
          ],
        } as Response);

      const result = await dataFetcher.fetchAllData();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        date: expect.any(String),
        total_supply: '1000000000',
        circulating_supply: '800000000',
        burned_supply: '50000',
        treasury_supply: '150000',
        price_usd: 0.15,
        on_chain_liquidity_usd: 100000,
        total_supply_usd: 150000000, // 1000000000 * 0.15
        circulating_supply_usd: 120000000, // 800000000 * 0.15
      });
    });

    it('should fail when any data fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await dataFetcher.fetchAllData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch');
    });
  });
});
