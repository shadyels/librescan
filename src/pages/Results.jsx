import { useParams } from "react-router-dom";

function Results() {
  const { scanId } = useParams()

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Scan Results
            </h1>
            <p className="text-gray-600 mb-8">
                Scan ID: {scanId}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recognized Books */}
                <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Recognized Books
                </h2>
                <p className="text-gray-500">
                    Book recognition results will appear here...
                </p>
                </div>

                {/* Recommended Books */}
                <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                    Recommended Books
                </h2>
                <p className="text-gray-500">
                    AI-generated book recommendations will appear here...
                </p>
                </div>
            </div>
        </div>
    );
}

export default Results;