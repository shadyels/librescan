import { Link } from "react-router-dom";

function LoginGate({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="glass-card p-10 text-center max-w-md mx-auto">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto text-accent"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>

        <h2 className="font-display text-2xl font-bold text-text-primary mt-4 mb-2">
          {title}
        </h2>
        <p className="text-text-secondary text-sm mb-8">
          {description ?? "You need an account to access this page."}
        </p>

        <div className="flex items-center justify-center gap-3">
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
    </div>
  );
}

export default LoginGate;
