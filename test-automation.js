#!/usr/bin/env node

/**
 * Comprehensive Testing Script for Notion to Jira Automation
 * 
 * This script tests all aspects of the automation service:
 * - Environment configuration
 * - API connections
 * - Webhook processing
 * - End-to-end automation flow
 */

const axios = require('axios');
const { config } = require('./dist/config/index.js');

// Configuration
const BASE_URL = `http://localhost:${config.server.port}`;
const TEST_PAGE_ID = '2801d122-5395-8021-90a7-fdd1f556d494'; // Replace with actual test page ID

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logTest(testName, status, details = '') {
  const statusIcon = status ? '✅' : '❌';
  const statusColor = status ? 'green' : 'red';
  log(`${statusIcon} ${testName}`, statusColor);
  if (details) {
    log(`   ${details}`, 'yellow');
  }
}

async function testEnvironmentConfig() {
  logHeader('ENVIRONMENT CONFIGURATION TEST');
  
  const tests = [
    {
      name: 'Notion API Key',
      test: () => config.notion.apiKey && config.notion.apiKey !== 'your_notion_integration_token',
      details: config.notion.apiKey ? 'Set' : 'Missing or using placeholder'
    },
    {
      name: 'Notion Database ID',
      test: () => config.notion.databaseId && config.notion.databaseId !== 'your_notion_database_id',
      details: config.notion.databaseId ? 'Set' : 'Missing or using placeholder'
    },
    {
      name: 'Jira Base URL',
      test: () => config.jira.baseUrl && config.jira.baseUrl !== 'https://your-domain.atlassian.net',
      details: config.jira.baseUrl ? 'Set' : 'Missing or using placeholder'
    },
    {
      name: 'Jira Email',
      test: () => config.jira.email && config.jira.email !== 'your-email@domain.com',
      details: config.jira.email ? 'Set' : 'Missing or using placeholder'
    },
    {
      name: 'Jira API Token',
      test: () => config.jira.apiToken && config.jira.apiToken !== 'your_jira_api_token',
      details: config.jira.apiToken ? 'Set' : 'Missing or using placeholder'
    },
    {
      name: 'Jira Project Key',
      test: () => config.jira.projectKey && config.jira.projectKey !== 'YOUR_PROJECT_KEY',
      details: config.jira.projectKey ? 'Set' : 'Missing or using placeholder'
    },
    {
      name: 'Server Port',
      test: () => config.server.port && config.server.port > 0,
      details: `Port: ${config.server.port}`
    }
  ];

  let passed = 0;
  for (const test of tests) {
    const result = test.test();
    logTest(test.name, result, test.details);
    if (result) passed++;
  }

  log(`\nEnvironment Configuration: ${passed}/${tests.length} tests passed`, passed === tests.length ? 'green' : 'red');
  return passed === tests.length;
}

async function testServerHealth() {
  logHeader('SERVER HEALTH TEST');
  
  try {
    const response = await axios.get(`${BASE_URL}/webhook/health`);
    const isHealthy = response.status === 200 && response.data.status === 'healthy';
    logTest('Server Health Check', isHealthy, `Status: ${response.data.status}`);
    return isHealthy;
  } catch (error) {
    logTest('Server Health Check', false, `Error: ${error.message}`);
    return false;
  }
}

async function testAPIConnections() {
  logHeader('API CONNECTIONS TEST');
  
  try {
    const response = await axios.get(`${BASE_URL}/webhook/test`);
    const results = response.data;
    
    logTest('Notion Connection', results.notion, results.notion ? 'Connected successfully' : 'Connection failed');
    logTest('Jira Connection', results.jira, results.jira ? 'Connected successfully' : 'Connection failed');
    
    const allConnected = results.notion && results.jira;
    log(`\nAPI Connections: ${allConnected ? 'All connected' : 'Some connections failed'}`, allConnected ? 'green' : 'red');
    return allConnected;
  } catch (error) {
    logTest('API Connections Test', false, `Error: ${error.message}`);
    return false;
  }
}

async function testWebhookEndpoint() {
  logHeader('WEBHOOK ENDPOINT TEST');
  
  const testPayload = {
    type: 'page.created',
    entity: {
      id: TEST_PAGE_ID
    }
  };

  try {
    const response = await axios.post(`${BASE_URL}/webhook/notion`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-notion-signature-v2': 'test-signature'
      }
    });
    
    const isSuccess = response.status === 200 && response.data.success;
    logTest('Webhook Endpoint', isSuccess, `Response: ${JSON.stringify(response.data)}`);
    return isSuccess;
  } catch (error) {
    logTest('Webhook Endpoint', false, `Error: ${error.message}`);
    return false;
  }
}

async function testNotionPageStructure() {
  logHeader('NOTION PAGE STRUCTURE TEST');
  
  try {
    const response = await axios.get(`https://api.notion.com/v1/pages/${TEST_PAGE_ID}`, {
      headers: {
        'Authorization': `Bearer ${config.notion.apiKey}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    const page = response.data;
    const properties = page.properties;
    const propertyNames = Object.keys(properties);
    
    logTest('Page Accessible', true, `Page ID: ${page.id}`);
    logTest('Has Properties', propertyNames.length > 0, `Properties: ${propertyNames.join(', ')}`);
    
    // Check for required fields
    const hasNameField = properties['Name'] || properties['Title'] || properties['Ticket'];
    const hasRichTextField = Object.values(properties).some(prop => prop.type === 'rich_text');
    
    logTest('Has Name/Title/Ticket Field', !!hasNameField, hasNameField ? 'Found' : 'Missing');
    logTest('Has Rich Text Field', hasRichTextField, hasRichTextField ? 'Found' : 'Missing');
    
    const structureValid = hasNameField && hasRichTextField;
    log(`\nPage Structure: ${structureValid ? 'Valid' : 'Invalid'}`, structureValid ? 'green' : 'red');
    return structureValid;
  } catch (error) {
    logTest('Notion Page Structure', false, `Error: ${error.message}`);
    return false;
  }
}

async function testJiraProjectAccess() {
  logHeader('JIRA PROJECT ACCESS TEST');
  
  try {
    const response = await axios.get(`https://${config.jira.baseUrl.replace('https://', '')}/rest/api/3/project/${config.jira.projectKey}`, {
      auth: {
        username: config.jira.email,
        password: config.jira.apiToken
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const project = response.data;
    logTest('Project Accessible', true, `Project: ${project.name} (${project.key})`);
    logTest('Project Active', !project.archived, project.archived ? 'Archived' : 'Active');
    
    return true;
  } catch (error) {
    logTest('Jira Project Access', false, `Error: ${error.message}`);
    return false;
  }
}

async function testEndToEndFlow() {
  logHeader('END-TO-END FLOW TEST');
  
  log('This test simulates the complete automation flow:', 'blue');
  log('1. Notion page update triggers webhook', 'blue');
  log('2. System processes page and creates Jira issue', 'blue');
  log('3. System adds Jira link back to Notion', 'blue');
  
  const testPayload = {
    type: 'page.properties_updated',
    entity: {
      id: TEST_PAGE_ID
    }
  };

  try {
    log('\n🔄 Triggering automation flow...', 'yellow');
    const response = await axios.post(`${BASE_URL}/webhook/notion`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-notion-signature-v2': 'end-to-end-test'
      }
    });
    
    const isSuccess = response.status === 200;
    logTest('End-to-End Flow', isSuccess, `Response: ${JSON.stringify(response.data)}`);
    
    if (isSuccess) {
      log('\n⏳ Waiting 5 seconds for processing...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      log('✅ End-to-end test completed. Check logs for detailed processing information.', 'green');
    }
    
    return isSuccess;
  } catch (error) {
    logTest('End-to-End Flow', false, `Error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  logHeader('NOTION TO JIRA AUTOMATION - COMPREHENSIVE TEST SUITE');
  log(`Testing server at: ${BASE_URL}`, 'blue');
  log(`Test page ID: ${TEST_PAGE_ID}`, 'blue');
  
  const tests = [
    { name: 'Environment Configuration', fn: testEnvironmentConfig },
    { name: 'Server Health', fn: testServerHealth },
    { name: 'API Connections', fn: testAPIConnections },
    { name: 'Webhook Endpoint', fn: testWebhookEndpoint },
    { name: 'Notion Page Structure', fn: testNotionPageStructure },
    { name: 'Jira Project Access', fn: testJiraProjectAccess },
    { name: 'End-to-End Flow', fn: testEndToEndFlow }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      logTest(test.name, false, `Unexpected error: ${error.message}`);
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Summary
  logHeader('TEST SUMMARY');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    logTest(result.name, result.passed);
  });
  
  log(`\nOverall Result: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All tests passed! Your automation service is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please check the troubleshooting guide for solutions.', 'yellow');
    log('📖 See TROUBLESHOOTING_GUIDE.md for detailed help.', 'blue');
  }
  
  return passed === total;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`\n💥 Test suite failed with error: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testEnvironmentConfig,
  testServerHealth,
  testAPIConnections,
  testWebhookEndpoint,
  testNotionPageStructure,
  testJiraProjectAccess,
  testEndToEndFlow
};
