# Health Dashboard - Claude Code Instructions

## Project Overview

A comprehensive health data dashboard application that provides a privacy-first approach to managing personal health information. The system integrates multiple health data sources including Samsung Health exports, FHIR clinical records, and PDF lab results into a unified visualization platform.

## Architecture

### Core Architecture Principles
- **Privacy-First Design**: All data processing occurs client-side with no external API dependencies
- **Local Storage**: IndexedDB for persistent health data storage with 7 specialized object stores
- **Modular Parser System**: Dedicated parsers for Samsung Health (50+ CSV types), FHIR bundles, and PDF lab results
- **Prototype-Driven Development**: Desktop-optimized UI prototypes with glassmorphism design system

### Technology Stack
- **Frontend**: HTML5, Tailwind CSS, vanilla JavaScript
- **Charts**: Chart.js with custom health themes
- **File Processing**: JSZip for ZIP extraction, PDF.js for PDF text extraction
- **Storage**: Browser IndexedDB for local persistence
- **External CDN**: Tailwind CSS, Chart.js, JSZip, PDF.js (no custom backend required)

## Data Architecture

### IndexedDB Schema (7 Object Stores)

```javascript
// Object stores with indexes for efficient querying
vitals: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['date', 'type', 'dateType']
}
sleep: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['date', 'startTime'] 
}
activity: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['date', 'type', 'dateType']
}
medications: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['date', 'medicationName', 'status']
}
labResults: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['date', 'testType', 'dateTest']
}
providers: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['name', 'specialty']
}
encounters: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['date', 'providerId', 'dateProvider']
}
imports: {
  keyPath: 'id', autoIncrement: true,
  indexes: ['timestamp', 'fileType']
}
```

### Data Flow Pipeline

1. **File Upload**: Drag-and-drop interface in `data-management.html`
2. **File Detection**: Automatic detection of Samsung Health ZIP, FHIR JSON/ZIP, CSV, and PDF files
3. **Parsing**: Specialized parsers extract structured data:
   - `samsung-health-parser.js`: Handles 50+ Samsung Health CSV types from ZIP exports
   - `fhir-parser.js`: Processes FHIR bundles (Patient, Observation, Medication, Encounter, etc.)
   - `pdf-parser.js`: Extracts lab values using regex patterns (A1C, cholesterol, etc.)
4. **Processing**: `data-management.js` orchestrates parsing and validation
5. **Storage**: Records stored in appropriate IndexedDB object stores
6. **Visualization**: Dashboard prototypes query IndexedDB for chart rendering

## File Structure

### Core Application Files
```
prototypes/
├── data-management.html        # Main data import interface
├── index.html                 # Overview dashboard prototype
├── medications.html           # Medication timeline with change highlights
├── vitals.html               # Weight/BP/HR trends with forecasting
├── sleep.html                # Samsung Health sleep analytics
├── activity.html             # Steps/calories/exercise tracking
├── providers.html            # Healthcare provider directory
├── timeline.html             # 13-year comprehensive medical history
└── js/
    ├── indexeddb-manager.js       # Database operations & queries
    ├── data-management.js         # File upload & processing controller
    └── parsers/
        ├── samsung-health-parser.js  # Samsung Health CSV/ZIP processing
        ├── fhir-parser.js           # FHIR bundle & resource parsing
        └── pdf-parser.js            # PDF lab result text extraction
```

### Data Processing Components

**IndexedDB Manager** (`indexeddb-manager.js:6-264`)
- Database initialization with 7 object stores
- CRUD operations with batch insert support
- Helper methods for common queries (date ranges, current medications)
- Data export functionality

**Samsung Health Parser** (`samsung-health-parser.js:6-516`)  
- Processes ZIP files containing 50+ CSV types
- Handles sleep, activity, vitals (weight, heart rate), exercise data
- Maps Samsung Health field names to standardized schema
- Supports timestamp parsing and duration calculations

**FHIR Parser** (`fhir-parser.js:6-437`)
- Processes FHIR Bundle resources and individual resources
- Maps 10+ FHIR resource types (Patient, Observation, MedicationRequest, etc.)
- Extracts clinical data into standardized health records
- Handles LOINC/SNOMED code mapping

**PDF Parser** (`pdf-parser.js:6-317`)
- Uses PDF.js to extract text from lab result PDFs
- Regex-based extraction for 10+ lab value types (A1C, cholesterol panel, etc.)
- Date extraction from both content and filenames
- Confidence scoring for extracted values

## Key Features

### Health Data Integration
- **Samsung Health**: 6+ years of activity, sleep, biometric data (50+ data types)
- **FHIR Clinical**: 13+ years of medical records (161 observations, 70 encounters, 23 medications)
- **PDF Lab Results**: Automated text extraction with pattern matching
- **Real-time Processing**: Client-side file processing with progress indicators

### UI Prototypes
- **Modern Glassmorphism**: Health-focused color palette with smooth animations
- **Interactive Charts**: Chart.js visualizations with custom health themes
- **Desktop-Optimized**: Layouts leveraging full screen real estate
- **Data Privacy**: No external API calls, all processing client-side

### Data Management Features
- **Drag & Drop**: Multi-file upload with format detection
- **Processing Status**: Real-time progress tracking with file-by-file status
- **Data Preview**: Table previews before import with record counts
- **Import History**: Chronological record of all data imports
- **Data Export**: Complete health data export functionality

## Development Workflows

### Adding New Data Parsers
1. Create parser in `prototypes/js/parsers/[type]-parser.js`
2. Implement required methods: `parseFile(file)`, `parseZip(file)` if needed
3. Return standardized format: `{ type, records, source, metadata }`
4. Add file type detection to `data-management.js:detectFileType()`
5. Add parser case to `data-management.js:processFile()`

### Adding New Health Data Types
1. Add object store to `indexeddb-manager.js:createObjectStores()`
2. Add mapping in `data-management.js:mapDataTypeToStore()`
3. Update dashboard prototypes to query new data type
4. Add visualization components as needed

### UI Prototype Updates
1. All prototypes use Tailwind CSS with health-focused color palette
2. Chart.js configurations in individual HTML files
3. Sample data embedded in prototypes for realistic visualization
4. Responsive design with mobile-friendly breakpoints

## Testing Data Requirements

### Samsung Health Test Data
- ZIP file containing multiple CSV files (sleep, steps, heart_rate, etc.)
- Expected format: Samsung Health export with package info headers
- Sample data types: sleep duration, step counts, exercise sessions

### FHIR Test Data  
- JSON bundle with Bundle.entry array containing resources
- Resource types: Patient, Observation, MedicationRequest, Encounter
- Expected LOINC/SNOMED codes for proper categorization

### PDF Test Data
- Lab result PDFs with standard formatting
- Should contain: A1C values, cholesterol panel, dates
- File naming with date patterns for automatic date extraction

## Error Handling

### Parser Error Recovery
- Individual file parsing errors don't stop batch processing
- Detailed error messages with file-specific context
- Graceful degradation for malformed data
- Progress tracking continues despite individual failures

### Data Validation
- Type checking for numeric health values
- Date format validation and normalization
- Duplicate record detection and handling
- Missing field validation with sensible defaults

## Performance Considerations

### Client-Side Processing
- Large ZIP files processed incrementally with progress updates
- IndexedDB batch operations for efficient storage
- Memory management for large health datasets
- Progress indicators for long-running operations

### Data Querying
- Composite indexes for efficient date range queries
- Pagination support for large datasets
- Cached query results where appropriate
- Optimized chart data aggregation

## Security & Privacy

### Data Handling
- All health data remains on device (IndexedDB)
- No external API calls or data transmission
- Local file processing only
- User-controlled data import/export

### File Processing
- Safe PDF.js usage for text extraction
- ZIP file validation before processing
- Sanitized text extraction from all sources
- No code execution from uploaded files

---

*This system provides a comprehensive health data management solution with privacy-first design, supporting multiple data formats and providing rich visualization capabilities.*