import { Toaster } from 'sonner';
import { OfflineBanner } from '@shared/ui/OfflineBanner';
import { Providers } from './providers';
import { Router } from './router';

export function App() {
  return (
    <>
      <OfflineBanner />
      <Toaster richColors position="top-right" />
      <Providers>
        <Router />
      </Providers>
    </>
  );
}
