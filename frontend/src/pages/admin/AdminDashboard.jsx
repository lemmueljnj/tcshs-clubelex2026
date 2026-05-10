import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api, formatApiError } from '@/lib/api';
import { Link } from 'react-router-dom';
import { Users, Vote, ListChecks, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="soft-card p-5">
      <div className="flex items-center justify-between">
        <div className="stat-label">{label}</div>
        <div className="h-9 w-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="mt-3 font-heading text-3xl font-semibold tracking-tight" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/stats');
        setStats(data);
      } catch (err) {
        toast.error(formatApiError(err));
      }
    })();
  }, []);

  return (
    <AdminLayout
      title="Overview"
      subtitle="A quick snapshot of voters, elections and participation."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Total students"
          value={stats?.students?.total ?? '—'}
          sub={stats ? `${stats.students.approved} approved · ${stats.students.pending} pending` : ''}
        />
        <StatCard
          icon={<Vote className="h-4 w-4" />}
          label="Active elections"
          value={stats?.elections?.active ?? '—'}
          sub={stats ? `${stats.elections.total} total` : ''}
        />
        <StatCard
          icon={<ListChecks className="h-4 w-4" />}
          label="Candidates"
          value={stats?.candidates ?? '—'}
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Votes cast"
          value={stats?.votes ?? '—'}
        />
      </div>

      <div className="mt-10 grid md:grid-cols-2 gap-4">
        <Link to="/admin/elections" className="soft-card p-6 hover:-translate-y-[2px] hover:shadow-md transition-all" data-testid="cta-elections">
          <div className="font-heading text-lg font-medium">Manage elections</div>
          <p className="text-sm text-muted-foreground mt-1">Create elections, set positions, add candidates and open voting.</p>
        </Link>
        <Link to="/admin/voters" className="soft-card p-6 hover:-translate-y-[2px] hover:shadow-md transition-all" data-testid="cta-voters">
          <div className="font-heading text-lg font-medium">Manage voters</div>
          <p className="text-sm text-muted-foreground mt-1">Pre-load the verified roster, approve pending students and remove accounts.</p>
        </Link>
      </div>
    </AdminLayout>
  );
}
