import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthLayout from "../components/ui/AuthLayout";
import Button from "../components/ui/Button";
import Field, { inputClass } from "../components/ui/Field";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your password needs at least 8 characters.");
    if (password !== confirmPassword) return setError("The two passwords don't match.");

    setLoading(true);
    try {
      const data = await signup(email, password);
      navigate(data.claimed_scan_id ? `/results/${data.claimed_scan_id}` : "/");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create account"
      lede="Keep your scans, save recommendations and set reading preferences. Your latest scan on this device comes with you."
      error={error}
      onDismissError={() => setError(null)}
      onSubmit={handleSubmit}
      footer={{ text: "Already have an account?", link: "Log in", to: "/login" }}
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
      <Field id="password" label="Password" hint="At least 8 characters.">
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-hint"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />
      </Field>
      <Field id="confirm-password" label="Confirm password">
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className={inputClass}
        />
      </Field>
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? "Creating account…" : "Create account"}
      </Button>
    </AuthLayout>
  );
}
