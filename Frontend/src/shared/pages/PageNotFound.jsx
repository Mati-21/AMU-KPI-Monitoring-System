import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="h-screen flex-1 flex items-center justify-center bg-gray-100 px-6">
      <div className="text-center space-y-6">
        {/* 404 Text */}
        <h1 className="text-7xl font-extrabold text-gray-800">404</h1>

        {/* Message */}
        <h2 className="text-2xl font-semibold text-gray-700">Page Not Found</h2>

        <p className="text-gray-500 max-w-md mx-auto">
          Sorry, the page you are looking for doesn’t exist or has been moved.
        </p>

        {/* Button */}
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
}
