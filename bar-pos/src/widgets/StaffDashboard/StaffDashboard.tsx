import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { ClockInModal } from '@features/clock-in-staff';
import { ClockOutDialog } from '@features/clock-out-staff';
import { useOpenShifts, useStaffList } from '@entities/staff';
import { useStaffStore } from '@entities/staff/model/store';
import type { Shift, Staff } from '@shared/lib/domain';
import { DataTable } from '@shared/ui/DataTable';
import { POSButton } from '@shared/ui/POSButton';
import { ProtectedAction } from '@shared/ui/ProtectedAction';
import { SectionHeader } from '@shared/ui/SectionHeader';
import { Badge } from '@shared/ui/badge';

export type StaffShiftRow = {
  staff: Staff;
  shift: Shift | null;
};

function formatShiftDuration(clockIn: Date, tick: number): string {
  void tick;
  const ms = Date.now() - clockIn.getTime();
  const totalM = Math.floor(ms / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  if (h <= 0) return `${String(m)}m`;
  return `${String(h)}h ${String(m)}m`;
}

export function StaffDashboard() {
  const { data: staffList, isIdleOrLoading: staffLoading } = useStaffList();
  const { data: openShifts, isIdleOrLoading: shiftsLoading } = useOpenShifts();
  const currentRole = useStaffStore(s => s.currentStaff?.role);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick(t => t + 1);
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const [clockInStaff, setClockInStaff] = useState<Staff | null>(null);
  const [clockOutTarget, setClockOutTarget] = useState<{ staff: Staff; shift: Shift } | null>(null);

  const rows: StaffShiftRow[] = useMemo(() => {
    const staff = staffList ?? [];
    const shifts = openShifts ?? [];
    return staff.map(s => ({
      staff: s,
      shift: shifts.find(sh => sh.staffId === s.id) ?? null,
    }));
  }, [staffList, openShifts]);

  const columns = useMemo<ColumnDef<StaffShiftRow>[]>(
    () => [
      {
        accessorKey: 'staff.name',
        header: 'Name',
        cell: ({ row }) => <span className="font-medium">{row.original.staff.name}</span>,
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.staff.role}
          </Badge>
        ),
      },
      {
        id: 'clockIn',
        header: 'Clock in',
        cell: ({ row }) =>
          row.original.shift ? (
            <span className="tabular-nums text-sm">
              {row.original.shift.clockIn.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'duration',
        header: 'Shift duration',
        cell: ({ row }) =>
          row.original.shift ? (
            <span className="tabular-nums text-sm">
              {formatShiftDuration(row.original.shift.clockIn, tick)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const { staff, shift } = row.original;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              {!shift && (
                <ProtectedAction action="clock_in" currentRole={currentRole}>
                  <POSButton
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setClockInStaff(staff);
                    }}
                  >
                    Clock In
                  </POSButton>
                </ProtectedAction>
              )}
              {shift && (
                <ProtectedAction action="clock_out" currentRole={currentRole}>
                  <POSButton
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setClockOutTarget({ staff, shift });
                    }}
                  >
                    Clock Out
                  </POSButton>
                </ProtectedAction>
              )}
            </div>
          );
        },
      },
    ],
    [currentRole, tick]
  );

  const isLoading = staffLoading || shiftsLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader title="Staff" description="Active team members and open shifts." />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Search staff…"
      />

      <ClockInModal
        open={clockInStaff !== null}
        onOpenChange={next => {
          if (!next) setClockInStaff(null);
        }}
        staff={clockInStaff}
      />

      <ClockOutDialog
        key={
          clockOutTarget
            ? `${clockOutTarget.shift.id}-${clockOutTarget.staff.id}`
            : 'clock-out-idle'
        }
        open={clockOutTarget !== null}
        onOpenChange={next => {
          if (!next) setClockOutTarget(null);
        }}
        staff={clockOutTarget?.staff ?? null}
        shift={clockOutTarget?.shift ?? null}
      />

    </div>
  );
}
