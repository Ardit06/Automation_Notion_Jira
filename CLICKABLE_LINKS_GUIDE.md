# 🔗 Clickable Jira Links in Notion - Complete Guide

## ✨ What's New

Your Notion to Jira automation now creates **clickable links** in Notion! When you set a page to "Ready for Dev" status, the system will:

1. ✅ Create a Jira ticket automatically
2. ✅ Add a clickable link back to Notion
3. ✅ You can click the Jira ticket number to open it directly in your browser

## 🎯 How It Works

### Before (Plain Text Links)
```
🔗 Jira: OR-109 - https://mardit15-17.atlassian.net/browse/OR-109
```

### After (Clickable Links)
```
🔗 Jira: OR-109  ← This is now clickable!
```

When you click on `OR-109`, it will automatically open the Jira ticket in your browser.

## 🚀 Setting Up Automatic Webhook Triggering

Currently, your automation works perfectly when tested manually, but to make it work automatically when you change pages to "Ready for Dev" in Notion, you need to set up a webhook.

### Option 1: Using Ngrok (Recommended for Development)

1. **Install Ngrok** (if not already installed):
   ```bash
   # On macOS with Homebrew
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Start your automation server**:
   ```bash
   cd /Users/ardit/zjira
   npm start
   ```

3. **In a new terminal, expose your local server**:
   ```bash
   ngrok http 3003
   ```

4. **Copy the HTTPS URL** from ngrok output (looks like `https://abc123.ngrok.io`)

5. **Set up Notion Webhook**:
   - Go to your Notion database
   - Click "..." → "Connections" → "Add connections"
   - Search for "Webhook" or "Zapier"
   - Use the ngrok URL: `https://abc123.ngrok.io/webhook/notion`
   - Select "Page updated" as the trigger
   - Choose your database

### Option 2: Deploy to Cloud (Recommended for Production)

1. **Deploy to Heroku, Railway, or Vercel**
2. **Use the production URL** for your Notion webhook
3. **Update your environment variables** with the production URL

## 🧪 Testing the Clickable Links

### Manual Test
```bash
# Test with your existing page
curl -X POST http://localhost:3003/webhook/notion \
  -H "Content-Type: application/json" \
  -H "x-notion-signature-v2: debug-test" \
  -d '{"entity":{"id":"2811d122-5395-8072-ab31-ebf44c3cde5a"},"type":"page.properties_updated"}'
```

### What You'll See in Notion
1. Open your Notion page: https://www.notion.so/2811d12253958072ab31ebf44c3cde5a
2. Look at the Description field
3. You should see: `🔗 Jira: OR-109` where `OR-109` is clickable
4. Click on `OR-109` to open the Jira ticket

## 🔧 Technical Details

### Rich Text Format
The system now uses Notion's rich text format with proper link annotations:

```typescript
{
  type: 'text',
  text: {
    content: jiraKey,
    link: {
      url: jiraUrl
    }
  },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: 'default'
  }
}
```

### Duplicate Detection
The system now handles both old and new link formats:
- Old format: `🔗 Jira: OR-109 - https://mardit15-17.atlassian.net/browse/OR-109`
- New format: `🔗 Jira: OR-109` (clickable)

## 🎉 Benefits

1. **One-Click Access**: Click directly from Notion to Jira
2. **Clean Interface**: No long URLs cluttering your Notion pages
3. **Better UX**: Seamless workflow between Notion and Jira
4. **Automatic**: Works with your existing "Ready for Dev" workflow

## 🚨 Troubleshooting

### If Links Aren't Clickable
1. Check that your Notion page has a rich text field (Description, Notes, etc.)
2. Verify the automation ran successfully (check logs)
3. Try refreshing your Notion page

### If Webhook Isn't Triggering
1. Ensure ngrok is running and accessible
2. Check that the webhook URL is correct
3. Verify Notion webhook is properly configured
4. Check server logs for incoming requests

### Check Server Status
```bash
curl http://localhost:3003/health
```

## 📝 Next Steps

1. **Set up the webhook** using ngrok or cloud deployment
2. **Test with a new page** - create a page, set status to "Ready for Dev"
3. **Verify clickable links** work in Notion
4. **Enjoy your streamlined workflow!** 🎉

---

**Need Help?** Check the logs at `/Users/ardit/zjira/logs/combined.log` for detailed information about what's happening with your automation.
