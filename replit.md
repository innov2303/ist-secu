# InfraGuard Security

## Overview

InfraGuard Security is a web application for selling and distributing security verification scripts for various operating systems (Windows, Linux, VMware ESXi, Docker). Users can browse available scripts, purchase them via Stripe payments (one-time or subscription), and download purchased scripts. The application features Replit Auth for authentication and includes an admin panel for user management.

## Security Scripts

### Linux Compliance Toolkit (ANSSI-BP-028 + CIS Benchmark)
- **Base Script** (~55 controls): Based on ANSSI-BP-028 + CIS Level 1 recommendations
- **Enhanced Script** (~100 controls): Based on ANSSI-BP-028 + CIS Level 2 recommendations  
- **Toolkit Bundle**: Both scripts bundled together at 30% discount

Scripts generate HTML/JSON reports with scores, grades, and remediation recommendations based on ANSSI and CIS compliance standards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme variables
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Server**: Node.js with HTTP server
- **API Design**: RESTful endpoints defined in shared/routes.ts with Zod validation
- **Authentication**: Replit OpenID Connect (OIDC) integration with Passport.js
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: shared/schema.ts (shared between frontend and backend)
- **Key Tables**:
  - `users` - User accounts with admin flags and Stripe customer IDs
  - `sessions` - Session storage for authentication
  - `scripts` - Security scripts catalog with pricing
  - `purchases` - User purchase records with subscription tracking

### Authentication Flow
- Dual authentication: Replit Auth via OIDC and local email/password
- Local auth uses bcrypt for password hashing with session regeneration for security
- First registered user automatically becomes admin
- Session-based authentication with PostgreSQL session store
- Protected routes use `isAuthenticated` middleware
- Profile page at /profile for updating name/email/password (local users only)
- **TODO**: Email verification for email changes requires Resend integration to be configured

### Payment Integration
- **Provider**: Stripe (via Replit Connector)
- **Payment Types**: One-time purchases and monthly subscriptions
- **Webhook Handling**: Automated via stripe-replit-sync package
- **Environment Detection**: Automatic production/development mode switching

## External Dependencies

### Third-Party Services
- **Stripe**: Payment processing (connected via Replit Connector, not raw API keys)
- **Replit Auth**: User authentication via OIDC
- **PostgreSQL**: Primary database (provisioned via Replit)

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `stripe` / `stripe-replit-sync`: Payment processing
- `passport` / `openid-client`: Authentication
- `express-session` / `connect-pg-simple`: Session management
- `@tanstack/react-query`: Frontend data fetching
- `framer-motion`: Animations
- Full shadcn/ui component suite (@radix-ui/*)

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `ISSUER_URL`: Replit OIDC issuer (defaults to https://replit.com/oidc)
- `REPL_ID`: Replit environment identifier
- Stripe credentials are fetched dynamically via Replit Connector API