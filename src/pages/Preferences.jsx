function Preferences() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Your Preferences
      </h1>
      <p className="text-gray-600 mb-8">
        Tell us about your reading preferences to get personalized book
        recommendations.
      </p>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Set Your Preferences
        </h2>
        <form className="space-y-6">
          {/* Genre Preferences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Favorite Genres
            </label>
            <p className="text-gray-500 mb-2">Genre Selection coming soon...</p>
          </div>

          {/* Author Preferences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Favorite Authors
            </label>
            <p className="text-gray-500 mb-2">Author input coming soon...</p>
          </div>

          {/* Language Format Preferences */}
          <div>
            {" "}
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language
            </label>
            <p className="text-gray-500 mb-2">
              Language selection coming soon...
            </p>
          </div>

          {/* Reading Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reading Level
            </label>
            <p className="text-gray-500  mb-2">
              Reading level selector coming soon...
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Preferences;
