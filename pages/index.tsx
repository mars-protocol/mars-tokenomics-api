import Head from 'next/head';
import { useState } from 'react';

export default function Home() {
  const [selectedDays, setSelectedDays] = useState('30');
  const [apiResponse, setApiResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleTestApi = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tokenomics?days=${selectedDays}`);
      const data = await response.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setApiResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Mars Protocol Tokenomics API</title>
        <meta name="description" content="Mars Protocol tokenomics data API" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          color: '#333',
          marginBottom: '2rem'
        }}>
          Mars Protocol Tokenomics API
        </h1>

        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h2 style={{ marginTop: 0, color: '#555' }}>API Overview</h2>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            This API provides daily tokenomics data for the Mars Protocol token (MARS) on the Neutron blockchain. 
            Data is automatically indexed daily and includes supply metrics, pricing, and liquidity information.
          </p>

          <h3 style={{ color: '#555', marginTop: '1.5rem' }}>Endpoint</h3>
          <code style={{
            backgroundColor: '#e9ecef',
            padding: '0.5rem',
            borderRadius: '4px',
            display: 'block',
            marginBottom: '1rem'
          }}>
            GET /api/tokenomics?days={'{30|90|180|all}'}
          </code>

          <h3 style={{ color: '#555' }}>Data Sources</h3>
          <ul style={{ color: '#666' }}>
            <li><strong>Total Supply:</strong> Mars Protocol status endpoint</li>
            <li><strong>Circulating Supply:</strong> Mars Protocol status endpoint</li>
            <li><strong>Burned Supply:</strong> Neutron blockchain (burn address balance)</li>
            <li><strong>Treasury Supply:</strong> Neutron blockchain (treasury address balance)</li>
            <li><strong>Price:</strong> CoinGecko API</li>
            <li><strong>On-Chain Liquidity:</strong> Astroport pools</li>
          </ul>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '2rem'
        }}>
          <h2 style={{ marginTop: 0, color: '#555' }}>Test API</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>
              Select time period:
            </label>
            <select 
              value={selectedDays}
              onChange={(e) => setSelectedDays(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="all">All available data</option>
            </select>
          </div>

          <button
            onClick={handleTestApi}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            {loading ? 'Loading...' : 'Test API'}
          </button>

          {apiResponse && (
            <div>
              <h3 style={{ color: '#555', marginBottom: '0.5rem' }}>Response:</h3>
              <pre style={{
                backgroundColor: '#f8f9fa',
                padding: '1rem',
                borderRadius: '4px',
                border: '1px solid #e9ecef',
                overflow: 'auto',
                maxHeight: '400px',
                fontSize: '0.875rem',
                color: '#495057'
              }}>
                {apiResponse}
              </pre>
            </div>
          )}
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: '2rem',
          padding: '1rem',
          color: '#6c757d',
          fontSize: '0.875rem'
        }}>
          <p>
            Data is updated daily at 2 AM UTC via automated indexing.
            <br />
            For more information, visit the{' '}
            <a 
              href="https://github.com/mars-protocol" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#007bff' }}
            >
              Mars Protocol GitHub
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
