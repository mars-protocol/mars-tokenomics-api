import { put, list, head } from '@vercel/blob';
import { BLOB_CONFIG } from '../config/constants';

class StorageService {
  private getFileName(date: string): string {
    return `${BLOB_CONFIG.FILE_PREFIX}-${date}.json`;
  }

  private getBlobUrl(fileName: string): string {
    return `${BLOB_CONFIG.CONTAINER_NAME}/${fileName}`;
  }

  async storeData(data: DailyTokenomicsData): Promise<FetchResult<string>> {
    try {
      const fileName = this.getFileName(data.date);
      const jsonData = JSON.stringify(data, null, 2);
      
      console.log(`Storing data for ${data.date} to blob storage`);
      
      const blob = await put(fileName, jsonData, {
        access: 'public',
        addRandomSuffix: false,
      });

      console.log(`Data stored successfully at: ${blob.url}`);
      
      return {
        success: true,
        data: blob.url,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';
      console.error('Failed to store data:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getData(date: string): Promise<FetchResult<DailyTokenomicsData>> {
    try {
      const fileName = this.getFileName(date);
      
      // Check if file exists
      try {
        await head(fileName);
      } catch {
        return {
          success: false,
          error: `No data found for date: ${date}`,
        };
      }

      // Fetch the data using the public URL
      const response = await fetch(`https://vercel.com/blob/${fileName}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }

      const data: DailyTokenomicsData = await response.json();
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown retrieval error';
      console.error(`Failed to retrieve data for ${date}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getLatestData(): Promise<FetchResult<DailyTokenomicsData>> {
    try {
      const blobs = await list({
        prefix: BLOB_CONFIG.FILE_PREFIX,
        limit: 1,
      });

      if (blobs.blobs.length === 0) {
        return {
          success: false,
          error: 'No data found in storage',
        };
      }

      const latestBlob = blobs.blobs[0];
      const response = await fetch(latestBlob.url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch latest data: ${response.status} ${response.statusText}`);
      }

      const data: DailyTokenomicsData = await response.json();
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown retrieval error';
      console.error('Failed to retrieve latest data:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getDataRange(days: number): Promise<FetchResult<DailyTokenomicsData[]>> {
    try {
      console.log(`Fetching data for the last ${days} days`);
      
      const blobs = await list({
        prefix: BLOB_CONFIG.FILE_PREFIX,
        limit: days,
      });

      if (blobs.blobs.length === 0) {
        return {
          success: false,
          error: 'No data found in storage',
        };
      }

      // Fetch all data concurrently
      const dataPromises = blobs.blobs.map(async (blob) => {
        const response = await fetch(blob.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch data from ${blob.url}`);
        }
        return response.json() as Promise<DailyTokenomicsData>;
      });

      const data = await Promise.all(dataPromises);
      
      // Sort by date (newest first)
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown retrieval error';
      console.error(`Failed to retrieve data range for ${days} days:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getAllData(): Promise<FetchResult<DailyTokenomicsData[]>> {
    try {
      console.log('Fetching all available data');
      
      const blobs = await list({
        prefix: BLOB_CONFIG.FILE_PREFIX,
      });

      if (blobs.blobs.length === 0) {
        return {
          success: false,
          error: 'No data found in storage',
        };
      }

      // Fetch all data concurrently
      const dataPromises = blobs.blobs.map(async (blob) => {
        const response = await fetch(blob.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch data from ${blob.url}`);
        }
        return response.json() as Promise<DailyTokenomicsData>;
      });

      const data = await Promise.all(dataPromises);
      
      // Sort by date (newest first)
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown retrieval error';
      console.error('Failed to retrieve all data:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async dataExistsForDate(date: string): Promise<boolean> {
    try {
      const fileName = this.getFileName(date);
      await head(fileName);
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
