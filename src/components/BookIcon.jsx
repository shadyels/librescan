/**
 * BookIcon Component
 *
 * Generates a colorful SVG book icon as a placeholder until we integrate Google Books.
 * Uses a hash of the book title to generate a consistent color for each book.
 *
 * Props:
 * - title: Book title (used to generate unique color)
 * - size: Icon size in pixels (default: 120)
 */

/**
 * Simple string hash function
 *
 * Converts a string into a numeric hash value.
 * Same string always produces same hash (deterministic).
 *
 * @param {string} str - String to hash
 * @returns {number} - Hash value
 *
 * HOW IT WORKS:
 * 1. Start with hash = 0
 * 2. For each character in the string:
 *    - Get character code (e.g., 'A' = 65)
 *    - Multiply current hash by 31 (prime number for good distribution)
 *    - Add character code
 *    - Use bitwise OR to convert to 32-bit integer
 * 3. Return final hash value
 *
 * WHY: Ensures same book title always gets same color
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i); // Get ASCII/Unicode value of character
    hash = (hash << 5) - hash + char; // Equivalent to: hash * 31 + char
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash); // Return positive number
}

/**
 * Generate HSL color from string
 *
 * HSL = Hue, Saturation, Lightness
 * - Hue: 0-360 (color wheel position)
 * - Saturation: 0-100% (color intensity)
 * - Lightness: 0-100% (brightness)
 *
 * @param {string} str - String to generate color from
 * @returns {string} - HSL color string
 *
 * WHY HSL vs RGB:
 * - Easier to ensure colors are vibrant (fixed saturation/lightness)
 * - Better distribution across color spectrum
 * - More visually appealing results
 */
function stringToColor(str) {
  const hash = hashString(str);

  // Step 1: Generate hue (0-360 degrees on color wheel)
  // Use modulo 360 to wrap around the color wheel
  const hue = hash % 360;

  // Step 2: Fixed saturation (70% = vibrant but not overwhelming)
  // WHY 70%: Too low = washed out, too high = neon/harsh
  const saturation = 70;

  // Step 3: Fixed lightness (60% = readable on white background)
  // WHY 60%: Dark enough to see, light enough to be pleasant
  const lightness = 60;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get a darker shade of the main color for book spine
 *
 * @param {string} str - String to generate color from
 * @returns {string} - Darker HSL color
 *
 * WHY: Creates depth/3D effect on the book icon
 */
function stringToColorDark(str) {
  const hash = hashString(str);
  const hue = hash % 360;
  const saturation = 70;
  const lightness = 45; // Darker than main color (was 60%)

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * BookIcon Component
 *
 * Renders an SVG book icon with colors based on the book title.
 *
 * SVG Structure:
 * 1. Main book body (rounded rectangle)
 * 2. Book spine (left edge, darker color)
 * 3. Page lines (white horizontal lines for detail)
 * 4. Bookmark ribbon (top edge accent)
 */
function BookIcon({ title = "Unknown Book", size = 120 }) {
  // Generate main and spine colors from title
  const mainColor = stringToColor(title);
  const spineColor = stringToColorDark(title);

  // Calculate dimensions based on size prop
  const width = size;
  const height = size * 1.3; // 1.3 ratio for book shape

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto"
    >
      {/* Book Spine */}
      {/* 
        WHY FIRST: SVG renders in order, so this goes behind the main book 
        x: 0 (left edge)
        y: 5 (slight offset from top)
        width: 15 (spine thickness)
        height: 120 (full book height)
        rx: 2 (rounded corners)
      */}
      <rect x="0" y="5" width="15" height="120" rx="2" fill={spineColor} />

      {/* Main Book Body */}
      {/* 
        x: 10 (overlaps spine slightly for seamless look)
        y: 0 (top edge)
        width: 90 (main width)
        height: 130 (full height)
        rx: 3 (rounded corners)
      */}
      <rect x="10" y="0" width="90" height="130" rx="3" fill={mainColor} />
      {/* Page lines (decorative detail) */}
      {/* 
        WHY: Makes it look more like a real book with visible pages
        Three horizontal lines at right edge
      */}
      <line
        x1="95"
        y1="10"
        x2="95"
        y2="120"
        stroke="white"
        strokeWidth="0.5"
        opacity="0.2"
      />
      <line
        x1="92"
        y1="10"
        x2="92"
        y2="120"
        stroke="white"
        strokeWidth="0.5"
        opacity="0.2"
      />
      <line
        x1="89"
        y1="10"
        x2="95"
        y2="120"
        stroke="white"
        strokeWidth="0.5"
        opacity="0.2"
      />

      {/* Bookmark ribbon (top accent) */}
      {/* 
        WHY: Adds visual interest and makes it clear this is a book
        Triangle shape pointing down from top edge
      */}
      <path
        d="M 55 0 L 50 0 L 50 15 L 52.5 12 L 55 15 Z"
        fill="white"
        opacity="0.4"
      />

      {/* Add subtle shadow for depth */}
      {/* 
        Using filter for drop shadow
        WHY: Creates 3D effect, makes icon pop from background
      */}
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export default BookIcon;
