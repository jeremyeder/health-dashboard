/**
 * Dashboard Data Module
 * Centralized IndexedDB queries for all dashboard pages
 */

class DashboardData {
    constructor() {
        this.dbManager = window.dbManager;
    }

    async init() {
        if (!this.dbManager) {
            throw new Error('IndexedDB Manager not available');
        }
        await this.dbManager.init();
    }

    // Overview Dashboard Data
    async getOverviewData() {
        const data = {
            vitals: {
                weight: await this.getLatestWeight(),
                bloodPressure: await this.getLatestBloodPressure(),
                heartRate: await this.getLatestHeartRate()
            },
            recentActivity: await this.getRecentActivity(7),
            sleepSummary: await this.getRecentSleep(7),
            medicationChanges: await this.getRecentMedicationChanges(30),
            upcomingAppointments: await this.getUpcomingEncounters(30),
            dataStats: await this.getDataCompleteness()
        };
        return data;
    }

    // Vitals Data
    async getVitalsData(dateRange = 90) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - dateRange);

        return {
            weight: await this.getWeightTrend(startDate, endDate),
            bloodPressure: await this.getBloodPressureTrend(startDate, endDate),
            heartRate: await this.getHeartRateTrend(startDate, endDate),
            bmi: await this.getBMITrend(startDate, endDate)
        };
    }

    // Activity Data
    async getActivityData(dateRange = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - dateRange);

        return {
            steps: await this.getStepsTrend(startDate, endDate),
            calories: await this.getCaloriesTrend(startDate, endDate),
            exercise: await this.getExerciseSessions(startDate, endDate),
            goals: await this.getActivityGoals()
        };
    }

    // Sleep Data
    async getSleepData(dateRange = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - dateRange);

        return {
            sleepDuration: await this.getSleepDurationTrend(startDate, endDate),
            sleepEfficiency: await this.getSleepEfficiencyTrend(startDate, endDate),
            sleepStages: await this.getSleepStagesTrend(startDate, endDate),
            sleepScore: await this.getSleepScoreTrend(startDate, endDate)
        };
    }

    // Medications Data
    async getMedicationsData() {
        return {
            current: await this.dbManager.getCurrentMedications(),
            recent: await this.getRecentMedicationChanges(90),
            schedule: await this.getMedicationSchedule(),
            adherence: await this.getMedicationAdherence()
        };
    }

    // Providers Data
    async getProvidersData() {
        const providers = await this.dbManager.getRecords('providers');
        const encounters = await this.dbManager.getRecords('encounters');
        
        return {
            providers: providers,
            recentEncounters: encounters.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
            encountersByProvider: this.groupEncountersByProvider(encounters, providers)
        };
    }

    // Timeline Data
    async getTimelineData() {
        const allData = await Promise.all([
            this.dbManager.getRecords('vitals'),
            this.dbManager.getRecords('medications'),
            this.dbManager.getRecords('encounters'),
            this.dbManager.getRecords('labResults'),
            this.dbManager.getRecords('sleep'),
            this.dbManager.getRecords('activity')
        ]);

        const timeline = [];
        
        // Process each data type into timeline events
        allData[0].forEach(vital => this.addVitalToTimeline(timeline, vital));
        allData[1].forEach(med => this.addMedicationToTimeline(timeline, med));
        allData[2].forEach(enc => this.addEncounterToTimeline(timeline, enc));
        allData[3].forEach(lab => this.addLabResultToTimeline(timeline, lab));
        allData[4].forEach(sleep => this.addSleepToTimeline(timeline, sleep));
        allData[5].forEach(activity => this.addActivityToTimeline(timeline, activity));

        // Sort by date descending
        return timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Helper methods for specific data queries
    async getLatestWeight() {
        const vitals = await this.dbManager.getLatestVitals('weight', 1);
        return vitals.length > 0 ? vitals[0] : null;
    }

    async getLatestBloodPressure() {
        const systolic = await this.dbManager.getLatestVitals('systolic-bp', 1);
        const diastolic = await this.dbManager.getLatestVitals('diastolic-bp', 1);
        
        if (systolic.length > 0 && diastolic.length > 0) {
            return {
                systolic: systolic[0].value,
                diastolic: diastolic[0].value,
                date: systolic[0].date
            };
        }
        return null;
    }

    async getLatestHeartRate() {
        const hr = await this.dbManager.getLatestVitals('heart-rate', 1);
        return hr.length > 0 ? hr[0] : null;
    }

    async getWeightTrend(startDate, endDate) {
        const records = await this.dbManager.getRecords('vitals', 'dateType', 
            IDBKeyRange.bound([startDate.toISOString().split('T')[0], 'weight'], 
                            [endDate.toISOString().split('T')[0], 'weight']));
        
        return records.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    async getBloodPressureTrend(startDate, endDate) {
        const systolic = await this.dbManager.getRecords('vitals', 'dateType', 
            IDBKeyRange.bound([startDate.toISOString().split('T')[0], 'systolic-bp'], 
                            [endDate.toISOString().split('T')[0], 'systolic-bp']));
        
        const diastolic = await this.dbManager.getRecords('vitals', 'dateType', 
            IDBKeyRange.bound([startDate.toISOString().split('T')[0], 'diastolic-bp'], 
                            [endDate.toISOString().split('T')[0], 'diastolic-bp']));

        return this.combineBPReadings(systolic, diastolic);
    }

    async getHeartRateTrend(startDate, endDate) {
        const records = await this.dbManager.getRecords('vitals', 'dateType', 
            IDBKeyRange.bound([startDate.toISOString().split('T')[0], 'heart-rate'], 
                            [endDate.toISOString().split('T')[0], 'heart-rate']));
        
        return records.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    async getRecentActivity(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        
        return await this.dbManager.getActivityByDateRange(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
    }

    async getRecentSleep(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        
        return await this.dbManager.getSleepByDateRange(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
    }

    async getRecentMedicationChanges(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        
        const medications = await this.dbManager.getRecordsByDateRange('medications',
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
        
        return medications.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async getUpcomingEncounters(days) {
        // For now, return recent encounters as we don't have future dates
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);
        const startDate = new Date();
        
        return await this.dbManager.getRecordsByDateRange('encounters',
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
    }

    async getDataCompleteness() {
        const counts = await Promise.all([
            this.dbManager.getRecordCount('vitals'),
            this.dbManager.getRecordCount('sleep'),
            this.dbManager.getRecordCount('activity'),
            this.dbManager.getRecordCount('medications'),
            this.dbManager.getRecordCount('encounters'),
            this.dbManager.getRecordCount('providers'),
            this.dbManager.getRecordCount('labResults')
        ]);

        return {
            vitals: counts[0],
            sleep: counts[1],
            activity: counts[2],
            medications: counts[3],
            encounters: counts[4],
            providers: counts[5],
            labResults: counts[6],
            total: counts.reduce((sum, count) => sum + count, 0)
        };
    }

    // Chart data formatters
    formatForChart(data, labelField = 'date', valueField = 'value') {
        if (!data || data.length === 0) {
            return { labels: [], data: [] };
        }

        return {
            labels: data.map(item => this.formatDateForChart(item[labelField])),
            data: data.map(item => item[valueField])
        };
    }

    formatWeightForChart(data) {
        if (!data || data.length === 0) {
            return { labels: [], data: [] };
        }

        return {
            labels: data.map(item => this.formatDateForChart(item.date)),
            data: data.map(item => item.value)
        };
    }

    formatBloodPressureForChart(data) {
        if (!data || data.length === 0) {
            return { labels: [], systolic: [], diastolic: [] };
        }

        return {
            labels: data.map(item => this.formatDateForChart(item.date)),
            systolic: data.map(item => item.systolic),
            diastolic: data.map(item => item.diastolic)
        };
    }

    formatSleepForChart(data) {
        if (!data || data.length === 0) {
            return { labels: [], duration: [], efficiency: [] };
        }

        return {
            labels: data.map(item => this.formatDateForChart(item.date)),
            duration: data.map(item => item.duration ? Math.round(item.duration / 60) : 0), // Convert to hours
            efficiency: data.map(item => item.efficiency || 0)
        };
    }

    formatActivityForChart(data) {
        if (!data || data.length === 0) {
            return { labels: [], steps: [], calories: [] };
        }

        return {
            labels: data.map(item => this.formatDateForChart(item.date)),
            steps: data.map(item => item.steps || 0),
            calories: data.map(item => item.calories || 0)
        };
    }

    // Utility methods
    formatDateForChart(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    combineBPReadings(systolic, diastolic) {
        const combined = [];
        const systolicMap = new Map(systolic.map(s => [s.date, s.value]));
        const diastolicMap = new Map(diastolic.map(d => [d.date, d.value]));
        
        // Get all unique dates
        const allDates = new Set([...systolic.map(s => s.date), ...diastolic.map(d => d.date)]);
        
        allDates.forEach(date => {
            if (systolicMap.has(date) && diastolicMap.has(date)) {
                combined.push({
                    date: date,
                    systolic: systolicMap.get(date),
                    diastolic: diastolicMap.get(date)
                });
            }
        });
        
        return combined.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    groupEncountersByProvider(encounters, providers) {
        const providerMap = new Map(providers.map(p => [p.fhirId, p]));
        const grouped = {};
        
        encounters.forEach(encounter => {
            const providerId = encounter.participant?.[0] || 'Unknown';
            if (!grouped[providerId]) {
                grouped[providerId] = {
                    provider: providerMap.get(providerId) || { name: 'Unknown Provider' },
                    encounters: []
                };
            }
            grouped[providerId].encounters.push(encounter);
        });
        
        return grouped;
    }

    // Timeline event creators
    addVitalToTimeline(timeline, vital) {
        timeline.push({
            date: vital.date,
            type: 'vital',
            category: 'Health Metrics',
            title: `${vital.type}: ${vital.value} ${vital.unit || ''}`,
            data: vital
        });
    }

    addMedicationToTimeline(timeline, medication) {
        timeline.push({
            date: medication.date,
            type: 'medication',
            category: 'Medications',
            title: `${medication.medicationName} - ${medication.status}`,
            data: medication
        });
    }

    addEncounterToTimeline(timeline, encounter) {
        timeline.push({
            date: encounter.date,
            type: 'encounter',
            category: 'Healthcare Visits',
            title: encounter.type || 'Medical Visit',
            data: encounter
        });
    }

    addLabResultToTimeline(timeline, labResult) {
        timeline.push({
            date: labResult.date,
            type: 'lab',
            category: 'Lab Results',
            title: labResult.testType || 'Lab Test',
            data: labResult
        });
    }

    addSleepToTimeline(timeline, sleep) {
        if (sleep.duration > 0) { // Only add meaningful sleep data
            timeline.push({
                date: sleep.date,
                type: 'sleep',
                category: 'Sleep',
                title: `Sleep: ${Math.round(sleep.duration / 60)}h ${sleep.duration % 60}m`,
                data: sleep
            });
        }
    }

    addActivityToTimeline(timeline, activity) {
        if (activity.steps > 0 || activity.calories > 0) { // Only add meaningful activity data
            timeline.push({
                date: activity.date,
                type: 'activity',
                category: 'Activity',
                title: `${activity.steps || 0} steps, ${activity.calories || 0} cal`,
                data: activity
            });
        }
    }

    // Check if data exists
    async hasData() {
        const stats = await this.getDataCompleteness();
        return stats.total > 0;
    }

    async hasVitalsData() {
        const count = await this.dbManager.getRecordCount('vitals');
        return count > 0;
    }

    async hasSleepData() {
        const count = await this.dbManager.getRecordCount('sleep');
        return count > 0;
    }

    async hasActivityData() {
        const count = await this.dbManager.getRecordCount('activity');
        return count > 0;
    }

    async hasMedicationsData() {
        const count = await this.dbManager.getRecordCount('medications');
        return count > 0;
    }

    async hasProvidersData() {
        const count = await this.dbManager.getRecordCount('providers');
        return count > 0;
    }
}

// Global instance
window.dashboardData = new DashboardData();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.dashboardData.init();
    } catch (error) {
        console.error('Failed to initialize dashboard data:', error);
    }
});