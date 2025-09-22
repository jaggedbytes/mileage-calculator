# DIMO Build Developer Kit

## Overview

This is a Replit template for running an app that integrates [Login with DIMO](https://www.npmjs.com/package/@dimo-network/login-with-dimo) and [DIMO Data SDK](https://www.npmjs.com/package/@dimo-network/data-sdk).

## Quick Start

1. Remix this Replite Template
2. Update secrets with your own DIMO Developer License credentials, if you don't have these credentials, sign up on the [DIMO Developer Console](https://console.dimo.org):
  - Client ID: `DIMO_CLIENT_ID` & `VITE_DIMO_CLIENT_ID`
  - Redirect URI: `DIMO_REDIRECT_URI` & `VITE_DIMO_REDIRECT_URI`
  - API Key: `DIMO_API_KEY`

To access secrets, click on the 4 squares (`All tools`) on the left panel, scroll down to find `Secrets`:
![Instructions](https://github.com/DIMO-Network/dimo-developer-kit/blob/replit-agent/Replit_Instructions.png)

## Deployment Configuration

### Production Build Process
- **Build Script**: Custom `build-production.sh` script handles complete production build
- **Static File Serving**: Fixed file path mismatch between build output (`dist/public`) and server expectations (`server/public`)
- **Host Binding**: Server configured to bind to `0.0.0.0:5000` for proper interface access
- **Environment Detection**: Automatic switching between development (Vite HMR) and production (static file serving) modes

### Build Output Structure
```
├── dist/
│   ├── index.js          # Bundled server (ESBuild)
│   └── public/           # Client build output (Vite)
├── server/
│   └── public/           # Production static files location
```

### Deployment Requirements
- Node.js runtime environment
- Environment variable `NODE_ENV=production`
- Port configuration via `PORT` environment variable (defaults to 5000)
- Static files must be properly copied to `server/public` before starting production server

## Source
This template is based on the using DIMO's Developer SDKs. For more information, visit https://docs.dimo.org/developer-platform/developer-guide/dimo-developer-sdks
