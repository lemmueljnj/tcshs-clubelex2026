import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import { api, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [elections, setElections] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/elections');
        setElections(data);
      } catch (err) {
        toast.error(formatApiError(err));
        setElections([]);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen" data-testid="student-dashboard">
      <NavBar links={[]} />

      <main className="max-w-5xl mx-auto px-6 py-10 animate-fade-up">
        <div className="stat-label">Your account</div>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight mt-2">
          Hello, {user?.name?.split(' ')[0] || 'student'} 👋
        </h1>
        {(user?.year_level || user?.section_name) && (
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground" data-testid="student-section-badge">
            <span className="rounded-full border border-border px-2.5 py-0.5 bg-white text-foreground text-xs">
              {[user.year_level, user.section_name].filter(Boolean).join(' — ')}
            </span>
          </div>
        )}
        <p className="text-muted-foreground mt-2">Choose an active election below to cast your vote.</p>

        {user?.status === 'pending' && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-4 flex items-start gap-3" data-testid="pending-banner">
            <Clock className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-medium">Awaiting admin verification</div>
              <div className="text-sm">You can browse elections, but you can vote only after an admin approves your account.</div>
            </div>
          </div>
        )}

        {user?.status === 'rejected' && (
          <div className="mt-6 rounded-xl border border-destructive bg-destructive/10 text-destructive p-4" data-testid="rejected-banner">
            Your account has been rejected. Please contact your election administrator.
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-heading text-xl font-medium">Elections</h2>
          {elections === null ? (
            <div className="mt-4 text-muted-foreground" data-testid="elections-loading">Loading…</div>
          ) : elections.length === 0 ? (
            <div className="mt-6 soft-card p-10 text-center" data-testid="elections-empty">
              <div className="font-heading text-lg font-medium">No active elections yet</div>
              <p className="text-sm text-muted-foreground mt-1">Check back later — your administrator will publish elections here.</p>
            </div>
          ) : (
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {elections.map((e) => (
                <Link
                  to={`/vote/${e.id}`}
                  key={e.id}
                  className="soft-card p-5 hover:-translate-y-[2px] hover:shadow-md transition-all duration-200"
                  data-testid={`election-card-${e.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-heading text-lg font-medium">{e.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{e.description || 'Tap to view positions and vote.'}</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={e.status === 'active' ? 'default' : 'secondary'} className={e.status === 'active' ? 'bg-primary' : ''}>
                      {e.status}
                    </Badge>
                    <span className="text-muted-foreground">{e.positions?.length || 0} position{(e.positions?.length || 0) !== 1 ? 's' : ''}</span>
                    <span className="text-muted-foreground">· {e.candidate_count || 0} candidates</span>
                    {e.has_voted && (
                      <Badge variant="outline" className="border-primary text-primary ml-auto">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Voted
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
