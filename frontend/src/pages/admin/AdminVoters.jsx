import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Check, X, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminVoters() {
  const [voters, setVoters] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSingle, setOpenSingle] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [single, setSingle] = useState({ email: '', name: '', student_id: '' });
  const [bulkText, setBulkText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [v, r] = await Promise.all([api.get('/admin/voters'), api.get('/admin/voter-list')]);
      setVoters(v.data); setRoster(r.data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/admin/voters/${id}`, { status });
      toast.success(`Voter ${status}`);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const removeVoter = async (id) => {
    if (!window.confirm('Delete this voter account?')) return;
    try { await api.delete(`/admin/voters/${id}`); toast.success('Voter deleted'); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  const addRoster = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/voter-list', single);
      toast.success('Added to roster');
      setOpenSingle(false);
      setSingle({ email: '', name: '', student_id: '' });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const removeRoster = async (id) => {
    try { await api.delete(`/admin/voter-list/${id}`); toast.success('Removed'); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  const bulkImport = async (e) => {
    e.preventDefault();
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
      const [email, name = '', student_id = ''] = line.split(',').map((p) => p.trim());
      if (!email) continue;
      items.push({ email, name, student_id });
    }
    if (items.length === 0) { toast.error('Nothing to import'); return; }
    try {
      const { data } = await api.post('/admin/voter-list/bulk', { voters: items });
      toast.success(`Imported ${data.added} voter${data.added !== 1 ? 's' : ''}`);
      setOpenBulk(false); setBulkText(''); load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <AdminLayout
      title="Voters"
      subtitle="Pre-load the verified roster, then approve or reject student sign-ups."
    >
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList data-testid="voters-tabs">
          <TabsTrigger value="accounts" data-testid="tab-accounts">Accounts ({voters.length})</TabsTrigger>
          <TabsTrigger value="roster" data-testid="tab-roster">Verified roster ({roster.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          {loading ? <div className="text-muted-foreground">Loading…</div> : voters.length === 0 ? (
            <div className="soft-card p-10 text-center text-muted-foreground" data-testid="no-accounts">No student accounts yet.</div>
          ) : (
            <div className="soft-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Student ID</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {voters.map((v) => (
                    <tr key={v.id} className="border-t border-border" data-testid={`voter-row-${v.id}`}>
                      <td className="p-3 font-medium">{v.name}</td>
                      <td className="p-3 text-muted-foreground">{v.email}</td>
                      <td className="p-3 text-muted-foreground">{v.student_id || '—'}</td>
                      <td className="p-3">
                        <Badge
                          variant="secondary"
                          className={
                            v.status === 'approved' ? 'bg-accent text-accent-foreground'
                            : v.status === 'pending' ? 'bg-amber-100 text-amber-900'
                            : 'bg-destructive/15 text-destructive'
                          }
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          {v.status !== 'approved' && (
                            <Button size="icon" variant="ghost" onClick={() => setStatus(v.id, 'approved')} data-testid={`approve-${v.id}`}>
                              <Check className="h-4 w-4 text-emerald-700" />
                            </Button>
                          )}
                          {v.status !== 'rejected' && (
                            <Button size="icon" variant="ghost" onClick={() => setStatus(v.id, 'rejected')} data-testid={`reject-${v.id}`}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => removeVoter(v.id)} data-testid={`delete-voter-${v.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roster" className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Dialog open={openSingle} onOpenChange={setOpenSingle}>
              <DialogTrigger asChild>
                <Button className="pill-btn" data-testid="add-roster-button"><Plus className="h-4 w-4 mr-1" /> Add to roster</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-heading">Add verified voter</DialogTitle></DialogHeader>
                <form onSubmit={addRoster} className="space-y-3">
                  <div><Label>Email</Label><Input type="email" required value={single.email} onChange={(e) => setSingle({ ...single, email: e.target.value })} data-testid="roster-email-input" /></div>
                  <div><Label>Name</Label><Input value={single.name} onChange={(e) => setSingle({ ...single, name: e.target.value })} data-testid="roster-name-input" /></div>
                  <div><Label>Student ID</Label><Input value={single.student_id} onChange={(e) => setSingle({ ...single, student_id: e.target.value })} data-testid="roster-studentid-input" /></div>
                  <DialogFooter><Button type="submit" className="pill-btn" data-testid="roster-submit-button">Add</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openBulk} onOpenChange={setOpenBulk}>
              <DialogTrigger asChild>
                <Button variant="outline" className="pill-btn" data-testid="bulk-import-button"><Upload className="h-4 w-4 mr-1" /> Bulk import</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-heading">Bulk import roster</DialogTitle></DialogHeader>
                <form onSubmit={bulkImport} className="space-y-3">
                  <p className="text-sm text-muted-foreground">Paste one voter per line as <code>email, name, student_id</code> (commas optional after email).</p>
                  <Textarea rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="alice@school.edu, Alice Lee, S2024-0001" data-testid="bulk-textarea" />
                  <DialogFooter><Button type="submit" className="pill-btn" data-testid="bulk-submit-button">Import</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {roster.length === 0 ? (
            <div className="soft-card p-10 text-center text-muted-foreground" data-testid="no-roster">No verified voters added yet. Anyone you add here will be auto-approved when they register.</div>
          ) : (
            <div className="soft-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Student ID</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.id} className="border-t border-border" data-testid={`roster-row-${r.id}`}>
                      <td className="p-3 font-medium">{r.email}</td>
                      <td className="p-3 text-muted-foreground">{r.name || '—'}</td>
                      <td className="p-3 text-muted-foreground">{r.student_id || '—'}</td>
                      <td className="p-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => removeRoster(r.id)} data-testid={`delete-roster-${r.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
