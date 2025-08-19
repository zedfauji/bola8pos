import { useState, useEffect } from 'react';
import apiClient from '../../lib/apiClient';
import { Box, Grid, Typography, Card, CardContent, CardHeader, Divider, Button, IconButton, List, ListItem, ListItemText, ListItemIcon, Paper, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { Link } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { ProtectedTableActions } from '../../components/tables/ProtectedTableActions';
import { withRoleGuard } from '../../components/auth/withRoleGuard';

// Define interfaces for type safety
interface TableStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  needsCleaning: number;
  utilizationRate: number;
}

interface FloorData {
  id: number;
  name: string;
  tableCount: number;
  occupancyRate: number;
}

interface Reservation {
  id: number;
  customerName: string;
  partySize: number;
  time: string;
  tableNumber: number;
  status: string;
}

// Table Stats Widget
const TableStatsWidget = ({ tableStats, onRefresh }: { tableStats: TableStats; onRefresh: () => void }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Table Status Summary" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
              <Typography variant="h6">{tableStats.available}</Typography>
              <Typography variant="body2">Available</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center', bgcolor: '#ffebee' }}>
              <Typography variant="h6">{tableStats.occupied}</Typography>
              <Typography variant="body2">Occupied</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
              <Typography variant="h6">{tableStats.reserved}</Typography>
              <Typography variant="body2">Reserved</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
              <Typography variant="h6">{tableStats.needsCleaning}</Typography>
              <Typography variant="body2">Needs Cleaning</Typography>
            </Paper>
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" align="center">
            Total Tables: <strong>{tableStats.total}</strong>
          </Typography>
          <Typography variant="body2" align="center">
            Utilization: <strong>{tableStats.utilizationRate}%</strong>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// Floor Occupancy Widget
const FloorOccupancyWidget = ({ floorData, onRefresh }: { floorData: FloorData[]; onRefresh: () => void }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Floor Occupancy" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1 }}>
        {floorData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center">
            No floor data available
          </Typography>
        ) : (
          <List>
            {floorData.map((floor) => (
              <ListItem key={floor.id} divider>
                <ListItemText 
                  primary={floor.name} 
                  secondary={`${floor.tableCount} tables`}
                />
                <Box>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    {Math.round(floor.occupancyRate * 100)}%
                  </Typography>
                  <Box sx={{ 
                    width: '100px', 
                    height: '10px', 
                    bgcolor: '#e0e0e0',
                    borderRadius: '5px',
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      width: `${Math.round(floor.occupancyRate * 100)}%`, 
                      height: '100%', 
                      bgcolor: floor.occupancyRate > 0.8 ? '#f44336' : '#4caf50'
                    }} />
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/tables/layout" size="small">
          View Floor Layout
        </Button>
      </Box>
    </Card>
  );
};

// Enhanced Admin Configuration Widget with all admin features
const AdminConfigurationWidget = () => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Administrator Configuration" 
        avatar={<SecurityIcon color="primary" />}
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1 }}>
        <ProtectedTableActions variant="list" />
        <Divider sx={{ my: 2 }} />
        <List>
          <ListItem button component={Link} to="/admin/tariffs">
            <ListItemIcon>
              <MonetizationOnIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Tariff Management" 
              secondary="Configure pricing and billing rates" 
            />
          </ListItem>
          <ListItem button component={Link} to="/admin/users">
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText 
              primary="User Management" 
              secondary="Manage employee roles and permissions" 
            />
          </ListItem>
          <ListItem button component={Link} to="/admin/system">
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText 
              primary="System Settings" 
              secondary="Global system configuration" 
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

// Admin-only Advanced Tools Widget
const AdminAdvancedToolsWidget = () => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader title="Advanced Tools" />
      <Divider />
      <CardContent sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<EditIcon />}
              component={Link}
              to="/admin/layout-editor"
            >
              Advanced Layout Editor
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<MonetizationOnIcon />}
              component={Link}
              to="/admin/tariff-editor"
            >
              Tariff Configuration
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<SettingsIcon />}
              component={Link}
              to="/admin/bulk-operations"
            >
              Bulk Operations
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Reservation Overview Widget
const ReservationOverviewWidget = ({ reservations, onRefresh }: { reservations: Reservation[]; onRefresh: () => void }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Upcoming Reservations" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {reservations.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center">
            No upcoming reservations
          </Typography>
        ) : (
          <List dense>
            {reservations.map((reservation) => (
              <ListItem key={reservation.id} divider>
                <ListItemText 
                  primary={`${reservation.customerName} (${reservation.partySize} guests)`}
                  secondary={`${new Date(reservation.time).toLocaleString()} - Table ${reservation.tableNumber}`}
                />
                <Chip 
                  size="small" 
                  label={reservation.status} 
                  color={
                    reservation.status === 'confirmed' ? 'success' : 
                    reservation.status === 'pending' ? 'warning' : 'default'
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/tables/reservations" size="small">
          Manage Reservations
        </Button>
      </Box>
    </Card>
  );
};

const AdminDashboardComponent = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  const [tableStats, setTableStats] = useState<TableStats>({
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    needsCleaning: 0,
    utilizationRate: 0
  });
  
  const [floorData, setFloorData] = useState<FloorData[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch table statistics
      const tableStatsResponse = await apiClient.get('/api/tables/stats');
      if (tableStatsResponse.data) {
        setTableStats(tableStatsResponse.data);
      } else {
        // Mock data for testing
        setTableStats({
          total: 27,
          available: 14,
          occupied: 8,
          reserved: 2,
          needsCleaning: 3,
          utilizationRate: 48
        });
      }
      
      // Fetch floor data
      const floorResponse = await apiClient.get('/api/tables/floors');
      if (floorResponse.data) {
        setFloorData(floorResponse.data);
      } else {
        // Mock data if API doesn't exist yet
        setFloorData([
          { id: 1, name: 'Main Floor', tableCount: 15, occupancyRate: 0.8 },
          { id: 2, name: 'Patio', tableCount: 8, occupancyRate: 0.5 },
          { id: 3, name: 'Private Room', tableCount: 4, occupancyRate: 0.25 }
        ]);
      }
      
      // Fetch reservations
      const reservationsResponse = await apiClient.get('/api/tables/reservations/upcoming');
      if (reservationsResponse.data) {
        setReservations(reservationsResponse.data);
      } else {
        // Mock data if API doesn't exist yet
        setReservations([
          { id: 1, customerName: 'John Smith', partySize: 4, time: new Date(Date.now() + 3600000).toISOString(), tableNumber: 5, status: 'confirmed' },
          { id: 2, customerName: 'Maria Garcia', partySize: 2, time: new Date(Date.now() + 7200000).toISOString(), tableNumber: 8, status: 'confirmed' },
          { id: 3, customerName: 'Robert Johnson', partySize: 6, time: new Date(Date.now() + 10800000).toISOString(), tableNumber: 12, status: 'pending' }
        ]);
      }
      
    } catch (error) {
      console.error('Error fetching table dashboard data:', error);
      enqueueSnackbar('Failed to load table dashboard data', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <TableRestaurantIcon sx={{ mr: 1 }} /> Table Management Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Table Status Summary */}
        <Grid item xs={12} md={6}>
          <TableStatsWidget 
            tableStats={tableStats} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Floor Occupancy */}
        <Grid item xs={12} md={6}>
          <FloorOccupancyWidget 
            floorData={floorData} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Admin Configuration - Only visible to admins */}
        <Grid item xs={12} md={6}>
          <AdminConfigurationWidget />
        </Grid>
        
        {/* Advanced Admin Tools */}
        <Grid item xs={12} md={6}>
          <AdminAdvancedToolsWidget />
        </Grid>
        
        {/* Reservation Overview */}
        <Grid item xs={12} md={6}>
          <ReservationOverviewWidget 
            reservations={reservations}
            onRefresh={fetchDashboardData}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

// Wrap the component with role guard to ensure only admins can access
const AdminDashboard = withRoleGuard(AdminDashboardComponent, {
  requiredRole: 'admin',
  requireAdminLogin: false // Silent block for non-admins
});

export default AdminDashboard;
