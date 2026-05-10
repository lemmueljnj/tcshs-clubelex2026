import { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ year_level: '', name: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sections');
      setSections(data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const m = {};
    sections.forEach((s) => { (m[s.year_level] ||= []).push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [sections]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.year_level.trim() || !form.name.trim()) { toast.error('Year-level and section name are required.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/sections', {
        year_level: form.year_level.trim(),
        name: form.name.trim(),
      });
      toast.success('Section added');
      setOpen(false);
      setForm({ year_level: form.year_level, name: '' }); // keep year for fast multi-add
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this section?')) return;
    try {
      await api.delete(`/admin/sections/${id}`);
      toast.success('Section deleted');
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <AdminLayout
      title="Sections"
      subtitle="Define the year-levels and sections students can pick from when they sign up."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="pill-btn" data-testid="new-section-button"><Plus className="h-4 w-4 mr-1" /> Add section</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Add section</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div>
                <Label htmlFor="year">Year-level</Label>
                <Input id="year" required value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })} placeholder="e.g. Grade 11" data-testid="section-year-input" />
              </div>
              <div>
                <Label htmlFor="sname">Section name</Label>
                <Input id="sname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Einstein" data-testid="section-name-input" />
              </div>
              <DialogFooter>
                <Button type="submit" className="pill-btn" disabled={saving} data-testid="section-submit-button">
                  {saving ? 'Adding…' : 'Add section'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : sections.length === 0 ? (
        <div className="soft-card p-12 text-center" data-testid="sections-empty">
          <Layers className="h-8 w-8 mx-auto text-muted-foreground" />
          <div className="font-heading text-lg font-medium mt-3">No sections yet</div>
          <p className="text-sm text-muted-foreground mt-1">
            Add at least one section so students can choose a year-level when they register.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([year, list]) => (
            <section key={year} className="soft-card p-5" data-testid={`year-group-${year}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-lg font-medium">{year}</h2>
                <span className="text-xs text-muted-foreground">{list.length} section{list.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {list.map((s) => (
                  <Badge
                    key={s.id}
                    variant="secondary"
                    className="rounded-full px-3 py-1.5 gap-2 text-sm"
                    data-testid={`section-${s.id}`}
                  >
                    {s.name}
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      className="text-destructive hover:opacity-70"
                      data-testid={`delete-section-${s.id}`}
                      aria-label={`Delete ${year} ${s.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
