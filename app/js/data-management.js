/**
 * Data Management Controller
 * Handles file uploads, processing, and UI updates
 */

class DataManagementController {
    constructor() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.browseBtn = document.getElementById('browseBtn');
        this.processingSection = document.getElementById('processingSection');
        this.previewSection = document.getElementById('previewSection');
        this.importBtn = document.getElementById('importBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        this.processingFiles = new Map();
        this.previewData = new Map();
        
        this.initializeEventListeners();
        this.updateDataCounts();
        this.loadImportHistory();
    }

    initializeEventListeners() {
        // File input events
        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Drag and drop events
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Button events
        this.importBtn.addEventListener('click', () => this.importAllData());
        this.clearBtn.addEventListener('click', () => this.clearPreview());
    }

    async handleFiles(files) {
        if (files.length === 0) return;

        this.showProcessingSection();
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            await this.processFile(file);
        }

        this.showPreviewSection();
    }

    showProcessingSection() {
        this.processingSection.classList.remove('hidden');
    }

    showPreviewSection() {
        this.previewSection.classList.remove('hidden');
        this.importBtn.disabled = this.previewData.size === 0;
    }

    async processFile(file) {
        const fileId = this.generateFileId(file);
        const processingItem = this.createProcessingItem(file, fileId);
        
        try {
            this.updateProcessingStatus(fileId, 'processing', 'Processing file...');
            
            const fileType = this.detectFileType(file);
            let parsedData = null;

            switch (fileType) {
                case 'samsung-health-zip':
                    parsedData = await this.processSamsungHealthZip(file);
                    break;
                case 'fhir-zip':
                    parsedData = await this.processFHIRZip(file);
                    break;
                case 'fhir-json':
                    parsedData = await this.processFHIRJson(file);
                    break;
                case 'csv':
                    parsedData = await this.processCSV(file);
                    break;
                case 'pdf':
                    parsedData = await this.processPDF(file);
                    break;
                default:
                    throw new Error('Unsupported file type');
            }

            if (parsedData && parsedData.records && parsedData.records.length > 0) {
                this.previewData.set(fileId, {
                    file: file,
                    type: fileType,
                    data: parsedData,
                    recordCount: parsedData.records.length
                });

                this.updateProcessingStatus(fileId, 'completed', `Found ${parsedData.records.length} records`);
                this.updatePreviewTables();
            } else {
                this.updateProcessingStatus(fileId, 'warning', 'No records found in file');
            }

        } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            this.updateProcessingStatus(fileId, 'error', `Error: ${error.message}`);
        }
    }

    generateFileId(file) {
        return `${file.name}_${file.size}_${file.lastModified}`.replace(/[^a-zA-Z0-9]/g, '_');
    }

    createProcessingItem(file, fileId) {
        const listContainer = document.getElementById('fileProcessingList');
        const item = document.createElement('div');
        item.id = `processing-${fileId}`;
        item.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
        
        item.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                </div>
                <div>
                    <p class="font-medium text-gray-900">${file.name}</p>
                    <p class="text-sm text-gray-500">${this.formatFileSize(file.size)} • ${this.detectFileType(file)}</p>
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <div class="processing-spinner hidden">
                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
                <span class="processing-status text-sm text-gray-600">Waiting...</span>
            </div>
        `;

        listContainer.appendChild(item);
        return item;
    }

    updateProcessingStatus(fileId, status, message) {
        const item = document.getElementById(`processing-${fileId}`);
        if (!item) return;

        const spinner = item.querySelector('.processing-spinner');
        const statusText = item.querySelector('.processing-status');

        spinner.classList.toggle('hidden', status !== 'processing');
        statusText.textContent = message;

        // Update status styling
        statusText.className = `processing-status text-sm ${this.getStatusColor(status)}`;
    }

    getStatusColor(status) {
        switch (status) {
            case 'processing': return 'text-blue-600';
            case 'completed': return 'text-green-600';
            case 'warning': return 'text-amber-600';
            case 'error': return 'text-red-600';
            default: return 'text-gray-600';
        }
    }

    detectFileType(file) {
        const name = file.name.toLowerCase();
        const extension = name.split('.').pop();

        if (extension === 'zip' && name.includes('samsung')) {
            return 'samsung-health-zip';
        } else if (extension === 'zip' && (name.includes('fhir') || name.includes('allpatientdata') || name.includes('patient'))) {
            return 'fhir-zip';
        } else if (extension === 'json' && name.includes('fhir')) {
            return 'fhir-json';
        } else if (extension === 'json') {
            return 'fhir-json'; // Assume JSON files are FHIR
        } else if (extension === 'csv') {
            return 'csv';
        } else if (extension === 'pdf') {
            return 'pdf';
        } else {
            return 'unknown';
        }
    }

    async processSamsungHealthZip(file) {
        console.log('processSamsungHealthZip called with file:', file.name);
        console.log('window.SamsungHealthParser exists:', !!window.SamsungHealthParser);
        console.log('SamsungHealthParser methods:', window.SamsungHealthParser ? Object.getOwnPropertyNames(window.SamsungHealthParser.prototype) : 'No parser');
        console.log('parseZip method type:', window.SamsungHealthParser ? typeof window.SamsungHealthParser.prototype.parseZip : 'No parser');
        
        if (!window.SamsungHealthParser) {
            throw new Error('Samsung Health parser not available');
        }

        if (typeof window.SamsungHealthParser.prototype.parseZip !== 'function') {
            throw new Error('parseZip method not found in Samsung Health parser');
        }

        const fileId = this.generateFileId(file);
        
        try {
            // Update status to show ZIP extraction
            this.updateProcessingStatus(fileId, 'processing', 'Extracting ZIP file...');
            
            // Create an instance of the parser and call parseZip
            const parser = new window.SamsungHealthParser();
            const result = await parser.parseZip(file);
            
            // Show detailed results
            const recordsByType = result.metadata?.recordsByType || {};
            const typeCount = Object.keys(recordsByType).length;
            const totalRecords = result.records?.length || 0;
            
            this.updateProcessingStatus(fileId, 'processing', 
                `Processed ${result.metadata?.processedFiles?.length || 0} CSV files, found ${totalRecords} records across ${typeCount} data types`
            );
            
            return result;
            
        } catch (error) {
            this.updateProcessingStatus(fileId, 'error', `ZIP processing failed: ${error.message}`);
            throw error;
        }
    }

    async processFHIRZip(file) {
        console.log('processFHIRZip called with file:', file.name);
        
        if (!window.FHIRParser) {
            throw new Error('FHIR parser not available');
        }

        const fileId = this.generateFileId(file);
        
        try {
            this.updateProcessingStatus(fileId, 'processing', 'Extracting FHIR ZIP file...');
            
            // Read the ZIP file as array buffer
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            
            // Load the ZIP file with JSZip
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            let fhirData = null;
            let processedFiles = 0;
            let totalFiles = 0;

            // Count JSON files first
            zip.forEach((relativePath, zipEntry) => {
                if (relativePath.endsWith('.json') && !zipEntry.dir) {
                    totalFiles++;
                }
            });

            console.log(`Found ${totalFiles} JSON files in FHIR ZIP`);
            this.updateProcessingStatus(fileId, 'processing', `Found ${totalFiles} JSON files, processing...`);

            // Look for the main FHIR bundle file (usually the largest JSON file)
            for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                if (relativePath.endsWith('.json') && !zipEntry.dir) {
                    try {
                        console.log(`Processing FHIR file: ${relativePath}`);
                        
                        // Extract the JSON content
                        const jsonContent = await zipEntry.async('text');
                        const jsonData = JSON.parse(jsonContent);
                        
                        // Check if this looks like a FHIR bundle
                        if (jsonData.resourceType === 'Bundle' || jsonData.entry) {
                            console.log(`Found FHIR bundle in ${relativePath} with ${jsonData.entry?.length || 0} entries`);
                            fhirData = jsonData;
                            break; // Use the first valid FHIR bundle found
                        } else {
                            console.log(`${relativePath} doesn't appear to be a FHIR bundle`);
                        }
                        
                        processedFiles++;
                        
                    } catch (error) {
                        console.warn(`Error processing ${relativePath}:`, error);
                    }
                }
            }

            if (!fhirData) {
                throw new Error('No valid FHIR bundle found in ZIP file');
            }

            // Parse the FHIR data using the existing parser
            const parser = new window.FHIRParser();
            const result = await parser.parseFHIRBundle(fhirData);
            
            // Add metadata about the ZIP processing
            result.metadata = {
                ...result.metadata,
                originalZip: file.name,
                totalFilesInZip: totalFiles,
                processedFiles: processedFiles
            };

            this.updateProcessingStatus(fileId, 'processing', 
                `Extracted FHIR bundle with ${result.records?.length || 0} resources`
            );
            
            return result;
            
        } catch (error) {
            this.updateProcessingStatus(fileId, 'error', `FHIR ZIP processing failed: ${error.message}`);
            throw error;
        }
    }

    async processFHIRJson(file) {
        // This will be implemented in the FHIR parser
        if (window.FHIRParser) {
            return await window.FHIRParser.parseFile(file);
        }
        throw new Error('FHIR parser not available');
    }

    async processCSV(file) {
        const text = await this.readFileAsText(file);
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        
        // Basic CSV parsing - determine type based on headers
        if (headers.includes('medication') || headers.includes('drug')) {
            return { type: 'medications', records: this.parseGenericCSV(lines) };
        } else if (headers.includes('weight') || headers.includes('bp')) {
            return { type: 'vitals', records: this.parseGenericCSV(lines) };
        } else {
            return { type: 'activity', records: this.parseGenericCSV(lines) };
        }
    }

    async processPDF(file) {
        // This will be implemented in the PDF parser
        if (window.PDFParser) {
            return await window.PDFParser.parseFile(file);
        }
        throw new Error('PDF parser not available');
    }

    parseGenericCSV(lines) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const record = {};

            headers.forEach((header, index) => {
                record[header] = values[index] || '';
            });

            records.push(record);
        }

        return records;
    }

    updatePreviewTables() {
        const container = document.getElementById('previewTables');
        container.innerHTML = '';

        this.previewData.forEach((data, fileId) => {
            const table = this.createPreviewTable(data);
            container.appendChild(table);
        });
    }

    createPreviewTable(data) {
        const wrapper = document.createElement('div');
        wrapper.className = 'bg-gray-50 rounded-lg p-4 mb-4';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-4';
        
        // Enhanced header for Samsung Health exports
        let headerContent = `
            <div>
                <h4 class="font-medium text-gray-900">${data.file.name}</h4>
                <p class="text-sm text-gray-600">${data.recordCount} records • ${data.type}</p>`;
        
        // Add breakdown for Samsung Health ZIP files
        if (data.type === 'samsung-health-export' && data.data.metadata?.recordsByType) {
            const typeBreakdown = Object.entries(data.data.metadata.recordsByType)
                .map(([type, count]) => `${type}: ${count}`)
                .join(', ');
            headerContent += `
                <p class="text-xs text-gray-500 mt-1">Types: ${typeBreakdown}</p>`;
        }
        
        headerContent += `
            </div>
            <div class="text-sm text-green-600">Ready to import</div>
        `;
        
        header.innerHTML = headerContent;

        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'min-w-full table-auto text-sm';

        // Create table header
        if (data.data.records && data.data.records.length > 0) {
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-gray-100';

            const firstRecord = data.data.records[0];
            Object.keys(firstRecord).slice(0, 6).forEach(key => { // Show only first 6 columns
                const th = document.createElement('th');
                th.className = 'px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider';
                th.textContent = key;
                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Create table body (show first 5 rows)
            const tbody = document.createElement('tbody');
            tbody.className = 'bg-white divide-y divide-gray-200';

            data.data.records.slice(0, 5).forEach(record => {
                const row = document.createElement('tr');
                Object.keys(firstRecord).slice(0, 6).forEach(key => {
                    const td = document.createElement('td');
                    td.className = 'px-3 py-2 whitespace-nowrap text-gray-900';
                    td.textContent = this.truncateText(record[key], 30);
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
        }

        tableContainer.appendChild(table);
        wrapper.appendChild(header);
        wrapper.appendChild(tableContainer);

        return wrapper;
    }

    async importAllData() {
        this.importBtn.disabled = true;
        this.importBtn.textContent = 'Importing...';

        try {
            let totalImported = 0;

            for (const [fileId, data] of this.previewData) {
                // Handle Samsung Health exports with multiple data types
                if (data.type === 'samsung-health-export' && data.data.metadata?.recordsByType) {
                    // Group records by their individual types
                    const recordsByType = this.groupRecordsByActualType(data.data.records);
                    
                    for (const [recordType, typeRecords] of Object.entries(recordsByType)) {
                        const storeName = this.mapDataTypeToStore(recordType);
                        const processedRecords = this.preprocessRecords(typeRecords, recordType);
                        
                        await window.dbManager.addRecords(storeName, processedRecords);
                        totalImported += processedRecords.length;
                    }
                    
                    // Record the import with combined statistics
                    await window.dbManager.recordImport(data.type, data.file.name, data.data.records.length);
                } else {
                    // Handle single-type datasets normally
                    const storeName = this.mapDataTypeToStore(data.type);
                    const processedRecords = this.preprocessRecords(data.data.records, data.type);
                    
                    await window.dbManager.addRecords(storeName, processedRecords);
                    await window.dbManager.recordImport(data.type, data.file.name, processedRecords.length);
                    
                    totalImported += processedRecords.length;
                }
            }

            // Update UI
            await this.updateDataCounts();
            await this.loadImportHistory();
            this.clearPreview();

            // Show success message
            this.showSuccessMessage(`Successfully imported ${totalImported} records from ${this.previewData.size} files`);

        } catch (error) {
            console.error('Import error:', error);
            this.showErrorMessage(`Import failed: ${error.message}`);
        } finally {
            this.importBtn.disabled = false;
            this.importBtn.textContent = 'Import All Data';
        }
    }

    mapDataTypeToStore(dataType) {
        const mapping = {
            'vitals': 'vitals',
            'sleep': 'sleep',
            'activity': 'activity',
            'medications': 'medications',
            'lab-results': 'labResults',
            'providers': 'providers',
            'encounters': 'encounters',
            'samsung-health-export': 'activity', // Default for Samsung Health, will be sorted by record type
            'fhir-bundle': 'encounters' // Default for FHIR, will be sorted by resource type
        };
        return mapping[dataType] || 'vitals';
    }

    groupRecordsByActualType(records) {
        const grouped = {};
        records.forEach(record => {
            const type = record.type || 'activity'; // Default to activity for Samsung Health
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(record);
        });
        return grouped;
    }

    preprocessRecords(records, dataType) {
        return records.map(record => {
            // Add timestamp if not present
            if (!record.date && !record.timestamp) {
                record.date = new Date().toISOString();
            }

            // Ensure date is in ISO format
            if (record.date && typeof record.date === 'string') {
                try {
                    record.date = new Date(record.date).toISOString();
                } catch (e) {
                    record.date = new Date().toISOString();
                }
            }

            // Add data type
            record.dataType = dataType;
            record.importDate = new Date().toISOString();

            return record;
        });
    }

    clearPreview() {
        this.previewData.clear();
        this.processingSection.classList.add('hidden');
        this.previewSection.classList.add('hidden');
        document.getElementById('fileProcessingList').innerHTML = '';
        document.getElementById('previewTables').innerHTML = '';
        this.fileInput.value = '';
    }

    async updateDataCounts() {
        try {
            const samsungCount = await window.dbManager.getRecordCount('activity') + 
                               await window.dbManager.getRecordCount('sleep');
            const fhirCount = await window.dbManager.getRecordCount('encounters') +
                             await window.dbManager.getRecordCount('medications') +
                             await window.dbManager.getRecordCount('providers');
            const labCount = await window.dbManager.getRecordCount('labResults');
            
            document.getElementById('samsung-count').textContent = samsungCount.toLocaleString();
            document.getElementById('fhir-count').textContent = fhirCount.toLocaleString();
            document.getElementById('lab-count').textContent = labCount.toLocaleString();

            // Update last import time
            const importHistory = await window.dbManager.getImportHistory();
            if (importHistory.length > 0) {
                const lastImport = new Date(importHistory[0].timestamp);
                document.getElementById('last-import').textContent = this.formatRelativeTime(lastImport);
            }

        } catch (error) {
            console.error('Error updating data counts:', error);
        }
    }

    async loadImportHistory() {
        try {
            const history = await window.dbManager.getImportHistory();
            const container = document.getElementById('importHistory');

            if (history.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        No imports yet. Upload your health data to get started.
                    </div>
                `;
                return;
            }

            container.innerHTML = history.slice(0, 10).map(item => `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                        <p class="font-medium text-gray-900">${item.fileName}</p>
                        <p class="text-sm text-gray-600">${item.recordsImported} records • ${item.fileType}</p>
                    </div>
                    <div class="text-sm text-gray-500">
                        ${this.formatRelativeTime(new Date(item.timestamp))}
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading import history:', error);
        }
    }

    // Utility methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return date.toLocaleDateString();
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.toString().length <= maxLength) return text;
        return text.toString().substring(0, maxLength) + '...';
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    showSuccessMessage(message) {
        // You could implement a toast notification here
        alert(message); // Temporary implementation
    }

    showErrorMessage(message) {
        // You could implement a toast notification here
        alert(message); // Temporary implementation
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.dbManager.init();
        new DataManagementController();
    } catch (error) {
        console.error('Failed to initialize data management:', error);
    }
});