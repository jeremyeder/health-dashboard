# Health Dashboard

A health monitoring dashboard application.

## Features

- **Privacy-First Design**: All data processing occurs client-side with IndexedDB storage
- **Multi-Format Support**: Samsung Health ZIP exports, FHIR bundles, PDF lab results
- **Comprehensive Dashboards**: 7 specialized health tracking interfaces
- **Real-Time Processing**: Drag-and-drop file import with live progress tracking

## Getting Started

### Development Setup
1. **Install dependencies**: `npm install` (for testing and linting)
2. **Start development server**: `npm start` (starts HTTP server on port 8000)
3. **Open in browser**: Navigate to `http://localhost:8000/app/`
4. **Import health data**: Use the Data Management page to upload your files

### Testing
- **Run all tests**: `npm test`
- **Run parser tests**: `npm run test:parsers`
- **Lint code**: `npm run lint`

## Roadmap

### High Priority ✅ COMPLETED
1. **✅ Connect processed data to dashboard visualizations** - Overview and Medications pages now use IndexedDB
2. **✅ Enhanced data validation and import history features** - Advanced validation in parsers  
3. **✅ Basic GitHub Actions CI with parser testing** - Full CI/CD pipeline with parser validation

### Future Features
4. Add support for user journaling with Todoist and Google Drive integration
5. Add mobile UI support
6. Additional health data sources (Apple Health, Fitbit, etc.)
