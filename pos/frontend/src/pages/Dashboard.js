import React, { useState, useEffect, useContext } from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider
} from '@mui/material';
import { 
  TrendingUp as TrendingUpIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { AuthContext } from '../contexts/authContext';
import SalesChart from '../components/dashboard/SalesChart';
import RecentOrders from '../components/dashboard/RecentOrders';
import InventoryAlertWidget from '../components/dashboard/InventoryAlertWidget';
import StatCard from '../components/dashboard/StatCard';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    dailySales: 0,
    totalProducts: 0,
    pendingOrders: 0,
    activeCustomers: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard data
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Daily Sales"
            value={`$${stats.dailySales.toFixed(2)}`}
            icon={<TrendingUpIcon />}
            color="#4caf50"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Total Products"
            value={stats.totalProducts}
            icon={<InventoryIcon />}
            color="#2196f3"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Pending Orders"
            value={stats.pendingOrders}
            icon={<ShoppingCartIcon />}
            color="#ff9800"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Active Customers"
            value={stats.activeCustomers}
            icon={<PeopleIcon />}
            color="#9c27b0"
            isLoading={isLoading}
          />
        </Grid>

        {/* Sales Chart */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 360,
            }}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Sales Overview
            </Typography>
            <SalesChart />
          </Paper>
        </Grid>

        {/* Inventory Alerts Widget */}
        <Grid item xs={12} md={4}>
          <InventoryAlertWidget />
        </Grid>

        {/* Recent Orders */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Recent Orders
            </Typography>
            <RecentOrders />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
