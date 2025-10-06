#!/usr/bin/env node

const axios = require('axios');

// Test webhook functionality
async function testWebhook() {
  console.log('🧪 Testing Notion Webhook...\n');
  
  const webhookUrl = 'https://ardit-jira-sync.serveo.net/webhook/notion';
  
  // Test payload
  const testPayload = {
    entity: {
      id: '2811d122-5395-8072-ab31-ebf44c3cde5a'
    },
    type: 'page.properties_updated'
  };
  
  try {
    console.log('📡 Sending webhook test...');
    const response = await axios.post(webhookUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-notion-signature-v2': 'debug-test'
      }
    });
    
    console.log('✅ Webhook test successful!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${response.data}`);
    
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📋 Response: ${error.response.data}`);
    }
  }
}

// Run the test
testWebhook();
