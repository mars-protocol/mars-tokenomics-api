import { NextApiRequest, NextApiResponse } from 'next';
import { dataFetcher } from '../../../src/services/dataFetcher';
import { storageService } from '../../../src/services/storageService';
import { validationService } from '../../../src/services/validationService';

interface IndexingResult {
  success: boolean;
  date: string;
  message: string;
  usedFallback?: boolean;
  warnings?: string[];
  errors?: string[];
  executionTime?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IndexingResult>
) {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];

  console.log(`Starting daily data indexing for ${today}`);

  // Verify this is a cron job request (optional security check)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      date: today,
      message: 'Method not allowed',
    });
  }

  // Check if we already have data for today
  const dataExists = await storageService.dataExistsForDate(today);
  if (dataExists) {
    console.log(`Data already exists for ${today}, skipping indexing`);
    return res.status(200).json({
      success: true,
      date: today,
      message: 'Data already indexed for today',
      executionTime: Date.now() - startTime,
    });
  }

  try {
    // Fetch all data
    console.log('Fetching tokenomics data...');
    const fetchResult = await dataFetcher.fetchAllData();

    if (!fetchResult.success) {
      console.error('Failed to fetch data:', fetchResult.error);

      // Try to create fallback data
      console.log('Attempting to create fallback data...');
      const fallbackResult = await validationService.createFallbackData(today, {});

      if (!fallbackResult.success) {
        return res.status(500).json({
          success: false,
          date: today,
          message: `Data fetch failed and no fallback available: ${fetchResult.error}`,
          errors: [fetchResult.error || 'Unknown fetch error'],
          executionTime: Date.now() - startTime,
        });
      }

      // Store fallback data
      const storeResult = await storageService.storeData(fallbackResult.data!);
      if (!storeResult.success) {
        return res.status(500).json({
          success: false,
          date: today,
          message: `Failed to store fallback data: ${storeResult.error}`,
          errors: [storeResult.error || 'Unknown storage error'],
          executionTime: Date.now() - startTime,
        });
      }

      return res.status(200).json({
        success: true,
        date: today,
        message: 'Data indexed using fallback values',
        usedFallback: true,
        warnings: ['Used previous day data due to fetch failures'],
        executionTime: Date.now() - startTime,
      });
    }

    const currentData = fetchResult.data!;
    console.log('Data fetched successfully, validating...');

    // Validate the data
    const previousData = await validationService.getValidationContext(today);
    const validationResult = await validationService.validateData(currentData, previousData || undefined);

    if (!validationResult.isValid) {
      console.error('Data validation failed:', validationResult.errors);

      // Try to create fallback data with partial current data
      const fallbackResult = await validationService.createFallbackData(today, currentData);

      if (!fallbackResult.success) {
        return res.status(500).json({
          success: false,
          date: today,
          message: 'Data validation failed and no fallback available',
          errors: validationResult.errors,
          executionTime: Date.now() - startTime,
        });
      }

      // Store fallback data
      const storeResult = await storageService.storeData(fallbackResult.data!);
      if (!storeResult.success) {
        return res.status(500).json({
          success: false,
          date: today,
          message: `Failed to store fallback data after validation failure: ${storeResult.error}`,
          errors: [...validationResult.errors, storeResult.error || 'Unknown storage error'],
          executionTime: Date.now() - startTime,
        });
      }

      return res.status(200).json({
        success: true,
        date: today,
        message: 'Data indexed using fallback due to validation failures',
        usedFallback: true,
        warnings: validationResult.warnings,
        errors: validationResult.errors,
        executionTime: Date.now() - startTime,
      });
    }

    // Data is valid, store it
    console.log('Data validation passed, storing...');
    const storeResult = await storageService.storeData(currentData);

    if (!storeResult.success) {
      console.error('Failed to store data:', storeResult.error);
      return res.status(500).json({
        success: false,
        date: today,
        message: `Failed to store data: ${storeResult.error}`,
        errors: [storeResult.error || 'Unknown storage error'],
        executionTime: Date.now() - startTime,
      });
    }

    console.log(`Data indexing completed successfully for ${today}`);
    
    const response: IndexingResult = {
      success: true,
      date: today,
      message: 'Data indexed successfully',
      executionTime: Date.now() - startTime,
    };

    // Add warnings if any
    if (validationResult.warnings.length > 0) {
      response.warnings = validationResult.warnings;
    }

    return res.status(200).json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Unexpected error during indexing:', errorMessage);

    return res.status(500).json({
      success: false,
      date: today,
      message: `Unexpected error: ${errorMessage}`,
      errors: [errorMessage],
      executionTime: Date.now() - startTime,
    });
  }
}

// Export config for Vercel to handle this as a serverless function
export const config = {
  maxDuration: 300, // 5 minutes
};
