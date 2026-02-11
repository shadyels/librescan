// =============================================================================
// src/components/BookCard.jsx
// Purpose: Displays an individual book with cover, title, author, confidence,
//          and enriched metadata (categories, description).
//
// PROPS:
//   book (Object): A book object with these fields:
//     - title (string): Book title from AI recognition
//     - author (string): Author name from AI recognition
//     - confidence (number): AI confidence score 0.0-1.0
//     - cover_url (string|null): URL to cover image from Google Books (Phase 2D)
//     - categories (string[]): Genre/category array from Google Books (Phase 2D)
//     - enriched (boolean): Whether Google Books data was found (Phase 2D)
//     - isbn (string|null): ISBN from Google Books (Phase 2D)
//     - description (string|null): Synopsis from Google Books (Phase 2D)
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORT: React and useState hook
// WHY: We need useState to track the cover image loading state.
//      When a cover_url exists, we show a loading placeholder while the image
//      downloads, then swap to the real image once it's loaded. If the image
//      fails to load (broken URL, 404, etc.), we fall back to BookIcon.
// -----------------------------------------------------------------------------
import { useState } from "react";

// -----------------------------------------------------------------------------
// IMPORT: BookIcon component
// WHY: This is our SVG placeholder for books without cover images.
//      It generates a colorful book icon based on the title (deterministic:
//      same title always gets the same color). Used as fallback when:
//        - Google Books didn't have a cover for this book
//        - The cover URL failed to load
//        - The book wasn't enriched (no API key, API error, etc.)
// -----------------------------------------------------------------------------
import BookIcon from "./BookIcon.jsx";

// =============================================================================
// getConfidenceBadge(confidence)
//
// Purpose: Returns styling and label for the confidence score badge.
//
// Args:
//   confidence (number): AI confidence score from 0.0 to 1.0
//
// Returns:
//   Object with { label, colors, stars } where:
//     label  = Human-readable text (e.g., "High Confidence")
//     colors = Tailwind CSS classes for background, text, and border colors
//     stars  = Star emoji string for visual emphasis
//
// WHY THIS FUNCTION:
//   Confidence is a decimal number (e.g., 0.92) which isn't user-friendly.
//   This function translates it into a colored badge with a label that
//   users can understand at a glance:
//     95%+ = Green (we're very sure this is correct)
//     85%+ = Blue (pretty confident)
//     75%+ = Yellow (somewhat confident, might have errors)
//     <75% = Gray (low confidence, title/author might be wrong)
// =============================================================================
function getConfidenceBadge(confidence) {
  // ---------------------------------------------------------------------------
  // Convert decimal to percentage for comparison.
  // WHY: confidence comes as 0.0-1.0 from the AI, but humans think in
  //      percentages (95%, not 0.95). We multiply by 100 for cleaner comparisons.
  // ---------------------------------------------------------------------------
  const percent = Math.round(confidence * 100);

  if (percent >= 95) {
    return {
      label: "High Confidence",
      colors: "bg-green-100 text-green-800 border-green-300",
      stars: "★★★",
    };
  }
  if (percent >= 85) {
    return {
      label: "Good Confidence",
      colors: "bg-blue-100 text-blue-800 border-blue-300",
      stars: "★★",
    };
  }
  if (percent >= 75) {
    return {
      label: "Moderate Confidence",
      colors: "bg-yellow-100 text-yellow-800 border-yellow-300",
      stars: "★",
    };
  }
  return {
    label: "Low Confidence",
    colors: "bg-gray-100 text-gray-800 border-gray-300",
    stars: "",
  };
}

// =============================================================================
// BookCard component
//
// Purpose: Renders a single book as a card in the results grid.
//
// STRUCTURE:
//   ┌───────────────────────────┐
//   │  [Cover Image / BookIcon] │  <- 256px height, object-contain
//   │                           │
//   ├───────────────────────────┤
//   │  Book Title               │  <- max 2 lines, then truncated
//   │  Author Name              │  <- max 1 line, then truncated
//   │  [Fiction] [Classics]     │  <- category tags (Phase 2D)
//   │  ★★★ High Confidence 95%│  <- colored badge
//   └───────────────────────────┘
//
// INTERACTIONS:
//   - Hover: shadow grows, card scales up to 105%
//   - Transition: 200ms ease for smooth animation
// =============================================================================
export default function BookCard({ book }) {
  console.log("BookCard received:", JSON.stringify(book));

  // ---------------------------------------------------------------------------
  // STATE: imageLoaded
  // PURPOSE: Tracks whether the cover image has finished loading.
  // WHY: We show the BookIcon placeholder while the cover is downloading.
  //      Once the <img> fires its onLoad event, we set this to true and
  //      show the real cover image. This prevents a flash of empty space
  //      while the image downloads.
  // DEFAULT: false (image hasn't loaded yet)
  // ---------------------------------------------------------------------------
  const [imageLoaded, setImageLoaded] = useState(false);

  // ---------------------------------------------------------------------------
  // STATE: imageError
  // PURPOSE: Tracks whether the cover image failed to load.
  // WHY: If the cover_url is broken (404, expired, etc.), the <img> fires
  //      its onError event. We set this to true and permanently show the
  //      BookIcon fallback instead. Without this, the user would see a
  //      broken image icon.
  // DEFAULT: false (no error yet)
  // ---------------------------------------------------------------------------
  const [imageError, setImageError] = useState(false);

  // ---------------------------------------------------------------------------
  // Destructure book properties for cleaner JSX.
  // DEFAULT VALUES:
  //   title defaults to 'Unknown Title' if missing (shouldn't happen but safe)
  //   author defaults to 'Unknown Author' if missing (can happen if AI can't read it)
  //   confidence defaults to 0 (no confidence)
  //   cover_url defaults to null (no cover available)
  //   categories defaults to empty array (no categories)
  // ---------------------------------------------------------------------------
  const {
    title = "Unknown Title",
    author = "Unknown Author",
    confidence = 0,
    cover_url = null,
    categories = [],
  } = book;

  // ---------------------------------------------------------------------------
  // Get the confidence badge styling for this book's score.
  // ---------------------------------------------------------------------------
  const badge = getConfidenceBadge(confidence);

  // ---------------------------------------------------------------------------
  // Determine whether to show the real cover or the placeholder.
  // WHY: We show the real cover ONLY when all three conditions are met:
  //   1. cover_url exists (Google Books returned a cover for this book)
  //   2. imageLoaded is true (the image has finished downloading)
  //   3. imageError is false (the image didn't fail to load)
  // If any condition fails, we show the BookIcon placeholder.
  // ---------------------------------------------------------------------------
  const showRealCover = cover_url && imageLoaded && !imageError;

  return (
    // -------------------------------------------------------------------------
    // CARD CONTAINER
    // bg-white: White background for the card
    // rounded-xl: Large border radius for modern look
    // shadow-md: Medium shadow for depth
    // hover:shadow-xl: Larger shadow on hover for interactive feel
    // hover:scale-105: Slight zoom on hover (5% increase)
    // transition-all duration-200: Smooth 200ms animation for all changes
    // overflow-hidden: Clips the cover image to the rounded corners
    // flex flex-col: Vertical layout (cover on top, text below)
    // -------------------------------------------------------------------------
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 overflow-hidden flex flex-col">
      {/* ------------------------------------------------------------------- */}
      {/* COVER IMAGE SECTION                                                  */}
      {/* h-64: Fixed height of 256px for consistent card sizes in the grid.   */}
      {/* bg-gray-50: Light gray background visible while image loads.         */}
      {/* flex items-center justify-center: Centers the BookIcon placeholder.  */}
      {/* relative: Allows absolute positioning of the real cover on top.      */}
      {/* ------------------------------------------------------------------- */}
      <div className="h-64 bg-gray-50 flex items-center justify-center relative">
        {/* ----------------------------------------------------------------- */}
        {/* PLACEHOLDER: BookIcon (always rendered, hidden when cover loads)   */}
        {/* WHY always render: If we conditionally rendered BookIcon, there    */}
        {/* would be a flash of empty space before the cover loads. By always  */}
        {/* rendering it and layering the real cover on top, the transition    */}
        {/* is seamless.                                                       */}
        {/* showRealCover ? 'opacity-0' : 'opacity-100': Fades out when the  */}
        {/* real cover is ready. CSS transition handles the animation.         */}
        {/* ----------------------------------------------------------------- */}
        <div
          // className={`transition-opacity duration-300 ${showRealCover ? "opacity-100" : "opacity-100"}`} //TODO: figure out this line
        >
          <BookIcon title={title} size={120} />
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* REAL COVER: Only rendered if cover_url exists.                     */}
        {/* absolute inset-0: Positions on top of the BookIcon, covering the  */}
        {/*   entire parent div (top:0, right:0, bottom:0, left:0).           */}
        {/* object-contain: Scales the image to fit within the container       */}
        {/*   without cropping. Book covers have varying aspect ratios, and   */}
        {/*   object-contain ensures the full cover is visible.               */}
        {/* WHY NOT object-cover: object-cover would crop the image to fill   */}
        {/*   the container, which might cut off the title or author on the   */}
        {/*   book cover.                                                     */}
        {/* onLoad: Fires when the image finishes downloading. Sets           */}
        {/*   imageLoaded=true, which triggers the opacity transition.        */}
        {/* onError: Fires if the image fails to load (404, network error).   */}
        {/*   Sets imageError=true, which permanently shows the BookIcon.     */}
        {/* opacity transition: Fades in smoothly over 300ms when loaded.     */}
        {/* ----------------------------------------------------------------- */}
        {cover_url && !imageError && (
          <img
            src={cover_url}
            alt={`Cover of ${title}`}
            className={`absolute inset-0 w-full h-full object-contain p-2 transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TEXT CONTENT SECTION                                                 */}
      {/* p-4: 16px padding on all sides                                      */}
      {/* flex-1: Takes up remaining vertical space (pushes badge to bottom)  */}
      {/* flex flex-col: Vertical layout for title, author, categories, badge */}
      {/* ------------------------------------------------------------------- */}
      <div className="p-4 flex-1 flex flex-col">
        {/* ----------------------------------------------------------------- */}
        {/* TITLE                                                              */}
        {/* font-semibold: Semi-bold weight for emphasis                       */}
        {/* text-gray-900: Near-black for readability                          */}
        {/* line-clamp-2: Truncates after 2 lines with "..." ellipsis.        */}
        {/*   WHY: Some AI-recognized titles are very long. Without clamp,    */}
        {/*   cards would have inconsistent heights, breaking the grid layout.*/}
        {/* ----------------------------------------------------------------- */}
        <h3 className="font-semibold text-gray-900 line-clamp-2">{title}</h3>

        {/* ----------------------------------------------------------------- */}
        {/* AUTHOR                                                             */}
        {/* text-sm: Smaller text than title for visual hierarchy              */}
        {/* text-gray-600: Medium gray (secondary information)                 */}
        {/* line-clamp-1: Truncates after 1 line. Authors are usually short,  */}
        {/*   but some books have multiple authors listed.                     */}
        {/* mt-1: 4px top margin for spacing from title                       */}
        {/* ----------------------------------------------------------------- */}
        <p className="text-sm text-gray-600 line-clamp-1 mt-1">{author}</p>

        {/* ----------------------------------------------------------------- */}
        {/* CATEGORIES (Phase 2D - NEW)                                        */}
        {/* Only rendered if categories array has at least one entry.          */}
        {/* WHY: Not all books have categories from Google Books. Rendering   */}
        {/*   an empty container would add unnecessary whitespace.             */}
        {/* flex flex-wrap gap-1: Horizontal layout that wraps to next line    */}
        {/*   if categories don't fit. 4px gap between tags.                  */}
        {/* mt-2: 8px top margin for spacing from author                      */}
        {/* ----------------------------------------------------------------- */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {/* --------------------------------------------------------------- */}
            {/* Each category rendered as a small tag/pill.                      */}
            {/* slice(0, 3): Show max 3 categories to avoid visual clutter.     */}
            {/*   Google Books sometimes returns 5+ very specific categories.   */}
            {/* text-xs: Extra small text (categories are supplementary info)    */}
            {/* bg-purple-50 text-purple-700: Matches the app's purple theme    */}
            {/* rounded-full: Fully rounded "pill" shape                        */}
            {/* px-2 py-0.5: Tight horizontal padding, minimal vertical padding */}
            {/* --------------------------------------------------------------- */}
            {categories.slice(0, 3).map((category, idx) => (
              <span
                key={idx}
                className="text-xs bg-purple-50 text-purple-700 rounded-full px-2 py-0.5"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* SPACER                                                             */}
        {/* flex-1: Pushes the confidence badge to the bottom of the card.    */}
        {/* WHY: Cards in the grid may have different content heights (some    */}
        {/*   have categories, some don't; some have 2-line titles, some 1).  */}
        {/*   This spacer ensures the confidence badge is always at the       */}
        {/*   bottom, creating a consistent layout across all cards.          */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex-1" />

        {/* ----------------------------------------------------------------- */}
        {/* CONFIDENCE BADGE                                                   */}
        {/* mt-3: 12px top margin (spacing from content above)                */}
        {/* inline-flex: Inline element that uses flexbox for alignment        */}
        {/* items-center: Vertically centers stars and text                    */}
        {/* gap-1: 4px gap between stars and label text                       */}
        {/* text-xs: Extra small text (supplementary information)              */}
        {/* font-medium: Medium weight for readability at small size           */}
        {/* border rounded-full: Outlined pill shape                          */}
        {/* px-2 py-1: Padding inside the badge                               */}
        {/* badge.colors: Dynamic Tailwind classes based on confidence level   */}
        {/*   (green/blue/yellow/gray background, text, and border colors)    */}
        {/* ----------------------------------------------------------------- */}
        <div className="mt-3">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-1 ${badge.colors}`}
          >
            {/* Stars (if any) followed by label and percentage */}
            {badge.stars && <span>{badge.stars}</span>}
            {badge.label} {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
