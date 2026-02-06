/**
 * Download Test Image from Unsplash
 *
 * Downloads a high-quality bookshelf photo for testing our book recognition system
 *
 * Usage: node scripts/download-test-image.js
 * Output: test-image.jpg in project root
 */

import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Unsplash Image URL
 *
 * This is a direct download link to a high-quality bookshelf photo
 * Image features:
 * - Multiple book spines clearly visible
 * - Good lighting and angle
 * - Readable titles
 * - Free to use (Unsplash license)
 *
 * Note: Unsplash requires attribution in production, but not for testing
 * Photo by: [photographer name] on Unsplash
 */
const IMAGE_URL = "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&q=80";

// Where to save the downloaded image (project root)
const OUTPUT_PATH = path.join(__dirname, "..", "test-image.jpg");

/**
 * Download file via HTTPS
 *
 * @param {string} url - URL to download from
 * @param {string} filepath - Where to save the file
 * @returns {Promise<void>}
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading image from Unsplash...`);
    console.log(`URL: ${url}`);

    /**
     * Create write stream to save file
     * - Creates file if doesn't exist
     * - Overwrites if exists
     * - Binary mode for image data
     */
    const fileStream = fs.createWriteStream(filepath);

    /**
     * Make HTTPS GET request
     * - Follows redirects automatically
     * - Streams response directly to file (memory efficient)
     */
    https
      .get(url, (response) => {
        // Check for successful response
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        /**
         * Pipe response to file
         * - Streams data chunk by chunk
         * - Doesn't load entire image into memory
         * - Efficient for large files
         */
        response.pipe(fileStream);

        // Handle completion
        fileStream.on("finish", () => {
          fileStream.close();
          console.log(`✅ Image downloaded successfully!`);
          console.log(`Saved to: ${filepath}`);

          // Show file stats
          const stats = fs.statSync(filepath);
          console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

          resolve();
        });
      })
      .on("error", (err) => {
        // Clean up partial download on error
        fs.unlink(filepath, () => {});
        reject(err);
      });

    // Handle file write errors
    fileStream.on("error", (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

/**
 * Main Execution
 */
async function main() {
  try {
    if (fs.existsSync(OUTPUT_PATH)) {
      console.log(`⚠️  test-image.jpg already exists`);
      console.log(`Delete it first if you want to download a fresh copy`);
      process.exit(0);
    }

    await downloadFile(IMAGE_URL, OUTPUT_PATH);
    console.log(`\n✅ Ready for testing!`);
    console.log(`Run: npm run test:upload`);
  } catch (error) {
    console.error("❌ Download failed:", error.message);
    process.exit(1);
  }
}

main();
