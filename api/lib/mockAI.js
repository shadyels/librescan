/**
 * Mock AI Book Recognition Module
 * 
 * This module simulates the behavior of a real AI vision model (Florence-2)
 * for book spine recognition. It returns realistic fake data for testing
 * without making actual API calls to HuggingFace.
 * 
 * Purpose: Allow frontend development and flow testing without API costs
 */

/**
 * Simulates processing delay of a real AI API call
 * Real API calls typically take 2-5 seconds depending on image size
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Mock book recognition function
 * Simulates what Florence-2 would return after analyzing a bookshelf image
 * 
 * In production, this will be replaced with actual HuggingFace API calls
 * 
 * @param {string} imagePath - Path to uploaded image file (not used in mock)
 * @returns {Promise<Object>} Structured book recognition results
 */
export async function recognizeBooks(imagePath) {
  // Simulate AI processing time (3 seconds)
  // Real AI calls take 2-5 seconds depending on image complexity
  await delay(3000)
  
  // Mock recognized books - simulates books found on a typical bookshelf
  // These are realistic titles that would appear in photos
  const mockBooks = [
    {
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      confidence: 0.95  // AI confidence score (0-1 scale)
    },
    {
      title: "To Kill a Mockingbird",
      author: "Harper Lee",
      confidence: 0.92
    },
    {
      title: "1984",
      author: "George Orwell",
      confidence: 0.89
    },
    {
      title: "Pride and Prejudice",
      author: "Jane Austen",
      confidence: 0.87
    },
    {
      title: "The Catcher in the Rye",
      author: "J.D. Salinger",
      confidence: 0.85
    },
    {
      title: "Harry Potter and the Sorcerer's Stone",
      author: "J.K. Rowling",
      confidence: 0.94
    },
    {
      title: "The Hobbit",
      author: "J.R.R. Tolkien",
      confidence: 0.91
    },
    {
      title: "Brave New World",
      author: "Aldous Huxley",
      confidence: 0.83
    }
  ]
  
  // Structure matches what we'll store in database (scans.recognized_books)
  const result = {
    books: mockBooks,
    metadata: {
      total_books_detected: mockBooks.length,
      processing_time_ms: 3000,  // How long AI took to process
      model_used: "mock-ai",     // Will be "florence-2-large" in production
      mock: true                 // Flag to indicate this is test data
    }
  }
  
  console.log(`Mock AI: Recognized ${mockBooks.length} books`)
  return result
}

/**
 * Future: Real Florence-2 API call function
 * This will replace recognizeBooks() when USE_MOCK_AI=false
 * 
 * Will use HuggingFace Inference API:
 * - Endpoint: https://api-inference.huggingface.co/models/microsoft/Florence-2-large
 * - Task: OCR_WITH_REGION
 * - Returns: Text detected in image with bounding boxes
 */
export async function recognizeBooksWithFlorence(imagePath, apiKey) {
  // TODO: Implement in Phase 2B
  // 1. Read image file from imagePath
  // 2. Convert to base64 or buffer
  // 3. POST to HuggingFace API with authorization header
  // 4. Parse response (Florence-2 returns text regions)
  // 5. Extract book titles and authors from detected text
  // 6. Return in same format as mockBooks
  throw new Error('Real AI not implemented yet - use mock mode')
}