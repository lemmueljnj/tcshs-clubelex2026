import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminElectionDetail() {
  const { electionId } = useParams();
  const [election, setElection] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', position_id: '', photo_url: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/elections/${electionId}`);
      setElection(data);
      if (!form.position_id && data.positions?.[0]) {
        setForm((f) => ({ ...f, position_id: data.positions[0].id }));
      }
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [electionId]);

  const setStatus = async (status) => {
    try {
      await api.patch(`/elections/${electionId}`, { status });
      toast.success(`Election ${status}`);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const addCandidate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.position_id) { toast.error('Name and position are required'); return; }
    setSaving(true);
    try {
      await api.post(`/elections/${electionId}/candidates`, {
        name: form.name.trim(),
        bio: form.bio.trim(),
        photo_url: form.photo_url.trim(),
        position_id: form.position_id,
      });
      toast.success('Candidate added');
      setOpen(false);
      setForm((f) => ({ ...f, name: '', bio: '', photo_url: '' }));
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const removeCandidate = async (id) => {
    if (!window.confirm('Remove this candidate?')) return;
    try {
      await api.delete(`/candidates/${id}`);
      toast.success('Candidate removed');
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  if (!election) return <AdminLayout title="Loading…">{null}</AdminLayout>;

  const positions = election.positions || [];
  const candidates = election.candidates || [];

  return (
    <AdminLayout
      title={election.title}
      subtitle={election.description || 'Manage positions, candidates and the election lifecycle.'}
      actions={
        <div className="flex items-center gap-2">
          {election.status !== 'active' ? (
            <Button onClick={() => setStatus('active')} className="pill-btn" data-testid="open-voting-button">
              <Play className="h-4 w-4 mr-1" /> Open voting
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStatus('closed')} className="pill-btn" data-testid="close-voting-button">
              <Square className="h-4 w-4 mr-1" /> Close voting
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="pill-btn" data-testid="add-candidate-button"><Plus className="h-4 w-4 mr-1" /> Add candidate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Add candidate</DialogTitle></DialogHeader>
              <form onSubmit={addCandidate} className="space-y-4">
                <div>
                  <Label>Position</Label>
                  <Select value={form.position_id} onValueChange={(v) => setForm({ ...form, position_id: v })}>
                    <SelectTrigger data-testid="candidate-position-select"><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>
                      {positions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cname">Name</Label>
                  <Input id="cname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="candidate-name-input" />
                </div>
                <div>
                  <Label htmlFor="cbio">Bio / platform</Label>
                  <Textarea id="cbio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="candidate-bio-input" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="pill-btn" disabled={saving} data-testid="candidate-submit-button">
                    {saving ? 'Adding…' : 'Add candidate'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <Link to="/admin/elections" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> All elections
      </Link>

      <div className="mb-6">
        <Badge variant={election.status === 'active' ? 'default' : 'secondary'} className={election.status === 'active' ? 'bg-primary' : ''}>
          Status: {election.status}
        </Badge>
      </div>

      <div className="space-y-8">
        {positions.map((p) => {
          const list = candidates.filter((c) => c.position_id === p.id);
          return (
            <section key={p.id} className="soft-card p-5" data-testid={`admin-position-${p.id}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-lg font-medium">{p.title}</h2>
                <span className="text-xs text-muted-foreground">{list.length} candidate{list.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {list.length === 0 && <div className="text-sm text-muted-foreground">No candidates yet.</div>}
                {list.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border p-3 flex items-start gap-3" data-testid={`admin-candidate-${c.id}`}>
                    <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-medium">
                      {c.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{c.name}</div>
                      {c.bio && <div className="text-xs text-muted-foreground line-clamp-2">{c.bio}</div>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeCandidate(c.id)} data-testid={`delete-candidate-${c.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AdminLayout>
  );
}
