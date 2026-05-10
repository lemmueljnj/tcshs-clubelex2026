import NavBar from '@/components/NavBar';

export const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview' },
  { to: '/admin/elections', label: 'Elections' },
  { to: '/admin/voters', label: 'Voters' },
  { to: '/admin/results', label: 'Results' },
];

export default function AdminLayout({ title, subtitle, children, actions }) {
  return (
    <div className="min-h-screen">
      <NavBar links={ADMIN_LINKS} />
      <main className="max-w-6xl mx-auto px-6 py-10 animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="stat-label">Admin</div>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight mt-2">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {children}
      </main>
    </div>
  );
}
