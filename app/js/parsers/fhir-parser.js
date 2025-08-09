/**
 * FHIR Data Parser
 * Handles parsing of FHIR JSON bundles and individual resources
 */

class FHIRParser {
    constructor() {
        this.resourceTypes = {
            'Patient': 'patient',
            'Practitioner': 'providers',
            'Observation': 'vitals',
            'MedicationRequest': 'medications',
            'MedicationStatement': 'medications',
            'Encounter': 'encounters',
            'DiagnosticReport': 'labResults',
            'Condition': 'conditions',
            'Procedure': 'procedures',
            'AllergyIntolerance': 'allergies'
        };
    }

    async parseFile(file) {
        const text = await this.readFileAsText(file);
        const fhirData = JSON.parse(text);
        
        return this.parseFHIRBundle(fhirData);
    }

    parseFHIRBundle(bundle) {
        const results = {
            vitals: [],
            medications: [],
            encounters: [],
            providers: [],
            labResults: [],
            conditions: [],
            procedures: [],
            patient: null
        };

        if (bundle.resourceType === 'Bundle' && bundle.entry) {
            // Parse bundle entries
            bundle.entry.forEach(entry => {
                if (entry.resource) {
                    this.parseResource(entry.resource, results);
                }
            });
        } else if (bundle.resourceType) {
            // Single resource
            this.parseResource(bundle, results);
        }

        // Combine all records for return
        const allRecords = [];
        Object.values(results).forEach(records => {
            if (Array.isArray(records)) {
                allRecords.push(...records);
            }
        });

        return {
            type: 'fhir-bundle',
            records: allRecords,
            source: 'fhir',
            details: results
        };
    }

    parseResource(resource, results) {
        const resourceType = resource.resourceType;
        
        try {
            switch (resourceType) {
                case 'Patient':
                    results.patient = this.parsePatient(resource);
                    break;
                case 'Practitioner':
                    results.providers.push(this.parsePractitioner(resource));
                    break;
                case 'Observation':
                    const obs = this.parseObservation(resource);
                    if (obs) {
                        if (this.isLabResult(obs)) {
                            results.labResults.push(obs);
                        } else {
                            results.vitals.push(obs);
                        }
                    }
                    break;
                case 'MedicationRequest':
                case 'MedicationStatement':
                    const med = this.parseMedication(resource);
                    if (med) results.medications.push(med);
                    break;
                case 'Encounter':
                    const enc = this.parseEncounter(resource);
                    if (enc) results.encounters.push(enc);
                    break;
                case 'DiagnosticReport':
                    const report = this.parseDiagnosticReport(resource);
                    if (report) results.labResults.push(report);
                    break;
                case 'Condition':
                    const cond = this.parseCondition(resource);
                    if (cond) results.conditions.push(cond);
                    break;
                case 'Procedure':
                    const proc = this.parseProcedure(resource);
                    if (proc) results.procedures.push(proc);
                    break;
                default:
                    console.log(`Unhandled FHIR resource type: ${resourceType}`);
            }
        } catch (error) {
            console.error(`Error parsing ${resourceType}:`, error, resource);
        }
    }

    parsePatient(patient) {
        return {
            id: patient.id,
            name: this.extractHumanName(patient.name),
            birthDate: patient.birthDate,
            gender: patient.gender,
            identifiers: patient.identifier || []
        };
    }

    parsePractitioner(practitioner) {
        return {
            fhirId: practitioner.id,
            name: this.extractHumanName(practitioner.name),
            specialty: this.extractPractitionerSpecialty(practitioner),
            telecom: practitioner.telecom || [],
            address: practitioner.address || [],
            active: practitioner.active !== false,
            source: 'fhir'
        };
    }

    parseObservation(observation) {
        const date = this.extractDate(observation.effectiveDateTime || observation.effectivePeriod);
        if (!date) return null;

        const code = observation.code?.coding?.[0];
        const value = this.extractValue(observation.valueQuantity || observation.valueCodeableConcept || observation.valueString);
        
        if (!code || value === null) return null;

        const obsRecord = {
            fhirId: observation.id,
            date: date,
            type: this.mapObservationCode(code.code, code.system),
            code: code.code,
            display: code.display,
            system: code.system,
            value: value.value,
            unit: value.unit,
            referenceRange: this.extractReferenceRange(observation.referenceRange),
            status: observation.status,
            category: observation.category?.[0]?.coding?.[0]?.code,
            source: 'fhir'
        };

        return obsRecord;
    }

    parseMedication(medication) {
        const date = this.extractDate(
            medication.authoredOn || 
            medication.effectiveDateTime || 
            medication.effectivePeriod
        );
        
        const medicationName = this.extractMedicationName(medication);
        if (!medicationName) return null;

        return {
            fhirId: medication.id,
            date: date || new Date().toISOString().split('T')[0],
            medicationName: medicationName,
            dosage: this.extractDosage(medication.dosageInstruction),
            status: medication.status || 'unknown',
            intent: medication.intent,
            category: medication.category?.[0]?.coding?.[0]?.code,
            prescriber: medication.requester?.reference,
            source: 'fhir'
        };
    }

    parseEncounter(encounter) {
        const date = this.extractDate(encounter.period?.start || encounter.period?.end);
        if (!date) return null;

        return {
            fhirId: encounter.id,
            date: date,
            type: encounter.type?.[0]?.coding?.[0]?.display || 'Visit',
            status: encounter.status,
            class: encounter.class?.code,
            serviceProvider: encounter.serviceProvider?.reference,
            participant: encounter.participant?.map(p => p.individual?.reference) || [],
            reasonCode: encounter.reasonCode?.[0]?.coding?.[0]?.display,
            period: {
                start: encounter.period?.start,
                end: encounter.period?.end
            },
            source: 'fhir'
        };
    }

    parseDiagnosticReport(report) {
        const date = this.extractDate(report.effectiveDateTime || report.effectivePeriod);
        if (!date) return null;

        return {
            fhirId: report.id,
            date: date,
            testType: report.code?.coding?.[0]?.display || 'Lab Report',
            status: report.status,
            category: report.category?.[0]?.coding?.[0]?.display,
            results: report.result?.map(ref => ref.reference) || [],
            conclusion: report.conclusion,
            source: 'fhir'
        };
    }

    parseCondition(condition) {
        const date = this.extractDate(condition.onsetDateTime || condition.recordedDate);
        
        return {
            fhirId: condition.id,
            date: date || new Date().toISOString().split('T')[0],
            condition: condition.code?.coding?.[0]?.display,
            status: condition.clinicalStatus?.coding?.[0]?.code,
            category: condition.category?.[0]?.coding?.[0]?.display,
            severity: condition.severity?.coding?.[0]?.display,
            source: 'fhir'
        };
    }

    parseProcedure(procedure) {
        const date = this.extractDate(procedure.performedDateTime || procedure.performedPeriod);
        if (!date) return null;

        return {
            fhirId: procedure.id,
            date: date,
            procedure: procedure.code?.coding?.[0]?.display,
            status: procedure.status,
            category: procedure.category?.coding?.[0]?.display,
            performer: procedure.performer?.map(p => p.actor?.reference) || [],
            source: 'fhir'
        };
    }

    // Helper methods
    extractHumanName(names) {
        if (!names || !Array.isArray(names) || names.length === 0) return '';
        
        const name = names.find(n => n.use === 'official') || names[0];
        const parts = [];
        
        if (name.given) parts.push(...name.given);
        if (name.family) parts.push(name.family);
        
        return parts.join(' ');
    }

    extractPractitionerSpecialty(practitioner) {
        // Look for specialty in qualification or extension
        if (practitioner.qualification) {
            const specialty = practitioner.qualification.find(q => 
                q.code?.coding?.some(c => c.system?.includes('specialty'))
            );
            if (specialty) {
                return specialty.code.coding[0].display;
            }
        }
        
        return 'General Practice';
    }

    extractDate(dateValue) {
        if (!dateValue) return null;
        
        if (typeof dateValue === 'string') {
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
        }
        
        if (dateValue.start) {
            const date = new Date(dateValue.start);
            return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
        }
        
        return null;
    }

    extractValue(valueElement) {
        if (!valueElement) return null;
        
        if (valueElement.value !== undefined) {
            return {
                value: valueElement.value,
                unit: valueElement.unit || valueElement.code
            };
        }
        
        if (valueElement.coding) {
            return {
                value: valueElement.coding[0].display,
                unit: null
            };
        }
        
        if (typeof valueElement === 'string' || typeof valueElement === 'number') {
            return {
                value: valueElement,
                unit: null
            };
        }
        
        return null;
    }

    extractReferenceRange(ranges) {
        if (!ranges || !Array.isArray(ranges) || ranges.length === 0) return null;
        
        const range = ranges[0];
        return {
            low: range.low?.value,
            high: range.high?.value,
            text: range.text
        };
    }

    extractMedicationName(medication) {
        // Try different places where medication name might be stored
        if (medication.medicationCodeableConcept) {
            return medication.medicationCodeableConcept.coding?.[0]?.display ||
                   medication.medicationCodeableConcept.text;
        }
        
        if (medication.medicationReference) {
            // This would require resolving the reference
            return `Medication Reference: ${medication.medicationReference.reference}`;
        }
        
        if (medication.code) {
            return medication.code.coding?.[0]?.display || medication.code.text;
        }
        
        return null;
    }

    extractDosage(dosageInstructions) {
        if (!dosageInstructions || !Array.isArray(dosageInstructions)) return null;
        
        const dosage = dosageInstructions[0];
        const parts = [];
        
        if (dosage.text) {
            return dosage.text;
        }
        
        if (dosage.doseAndRate) {
            const dose = dosage.doseAndRate[0]?.doseQuantity;
            if (dose) {
                parts.push(`${dose.value} ${dose.unit}`);
            }
        }
        
        if (dosage.timing?.repeat?.frequency) {
            parts.push(`${dosage.timing.repeat.frequency}x daily`);
        }
        
        return parts.join(' ') || null;
    }

    mapObservationCode(code, system) {
        // Map common LOINC and SNOMED codes to our internal types
        const codeMap = {
            // Weight/BMI
            '29463-7': 'weight',
            '39156-5': 'bmi',
            
            // Blood Pressure
            '85354-9': 'blood-pressure',
            '8480-6': 'systolic-bp',
            '8462-4': 'diastolic-bp',
            
            // Heart Rate
            '8867-4': 'heart-rate',
            
            // Lab Values
            '4548-4': 'hemoglobin-a1c',
            '2093-3': 'total-cholesterol',
            '18262-6': 'ldl-cholesterol',
            '2085-9': 'hdl-cholesterol',
            '2571-8': 'triglycerides',
            
            // Vital Signs
            '8310-5': 'body-temperature',
            '9279-1': 'respiratory-rate',
            '2710-2': 'oxygen-saturation'
        };

        return codeMap[code] || 'observation';
    }

    isLabResult(observation) {
        // Determine if an observation is a lab result vs. vital sign
        const labCategories = ['laboratory', 'diagnostic'];
        const labCodes = ['4548-4', '2093-3', '18262-6', '2085-9', '2571-8']; // A1C, cholesterol panel
        
        return labCategories.includes(observation.category) || 
               labCodes.includes(observation.code);
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
        const parser = new FHIRParser();
        return await parser.parseFile(file);
    }
}

// Make available globally
window.FHIRParser = FHIRParser;