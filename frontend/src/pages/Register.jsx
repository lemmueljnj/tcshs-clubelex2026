import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, formatApiError } from '@/lib/api';
import { toast } from 'sonner';
import BrandMark from '@/components/BrandMark';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', student_id: '', section_id: '' });
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/sections');
        setSections(data);
      } catch (err) {
        toast.error(formatApiError(err));
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const m = {};
    sections.forEach((s) => { (m[s.year_level] ||= []).push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [sections]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (sections.length > 0 && !form.section_id) {
      toast.error('Please pick your year-level and section.');
      return;
    }
    setLoading(true);
    try {
      const user = await register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        student_id: form.student_id.trim() || undefined,
        section_id: form.section_id || undefined,
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

          {sections.length > 0 ? (
            <div>
              <Label>Year-level &amp; section</Label>
              <Select value={form.section_id} onValueChange={(v) => update('section_id', v)}>
                <SelectTrigger data-testid="register-section-select">
                  <SelectValue placeholder="Pick your section" />
                </SelectTrigger>
                <SelectContent>
                  {grouped.map(([year, list]) => (
                    <div key={year}>
                      <div className="px-2 py-1.5 stat-label">{year}</div>
                      {list.map((s) => (
                        <SelectItem key={s.id} value={s.id} data-testid={`register-section-option-${s.id}`}>
                          {year} — {s.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3 text-xs" data-testid="no-sections-notice">
              Your school admin hasn't set up year-levels yet. Sign-ups will continue to work, but you may need to be assigned a section later.
            </div>
          )}

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
