function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="w-full aspect-3/4 animate-shimmer" />
      <div className="p-4 space-y-2">
        <div className="h-4 animate-shimmer rounded" />
        <div className="h-4 animate-shimmer rounded w-3/4" />
        <div className="h-3 animate-shimmer rounded w-1/2 mt-1" />
        <div className="h-6 animate-shimmer rounded-full w-20 mt-2" />
      </div>
    </div>
  );
}

export default SkeletonCard;
