import { useEffect, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api, formatApiError } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AdminResults() {
  const [elections, setElections] = useState([]);
  const [selected, setSelected] = useState('');
  const [results, setResults] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/elections');
        setElections(data);
        if (data.length && !selected) setSelected(data[0].id);
      } catch (err) { toast.error(formatApiError(err)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fetchResults = async () => {
      try {
        const { data } = await api.get(`/elections/${selected}/results`);
        setResults(data);
      } catch (err) {
        toast.error(formatApiError(err));
      }
    };
    fetchResults();
    pollRef.current = setInterval(fetchResults, 5000);
    return () => clearInterval(pollRef.current);
  }, [selected]);

  return (
    <AdminLayout
      title="Live results"
      subtitle="Watch turnout and vote tallies update in real time. Visible to admins only."
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="stat-label">Election</div>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-72" data-testid="results-election-select"><SelectValue placeholder="Select election" /></SelectTrigger>
          <SelectContent>
            {elections.map((e) => <SelectItem key={e.id} value={e.id}>{e.title} ({e.status})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!results ? (
        <div className="soft-card p-12 text-center text-muted-foreground" data-testid="results-empty">
          {elections.length === 0 ? 'Create an election to see live results.' : 'Loading results…'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="soft-card p-5">
              <div className="stat-label">Status</div>
              <Badge className={`mt-3 ${results.election.status === 'active' ? 'bg-primary' : 'bg-secondary text-secondary-foreground'}`}>
                {results.election.status}
              </Badge>
            </div>
            <div className="soft-card p-5">
              <div className="stat-label">Total votes</div>
              <div className="font-heading text-3xl font-semibold mt-2" data-testid="total-votes">{results.total_votes}</div>
            </div>
            <div className="soft-card p-5">
              <div className="stat-label">Approved voters</div>
              <div className="font-heading text-3xl font-semibold mt-2">{results.total_eligible}</div>
            </div>
            <div className="soft-card p-5">
              <div className="stat-label">Turnout</div>
              <div className="font-heading text-3xl font-semibold mt-2" data-testid="turnout">{results.turnout_pct}%</div>
            </div>
          </div>

          <div className="space-y-6">
            {results.positions.map((p) => {
              const total = p.candidates.reduce((s, c) => s + c.votes, 0);
              return (
                <section key={p.position_id} className="soft-card p-5" data-testid={`result-position-${p.position_id}`}>
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-heading text-lg font-medium">{p.title}</h2>
                    <span className="text-xs text-muted-foreground">{total} vote{total !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {p.candidates.length === 0 && <div className="text-sm text-muted-foreground">No candidates.</div>}
                    {p.candidates.map((c, i) => {
                      const pct = total ? Math.round((c.votes / total) * 100) : 0;
                      return (
                        <div key={c.candidate_id} data-testid={`result-candidate-${c.candidate_id}`}>
                          <div className="flex items-baseline justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${i === 0 && total > 0 ? 'text-primary' : ''}`}>{c.name}</span>
                              {i === 0 && total > 0 && <Badge className="bg-primary">Leading</Badge>}
                            </div>
                            <div className="text-muted-foreground">{c.votes} · {pct}%</div>
                          </div>
                          <Progress value={pct} className="mt-1.5 h-2" />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
