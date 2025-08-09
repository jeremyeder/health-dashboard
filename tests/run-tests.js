#!/usr/bin/env node

/**
 * Test Runner for Health Dashboard
 * Executes all test suites and reports results
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🏥 Health Dashboard Test Suite');
console.log('==============================\n');

// Run parser tests
console.log('Running parser tests...\n');

exec('node tests/parser-tests.js', (error, stdout, stderr) => {
    console.log(stdout);
    
    if (stderr) {
        console.error('Test errors:', stderr);
    }
    
    if (error) {
        console.error('\n❌ Tests failed with exit code:', error.code);
        process.exit(1);
    } else {
        console.log('\n✅ All test suites completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('  1. Start development server: npm start');
        console.log('  2. Open http://localhost:8000/app/ in your browser');
        console.log('  3. Import health data via data-management.html');
        console.log('  4. Explore your health dashboard!');
    }
});