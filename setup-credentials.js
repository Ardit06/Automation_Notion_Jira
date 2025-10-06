#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Your credentials
const credentials = {
  NOTION_API_KEY: 'ntn_b78036550619iXOLMHe087ZadjPydFR423CxWmHwtfk6o7',
  JIRA_BASE_URL: 'https://mardit15-17.atlassian.net',
  JIRA_EMAIL: 'mardit15@gmail.com',
  JIRA_API_TOKEN: 'yATATT3xFfGF0cbTOf15F3yQCnYWX4IIueKY48MaLB4pCuGee1b41RJO8gs93YP1tTVnQRlMkcjNYD-6u_iQeUVTGHJLuEXncdjsNpPBp9Uu7UHJL0Pf6jKAaUhpztcxtRb8Y36x4QVYHnpk7Tcg2rOJ2gyJB-6KCRlKnY656nTqkuKo9hZisZKU=5C1E7138',
  JIRA_PROJECT_KEY: 'OR',
  PORT: 3000,
  NODE_ENV: 'development',
  WEBHOOK_AUTH_USERS: 'mardit15'

async function setupCredentials() {
  console.log('🔧 Setting up Notion to Jira Automation\n');

  // Create .env file
  const envContent = Object.entries(credentials)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync('.env', envContent);
  console.log('✅ Created .env file with your credentials');

  // Test Notion connection
  console.log('\n🔗 Testing Notion API...');
  try {
    const notionResponse = await axios.get('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${credentials.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      }
    });
    console.log('✅ Notion API: Connected successfully');
    console.log(`   User: ${notionResponse.data.name}`);
  } catch (error) {
    console.log('❌ Notion API: Connection failed');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
  }

  // Test Jira connection
  console.log('\n🔗 Testing Jira API...');
  try {
    const jiraResponse = await axios.get(`${credentials.JIRA_BASE_URL}/rest/api/3/myself`, {
      auth: {
        username: credentials.JIRA_EMAIL,
        password: credentials.JIRA_API_TOKEN,
      },
      headers: {
        'Accept': 'application/json',
      }
    });
    console.log('✅ Jira API: Connected successfully');
    console.log(`   User: ${jiraResponse.data.displayName}`);
    console.log(`   Account ID: ${jiraResponse.data.accountId}`);
  } catch (error) {
    console.log('❌ Jira API: Connection failed');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
  }

  // List Notion databases
  console.log('\n📋 Available Notion Databases:');
  try {
    const databasesResponse = await axios.post('https://api.notion.com/v1/search', {
      filter: {
        value: 'database',
        property: 'object'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${credentials.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      }
    });

    if (databasesResponse.data.results.length > 0) {
      databasesResponse.data.results.forEach((db, index) => {
        const title = db.title?.[0]?.text?.content || 'Untitled Database';
        const dbId = db.id;
        console.log(`   ${index + 1}. ${title}`);
        console.log(`      ID: ${dbId}`);
        console.log(`      URL: https://notion.so/${dbId.replace(/-/g, '')}`);
        console.log('');
      });
      
      console.log('💡 Copy the database ID you want to use and update the NOTION_DATABASE_ID in your .env file');
    } else {
      console.log('   No databases found. Make sure your integration has access to databases.');
    }
  } catch (error) {
    console.log('❌ Could not fetch databases');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
  }

  console.log('\n🚀 Next Steps:');
  console.log('1. Update NOTION_DATABASE_ID in .env file with your database ID');
  console.log('2. Install dependencies: npm install');
  console.log('3. Start the server: npm run dev');
  console.log('4. Set up webhook in Notion pointing to your server URL');
  console.log('5. Test the automation!');
}

setupCredentials().catch(console.error);




