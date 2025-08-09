import React from 'react';
import { Outlet } from 'react-router-dom';
import './Layout.css';

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Billiard POS System</h1>
      </header>
      <main className="app-main">{children || <Outlet />}</main>
      <footer className="app-footer">
        © {new Date().getFullYear()} Billiard POS
      </footer>
    </div>
  );
}
