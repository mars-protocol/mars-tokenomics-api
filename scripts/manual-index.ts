/**
 * Manual data indexing script for development and testing
 * Run with: npx ts-node scripts/manual-index.ts
 */

import { dataFetcher } from "../src/services/dataFetcher";
import { storageService } from "../src/services/storageService";
import { validationService } from "../src/services/validationService";

async function manualIndex() {
  console.log("Starting manual data indexing...");

  const startTime = Date.now();
  const today = new Date().toISOString().split("T")[0];

  try {
    // Check if data already exists
    const dataExists = await storageService.dataExistsForDate(today);
    if (dataExists) {
      console.log(`⚠️  Data already exists for ${today}`);
      const overwrite = process.argv.includes("--force");
      if (!overwrite) {
        console.log("Use --force to overwrite existing data");
        return;
      }
      console.log("🔄 Overwriting existing data...");
    }

    // Fetch data
    console.log("📥 Fetching tokenomics data...");
    const fetchResult = await dataFetcher.fetchAllData();

    if (!fetchResult.success) {
      console.error("❌ Failed to fetch data:", fetchResult.error);

      // Try fallback
      console.log("🔄 Attempting fallback...");
      const fallbackResult = await validationService.createFallbackData(
        today,
        {}
      );

      if (!fallbackResult.success) {
        console.error("❌ Fallback also failed:", fallbackResult.error);
        return;
      }

      const storeResult = await storageService.storeData(fallbackResult.data!);
      if (storeResult.success) {
        console.log("✅ Fallback data stored successfully");
        console.log("⚠️  Used previous day data due to fetch failures");
      } else {
        console.error("❌ Failed to store fallback data:", storeResult.error);
      }
      return;
    }

    const currentData = fetchResult.data!;
    console.log("✅ Data fetched successfully");

    // Validate data
    console.log("🔍 Validating data...");
    const previousData = await validationService.getValidationContext(today);
    const validationResult = await validationService.validateData(
      currentData,
      previousData || undefined
    );

    if (!validationResult.isValid) {
      console.error("❌ Data validation failed:");
      validationResult.errors.forEach((error) => console.error(`  - ${error}`));

      // Try fallback with partial data
      console.log("🔄 Creating fallback with partial data...");
      const fallbackResult = await validationService.createFallbackData(
        today,
        currentData
      );

      if (fallbackResult.success) {
        const storeResult = await storageService.storeData(
          fallbackResult.data!
        );
        if (storeResult.success) {
          console.log("✅ Fallback data stored successfully");
          console.log("⚠️  Used fallback due to validation failures");
        } else {
          console.error("❌ Failed to store fallback data:", storeResult.error);
        }
      } else {
        console.error("❌ Fallback creation failed:", fallbackResult.error);
      }
      return;
    }

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      console.log("⚠️  Validation warnings:");
      validationResult.warnings.forEach((warning) =>
        console.log(`  - ${warning}`)
      );
    }

    // Store data
    console.log("💾 Storing data...");
    const storeResult = await storageService.storeData(currentData);

    if (!storeResult.success) {
      console.error("❌ Failed to store data:", storeResult.error);
      return;
    }

    console.log("✅ Data indexed successfully!");
    console.log(`📊 Data summary for ${today}:`);
    console.log(`  - Burned Supply: ${currentData.burned_supply} MARS`);
    console.log(`  - Treasury Supply: ${currentData.treasury_supply} MARS`);
    console.log(`  - Price: $${currentData.price_usd}`);
    console.log(
      `  - On-Chain Liquidity: $${currentData.on_chain_liquidity_usd.toLocaleString()}`
    );
    console.log(
      `  - Burned Supply USD: $${currentData.burned_supply_usd.toLocaleString()}`
    );
    console.log(
      `  - Treasury Supply USD: $${currentData.treasury_supply_usd.toLocaleString()}`
    );
  } catch (error) {
    console.error(
      "❌ Unexpected error:",
      error instanceof Error ? error.message : error
    );
  } finally {
    const executionTime = Date.now() - startTime;
    console.log(`⏱️  Execution time: ${executionTime}ms`);
  }
}

// Run the script
manualIndex().catch(console.error);
