import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Vote } from 'lucide-react';

export default function NavBar({ links = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md bg-white/75 border-b border-border"
      data-testid="app-header"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-2" data-testid="brand-link">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Vote className="h-4 w-4" />
          </div>
          <div className="font-heading font-semibold text-lg leading-none">
            Campus<span className="text-primary">Vote</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`nav-link ${location.pathname === l.to ? 'active' : ''}`}
              data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-medium leading-none">{user?.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onLogout}
            data-testid="logout-button"
          >
            <LogOut className="h-4 w-4 mr-1.5" /> Logout
          </Button>
        </div>
      </div>
      <div className="md:hidden border-t border-border px-6 py-2 flex items-center gap-5 overflow-x-auto">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={`nav-link whitespace-nowrap ${location.pathname === l.to ? 'active' : ''}`}
            data-testid={`m-nav-${l.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
