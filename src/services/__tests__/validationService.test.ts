import { validationService } from '../validationService';
import { VALIDATION_THRESHOLDS } from '../../config/constants';

describe('ValidationService', () => {
  const createMockData = (overrides: Partial<DailyTokenomicsData> = {}): DailyTokenomicsData => ({
    date: '2025-09-12',
    total_supply: '1000000000',
    circulating_supply: '800000000',
    burned_supply: '50000000',
    treasury_supply: '150000000',
    price_usd: 0.15,
    on_chain_liquidity_usd: 100000,
    total_supply_usd: 150000000,
    circulating_supply_usd: 120000000,
    burned_supply_usd: 7500000,
    treasury_supply_usd: 22500000,
    ...overrides,
  });

  describe('validateData', () => {
    it('should pass validation for valid data', async () => {
      const data = createMockData();
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for price too low', async () => {
      const data = createMockData({ 
        price_usd: VALIDATION_THRESHOLDS.MIN_PRICE_USD - 0.0001 
      });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Price too low'))).toBe(true);
    });

    it('should fail validation for price too high', async () => {
      const data = createMockData({ 
        price_usd: VALIDATION_THRESHOLDS.MAX_PRICE_USD + 1 
      });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Price too high')
      );
    });

    it('should fail validation for total supply too low', async () => {
      const data = createMockData({ 
        total_supply: (VALIDATION_THRESHOLDS.MIN_SUPPLY - 1).toString(),
        total_supply_usd: (VALIDATION_THRESHOLDS.MIN_SUPPLY - 1) * 0.15,
      });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Total supply too low')
      );
    });

    it('should fail validation for total supply too high', async () => {
      const data = createMockData({ 
        total_supply: (VALIDATION_THRESHOLDS.MAX_SUPPLY + 1).toString(),
        total_supply_usd: (VALIDATION_THRESHOLDS.MAX_SUPPLY + 1) * 0.15,
      });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Total supply too high')
      );
    });

    it('should fail validation when circulating supply exceeds total supply', async () => {
      const data = createMockData({ 
        circulating_supply: '1100000000', // Higher than total_supply
        circulating_supply_usd: 1100000000 * 0.15,
      });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Circulating supply')
      );
    });

    it('should fail validation for negative supply values', async () => {
      const data = createMockData({ 
        burned_supply: '-1000000',
        burned_supply_usd: -1000000 * 0.15,
      });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Supply values cannot be negative')
      );
    });

    it('should fail validation for negative liquidity', async () => {
      const data = createMockData({ on_chain_liquidity_usd: -1000 });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('On-chain liquidity cannot be negative')
      );
    });

    it('should fail validation for USD value calculation mismatch', async () => {
      const data = createMockData({ 
        total_supply_usd: 200000000, // Should be 150000000 (1000000000 * 0.15)
      });
      const result = await validationService.validateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('USD value calculation mismatch')
      );
    });

    describe('with previous data comparison', () => {
      it('should fail validation for extreme price change', async () => {
        const previousData = createMockData({ 
          date: '2025-09-11',
          price_usd: 0.10 
        });
        const currentData = createMockData({ 
          price_usd: 0.20 // 100% increase
        });

        const result = await validationService.validateData(currentData, previousData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Extreme price change')
        );
      });

      it('should add warning for large price change', async () => {
        const previousData = createMockData({ 
          date: '2025-09-11',
          price_usd: 0.10 
        });
        const currentData = createMockData({ 
          price_usd: 0.13 // 30% increase
        });

        const result = await validationService.validateData(currentData, previousData);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          expect.stringContaining('Large price change')
        );
      });

      it('should fail validation for extreme supply change', async () => {
        const previousData = createMockData({ 
          date: '2025-09-11',
          total_supply: '1000000000'
        });
        const currentData = createMockData({ 
          total_supply: '1600000000', // 60% increase
          total_supply_usd: 1600000000 * 0.15,
        });

        const result = await validationService.validateData(currentData, previousData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Extreme total supply change')
        );
      });

      it('should fail validation when price drops to zero', async () => {
        const previousData = createMockData({ 
          date: '2025-09-11',
          price_usd: 0.15 
        });
        const currentData = createMockData({ 
          price_usd: 0,
          total_supply_usd: 0,
          circulating_supply_usd: 0,
          burned_supply_usd: 0,
          treasury_supply_usd: 0,
        });

        const result = await validationService.validateData(currentData, previousData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Price dropped to zero')
        );
      });

      it('should fail validation when total supply drops to zero', async () => {
        const previousData = createMockData({ 
          date: '2025-09-11',
          total_supply: '1000000000'
        });
        const currentData = createMockData({ 
          total_supply: '0',
          total_supply_usd: 0,
        });

        const result = await validationService.validateData(currentData, previousData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Total supply dropped to zero')
        );
      });

      it('should add warning for large liquidity change', async () => {
        const previousData = createMockData({ 
          date: '2025-09-11',
          on_chain_liquidity_usd: 100000
        });
        const currentData = createMockData({ 
          on_chain_liquidity_usd: 200000 // 100% increase
        });

        const result = await validationService.validateData(currentData, previousData);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          expect.stringContaining('Large liquidity change')
        );
      });
    });
  });

  describe('createFallbackData', () => {
    // Mock storageService for testing
    const mockStorageService = {
      getData: jest.fn(),
    };

    beforeEach(() => {
      // Replace the real storageService with our mock
      const validationServiceModule = require('../validationService');
      validationServiceModule.storageService = mockStorageService;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create fallback data using previous day data', async () => {
      const previousData = createMockData({ date: '2025-09-11' });
      mockStorageService.getData.mockResolvedValue({
        success: true,
        data: previousData,
      });

      const result = await validationService.createFallbackData('2025-09-12', {
        total_supply: '1100000000', // Only this field failed
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        date: '2025-09-12',
        total_supply: '1100000000', // Uses provided value
        circulating_supply: previousData.circulating_supply, // Uses fallback
        price_usd: previousData.price_usd, // Uses fallback
        // USD values should be recalculated
        total_supply_usd: 1100000000 * previousData.price_usd,
      });
      expect(result.usedFallback).toBe(true);
    });

    it('should fail when no previous data available', async () => {
      mockStorageService.getData.mockResolvedValue({
        success: false,
        error: 'No data found',
      });

      const result = await validationService.createFallbackData('2025-09-12', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No previous data available for fallback');
    });

    it('should use all fallback values when no current data provided', async () => {
      const previousData = createMockData({ date: '2025-09-11' });
      mockStorageService.getData.mockResolvedValue({
        success: true,
        data: previousData,
      });

      const result = await validationService.createFallbackData('2025-09-12', {});

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        date: '2025-09-12',
        total_supply: previousData.total_supply,
        circulating_supply: previousData.circulating_supply,
        burned_supply: previousData.burned_supply,
        treasury_supply: previousData.treasury_supply,
        price_usd: previousData.price_usd,
        on_chain_liquidity_usd: previousData.on_chain_liquidity_usd,
      });
    });
  });
});
