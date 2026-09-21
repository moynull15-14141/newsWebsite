import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container-wide py-16 text-center">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="mt-4 text-lg text-gray-600">Page not found</p>
      <Link to="/" className="mt-6 inline-block text-primary-500 hover:underline">
        Go back home
      </Link>
    </div>
  );
}
