# 🔐 Secret Rotation Guide

## Manual Token Rotation (Recommended - Every 30 Days)

### Step 1: Generate New Tokens

#### Notion API Key
1. Go to: https://www.notion.so/my-integrations
2. Select your integration
3. Click "Regenerate Token"
4. Copy the new token

#### Jira API Token
1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name: `Jira-Notion-Automation-[Date]`
4. Copy the token

### Step 2: Update Local Environment

Edit your `.env` file:
```bash
# Update these with new tokens
NOTION_API_KEY=your_new_notion_token
JIRA_API_TOKEN=your_new_jira_token
```

### Step 3: Test New Tokens

```bash
node test-credentials.js
```

### Step 4: Update GitHub Secrets (if using GitHub deployment)

1. Go to: https://github.com/Ardit06/Automation_Jira_Notion/settings/secrets/actions
2. Update these secrets:
   - `NOTION_API_KEY`
   - `JIRA_API_TOKEN`

### Step 5: Update Deployment Platform

**For Railway:**
1. Go to your Railway project
2. Variables tab
3. Update `NOTION_API_KEY` and `JIRA_API_TOKEN`

**For Render:**
1. Go to your Render service
2. Environment tab
3. Update the tokens

### Step 6: Verify Deployment

1. Check service logs
2. Test a webhook trigger
3. Verify Jira ticket creation

## 📋 Secrets to Store in GitHub

For deployment and GitHub Actions, add these secrets:

1. **NOTION_API_KEY** - Your Notion integration token
2. **NOTION_USER_STORIES_DATABASE_ID** - Database ID for user stories
3. **NOTION_EPICS_DATABASE_ID** - Database ID for epics
4. **NOTION_WEBHOOK_SECRET** - Webhook verification secret
5. **JIRA_BASE_URL** - Your Jira instance URL
6. **JIRA_EMAIL** - Email for Jira authentication
7. **JIRA_API_TOKEN** - Your Jira API token
8. **JIRA_PROJECT_KEY** - Your Jira project key
9. **WEBHOOK_AUTH_USERS** - Authorized users for webhooks
10. **SCRUM_MASTER_EMAIL** - Email for notifications

## 📅 Rotation Schedule

- **Recommended:** Every 30 days
- **Minimum:** Every 90 days
- **Set calendar reminder:** First day of each month

## 🔒 Security Best Practices

1. ✅ Never commit `.env` file to GitHub
2. ✅ Use different tokens for dev/prod
3. ✅ Rotate immediately if compromised
4. ✅ Keep tokens in secure password manager
5. ✅ Use least privilege access

## ⚠️ Troubleshooting

### Token Not Working After Rotation
- Wait 5 minutes for propagation
- Clear any cached credentials
- Restart your service
- Check token permissions

### Service Down After Update
- Verify all tokens are updated
- Check deployment logs
- Ensure correct token format
- Test with `node test-credentials.js`

## 📝 Rotation Log Template

Keep track of rotations:

```
Date: 2025-10-22
Tokens Rotated: Notion API, Jira API
Tested: ✅ Yes
Production Updated: ✅ Yes
Notes: All systems working
```

## 🆘 Emergency Rotation

If tokens are compromised:

1. **Immediately revoke** old tokens
2. **Generate new** tokens
3. **Update** all environments ASAP
4. **Test** thoroughly
5. **Monitor** for suspicious activity
6. **Document** the incident

---

**Last Updated:** 2025-10-22
**Next Rotation Due:** 2025-11-22
