/**
 * IndexedDB Manager for Health Dashboard
 * Handles all database operations for health data storage
 */

class IndexedDBManager {
    constructor() {
        this.dbName = 'HealthDashboard';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
            };
        });
    }

    createObjectStores(db) {
        // Vitals store (weight, blood pressure, heart rate)
        if (!db.objectStoreNames.contains('vitals')) {
            const vitalsStore = db.createObjectStore('vitals', { keyPath: 'id', autoIncrement: true });
            vitalsStore.createIndex('date', 'date', { unique: false });
            vitalsStore.createIndex('type', 'type', { unique: false });
            vitalsStore.createIndex('dateType', ['date', 'type'], { unique: false });
        }

        // Sleep data from Samsung Health
        if (!db.objectStoreNames.contains('sleep')) {
            const sleepStore = db.createObjectStore('sleep', { keyPath: 'id', autoIncrement: true });
            sleepStore.createIndex('date', 'date', { unique: false });
            sleepStore.createIndex('startTime', 'startTime', { unique: false });
        }

        // Activity data (steps, calories, exercise)
        if (!db.objectStoreNames.contains('activity')) {
            const activityStore = db.createObjectStore('activity', { keyPath: 'id', autoIncrement: true });
            activityStore.createIndex('date', 'date', { unique: false });
            activityStore.createIndex('type', 'type', { unique: false });
            activityStore.createIndex('dateType', ['date', 'type'], { unique: false });
        }

        // Medications from FHIR and tracking data
        if (!db.objectStoreNames.contains('medications')) {
            const medicationsStore = db.createObjectStore('medications', { keyPath: 'id', autoIncrement: true });
            medicationsStore.createIndex('date', 'date', { unique: false });
            medicationsStore.createIndex('medicationName', 'medicationName', { unique: false });
            medicationsStore.createIndex('status', 'status', { unique: false });
        }

        // Lab results from FHIR and PDFs
        if (!db.objectStoreNames.contains('labResults')) {
            const labStore = db.createObjectStore('labResults', { keyPath: 'id', autoIncrement: true });
            labStore.createIndex('date', 'date', { unique: false });
            labStore.createIndex('testType', 'testType', { unique: false });
            labStore.createIndex('dateTest', ['date', 'testType'], { unique: false });
        }

        // Healthcare providers from FHIR
        if (!db.objectStoreNames.contains('providers')) {
            const providersStore = db.createObjectStore('providers', { keyPath: 'id', autoIncrement: true });
            providersStore.createIndex('name', 'name', { unique: false });
            providersStore.createIndex('specialty', 'specialty', { unique: false });
        }

        // Medical encounters/visits from FHIR
        if (!db.objectStoreNames.contains('encounters')) {
            const encountersStore = db.createObjectStore('encounters', { keyPath: 'id', autoIncrement: true });
            encountersStore.createIndex('date', 'date', { unique: false });
            encountersStore.createIndex('providerId', 'providerId', { unique: false });
            encountersStore.createIndex('dateProvider', ['date', 'providerId'], { unique: false });
        }

        // Import metadata
        if (!db.objectStoreNames.contains('imports')) {
            const importsStore = db.createObjectStore('imports', { keyPath: 'id', autoIncrement: true });
            importsStore.createIndex('timestamp', 'timestamp', { unique: false });
            importsStore.createIndex('fileType', 'fileType', { unique: false });
        }
    }

    async addRecord(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addRecords(storeName, records) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const results = [];
            let completed = 0;

            if (records.length === 0) {
                resolve([]);
                return;
            }

            records.forEach((record, index) => {
                const request = store.add(record);
                request.onsuccess = () => {
                    results[index] = request.result;
                    completed++;
                    if (completed === records.length) {
                        resolve(results);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    async getRecords(storeName, indexName = null, query = null, limit = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const results = [];

            let cursor;
            if (indexName && query) {
                const index = store.index(indexName);
                cursor = index.openCursor(query);
            } else {
                cursor = store.openCursor();
            }

            cursor.onsuccess = (event) => {
                const result = event.target.result;
                if (result && (!limit || results.length < limit)) {
                    results.push(result.value);
                    result.continue();
                } else {
                    resolve(results);
                }
            };

            cursor.onerror = () => reject(cursor.error);
        });
    }

    async getRecordsByDateRange(storeName, startDate, endDate) {
        const range = IDBKeyRange.bound(startDate, endDate);
        return this.getRecords(storeName, 'date', range);
    }

    async getRecordCount(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteDatabase() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Helper methods for common queries
    async getLatestVitals(type, limit = 10) {
        const records = await this.getRecords('vitals', 'dateType', IDBKeyRange.bound([new Date('1900-01-01'), type], [new Date(), type]));
        return records.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
    }

    async getActivityByDateRange(startDate, endDate, type = null) {
        let records;
        if (type) {
            const range = IDBKeyRange.bound([startDate, type], [endDate, type]);
            records = await this.getRecords('activity', 'dateType', range);
        } else {
            records = await this.getRecordsByDateRange('activity', startDate, endDate);
        }
        return records.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    async getSleepByDateRange(startDate, endDate) {
        const records = await this.getRecordsByDateRange('sleep', startDate, endDate);
        return records.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    async getCurrentMedications() {
        const records = await this.getRecords('medications', 'status', 'active');
        return records.sort((a, b) => a.medicationName.localeCompare(b.medicationName));
    }

    async getImportHistory() {
        const records = await this.getRecords('imports');
        return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    async recordImport(fileType, fileName, recordsImported) {
        const importRecord = {
            timestamp: new Date().toISOString(),
            fileType,
            fileName,
            recordsImported,
            status: 'completed'
        };
        return this.addRecord('imports', importRecord);
    }

    // Data export functionality
    async exportAllData() {
        const stores = ['vitals', 'sleep', 'activity', 'medications', 'labResults', 'providers', 'encounters'];
        const exportData = {};

        for (const store of stores) {
            exportData[store] = await this.getRecords(store);
        }

        exportData.metadata = {
            exportDate: new Date().toISOString(),
            version: this.dbVersion,
            recordCounts: {}
        };

        for (const store of stores) {
            exportData.metadata.recordCounts[store] = exportData[store].length;
        }

        return exportData;
    }
}

// Global instance
window.dbManager = new IndexedDBManager();