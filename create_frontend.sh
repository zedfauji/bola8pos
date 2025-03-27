#!/bin/bash

# Create directory structure
mkdir -p billiard-pos/frontend/{public/assets/styles,src/{components/{layout,tables,orders,shared},pages,context,services,utils}}

# Create basic files
# 1. package.json
cat > billiard-pos/frontend/package.json <<'EOL'
{
  "name": "billiard-pos-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "axios": "^1.3.4",
    "chart.js": "^4.2.1",
    "date-fns": "^2.29.3",
    "react-icons": "^4.7.1",
    "react-toastify": "^9.1.1",
    "zustand": "^4.3.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOL

# 2. Dockerfile
cat > billiard-pos/frontend/Dockerfile <<'EOL'
FROM node:16 as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.21-alpine
COPY --from=build-stage /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOL

# 3. .env
cat > billiard-pos/frontend/.env <<'EOL'
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000
EOL

# 4. Main App files
cat > billiard-pos/frontend/src/App.jsx <<'EOL'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Members from './pages/Members';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/members" element={<Members />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <ToastContainer />
    </Router>
  );
}

export default App;
EOL

# 5. Index file
cat > billiard-pos/frontend/src/index.jsx <<'EOL'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
EOL

# 6. Create sample page (Dashboard)
cat > billiard-pos/frontend/src/pages/Dashboard.jsx <<'EOL'
import React from 'react';
import { useAuth } from '../context/AuthContext';
import TableStatus from '../components/tables/TableStatus';
import SalesChart from '../components/charts/SalesChart';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <h1>Welcome, {user?.name}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TableStatus />
        <SalesChart />
      </div>
    </div>
  );
}
EOL

echo "Frontend structure created successfully!"
echo "Missing items you'll need to manually create:"
echo "1. Complete all component files in src/components/"
echo "2. Add proper styling (TailwindCSS recommended)"
echo "3. Implement authentication flow"
echo "4. Add real-time socket.io integration"
echo "5. Complete all page components"
echo ""
echo "To get started:"
echo "1. cd billiard-pos/frontend"
echo "2. npm install"
echo "3. npm start"