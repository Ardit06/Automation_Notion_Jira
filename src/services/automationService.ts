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

      // Determine which database this page belongs to
      const databaseType = await this.notionService.determineDatabaseFromPage(pageId);
      logger.info(`📊 Page ${pageId} belongs to ${databaseType} database`);

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
        
        // Handle status changes for existing issues
        const statusChangeResult = await this.handleStatusChange(pageId);
        if (statusChangeResult.handled) {
          logger.info(`✅ Status change handled for page ${pageId}: ${statusChangeResult.oldStatus} → ${statusChangeResult.newStatus}`);
        } else {
          logger.info(`💡 This page is already linked to a Jira issue - no status change detected`);
        }
        return;
      }

      // Determine if this should be an Epic or Story based on database type and page content
      const isEpic = databaseType === 'epics' || 
                    pageData.isEpic === true || 
                    (pageData.title && pageData.title.toLowerCase().includes('epic'));

      // Check for duplicates by title to prevent creating multiple tickets
      const duplicateIssue = await this.jiraService.findDuplicateIssue(pageData.title, isEpic ? 'Epic' : 'Story');
      if (duplicateIssue) {
        logger.warn(`⚠️ DUPLICATE ISSUE DETECTED:`);
        logger.warn(`   📋 Existing Jira Key: ${duplicateIssue.key}`);
        logger.warn(`   📝 Title: "${duplicateIssue.fields.summary}"`);
        logger.warn(`   📄 Notion Page: ${pageId}`);
        logger.warn(`   🚫 Skipping creation to prevent duplication`);
        
        // Link the existing Jira issue to this Notion page
        await this.notionService.addJiraLink(pageId, duplicateIssue.key, this.jiraService.buildJiraUrl(duplicateIssue.key));
        logger.info(`✅ Linked existing Jira issue ${duplicateIssue.key} to Notion page ${pageId}`);
        return;
      }

      // Only create Jira ticket when status is "Ready For Dev"
      if (pageData.status !== 'Ready For Dev') {
        logger.info(`⏸️ Skipping Jira ticket creation - status is '${pageData.status}', waiting for 'Ready For Dev'`);
        return;
      }
      
      logger.info(`Creating Jira ticket for page ${pageId} with status: '${pageData.status}'`);

      const issueType = pageData.issueType || (isEpic ? 'Epic' : 'Story');
      
      logger.info(`🏷️ Issue type determined: ${issueType} (Database: ${databaseType}, Epic fields: ${isEpic})`);

      logger.info(`✅ NO DUPLICATES FOUND: Creating new Jira issue with title "${pageData.title}"`);

      // Create issue in Jira based on priority
      let jiraIssue;
      const jiraUrl = this.jiraService.buildJiraUrl('');
      
      // Build Notion URL
      const notionUrl = `https://www.notion.so/${pageId.replace(/-/g, '')}`;
      
      logger.info(`🎯 CREATING NEW JIRA ISSUE:`);
      logger.info(`   📄 Notion Page ID: ${pageId}`);
      logger.info(`   📊 Database Type: ${databaseType}`);
      logger.info(`   📝 Title: "${pageData.title}"`);
      logger.info(`   🏷️ Issue Type: ${issueType} ${isEpic ? '(Epic - from ' + databaseType + ' database)' : '(Story - from ' + databaseType + ' database)'}`);
      logger.info(`   📊 Status: ${pageData.status}`);
      logger.info(`   ⚡ Priority: ${pageData.priority}`);
      logger.info(`   📅 Due Date: ${pageData.dueDate || 'Not set'}`);
      logger.info(`   🔗 Notion URL: ${notionUrl}`);
      logger.info(`   📋 Description: "${pageData.description?.substring(0, 100)}${(pageData.description?.length || 0) > 100 ? '...' : ''}"`);
      if (pageData.parentEpic) {
        logger.info(`   🔗 Parent Epic: ${pageData.parentEpic}`);
      }
      if (isEpic && (pageData.devStartDate || pageData.devEndDate || pageData.owner)) {
        logger.info(`   🏗️ Epic-worthy page detected: Dev Start=${pageData.devStartDate}, Dev End=${pageData.devEndDate}, Owner=${pageData.owner}`);
      }
      if (!isEpic && (pageData.initiativeStatus || pageData.initiatives || pageData.reqStartDate)) {
        logger.info(`   📝 User Story page detected: Initiative Status=${pageData.initiativeStatus}, Initiatives=${pageData.initiatives}, Req Start=${pageData.reqStartDate}`);
      }

      if (isEpic) {
        // Create Epic based on database type and Epic field from Notion
        logger.info(`🏗️ Creating Epic for: "${pageData.title}" (Database: ${databaseType}, Epic field: Yes)`);
        logger.info(`📅 Epic dates: Start=${pageData.startDate}, End=${pageData.endDate}`);
        logger.info(`📝 Epic description: "${pageData.description?.substring(0, 200)}..."`);
        
        jiraIssue = await this.jiraService.createEpic(
          pageData.title,
          pageData.description,
          pageData.dueDate,
          pageData.priority,
          notionUrl,
          pageData.startDate,
          pageData.endDate,
          pageData.requirementsEngineer
        );
        
        logger.info(`✅ Epic created successfully: ${jiraIssue.key}`);
        
        // Update the Jira Epic Link field in Notion (Epics database)
        const jiraUrl = this.jiraService.buildJiraUrl(jiraIssue.key);
        await this.notionService.updateJiraEpicLink(pageId, jiraIssue.key, jiraUrl);
        
        // Add Notion creation comment
        await this.jiraService.addNotionCreationComment(jiraIssue.key, pageData.title);
        
        // Comment monitoring disabled - using automatic review workflow
      } else {
        // Create Story - check for parent Epic from Notion field
        let epicKey: string | null = null;
        
        // First, try to use the Parent Epic field from Notion
        if (pageData.parentEpic) {
          logger.info(`🔗 Using Parent Epic from Notion field: ${pageData.parentEpic}`);
          epicKey = pageData.parentEpic;
        } else {
          // Fallback: Try to find a related epic by title similarity
          epicKey = await this.findRelatedEpic(pageData.title);
        }
        
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
          pageData.blueDate,
          pageData.requirementsEngineer
        );
        
        logger.info(`✅ Story created successfully: ${jiraIssue.key}`);
        
        // Update the Jira Link field in Notion (User Stories database)
        const jiraUrl = this.jiraService.buildJiraUrl(jiraIssue.key);
        await this.notionService.updateJiraLink(pageId, jiraIssue.key, jiraUrl);
        
        // Add Notion creation comment
        await this.jiraService.addNotionCreationComment(jiraIssue.key, pageData.title);
        
        // No email notification on initial creation - only on status changes
        
        // Comment monitoring disabled - using automatic review workflow
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
      logger.info('Starting sync of all pages in both databases');

      // Query all pages in both Notion databases
      const [userStoriesPages, epicsPages] = await Promise.all([
        this.notionService.queryUserStoriesDatabase(),
        this.notionService.queryEpicsDatabase()
      ]);

      const totalPages = userStoriesPages.length + epicsPages.length;
      logger.info(`Found ${userStoriesPages.length} pages in User Stories database`);
      logger.info(`Found ${epicsPages.length} pages in Epics database`);
      logger.info(`Total pages to process: ${totalPages}`);

      let processedCount = 0;
      
      // Process User Stories pages
      for (const page of userStoriesPages) {
        try {
          await this.processNotionPageUpdate(page.id);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing User Story page ${page.id}:`, error);
          // Continue with other pages even if one fails
        }
      }

      // Process Epics pages
      for (const page of epicsPages) {
        try {
          await this.processNotionPageUpdate(page.id);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing Epic page ${page.id}:`, error);
          // Continue with other pages even if one fails
        }
      }

      logger.info(`Completed sync of ${processedCount} pages from both databases`);
    } catch (error) {
      logger.error('Error during bulk sync:', error);
      throw error;
    }
  }

  async testConnections(): Promise<{ notion: boolean; jira: boolean; email: boolean }> {
    const results = {
      notion: false,
      jira: false,
      email: false,
    };

    try {
      // Test Notion connections for both databases
      await Promise.all([
        this.notionService.getUserStoriesDatabase(),
        this.notionService.getEpicsDatabase()
      ]);
      results.notion = true;
      logger.info('Notion connection test: SUCCESS (both databases)');
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

    try {
      // Email service removed - no longer needed
      results.email = true;
    } catch (error) {
      logger.error('Email connection test: FAILED', error);
    }

    return results;
  }


  async handleStatusChange(pageId: string): Promise<{ handled: boolean; oldStatus?: string; newStatus?: string }> {
    try {
      // Get current page data
      const page = await this.notionService.getPage(pageId);
      const currentPageData = await this.notionService.extractPageData(page);
      
      // Get cached page data to compare
      const cachedData = this.pageStateCache.get(pageId);
      
      if (!cachedData) {
        // First time processing this page, cache the data
        this.pageStateCache.set(pageId, {
          status: currentPageData.status,
          lastUpdated: new Date().toISOString()
        });
        return { handled: false };
      }

      const oldStatus = cachedData.status;
      const newStatus = currentPageData.status;

      // Check if status actually changed
      if (oldStatus === newStatus) {
        return { handled: false };
      }

      logger.info(`📊 Status change detected for page ${pageId}: ${oldStatus} → ${newStatus}`);

      // Check if there's an existing JIRA link
      const jiraLinkResult = await this.notionService.checkJiraLinkExists(pageId);
      
      if (!jiraLinkResult.exists || !jiraLinkResult.jiraKey) {
        logger.info(`⚠️ No JIRA link found for page ${pageId} - cannot add status change comment`);
        return { handled: false };
      }

      const jiraKey = jiraLinkResult.jiraKey;

      // Define status change triggers - focus on "back to Ready for Dev"
      const statusChangeTriggers = [
        { from: 'Review', to: 'Ready For Dev' }, // Back to ready for dev
        { from: 'In Progress', to: 'Ready For Dev' }, // Back to ready
        { from: 'In Review', to: 'Ready For Dev' }, // Back to ready from review
        { from: 'Done', to: 'Ready For Dev' } // Back to ready from done
      ];

      // Check if this status change should trigger a comment
      const shouldComment = statusChangeTriggers.some(trigger => 
        trigger.from === oldStatus && trigger.to === newStatus
      );

      if (!shouldComment) {
        logger.info(`ℹ️ Status change ${oldStatus} → ${newStatus} does not require comment`);
        // Update cache but don't comment
        this.pageStateCache.set(pageId, {
          status: newStatus,
          lastUpdated: new Date().toISOString()
        });
        return { handled: false };
      }

      // Add comment to JIRA
      const scrumMasterEmail = config.notifications.scrumMasterEmail;
      const commentAdded = await this.jiraService.addStatusChangeComment(
        jiraKey,
        oldStatus!,
        newStatus!,
        scrumMasterEmail as string
      );

      if (commentAdded) {
        logger.info(`✅ Status change comment added to ${jiraKey}`);
        
        // Email notifications removed - no longer needed

        // Special handling: If status changed to "Ready For Dev", tag the appropriate person
        if (newStatus === 'Ready For Dev') {
          logger.info(`🚀 Status changed to "Ready For Dev" - adding tagged comment`);
          
          // First, check if the issue is resolved and reopen it if needed
          const issueStatus = await this.jiraService.getIssueStatus(jiraKey);
          if (issueStatus === 'Done' || issueStatus === 'Resolved') {
            logger.info(`🔄 Issue ${jiraKey} is resolved, reopening for Ready For Dev status`);
            await this.jiraService.reopenIssue(jiraKey, currentPageData.title || 'Unknown Issue');
          }
          
          // Determine who to tag based on available data
          let taggedUserEmail: string | undefined;
          let taggedUserName: string | undefined;
          
          // Priority 1: Use Requirements Engineer if available
          if (currentPageData.requirementsEngineer) {
            taggedUserEmail = currentPageData.requirementsEngineer;
            taggedUserName = 'Requirements Engineer';
            logger.info(`👤 Tagging Requirements Engineer: ${currentPageData.requirementsEngineer}`);
          } else {
            // Priority 2: Use a default person (Aurita Bytyqi)
            taggedUserEmail = 'aurita@91.life';
            taggedUserName = 'Aurita Bytyqi';
            logger.info(`👤 Tagging default person: Aurita Bytyqi (aurita@91.life)`);
          }
          
          const readyForDevComment = await this.jiraService.addReadyForDevTagComment(
            jiraKey,
            currentPageData.title || 'Unknown Issue',
            taggedUserEmail,
            taggedUserName
          );
          
          if (readyForDevComment) {
            logger.info(`✅ Ready For Dev tagged comment added to ${jiraKey} for ${taggedUserName}`);
          }
        }

        // Special handling: If status changed FROM "Ready For Dev" to something else, resolve the Jira issue
        if (oldStatus === 'Ready For Dev' && newStatus !== 'Ready For Dev') {
          logger.info(`🔄 Status changed FROM "Ready For Dev" to "${newStatus}" - resolving Jira issue ${jiraKey}`);
          
          const resolved = await this.jiraService.resolveIssue(jiraKey, newStatus || 'Unknown Status', currentPageData.title || 'Unknown Issue');
          
          if (resolved) {
            logger.info(`✅ Jira issue ${jiraKey} resolved due to status change away from Ready For Dev`);
          } else {
            logger.warn(`⚠️ Failed to resolve Jira issue ${jiraKey}`);
          }
        }
      }

      // Update cache
      this.pageStateCache.set(pageId, {
        status: newStatus,
        lastUpdated: new Date().toISOString()
      });

      return { handled: true, oldStatus, newStatus };

    } catch (error) {
      logger.error(`Error handling status change for page ${pageId}:`, error);
      return { handled: false };
    }
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
