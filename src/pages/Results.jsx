/**
 * Results Page
 *
 * Displays recognized books from a scan with:
 * - Loading state (skeleton cards)
 * - Empty state (no books found)
 * - Sort functionality (by confidence, title, author)
 * - Responsive grid layout
 * - Error handling
 *
 * Route: /results/:scanId
 */

import { useState, useEffect, use } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BookCard from "../components/BookCard";
import SkeletonCard from "../components/SkeletonCard";

function Results() {
  const { scanId } = useParams();

  // useNavigate for programmatic navigation
  const navigate = useNavigate();

  // STEP 2: Initialize state
  /**
   * STATE MANAGEMENT:
   *
   * scan: Full scan object from API (null until loaded)
   * books: Array of book objects (null until loaded)
   * loading: Boolean for loading state (true initially)
   * error: Error message string (null if no error)
   * sortBy: Current sort option ('confidence', 'title', 'author')
   *
   * WHY SEPARATE scan AND books:
   * - scan: Contains metadata (date, model, etc.)
   * - books: Just the book array for easier sorting/filtering
   */
  const [scan, setScan] = useState(null);
  const [books, setBooks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("confidence"); // Default highest confidence first

  // STEP 3: Fetch scan data on component mount
  /**
   * useEffect hook runs after component renders
   *
   * DEPENDENCIES: [scanId]
   * - Runs when component mounts (first render)
   * - Runs again if scanId changes
   *
   * WHY: React's way of handling side effects (data fetching, subscriptions, etc.)
   */

  useEffect(() => {
    async function fetchScan() {
      try {
        // reset states before fetching
        setLoading(true);
        setError(null);

        console.log(`Fetching scan data for: ${scanId}`);

        // get scan data from API
        const response = await fetch(`/api/scan/${scanId}`);

        if (!response.ok) {
          // Handle non-200 responses
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Scan data received:", data);

        //validate data structure
        if (!data.success || !data.scan) {
          throw new Error("Invalid response format");
        }

        // Extract scan and books from response
        const scanData = data.scan;
        const booksData = scanData.recognized_books?.books || [];

        // Update state with fetched data
        setScan(scanData);
        setBooks(booksData);
      } catch (err) {
        console.error("Error fetching scan:", err);
        setError(err.message);
      } finally {
        // Always set loading to false, whether success or error
        setLoading(false);
      }
    }

    fetchScan(); // Call the async function
  }, [scanId]); // Dependency array: re-run if scanId changes

  /**
   * useEffect for sorting books
   *
   * WHY SEPARATE EFFECT:
   * - Separates concerns (fetching vs. sorting)
   * - Allows re-sorting without re-fetching
   * - Only runs when books or sortBy changes
   */
  useEffect(() => {
    if (!books || books.length === 0) return; // No books to sort

    // create a of books array to sort without mutating original state
    // [...books]: spread operator creates a shallow copy of the books array
    const sortedBooks = [...books];

    // Soret based on selected option
    switch (sortBy) {
      /**
       *  SORT LOGIC:
       * - a.confidence - b.confidence gives ascending order
       * - b.confidence - a.confidence gives descending order
       */
      case "confidence":
        sortedBooks.sort((a, b) => b.confidence - a.confidence);
        break;

      case "title":
        /**
         * Sort alphabetically by title
         *
         * LOCALE COMPARE:
         * - Returns negative if a < b
         * - Returns positive if a > b
         * - Returns 0 if equal
         *
         * WHY localeCompare: Handles special characters and accents correctly
         */
        sortedBooks.sort((a, b) => a.title.localeCompare(b.title));
        break;

      case "author":
        sortedBooks.sort((a, b) => a.author.localeCompare(b.author));
        break;

      default:
        // No sorting if unrecognized option
        break;
    }

    setBooks(sortedBooks); // Update state with sorted books
  }, [sortBy]); // Re-run only when sortBy changes
  // NOTE: intentionally don't include books in dependencies to avoid infinite loop

  // STEP 5: Handle sort change
  /**
   * Called when user selects different sort option
   *
   * @param {Event} e - Change event from select element
   */
  function handleSortChange(e) {
    const newSortBy = e.target.value;
    console.log(`Sort by: ${newSortBy}`);
    setSortBy(newSortBy);
  }

  //Navigation handlers
  const handleScanAnother = () => {
    navigate("/"); // Go back to home page for new scan
  };

  const handleGoHome = () => {
    navigate("/"); // Go back to home page
  };

  // STEP 7: Render loading state
  /**
   * LOADING STATE:
   * Show 8 skeleton cards in grid while fetching data
   *
   * WHY 8: Mock AI returns 8 books, so show 8 skeletons
   */
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/*Header Skeleton*/}
        <div className="mb-8">
          <div className="h-10 bg-gray-300 rounded w-64 mb-4 animate-pulse"></div>
          <div className="h-6 bg-gray-300 rounded w-96 animate-pulse"></div>
        </div>

        {/* Grid of skeleton cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Array(8).fill(0) creates array of 8 undefined values */}
          {/* .map((_, i) => ...) maps each to skeleton card with unique key */}
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // STEP 8: Render error state
  /**
   * ERROR STATE:
   * Show error message with option to go back home
   */

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg text-center">
          {/* Error icon */}
          <div className="text-6xl mb-4">❌</div>

          {/* Error heading */}
          <h2 className="text-2xl font-bold text-red-900 mb-2">
            Oops! Something went wrong
          </h2>

          {/* Action button */}
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  // STEP 9: Render empty state
  /**
   * EMPTY STATE:
   * Show when scan loaded successfully but no books found
   */
  if (!books || books.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          {/* Searching icon */}
          <div className="text-6xl mb-4">🔍</div>
          {/* Empty heading */}
          <h2 className="text-2xl font-bold text-yellow-900 mb-2">
            No Books Detected
          </h2>
          {/* Suggestion text */}
          <p className="text-yellow-700 mb-4">This could mean:</p>
          <ul className="text-left max-w-md mx-auto mb-6 space-y-2 text-gray-700">
            <li>• Image was too blurry</li>
            <li>• Books were at an angle</li>
            <li>• Low lighting conditions</li>
            <li>• Book spines not clearly visible</li>
          </ul>

          {/* Action button */}
          <button
            onClick={handleScanAnother}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
          >
            Scan Another Bookshelf
          </button>
        </div>
      </div>
    );
  }

  // STEP 10: Render main content (books found!)
  /**
   * MAIN CONTENT:
   * - Header with scan info
   * - Sort dropdown
   * - Grid of book cards
   * - Action buttons
   */

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        {/* Page Title*/}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          📚 Books Recognized
        </h1>
        {/* Scan metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-700 mb-4">
          {/* Ttotal books */}
          <div className="flex items-center">
            <span className="font-semibold mr-2">Books Found:</span>
            <span>{scan?.total_books || books.length}</span>
          </div>

          {/* Processing time */}
          {scan?.processing_time_ms && (
            <div className="flex items-center">
              <span className="font-semibold mr-2">⏱️ Processed in:</span>
              <span>{(scan.processing_time_ms / 1000).toFixed(1)}s</span>
            </div>
          )}

          {/* Model used */}
          {scan?.model_used && (
            <div className="flex items-center">
              <span className="font-semibold mr-2">🤖 Model:</span>
              <span className="capitalize">{scan.model_used}</span>
            </div>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-3">
          <label htmlFor="sort" className="text-sm font-medium text-gray-700">
            Sort by:
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={handleSortChange}
            className="
                px-4
                py-2
                border
                border-gray-300
                rounded-lg
                bg-white
                text-sm
                focus:outline-none
                focus:ring-2
                focus:ring-purple-500
                focus:border-transparent
                cursor-pointer
                "
            /*
              FOCUS STYLES:
              focus:outline-none - Remove default outline
              focus:ring-2 - Add 2px ring on focus
              focus:ring-purple-500 - Purple ring color
              focus:border-transparent - Hide border on focus (ring replaces it)              
            */
          >
            <option value="confidence">Confidence (High → Low)</option>
            <option value="title">Title (A → Z)</option>
            <option value="author">Author (A →Z)</option>
          </select>
        </div>
      </div>

      {/* Book Grid */}
      {/* 
        RESPONSIVE GRID CLASSES:
        grid-cols-1: 1 column on mobile (<640px)
        sm:grid-cols-2: 2 columns on small screens (≥640px)
        lg:grid-cols-3: 3 columns on large screens (≥1024px)
        xl:grid-cols-4: 4 columns on extra large screens (≥1280px)
        gap-6: 1.5rem gap between cards
        
        WHY RESPONSIVE:
        - Mobile: Full width for readability
        - Tablet: 2-3 columns for balance
        - Desktop: 4 columns to show more books
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {books.map((book, index) => (
          <BookCard key={`${book.title}-${index}`} book={book} />
          /*
            KEY PROP:
            - Required for React lists
            - Helps React identify which items changed
            - Format: title + index for uniqueness
            
            WHY NOT JUST INDEX:
            - If books reorder, index alone causes bugs
            - Combining title + index ensures uniqueness even with duplicate titles
          */
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={handleScanAnother}
          className="
            px-6 
            py-3 
            bg-purple-600 
            text-white
            rounded-lg 
            hover:bg-purple-700
            font-medium
            transition-colors
            duration-200
            "
        >
          📸 Scan Another Bookshelf
        </button>

        {/* Save Recommendations button (disabled for now) */}
        <button
          disabled
          className="
            px-6
            py-3
            bg-gray-300
            text-gray-500
            rounded-lg
            cursor-not-allowed
            font-medium
        "
          title="Coming soon! Recommendations will be available after Phase 2D"
        >
          💾 Save Recommendations (Coming Soon)
        </button>
      </div>
    </div>
  );
}

/**
 * REACT HOOKS SUMMARY:
 * 
 * useState(initialValue):
 * - Returns [value, setValue]
 * - Re-renders component when value changes
 * - Example: const [count, setCount] = useState(0)
 * 
 * useEffect(callback, dependencies):
 * - Runs callback after render
 * - Runs again if dependencies change
 * - Example: useEffect(() => { fetch() }, [id])
 * 
 * useParams():
 * - Returns URL parameters as object
 * - Example: /results/123 → { scanId: '123' }
 * 
 * useNavigate():
 * - Returns function to navigate programmatically
 * - Example: navigate('/home')
 */

export default Results;