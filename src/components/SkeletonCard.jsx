/**
 * SkeletonCard Component
 *
 * Displays an animated placeholder card while book data is loading.
 * Uses CSS animation to create a "shimmer" effect that moves across the card.
 *
 * WHY SKELETON SCREENS:
 * - Perceived performance: Users see instant feedback
 * - Shows layout structure before data loads
 */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-md animate-pulse">
      {/* 
        animate-pulse: Tailwind utility that creates pulsing animation
        HOW IT WORKS: Repeatedly fades opacity between 100% and 50%
      */}

      {/* Book cover placeholder */}
      {/* 
        aspect-[3/4]: Maintains book aspect ratio (width:height = 3:4)
        bg-gray-300: Light gray placeholder color
        rounded-md: Slightly rounded corners
        mb-4: Margin bottom for spacing
      */}
      <div className="w-full aspect-[3/4] bg-gray-300 rounded-md mb-4"></div>

      {/* Title placeholder */}
      {/* 
        h-4: Height of 1rem (16px)
        bg-gray-300: Same gray as cover
        rounded: Rounded corners (pill shape)
        mb-2: Margin bottom
        TWO LINES: Most book titles span 1-2 lines
                w-3/4: Second line is 75% width (looks more natural)

      */}
      <div className="h-4 bg-gray-300 rounded mb-2"></div>
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-3"></div>

      {/* Author placeholder */}
      {/* 
        h-3: Slightly shorter than title (12px)
        w-1/2: Half width (authors are usually shorter than titles)
      */}
      <div className="h-3 bg-gray-300 rounded w-1/2 mb-3"></div>
      {/* Confidence badge placeholder */}
      {/* 
        h-6: Badge height (24px)
        w-20: Fixed width for badge
        rounded-full: Fully rounded (pill shape)
      */}
      <div className="h-6 bg-gray-300 rounded-full w-20"></div>
    </div>
  );
}

export default SkeletonCard;
