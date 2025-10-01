## Project Overview

**Basketball Team ERP** is a local-first, browser-based Enterprise Resource Planning system for managing basketball team operations. It runs entirely in the browser using SQLite compiled to WebAssembly, requiring no backend infrastructure.

### Key Characteristics

- **Zero Backend**: Entire application runs in the browser
- **Full SQL Database**: Complete SQLite implementation with joins, transactions, and complex queries
- **Persistent Storage**: Data saved to browser localStorage
- **Offline-First**: Works without internet connection
- **Privacy-Focused**: All data stays on user's device
- **Free Hosting**: Deployable as static files on Vercel, Netlify, or GitHub Pages

---

## Architecture

```
┌──────────────────────────────────────────┐
│            User's Browser                │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │       React Application            │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │     Component Layer          │  │  │
│  │  │  (Dashboard, Roster, etc.)   │  │  │
│  │  └──────────┬───────────────────┘  │  │
│  │             │                      │  │
│  │  ┌──────────▼───────────────────┐  │  │
│  │  │    Custom React Hooks        │  │  │
│  │  │  (useDatabase, useRoster)    │  │  │
│  │  └──────────┬───────────────────┘  │  │
│  │             │                      │  │
│  │  ┌──────────▼───────────────────┐  │  │
│  │  │   SQLite (WebAssembly)       │  │  │
│  │  │   Full SQL Database Engine   │  │  │
│  │  └──────────┬───────────────────┘  │  │
│  │             │                      │  │
│  │  ┌──────────▼───────────────────┐  │  │
│  │  │      localStorage             │  │  │
│  │  │   (Persistent Storage)       │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Data Flow

1. User interacts with React components
2. Components call custom hooks (e.g., `useRoster()`)
3. Hooks execute SQL queries via SQLite WASM
4. Database automatically persists to localStorage
5. Data returns to components for rendering

---

## Technology Stack

### Core Technologies

- **React 19.1.1**: UI framework with hooks
- **TypeScript 5.8**: Type-safe development
- **Vite 7.1**: Build tool and dev server
- **SQLite (via sql.js 1.13)**: In-browser SQL database
- **WebAssembly**: Runs compiled SQLite in browser

### UI Libraries

- **Tailwind CSS 4**: Utility-first CSS framework
- **shadcn/ui components**: Pre-built React components
- **Lucide React**: Icon library
- **Radix UI**: Headless component primitives

### Development Tools

- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **Path aliases**: `@/` maps to `src/`

---

## Project Structure

```
basketball-team-erp/
├── public/
│   └── sql-wasm.wasm          # SQLite WebAssembly binary
├── src/
│   ├── app/
│   │   ├── AppShell.tsx       # Main layout wrapper
│   │   └── nav.ts              # Navigation configuration
│   ├── components/
│   │   ├── common/             # Shared components
│   │   │   ├── SectionHeader.tsx
│   │   │   └── StatCard.tsx
│   │   ├── layout/             # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopNav.tsx
│   │   └── ui/                 # Base UI components
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       └── card.tsx
│   ├── features/               # Feature modules
│   │   ├── dashboard/
│   │   │   └── Dashboard.tsx
│   │   ├── merchandise/
│   │   │   └── Merchandise.tsx
│   │   ├── roster/
│   │   │   └── Roster.tsx
│   │   ├── reports/
│   │   │   └── Reports.tsx
│   │   └── ticketing/
│   │       └── Ticketing.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useDatabase.ts      # Core database hook
│   │   └── useDbBackup.ts      # Import/export functionality
│   ├── lib/                    # Utilities
│   │   ├── database.ts         # SQLite initialization
│   │   ├── sqlUtils.ts         # SQL type helpers
│   │   └── utils.ts            # General utilities
│   ├── types/                  # TypeScript types
│   │   └── erp.ts              # Domain types
│   ├── App.tsx                 # Root component
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Database Schema

### Core Tables

#### `customer`

```sql
CREATE TABLE customer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL
);
```

#### `player`

```sql
CREATE TABLE player (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  age INTEGER NOT NULL,
  overall INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT 1
);
```

#### `contract`

```sql
CREATE TABLE contract (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  aav DECIMAL(12,2) NOT NULL,
  guaranteed DECIMAL(12,2) NOT NULL,
  status TEXT CHECK (status IN ('Active', 'Expired', 'Buyout')),
  FOREIGN KEY (player_id) REFERENCES player(id)
);
```

#### `game`

```sql
CREATE TABLE game (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opponent TEXT NOT NULL,
  date DATE NOT NULL,
  venue TEXT NOT NULL
);
```

#### `item` (Merchandise)

```sql
CREATE TABLE item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 5
);
```

### Additional Tables

- `sales_order`: Merchandise orders
- `ticket_order`: Ticket sales
- `ticket_inventory`: Available tickets
- `cap_ledger`: Salary cap tracking
- `free_agent`: Available players
- `section`, `seat`, `ticket_type`: Venue configuration

---

## Features

### 1. Dashboard

- **Overview Stats**: Active players, upcoming games, revenue metrics
- **Recent Activity**: Latest orders and roster changes
- **Revenue Summary**: Combined merchandise and ticket sales
- **Quick Actions**: Database import/export/reset

### 2. Merchandise Management

- **Inventory Tracking**: Stock levels and reorder points
- **Low Stock Alerts**: Automatic warnings for items below reorder point
- **Sales Orders**: Track customer purchases
- **Inventory Valuation**: Total value of merchandise on hand

### 3. Ticketing System

- **Game Schedule**: Upcoming games with venue information
- **Ticket Orders**: Customer ticket purchases
- **Seat Inventory**: Available vs. sold seats
- **Order Status**: Track confirmation and cancellation

### 4. Roster Management

- **Active Players**: Current team roster with contracts
- **Contract Details**: AAV, term, guaranteed money
- **Free Agents**: Available players with expected salaries
- **Position Tracking**: Roster composition by position

### 5. Reports & Analytics

- **Revenue Dashboard**: Merchandise vs. ticket revenue
- **Attendance Reports**: Game-by-game attendance percentages
- **Salary Cap Analysis**: Current payroll vs. cap ceiling
- **Player Salary Breakdown**: Individual contract details

### 6. Database Operations

- **Export Database**: Download `.db` file for backup
- **Import Database**: Restore from backup file
- **Reset Database**: Clear all data and re-seed
- **Automatic Persistence**: Changes saved to localStorage

---

## Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation Steps

1. **Clone the repository**

```bash
git clone <repository-url>
cd basketball-team-erp
```

2. **Install dependencies**

```bash
npm install
```

3. **Verify WASM file** The postinstall script should copy the WASM file:

```bash
# This runs automatically after npm install
mkdir -p public && cp node_modules/sql.js/dist/sql-wasm.wasm public/sql-wasm.wasm
```

4. **Start development server**

```bash
npm run dev
```

5. **Open in browser** Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

---

## Development Guide

### Working with the Database

#### Using Database Hooks

```typescript
import { useRoster } from '@/hooks/useDatabase';

function MyComponent() {
  const roster = useRoster();
  
  useEffect(() => {
    if (roster.isInitialized) {
      const players = roster.getPlayers?.();
      // Process players data
    }
  }, [roster.isInitialized]);
}
```

#### Creating New Database Hooks

```typescript
export function useCustomData() {
  const { api, isInitialized } = useDatabase();
  
  return useMemo(() => ({
    isInitialized,
    getCustomData: isInitialized ? () => {
      return api.query('SELECT * FROM my_table');
    } : undefined,
  }), [api, isInitialized]);
}
```

#### Direct SQL Queries

```typescript
const { api } = useDatabase();

// SELECT query
const results = api.query('SELECT * FROM player WHERE active = ?', [true]);

// INSERT/UPDATE/DELETE
api.run('UPDATE player SET active = ? WHERE id = ?', [false, playerId]);
```

### Adding New Features

1. **Create Feature Component**

```typescript
// src/features/myfeature/MyFeature.tsx
export default function MyFeature() {
  // Component logic
}
```

2. **Add to Navigation**

```typescript
// src/app/nav.ts
export const navItems = [
  // ... existing items
  { id: "myfeature", label: "My Feature", icon: IconName },
];
```

3. **Update App Router**

```typescript
// src/App.tsx
const MyFeature = lazy(() => import("@/features/myfeature/MyFeature"));
// Add to routing logic
```

### Type Safety

All database operations are type-safe:

```typescript
// src/types/erp.ts
export interface PlayerData {
  name: string;
  position: string;
  active: boolean;
  aav: number;
}

// Use with type assertions
const players = data as PlayerData[];
```

---

## Deployment

### Deploy to Vercel

1. **Install Vercel CLI**

```bash
npm i -g vercel
```

2. **Build the project**

```bash
npm run build
```

3. **Deploy**

```bash
vercel deploy dist/
```

### Deploy to Netlify

1. **Build the project**

```bash
npm run build
```

2. **Drag and drop** Drag the `dist/` folder to Netlify's deployment area

### Deploy to GitHub Pages

1. **Install gh-pages**

```bash
npm install --save-dev gh-pages
```

2. **Add deploy script to package.json**

```json
"scripts": {
  "deploy": "npm run build && gh-pages -d dist"
}
```

3. **Deploy**

```bash
npm run deploy
```

---

## Browser Database Concepts

### How SQLite in the Browser Works

1. **WebAssembly Compilation**: SQLite (written in C) is compiled to WebAssembly
2. **WASM Loading**: Browser loads the `.wasm` file (binary format)
3. **JavaScript Interface**: sql.js provides JavaScript API to interact with SQLite
4. **Memory Management**: Database runs in browser's memory
5. **Persistence**: Database exported as Uint8Array and stored in localStorage

### localStorage Persistence

```javascript
// How data is saved
Database in Memory → export() → Uint8Array → Base64 → localStorage

// How data is loaded
localStorage → Base64 → Uint8Array → import() → Database in Memory
```

### Storage Limits

- **localStorage**: Typically 5-10MB per origin
- **Compression**: Base64 encoding adds ~33% overhead
- **Effective limit**: ~3-7MB of actual database data

---

## Known Limitations

### Technical Limitations

1. **Single User**: Each browser has its own isolated database
2. **Storage Size**: Limited by localStorage (5-10MB)
3. **No Real-time Sync**: Changes don't sync between devices/users
4. **Browser Dependent**: Clearing browser data loses everything
5. **No Concurrent Access**: Can't have multiple tabs editing simultaneously

### Business Limitations

1. **No Multi-tenant**: Can't share data between team members
2. **No Cloud Backup**: Manual export/import required
3. **No Mobile App**: Browser-only (though works on mobile browsers)
4. **No API Access**: Can't integrate with external services

### Performance Considerations

1. **Initial Load**: WASM file is ~500KB
2. **Memory Usage**: Entire database loads into memory
3. **Query Performance**: Generally fast, but large datasets may lag

---

## Troubleshooting

### Common Issues

#### Database Not Initializing

```javascript
// Check console for errors
// Clear localStorage and refresh
localStorage.clear();
location.reload();
```

#### WASM File Not Loading

```bash
# Verify file exists
ls public/sql-wasm.wasm

# Re-copy from node_modules
cp node_modules/sql.js/dist/sql-wasm.wasm public/
```

#### Data Not Persisting

```javascript
// Check localStorage quota
navigator.storage.estimate().then(estimate => {
  console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`);
});
```

#### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Debug Mode

Add debug logging to database operations:

```typescript
// src/lib/database.ts
console.log('Database operation:', sql, params);
```

### Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (14+)
- **Mobile browsers**: Full support

---

## Future Enhancement Ideas

### Potential Features

1. **Cloud Sync**: Add optional Supabase/Firebase sync
2. **PWA Support**: Make installable as desktop app
3. **Data Visualization**: Add charts for reports
4. **Import from CSV**: Bulk data import
5. **Audit Trail**: Track all database changes
6. **Multi-language**: i18n support

### Hybrid Architecture

```typescript
// Optional cloud backup
async function syncToCloud() {
  const backup = await exportDatabase();
  await fetch('/api/backup', { 
    method: 'POST', 
    body: backup 
  });
}
```

### Performance Optimizations

1. **Indexed DB**: For larger storage needs
2. **Web Workers**: Run queries in background
3. **Virtual Scrolling**: For large lists
4. **Query Caching**: Memoize expensive queries

---

## Conclusion

This Basketball Team ERP demonstrates the power of local-first architecture, providing a full-featured database application that runs entirely in the browser. It's perfect for small teams, prototypes, or privacy-conscious users who want complete control over their data.

The combination of React, TypeScript, and SQLite WebAssembly creates a powerful, type-safe, and performant application that requires zero backend infrastructure while still providing all the features of a traditional database-backed application.