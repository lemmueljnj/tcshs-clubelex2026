import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatApiError } from '@/lib/api';
import { toast } from 'sonner';
import BrandMark from '@/components/BrandMark';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', student_id: '' });
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const user = await register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        student_id: form.student_id.trim() || undefined,
      });
      if (user.status === 'pending') {
        toast.success('Account created — pending admin approval.');
      } else {
        toast.success('Account created and verified.');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen academic-bg flex items-center justify-center px-4 py-12" data-testid="register-page">
      <div className="w-full max-w-md soft-card p-8 animate-fade-up">
        <Link to="/" className="mb-6 inline-flex">
          <BrandMark />
        </Link>
        <h1 className="font-heading text-2xl sm:text-3xl font-medium tracking-tight">Create student account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          If your email is on the verified roster, you'll be approved instantly.
          Otherwise, an admin will review your account.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={form.name} onChange={(e) => update('name', e.target.value)} data-testid="register-name-input" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@school.edu" data-testid="register-email-input" />
          </div>
          <div>
            <Label htmlFor="student_id">Student ID <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="student_id" value={form.student_id} onChange={(e) => update('student_id', e.target.value)} data-testid="register-studentid-input" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={form.password} onChange={(e) => update('password', e.target.value)} data-testid="register-password-input" />
          </div>
          <Button type="submit" className="w-full pill-btn" disabled={loading} data-testid="register-submit-button">
            {loading ? 'Creating…' : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline" data-testid="register-go-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
