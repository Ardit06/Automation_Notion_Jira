# 🔐 Notion Webhook Verification Token Guide

## 🎯 **What You Need for Verification**

When setting up the Notion webhook, you'll need to provide a **verification token** that Notion will use to verify your webhook endpoint.

## 🔑 **Verification Token Options**

### **Option 1: Use Your Webhook Secret (Recommended)**
Your webhook secret from your `.env` file:
```
NOTION_WEBHOOK_SECRET=your_webhook_secret
```

**Use this as your verification token in Notion webhook setup.**

### **Option 2: Generate a New Token**
If you don't have a webhook secret set, you can generate a new one:

```bash
# Generate a random 32-character token
openssl rand -hex 16
```

Or use this online generator: https://www.uuidgenerator.net/

## 🚀 **How to Set Up Verification**

### **Step 1: Check Your Current Webhook Secret**
```bash
# Check if you have a webhook secret set
grep NOTION_WEBHOOK_SECRET .env
```

### **Step 2: If No Secret Exists, Add One**
```bash
# Add to your .env file
echo "NOTION_WEBHOOK_SECRET=your_32_character_secret_here" >> .env
```

### **Step 3: Restart Your Server**
```bash
# Restart to load the new secret
pkill -f "node.*index.js" && sleep 2 && npm start
```

## 🔧 **Notion Webhook Setup Process**

### **Step 1: Go to Notion Database**
1. Open: https://www.notion.so/2801d12253958006beeaed2c0d5bdd79
2. Click "..." → "Connections" → "Add connections"
3. Search for "Webhook" or "Zapier"

### **Step 2: Configure Webhook**
1. **Webhook URL**: `https://quinquaginta.serveo.net/webhook/notion`
2. **Verification Token**: Use your `NOTION_WEBHOOK_SECRET` value
3. **Trigger**: "Page updated" or "Database updated"
4. **Filter**: When "Status" field changes to "Ready for Dev"

### **Step 3: Notion Will Test Your Webhook**
Notion will send a verification request to your webhook with the token you provided.

## 🧪 **Testing Verification**

### **Test 1: Manual Verification Test**
```bash
# Test verification with a token
curl -X POST https://quinquaginta.serveo.net/webhook/notion \
  -H "Content-Type: application/json" \
  -d '{"verification_token": "your_webhook_secret_here"}'
```

**Expected Response**: `{"verification_token": "your_webhook_secret_here"}`

### **Test 2: Challenge Test**
```bash
# Test challenge format
curl -X POST https://quinquaginta.serveo.net/webhook/notion \
  -H "Content-Type: application/json" \
  -d '{"challenge": "test_challenge_123"}'
```

**Expected Response**: `{"challenge": "test_challenge_123"}`

## 📊 **Current Webhook Handler Support**

Your webhook handler already supports these verification formats:

1. ✅ **verification_token** field
2. ✅ **challenge** field  
3. ✅ **verification** type
4. ✅ **token** field
5. ✅ **verification** field

## 🔍 **Troubleshooting**

### **If Verification Fails**
1. **Check your webhook secret**:
   ```bash
   grep NOTION_WEBHOOK_SECRET .env
   ```

2. **Check server logs**:
   ```bash
   tail -f logs/combined.log | grep -E "(verification|challenge|token)"
   ```

3. **Test verification manually**:
   ```bash
   curl -X POST https://quinquaginta.serveo.net/webhook/notion \
     -H "Content-Type: application/json" \
     -d '{"verification_token": "YOUR_SECRET_HERE"}'
   ```

### **If Notion Can't Reach Your Webhook**
1. **Check serveo tunnel**:
   ```bash
   ps aux | grep "ssh.*serveo"
   ```

2. **Test webhook health**:
   ```bash
   curl -s https://quinquaginta.serveo.net/webhook/health
   ```

## 🎉 **Success Indicators**

You'll know verification is working when:

1. ✅ **Notion webhook setup completes successfully**
2. ✅ **You see verification requests in logs**:
   ```
   Received webhook verification request with token: [your_token]
   ```
3. ✅ **Webhook starts receiving real page updates**
4. ✅ **Jira tickets are created automatically**

## 📝 **Quick Setup Checklist**

- [ ] Check if `NOTION_WEBHOOK_SECRET` is set in `.env`
- [ ] If not set, add a 32-character secret to `.env`
- [ ] Restart your server
- [ ] Go to Notion database settings
- [ ] Add webhook connection
- [ ] Use URL: `https://quinquaginta.serveo.net/webhook/notion`
- [ ] Use verification token: Your `NOTION_WEBHOOK_SECRET` value
- [ ] Set trigger to "Page updated"
- [ ] Test with a new page set to "Ready for Dev"

---

**Your Webhook URL**: `https://quinquaginta.serveo.net/webhook/notion`
**Verification Token**: Use your `NOTION_WEBHOOK_SECRET` value
