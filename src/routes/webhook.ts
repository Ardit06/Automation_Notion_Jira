import { Router, Request, Response } from 'express';
import { AutomationService } from '../services/automationService';
import { NotionService } from '../services/notionService';
import { JiraService } from '../services/jiraService';
import { logger } from '../services/loggerService';
import { config } from '../config';

const router = Router();
const automationService = new AutomationService();
const notionService = new NotionService();
const jiraService = new JiraService();

// Export the webhook handler function for use in other routes
export const webhookHandler = async (req: Request, res: Response) => {
  try {
    logger.info('Received Notion webhook request:', {
      headers: req.headers,
      body: req.body,
      method: req.method
    });

    // Handle webhook verification - try all possible formats
    if (req.body) {
      // Check for verification_token
      if (req.body.verification_token) {
        logger.info('Received webhook verification request with token:', req.body.verification_token);
        const token = req.body.verification_token;
        
        // Try format 1: Just the token value as plain text
        logger.info('Sending verification response (plain text):', token);
        return res.status(200).send(token);
      }
      
      // Check for challenge
      if (req.body.challenge) {
        logger.info('Received challenge request:', req.body.challenge);
        const challenge = req.body.challenge;
        logger.info('Sending challenge response:', { challenge: challenge });
        return res.status(200).json({ challenge: challenge });
      }
      
      // Check for verification type
      if (req.body.type === 'verification') {
        logger.info('Received verification type request:', req.body);
        const token = req.body.verification_token || req.body.challenge;
        logger.info('Sending verification type response:', { verification_token: token });
        return res.status(200).json({ verification_token: token });
      }
      
      // Check for any verification-related fields
      if (req.body.verification || req.body.token) {
        logger.info('Received verification request with alternative format:', req.body);
        const token = req.body.verification || req.body.token;
        logger.info('Sending alternative verification response:', { verification_token: token });
        return res.status(200).json({ verification_token: token });
      }
    }

      const signature = req.headers['x-notion-signature-v2'] as string;
      const payload = JSON.stringify(req.body);

      // Production: always verify when Notion sends a signature. Dev: set ALLOW_UNSIGNED_WEBHOOKS=true in .env to skip (curl/Postman).
      if (signature) {
        const skipVerify =
          config.server.nodeEnv !== 'production' && config.security.allowUnsignedWebhooks;
        if (!skipVerify && !notionService.verifyWebhookSignature(payload, signature)) {
          logger.warn('Invalid webhook signature received');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

    const webhookData = req.body;
    logger.info('Received Notion webhook:', JSON.stringify(webhookData, null, 2));

      // Process webhook events - handle both old and new formats
      if (webhookData.type && webhookData.type.startsWith('page.')) {
        // New format: { type: "page.updated", entity: { id: "page-id" } }
        const pageId = webhookData.entity?.id;
        if (pageId) {
          try {
            logger.info(`📥 Processing ${webhookData.type} for page: ${pageId}`);
            logger.info(`🔄 Triggering automation for page update...`);
            await automationService.processNotionPageUpdate(pageId);
            logger.info(`✅ Successfully processed webhook for page: ${pageId}`);
          } catch (error: any) {
            logger.error(`❌ Error processing webhook for page ${pageId}:`, error);
            logger.error(`   Error message: ${error.message}`);
            logger.error(`   Error stack: ${error.stack}`);
            // Don't throw - return success to Notion so it doesn't retry
          }
        } else {
          logger.warn('⚠️ No page ID found in webhook data');
          logger.warn(`   Webhook data: ${JSON.stringify(webhookData, null, 2)}`);
        }
      } else if (webhookData.object === 'page' && webhookData.entry && Array.isArray(webhookData.entry)) {
        // Old format: { object: "page", entry: [{ id: "page-id", time: "timestamp" }] }
        logger.info(`📥 Processing old format webhook with ${webhookData.entry.length} entries`);
        for (const entry of webhookData.entry) {
          if (entry.id) {
            try {
              logger.info(`🔄 Processing page update for page: ${entry.id}`);
              await automationService.processNotionPageUpdate(entry.id);
              logger.info(`✅ Successfully processed webhook for page: ${entry.id}`);
            } catch (error: any) {
              logger.error(`❌ Error processing webhook for page ${entry.id}:`, error);
              logger.error(`   Error message: ${error.message}`);
              // Continue processing other entries even if one fails
            }
          } else {
            logger.warn(`⚠️ Entry without ID found: ${JSON.stringify(entry)}`);
          }
        }
      } else {
        logger.info(`ℹ️ Ignoring webhook event type: ${webhookData.type || 'unknown'}`);
        logger.debug(`   Full webhook data: ${JSON.stringify(webhookData, null, 2)}`);
      }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing Notion webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Notion webhook endpoint
router.post('/notion', webhookHandler);

// Manual sync endpoint
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    // Check authorization
    if (userId && !config.security.authorizedUsers.includes(userId)) {
      return res.status(403).json({ error: 'Unauthorized user' });
    }

    await automationService.syncAllReadyForDevPages();
    res.status(200).json({ success: true, message: 'Sync completed' });
  } catch (error) {
    logger.error('Error during manual sync:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test connections endpoint
router.get('/test', async (req: Request, res: Response) => {
  try {
    const results = await automationService.testConnections();
    res.status(200).json(results);
  } catch (error) {
    logger.error('Error testing connections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Check for missing updates endpoint
router.get('/check-updates', async (req: Request, res: Response) => {
  try {
    logger.info('Received request to check for missing updates');
    // This endpoint is not yet implemented
    res.status(200).json({ message: 'Feature not yet implemented' });
  } catch (error) {
    logger.error('Error checking for missing updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user stories from epic endpoint
router.post('/create-stories-from-epic', async (req: Request, res: Response) => {
  try {
    const { epicKey, epicTitle, userStories } = req.body;

    if (!userStories || !Array.isArray(userStories) || userStories.length === 0) {
      return res.status(400).json({ 
        error: 'userStories array is required and must not be empty' 
      });
    }

    if (!epicKey && !epicTitle) {
      return res.status(400).json({ 
        error: 'Either epicKey or epicTitle must be provided' 
      });
    }

    logger.info('Received request to create user stories from epic');
    logger.info(`Epic Key: ${epicKey || 'N/A'}, Epic Title: ${epicTitle || 'N/A'}`);
    logger.info(`Number of user stories: ${userStories.length}`);

    let results;
    if (epicKey) {
      results = await automationService.createUserStoriesFromEpic(epicKey, userStories);
    } else {
      results = await automationService.createUserStoriesFromEpicByTitle(epicTitle, userStories);
    }

    res.status(200).json({
      success: true,
      ...results
    });
  } catch (error: any) {
    logger.error('Error creating user stories from epic:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Simple test endpoint to create an Epic in PO project
router.post('/test-epic', async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    
    const testTitle = title || 'Test Epic - Patient Chart Patient Summary';
    const testDescription = description || 'This is a test Epic created to verify the automation is working correctly in PO project.';
    
    logger.info(`🧪 Testing Epic creation in PO project`);
    logger.info(`📝 Title: "${testTitle}"`);
    
    // Create Epic directly in Jira
    const jiraIssue = await jiraService.createEpic(
      testTitle,
      testDescription,
      undefined, // dueDate
      undefined, // priority
      undefined, // notionUrl
      undefined, // startDate
      undefined, // endDate
      undefined  // figmaLink
    );
    
    logger.info(`✅ Test Epic created successfully: ${jiraIssue.key}`);
    
    res.status(200).json({
      success: true,
      message: 'Test Epic created successfully',
      epic: {
        key: jiraIssue.key,
        title: testTitle,
        url: `https://91life.atlassian.net/browse/${jiraIssue.key}`
      }
    });
  } catch (error: any) {
    logger.error('Error creating test Epic:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: error.response?.data
    });
  }
});

// Test processing a specific Notion page
router.post('/test-page', async (req: Request, res: Response) => {
  try {
    const { pageId, pageUrl } = req.body;

    if (!pageId && !pageUrl) {
      return res.status(400).json({ 
        error: 'Either pageId or pageUrl must be provided' 
      });
    }

    // Extract page ID from URL if provided
    let notionPageId = pageId;
    if (pageUrl && !pageId) {
      // Extract page ID from Notion URL
      // Format: https://www.notion.so/workspace/Title-{pageId}
      // The page ID is 32 hex characters, optionally with hyphens
      let match = pageUrl.match(/-([a-f0-9]{32})$/i);
      if (!match) {
        // Try alternative format: .../{pageId} or .../{pageId}?...
        match = pageUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
      }
      if (match && match[1]) {
        // Format page ID with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        const id = match[1];
        notionPageId = `${id.substring(0, 8)}-${id.substring(8, 12)}-${id.substring(12, 16)}-${id.substring(16, 20)}-${id.substring(20, 32)}`;
        logger.info(`📝 Extracted page ID from URL: ${notionPageId}`);
      } else {
        return res.status(400).json({ 
          error: 'Could not extract page ID from URL. Please provide pageId directly.',
          url: pageUrl
        });
      }
    }

    logger.info(`🧪 Testing Notion page processing: ${notionPageId}`);
    logger.info(`📄 Page URL: ${pageUrl || 'N/A'}`);

    // Process the page
    await automationService.processNotionPageUpdate(notionPageId);

    res.status(200).json({
      success: true,
      message: 'Page processing completed',
      pageId: notionPageId,
      pageUrl: pageUrl || 'N/A'
    });
  } catch (error: any) {
    logger.error('Error testing Notion page:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
});

export default router;
