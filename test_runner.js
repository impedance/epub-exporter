#!/usr/bin/env node

// Test runner script to validate the selection-based EPUB exporter
// AICODE-NOTE: NAV/TESTS entry: npm test, npm run test:verbose ref: test/README.md

console.log('🧪 Running EPUB Exporter Tests\n');

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runTests(testFiles) {
    return new Promise((resolve, reject) => {
        const args = ['--test', ...testFiles];
        const testProcess = spawn('node', args, {
            cwd: __dirname,
            stdio: 'pipe'
        });

        let output = '';
        let passed = 0;
        let failed = 0;

        testProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            
            // Count passing and failing tests
            const passMatches = text.match(/^ok \d+/gm);
            const failMatches = text.match(/^not ok \d+/gm);
            
            if (passMatches) passed += passMatches.length;
            if (failMatches) failed += failMatches.length;
        });

        testProcess.on('close', (code) => {
            resolve({ code, output, passed, failed });
        });

        testProcess.on('error', reject);
    });
}

async function main() {
    const testSuites = [
        {
            name: 'Core Functionality Tests',
            files: ['test/content_functions.test.mjs']
        },
        {
            name: 'EPUB Generator Tests', 
            files: ['test/epub_generator.test.mjs']
        },
        {
            name: 'Integration Tests',
            files: ['extractContent.test.mjs', 'test/manifest.test.mjs']
        }
    ];

    let totalPassed = 0;
    let totalFailed = 0;
    let allPassed = true;

    for (const suite of testSuites) {
        console.log(`📁 ${suite.name}`);
        console.log('─'.repeat(40));

        try {
            const result = await runTests(suite.files);
            
            if (result.code === 0) {
                console.log(`✅ All tests passed (${result.passed} passed)`);
            } else {
                console.log(`❌ Some tests failed (${result.passed} passed, ${result.failed} failed)`);
                allPassed = false;
            }

            totalPassed += result.passed;
            totalFailed += result.failed;

        } catch (error) {
            console.log(`💥 Test suite failed to run: ${error.message}`);
            allPassed = false;
        }

        console.log('');
    }

    // Summary
    console.log('📊 Test Summary');
    console.log('═'.repeat(40));
    console.log(`Total tests: ${totalPassed + totalFailed}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`Success rate: ${totalPassed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0}%`);

    if (allPassed && totalFailed === 0) {
        console.log('\n🎉 All tests passed! The selection-based EPUB exporter is ready to use.');
        console.log('\n📝 Key features tested:');
        console.log('   • Text selection validation');
        console.log('   • Content extraction from selections');
        console.log('   • HTML structure preservation');
        console.log('   • Error handling for edge cases');
        console.log('   • Title extraction priority');
        console.log('   • Image processing and filtering');
        console.log('   • EPUB generation and formatting');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
        process.exit(1);
    }
}

main().catch(console.error);
