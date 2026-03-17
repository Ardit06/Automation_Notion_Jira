import express from 'express';
import cors from 'cors';
import webhookRoutes, { webhookHandler } from './routes/webhook';
import { AutomationService } from './services/automationService';
import { logger } from './services/loggerService';
import { config } from './config';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Routes
app.use('/webhook', webhookRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Notion to Jira Automation Service - 91.life',
    version: '1.0.0',
    author: 'Ardit @ 91.life',
    endpoints: {
      webhook: '/webhook/notion',
      sync: '/webhook/sync',
      test: '/webhook/test',
      testPage: '/webhook/test-page',
      health: '/webhook/health',
      checkUpdates: '/webhook/check-updates',
      createStoriesFromEpic: '/webhook/create-stories-from-epic',
    },
  });
});

// Handle Notion webhook verification at root path (for incorrect URLs)
app.post('/', (req, res) => {
  logger.info('Received POST request at root path:', req.body);
  
  // Handle webhook verification - try all possible formats (matching webhookHandler logic)
  if (req.body) {
    // Check for verification_token
    if (req.body.verification_token) {
      logger.info('Received webhook verification request at root path:', req.body.verification_token);
      const token = req.body.verification_token;
      // Try format 1: Just the token value as plain text
      logger.info('Sending verification response (plain text):', token);
      return res.status(200).send(token);
    }
    
    // Check for challenge
    if (req.body.challenge) {
      logger.info('Received challenge request at root path:', req.body.challenge);
      const challenge = req.body.challenge;
      logger.info('Sending challenge response:', { challenge: challenge });
      return res.status(200).json({ challenge: challenge });
    }
    
    // Check for verification type
    if (req.body.type === 'verification') {
      logger.info('Received verification type request at root path:', req.body);
      const token = req.body.verification_token || req.body.challenge;
      logger.info('Sending verification type response:', { verification_token: token });
      return res.status(200).json({ verification_token: token });
    }
  }
  
  // Process webhook events at root path (since Notion is sending them here)
  logger.info('Processing webhook event at root path, calling webhookHandler...');
  return webhookHandler(req, res);
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);
  logger.info(`Notion User Stories Database ID: ${config.notion.userStoriesDatabaseId}`);
  logger.info(`Notion Epics Database ID: ${config.notion.epicsDatabaseId}`);
  logger.info(`Jira Project Key: ${config.jira.projectKey}`);
  
  // Comment monitoring disabled - tickets will get a creation comment when created from Notion
  logger.info('📝 Comment monitoring disabled - tickets will get creation comments instead');
});

export default app;


