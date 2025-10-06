import { NotionService } from './notionService';
import { JiraService } from './jiraService';
import { NotionPage } from '../types';
import { logger } from './loggerService';
import { config } from '../config';

export class AutomationService {
  private notionService: NotionService;
  private jiraService: JiraService;
  private pageStateCache: Map<string, any> = new Map(); // Cache for tracking page states

  constructor() {
    this.notionService = new NotionService();
    this.jiraService = new JiraService();
  }

  async processNotionPageUpdate(pageId: string, userId?: string): Promise<void> {
    try {
      logger.info(`🔄 Processing Notion page update: ${pageId}`);
      logger.info(`📅 Timestamp: ${new Date().toISOString()}`);

      // Check if user is authorized
      if (userId && !config.security.authorizedUsers.includes(userId)) {
        logger.warn(`Unauthorized user ${userId} attempted to trigger automation`);
        return;
      }

      // Get the page from Notion
      logger.info(`📄 Fetching page from Notion API...`);
      const page = await this.notionService.getPage(pageId);
      logger.info(`📄 Page fetched successfully. Page ID: ${page.id}`);
      logger.info(`📄 Page properties keys: ${Object.keys(page.properties).join(', ')}`);
      
      const pageData = await this.notionService.extractPageData(page);
      
      logger.info(`📊 EXTRACTED PAGE DATA:`);
      logger.info(`   Title: "${pageData.title}"`);
      logger.info(`   Status: "${pageData.status}"`);
      logger.info(`   Priority: "${pageData.priority}"`);
      logger.info(`   Description: "${pageData.description?.substring(0, 100)}..."`);
      logger.info(`   Full page data: ${JSON.stringify(pageData, null, 2)}`);

      // Get previous page state for change tracking
      const previousState = this.pageStateCache.get(pageId);

      // Validate that we have a proper title before creating Jira ticket
      if (!pageData.title || pageData.title.trim() === '' || pageData.title === 'Untitled') {
        logger.warn(`⚠️ Skipping Jira ticket creation - no valid title found for page ${pageId}`);
        logger.warn(`   Title value: "${pageData.title}"`);
        logger.warn(`   Please ensure the Notion page has a proper title in the 'Name' field`);
        return;
      }

      // Check if Jira link already exists
      const existingLink = await this.notionService.checkJiraLinkExists(pageId);
      if (existingLink.exists) {
        logger.info(`🔗 EXISTING JIRA LINK FOUND:`);
        logger.info(`   📋 Jira Key: ${existingLink.jiraKey}`);
        logger.info(`   🔗 Jira URL: ${existingLink.jiraUrl}`);
        logger.info(`   📄 Notion Page: ${pageId}`);
        
        // Check if this is a "Ready for Dev" status change
        if (pageData.status === 'READY FOR DEV') {
          logger.info(`🚀 READY FOR DEV STATUS DETECTED - Updating existing Jira issue`);
          await this.updateExistingJiraIssue(existingLink.jiraKey!, pageData, pageId);
        } else {
          logger.info(`💡 This page is already linked to a Jira issue - skipping creation`);
        }
        return;
      }

      // Create Jira ticket for any page (removed status check)
      logger.info(`Creating Jira ticket for page ${pageId} with status: '${pageData.status}'`);

      // Determine if this should be an Epic or Story based on priority
      const isEpic = pageData.priority?.toLowerCase() === 'high';
      const issueType = isEpic ? 'Epic' : 'Story';

      // Check for duplicates in Jira by title
      logger.info(`🔍 Checking for duplicate Jira issues with title: "${pageData.title}"`);
      const duplicateIssue = await this.jiraService.findDuplicateIssue(
        pageData.title,
        issueType
      );

      if (duplicateIssue) {
        logger.info(`✅ DUPLICATE FOUND: Jira issue ${duplicateIssue.key} already exists with the same title`);
        logger.info(`   📋 Existing Issue: ${duplicateIssue.key} - "${duplicateIssue.fields.summary}"`);
        logger.info(`   🔗 Status: ${duplicateIssue.fields.status?.name || 'Unknown'}`);
        logger.info(`   📅 Created: ${duplicateIssue.fields.created || 'Unknown'}`);
        logger.info(`   🔄 Linking Notion page to existing Jira issue...`);
        
        try {
          await this.notionService.addJiraLink(pageId, duplicateIssue.key, this.jiraService.buildJiraUrl(duplicateIssue.key));
          logger.info(`✅ SUCCESS: Notion page linked to existing Jira issue ${duplicateIssue.key}`);
          logger.info(`   🔗 Jira URL: ${this.jiraService.buildJiraUrl(duplicateIssue.key)}`);
        } catch (error) {
          logger.error(`❌ ERROR: Failed to link Notion page to existing Jira issue:`, error);
        }
        return;
      }

      logger.info(`✅ NO DUPLICATES FOUND: Creating new Jira issue with title "${pageData.title}"`);

      // Create issue in Jira based on priority
      let jiraIssue;
      const jiraUrl = this.jiraService.buildJiraUrl('');
      
      // Build Notion URL
      const notionUrl = `https://www.notion.so/${pageId.replace(/-/g, '')}`;
      
      logger.info(`🎯 CREATING NEW JIRA ISSUE:`);
      logger.info(`   📄 Notion Page ID: ${pageId}`);
      logger.info(`   📝 Title: "${pageData.title}"`);
      logger.info(`   🏷️ Issue Type: ${issueType} ${isEpic ? '(High Priority Epic)' : '(Story)'}`);
      logger.info(`   📊 Status: ${pageData.status}`);
      logger.info(`   ⚡ Priority: ${pageData.priority}`);
      logger.info(`   📅 Due Date: ${pageData.dueDate || 'Not set'}`);
      logger.info(`   🔗 Notion URL: ${notionUrl}`);
      logger.info(`   📋 Description: "${pageData.description?.substring(0, 100)}${(pageData.description?.length || 0) > 100 ? '...' : ''}"`);

      if (isEpic) {
        // Create Epic for high priority items
        logger.info(`🏗️ Creating Epic for: "${pageData.title}" (Priority: ${pageData.priority})`);
        logger.info(`📅 Epic dates: Start=${pageData.startDate}, End=${pageData.endDate}`);
        logger.info(`📝 Epic description: "${pageData.description?.substring(0, 200)}..."`);
        
        jiraIssue = await this.jiraService.createEpic(
          pageData.title,
          pageData.description,
          pageData.dueDate,
          pageData.priority,
          notionUrl,
          pageData.startDate,
          pageData.endDate
        );
        
        logger.info(`✅ Epic created successfully: ${jiraIssue.key}`);
      } else {
        // Create Story - try to find a related Epic
        let epicKey: string | null = null;
        
        // Try to find a related epic by title similarity
        epicKey = await this.findRelatedEpic(pageData.title);
        
        if (epicKey) {
          logger.info(`🔗 Creating Story linked to Epic ${epicKey}: "${pageData.title}"`);
        } else {
          logger.info(`📝 Creating standalone Story: "${pageData.title}"`);
        }
        
        logger.info(`📝 Story description: "${pageData.description?.substring(0, 200)}..."`);
        logger.info(`📊 Story points: ${pageData.storyPoints}`);

        jiraIssue = await this.jiraService.createStory(
          pageData.title,
          pageData.description,
          epicKey || undefined,
          pageData.storyPoints,
          pageData.labels,
          pageData.dueDate,
          pageData.priority,
          notionUrl,
          pageData.redDate,
          pageData.greenDate,
          pageData.blueDate
        );
        
        logger.info(`✅ Story created successfully: ${jiraIssue.key}`);
      }

      // Add Jira link back to Notion
      const jiraUrlWithKey = this.jiraService.buildJiraUrl(jiraIssue.key);
      logger.info(`🔗 Adding Jira link back to Notion page...`);
      
      try {
        await this.notionService.addJiraLink(pageId, jiraIssue.key, jiraUrlWithKey);
        logger.info(`✅ SUCCESS: Jira link added to Notion page`);
      } catch (error) {
        logger.error(`❌ WARNING: Failed to add Jira link to Notion page:`, error);
        logger.info(`   💡 The Jira issue was created successfully, but the link couldn't be added to Notion`);
      }

      logger.info(`🎉 AUTOMATION COMPLETE:`);
      logger.info(`   ✅ Jira Issue Created: ${jiraIssue.key}`);
      logger.info(`   📝 Title: "${pageData.title}"`);
      logger.info(`   🔗 Jira URL: ${jiraUrlWithKey}`);
      logger.info(`   📄 Notion Page: ${pageId}`);
      logger.info(`   🏷️ Issue Type: ${issueType}`);
      logger.info(`   ⚡ Priority: ${pageData.priority}`);
      logger.info(`   📊 Status: ${pageData.status}`);

      // Store current page state for future change tracking
      this.pageStateCache.set(pageId, { ...pageData });

    } catch (error) {
      logger.error(`Error processing Notion page update for ${pageId}:`, error);
      throw error;
    }
  }

  async syncAllReadyForDevPages(): Promise<void> {
    try {
      logger.info('Starting sync of all Ready For Dev pages');

      // Query Notion database for pages with "Ready For Dev" status
      const pages = await this.notionService.queryDatabase(
        config.notion.databaseId,
        {
          property: 'Status',
          select: {
            equals: 'Ready For Dev',
          },
        }
      );

      logger.info(`Found ${pages.length} pages with Ready For Dev status`);

      for (const page of pages) {
        try {
          await this.processNotionPageUpdate(page.id);
        } catch (error) {
          logger.error(`Error processing page ${page.id}:`, error);
          // Continue with other pages even if one fails
        }
      }

      logger.info('Completed sync of all Ready For Dev pages');
    } catch (error) {
      logger.error('Error during bulk sync:', error);
      throw error;
    }
  }

  async testConnections(): Promise<{ notion: boolean; jira: boolean }> {
    const results = {
      notion: false,
      jira: false,
    };

    try {
      // Test Notion connection
      await this.notionService.getDatabase(config.notion.databaseId);
      results.notion = true;
      logger.info('Notion connection test: SUCCESS');
    } catch (error) {
      logger.error('Notion connection test: FAILED', error);
    }

    try {
      // Test Jira connection
      results.jira = await this.jiraService.testConnection();
      if (results.jira) {
        logger.info('Jira connection test: SUCCESS');
      } else {
        logger.error('Jira connection test: FAILED');
      }
    } catch (error) {
      logger.error('Jira connection test: FAILED', error);
    }

    return results;
  }

  private async findRelatedEpic(storyTitle: string): Promise<string | null> {
    try {
      // Search for existing Epics
      const epics = await this.jiraService.searchIssues(
        `project = "${config.jira.projectKey}" AND issuetype = "Epic" ORDER BY created DESC`
      );

      // Simple keyword matching - look for common words
      const storyWords = storyTitle.toLowerCase().split(/\s+/);
      
      for (const epic of epics) {
        const epicWords = epic.fields.summary.toLowerCase().split(/\s+/);
        
        // Check if there are common words between story and epic titles
        const commonWords = storyWords.filter(word => 
          word.length > 3 && epicWords.includes(word)
        );
        
        if (commonWords.length > 0) {
          logger.info(`Found related Epic ${epic.key} for story "${storyTitle}" (common words: ${commonWords.join(', ')})`);
          return epic.key;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error finding related Epic:', error);
      return null;
    }
  }

  private async updateExistingJiraIssue(jiraKey: string, pageData: any, notionPageId: string): Promise<void> {
    try {
      logger.info(`🔄 UPDATING EXISTING JIRA ISSUE: ${jiraKey}`);
      
      // Get the current Jira issue to compare changes
      const currentIssue = await this.jiraService.getIssue(jiraKey);
      
      // Get previous Notion page state to detect changes
      const previousState = this.pageStateCache.get(notionPageId);
      const changes = this.detectNotionChanges(previousState, pageData);
      
      logger.info(`🔍 CHANGE DETECTION:`);
      if (previousState) {
        logger.info(`   📊 Previous state found - detecting changes...`);
        logger.info(`   📝 Changes detected: ${changes.length}`);
        changes.forEach(change => logger.info(`   • ${change}`));
      } else {
        logger.info(`   📊 No previous state found - this is the first update`);
      }
      
      // Prepare update data
      const updateData: any = {
        fields: {}
      };

      // Check if title has changed
      if (currentIssue.fields.summary !== pageData.title) {
        updateData.fields.summary = pageData.title;
        logger.info(`📝 Title updated: "${currentIssue.fields.summary}" → "${pageData.title}"`);
      }

      // Check if description has changed
      const currentDescription = (currentIssue.fields.description as any)?.content?.[0]?.content?.[0]?.text || '';
      if (currentDescription !== pageData.description) {
        updateData.fields.description = {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: pageData.description || ''
            }]
          }]
        };
        logger.info(`📄 Description updated`);
      }

      // Check if priority has changed
      const currentPriority = currentIssue.fields.priority?.name;
      const newPriority = this.mapPriorityToJira(pageData.priority);
      if (currentPriority !== newPriority) {
        updateData.fields.priority = { name: newPriority };
        logger.info(`⚡ Priority updated: "${currentPriority}" → "${newPriority}"`);
      }

      // Check if due date has changed
      if (pageData.dueDate) {
        const currentDueDate = currentIssue.fields.duedate;
        if (currentDueDate !== pageData.dueDate) {
          updateData.fields.duedate = pageData.dueDate;
          logger.info(`📅 Due date updated: "${currentDueDate}" → "${pageData.dueDate}"`);
        }
      }


      // Update the issue if there are changes
      if (Object.keys(updateData.fields).length > 0) {
        await this.jiraService.updateIssue(jiraKey, updateData);
        logger.info(`✅ Jira issue ${jiraKey} updated successfully`);
        
        // Create enhanced comment with change details
        const comment = this.createEnhancedComment(pageData, notionPageId, changes);
        
        await this.jiraService.addComment(jiraKey, comment);
        logger.info(`💬 Enhanced comment added to Jira issue ${jiraKey}`);
        
        // Tag team members if needed
        await this.tagTeamMembers(jiraKey, pageData);
        
      } else {
        logger.info(`ℹ️ No changes detected for Jira issue ${jiraKey}`);
      }

      // Update the page state cache with current data
      this.pageStateCache.set(notionPageId, pageData);

    } catch (error) {
      logger.error(`❌ Error updating Jira issue ${jiraKey}:`, error);
    }
  }

  private async tagTeamMembers(jiraKey: string, pageData: any): Promise<void> {
    try {
      // Add team members based on priority or other criteria
      const teamMembers = [];
      
      if (pageData.priority?.toLowerCase() === 'high') {
        teamMembers.push('@Asaini', '@Anissa');
      }
      
      if (teamMembers.length > 0) {
        const comment = `🏷️ **Team Notification**\n\n` +
          `Hey ${teamMembers.join(', ')}! This high-priority issue has been updated and is ready for development.`;
        
        await this.jiraService.addComment(jiraKey, comment);
        logger.info(`👥 Team members tagged in Jira issue ${jiraKey}: ${teamMembers.join(', ')}`);
      }
    } catch (error) {
      logger.error(`❌ Error tagging team members in Jira issue ${jiraKey}:`, error);
    }
  }

  public detectNotionChanges(previousState: any, currentState: any): string[] {
    const changes: string[] = [];
    
    if (!previousState) {
      return ['Initial creation'];
    }

    // Check title changes
    if (previousState.title !== currentState.title) {
      changes.push(`Title: "${previousState.title || 'Empty'}" → "${currentState.title || 'Empty'}"`);
    }

    // Check description changes
    if (previousState.description !== currentState.description) {
      const prevDesc = previousState.description || 'Empty';
      const currDesc = currentState.description || 'Empty';
      if (prevDesc.length > 50) {
        changes.push(`Description: Updated (${prevDesc.length} → ${currDesc.length} characters)`);
      } else {
        changes.push(`Description: "${prevDesc}" → "${currDesc}"`);
      }
    }

    // Check status changes
    if (previousState.status !== currentState.status) {
      changes.push(`Status: "${previousState.status || 'Empty'}" → "${currentState.status || 'Empty'}"`);
    }

    // Check priority changes
    if (previousState.priority !== currentState.priority) {
      changes.push(`Priority: "${previousState.priority || 'Empty'}" → "${currentState.priority || 'Empty'}"`);
    }

    // Check due date changes
    if (previousState.dueDate !== currentState.dueDate) {
      changes.push(`Due Date: "${previousState.dueDate || 'Not set'}" → "${currentState.dueDate || 'Not set'}"`);
    }


    // Check story points changes
    if (previousState.storyPoints !== currentState.storyPoints) {
      changes.push(`Story Points: "${previousState.storyPoints || 'Not set'}" → "${currentState.storyPoints || 'Not set'}"`);
    }

    return changes;
  }

  public createEnhancedComment(pageData: any, notionPageId: string, changes: string[]): string {
    const notionUrl = `https://www.notion.so/${notionPageId.replace(/-/g, '')}`;
    
    let comment = `🚀 **Ready for Dev - Notion Page Updated**\n\n`;
    comment += `📄 **Notion Page:** [View in Notion](${notionUrl})\n`;
    comment += `📊 **Current Status:** ${pageData.status}\n`;
    comment += `⚡ **Priority:** ${pageData.priority}\n`;
    comment += `📅 **Updated:** ${new Date().toLocaleString()}\n\n`;

    if (changes.length > 0) {
      comment += `📝 **Changes Made:**\n`;
      changes.forEach(change => {
        comment += `• ${change}\n`;
      });
      comment += `\n`;
    }

    comment += `*This issue was automatically updated from Notion when marked as "Ready for Dev".*`;
    
    return comment;
  }

  private mapPriorityToJira(notionPriority: string): string {
    const priorityMap: { [key: string]: string } = {
      'High': 'Highest',
      'Medium': 'High', 
      'Low': 'Medium',
      'Critical': 'Critical'
    };
    
    return priorityMap[notionPriority] || 'Medium';
  }
}
