# DIMO-Powered Mileage Calculator

![GitHub Repo stars](https://img.shields.io/github/stars/dimo-network/data-sdk?label=data-SDK)
![GitHub Repo stars](https://img.shields.io/github/stars/dimo-network/login-with-dimo?label=LoginWithDIMO)

## Overview

A comprehensive mileage tracking and expense management application powered by DIMO's decentralized vehicle data network. This application automatically detects trips using your vehicle's telemetry data, categorizes them for business use, and generates detailed CSV reports for tax and reimbursement purposes.

## Key Features

### 🚗 **Automatic Trip Detection**
- **Dual Detection Methods**: Uses ignition signals (primary) and GPS location data (fallback)
- **Smart Trip Segmentation**: Configurable parameters for minimum distance, stop duration, and time gaps
- **Real-time Data**: Fetches vehicle telemetry through DIMO's secure API with configurable intervals (300ms to 5 minutes)
- **Odometer Integration**: Captures precise odometer readings for maximum accuracy

### 📊 **Trip Management & Categorization**
- **Business/Personal Classification**: Easy categorization with visual badges
- **Trip Exclusion**: Exclude invalid trips from export reports
- **Custom Notes**: Add contextual notes to each trip (auto-saves on blur)
- **Interactive Maps**: Visualize trip routes with tap-to-activate mobile-friendly maps

### 📈 **Comprehensive Reporting**
- **CSV Export**: Detailed reports with trip data, distances, durations, and odometer readings
- **Unit Conversion**: Toggle between miles and kilometers
- **Date Range Filtering**: Flexible date selection for specific reporting periods
- **Tax-Ready Format**: Structured data perfect for tax deductions and expense management

### 🔐 **Secure Authentication**
- **DIMO Integration**: Two-tier authentication system (Developer JWT + Vehicle JWT)
- **Privacy-First**: All data remains under user control through DIMO's decentralized network
- **Vehicle Sharing**: Users grant permission to access specific vehicle data

## Technical Architecture

### **Frontend (React + Vite)**
- Modern React with TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- Leaflet.js for interactive maps
- Responsive design with mobile-first approach

### **Backend (Node.js + Express)**
- RESTful API endpoints
- DIMO Data SDK integration
- SQLite database for trip storage
- JWT-based authentication
- CSV generation and export

### **DIMO Integration**
- **Authentication**: OAuth flow with DIMO for user authorization
- **Telemetry Access**: Real-time vehicle data through DIMO's API
- **Data Signals**: Ignition status, GPS coordinates, speed, odometer readings
- **Privacy**: Decentralized data access with user consent

## Quick Start

### Prerequisites
- Node.js 18+ 
- DIMO Developer License credentials

### Environment Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables:
   ```bash
   # DIMO Developer Credentials
   DIMO_CLIENT_ID=your_client_id
   DIMO_DOMAIN=your_domain.com
   DIMO_PRIVATE_KEY=your_private_key
   
   # API Configuration
   DIMO_REDIRECT_URI=http://localhost:5000/
   VITE_DIMO_CLIENT_ID=your_client_id
   VITE_DIMO_REDIRECT_URI=http://localhost:5000/
   ```

### Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Usage

### 1. **Connect Your Vehicle**
- Sign in with DIMO
- Share your vehicle with the application
- Grant permission for telemetry data access

### 2. **Detect Trips**
- Select date range for trip detection
- Choose data collection interval (affects accuracy vs. performance)
- Click "Detect Trips" to analyze your driving data

### 3. **Categorize & Manage**
- Classify trips as Business, Personal, or Other
- Add custom notes to each trip
- Exclude invalid trips from reports
- View interactive maps of your routes

### 4. **Export Reports**
- Generate CSV reports for specific date ranges
- Choose between miles and kilometers
- Include odometer readings and trip details
- Perfect for tax deductions and expense reimbursement

## AI Enhancement Opportunities

This application provides a solid foundation for AI-powered improvements:

### **Smart Trip Classification**
- Machine learning models to automatically suggest business vs. personal trips
- Pattern recognition based on location, time, and driving behavior

### **Anomaly Detection**
- Identify unusual trip patterns or potential data errors
- Detect suspicious activity or unauthorized vehicle use

### **Predictive Analytics**
- Optimize trip routes and fuel efficiency
- Predict maintenance needs based on driving patterns

### **Contextual Intelligence**
- Auto-tag trips with specific business purposes
- Integrate with calendar data for enhanced context

## Tax & Expense Integration

### **Mileage Reimbursement**
- Accurate trip tracking for precise reimbursement calculations
- Business vs. personal trip separation
- Detailed reporting for accounting systems

### **Tax Deductions**
- Comprehensive records for vehicle expense deductions
- Depreciation calculations based on actual usage
- Regional compliance support for different tax jurisdictions

### **Fleet Management**
- Centralized tracking for multiple company vehicles
- Cost allocation and expense management
- Driver behavior analysis and optimization

## Deployment

### **Production Build**
```bash
# Build both client and server
npm run build

# Start production server
npm start
```

### **Environment Variables**
- `NODE_ENV=production`
- `PORT=5000` (or your preferred port)
- All DIMO credentials configured

## Contributing

This project demonstrates the power of DIMO's decentralized vehicle data network for practical business applications. Contributions are welcome for:

- Enhanced trip detection algorithms
- Additional export formats
- Mobile app development
- AI/ML integration
- Tax compliance features

## License

This project is built using DIMO's open-source developer tools and follows DIMO's terms of service for data access and usage.

## Support

For technical support or questions about DIMO integration, visit:
- [DIMO Developer Documentation](https://docs.dimo.org)
- [DIMO Developer Console](https://console.dimo.org)
- [DIMO Community Discord](https://discord.gg/dimo)