import { OfflineBanner } from '@shared/ui/OfflineBanner';
import { Providers } from './providers';
import { Router } from './router';

export function App() {
  return (
    <>
      <OfflineBanner />
      <Providers>
        <Router />
      </Providers>
    </>
  );
}
