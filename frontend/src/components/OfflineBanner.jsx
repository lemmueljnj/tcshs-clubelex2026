import { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudUpload } from 'lucide-react';
import { flushPending, pendingCount } from '@/lib/offline';
import { toast } from 'sonner';

export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => {
    const update = () => setPending(pendingCount());
    const goOnline = async () => {
      setOnline(true);
      const { sent } = await flushPending();
      if (sent > 0) toast.success(`Synced ${sent} pending vote${sent > 1 ? 's' : ''}`);
      update();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('cv-vote-queued', update);
    const id = setInterval(update, 3000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('cv-vote-queued', update);
      clearInterval(id);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      data-testid="offline-banner"
      className={`w-full text-sm px-4 py-2 flex items-center justify-center gap-2 ${
        online ? 'bg-accent text-accent-foreground' : 'bg-amber-100 text-amber-900'
      }`}
    >
      {online ? <CloudUpload className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      {online ? (
        <span>Syncing {pending} pending vote{pending !== 1 ? 's' : ''}…</span>
      ) : (
        <span>You are offline — your vote will be saved locally and synced when you reconnect.</span>
      )}
      {!online && <Wifi className="h-4 w-4 opacity-40" />}
    </div>
  );
}
