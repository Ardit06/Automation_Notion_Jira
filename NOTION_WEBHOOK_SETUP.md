# 🔗 Notion Webhook Setup - Complete Guide

## 🎯 **Goal**
Set up automatic Jira ticket creation when you change a Notion page status to "Ready for Dev".

## ✅ **Current Status**
- ✅ **Server running** on port 3003
- ✅ **Serveo tunnel active** at `https://ardit-jira-sync.serveo.net`
- ✅ **Webhook endpoint working** at `https://ardit-jira-sync.serveo.net/webhook/notion`
- ❌ **Notion webhook not configured** (needs setup)

## 🚀 **Step-by-Step Setup**

### **Step 1: Access Notion Database**
1. Go to your database: https://www.notion.so/2801d12253958006beeaed2c0d5bdd79
2. Click the "..." menu (three dots) in the top right corner
3. Select "Connections" from the dropdown menu

### **Step 2: Add Webhook Connection**
1. Click "Add connections" or "Connect to external services"
2. Search for "Webhook" or "Zapier"
3. Select "Webhook" from the options

### **Step 3: Configure Webhook**
1. **Webhook URL**: `https://ardit-jira-sync.serveo.net/webhook/notion`
2. **Trigger**: Select "Page updated" or "Database updated"
3. **Filter**: Set to trigger only when "Status" field changes to "Ready for Dev"

### **Step 4: Test the Webhook**
1. Create a new page in your database
2. Set the status to "Ready for Dev"
3. Watch the logs for automatic webhook triggering

## 🧪 **Testing Commands**

### **Test Webhook Manually**
```bash
# Test if webhook is working
curl -X POST https://ardit-jira-sync.serveo.net/webhook/notion \
  -H "Content-Type: application/json" \
  -H "x-notion-signature-v2: debug-test" \
  -d '{"entity":{"id":"2811d122-5395-8072-ab31-ebf44c3cde5a"},"type":"page.properties_updated"}'
```

### **Monitor Logs**
```bash
# Watch logs in real-time
tail -f logs/combined.log | grep -E "(webhook|AUTOMATION|Jira|Notion)"
```

## 🔍 **Troubleshooting**

### **If Webhook Not Working**
1. **Check serveo tunnel**: `ps aux | grep "ssh.*serveo"`
2. **Test webhook URL**: `curl -s https://ardit-jira-sync.serveo.net/webhook/health`
3. **Check server logs**: `tail -20 logs/combined.log`

### **If Notion Webhook Fails**
1. **Verify URL**: Make sure it's exactly `https://ardit-jira-sync.serveo.net/webhook/notion`
2. **Check permissions**: Ensure your Notion account has access to the database
3. **Test with curl**: Use the manual test command above

## 📊 **Expected Behavior**

When you set a page to "Ready for Dev":
1. ✅ Notion sends webhook to your server
2. ✅ Server extracts page data (title, description, priority)
3. ✅ Server checks for duplicate Jira issues
4. ✅ Server creates new Jira ticket
5. ✅ Server adds clickable Jira link back to Notion
6. ✅ You can click the Jira ticket number to open it

## 🎉 **Success Indicators**

You'll know it's working when you see these in the logs:
```
🔗 WEBHOOK RECEIVED from Notion
📄 Processing page: [page-id]
🎯 CREATING NEW JIRA ISSUE
✅ Jira Issue Created: OR-XXX
🔗 Jira URL: https://mardit15-17.atlassian.net/browse/OR-XXX
🎉 AUTOMATION COMPLETE
```

## 🚨 **Important Notes**

- **Keep serveo running**: The tunnel must stay active for webhooks to work
- **Check logs regularly**: Monitor for any errors or issues
- **Test frequently**: Create test pages to verify the automation works
- **Backup webhook URL**: Save the URL in case you need to reconfigure

---

**Your Webhook URL**: `https://ardit-jira-sync.serveo.net/webhook/notion`
**Status**: Ready for configuration in Notion
