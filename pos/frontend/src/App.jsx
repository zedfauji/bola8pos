import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';

// Context Providers
import { SettingsProvider } from './contexts/SettingsContext';
import { InventoryProvider } from './contexts/InventoryContext';

// Lazy load components for better performance
const TablesPage = React.lazy(() => import('./components/tables/TablesPage'));
const OrderPage = React.lazy(() => import('./components/orders/OrderPage'));
const KitchenDisplay = React.lazy(() => import('./components/kds/KitchenDisplay'));
const SettingsPage = React.lazy(() => import('./components/settings/SettingsPage'));
const ReportsPage = React.lazy(() => {
  return new Promise(resolve => {
    import('./components/reports/ReportsPage.jsx').then(module => {
      resolve({ default: module.default });
    });
  });
});
const PaymentPage = React.lazy(() => import('./components/payment/PaymentPage'));
const OrdersSummary = React.lazy(() => import('./components/orders/OrdersSummary'));
const AuditLog = React.lazy(() => import('./components/admin/AuditLog'));
const DiscountsPage = React.lazy(() => import('./components/admin/DiscountsPage'));
const AdminSettings = React.lazy(() => import('./components/admin/AdminSettings'));
const BarSalesPage = React.lazy(() => import('./pages/inventory/sales/BarSalesPage'));
const Inventory = React.lazy(() => import('./routes/Inventory'));
import ShiftBar from './components/shifts/ShiftBar';

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

const Dashboard = () => {
  const stats = [
    { title: 'Active Tables', value: '8', icon: '📊', color: 'bg-blue-500' },
    { title: 'Pending Orders', value: '12', icon: '🛒', color: 'bg-orange-500' },
    { title: 'Today\'s Revenue', value: '$2,847', icon: '💳', color: 'bg-green-500' },
    { title: 'Kitchen Queue', value: '5', icon: '👨‍🍳', color: 'bg-purple-500' }
  ];

  const recentActivity = [
    { time: '2:45 PM', action: 'Table B1 started', type: 'table' },
    { time: '2:42 PM', action: 'Order #ORD001 completed', type: 'order' },
    { time: '2:38 PM', action: 'Payment processed - $85.50', type: 'payment' },
    { time: '2:35 PM', action: 'Table T3 order sent to kitchen', type: 'kitchen' },
    { time: '2:30 PM', action: 'Table B2 paused', type: 'table' }
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-2">Dashboard</h1>
        <p className="text-gray-300">Welcome to Bola8 Billiards POS System</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="pos-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="pos-card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              to="/tables"
              className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg text-center transition-colors"
            >
              <div className="text-3xl mb-2">🎱</div>
              <div className="font-medium">Manage Tables</div>
            </Link>
            <Link
              to="/tables"
              className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg text-center transition-colors"
            >
              <div className="text-3xl mb-2">🛒</div>
              <div className="font-medium">New Order</div>
            </Link>
            <Link
              to="/payment"
              className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg text-center transition-colors"
            >
              <div className="text-3xl mb-2">💳</div>
              <div className="font-medium">Process Payment</div>
            </Link>
            <Link
              to="/kitchen"
              className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg text-center transition-colors"
            >
              <div className="text-3xl mb-2">👨‍🍳</div>
              <div className="font-medium">Kitchen Display</div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="pos-card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{activity.action}</div>
                  <div className="text-xs text-gray-400">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: '🏠' },
    { name: 'Tables', href: '/tables', icon: '🎱' },
    { name: 'Bar Sales', href: '/bar-sales', icon: '🍻' },
    { name: 'Inventory', href: '/inventory', icon: '📦' },
    { name: 'Orders', href: '/orders', icon: '🛒' },
    { name: 'Payment', href: '/payment', icon: '💳' },
    { name: 'Kitchen', href: '/kitchen', icon: '👨\u200d🍳' },
    { name: 'Reports', href: '/reports', icon: '📊' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
    { 
      name: 'Admin', 
      icon: '🔒',
      submenu: [
        { name: 'Audit Log', href: '/admin/audit-log', icon: '🧾' },
        { name: 'Discounts', href: '/admin/discounts', icon: '🏷️' },
        { name: 'Settings', href: '/admin/settings', icon: '🧩' }
      ]
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">B8</span>
            </div>
            <span className="text-white font-bold text-lg">Bola8 POS</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <nav className="mt-8 px-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                             (item.submenu && item.submenu.some(subItem => location.pathname === subItem.href));
              const [isExpanded, setIsExpanded] = useState(false);
              
              if (item.submenu) {
                return (
                  <div key={item.name} className="mb-2">
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{item.icon}</span>
                        {item.name}
                      </div>
                      <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                    
                    {isExpanded && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.submenu.map((subItem) => {
                          const isSubActive = location.pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              onClick={() => setIsOpen(false)}
                              className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                                isSubActive
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{subItem.icon}</span>
                                {subItem.name}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
        
        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-gray-300">
              👤
            </div>
            <div>
              <div className="text-sm font-medium text-white">Manager</div>
              <div className="text-xs text-gray-400">Shift: 2:00 PM - 10:00 PM</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Header = ({ setSidebarOpen }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="pos-header border-b border-gray-700 h-16 flex items-center justify-between px-6 text-gray-100">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden text-gray-300 hover:text-white text-xl"
        >
          ☰
        </button>
        
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span>🕐</span>
          <span>{currentTime.toLocaleString()}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          <span className="text-sm text-gray-300">System Online</span>
        </div>
        <div className="hidden md:block">
          <ShiftBar />
        </div>
      </div>
    </header>
  );
};

const ComingSoon = ({ title }) => (
  <div className="p-6">
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl text-white">
        ⚙️
      </div>
      <h1 className="text-2xl font-bold text-gray-100 mb-2">{title}</h1>
      <p className="text-gray-300">This feature is coming soon!</p>
    </div>
  </div>
);

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ToastContainer, setToastContainer] = useState(null);
  useEffect(() => {
    let mounted = true;
    import('react-toastify').then(mod => {
      if (mounted) setToastContainer(() => mod.ToastContainer);
    }).catch(() => {/* ignore */});
    return () => { mounted = false; };
  }, []);

  return (
    <Router>
      <SettingsProvider>
        <InventoryProvider>
          {ToastContainer ? <ToastContainer position="bottom-right" theme="dark" /> : null}
          <div className="flex h-screen pos-container text-white">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header setSidebarOpen={setSidebarOpen} />
              <main className="flex-1 overflow-x-hidden overflow-y-auto">
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/tables" element={<TablesPage />} />
                    <Route path="/order/:tableId" element={<OrderPage />} />
                    <Route path="/kitchen" element={<KitchenDisplay />} />
                    <Route path="/payment/:tableId?" element={<PaymentPage />} />
                    <Route path="/orders" element={<OrdersSummary />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/admin/audit-log" element={<AuditLog />} />
                    <Route path="/admin/discounts" element={<DiscountsPage />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                    <Route path="/bar-sales" element={<BarSalesPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </div>
        </InventoryProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;
