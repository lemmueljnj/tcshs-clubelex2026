import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Vote, ShieldCheck, WifiOff, Sparkles } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen academic-bg" data-testid="landing-page">
      <header className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Vote className="h-4 w-4" />
          </div>
          <div className="font-heading font-semibold text-lg">
            Campus<span className="text-primary">Vote</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" className="rounded-full" data-testid="nav-login">Sign in</Button></Link>
          <Link to="/register"><Button className="rounded-full" data-testid="nav-register">Get started</Button></Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 sm:pt-20 pb-16 grid md:grid-cols-12 gap-10 items-center">
        <div className="md:col-span-7 animate-fade-up">
          <div className="stat-label mb-4">Student Elections, Simplified</div>
          <h1 className="font-heading font-semibold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
            Run fair, friendly campus
            <span className="text-primary"> elections </span>
            in minutes.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            CampusVote gives student councils a calm, accessible way to run elections —
            verified voters, one vote per account, live results for admins, and offline-friendly voting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register">
              <Button className="pill-btn" data-testid="hero-get-started">Create student account</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="pill-btn" data-testid="hero-admin-login">Admin sign in</Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Verified voters" body="Approved students only — no duplicates." />
            <Feature icon={<WifiOff className="h-5 w-5" />} title="Works offline" body="Vote even on patchy WiFi; auto-syncs later." />
            <Feature icon={<Sparkles className="h-5 w-5" />} title="Live results" body="Admins watch turnout in real time." />
          </div>
        </div>

        <div className="md:col-span-5 animate-fade-up">
          <div className="soft-card overflow-hidden">
            <img
              src="https://static.prod-images.emergentagent.com/jobs/2eaab084-418d-46be-8121-6f8b3f7b526b/images/b7d3d415733abf522be4db2c6e87640c19e3415a31a0a6b5c265a4d605fe40b0.png"
              alt="Ballot box"
              className="w-full h-72 object-cover"
            />
            <div className="p-5 border-t border-border">
              <div className="stat-label">Why CampusVote</div>
              <p className="mt-2 text-sm text-foreground/80">
                Built for student councils, debate societies and class representatives.
                Beautifully simple, secure by design.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-white/60">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} CampusVote</span>
          <span>Built for students. Designed for trust.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div className="soft-card p-4">
      <div className="h-9 w-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
        {icon}
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{body}</div>
    </div>
  );
}
