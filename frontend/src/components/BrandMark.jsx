import { Vote } from 'lucide-react';
import { useBrand } from '@/context/BrandContext';

export default function BrandMark({ size = 'md', showText = true }) {
  const { name, logo_url } = useBrand();
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const text = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  // Split name into two halves so we can color the second half (e.g. "Campus" + "Vote")
  const split = (() => {
    const trimmed = (name || 'CampusVote').trim();
    if (trimmed.length <= 6) return [trimmed, ''];
    const mid = Math.ceil(trimmed.length / 2);
    return [trimmed.slice(0, mid), trimmed.slice(mid)];
  })();

  return (
    <span className="flex items-center gap-2" data-testid="brand-mark">
      {logo_url ? (
        <img
          src={logo_url}
          alt={`${name} logo`}
          className={`${dim} rounded-lg object-cover bg-white border border-border`}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <span className={`${dim} rounded-lg bg-primary text-primary-foreground flex items-center justify-center`}>
          <Vote className={iconSize} />
        </span>
      )}
      {showText && (
        <span className={`font-heading font-semibold ${text} leading-none`}>
          {split[0]}<span className="text-primary">{split[1]}</span>
        </span>
      )}
    </span>
  );
}
