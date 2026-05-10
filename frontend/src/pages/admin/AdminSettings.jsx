import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api, formatApiError } from '@/lib/api';
import { useBrand } from '@/context/BrandContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Vote, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const { name: brandName, logo_url: brandLogo, refresh } = useBrand();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(brandName || ''); setLogoUrl(brandLogo || ''); }, [brandName, brandLogo]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await api.patch('/admin/settings', { name: name.trim(), logo_url: logoUrl.trim() });
      await refresh();
      toast.success('Branding updated');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (!window.confirm('Reset branding to defaults (CampusVote, no logo)?')) return;
    setSaving(true);
    try {
      await api.patch('/admin/settings', { name: 'CampusVote', logo_url: '' });
      await refresh();
      toast.success('Branding reset');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Settings"
      subtitle="Customize your platform's name and logo. Changes appear instantly across the app."
    >
      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={onSave} className="soft-card p-6 space-y-4" data-testid="settings-form">
          <div>
            <Label htmlFor="brand-name">Platform name</Label>
            <Input
              id="brand-name"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CampusVote"
              data-testid="brand-name-input"
            />
            <p className="text-xs text-muted-foreground mt-1">Shown in the navbar, landing page, login screen and browser tab.</p>
          </div>
          <div>
            <Label htmlFor="brand-logo">Logo image URL</Label>
            <Input
              id="brand-logo"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              data-testid="brand-logo-input"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave blank to use the default ballot icon. Square images look best (1:1).</p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" className="pill-btn" disabled={saving} data-testid="save-settings-button">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="outline" className="pill-btn" onClick={onReset} disabled={saving} data-testid="reset-settings-button">
              <RotateCcw className="h-4 w-4 mr-1" /> Reset to default
            </Button>
          </div>
        </form>

        <div className="soft-card p-6">
          <div className="stat-label mb-4">Live preview</div>
          <div className="rounded-xl border border-border bg-white p-5 flex items-center gap-3" data-testid="brand-preview">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-12 w-12 rounded-lg object-cover bg-white border border-border"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Vote className="h-6 w-6" />
              </div>
            )}
            <div className="font-heading font-semibold text-2xl tracking-tight" data-testid="preview-name">
              {name || 'Your name'}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            This is how your branding will appear across the navbar and the landing/auth pages.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
