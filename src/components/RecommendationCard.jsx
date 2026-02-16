/**
 * RecommendationCard.jsx
 * 
 * Displays a single recommended book with:
 * - Cover image (from Google Books via book_cache) with BookIcon fallback
 * - Title and author
 * - Personalized reason (why this book was recommended)
 * - Book description (from Google Books, truncated for the card)
 * - Category tags
 * 
 * The layout differs from BookCard.jsx because:
 * - RecommendationCard shows a "reason" field (BookCard shows confidence score)
 * - RecommendationCard shows the full description (BookCard hides it for Phase 3)
 * - The visual emphasis is on "why you'll like this" rather than recognition accuracy
 * 
 * Cover image logic is the same as BookCard.jsx:
 * - BookIcon is always rendered (prevents flash of empty space)
 * - Real <img> is layered on top with absolute positioning
 * - Image starts at opacity-0, transitions to opacity-100 on load
 * - If image fails (404, broken URL), BookIcon stays visible permanently
 * 
 * Props:
 * - book {Object}: The recommendation object with fields:
 *     - title {string}: Book title
 *     - author {string}: Author name
 *     - reason {string}: Personalized recommendation reason (1-2 sentences)
 *     - cover_url {string|null}: Google Books cover URL (may be null)
 *     - description {string|null}: Book synopsis (may be null)
 *     - categories {Array<string>}: Genre categories (may be empty)
 *     - isbn {string|null}: ISBN (not displayed, but available)
 *     - enriched {boolean}: Whether Google Books data was found
 */

import { useState } from 'react'
import BookIcon from './BookIcon'

/**
 * RecommendationCard component.
 * 
 * @param {Object} props
 * @param {Object} props.book - The recommendation book object
 * @returns {JSX.Element} The rendered card
 */
export default function RecommendationCard({ book }) {
  // ---- State for cover image loading ----
  // We track two states to handle the image lifecycle:
  // - imageLoaded: true when the <img> onLoad fires (image downloaded and decoded)
  // - imageError: true when the <img> onError fires (URL broken, 404, etc.)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Destructure the book object for cleaner JSX.
  // Default to empty values so we don't crash on missing fields.
  const {
    title = 'Unknown Title',
    author = 'Unknown Author',
    reason = '',
    cover_url = null,
    description = null,
    categories = []
  } = book

  // Determine if we should show the real cover or the fallback icon.
  // All three conditions must be true: URL exists, image loaded, no error.
  const showRealCover = cover_url && imageLoaded && !imageError

  /**
   * Truncates the description for display on the card.
   * Full descriptions from Google Books can be 500+ characters.
   * We show 200 characters max to keep cards a reasonable height.
   * 
   * @param {string} text - The full description
   * @param {number} maxLength - Maximum characters to show
   * @returns {string} Truncated text with "..." if needed
   */
  const truncateDescription = (text, maxLength = 200) => {
    if (!text) return null
    if (text.length <= maxLength) return text
    // Find last space before maxLength to avoid cutting mid-word
    const lastSpace = text.lastIndexOf(' ', maxLength)
    const cutPoint = lastSpace > 100 ? lastSpace : maxLength
    return text.substring(0, cutPoint) + '...'
  }

  return (
    // Card container: white background, rounded corners, shadow, purple left border.
    // The left border visually distinguishes recommendation cards from
    // the recognized book cards (which don't have a left border).
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 border-l-4 border-l-purple-500 flex flex-col">

      {/* ---- Top section: Cover + Book Info side by side ---- */}
      {/* We use a horizontal layout (flex-row) so the cover sits next to the text.
          This is different from BookCard which stacks vertically.
          Horizontal layout works better here because we have more text to show
          (reason + description) and vertical stacking would make cards too tall. */}
      <div className="flex p-4 gap-4">

        {/* ---- Cover image area ---- */}
        {/* Fixed width container for the cover. The aspect ratio is roughly
            2:3 (standard book cover proportions). w-24 h-36 gives us a
            nice thumbnail that doesn't dominate the card. */}
        <div className="relative w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden">
          {/* BookIcon placeholder: Always rendered underneath.
              When the real cover loads, this fades out via opacity transition. */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${showRealCover ? 'opacity-0' : 'opacity-100'}`}
          >
            <BookIcon title={title} />
          </div>

          {/* Real cover image: Only rendered if we have a URL.
              Starts invisible (opacity-0), fades in when onLoad fires.
              absolute inset-0 positions it exactly over the BookIcon. */}
          {cover_url && !imageError && (
            <img
              src={cover_url}
              alt={`Cover of ${title}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              // onLoad: Image downloaded successfully. Set imageLoaded to true
              // to trigger the opacity transition (BookIcon fades out, cover fades in).
              onLoad={() => setImageLoaded(true)}
              // onError: Image URL is broken (404, CORS, etc.).
              // Set imageError to true so we permanently show the BookIcon.
              onError={() => setImageError(true)}
              // loading="lazy": Browser defers loading until the image is near
              // the viewport. Helps performance when there are 5 cards.
              loading="lazy"
            />
          )}
        </div>

        {/* ---- Text info area: title, author, categories ---- */}
        <div className="flex-1 min-w-0">
          {/* Title: Truncate with line-clamp if very long.
              line-clamp-2 shows max 2 lines with ellipsis. */}
          <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2">
            {title}
          </h3>

          {/* Author: Single line, gray text, smaller than title */}
          <p className="text-gray-600 text-sm mt-1 truncate">
            by {author}
          </p>

          {/* Categories: Purple pill tags, same style as BookCard.jsx.
              Max 3 shown to avoid cluttering the card. */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {categories.slice(0, 3).map((category, index) => (
                <span
                  key={index}
                  className="text-xs bg-purple-50 text-purple-700 rounded-full px-2 py-0.5"
                >
                  {category}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Reason section ---- */}
      {/* This is the personalized "why you'll like this" message from the LLM.
          It gets its own section with a distinct background color so it stands
          out as the key value proposition of each recommendation. */}
      {reason && (
        <div className="px-4 pb-3">
          <div className="bg-purple-50 rounded-lg p-3">
            {/* Label */}
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
              Why you'll like this
            </p>
            {/* Reason text: small but readable */}
            <p className="text-sm text-purple-900 leading-relaxed">
              {reason}
            </p>
          </div>
        </div>
      )}

      {/* ---- Description section ---- */}
      {/* Book synopsis from Google Books. Truncated to 200 chars.
          Only shown if we have a description (enriched = true and Google Books had data). */}
      {description && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            About this book
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            {truncateDescription(description)}
          </p>
        </div>
      )}
    </div>
  )
}