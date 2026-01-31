function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Welcome to LibreScan
      </h1>
      <p className="text-gray-600">
        Scan your bookshelf and get AI-powered book recommendations tailored to
        your reading preferences.
      </p>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Get Started
        </h2>
        <p className="text-gray-600 mb-4">
          Take a photo of your bookshelf or upload an image to discover your
          next favorite book.
        </p>

        {/* Placeholder for future upload/scan functionality */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-500">
            Camera and upload functionality coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}

export default Home;