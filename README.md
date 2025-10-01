## Project Overview

** This project is still a work in progress **

**Basketball Team ERP** is a local-first, browser-based Enterprise Resource Planning system for managing basketball team operations. It runs entirely in the browser using SQLite compiled to WebAssembly, requiring no backend infrastructure.

### Key Characteristics

- **Zero Backend**: Entire application runs in the browser
- **Full SQL Database**: Complete SQLite implementation with joins, transactions, and complex queries
- **Persistent Storage**: Data saved to browser localStorage
- **Offline-First**: Works without internet connection
- **Privacy-Focused**: All data stays on user's device
- **Free Hosting**: Deployable as static files on Vercel, Netlify, or GitHub Pages

---

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
