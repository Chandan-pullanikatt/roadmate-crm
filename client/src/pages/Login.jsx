import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
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
      <div className="w-full max-w-md bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-8 border border-[var(--border)]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--accent)] mb-2">RoadMate CRM</h1>
          <p className="text-[var(--text-secondary)]">Welcome back! Please enter your details.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-[var(--red-light)] text-[var(--red)] border border-[var(--red)] rounded-[var(--radius)] text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--surface2)] border border-[var(--border)] rounded-[var(--radius)] focus:outline-none focus:border-[var(--accent)] transition-colors text-[var(--text-primary)]"
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
                className="w-full px-4 py-3 bg-[var(--surface2)] border border-[var(--border)] rounded-[var(--radius)] focus:outline-none focus:border-[var(--accent)] transition-colors text-[var(--text-primary)] pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[var(--accent)] text-white font-semibold rounded-[var(--radius)] hover:bg-[var(--accent-mid)] transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-[var(--text-muted)]">
          <p>© 2026 RoadMate CRM. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
