import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-panel rounded-2xl p-8 max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
          <span className="text-2xl font-bold text-blue-400">404</span>
        </div>
        <h2 className="text-lg font-bold text-white">Page Not Found</h2>
        <p className="text-sm text-white/50">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 rounded-lg text-sm font-medium glass-button"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
