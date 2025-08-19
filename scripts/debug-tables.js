const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Allow self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const API_BASE = 'https://localhost:3001/api';
const AUTH_URL = `${API_BASE}/auth/login`;
const TABLE_LAYOUTS_URL = `${API_BASE}/table-layouts`;
const ACTIVE_LAYOUT_URL = `${API_BASE}/table-layouts/active`;

async function debugTables() {
  try {
    // Step 1: Login to get token
    console.log('Logging in...');
    const loginResponse = await axios.post(AUTH_URL, {
      email: 'admin@billiardpos.com',
      password: 'password'
    }, { httpsAgent });

    const { accessToken } = loginResponse.data;
    console.log('Login successful');

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Get active layout
    console.log('\nFetching active layout...');
    try {
      const activeLayout = await axios.get(ACTIVE_LAYOUT_URL, { headers, httpsAgent });
      console.log('Active Layout:', JSON.stringify(activeLayout.data, null, 2));
    } catch (error) {
      console.error('Error fetching active layout:', error.response?.data || error.message);
    }

    // Step 3: Get all layouts
    console.log('\nFetching all layouts...');
    try {
      const allLayouts = await axios.get(TABLE_LAYOUTS_URL, { headers, httpsAgent });
      console.log('All Layouts:', JSON.stringify(allLayouts.data, null, 2));
      
      if (allLayouts.data && allLayouts.data.length > 0) {
        // Step 4: Get details of first layout
        const firstLayoutId = allLayouts.data[0].id;
        console.log(`\nFetching details for layout ${firstLayoutId}...`);
        try {
          const layoutDetails = await axios.get(`${TABLE_LAYOUTS_URL}/${firstLayoutId}`, { headers, httpsAgent });
          console.log('Layout Details:', JSON.stringify(layoutDetails.data, null, 2));
        } catch (error) {
          console.error('Error fetching layout details:', error.response?.data || error.message);
        }
      }
    } catch (error) {
      console.error('Error fetching layouts:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('Debug error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

debugTables();
