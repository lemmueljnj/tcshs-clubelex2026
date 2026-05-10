import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api, formatApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/admins');
      setAdmins(data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/admins', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success('Admin added');
      setOpen(false);
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this admin? They will lose all admin access immediately.')) return;
    try {
      await api.delete(`/admin/admins/${id}`);
      toast.success('Admin removed');
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <AdminLayout
      title="Admins"
      subtitle="Manage who can administer CampusVote. Only admins can create elections, approve voters and view results."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="pill-btn" data-testid="new-admin-button">
              <Plus className="h-4 w-4 mr-1" /> Add admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add a new admin</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div>
                <Label htmlFor="aname">Full name</Label>
                <Input id="aname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="admin-name-input" />
              </div>
              <div>
                <Label htmlFor="aemail">Email</Label>
                <Input id="aemail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@school.edu" data-testid="admin-email-input" />
              </div>
              <div>
                <Label htmlFor="apass">Temporary password</Label>
                <Input id="apass" type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" data-testid="admin-password-input" />
                <p className="text-xs text-muted-foreground mt-1">Share this password securely with the new admin. They can change it later.</p>
              </div>
              <DialogFooter>
                <Button type="submit" className="pill-btn" disabled={saving} data-testid="admin-submit-button">
                  {saving ? 'Adding…' : 'Add admin'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : admins.length === 0 ? (
        <div className="soft-card p-12 text-center text-muted-foreground" data-testid="no-admins">
          No admins found.
        </div>
      ) : (
        <div className="soft-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Added</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isYou = a.id === user?.id;
                const isLast = admins.length <= 1;
                return (
                  <tr key={a.id} className="border-t border-border" data-testid={`admin-row-${a.id}`}>
                    <td className="p-3 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" /> {a.name}
                        {isYou && <Badge variant="secondary" className="ml-1">you</Badge>}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{a.email}</td>
                    <td className="p-3 text-muted-foreground">{a.created_at?.slice(0, 10)}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(a.id)}
                        disabled={isYou || isLast}
                        title={isYou ? 'You cannot remove yourself' : isLast ? 'Cannot remove the last admin' : 'Remove admin'}
                        data-testid={`delete-admin-${a.id}`}
                      >
                        <Trash2 className={`h-4 w-4 ${isYou || isLast ? 'opacity-30' : 'text-destructive'}`} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
