#!/bin/bash

# Navigate to frontend directory
cd billiard-pos/frontend

# Install TailwindCSS and dependencies correctly
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Create proper configuration files
cat > tailwind.config.js <<'EOL'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#3B82F6',
          600: '#2563EB',
        },
        secondary: {
          500: '#10B981',
          600: '#059669',
        },
        danger: {
          500: '#EF4444',
          600: '#DC2626',
        }
      }
    },
  },
  plugins: [],
}
EOL

# Update PostCSS config
cat > postcss.config.js <<'EOL'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOL

# Add Tailwind directives to CSS
cat > src/index.css <<'EOL'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
body {
  @apply bg-gray-50 text-gray-900;
}

.btn-primary {
  @apply bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-md transition-colors;
}

.btn-danger {
  @apply bg-danger-500 hover:bg-danger-600 text-white px-4 py-2 rounded-md transition-colors;
}
EOL

# Update package.json scripts
npm pkg set scripts.build="react-scripts build"
npm pkg set scripts.start="react-scripts start"
npm pkg set scripts.test="react-scripts test"

echo "TailwindCSS configured successfully!"
echo "Start your development server with: npm run start"