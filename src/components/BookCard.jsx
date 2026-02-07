/**
 * BookCard Component
 *
 * Displays a single book with:
 * - Colorful book icon (placeholder for future cover images)
 * - Title and author
 * - Confidence score with color-coded badge
 * - Hover effects for interactivity
 *
 * Props:
 * - book: { title, author, confidence }
 */

import BookIcon from "./BookIcon";

/**
 * Get badge styling based on confidence score
 *
 * @param {number} confidence - Confidence score (0.0 to 1.0)
 * @returns {Object} - { bgColor, textColor, stars, label }
 *
 * CONFIDENCE TIERS:
 * - 95%+: High (green, 3 stars)
 * - 85-94%: Good (blue, 2 stars)
 * - 75-84%: Moderate (yellow, 1 star)
 * - <75%: Low (gray, no stars)
 *
 * WHY COLOR-CODED:
 * - Visual feedback is faster to process than numbers
 * - Users can quickly spot high-confidence books
 * - Industry standard (traffic light pattern)
 */

function getConfidenceBadge(confidence) {
  const percentage = confidence * 100;

  if (percentage >= 95) {
    return {
      bgColor: "bg-green-100",
      textColor: "text-green-800",
      borderColor: "border-green-300",
      stars: "⭐⭐⭐",
      label: "High Confidence",
    };
  } else if (percentage >= 85) {
    return {
      bgColor: "bg-blue-100",
      textColor: "text-blue-800",
      borderColor: "border-blue-300",
      stars: "⭐⭐",
      label: "Good Confidence",
    };
  } else if (percentage >= 75) {
    return {
      bgColor: "bg-yellow-100",
      textColor: "text-yellow-800",
      borderColor: "border-yellow-300",
      stars: "⭐",
      label: "Moderate Confidence",
    };
  } else {
    return {
      bgColor: "bg-gray-100",
      textColor: "text-gray-800",
      borderColor: "border-gray-300",
      stars: "",
      label: "Low Confidence",
    };
  }
}

/**
 * BookCard Component
 */
function BookCard({ book }) {
  // Destructure book properties
  const { title, author, confidence } = book;

  // Get badge styling based on confidence
  const badge = getConfidenceBadge(confidence);

  // Convert confidence to percentage for display
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div
      className="
bg-white
rounded-lg
shadow-md
p-6
transition-all
duration-200
hover:shadow-lg
hover:scale-105
cursor-pointer
"
      /*
        bg-white: White background
        rounded-lg: Large rounded corners (0.5rem)
        shadow-md: Medium shadow (creates card effect)
        p-6: Padding 1.5rem on all sides
        
        HOVER EFFECTS:
        transition-all: Animate all property changes
        duration-200: Animation takes 200ms
        hover:shadow-lg: Larger shadow on hover
        hover:scale-105: Grow to 105% size on hover
        cursor-pointer: Show hand cursor (indicates clickable)
        
      */
    >
      {/* Book Icon */}
      {/* 
        mb-4: Margin bottom for spacing
        Size prop of 120 creates ~120px wide icon
      */}
      <div className="mb-4">
        <BookIcon title={title} size={120} />
      </div>
      {/* Title */}
      {/* 
        text-lg: Large text (1.125rem / 18px)
        font-semibold: Semi-bold weight (600)
        text-gray-900: Very dark gray (almost black)
        mb-2: Margin bottom
        line-clamp-2: Limit to 2 lines, add ellipsis if longer
        
        WHY line-clamp-2:
        - Long titles can break layout
        - Keeps cards uniform height
        - Users can still identify books
      */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {title}
      </h3>
      {/* Author */}
      {/* 
        text-sm: Small text (0.875rem / 14px)
        text-gray-600: Medium gray (readable but secondary)
        mb-3: Margin bottom
        line-clamp-1: Limit to 1 line with ellipsis
        
        WHY SMALLER/GRAYER:
        - Visual hierarchy (title is primary)
        - Standard book display pattern
      */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-1">{author}</p>

      {/* Confidence Badge */}
      {/* 
        inline-flex: Display inline but with flexbox alignment
        items-center: Vertically center content
        px-3: Horizontal padding (0.75rem)
        py-1: Vertical padding (0.25rem)
        rounded-full: Fully rounded (pill shape)
        text-xs: Extra small text (0.75rem / 12px)
        font-medium: Medium weight (500)
        border: 1px border
        
        Dynamic classes from badge object:
        - bgColor: Background color based on confidence
        - textColor: Text color based on confidence
        - borderColor: Border color based on confidence
      */}
      <div
        className={`
            inline-flex
            items-center
            px-3
            py-1
            rounded-full
            text-xs
            font-medium
            border
            ${badge.bgColor}
            ${badge.textColor}
            ${badge.borderColor}
            `}
        /*
          title attribute: Shows tooltip on hover
          WHY: Provides explanation of what the percentage means
        */
        title={badge.label}
      >
        {/* Stars (if any) */}
        {badge.stars && <span className="mr-1">{badge.stars}</span>}
        {/* Percentage */}

        <span>{confidencePercent}%</span>
      </div>
    </div>
  );
}

/**
 * LINE-CLAMP UTILITY:
 * Tailwind's line-clamp utilities use CSS:
 *
 * .line-clamp-2 {
 *   overflow: hidden;
 *   display: -webkit-box;
 *   -webkit-box-orient: vertical;
 *   -webkit-line-clamp: 2;
 * }
 *
 * WHAT IT DOES:
 * - Shows only specified number of lines
 * - Adds "..." ellipsis at cutoff point
 * - Prevents text from breaking layout
 *
 * BROWSER SUPPORT:
 * - Works in all modern browsers
 * - Graceful degradation (just clips without ellipsis in old browsers)
 */

export default BookCard;
