import React from 'react';
import { Button, List, ListItem, ListItemText, ListItemIcon, Box, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import { Link } from 'react-router-dom';
import { useRoleGuard } from '../auth/withRoleGuard';

interface ProtectedTableActionsProps {
  variant?: 'list' | 'buttons';
  showEditLayout?: boolean;
  showManageTypes?: boolean;
  showManageFloors?: boolean;
  showTableSettings?: boolean;
}

/**
 * Component that renders table configuration actions with proper role protection
 * Shows admin access modal for non-admin users
 */
export const ProtectedTableActions: React.FC<ProtectedTableActionsProps> = ({
  variant = 'list',
  showEditLayout = true,
  showManageTypes = true,
  showManageFloors = true,
  showTableSettings = true
}) => {
  const { hasRequiredRole, checkAccess, AdminModal } = useRoleGuard('admin');

  const handleProtectedAction = (action: () => void) => {
    checkAccess(action);
  };

  const actions = [
    {
      key: 'editLayout',
      show: showEditLayout,
      icon: <EditIcon />,
      primary: 'Edit Table Layout',
      secondary: 'Modify table positions and properties',
      to: '/tables/layout/edit'
    },
    {
      key: 'manageTypes',
      show: showManageTypes,
      icon: <SettingsIcon />,
      primary: 'Manage Table Types',
      secondary: 'Configure table types and capacities',
      to: '/tables/types'
    },
    {
      key: 'manageFloors',
      show: showManageFloors,
      icon: <AddIcon />,
      primary: 'Manage Floors',
      secondary: 'Add or edit floor plans',
      to: '/tables/floors'
    },
    {
      key: 'tableSettings',
      show: showTableSettings,
      icon: <SettingsIcon />,
      primary: 'Table Settings',
      secondary: 'Configure global table settings',
      to: '/tables/settings'
    }
  ].filter(action => action.show);

  if (variant === 'buttons') {
    return (
      <Box>
        <AdminModal />
        {actions.map((action) => (
          <Box key={action.key} sx={{ mb: 1 }}>
            {hasRequiredRole ? (
              <Button
                component={Link}
                to={action.to}
                variant="outlined"
                fullWidth
                startIcon={action.icon}
              >
                {action.primary}
              </Button>
            ) : (
              <Button
                onClick={() => handleProtectedAction(() => {})}
                variant="outlined"
                fullWidth
                startIcon={action.icon}
              >
                {action.primary}
              </Button>
            )}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box>
      <AdminModal />
      <List>
        {actions.map((action) => (
          <ListItem
            key={action.key}
            button
            onClick={() => {
              if (hasRequiredRole) {
                // Allow navigation for admin users
                window.location.href = action.to;
              } else {
                handleProtectedAction(() => {});
              }
            }}
          >
            <ListItemIcon>
              {action.icon}
            </ListItemIcon>
            <ListItemText 
              primary={action.primary}
              secondary={action.secondary}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

/**
 * Simple component that shows access denied message for non-admin users
 */
export const AdminOnlyMessage: React.FC = () => {
  return (
    <Box sx={{ textAlign: 'center', p: 3 }}>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Administrator Access Required
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This section is only available to administrators.
      </Typography>
    </Box>
  );
};

export default ProtectedTableActions;
