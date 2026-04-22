import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function AuthPrompt() {
  const { user } = useAuth();

  if (user) return null;

  return (
    <div className="glass-card p-6 border border-accent/20">
      <p className="text-xs tracking-widest uppercase text-accent mb-3">
        CREATE AN ACCOUNT
      </p>
      <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
        Keep your scans. Get better recommendations.
      </h2>
      <ul className="space-y-2 mb-6">
        {[
          "Save scans and return to them any time",
          "Set your reading preferences for personalised picks",
          "Access your library from any device",
        ].map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-sm text-text-secondary">
            <svg
              className="w-4 h-4 text-accent mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {benefit}
          </li>
        ))}
      </ul>
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
  );
}

export default AuthPrompt;
