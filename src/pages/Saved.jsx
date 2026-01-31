function Saved() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Saved Scans</h1>
      <p className="text-gray-700">
        Your collection of saved book recommendations.
      </p>

      <div className="bg-white rounded-lg shadow-md mb-8">
        <p className="text-gray-500 text-center py-12">
          No saved recommendations yet. Start by scanning your bookshelf!
        </p>
      </div>
    </div>
  );
}

export default Saved;
