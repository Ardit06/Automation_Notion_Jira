#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔐 GitHub Secrets Setup Helper\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  console.log('Please create a .env file with your tokens first.');
  process.exit(1);
}

// Read .env file
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

console.log('📋 Current tokens in .env:');
console.log('─'.repeat(50));

const secrets = {};

envLines.forEach(line => {
  const trimmedLine = line.trim();
  if (trimmedLine && !trimmedLine.startsWith('#')) {
    const [key, ...valueParts] = trimmedLine.split('=');
    const value = valueParts.join('=');
    
    if (key && value) {
      const maskedValue = value.length > 10 
        ? value.substring(0, 8) + '...' + value.substring(value.length - 4)
        : '***';
      console.log(`${key}=${maskedValue}`);
      
      // Map to GitHub secrets
      switch(key) {
        case 'NOTION_API_KEY':
          secrets.NOTION_API_KEY = value;
          break;
        case 'JIRA_API_TOKEN':
          secrets.JIRA_API_TOKEN = value;
          break;
        case 'NOTION_WEBHOOK_SECRET':
          secrets.NOTION_WEBHOOK_SECRET = value;
          break;
        case 'JIRA_EMAIL':
          secrets.JIRA_EMAIL = value;
          break;
        case 'JIRA_BASE_URL':
          secrets.JIRA_BASE_URL = value;
          break;
        case 'JIRA_PROJECT_KEY':
          secrets.JIRA_PROJECT_KEY = value;
          break;
        case 'NOTION_USER_STORIES_DATABASE_ID':
          secrets.NOTION_USER_STORIES_DATABASE_ID = value;
          break;
        case 'NOTION_EPICS_DATABASE_ID':
          secrets.NOTION_EPICS_DATABASE_ID = value;
          break;
        case 'SCRUM_MASTER_EMAIL':
          secrets.SCRUM_MASTER_EMAIL = value;
          break;
        case 'WEBHOOK_AUTH_USERS':
          secrets.WEBHOOK_AUTH_USERS = value;
          break;
      }
    }
  }
});

console.log('─'.repeat(50));
console.log('');

console.log('🔗 GitHub Secrets Setup Instructions:');
console.log('=====================================');
console.log('');
console.log('1. Go to: https://github.com/Ardit06/Automation_Jira_Notion/settings/secrets/actions');
console.log('');
console.log('2. Click "New repository secret" for each of these:');
console.log('');

Object.entries(secrets).forEach(([key, value]) => {
  console.log(`   • ${key}`);
});

console.log('');
console.log('3. Also add this secret for the workflow:');
console.log('   • PERSONAL_TOKEN (your GitHub Personal Access Token)');
console.log('');

console.log('🔧 GitHub CLI Commands (if you have GitHub CLI installed):');
console.log('==========================================================');
console.log('');

Object.entries(secrets).forEach(([key, value]) => {
  console.log(`gh secret set ${key} --body "${value}"`);
});

console.log('');
console.log('gh secret set PERSONAL_TOKEN --body "your_github_personal_access_token"');
console.log('');

console.log('📅 After setting up secrets:');
console.log('1. The workflow will run monthly automatically');
console.log('2. You can also run it manually from GitHub Actions tab');
console.log('3. It will remind you to rotate tokens every 30 days');
console.log('');

console.log('✅ Setup complete! Your secrets are ready to be added to GitHub.');
