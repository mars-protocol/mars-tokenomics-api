import { NextApiRequest, NextApiResponse } from 'next';
import { storageService } from '../../src/services/storageService';
import { MARS_TOKEN } from '../../src/config/constants';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenomicsResponse | { error: string; message: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
    });
  }

  try {
    const { days } = req.query;
    const daysParam = (days as DaysParam) || '30';

    // Validate days parameter
    if (!['30', '90', '180', 'all'].includes(daysParam)) {
      return res.status(400).json({
        error: 'Invalid days parameter',
        message: 'Days parameter must be one of: 30, 90, 180, all',
      });
    }

    console.log(`Fetching tokenomics data for ${daysParam} days`);

    // Fetch data based on days parameter
    let dataResult;
    if (daysParam === 'all') {
      dataResult = await storageService.getAllData();
    } else {
      const numDays = parseInt(daysParam, 10);
      dataResult = await storageService.getDataRange(numDays);
    }

    if (!dataResult.success) {
      console.error('Failed to fetch data:', dataResult.error);
      return res.status(500).json({
        error: 'Data fetch failed',
        message: dataResult.error || 'Unknown error occurred',
      });
    }

    const data = dataResult.data!;
    
    if (data.length === 0) {
      return res.status(404).json({
        error: 'No data found',
        message: 'No tokenomics data available',
      });
    }

    // Transform data to the required format
    const response: TokenomicsResponse = {
      data: {
        total_supply: data.map(d => ({
          date: d.date,
          value: d.total_supply,
          value_usd: d.total_supply_usd,
        })),
        circulating_supply: data.map(d => ({
          date: d.date,
          value: d.circulating_supply,
          value_usd: d.circulating_supply_usd,
        })),
        burned_supply: data.map(d => ({
          date: d.date,
          value: d.burned_supply,
          value_usd: d.burned_supply_usd,
        })),
        treasury_supply: data.map(d => ({
          date: d.date,
          value: d.treasury_supply,
          value_usd: d.treasury_supply_usd,
        })),
        price_usd: data.map(d => ({
          date: d.date,
          value: d.price_usd,
        })),
        on_chain_liquidity_usd: data.map(d => ({
          date: d.date,
          value: d.on_chain_liquidity_usd,
        })),
      },
      meta: {
        token: MARS_TOKEN,
        last_updated: data[0]?.date || new Date().toISOString().split('T')[0],
        total_records: data.length,
        days_requested: daysParam === 'all' ? data.length : parseInt(daysParam, 10),
      },
    };

    // Set cache headers for better performance
    const cacheMaxAge = daysParam === 'all' ? 3600 : 1800; // 1 hour for all, 30 min for others
    res.setHeader('Cache-Control', `public, s-maxage=${cacheMaxAge}, stale-while-revalidate=86400`);
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Unexpected error in tokenomics API:', errorMessage);

    return res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
}

// Export config for Vercel
export const config = {
  maxDuration: 30, // 30 seconds
};
