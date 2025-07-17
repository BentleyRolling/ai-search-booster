#!/usr/bin/env node

/**
 * Comprehensive test runner for AI Search Booster
 * Runs both server and client tests with proper reporting
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = process.cwd();
const SERVER_PATH = path.join(PROJECT_ROOT, 'server');
const CLIENT_PATH = path.join(PROJECT_ROOT, 'client');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const runCommand = (command, args, cwd, description) => {
  return new Promise((resolve, reject) => {
    log(`\n${colors.bold}${description}${colors.reset}`, 'cyan');
    log(`Running: ${command} ${args.join(' ')}`, 'blue');
    
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${description} completed successfully`, 'green');
        resolve();
      } else {
        log(`❌ ${description} failed with code ${code}`, 'red');
        reject(new Error(`${description} failed`));
      }
    });
    
    child.on('error', (err) => {
      log(`❌ ${description} error: ${err.message}`, 'red');
      reject(err);
    });
  });
};

const checkDependencies = async () => {
  log('\n🔍 Checking dependencies...', 'yellow');
  
  const serverPackageJson = path.join(SERVER_PATH, 'package.json');
  const clientPackageJson = path.join(CLIENT_PATH, 'package.json');
  
  if (!fs.existsSync(serverPackageJson)) {
    throw new Error('Server package.json not found');
  }
  
  if (!fs.existsSync(clientPackageJson)) {
    throw new Error('Client package.json not found');
  }
  
  // Check if node_modules exist
  const serverNodeModules = path.join(SERVER_PATH, 'node_modules');
  const clientNodeModules = path.join(CLIENT_PATH, 'node_modules');
  
  if (!fs.existsSync(serverNodeModules)) {
    log('Installing server dependencies...', 'yellow');
    await runCommand('npm', ['install'], SERVER_PATH, 'Server dependency installation');
  }
  
  if (!fs.existsSync(clientNodeModules)) {
    log('Installing client dependencies...', 'yellow');
    await runCommand('npm', ['install'], CLIENT_PATH, 'Client dependency installation');
  }
  
  log('✅ Dependencies checked', 'green');
};

const runServerTests = async () => {
  log('\n🚀 Running server tests...', 'magenta');
  
  try {
    await runCommand('npm', ['test'], SERVER_PATH, 'Server unit tests');
    
    // Run coverage if requested
    if (process.argv.includes('--coverage')) {
      await runCommand('npm', ['run', 'test:coverage'], SERVER_PATH, 'Server test coverage');
    }
    
    return true;
  } catch (error) {
    log(`Server tests failed: ${error.message}`, 'red');
    return false;
  }
};

const runClientTests = async () => {
  log('\n🌐 Running client tests...', 'magenta');
  
  try {
    await runCommand('npm', ['test'], CLIENT_PATH, 'Client unit tests');
    
    // Run coverage if requested
    if (process.argv.includes('--coverage')) {
      await runCommand('npm', ['run', 'test:coverage'], CLIENT_PATH, 'Client test coverage');
    }
    
    return true;
  } catch (error) {
    log(`Client tests failed: ${error.message}`, 'red');
    return false;
  }
};

const runLinting = async () => {
  if (!process.argv.includes('--lint')) return true;
  
  log('\n🔧 Running linting...', 'magenta');
  
  try {
    await runCommand('npm', ['run', 'lint'], CLIENT_PATH, 'Client linting');
    return true;
  } catch (error) {
    log(`Linting failed: ${error.message}`, 'red');
    return false;
  }
};

const generateReport = (results) => {
  log('\n📊 Test Results Summary:', 'bold');
  log('========================', 'bold');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${status} ${result.name}`, color);
  });
  
  log(`\nTotal: ${results.length} test suites`, 'cyan');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  
  if (failed > 0) {
    log('\n❌ Some tests failed. Please review the output above.', 'red');
    process.exit(1);
  } else {
    log('\n🎉 All tests passed successfully!', 'green');
    process.exit(0);
  }
};

const showUsage = () => {
  log('\n📖 Usage:', 'bold');
  log('  node run-tests.js [options]', 'cyan');
  log('\nOptions:', 'bold');
  log('  --server-only    Run only server tests', 'yellow');
  log('  --client-only    Run only client tests', 'yellow');
  log('  --coverage       Generate coverage reports', 'yellow');
  log('  --lint           Run linting checks', 'yellow');
  log('  --help           Show this help message', 'yellow');
  log('\nExamples:', 'bold');
  log('  node run-tests.js --coverage', 'cyan');
  log('  node run-tests.js --server-only --lint', 'cyan');
  log('  node run-tests.js --client-only --coverage', 'cyan');
};

const main = async () => {
  log('🧪 AI Search Booster Test Runner', 'bold');
  log('==================================', 'bold');
  
  if (process.argv.includes('--help')) {
    showUsage();
    return;
  }
  
  const results = [];
  
  try {
    // Check dependencies
    await checkDependencies();
    
    // Run server tests
    if (!process.argv.includes('--client-only')) {
      const serverPassed = await runServerTests();
      results.push({ name: 'Server Tests', passed: serverPassed });
    }
    
    // Run client tests
    if (!process.argv.includes('--server-only')) {
      const clientPassed = await runClientTests();
      results.push({ name: 'Client Tests', passed: clientPassed });
    }
    
    // Run linting
    const lintPassed = await runLinting();
    if (process.argv.includes('--lint')) {
      results.push({ name: 'Linting', passed: lintPassed });
    }
    
    generateReport(results);
    
  } catch (error) {
    log(`\n❌ Test runner failed: ${error.message}`, 'red');
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGINT', () => {
  log('\n\n🛑 Test run interrupted by user', 'yellow');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n\n🛑 Test run terminated', 'yellow');
  process.exit(143);
});

// Run the main function
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});