#!/bin/bash

# Navigate to frontend directory
cd billiard-pos/frontend

# Install react-router-dom
echo "Installing react-router-dom..."
npm install react-router-dom@6

# Verify installation
echo "Checking installed version..."
npm list react-router-dom

# Clear cache
echo "Clearing Vite cache..."
rm -rf node_modules/.vite

# Reinstall dependencies
echo "Reinstalling dependencies..."
npm install

# Start the application
echo "Starting development server..."
npm run dev