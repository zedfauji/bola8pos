/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_PORT: string;
  readonly VITE_NODE_ENV: 'development' | 'production' | 'test';
  // Add other environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.styl' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// For SVG imports with ReactComponent
interface SvgrComponent extends React.FC<React.SVGProps<SVGSVGElement>> {}
declare module '*.svg' {
  const content: string | SvgrComponent;
  export default content;
}

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
declare module '*.avif';
// Add other asset types as needed
