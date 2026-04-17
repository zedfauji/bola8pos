import { useAuthStore } from '@entities/staff/model/authStore';
import { useStaffList } from '@entities/staff/model/queries';
import type { Staff } from '@entities/staff/model/types';
import { LoadingSpinner } from '@shared/ui/LoadingSpinner';

export function EmployeeSelector() {
  const { data: staff, isLoading, error, resultError } = useStaffList();
  const hasError = Boolean(error || resultError);
  const errorMessage = resultError?.message ?? error?.message ?? 'Unknown error';
  const setSelectedStaff = useAuthStore(s => s.setSelectedStaff);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="text-center text-destructive p-8">Failed to load staff. {errorMessage}</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-2xl font-bold text-center">Who are you?</h2>
      <div className="flex flex-col gap-2">
        {(staff ?? []).map((member: Staff) => (
          <button
            key={member.id}
            onClick={() => {
              setSelectedStaff(member);
            }}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:bg-accent transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{member.name}</div>
              <div className="text-sm text-muted-foreground capitalize">{member.role}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
