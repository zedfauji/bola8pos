# Layout (`src/components/layout/index.jsx`)

Summary
App shell with header, main content area, and footer. Renders `children` inside the main section.

Props
- `children: ReactNode`

Usage
```jsx
import Layout from '../components/layout';

export default function Shell({ children }) {
  return <Layout>{children}</Layout>;
}
```