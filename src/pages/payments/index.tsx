import { PaymentPane } from '@widgets/PaymentPane';
import { RefundsList } from '@widgets/RefundsList';
import { BackToHomeButton } from '@shared/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';

export default function PaymentsPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex shrink-0 items-center border-b px-4 py-2">
        <BackToHomeButton />
      </div>
      <Tabs defaultValue="payments" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 mb-0 w-fit">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="flex flex-1 overflow-hidden">
          <PaymentPane />
        </TabsContent>
        <TabsContent value="refunds" className="flex flex-1 overflow-hidden p-4">
          <RefundsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
