import { useState, useEffect } from 'react';
import api from './api';

export default function App() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await api.get('/health');
        setStatus(response.data.status === 'OK' ? 'connected' : 'disconnected');
      } catch (err) {
        setStatus('disconnected');
        setError({
          message: err.message,
          url: err.config.url,
          status: err.response?.status
        });
        console.error('Connection error:', err);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Billiard POS System</h1>
      <div style={{
        margin: '2rem auto',
        padding: '1rem',
        backgroundColor: status === 'connected' ? '#d4edda' : '#f8d7da',
        color: status === 'connected' ? '#155724' : '#721c24',
        borderRadius: '4px',
        maxWidth: '500px'
      }}>
        <p>Backend Status: <strong>{status}</strong></p>
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <p>Error Details:</p>
            <ul>
              <li>URL: {error.url}</li>
              <li>Status: {error.status || 'No response'}</li>
              <li>Message: {error.message}</li>
            </ul>
          </div>
        )}
      </div>
      <div style={{ marginTop: '2rem' }}>
        <p>Testing connection to: <code>{import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}</code></p>
      </div>
    </div>
  );
}
