# Mars Protocol Tokenomics API

A lightweight API that indexes Mars Protocol tokenomics data daily and serves it through low-latency endpoints. Built for deployment on Vercel with automatic daily data collection via cron jobs.

## Features

- **Daily Data Indexing**: Automatically fetches and stores tokenomics data every day at 2 AM UTC
- **Multiple Data Sources**: Integrates with Mars Protocol status endpoints, Neutron blockchain, CoinGecko, and Astroport
- **Robust Error Handling**: Implements fallback mechanisms and data validation
- **Low Latency**: Serves pre-processed data with appropriate caching headers
- **Comprehensive Testing**: Full test coverage with validation logic
- **TypeScript**: Fully typed for better development experience

## Data Sources

The API collects data from the following sources:

- **Burned Supply**: Neutron blockchain wallet balance of burn address (normalized)
- **Treasury Supply**: Neutron blockchain wallet balance of treasury address (normalized)
- **Price**: CoinGecko API for MARS token price
- **On-Chain Liquidity**: Astroport pools containing MARS tokens

> **Note**: Total and circulating supply data are available through other Mars Protocol services and are not included in this API to maintain reliability.

## API Endpoints

**Base URL:** `https://tokenomics.marsprotocol.io`

### GET `/api/tokenomics`

Returns Mars Protocol tokenomics data.

**Query Parameters:**

- `days` (optional): Number of days of data to return
  - `30` (default): Last 30 days
  - `90`: Last 90 days
  - `180`: Last 180 days
  - `all`: All available data

**Example:**

```bash
curl "https://tokenomics.marsprotocol.io/api/tokenomics?days=30"
```

**Response Format:**

```json
{
  "data": {
    "burned_supply": [
      {
        "date": "2025-09-12",
        "value": "50000000",
        "value_usd": 7500000
      }
    ],
    "treasury_supply": [
      {
        "date": "2025-09-12",
        "value": "150000000",
        "value_usd": 22500000
      }
    ],
    "price_usd": [
      {
        "date": "2025-09-12",
        "value": 0.15
      }
    ],
    "on_chain_liquidity_usd": [
      {
        "date": "2025-09-12",
        "value": 100000
      }
    ]
  },
  "meta": {
    "token": {
      "symbol": "MARS",
      "denom": "factory/neutron1ndu2wvkrxtane8se2tr48gv7nsm46y5gcqjhux/MARS",
      "decimals": 6
    },
    "last_updated": "2025-09-12",
    "total_records": 30,
    "days_requested": 30
  }
}
```

### POST `/api/cron/index-data`

Internal endpoint for daily data indexing (triggered by Vercel cron).

## Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd mars-tokenomics-api
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env.local
   ```

   Add your Vercel Blob storage token:

   ```
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

4. **Run development server**

   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm test
   ```

## Deployment

### Vercel Deployment

1. **Connect to Vercel**

   ```bash
   vercel
   ```

2. **Set environment variables in Vercel dashboard**

   - `BLOB_READ_WRITE_TOKEN`: Your Vercel Blob storage token

3. **Deploy**
   ```bash
   vercel --prod
   ```

The cron job will automatically start running daily at 2 AM UTC once deployed.

## Configuration

### Token Configuration

The API is configured for the MARS token on Neutron:

```typescript
{
  symbol: 'MARS',
  denom: 'factory/neutron1ndu2wvkrxtane8se2tr48gv7nsm46y5gcqjhux/MARS',
  decimals: 6
}
```

### Validation Thresholds

Data validation includes checks for:

- Price range: $0.0001 - $1000
- Supply range: 1M - 100B tokens
- Maximum daily change: 50%
- USD value calculation consistency

### Wallet Addresses

- **Burn Address**: `neutron1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhufaa6`
- **Treasury Address**: `neutron1yv9veqnaxt3xwafnfdtr9r995m50ad6039lduux5huay6nhnef8sapq3zp`

## Data Storage

The API uses Vercel Blob storage for data persistence:

- Each day's data is stored as a separate JSON file
- Files are named with the pattern: `daily-data-YYYY-MM-DD.json`
- Data is publicly accessible for fast retrieval
- Storage grows incrementally with each day's data

## Error Handling

The API implements comprehensive error handling:

1. **Retry Logic**: Failed API calls are retried up to 3 times with exponential backoff
2. **Data Validation**: All fetched data is validated against reasonable thresholds
3. **Fallback Mechanism**: If data fetching fails, the system uses the previous day's data
4. **Graceful Degradation**: Partial failures are handled by mixing fresh and fallback data

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

Tests cover:

- Data fetching from all external APIs
- Data validation logic
- Storage operations
- API endpoint responses
- Error handling scenarios

## Monitoring

The API provides detailed logging for monitoring:

- Daily indexing results
- Data validation warnings and errors
- API response times
- Fallback usage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please create an issue in the repository.
