import { useState } from 'react';
import BookIcon from './BookIcon';

export default function RecommendationCard({ book }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const {
    title = 'Unknown Title',
    author = 'Unknown Author',
    reason = '',
    cover_url = null,
    description = null,
    categories = []
  } = book;

  const showRealCover = cover_url && imageLoaded && !imageError;

  const truncateDescription = (text, maxLength = 200) => {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    const lastSpace = text.lastIndexOf(' ', maxLength);
    const cutPoint = lastSpace > 100 ? lastSpace : maxLength;
    return text.substring(0, cutPoint) + '...';
  };

  return (
    <div className="glass-card border-l-2 border-l-accent overflow-hidden flex flex-col animate-fade-in-up">
      <div className="flex p-4 gap-4">
        <div className="relative w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden">
          <div className={`absolute inset-0 transition-opacity duration-300 ${showRealCover ? 'opacity-0' : 'opacity-100'}`}>
            <BookIcon title={title} />
          </div>
          {cover_url && !imageError && (
            <img
              src={cover_url}
              alt={`Cover of ${title}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-text-primary text-lg leading-tight line-clamp-2">{title}</h3>
          <p className="text-text-secondary text-sm mt-1 truncate">by {author}</p>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {categories.slice(0, 3).map((category, index) => (
                <span key={index} className="text-xs bg-accent-muted text-accent rounded-full px-2 py-0.5">
                  {category}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {reason && (
        <div className="px-4 pb-3">
          <div className="bg-accent-muted rounded-lg p-3">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
              Why you'll like this
            </p>
            <p className="text-sm text-text-primary leading-relaxed">{reason}</p>
          </div>
        </div>
      )}

      {description && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
            About this book
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {truncateDescription(description)}
          </p>
        </div>
      )}
    </div>
  );
}
