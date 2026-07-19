import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockInModal } from '@features/clock-in-staff';
import { ClockOutDialog } from '@features/clock-out-staff';
import { EditLocaleDialog } from '@features/edit-staff-locale';
import { ForcePinChangeDialog } from '@features/force-pin-change';
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
  const { t } = useTranslation('staff');
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
  const [forcePinTarget, setForcePinTarget] = useState<Staff | null>(null);
  const [localeTarget, setLocaleTarget] = useState<Staff | null>(null);

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
        header: t('table.name'),
        cell: ({ row }) => <span className="font-medium">{row.original.staff.name}</span>,
      },
      {
        id: 'role',
        header: t('table.role'),
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.staff.role}
          </Badge>
        ),
      },
      {
        id: 'locale',
        header: t('table.locale'),
        cell: ({ row }) => (
          <Badge variant="outline" className="uppercase">
            {row.original.staff.locale}
          </Badge>
        ),
      },
      {
        id: 'clockIn',
        header: t('table.clockIn'),
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
        header: t('table.duration'),
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
                    {t('actions.clockIn')}
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
                    {t('actions.clockOut')}
                  </POSButton>
                </ProtectedAction>
              )}
              <ProtectedAction action="manage_staff" currentRole={currentRole}>
                <POSButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setForcePinTarget(staff);
                  }}
                >
                  {t('actions.forcePinChange')}
                </POSButton>
              </ProtectedAction>
              <ProtectedAction action="manage_staff" currentRole={currentRole}>
                <POSButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLocaleTarget(staff);
                  }}
                >
                  {t('locale.editTrigger')}
                </POSButton>
              </ProtectedAction>
            </div>
          );
        },
      },
    ],
    [currentRole, t, tick]
  );

  const isLoading = staffLoading || shiftsLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader title={t('section.title')} description={t('section.description')} />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchable
        searchPlaceholder={t('search.placeholder')}
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

      <ForcePinChangeDialog
        staff={forcePinTarget}
        open={forcePinTarget !== null}
        onOpenChange={next => {
          if (!next) setForcePinTarget(null);
        }}
      />

      <EditLocaleDialog
        key={localeTarget?.id ?? 'locale-idle'}
        staff={localeTarget}
        open={localeTarget !== null}
        onOpenChange={next => {
          if (!next) setLocaleTarget(null);
        }}
      />
    </div>
  );
}
