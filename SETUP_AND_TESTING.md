# Notion to Jira Automation - Setup and Testing Guide

## 🚀 Quick Start Commands

### 1. Install Dependencies
```bash
cd /Users/ardit/zjira
npm install
```

### 2. Set Up Environment Variables
```bash
# Copy the example file
cp env.example .env

# Edit the .env file with your credentials
nano .env
```

**Required Environment Variables:**
```env
# Notion Configuration
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_database_id_here
NOTION_WEBHOOK_SECRET=your_webhook_secret_here

# Jira Configuration
JIRA_EMAIL=your_email@domain.com
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_DOMAIN=your-domain.atlassian.net
JIRA_PROJECT_KEY=OR

# Server Configuration
PORT=3003
NODE_ENV=development
```

### 3. Build and Start the Service
```bash
# Build TypeScript
npm run build

# Start the service
npm run dev
```

### 4. Test the Service
```bash
# Make the test script executable
chmod +x test-fix.js

# Run the test
node test-fix.js
```

## 🧪 Testing Commands

### Basic Health Checks
```bash
# Test if server is running
curl http://localhost:3003/

# Test health endpoint
curl http://localhost:3003/webhook/health

# Test connections
curl http://localhost:3003/webhook/test
```

### Test Notion Integration
```bash
# Test Notion API directly
curl -X GET "https://api.notion.com/v1/databases/$NOTION_DATABASE_ID" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28"
```

### Test Jira Integration
```bash
# Test Jira API directly
curl -X GET "https://$JIRA_DOMAIN/rest/api/3/myself" \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Accept: application/json"
```

### Test Webhook Processing
```bash
# Test webhook with sample data
curl -X POST http://localhost:3003/webhook/test \
  -H "Content-Type: application/json"

# Test sync functionality
curl -X POST http://localhost:3003/webhook/sync \
  -H "Content-Type: application/json"
```

## 🔍 Debugging Commands

### View Logs
```bash
# View all logs
tail -f logs/combined.log

# View only errors
tail -f logs/error.log

# Search for specific patterns
grep -i "error\|400\|500" logs/error.log
```

### Test Individual Components
```bash
# Test Notion page retrieval
curl -X GET "https://api.notion.com/v1/pages/PAGE_ID" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28"

# Test Jira issue creation
curl -X POST "https://$JIRA_DOMAIN/rest/api/3/issue" \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": {"key": "'$JIRA_PROJECT_KEY'"},
      "summary": "Test Issue from Automation",
      "issuetype": {"name": "Story"},
      "description": "This is a test issue created by the automation system."
    }
  }'
```

## 🛠️ Troubleshooting Commands

### Check Service Status
```bash
# Check if process is running
ps aux | grep "node.*index.js"

# Check port usage
lsof -i :3003

# Kill existing process
pkill -f "node.*index.js"
```

### Reset and Restart
```bash
# Clear logs
> logs/error.log
> logs/combined.log

# Restart service
npm run dev
```

### Verify Environment
```bash
# Check environment variables
echo "NOTION_API_KEY: ${NOTION_API_KEY:0:10}..."
echo "NOTION_DATABASE_ID: $NOTION_DATABASE_ID"
echo "JIRA_EMAIL: $JIRA_EMAIL"
echo "JIRA_DOMAIN: $JIRA_DOMAIN"
echo "JIRA_PROJECT_KEY: $JIRA_PROJECT_KEY"
```

## 📊 Expected Output

### Successful Service Start
```
Server running on port 3003
Environment: development
Notion Database ID: 2801d122539580128913d47ad2572286
Jira Project Key: OR
```

### Successful Test Run
```
🧪 Testing Notion to Jira Automation Fix

1️⃣ Testing health endpoint...
✅ Health check passed: { status: 'ok', timestamp: '...' }

2️⃣ Testing service connections...
✅ Connection test passed: { notion: true, jira: true }

3️⃣ Testing sync functionality...
✅ Sync test passed: { message: 'Sync completed', processed: 0 }

🎉 All tests passed! The fix appears to be working.
```

## 🚨 Common Issues and Solutions

### Issue: Port 3003 already in use
```bash
# Find process using port 3003
lsof -i :3003

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3004 npm run dev
```

### Issue: Environment variables not loaded
```bash
# Check if .env file exists
ls -la .env

# Load environment variables manually
source .env
npm run dev
```

### Issue: Notion API errors
```bash
# Verify API key format
echo $NOTION_API_KEY | wc -c  # Should be around 50 characters

# Test API key directly
curl -X GET "https://api.notion.com/v1/users/me" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28"
```

### Issue: Jira API errors
```bash
# Verify credentials
curl -X GET "https://$JIRA_DOMAIN/rest/api/3/myself" \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN"

# Check project access
curl -X GET "https://$JIRA_DOMAIN/rest/api/3/project/$JIRA_PROJECT_KEY" \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN"
```

## 🎯 Success Criteria

- ✅ Server starts without errors
- ✅ All environment variables are set correctly
- ✅ Notion API connection successful
- ✅ Jira API connection successful
- ✅ Webhook endpoints respond correctly
- ✅ Test script runs without errors
- ✅ Logs show no 400/500 errors

## 📝 Next Steps After Testing

1. **Set up Notion webhook** to point to your server
2. **Test with real Notion page updates**
3. **Monitor logs** for any issues
4. **Verify Jira issues are created** correctly
5. **Check Notion pages** have Jira links added

---

**Last Updated:** $(date)
**Status:** 🟡 Ready for Testing
**Next Action:** Run the test script to verify the fix
