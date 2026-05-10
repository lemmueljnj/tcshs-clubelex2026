import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatApiError } from '@/lib/api';
import { toast } from 'sonner';
import { Vote } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      toast.success(`Welcome back, ${u.name}`);
      navigate(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen academic-bg flex items-center justify-center px-4 py-12" data-testid="login-page">
      <div className="w-full max-w-md soft-card p-8 animate-fade-up">
        <Link to="/" className="flex items-center gap-2 mb-6" data-testid="brand-link">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Vote className="h-4 w-4" />
          </div>
          <div className="font-heading font-semibold text-lg">
            Campus<span className="text-primary">Vote</span>
          </div>
        </Link>
        <h1 className="font-heading text-2xl sm:text-3xl font-medium tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back. Enter your email and password.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              autoComplete="email"
              data-testid="login-email-input"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              data-testid="login-password-input"
            />
          </div>
          <Button type="submit" className="w-full pill-btn" disabled={loading} data-testid="login-submit-button">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          New here?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline" data-testid="login-go-register">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
