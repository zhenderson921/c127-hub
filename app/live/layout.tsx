import { LiveShell } from '@/components/LiveShell';
import { LiveProvider } from '@/lib/live/store';

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiveProvider>
      <LiveShell>{children}</LiveShell>
    </LiveProvider>
  );
}
