import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthLayout from "../components/ui/AuthLayout";
import Button from "../components/ui/Button";
import Field, { inputClass } from "../components/ui/Field";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password);
      navigate(data.claimed_scan_id ? `/results/${data.claimed_scan_id}` : "/");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Log in"
      lede="Open your saved scans and recommendations. A scan you just made on this device moves into your account."
      error={error}
      onDismissError={() => setError(null)}
      onSubmit={handleSubmit}
      footer={{ text: "No account yet?", link: "Create one", to: "/signup" }}
    >
      <Field id="email" label="Email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
      </Field>
      <Field id="password" label="Password">
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />
      </Field>
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? "Logging in…" : "Log in"}
      </Button>
    </AuthLayout>
  );
}
