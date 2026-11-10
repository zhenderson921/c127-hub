import { Shell } from '@/components/Shell';
import { StoreProvider } from '@/lib/store';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Shell>{children}</Shell>
    </StoreProvider>
  );
}
