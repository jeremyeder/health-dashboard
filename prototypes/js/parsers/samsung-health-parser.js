/**
 * Samsung Health Data Parser
 * Handles parsing of Samsung Health CSV exports and ZIP files
 */

class SamsungHealthParser {
    constructor() {
        this.fileTypeMap = {
            'sleep': ['com.samsung.shealth.sleep', 'com.samsung.shealth.sleep_combined'],
            'activity': ['com.samsung.shealth.tracker.pedometer', 'com.samsung.shealth.step_daily_trend', 'com.samsung.shealth.activity.day_summary'],
            'heart_rate': ['com.samsung.shealth.tracker.heart_rate'],
            'exercise': ['com.samsung.shealth.exercise'],
            'weight': ['com.samsung.health.weight'],
            'stress': ['com.samsung.shealth.stress'],
            'floors': ['com.samsung.health.floors_climbed'],
            'calories': ['com.samsung.shealth.calories_burned']
        };
    }

    async parseZip(zipFile) {
        // For now, we'll handle this as if the user extracted the files manually
        // In a real implementation, you'd use a library like JSZip
        throw new Error('Please extract the Samsung Health ZIP file and upload the individual CSV files');
    }

    async parseCSV(file) {
        const text = await this.readFileAsText(file);
        const fileName = file.name.toLowerCase();
        const dataType = this.identifyDataType(fileName);
        
        const records = this.parseCSVText(text, dataType);
        return {
            type: dataType,
            records: records,
            source: 'samsung-health'
        };
    }

    identifyDataType(fileName) {
        // Identify data type based on filename
        if (fileName.includes('sleep')) return 'sleep';
        if (fileName.includes('step') || fileName.includes('pedometer')) return 'activity';
        if (fileName.includes('heart_rate')) return 'vitals';
        if (fileName.includes('exercise')) return 'activity';
        if (fileName.includes('weight')) return 'vitals';
        if (fileName.includes('stress')) return 'vitals';
        if (fileName.includes('floors')) return 'activity';
        if (fileName.includes('calories')) return 'activity';
        if (fileName.includes('day_summary')) return 'activity';
        
        return 'activity'; // Default fallback
    }

    parseCSVText(text, dataType) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = this.parseCSVLine(lines[0]);
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length !== headers.length) continue;

            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index];
            });

            const processedRecord = this.processRecord(record, dataType);
            if (processedRecord) {
                records.push(processedRecord);
            }
        }

        return records;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    processRecord(record, dataType) {
        try {
            switch (dataType) {
                case 'sleep':
                    return this.processSleepRecord(record);
                case 'activity':
                    return this.processActivityRecord(record);
                case 'vitals':
                    return this.processVitalsRecord(record);
                default:
                    return this.processGenericRecord(record, dataType);
            }
        } catch (error) {
            console.warn('Error processing record:', error, record);
            return null;
        }
    }

    processSleepRecord(record) {
        const startTime = this.parseTimestamp(record.start_time || record.startTime);
        const endTime = this.parseTimestamp(record.end_time || record.endTime);
        
        if (!startTime) return null;

        const sleepRecord = {
            date: startTime.split('T')[0], // Date portion only
            startTime: startTime,
            endTime: endTime,
            duration: this.parseDuration(record.duration),
            efficiency: this.parseFloat(record.efficiency),
            sleepScore: this.parseFloat(record.sleep_score || record.sleepScore),
            deepSleep: this.parseDuration(record.deep_sleep || record.deepSleep),
            lightSleep: this.parseDuration(record.light_sleep || record.lightSleep),
            remSleep: this.parseDuration(record.rem_sleep || record.remSleep),
            awake: this.parseDuration(record.awake),
            source: 'samsung-health',
            type: 'sleep'
        };

        return sleepRecord;
    }

    processActivityRecord(record) {
        const date = this.parseDate(record.day || record.date || record.start_time);
        if (!date) return null;

        const activityRecord = {
            date: date,
            steps: this.parseInt(record.step_count || record.steps || record.count),
            distance: this.parseFloat(record.distance),
            calories: this.parseFloat(record.calorie || record.calories),
            activeMinutes: this.parseInt(record.active_time || record.activeMinutes),
            floors: this.parseInt(record.floor || record.floors_climbed),
            heartRate: this.parseFloat(record.heart_rate || record.hr_avg),
            source: 'samsung-health',
            type: 'daily-activity'
        };

        // Handle exercise records
        if (record.exercise_type || record.workout_type) {
            activityRecord.type = 'exercise';
            activityRecord.exerciseType = record.exercise_type || record.workout_type;
            activityRecord.duration = this.parseDuration(record.duration);
            activityRecord.startTime = this.parseTimestamp(record.start_time);
            activityRecord.endTime = this.parseTimestamp(record.end_time);
        }

        return activityRecord;
    }

    processVitalsRecord(record) {
        const date = this.parseDate(record.day || record.date || record.create_time);
        if (!date) return null;

        // Handle weight records
        if (record.weight) {
            return {
                date: date,
                type: 'weight',
                value: this.parseFloat(record.weight),
                unit: 'kg',
                bmi: this.parseFloat(record.bmi),
                bodyFat: this.parseFloat(record.body_fat_percentage),
                muscleMass: this.parseFloat(record.muscle_mass),
                source: 'samsung-health'
            };
        }

        // Handle heart rate records
        if (record.heart_rate || record.hr) {
            return {
                date: date,
                timestamp: this.parseTimestamp(record.create_time || record.timestamp),
                type: 'heart-rate',
                value: this.parseFloat(record.heart_rate || record.hr),
                unit: 'bpm',
                context: record.context || 'resting',
                source: 'samsung-health'
            };
        }

        // Handle stress records
        if (record.stress_level || record.stress) {
            return {
                date: date,
                timestamp: this.parseTimestamp(record.create_time || record.timestamp),
                type: 'stress',
                value: this.parseFloat(record.stress_level || record.stress),
                unit: 'level',
                source: 'samsung-health'
            };
        }

        return null;
    }

    processGenericRecord(record, dataType) {
        const date = this.parseDate(record.day || record.date || record.create_time || record.start_time);
        if (!date) return null;

        return {
            date: date,
            type: dataType,
            data: record,
            source: 'samsung-health'
        };
    }

    // Utility parsing methods
    parseTimestamp(timestampStr) {
        if (!timestampStr) return null;
        
        try {
            // Handle various timestamp formats
            let timestamp;
            
            if (timestampStr.includes(' ')) {
                // Format: "2023-01-15 10:30:00"
                timestamp = new Date(timestampStr.replace(' ', 'T'));
            } else if (timestampStr.includes('T')) {
                // ISO format
                timestamp = new Date(timestampStr);
            } else {
                // Unix timestamp (milliseconds)
                const num = parseInt(timestampStr);
                if (!isNaN(num)) {
                    timestamp = new Date(num);
                } else {
                    timestamp = new Date(timestampStr);
                }
            }

            return isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
        } catch (error) {
            return null;
        }
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        
        const timestamp = this.parseTimestamp(dateStr);
        if (timestamp) {
            return timestamp.split('T')[0]; // Return just the date portion
        }
        
        return null;
    }

    parseDuration(durationStr) {
        if (!durationStr) return 0;
        
        // Handle duration in different formats
        if (typeof durationStr === 'number') return durationStr;
        
        const str = durationStr.toString();
        
        // Handle milliseconds
        const num = parseInt(str);
        if (!isNaN(num)) {
            // If it's a large number, assume it's milliseconds
            if (num > 86400000) { // More than 24 hours in milliseconds
                return Math.floor(num / 60000); // Convert to minutes
            }
            return num;
        }
        
        // Handle "HH:MM:SS" format
        if (str.includes(':')) {
            const parts = str.split(':');
            let minutes = 0;
            
            if (parts.length === 3) {
                minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60;
            } else if (parts.length === 2) {
                minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            
            return Math.floor(minutes);
        }
        
        return 0;
    }

    parseFloat(valueStr) {
        if (valueStr === null || valueStr === undefined || valueStr === '') return null;
        const num = parseFloat(valueStr);
        return isNaN(num) ? null : num;
    }

    parseInt(valueStr) {
        if (valueStr === null || valueStr === undefined || valueStr === '') return null;
        const num = parseInt(valueStr);
        return isNaN(num) ? null : num;
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // Static method for easy access
    static async parseFile(file) {
        const parser = new SamsungHealthParser();
        return await parser.parseCSV(file);
    }
}

// Make available globally
window.SamsungHealthParser = SamsungHealthParser;