import { head, list, put } from "@vercel/blob";
import { BLOB_CONFIG } from "../config/constants";

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

      // Add timestamp if not already present
      const dataWithTimestamp = {
        ...data,
        updated_at: data.updated_at || new Date().toISOString(),
      };

      const jsonData = JSON.stringify(dataWithTimestamp, null, 2);

      console.log(
        `Storing data for ${data.date} to blob storage with timestamp ${dataWithTimestamp.updated_at}`
      );

      const blob = await put(fileName, jsonData, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      console.log(`Data stored successfully at: ${blob.url}`);

      return {
        success: true,
        data: blob.url,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown storage error";
      console.error("Failed to store data:", errorMessage);

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
        throw new Error(
          `Failed to fetch data: ${response.status} ${response.statusText}`
        );
      }

      const data: DailyTokenomicsData = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown retrieval error";
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
          error: "No data found in storage",
        };
      }

      const latestBlob = blobs.blobs[0];
      const response = await fetch(latestBlob.url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch latest data: ${response.status} ${response.statusText}`
        );
      }

      const data: DailyTokenomicsData = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown retrieval error";
      console.error("Failed to retrieve latest data:", errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getDataRange(
    days: number
  ): Promise<FetchResult<DailyTokenomicsData[]>> {
    try {
      console.log(`Fetching data for the last ${days} days`);

      const initialListResult = await list({
        prefix: BLOB_CONFIG.FILE_PREFIX,
      });

      if (initialListResult.blobs.length === 0) {
        return {
          success: false,
          error: "No data found in storage",
        };
      }

      const allBlobs = [...initialListResult.blobs];
      let cursor = initialListResult.cursor;

      while (cursor) {
        const nextPage = await list({
          prefix: BLOB_CONFIG.FILE_PREFIX,
          cursor,
        });
        allBlobs.push(...nextPage.blobs);
        cursor = nextPage.cursor;
      }

      const sortedBlobs = allBlobs.sort((a, b) => {
        const getDateFromBlob = (blob: (typeof allBlobs)[number]) => {
          const pathname =
            "pathname" in blob && blob.pathname
              ? blob.pathname
              : new URL(blob.url).pathname;
          const fileName = pathname.split("/").pop() ?? "";
          const datePart = fileName
            .replace(`${BLOB_CONFIG.FILE_PREFIX}-`, "")
            .replace(".json", "");
          return datePart;
        };

        const dateA = getDateFromBlob(a);
        const dateB = getDateFromBlob(b);
        return dateB.localeCompare(dateA);
      });

      const recentBlobs = sortedBlobs.slice(0, days);

      if (recentBlobs.length === 0) {
        return {
          success: false,
          error: "Insufficient data available for requested range",
        };
      }

      // Fetch all data concurrently
      const dataPromises = recentBlobs.map(async (blob) => {
        const response = await fetch(blob.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch data from ${blob.url}`);
        }
        return response.json() as Promise<DailyTokenomicsData>;
      });

      const data = await Promise.all(dataPromises);

      // Sort by date (newest first)
      data.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown retrieval error";
      console.error(
        `Failed to retrieve data range for ${days} days:`,
        errorMessage
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getAllData(): Promise<FetchResult<DailyTokenomicsData[]>> {
    try {
      console.log("Fetching all available data");

      const blobs = await list({
        prefix: BLOB_CONFIG.FILE_PREFIX,
      });

      if (blobs.blobs.length === 0) {
        return {
          success: false,
          error: "No data found in storage",
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
      data.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown retrieval error";
      console.error("Failed to retrieve all data:", errorMessage);

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
