import { Navigate } from 'react-router-dom';
import { EmployeeSelector } from '@widgets/EmployeeSelector/EmployeeSelector';
import { PINLoginForm } from '@widgets/PINLoginForm/PINLoginForm';
import { useLoginUiStore } from '@entities/staff/model/loginUiStore';
import { useStaffStore } from '@entities/staff/model/store';
import { ErrorBoundary } from '@shared/ui';

export default function LoginPage() {
  const selectedStaff = useLoginUiStore(s => s.selectedStaff);
  const isAuthenticated = useStaffStore(s => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ErrorBoundary>{!selectedStaff ? <EmployeeSelector /> : <PINLoginForm />}</ErrorBoundary>
    </div>
  );
}
