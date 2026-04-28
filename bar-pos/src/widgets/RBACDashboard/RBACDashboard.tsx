import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EditRoleDialog } from '@features/edit-staff-role';
import { useStaffList } from '@entities/staff';
import { useStaffStore } from '@entities/staff/model/store';
import type { Staff } from '@shared/lib/domain';
import { DataTable } from '@shared/ui/DataTable';
import { POSButton } from '@shared/ui/POSButton';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';

import { PermissionMatrix } from './PermissionMatrix';

export function RBACDashboard() {
  const { data: staffList, isIdleOrLoading } = useStaffList();
  const currentStaffId = useStaffStore(s => s.currentStaff?.id) ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(undefined);

  const staff = useMemo(() => staffList ?? [], [staffList]);

  const columns = useMemo<ColumnDef<Staff>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const member = row.original;
          const isSelf = member.id === currentStaffId;
          return (
            <div className="flex justify-end gap-2">
              <POSButton
                type="button"
                size="sm"
                variant="outline"
                disabled={isSelf}
                onClick={() => {
                  setSelectedStaffId(member.id);
                  setDialogOpen(true);
                }}
              >
                Edit Role
              </POSButton>
            </div>
          );
        },
      },
    ],
    [currentStaffId]
  );

  return (
    <div className="space-y-8">
      {/* Panel 1: Staff Roles (Phase 12 — unchanged) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Staff Roles</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              toast.message('Add Staff', {
                description: 'Connect create-staff flow when ready.',
              });
            }}
          >
            Add Staff
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              toast.message('Deactivate', {
                description: 'Deactivate staff flow coming soon.',
              });
            }}
          >
            Deactivate
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={staff}
          isLoading={isIdleOrLoading}
          searchable
          searchPlaceholder="Search staff…"
        />

        <EditRoleDialog
          key={selectedStaffId ?? 'no-selection'}
          open={dialogOpen}
          onOpenChange={open => {
            setDialogOpen(open);
            if (!open) setSelectedStaffId(undefined);
          }}
          staff={staff}
          currentStaffId={currentStaffId}
          preSelectedStaffId={selectedStaffId}
        />
      </div>

      {/* Panel 2: Permission Matrix (Phase 13) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Permission Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Toggle which actions each role can perform. Changes take effect immediately. Only
            admins can modify permissions.
          </p>
        </div>
        <PermissionMatrix />
      </div>
    </div>
  );
}
