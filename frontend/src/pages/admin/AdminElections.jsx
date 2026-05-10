import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { Link } from 'react-router-dom';
import { api, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminElections() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', positions: [{ title: '', description: '' }] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/elections');
      setElections(data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addPosition = () => setForm((f) => ({ ...f, positions: [...f.positions, { title: '', description: '' }] }));
  const removePosition = (i) => setForm((f) => ({ ...f, positions: f.positions.filter((_, idx) => idx !== i) }));
  const setPosition = (i, k, v) => setForm((f) => {
    const p = [...f.positions]; p[i] = { ...p[i], [k]: v }; return { ...f, positions: p };
  });

  const create = async (e) => {
    e.preventDefault();
    const cleanPositions = form.positions.filter((p) => p.title.trim());
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (cleanPositions.length === 0) { toast.error('Add at least one position'); return; }
    setSaving(true);
    try {
      await api.post('/elections', {
        title: form.title.trim(),
        description: form.description.trim(),
        positions: cleanPositions,
      });
      toast.success('Election created');
      setOpen(false);
      setForm({ title: '', description: '', positions: [{ title: '', description: '' }] });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this election? All votes & candidates will be removed.')) return;
    try {
      await api.delete(`/elections/${id}`);
      toast.success('Election deleted');
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <AdminLayout
      title="Elections"
      subtitle="Create new elections, define positions, manage candidates and open voting."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="pill-btn" data-testid="new-election-button"><Plus className="h-4 w-4 mr-1" /> New election</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Create election</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="election-title-input" />
              </div>
              <div>
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="election-desc-input" />
              </div>
              <div>
                <Label>Positions</Label>
                <div className="space-y-2 mt-1">
                  {form.positions.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="e.g. President" value={p.title} onChange={(e) => setPosition(i, 'title', e.target.value)} data-testid={`position-title-${i}`} />
                      {form.positions.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePosition(i)} data-testid={`remove-position-${i}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addPosition} data-testid="add-position-button">
                    <Plus className="h-3 w-3 mr-1" /> Add position
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="pill-btn" disabled={saving} data-testid="create-election-submit">
                  {saving ? 'Creating…' : 'Create election'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : elections.length === 0 ? (
        <div className="soft-card p-12 text-center" data-testid="elections-empty-state">
          <div className="font-heading text-lg font-medium">No elections yet</div>
          <p className="text-sm text-muted-foreground mt-1">Click "New election" to create your first one.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {elections.map((e) => (
            <div key={e.id} className="soft-card p-5" data-testid={`admin-election-${e.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-heading text-lg font-medium">{e.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{e.description}</div>
                </div>
                <Badge variant={e.status === 'active' ? 'default' : 'secondary'} className={e.status === 'active' ? 'bg-primary' : ''}>
                  {e.status}
                </Badge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {e.positions?.length || 0} position{(e.positions?.length || 0) !== 1 ? 's' : ''} · {e.candidate_count || 0} candidates
              </div>
              <div className="mt-4 flex justify-between">
                <Link to={`/admin/elections/${e.id}`}>
                  <Button variant="outline" size="sm" className="rounded-full" data-testid={`open-election-${e.id}`}>
                    Manage <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)} data-testid={`delete-election-${e.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
