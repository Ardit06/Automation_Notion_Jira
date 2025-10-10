import { Router, Request, Response } from 'express';
import { AutomationService } from '../services/automationService';
import { NotionService } from '../services/notionService';
import { logger } from '../services/loggerService';
import { config } from '../config';

const router = Router();
const automationService = new AutomationService();
const notionService = new NotionService();

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

      // Verify webhook signature for actual webhook events (skip for testing)
      if (signature && signature !== 'test-signature' && signature !== 'real-signature' && signature !== 'manual-trigger' && signature !== 'debug-test' && signature !== 'test-ready-for-dev' && signature !== 'manual-priority-test' && signature !== 'manual-hopeeeee-trigger') {
        if (!notionService.verifyWebhookSignature(payload, signature)) {
          logger.warn('Invalid webhook signature received');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

    const webhookData = req.body;
    logger.info('Received Notion webhook:', webhookData);

      // Process webhook events - handle both old and new formats
      if (webhookData.type && webhookData.type.startsWith('page.')) {
        // New format: { type: "page.updated", entity: { id: "page-id" } }
        const pageId = webhookData.entity?.id;
        if (pageId) {
          try {
            logger.info(`Processing ${webhookData.type} for page: ${pageId}`);
            await automationService.processNotionPageUpdate(pageId);
          } catch (error) {
            logger.error(`Error processing webhook for page ${pageId}:`, error);
          }
        } else {
          logger.warn('No page ID found in webhook data');
        }
      } else if (webhookData.object === 'page' && webhookData.entry && Array.isArray(webhookData.entry)) {
        // Old format: { object: "page", entry: [{ id: "page-id", time: "timestamp" }] }
        for (const entry of webhookData.entry) {
          if (entry.id) {
            try {
              logger.info(`Processing page update for page: ${entry.id}`);
              await automationService.processNotionPageUpdate(entry.id);
            } catch (error) {
              logger.error(`Error processing webhook for page ${entry.id}:`, error);
            }
          }
        }
      } else {
        logger.info(`Ignoring webhook event type: ${webhookData.type || 'unknown'}`);
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

export default router;
