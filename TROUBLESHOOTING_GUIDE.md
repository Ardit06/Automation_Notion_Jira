# Notion to Jira Automation - Troubleshooting Guide

## Overview
This guide helps you diagnose and fix issues with the Notion to Jira automation service.

## Common Issues and Solutions

### 1. Authentication Errors (401 Unauthorized)

**Symptoms:**
- Logs show "Request failed with status code 401"
- Connection tests fail

**Solutions:**

#### For Notion API:
```bash
# Check if your .env file has the correct Notion API key
cat .env | grep NOTION_API_KEY

# Test Notion connection
curl -X GET "https://api.notion.com/v1/databases/YOUR_DATABASE_ID" \
  -H "Authorization: Bearer YOUR_NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28"
```

#### For Jira API:
```bash
# Check if your .env file has the correct Jira credentials
cat .env | grep JIRA

# Test Jira connection
curl -X GET "https://YOUR_DOMAIN.atlassian.net/rest/api/3/myself" \
  -u "YOUR_EMAIL:YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

### 2. 400 Bad Request Errors

**Symptoms:**
- Logs show "Request failed with status code 400"
- Notion page updates fail

**Solutions:**

#### Check Notion Database Structure:
```bash
# Get database schema
curl -X GET "https://api.notion.com/v1/databases/YOUR_DATABASE_ID" \
  -H "Authorization: Bearer YOUR_NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" | jq '.properties'
```

#### Verify Required Fields:
- Ensure your Notion database has a "Name" field (title type)
- Ensure you have at least one "rich_text" field (Notes, Description, etc.)

### 3. Webhook Not Triggering

**Symptoms:**
- No logs when creating/updating Notion pages
- Webhook endpoint not receiving requests

**Solutions:**

#### Test Webhook Endpoint:
```bash
# Test webhook health
curl -X GET http://localhost:3003/webhook/health

# Test webhook with sample data
curl -X POST http://localhost:3003/webhook/notion \
  -H "Content-Type: application/json" \
  -d '{
    "type": "page.created",
    "entity": {
      "id": "test-page-id"
    }
  }'
```

#### Check Notion Webhook Configuration:
1. Go to your Notion integration settings
2. Verify webhook URL: `https://your-domain.com/webhook/notion`
3. Ensure webhook secret matches your `.env` file

### 4. Jira Issues Not Being Created

**Symptoms:**
- Notion pages updated but no Jira issues created
- Logs show processing but no Jira creation

**Solutions:**

#### Check Jira Project Configuration:
```bash
# Verify project exists and is accessible
curl -X GET "https://YOUR_DOMAIN.atlassian.net/rest/api/3/project/YOUR_PROJECT_KEY" \
  -u "YOUR_EMAIL:YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

#### Check Issue Types:
```bash
# List available issue types
curl -X GET "https://YOUR_DOMAIN.atlassian.net/rest/api/3/issuetype" \
  -u "YOUR_EMAIL:YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

## Testing Commands

### 1. Environment Setup Test
```bash
# Check if all required environment variables are set
node -e "
const config = require('./dist/config/index.js').config;
console.log('Notion API Key:', config.notion.apiKey ? 'SET' : 'MISSING');
console.log('Notion Database ID:', config.notion.databaseId ? 'SET' : 'MISSING');
console.log('Jira Base URL:', config.jira.baseUrl ? 'SET' : 'MISSING');
console.log('Jira Email:', config.jira.email ? 'SET' : 'MISSING');
console.log('Jira API Token:', config.jira.apiToken ? 'SET' : 'MISSING');
console.log('Jira Project Key:', config.jira.projectKey ? 'SET' : 'MISSING');
"
```

### 2. Connection Tests
```bash
# Test all connections
curl -X GET http://localhost:3003/webhook/test
```

### 3. Manual Sync Test
```bash
# Manually sync all "Ready For Dev" pages
curl -X POST http://localhost:3003/webhook/sync \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}'
```

### 4. Individual Page Test
```bash
# Test processing a specific Notion page
curl -X POST http://localhost:3003/webhook/notion \
  -H "Content-Type: application/json" \
  -H "x-notion-signature-v2: manual-test" \
  -d '{
    "type": "page.properties_updated",
    "entity": {
      "id": "YOUR_NOTION_PAGE_ID"
    }
  }'
```

## Debugging Steps

### 1. Enable Debug Logging
```bash
# Set debug level logging
export LOG_LEVEL=debug
npm run dev
```

### 2. Check Logs
```bash
# Monitor logs in real-time
tail -f logs/combined.log

# Check for errors
grep -i error logs/combined.log | tail -20

# Check for specific page processing
grep "YOUR_PAGE_ID" logs/combined.log
```

### 3. Test Notion Page Structure
```bash
# Get a specific page to check its structure
curl -X GET "https://api.notion.com/v1/pages/YOUR_PAGE_ID" \
  -H "Authorization: Bearer YOUR_NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" | jq '.properties'
```

## Common Configuration Issues

### 1. Database ID Format
- Notion Database ID should be 32 characters without hyphens
- Example: `2801d122539580128913d47ad2572286`

### 2. API Token Format
- Jira API tokens are generated from Atlassian account settings
- Notion integration tokens are generated from Notion integration settings

### 3. Webhook URL
- Must be publicly accessible (use ngrok for local testing)
- Should end with `/webhook/notion`

## Performance Monitoring

### 1. Check Processing Time
```bash
# Monitor processing times
grep "Processing Notion page update" logs/combined.log | tail -10
```

### 2. Check Error Rates
```bash
# Count errors in last hour
grep "$(date -v-1H '+%Y-%m-%d %H')" logs/error.log | wc -l
```

### 3. Check Success Rates
```bash
# Count successful Jira creations
grep "Successfully created Jira issue" logs/combined.log | wc -l
```

## Emergency Commands

### 1. Stop All Processing
```bash
# Kill the server
pkill -f "node.*index.js"
```

### 2. Clear Logs
```bash
# Clear log files
> logs/combined.log
> logs/error.log
```

### 3. Restart Service
```bash
# Rebuild and restart
npm run build
npm start
```

## Getting Help

If you're still experiencing issues:

1. Check the logs for specific error messages
2. Verify all environment variables are set correctly
3. Test API connections individually
4. Check Notion database structure and permissions
5. Verify Jira project access and issue type availability

## Log Analysis

### Key Log Patterns to Look For:
- `🔄 Processing Notion page update` - Page processing started
- `✅ Successfully created Jira issue` - Jira issue created successfully
- `❌ Error` - Something went wrong
- `⚠️ Skipping` - Processing skipped (usually for good reasons)
- `🔗 Adding Jira link` - Adding link back to Notion

### Common Error Messages:
- `Request failed with status code 401` - Authentication issue
- `Request failed with status code 400` - Bad request (usually data format)
- `Request failed with status code 404` - Resource not found
- `No suitable rich_text field found` - Notion database structure issue
