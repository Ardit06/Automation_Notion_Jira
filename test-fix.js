#!/usr/bin/env node

/**
 * Test script to verify the Notion to Jira automation fix
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3003';

async function testConnections() {
  console.log('🧪 Testing Notion to Jira Automation Fix\n');
  
  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/webhook/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test 2: Test connections
    console.log('\n2️⃣ Testing service connections...');
    const testResponse = await axios.get(`${BASE_URL}/webhook/test`);
    console.log('✅ Connection test passed:', testResponse.data);
    
    // Test 3: Test sync (this will trigger the actual automation)
    console.log('\n3️⃣ Testing sync functionality...');
    const syncResponse = await axios.post(`${BASE_URL}/webhook/sync`);
    console.log('✅ Sync test passed:', syncResponse.data);
    
    console.log('\n🎉 All tests passed! The fix appears to be working.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the tests
testConnections();
