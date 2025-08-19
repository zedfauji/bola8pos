# Overview

This is a full-stack web application for "Bola 8 Pool Club La Calma," a pool/billiards club website built with React, Express, and PostgreSQL. The application features a professional rock-themed design with custom logo and billiard-themed imagery, providing functionality for table reservations, membership management, menu display, reviews, sports content, and promotional materials. The system includes both a customer-facing website and backend API endpoints for data management, with integration to the client's POS system via `/createReservationWebsite` and `/createMemberwebsite` endpoints.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with pages for home, reservations, menu, sports, reviews, membership, and promotions
- **State Management**: TanStack Query (React Query) for server state management and data fetching
- **UI Framework**: Radix UI components with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with custom rock-themed color scheme (dark backgrounds, red accents, gold highlights)
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Design System**: Custom CSS variables for theming with fonts including Bebas Neue, Playfair Display, and Inter
- **Brand Elements**: Custom Logo component featuring 8-ball and pool cue SVG design, billiard-themed background patterns
- **Imagery**: Authentic billiard, craft beer, and chicken wings imagery throughout the site

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with endpoints for reservations, members, reviews, and contacts
- **Middleware**: Custom logging middleware for API request tracking
- **Development**: Vite middleware integration for hot module replacement in development
- **Error Handling**: Centralized error handling middleware with structured error responses

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema**: Well-defined tables for users, reservations, members, reviews, and contacts with UUID primary keys
- **Migrations**: Drizzle Kit for database schema management and migrations
- **Validation**: Drizzle-Zod integration for runtime schema validation
- **Development Storage**: In-memory storage implementation for development/testing with the same interface as production

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **User Management**: Basic user system with username/password authentication
- **Storage Interface**: Abstracted storage layer allowing for easy switching between in-memory and database implementations

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL database (@neondatabase/serverless)
- **Connection**: Environment-based DATABASE_URL configuration

### UI and Design Libraries
- **Radix UI**: Complete set of accessible, unstyled UI primitives including dialogs, dropdowns, forms, and navigation components
- **Tailwind CSS**: Utility-first CSS framework with PostCSS and Autoprefixer
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Utility for creating variant-based component APIs

### Form and Validation
- **React Hook Form**: Performant forms with easy validation
- **Zod**: TypeScript-first schema validation library
- **Hookform Resolvers**: Integration between React Hook Form and Zod

### Development Tools
- **Vite**: Fast build tool and development server
- **ESBuild**: Fast JavaScript bundler for production builds
- **TypeScript**: Type safety and developer experience
- **Replit Integration**: Development environment optimizations for Replit platform

### Data Fetching and State
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **Date-fns**: Date utility library for handling date formatting and manipulation

### Additional Utilities
- **CMDK**: Command menu component for enhanced user interactions
- **Embla Carousel**: Carousel/slider component for image galleries
- **Nanoid**: Secure, URL-safe, unique string ID generator
- **CLSX/Tailwind Merge**: Utility functions for conditional className composition