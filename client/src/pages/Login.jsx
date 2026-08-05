import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (!err.response) {
        setError('Cannot connect to server. Please ensure the server is running and database is connected.');
      } else {
        setError(err.response.data?.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] overflow-hidden border border-[var(--border)]">

        {/* Brand yellow header */}
        <div className="px-8 py-7" style={{ background: 'var(--brand-gradient, linear-gradient(135deg, #C8B400 0%, #D4C200 100%))' }}>
          {/* Fix: Rename branding to RoadMate Team */}
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">RoadMate Team<sup className="text-sm font-normal">®</sup></h1>
          <p className="text-[#111827]/70 text-sm mt-1 font-medium">Sign in to your account</p>
        </div>

        <div className="px-8 py-8">
          {error && (
            <div className="mb-6 p-3 bg-[var(--red-light)] text-[var(--red)] border border-[var(--red)] rounded-[var(--radius)] text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--surface2)] border border-[var(--border)] rounded-[var(--radius)] focus:outline-none focus:border-[var(--brand)] transition-colors text-[var(--text-primary)]"
                placeholder="e.g. founder@roadmate.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--surface2)] border border-[var(--border)] rounded-[var(--radius)] focus:outline-none focus:border-[var(--brand)] transition-colors text-[var(--text-primary)] pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="mt-2 text-sm font-medium text-[var(--brand)] hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {showRecovery && (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface2)] p-4 text-sm text-[var(--text-secondary)]">
                <div className="font-bold text-[var(--text-primary)] mb-1">Password recovery</div>
                <p>
                  RoadMate accounts are created by your manager, so passwords are reset the
                  same way. Contact your reporting manager (or a founder) to have a temporary
                  password issued, then change it from Settings after signing in.
                </p>
                <button
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  className="mt-3 text-[var(--text-muted)] hover:underline font-medium"
                >
                  Close
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 font-bold rounded-[var(--radius)] transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: 'var(--brand)', color: '#111827' }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
            <p>© 2026 RoadMate Team. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
