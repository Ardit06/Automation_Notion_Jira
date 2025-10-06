# Notion to Jira Automation - Troubleshooting Guide

## 🚨 Current Issue: Jira Creation Failing

Based on the logs analysis, the main issue is a **400 Bad Request** error when trying to update Notion pages with Jira links.

### Error Details
```
AxiosError: Request failed with status code 400
at NotionService.updatePage (/Users/ardit/zjira/src/services/notionService.ts:87:24)
at NotionService.addJiraLink (/Users/ardit/zjira/src/services/notionService.ts:141:7)
```

## 🔍 Root Cause Analysis

The error occurs in the `addJiraLink` method when trying to update a Notion page with rich text content. The issue is likely:

1. **Invalid rich_text format** - The current implementation may not be sending the correct format
2. **Field type mismatch** - Trying to update a field that doesn't support rich_text
3. **Content encoding issues** - Special characters in the Jira URL or content

## 🛠️ Commands to Debug and Fix

### 1. Check Current Server Status
```bash
cd /Users/ardit/zjira
npm run dev
```

### 2. Test Notion API Connection
```bash
curl -X GET "https://api.notion.com/v1/databases/2801d122539580128913d47ad2572286" \
  -H "Authorization: Bearer YOUR_NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28"
```

### 3. Test Jira API Connection
```bash
curl -X GET "https://mardit15-17.atlassian.net/rest/api/3/myself" \
  -u "YOUR_EMAIL:YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

### 4. Check Recent Logs
```bash
# View error logs
tail -f logs/error.log

# View all logs
tail -f logs/combined.log

# Search for specific errors
grep -i "400\|bad request\|error" logs/error.log
```

### 5. Test Webhook Endpoint
```bash
# Test webhook health
curl -X GET http://localhost:3003/webhook/health

# Test webhook with sample data
curl -X POST http://localhost:3003/webhook/test
```

## 🔧 Fix Implementation

### Fix 1: Update NotionService.addJiraLink Method

The current rich_text format is incorrect. Here's the fix:

```typescript
// In src/services/notionService.ts, line 141-151
await this.updatePage(pageId, {
  [targetField]: {
    rich_text: [
      ...(currentContent ? [{
        text: {
          content: currentContent
        }
      }] : []),
      {
        text: {
          content: jiraInfo
        }
      }
    ],
  },
});
```

### Fix 2: Add Better Error Handling

```typescript
// Add this method to NotionService class
private async validateFieldType(pageId: string, fieldName: string): Promise<boolean> {
  try {
    const page = await this.getPage(pageId);
    const field = page.properties[fieldName];
    return field && field.type === 'rich_text';
  } catch (error) {
    logger.error(`Error validating field ${fieldName}:`, error);
    return false;
  }
}
```

### Fix 3: Improve Rich Text Content Building

```typescript
// Replace the jiraInfo construction
const jiraInfo = `\n\n🔗 Jira: [${jiraKey}](${jiraUrl})`;

// And update the rich_text format
const richTextContent = [
  ...(currentContent ? [{
    text: {
      content: currentContent
    }
  }] : []),
  {
    text: {
      content: jiraInfo,
      link: {
        url: jiraUrl
      }
    }
  }
];
```

## 🧪 Testing Commands

### 1. Test Individual Components
```bash
# Test Notion page retrieval
curl -X GET "http://localhost:3003/webhook/test" \
  -H "Content-Type: application/json"

# Test Jira issue creation
curl -X POST "http://localhost:3003/webhook/sync" \
  -H "Content-Type: application/json"
```

### 2. Test with Sample Notion Page
```bash
# Replace PAGE_ID with actual Notion page ID
curl -X POST "http://localhost:3003/webhook/notion" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": {
      "id": "PAGE_ID"
    }
  }'
```

### 3. Monitor Logs in Real-time
```bash
# Watch logs while testing
tail -f logs/combined.log | grep -E "(ERROR|WARN|INFO.*Jira|INFO.*Notion)"
```

## 🔍 Debugging Steps

### Step 1: Verify Environment Variables
```bash
# Check if all required env vars are set
echo "NOTION_API_KEY: ${NOTION_API_KEY:0:10}..."
echo "NOTION_DATABASE_ID: $NOTION_DATABASE_ID"
echo "JIRA_EMAIL: $JIRA_EMAIL"
echo "JIRA_API_TOKEN: ${JIRA_API_TOKEN:0:10}..."
echo "JIRA_DOMAIN: $JIRA_DOMAIN"
echo "JIRA_PROJECT_KEY: $JIRA_PROJECT_KEY"
```

### Step 2: Test Notion Page Properties
```bash
# Get page properties to see available fields
curl -X GET "https://api.notion.com/v1/pages/PAGE_ID" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" | jq '.properties'
```

### Step 3: Test Jira Issue Creation
```bash
# Test creating a simple Jira issue
curl -X POST "https://$JIRA_DOMAIN/rest/api/3/issue" \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": {"key": "'$JIRA_PROJECT_KEY'"},
      "summary": "Test Issue",
      "issuetype": {"name": "Story"}
    }
  }'
```

## 🚀 Quick Fix Commands

### 1. Restart the Service
```bash
# Kill existing process
pkill -f "node.*index.js"

# Start fresh
npm run dev
```

### 2. Clear Logs and Start Fresh
```bash
# Clear logs
> logs/error.log
> logs/combined.log

# Start service
npm run dev
```

### 3. Test the Fix
```bash
# In another terminal, test the webhook
curl -X POST http://localhost:3003/webhook/test
```

## 📊 Expected Working Flow

1. **Notion webhook** receives page update
2. **Extract page data** from Notion API
3. **Check for existing Jira link** in Notion page
4. **Create Jira issue** (Epic or Story)
5. **Update Notion page** with Jira link
6. **Log success** message

## 🎯 Success Indicators

- ✅ Server starts without errors
- ✅ Notion API connection successful
- ✅ Jira API connection successful
- ✅ Webhook receives requests
- ✅ Jira issues created successfully
- ✅ Notion pages updated with Jira links

## 🆘 If Still Not Working

1. **Check the exact error** in logs
2. **Verify API credentials** are correct
3. **Test each component** individually
4. **Check Notion page permissions** for the integration
5. **Verify Jira project permissions** for the user

## 📝 Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| 400 Bad Request | Fix rich_text format in NotionService |
| 401 Unauthorized | Check API keys and tokens |
| 403 Forbidden | Verify permissions in Notion/Jira |
| 404 Not Found | Check database/page IDs |
| 500 Internal Error | Check server logs for details |

---

**Last Updated:** $(date)
**Status:** 🔴 Not Working - 400 Bad Request Error
**Next Action:** Implement rich_text format fix
