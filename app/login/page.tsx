import Link from "next/link";
import { login, signup } from "./actions";

export default function LoginPage() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="back-link">← MicPlotter</Link>
        <h1>Sign in</h1>
        {!configured ? (
          <div className="setup-notice">
            Supabase environment variables have not been added yet. The workspace preview
            is still available from the home page.
          </div>
        ) : null}
        <form action={login} className="auth-form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="primary-button" disabled={!configured}>Sign in</button>
        </form>
        <div className="auth-divider">New account</div>
        <form action={signup} className="auth-form">
          <label>
            Name
            <input name="displayName" type="text" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minLength={8} autoComplete="new-password" required />
          </label>
          <button className="secondary-button" disabled={!configured}>Create account</button>
        </form>
      </section>
    </main>
  );
}
