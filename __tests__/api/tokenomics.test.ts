import handler from '../../pages/api/tokenomics';
import { createMocks } from 'node-mocks-http';

// Mock the storage service
jest.mock('../../src/services/storageService', () => ({
  storageService: {
    getAllData: jest.fn(),
    getDataRange: jest.fn(),
  },
}));

const mockStorageService = require('../../src/services/storageService').storageService;

describe('/api/tokenomics', () => {
  const createMockData = (date: string): DailyTokenomicsData => ({
    date,
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 405 for non-GET requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
    });
  });

  it('should return 400 for invalid days parameter', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { days: '45' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Invalid days parameter',
      message: 'Days parameter must be one of: 30, 90, 180, all',
    });
  });

  it('should fetch data for 30 days by default', async () => {
    const mockData = [
      createMockData('2025-09-12'),
      createMockData('2025-09-11'),
    ];

    mockStorageService.getDataRange.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(mockStorageService.getDataRange).toHaveBeenCalledWith(30);
    expect(res._getStatusCode()).toBe(200);

    const responseData = JSON.parse(res._getData());
    expect(responseData.data.total_supply).toHaveLength(2);
    expect(responseData.meta.days_requested).toBe(30);
  });

  it('should fetch data for specified days', async () => {
    const mockData = [createMockData('2025-09-12')];

    mockStorageService.getDataRange.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: '90' },
    });

    await handler(req, res);

    expect(mockStorageService.getDataRange).toHaveBeenCalledWith(90);
    expect(res._getStatusCode()).toBe(200);
  });

  it('should fetch all data when days=all', async () => {
    const mockData = [
      createMockData('2025-09-12'),
      createMockData('2025-09-11'),
      createMockData('2025-09-10'),
    ];

    mockStorageService.getAllData.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: 'all' },
    });

    await handler(req, res);

    expect(mockStorageService.getAllData).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(200);

    const responseData = JSON.parse(res._getData());
    expect(responseData.meta.days_requested).toBe(3);
  });

  it('should return 404 when no data found', async () => {
    mockStorageService.getDataRange.mockResolvedValue({
      success: true,
      data: [],
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: '30' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'No data found',
      message: 'No tokenomics data available',
    });
  });

  it('should return 500 when storage service fails', async () => {
    mockStorageService.getDataRange.mockResolvedValue({
      success: false,
      error: 'Storage error',
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: '30' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Data fetch failed',
      message: 'Storage error',
    });
  });

  it('should return properly formatted response data', async () => {
    const mockData = [
      createMockData('2025-09-12'),
      createMockData('2025-09-11'),
    ];

    mockStorageService.getDataRange.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: '30' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);

    const responseData = JSON.parse(res._getData());
    
    // Check structure
    expect(responseData).toHaveProperty('data');
    expect(responseData).toHaveProperty('meta');

    // Check data arrays
    expect(responseData.data).toHaveProperty('total_supply');
    expect(responseData.data).toHaveProperty('circulating_supply');
    expect(responseData.data).toHaveProperty('burned_supply');
    expect(responseData.data).toHaveProperty('treasury_supply');
    expect(responseData.data).toHaveProperty('price_usd');
    expect(responseData.data).toHaveProperty('on_chain_liquidity_usd');

    // Check data format
    expect(responseData.data.total_supply[0]).toEqual({
      date: '2025-09-12',
      value: '1000000000',
      value_usd: 150000000,
    });

    expect(responseData.data.price_usd[0]).toEqual({
      date: '2025-09-12',
      value: 0.15,
    });

    // Check meta
    expect(responseData.meta).toEqual({
      token: {
        symbol: 'MARS',
        denom: 'factory/neutron1ndu2wvkrxtane8se2tr48gv7nsm46y5gcqjhux/MARS',
        decimals: 6,
      },
      last_updated: '2025-09-12',
      total_records: 2,
      days_requested: 30,
    });
  });

  it('should set appropriate cache headers', async () => {
    const mockData = [createMockData('2025-09-12')];

    mockStorageService.getDataRange.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: '30' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader('Cache-Control')).toBe('public, s-maxage=1800, stale-while-revalidate=86400');
    expect(res.getHeader('Content-Type')).toBe('application/json');
  });

  it('should set longer cache for all data', async () => {
    const mockData = [createMockData('2025-09-12')];

    mockStorageService.getAllData.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: 'all' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader('Cache-Control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400');
  });

  it('should handle unexpected errors', async () => {
    mockStorageService.getDataRange.mockRejectedValue(new Error('Unexpected error'));

    const { req, res } = createMocks({
      method: 'GET',
      query: { days: '30' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Internal server error',
      message: 'Unexpected error',
    });
  });
});
