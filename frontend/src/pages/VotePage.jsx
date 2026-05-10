import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import { api, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { queueVote, flushPending } from '@/lib/offline';
import { useAuth } from '@/context/AuthContext';

export default function VotePage() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [election, setElection] = useState(null);
  const [picks, setPicks] = useState({}); // position_id -> candidate_id
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/elections/${electionId}`);
        setElection(data);
        if (data.has_voted) setDone(true);
      } catch (err) {
        toast.error(formatApiError(err));
        navigate('/dashboard');
      }
    })();
  }, [electionId, navigate]);

  const candidatesByPos = useMemo(() => {
    if (!election) return {};
    const map = {};
    for (const c of election.candidates || []) {
      (map[c.position_id] ||= []).push(c);
    }
    return map;
  }, [election]);

  const allChosen = election && (election.positions || []).every((p) => picks[p.id]);

  const submit = async () => {
    if (!allChosen) {
      toast.error('Please select a candidate for every position.');
      return;
    }
    if (user?.status !== 'approved' && user?.role !== 'admin') {
      toast.error('Your account must be approved by an admin before you can vote.');
      return;
    }
    setSubmitting(true);
    const payload = {
      selections: Object.entries(picks).map(([position_id, candidate_id]) => ({ position_id, candidate_id })),
      client_id: `${user.id}:${electionId}:${Date.now()}`,
    };
    try {
      if (!navigator.onLine) {
        queueVote(electionId, payload);
        window.dispatchEvent(new Event('cv-vote-queued'));
        toast.success('Saved offline. We will sync your vote automatically.');
        setDone(true);
        return;
      }
      await api.post(`/elections/${electionId}/vote`, payload);
      await flushPending();
      toast.success('Your vote has been recorded. Thank you!');
      setDone(true);
    } catch (err) {
      const status = err?.response?.status;
      if (!status) {
        // network / timeout — queue
        queueVote(electionId, payload);
        window.dispatchEvent(new Event('cv-vote-queued'));
        toast.success('Saved offline. We will sync your vote automatically.');
        setDone(true);
      } else {
        toast.error(formatApiError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!election) return (
    <div className="min-h-screen">
      <NavBar /> <div className="p-10 text-muted-foreground">Loading…</div>
    </div>
  );

  if (done) {
    return (
      <div className="min-h-screen" data-testid="vote-success-page">
        <NavBar />
        <main className="max-w-xl mx-auto px-6 py-16 text-center animate-fade-up">
          <div className="h-16 w-16 mx-auto rounded-full bg-accent text-accent-foreground flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="font-heading text-3xl font-semibold mt-6">Vote recorded</h1>
          <p className="text-muted-foreground mt-2">Thank you for participating in <strong>{election.title}</strong>.</p>
          <div className="mt-8">
            <Link to="/dashboard"><Button className="pill-btn" data-testid="back-to-dashboard">Back to dashboard</Button></Link>
          </div>
        </main>
      </div>
    );
  }

  const closed = election.status !== 'active';

  return (
    <div className="min-h-screen" data-testid="vote-page">
      <NavBar />
      <main className="max-w-3xl mx-auto px-6 py-10 animate-fade-up">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="back-link">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-4">
          <div className="stat-label">Cast your vote</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight mt-2">{election.title}</h1>
          {election.description && <p className="text-muted-foreground mt-2 max-w-2xl">{election.description}</p>}
        </div>

        {closed && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-4 flex items-start gap-3" data-testid="closed-banner">
            <ShieldAlert className="h-5 w-5 mt-0.5" />
            <div>This election is currently <strong>{election.status}</strong>. Voting is disabled.</div>
          </div>
        )}

        <div className="mt-8 space-y-8">
          {(election.positions || []).map((p) => (
            <section key={p.id} data-testid={`position-${p.id}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-xl font-medium">{p.title}</h2>
                {p.description && <span className="text-sm text-muted-foreground">{p.description}</span>}
              </div>

              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {(candidatesByPos[p.id] || []).map((c) => {
                  const selected = picks[p.id] === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setPicks((s) => ({ ...s, [p.id]: c.id }))}
                      disabled={closed}
                      className={`text-left soft-card p-4 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md focus-ring ${
                        selected ? 'border-primary ring-2 ring-primary/30' : ''
                      } ${closed ? 'opacity-60 cursor-not-allowed' : ''}`}
                      data-testid={`candidate-${c.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center font-heading font-semibold text-accent-foreground">
                          {c.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{c.name}</div>
                          {c.bio && <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{c.bio}</div>}
                        </div>
                        <div className={`h-5 w-5 rounded-full border ${selected ? 'bg-primary border-primary' : 'border-border'}`}>
                          {selected && <CheckCircle2 className="h-5 w-5 text-primary-foreground" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {(candidatesByPos[p.id] || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No candidates have been added for this position yet.</div>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 sticky bottom-4">
          <div className="soft-card p-4 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {Object.keys(picks).length} of {(election.positions || []).length} positions selected
            </div>
            <Button
              onClick={submit}
              disabled={submitting || closed || !allChosen}
              className="pill-btn"
              data-testid="submit-vote-button"
            >
              {submitting ? 'Submitting…' : 'Submit my vote'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
