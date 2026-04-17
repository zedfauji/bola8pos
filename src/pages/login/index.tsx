import { EmployeeSelector } from '@widgets/EmployeeSelector/EmployeeSelector';
import { PINLoginForm } from '@widgets/PINLoginForm/PINLoginForm';
import { useAuthStore } from '@entities/staff/model/authStore';
import { ErrorBoundary } from '@shared/ui';

export default function LoginPage() {
  const { selectedStaff } = useAuthStore();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ErrorBoundary>{!selectedStaff ? <EmployeeSelector /> : <PINLoginForm />}</ErrorBoundary>
    </div>
  );
}
