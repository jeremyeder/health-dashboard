/**
 * PDF Parser for Lab Results and Medical Documents
 * Uses PDF.js to extract text and identify lab values
 */

class PDFParser {
    constructor() {
        this.labPatterns = {
            'hemoglobin-a1c': [
                /(?:A1C|HbA1c|Hemoglobin A1c)[\s:]*([0-9]+\.?[0-9]*)\s*%?/gi,
                /A1C[\s\S]*?([0-9]+\.[0-9]+)%/gi
            ],
            'total-cholesterol': [
                /(?:Total Cholesterol|CHOL)[\s:]*([0-9]+)\s*(?:mg\/dL|mg\/dl)/gi,
                /Cholesterol[\s\S]*?([0-9]+)\s*mg\/dL/gi
            ],
            'ldl-cholesterol': [
                /(?:LDL|Low Density Lipoprotein)[\s:]*([0-9]+)\s*(?:mg\/dL|mg\/dl)/gi,
                /LDL[\s\S]*?([0-9]+)\s*mg\/dL/gi
            ],
            'hdl-cholesterol': [
                /(?:HDL|High Density Lipoprotein)[\s:]*([0-9]+)\s*(?:mg\/dL|mg\/dl)/gi,
                /HDL[\s\S]*?([0-9]+)\s*mg\/dL/gi
            ],
            'triglycerides': [
                /(?:Triglycerides|TRIG)[\s:]*([0-9]+)\s*(?:mg\/dL|mg\/dl)/gi,
                /Triglycerides[\s\S]*?([0-9]+)\s*mg\/dL/gi
            ],
            'glucose': [
                /(?:Glucose|GLU)[\s:]*([0-9]+)\s*(?:mg\/dL|mg\/dl)/gi,
                /Glucose[\s\S]*?([0-9]+)\s*mg\/dL/gi
            ],
            'creatinine': [
                /(?:Creatinine|CREAT)[\s:]*([0-9]+\.?[0-9]*)\s*(?:mg\/dL|mg\/dl)/gi
            ],
            'bun': [
                /(?:BUN|Blood Urea Nitrogen)[\s:]*([0-9]+)\s*(?:mg\/dL|mg\/dl)/gi
            ],
            'weight': [
                /(?:Weight|Wt)[\s:]*([0-9]+\.?[0-9]*)\s*(?:lbs?|kg)/gi,
                /Weight[\s\S]*?([0-9]+\.?[0-9]*)\s*(?:lbs?|kg)/gi
            ],
            'blood-pressure': [
                /(?:BP|Blood Pressure)[\s:]*([0-9]+)\/([0-9]+)/gi,
                /([0-9]+)\/([0-9]+)\s*(?:mmHg|mm Hg)/gi
            ],
            'heart-rate': [
                /(?:HR|Heart Rate|Pulse)[\s:]*([0-9]+)\s*(?:bpm|BPM)?/gi
            ]
        };

        this.datePatterns = [
            /([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})/g, // MM/DD/YYYY
            /([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})/g,   // YYYY-MM-DD
            /([A-Za-z]{3,9})\s+([0-9]{1,2}),?\s+([0-9]{4})/g, // Month DD, YYYY
        ];
    }

    async parseFile(file) {
        try {
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            const pageTexts = [];

            // Extract text from all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                pageTexts.push(pageText);
                fullText += pageText + ' ';
            }

            // Extract lab values and create records
            const records = this.extractLabValues(fullText, file.name);
            
            return {
                type: 'pdf-lab-results',
                records: records,
                source: 'pdf',
                metadata: {
                    fileName: file.name,
                    pageCount: pdf.numPages,
                    extractedText: fullText.substring(0, 1000) // First 1000 chars for preview
                }
            };

        } catch (error) {
            console.error('PDF parsing error:', error);
            throw new Error(`Failed to parse PDF: ${error.message}`);
        }
    }

    extractLabValues(text, fileName) {
        const records = [];
        const extractedDate = this.extractDate(text, fileName);

        // Extract each type of lab value
        Object.entries(this.labPatterns).forEach(([testType, patterns]) => {
            patterns.forEach(pattern => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                    let value, unit, systolic, diastolic;

                    if (testType === 'blood-pressure') {
                        // Special handling for blood pressure (two values)
                        systolic = parseFloat(match[1]);
                        diastolic = parseFloat(match[2]);
                        if (!isNaN(systolic) && !isNaN(diastolic)) {
                            records.push({
                                date: extractedDate,
                                type: 'systolic-bp',
                                testType: 'Blood Pressure (Systolic)',
                                value: systolic,
                                unit: 'mmHg',
                                source: 'pdf',
                                fileName: fileName,
                                confidence: this.calculateConfidence(match[0], testType)
                            });
                            records.push({
                                date: extractedDate,
                                type: 'diastolic-bp',
                                testType: 'Blood Pressure (Diastolic)',
                                value: diastolic,
                                unit: 'mmHg',
                                source: 'pdf',
                                fileName: fileName,
                                confidence: this.calculateConfidence(match[0], testType)
                            });
                        }
                    } else {
                        // Single value tests
                        value = parseFloat(match[1]);
                        if (!isNaN(value)) {
                            // Determine unit based on test type
                            unit = this.getUnitForTestType(testType, match[0]);
                            
                            records.push({
                                date: extractedDate,
                                type: testType,
                                testType: this.getDisplayName(testType),
                                value: value,
                                unit: unit,
                                source: 'pdf',
                                fileName: fileName,
                                matchedText: match[0],
                                confidence: this.calculateConfidence(match[0], testType)
                            });
                        }
                    }
                });
            });
        });

        // Remove duplicates (same test type, same value)
        const uniqueRecords = records.filter((record, index, self) =>
            index === self.findIndex(r => 
                r.type === record.type && 
                r.value === record.value &&
                r.date === record.date
            )
        );

        // Sort by confidence score
        return uniqueRecords.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }

    extractDate(text, fileName) {
        // Try to extract date from the text first
        for (const pattern of this.datePatterns) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                const match = matches[0];
                let date;

                if (pattern.source.includes('([A-Za-z]')) {
                    // Month name format
                    date = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
                } else if (pattern.source.includes('([0-9]{4})')) {
                    // YYYY-MM-DD format
                    date = new Date(`${match[1]}-${match[2]}-${match[3]}`);
                } else {
                    // MM/DD/YYYY format
                    date = new Date(`${match[3]}-${match[1]}-${match[2]}`);
                }

                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }

        // Try to extract date from filename
        const fileNameDate = this.extractDateFromFileName(fileName);
        if (fileNameDate) return fileNameDate;

        // Default to today
        return new Date().toISOString().split('T')[0];
    }

    extractDateFromFileName(fileName) {
        // Look for dates in various formats in the filename
        const patterns = [
            /([0-9]{4})[-_]([0-9]{1,2})[-_]([0-9]{1,2})/,  // YYYY-MM-DD or YYYY_MM_DD
            /([0-9]{1,2})[-_]([0-9]{1,2})[-_]([0-9]{4})/,  // MM-DD-YYYY or MM_DD_YYYY
            /([0-9]{8})/,  // YYYYMMDD
        ];

        for (const pattern of patterns) {
            const match = fileName.match(pattern);
            if (match) {
                let date;
                if (match[0].length === 8 && !match[0].includes('-') && !match[0].includes('_')) {
                    // YYYYMMDD format
                    const year = match[0].substring(0, 4);
                    const month = match[0].substring(4, 6);
                    const day = match[0].substring(6, 8);
                    date = new Date(`${year}-${month}-${day}`);
                } else if (match[1].length === 4) {
                    // YYYY-MM-DD format
                    date = new Date(`${match[1]}-${match[2]}-${match[3]}`);
                } else {
                    // MM-DD-YYYY format
                    date = new Date(`${match[3]}-${match[1]}-${match[2]}`);
                }

                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }

        return null;
    }

    getUnitForTestType(testType, matchText) {
        const unitMap = {
            'hemoglobin-a1c': '%',
            'total-cholesterol': 'mg/dL',
            'ldl-cholesterol': 'mg/dL',
            'hdl-cholesterol': 'mg/dL',
            'triglycerides': 'mg/dL',
            'glucose': 'mg/dL',
            'creatinine': 'mg/dL',
            'bun': 'mg/dL',
            'weight': this.extractWeightUnit(matchText),
            'heart-rate': 'bpm'
        };

        return unitMap[testType] || '';
    }

    extractWeightUnit(text) {
        if (text.toLowerCase().includes('kg')) return 'kg';
        if (text.toLowerCase().includes('lb')) return 'lbs';
        return 'lbs'; // Default to lbs
    }

    getDisplayName(testType) {
        const displayNames = {
            'hemoglobin-a1c': 'Hemoglobin A1C',
            'total-cholesterol': 'Total Cholesterol',
            'ldl-cholesterol': 'LDL Cholesterol',
            'hdl-cholesterol': 'HDL Cholesterol',
            'triglycerides': 'Triglycerides',
            'glucose': 'Glucose',
            'creatinine': 'Creatinine',
            'bun': 'Blood Urea Nitrogen',
            'weight': 'Weight',
            'heart-rate': 'Heart Rate'
        };

        return displayNames[testType] || testType;
    }

    calculateConfidence(matchedText, testType) {
        let confidence = 0.5; // Base confidence

        // Higher confidence for exact matches
        if (matchedText.toLowerCase().includes(testType.replace('-', ' '))) {
            confidence += 0.3;
        }

        // Higher confidence for proper units
        const expectedUnits = ['mg/dL', '%', 'bpm', 'mmHg', 'kg', 'lbs'];
        if (expectedUnits.some(unit => matchedText.includes(unit))) {
            confidence += 0.2;
        }

        // Higher confidence for structured format (label: value)
        if (matchedText.includes(':')) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    // Static method for easy access
    static async parseFile(file) {
        const parser = new PDFParser();
        return await parser.parseFile(file);
    }
}

// Make available globally
window.PDFParser = PDFParser;