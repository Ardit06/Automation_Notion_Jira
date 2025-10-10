#!/usr/bin/env node

const { JiraService } = require('./dist/services/jiraService');
const { NotionService } = require('./dist/services/notionService');

async function testCredentials() {
  console.log('🧪 Testing Credentials...\n');
  
  let allTestsPassed = true;
  
  // Test Jira credentials
  console.log('🔍 Testing Jira credentials...');
  try {
    const jira = new JiraService();
    const connectionTest = await jira.testConnection();
    if (connectionTest) {
      console.log('✅ Jira connection successful');
    } else {
      throw new Error('Connection test returned false');
    }
  } catch (error) {
    console.log('❌ Jira connection failed:', error.message);
    allTestsPassed = false;
  }
  
  // Test Notion credentials
  console.log('\n🔍 Testing Notion credentials...');
  try {
    const notion = new NotionService();
    // Test with a simple database query
    const database = await notion.getDatabase(process.env.NOTION_DATABASE_ID);
    console.log('✅ Notion connection successful');
    console.log(`   Database: ${database.title || 'Connected'}`);
  } catch (error) {
    console.log('❌ Notion connection failed:', error.message);
    allTestsPassed = false;
  }
  
  console.log('\n' + '─'.repeat(50));
  
  if (allTestsPassed) {
    console.log('🎉 All credentials are working correctly!');
    console.log('✅ You can safely use these tokens in production');
  } else {
    console.log('❌ Some credentials failed. Please check:');
    console.log('   1. Token values in .env file');
    console.log('   2. Token expiration dates');
    console.log('   3. API permissions');
    console.log('   4. Network connectivity');
  }
  
  console.log('\n📅 Test completed at:', new Date().toISOString());
}

// Run the test
testCredentials().catch(console.error);
