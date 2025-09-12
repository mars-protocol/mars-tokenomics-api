import { VALIDATION_THRESHOLDS } from '../config/constants';
import { storageService } from './storageService';

class ValidationService {
  async validateData(
    currentData: DailyTokenomicsData,
    previousData?: DailyTokenomicsData
  ): Promise<DataValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic value validation
    this.validateBasicValues(currentData, errors);

    // Comparative validation if previous data exists
    if (previousData) {
      this.validateChanges(currentData, previousData, errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateBasicValues(data: DailyTokenomicsData, errors: string[]): void {
    // Price validation
    if (data.price_usd < VALIDATION_THRESHOLDS.MIN_PRICE_USD) {
      errors.push(`Price too low: $${data.price_usd} (min: $${VALIDATION_THRESHOLDS.MIN_PRICE_USD})`);
    }
    if (data.price_usd > VALIDATION_THRESHOLDS.MAX_PRICE_USD) {
      errors.push(`Price too high: $${data.price_usd} (max: $${VALIDATION_THRESHOLDS.MAX_PRICE_USD})`);
    }

    // Supply validation
    const totalSupply = parseFloat(data.total_supply);
    const circulatingSupply = parseFloat(data.circulating_supply);
    const burnedSupply = parseFloat(data.burned_supply);
    const treasurySupply = parseFloat(data.treasury_supply);

    if (totalSupply < VALIDATION_THRESHOLDS.MIN_SUPPLY) {
      errors.push(`Total supply too low: ${totalSupply} (min: ${VALIDATION_THRESHOLDS.MIN_SUPPLY})`);
    }
    if (totalSupply > VALIDATION_THRESHOLDS.MAX_SUPPLY) {
      errors.push(`Total supply too high: ${totalSupply} (max: ${VALIDATION_THRESHOLDS.MAX_SUPPLY})`);
    }

    // Logical consistency checks
    if (circulatingSupply > totalSupply) {
      errors.push(`Circulating supply (${circulatingSupply}) cannot exceed total supply (${totalSupply})`);
    }

    if (burnedSupply < 0 || treasurySupply < 0 || circulatingSupply < 0) {
      errors.push('Supply values cannot be negative');
    }

    // Liquidity validation
    if (data.on_chain_liquidity_usd < 0) {
      errors.push(`On-chain liquidity cannot be negative: $${data.on_chain_liquidity_usd}`);
    }

    // USD value consistency
    const expectedTotalSupplyUSD = totalSupply * data.price_usd;
    const actualTotalSupplyUSD = data.total_supply_usd;
    const usdDifference = Math.abs(expectedTotalSupplyUSD - actualTotalSupplyUSD);
    const usdDifferencePercent = (usdDifference / expectedTotalSupplyUSD) * 100;

    if (usdDifferencePercent > 1) { // Allow 1% difference for rounding
      errors.push(`USD value calculation mismatch: expected ${expectedTotalSupplyUSD.toFixed(2)}, got ${actualTotalSupplyUSD.toFixed(2)}`);
    }
  }

  private validateChanges(
    current: DailyTokenomicsData,
    previous: DailyTokenomicsData,
    errors: string[],
    warnings: string[]
  ): void {
    // Price change validation
    const priceChangePercent = this.calculatePercentChange(previous.price_usd, current.price_usd);
    if (Math.abs(priceChangePercent) > VALIDATION_THRESHOLDS.MAX_DAILY_CHANGE_PERCENT) {
      errors.push(`Extreme price change: ${priceChangePercent.toFixed(2)}% (max: ±${VALIDATION_THRESHOLDS.MAX_DAILY_CHANGE_PERCENT}%)`);
    } else if (Math.abs(priceChangePercent) > VALIDATION_THRESHOLDS.MAX_DAILY_CHANGE_PERCENT / 2) {
      warnings.push(`Large price change: ${priceChangePercent.toFixed(2)}%`);
    }

    // Supply change validation
    const totalSupplyChange = this.calculatePercentChange(
      parseFloat(previous.total_supply),
      parseFloat(current.total_supply)
    );
    if (Math.abs(totalSupplyChange) > VALIDATION_THRESHOLDS.MAX_DAILY_CHANGE_PERCENT) {
      errors.push(`Extreme total supply change: ${totalSupplyChange.toFixed(2)}%`);
    }

    const circulatingSupplyChange = this.calculatePercentChange(
      parseFloat(previous.circulating_supply),
      parseFloat(current.circulating_supply)
    );
    if (Math.abs(circulatingSupplyChange) > VALIDATION_THRESHOLDS.MAX_DAILY_CHANGE_PERCENT) {
      errors.push(`Extreme circulating supply change: ${circulatingSupplyChange.toFixed(2)}%`);
    }

    // Liquidity change validation
    const liquidityChange = this.calculatePercentChange(
      previous.on_chain_liquidity_usd,
      current.on_chain_liquidity_usd
    );
    if (Math.abs(liquidityChange) > VALIDATION_THRESHOLDS.MAX_DAILY_CHANGE_PERCENT * 2) { // Allow more variation for liquidity
      warnings.push(`Large liquidity change: ${liquidityChange.toFixed(2)}%`);
    }

    // Check for suspicious zero values
    if (current.price_usd === 0 && previous.price_usd > 0) {
      errors.push('Price dropped to zero - likely data fetch error');
    }
    if (parseFloat(current.total_supply) === 0 && parseFloat(previous.total_supply) > 0) {
      errors.push('Total supply dropped to zero - likely data fetch error');
    }
  }

  private calculatePercentChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue === 0 ? 0 : 100;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  async getValidationContext(date: string): Promise<DailyTokenomicsData | null> {
    // Try to get previous day's data for comparison
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];

    const result = await storageService.getData(previousDateStr);
    return result.success ? result.data! : null;
  }

  async createFallbackData(
    date: string,
    failedData: Partial<DailyTokenomicsData>
  ): Promise<FetchResult<DailyTokenomicsData>> {
    try {
      const previousData = await this.getValidationContext(date);
      
      if (!previousData) {
        return {
          success: false,
          error: 'No previous data available for fallback',
        };
      }

      console.log(`Creating fallback data for ${date} using previous day's data`);

      const fallbackData: DailyTokenomicsData = {
        date,
        total_supply: failedData.total_supply || previousData.total_supply,
        circulating_supply: failedData.circulating_supply || previousData.circulating_supply,
        burned_supply: failedData.burned_supply || previousData.burned_supply,
        treasury_supply: failedData.treasury_supply || previousData.treasury_supply,
        price_usd: failedData.price_usd || previousData.price_usd,
        on_chain_liquidity_usd: failedData.on_chain_liquidity_usd || previousData.on_chain_liquidity_usd,
        total_supply_usd: 0, // Will be calculated below
        circulating_supply_usd: 0, // Will be calculated below
        burned_supply_usd: 0, // Will be calculated below
        treasury_supply_usd: 0, // Will be calculated below
      };

      // Recalculate USD values
      const price = fallbackData.price_usd;
      fallbackData.total_supply_usd = parseFloat(fallbackData.total_supply) * price;
      fallbackData.circulating_supply_usd = parseFloat(fallbackData.circulating_supply) * price;
      fallbackData.burned_supply_usd = parseFloat(fallbackData.burned_supply) * price;
      fallbackData.treasury_supply_usd = parseFloat(fallbackData.treasury_supply) * price;

      return {
        success: true,
        data: fallbackData,
        usedFallback: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fallback error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const validationService = new ValidationService();
