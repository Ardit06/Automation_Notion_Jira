#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔄 Token Rotation Helper\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  console.log('Please create a .env file with your current tokens first.');
  process.exit(1);
}

// Read current .env file
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

console.log('📋 Current tokens in .env:');
console.log('─'.repeat(50));

const tokenLines = envLines.filter(line => 
  line.includes('NOTION_API_KEY') || 
  line.includes('JIRA_API_TOKEN') ||
  line.includes('JIRA_EMAIL')
);

tokenLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    const maskedValue = value.length > 10 
      ? value.substring(0, 8) + '...' + value.substring(value.length - 4)
      : '***';
    console.log(`${key}=${maskedValue}`);
  }
});

console.log('─'.repeat(50));
console.log('');

console.log('🔗 Links to generate new tokens:');
console.log('📝 Notion API Key: https://www.notion.so/my-integrations');
console.log('📝 Jira API Token: https://id.atlassian.com/manage-profile/security/api-tokens');
console.log('');

console.log('⚙️  Steps to rotate tokens:');
console.log('1. Generate new tokens from the links above');
console.log('2. Update your .env file with new tokens');
console.log('3. Test the new tokens locally');
console.log('4. Update GitHub secrets (if using GitHub Actions)');
console.log('5. Restart your application');
console.log('');

console.log('🧪 To test new tokens:');
console.log('Run: node test-credentials.js');
console.log('');

console.log('📅 Last rotation: ' + new Date().toISOString());
console.log('📅 Next rotation: ' + new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
console.log('');

// Create a backup of current .env
const backupPath = path.join(__dirname, `.env.backup.${Date.now()}`);
fs.copyFileSync(envPath, backupPath);
console.log(`💾 Backup created: ${backupPath}`);

console.log('✅ Token rotation helper completed!');
