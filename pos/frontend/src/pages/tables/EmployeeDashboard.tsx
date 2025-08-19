import { useState, useEffect } from 'react';
import { Box, Grid, Typography, Card, CardContent, CardHeader, Divider, Button, IconButton, List, ListItem, ListItemText, ListItemIcon, Paper, Chip, Badge } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GroupIcon from '@mui/icons-material/Group';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { Link } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import apiClient from '../../lib/apiClient';
import { useRoleGuard } from '../../components/auth/withRoleGuard';

// Table Status Widget with quick actions
interface TableStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  needsCleaning: number;
}

const TableStatusWidget = ({ tableStats, onRefresh }: { tableStats: TableStats; onRefresh: () => void }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Table Status" 
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
      </CardContent>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button component={Link} to="/tables/layout" size="small">
          View Table Layout
        </Button>
      </Box>
    </Card>
  );
};

// Today's Reservations Widget
interface Reservation {
  id: number;
  customerName: string;
  partySize: number;
  time: string;
  tableNumber: number;
  status: string;
}

const ReservationsWidget = ({ reservations, onRefresh }: { reservations: Reservation[]; onRefresh: () => void }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Today's Reservations" 
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
            No reservations for today
          </Typography>
        ) : (
          <List dense>
            {reservations.map((reservation) => (
              <ListItem key={reservation.id} divider>
                <ListItemIcon>
                  <Badge color={
                    new Date(reservation.time) < new Date() ? "error" : 
                    new Date(reservation.time) < new Date(Date.now() + 3600000) ? "warning" : "success"
                  } variant="dot">
                    <AccessTimeIcon />
                  </Badge>
                </ListItemIcon>
                <ListItemText 
                  primary={`${new Date(reservation.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${reservation.customerName}`}
                  secondary={`Table ${reservation.tableNumber} - ${reservation.partySize} guests`}
                />
                <Chip 
                  size="small" 
                  label={reservation.status} 
                  color={
                    reservation.status === 'confirmed' ? 'success' : 
                    reservation.status === 'pending' ? 'warning' : 
                    reservation.status === 'seated' ? 'info' : 'default'
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

// Operational Actions Widget - Employee/Manager functions only
const OperationalActionsWidget = () => {
  const { AdminModal } = useRoleGuard('admin');

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AdminModal />
      <CardHeader title="Table Operations" />
      <Divider />
      <CardContent sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          {/* Operational Actions - Available to all roles */}
          <Grid item xs={12}>
            <Button 
              variant="contained" 
              fullWidth 
              startIcon={<GroupIcon />}
              component={Link}
              to="/tables/seat"
            >
              Seat Guests
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<EventAvailableIcon />}
              component={Link}
              to="/tables/reservations/new"
            >
              New Reservation
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<CheckCircleIcon />}
              component={Link}
              to="/tables/checkout"
            >
              Table Checkout
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<CleaningServicesIcon />}
              component={Link}
              to="/tables/cleaning"
            >
              Mark Table Clean
            </Button>
          </Grid>
          
          {/* Session Management */}
          <Grid item xs={6}>
            <Button 
              variant="outlined" 
              fullWidth 
              size="small"
              startIcon={<PlayArrowIcon />}
              component={Link}
              to="/tables/sessions/start"
            >
              Start Session
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button 
              variant="outlined" 
              fullWidth 
              size="small"
              startIcon={<PauseIcon />}
              component={Link}
              to="/tables/sessions/pause"
            >
              Pause Session
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button 
              variant="outlined" 
              fullWidth 
              size="small"
              startIcon={<StopIcon />}
              component={Link}
              to="/tables/sessions/end"
            >
              End Session
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button 
              variant="outlined" 
              fullWidth 
              size="small"
              startIcon={<SwapHorizIcon />}
              component={Link}
              to="/tables/transfer"
            >
              Transfer Table
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Tables Needing Attention Widget
interface TableInfo {
  id: number;
  number: number;
  location: string;
  status: string;
  issue?: string;
}

interface TableListWidgetProps {
  tables: TableInfo[];
  onRefresh: () => void;
}

const TableListWidget = ({ tables, onRefresh }: TableListWidgetProps) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader 
        title="Tables Needing Attention" 
        action={
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {tables.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center">
            No tables need attention
          </Typography>
        ) : (
          <List dense>
            {tables.map((table) => (
              <ListItem key={table.id} divider>
                <ListItemText 
                  primary={`Table ${table.number} (${table.location})`}
                  secondary={table.issue}
                />
                <Chip 
                  size="small" 
                  label={table.status} 
                  color={
                    table.status === 'needs_cleaning' ? 'warning' : 
                    table.status === 'service_requested' ? 'error' : 
                    'default'
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

const EmployeeDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  // Tables state removed as it's not currently used
  const [tableStats, setTableStats] = useState<TableStats>({
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    needsCleaning: 0
  });
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tablesNeedingAttention, setTablesNeedingAttention] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // isLoading is used in fetchDashboardData but not in the UI
  
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch table statistics
      const tableStatsResponse = await apiClient.get('/api/tables/stats');
      if (tableStatsResponse.data) {
        setTableStats(tableStatsResponse.data);
      } else {
        // Mock data if API doesn't exist yet
        setTableStats({
          total: 24,
          available: 14,
          occupied: 8,
          reserved: 2,
          needsCleaning: 3
        });
      }
      
      // Fetch today's reservations
      const todayReservationsResponse = await apiClient.get('/api/tables/reservations/today');
      if (todayReservationsResponse.data) {
        setReservations(todayReservationsResponse.data);
      } else {
        setReservations([]);
      }
      
      // Fetch tables needing attention
      const tablesResponse = await apiClient.get('/api/tables/attention');
      if (tablesResponse.data) {
        setTablesNeedingAttention(tablesResponse.data);
      } else {
        setTablesNeedingAttention([]);
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
        <TableRestaurantIcon sx={{ mr: 1 }} /> Table Management
      </Typography>
      
      <Grid container spacing={3}>
        {/* Table Status */}
        <Grid item xs={12} md={6}>
          <TableStatusWidget 
            tableStats={tableStats} 
            onRefresh={fetchDashboardData} 
          />
        </Grid>
        
        {/* Today's Reservations */}
        <Grid item xs={12} md={6}>
          <ReservationsWidget 
            reservations={reservations}
            onRefresh={fetchDashboardData}
          />
        </Grid>
        
        {/* Operational Actions */}
        <Grid item xs={12} md={6}>
          <OperationalActionsWidget />
        </Grid>
        
        {/* Tables Needing Attention */}
        <Grid item xs={12} md={6}>
          <TableListWidget 
            tables={tablesNeedingAttention}
            onRefresh={fetchDashboardData}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmployeeDashboard;
