# 1. Create proper vite.config.js
cat > frontend/vite.config.js <<'EOL'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    hmr: {
      clientPort: 3000
    }
  }
})
EOL

# 2. Ensure proper index.html
cat > frontend/index.html <<'EOL'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Billiard POS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOL

# 3. Set up environment variables
echo "VITE_API_URL=http://localhost:5000/api" > frontend/.env