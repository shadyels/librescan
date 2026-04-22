import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import BookCard from "../components/BookCard";
import SkeletonCard from "../components/SkeletonCard";
import { useAuth } from "../contexts/AuthContext";

function Results() {
  const { scanId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [scan, setScan] = useState(null);
  const [books, setBooks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("confidence");

  useEffect(() => {
    async function fetchScan() {
      try {
        setLoading(true);
        setError(null);

        const deviceId = searchParams.get("device_id");
        const url = deviceId
          ? `/api/scan/${scanId}?device_id=${encodeURIComponent(deviceId)}`
          : `/api/scan/${scanId}`;

        const response = await fetch(url, { credentials: "include" });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.scan) {
          throw new Error("Invalid response format");
        }

        const scanData = data.scan;
        const booksData = scanData.recognized_books?.books || [];

        setScan(scanData);
        setBooks(booksData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchScan();
  }, [scanId, searchParams]);

  useEffect(() => {
    if (!books || books.length === 0) return;

    const sortedBooks = [...books];

    switch (sortBy) {
      case "confidence":
        sortedBooks.sort((a, b) => b.confidence - a.confidence);
        break;
      case "title":
        sortedBooks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "author":
        sortedBooks.sort((a, b) => a.author.localeCompare(b.author));
        break;
      default:
        break;
    }

    setBooks(sortedBooks);
  }, [sortBy]);

  function handleSortChange(e) {
    setSortBy(e.target.value);
  }

  const handleScanAnother = () => navigate("/");
  const handleGoHome = () => navigate("/");

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-10 animate-shimmer rounded w-64 mb-4" />
          <div className="h-5 animate-shimmer rounded w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass-card p-10 text-center">
          <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
            Something went wrong
          </h2>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover font-medium transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass-card p-10 text-center">
          <div className="w-16 h-16 bg-accent-muted rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
            No Books Detected
          </h2>
          <p className="text-text-secondary mb-4">This could mean:</p>
          <ul className="text-left max-w-xs mx-auto mb-8 space-y-2 text-text-secondary text-sm">
            <li>· Image was too blurry</li>
            <li>· Books were at an angle</li>
            <li>· Low lighting conditions</li>
            <li>· Book spines not clearly visible</li>
          </ul>
          <button
            onClick={handleScanAnother}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover font-medium transition-colors"
          >
            Scan Another Bookshelf
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-text-primary mb-4">
          Books Recognized
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-text-secondary mb-4">
          <div className="flex items-center">
            <span className="font-medium mr-2 text-text-primary">Books Found:</span>
            <span>{scan?.total_books || books.length}</span>
          </div>
          {scan?.processing_time_ms && (
            <div className="flex items-center">
              <span className="font-medium mr-2 text-text-primary">Processed in:</span>
              <span>{(scan.processing_time_ms / 1000).toFixed(1)}s</span>
            </div>
          )}
          {scan?.model_used && (
            <div className="flex items-center">
              <span className="font-medium mr-2 text-text-primary">Model:</span>
              <span className="capitalize">{scan.model_used}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="sort" className="text-sm font-medium text-text-secondary">
            Sort by:
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={handleSortChange}
            className="px-4 py-2 border border-border rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent cursor-pointer"
          >
            <option value="confidence">Confidence (High → Low)</option>
            <option value="title">Title (A → Z)</option>
            <option value="author">Author (A → Z)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {books.map((book, index) => (
          <div key={`${book.title}-${index}`} style={{ animationDelay: `${index * 60}ms` }}>
            <BookCard book={book} />
          </div>
        ))}
      </div>

      {user ? (
        <div className="mt-8 text-center">
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-primary px-4 text-sm text-text-muted">
                Want to discover more?
              </span>
            </div>
          </div>

          <Link
            to={`/recommendations/${scanId}`}
            className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors shadow-md hover:shadow-lg text-lg font-semibold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
            <span>View Recommendations</span>
          </Link>

          <p className="text-text-muted text-sm mt-3">
            Get personalized book suggestions based on your shelf
          </p>
        </div>
      ) : (
        <div className="mt-8 glass-card p-6 border border-accent/20">
          <p className="text-xs tracking-widest uppercase text-accent mb-2">Save your results</p>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2">
            Log in to save this scan and get recommendations
          </h2>
          <p className="text-text-secondary text-sm mb-5">
            Create a free account to save your recognized books, generate personalized picks, and access everything from any device.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/signup"
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm"
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="px-6 py-2 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg transition-all text-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={handleScanAnother}
          className="px-6 py-3 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg font-medium transition-all duration-150"
        >
          Scan Another Bookshelf
        </button>
      </div>
    </div>
  );
}

export default Results;
