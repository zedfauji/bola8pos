import { PaymentPane } from '@widgets/PaymentPane';
import { BackToHomeButton } from '@shared/ui';

export default function PaymentsPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex shrink-0 items-center border-b px-4 py-2">
        <BackToHomeButton />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <PaymentPane />
      </div>
    </div>
  );
}
