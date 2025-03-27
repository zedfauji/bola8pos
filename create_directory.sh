#!/bin/bash

# Create the main project directory
mkdir -p billiard-pos/{backend,frontend}

# Backend structure
mkdir -p billiard-pos/backend/src/{config,controllers,models,routes,services,migrations,seeders}
touch billiard-pos/backend/{Dockerfile,package.json,.env,.sequelizerc}
touch billiard-pos/backend/src/{app.js,server.js}

# Frontend structure
mkdir -p billiard-pos/frontend/src/{components,pages,context,services,utils}
touch billiard-pos/frontend/{Dockerfile,package.json}
touch billiard-pos/frontend/src/{App.js,index.js}

# Root files
touch billiard-pos/{docker-compose.yml,README.md}

echo "Project structure created successfully!"
echo "Run 'chmod +x create_project.sh' to make this script executable"
