import { NotionService } from './notionService';
import { JiraService } from './jiraService';
import { NotionPage } from '../types';
import { logger } from './loggerService';
import { config, JIRA_CUSTOM_FIELDS } from '../config';

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
      let page;
      try {
        page = await this.notionService.getPage(pageId);
      } catch (error: any) {
        // Check if the error is because the ID is a database, not a page
        if (error.response?.data?.message?.includes('is a database, not a page')) {
          logger.error(`❌ ERROR: The provided ID ${pageId} is a database, not a page.`);
          logger.error(`   Please provide a page ID from within the database, not the database ID itself.`);
          logger.error(`   To get a page ID: Open the page in Notion and copy the page ID from the URL.`);
          return;
        }
        throw error;
      }
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
      if (existingLink.exists && existingLink.jiraKey) {
        logger.info(`🔗 EXISTING JIRA LINK FOUND:`);
        logger.info(`   📋 Jira Key: ${existingLink.jiraKey}`);
        logger.info(`   🔗 Jira URL: ${existingLink.jiraUrl}`);
        logger.info(`   📄 Notion Page: ${pageId}`);
        
        // Determine if this is an Epic or Story
        const isEpic = databaseType === 'epics' || 
                      pageData.isEpic === true || 
                      (pageData.title && pageData.title.toLowerCase().includes('epic')) ||
                      (pageData.title && (
                        pageData.title.toLowerCase().includes('dashboard') ||
                        pageData.title.toLowerCase().includes('setup') ||
                        pageData.title.toLowerCase().includes('system') ||
                        pageData.title.toLowerCase().includes('platform') ||
                        pageData.title.toLowerCase().includes('feature')
                      ));
        
        // For existing epics, update them with new information instead of creating new ones
        if (isEpic) {
          logger.info(`🔄 Updating existing Epic ${existingLink.jiraKey} with new information from Notion`);
          
          // Update the epic with new information
          await this.updateJiraIssueContent(existingLink.jiraKey, pageData, pageId);
          
          logger.info(`✅ Epic ${existingLink.jiraKey} updated successfully`);
        } else {
          // For existing stories, also update them
          logger.info(`🔄 Updating existing Story ${existingLink.jiraKey} with new information from Notion`);
          
          // Update the story with new information
          await this.updateJiraIssueContent(existingLink.jiraKey, pageData, pageId);
          
          logger.info(`✅ Story ${existingLink.jiraKey} updated successfully`);
        }
        
        // Handle status changes for existing issues
        const statusChangeResult = await this.handleStatusChange(pageId);
        if (statusChangeResult.handled) {
          logger.info(`✅ Status change handled for page ${pageId}: ${statusChangeResult.oldStatus} → ${statusChangeResult.newStatus}`);
        } else {
          logger.info(`💡 This page is already linked to a Jira issue - no status change detected`);
        }
        return;
      }
      
      // No existing Jira link found - will create new issue below
      logger.info(`📝 NO EXISTING JIRA LINK FOUND - will create new issue if status allows`);

      // Determine if this should be an Epic or Story based on database type and page content
      // Priority: 1) Database type, 2) issueType field, 3) isEpic flag, 4) Title keywords
      let isEpic = false;
      
      // First priority: Database type is definitive
      if (databaseType === 'epics') {
        isEpic = true;
      } else if (databaseType === 'userStories') {
        isEpic = false;
      } else {
        // If database type is unclear, check issueType field
        if (pageData.issueType === 'Epic') {
          isEpic = true;
        } else if (pageData.issueType === 'Story') {
          isEpic = false;
        } else {
          // Fallback to other indicators
          isEpic = Boolean(pageData.isEpic === true || 
                   (pageData.title && pageData.title.toLowerCase().includes('epic')) ||
                   // Additional Epic detection patterns (only if database type is unclear)
                   (pageData.title && (
                     pageData.title.toLowerCase().includes('dashboard') ||
                     pageData.title.toLowerCase().includes('setup') ||
                     pageData.title.toLowerCase().includes('system') ||
                     pageData.title.toLowerCase().includes('platform') ||
                     pageData.title.toLowerCase().includes('feature')
                   )));
        }
      }
      
      // Debug logging for Epic detection
      logger.info(`🔍 EPIC DETECTION DEBUG:`);
      logger.info(`   📊 Database Type: ${databaseType}`);
      logger.info(`   🏷️ PageData.isEpic: ${pageData.isEpic}`);
      logger.info(`   📝 Title: "${pageData.title}"`);
      logger.info(`   🎯 Final isEpic result: ${isEpic}`);

      // Secondary check: Search Jira by title (catches edge cases where link was removed from Notion)
      logger.info(`🔍 DUPLICATE CHECK: Searching Jira for issues with same title...`);
      const duplicateIssue = await this.jiraService.findDuplicateIssue(pageData.title, isEpic ? 'Epic' : 'Story');
      if (duplicateIssue) {
        logger.warn(`⚠️ DUPLICATE DETECTED (by Title):`);
        logger.warn(`   📋 Existing Jira Key: ${duplicateIssue.key}`);
        logger.warn(`   📝 Title: "${duplicateIssue.fields.summary}"`);
        logger.warn(`   📄 Notion Page: ${pageId}`);
        logger.warn(`   💡 Reason: Found Jira issue with same title in project`);
        logger.warn(`   🚫 Skipping creation to prevent duplication`);
        
        // Link the existing Jira issue to this Notion page for future checks
        await this.notionService.addJiraLink(pageId, duplicateIssue.key, this.jiraService.buildJiraUrl(duplicateIssue.key));
        logger.info(`✅ Linked existing Jira issue ${duplicateIssue.key} to Notion page ${pageId}`);
        return;
      }
      
      logger.info(`✅ NO DUPLICATES FOUND: Creating new Jira issue with title "${pageData.title}"`);

      // Creation gate differs for Epics vs Stories
      // - Epics: create ONLY when status is 'Approved'
      // - Stories: create ONLY when status is 'Ready For Dev'
      const requiresCreationApproval = isEpic ? 'Approved' : 'Ready For Dev';
      const allowedStatuses = isEpic ? ['Approved'] : ['Ready For Dev'];
      
      // Normalize status for comparison (trim whitespace, handle case variations)
      let normalizedStatus = pageData.status?.trim();
      
      // Handle common status name variations and normalize
      if (normalizedStatus) {
        const lowerStatus = normalizedStatus.toLowerCase();
        // Map common variations to expected values
        const statusMap: { [key: string]: string } = {
          'ready for dev': 'Ready For Dev',
          'ready-for-dev': 'Ready For Dev',
          'ready_for_dev': 'Ready For Dev',
          'readyfordev': 'Ready For Dev',
          'approved': 'Approved',
          'approve': 'Approved',
        };
        if (statusMap[lowerStatus]) {
          normalizedStatus = statusMap[lowerStatus];
          logger.debug(`🔄 Normalized status from "${pageData.status}" to "${normalizedStatus}"`);
        }
      }
      
      // Check if status matches (case-insensitive, with fuzzy matching)
      const statusMatches = normalizedStatus && allowedStatuses.some(
        allowedStatus => {
          const match = allowedStatus.toLowerCase() === normalizedStatus!.toLowerCase();
          if (match) {
            logger.debug(`✅ Status match found: "${normalizedStatus}" matches "${allowedStatus}"`);
          }
          return match;
        }
      );
      
      logger.info(`🔍 STATUS CHECK:`);
      logger.info(`   📊 Raw Status: "${pageData.status || 'undefined'}"`);
      logger.info(`   ✂️ Normalized Status: "${normalizedStatus || 'undefined'}"`);
      logger.info(`   ✅ Allowed Statuses: ${allowedStatuses.join(', ')}`);
      logger.info(`   🎯 Status Matches: ${statusMatches}`);
      logger.info(`   📋 Issue Type: ${isEpic ? 'Epic' : 'Story'}`);
      logger.info(`   🎯 Required Status: ${requiresCreationApproval}`);
      
      if (!normalizedStatus) {
        logger.warn(`⚠️ STATUS IS UNDEFINED - Cannot create Jira ticket without status`);
        logger.warn(`   💡 Please ensure the Notion page has a Status field with a value`);
        logger.warn(`   💡 The Status field might be missing or empty in Notion`);
        return;
      }
      
      if (!statusMatches) {
        logger.info(`⏸️ Skipping Jira ticket creation - status is '${normalizedStatus}', waiting for one of: ${allowedStatuses.join(', ')}`);
        logger.info(`   💡 Current status: "${normalizedStatus}"`);
        logger.info(`   💡 Required status for ${isEpic ? 'Epic' : 'Story'}: ${requiresCreationApproval}`);
        logger.info(`   💡 Tip: Change the status in Notion to "${requiresCreationApproval}" to trigger automatic creation`);
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
        logger.info(`📅 Dev dates: Dev Start=${pageData.devStartDate || pageData.startDate}, Dev End=${pageData.devEndDate || pageData.endDate}`);
        logger.info(`📝 Epic description: "${pageData.description?.substring(0, 200)}..."`);
        logger.info(`🔗 Notion URL: ${notionUrl}`);
        
        if (pageData.figmaLink) {
          logger.info(`🎨 Figma link found: ${pageData.figmaLink}`);
        } else {
          logger.info(`⚠️ No Figma link found in Notion page`);
        }
        
        // Map Notion "Start date" and "End Date" to Jira "Dev Start Date" and "Dev End Date"
        // Use devStartDate/devEndDate if available, otherwise fall back to startDate/endDate
        const devStartDate = pageData.devStartDate || pageData.startDate;
        const devEndDate = pageData.devEndDate || pageData.endDate;
        
        logger.info(`📅 Mapping dates: Notion Start date → Jira Dev Start Date: ${devStartDate}`);
        logger.info(`📅 Mapping dates: Notion End Date → Jira Dev End Date: ${devEndDate}`);
        
        jiraIssue = await this.jiraService.createEpic(
          pageData.title,
          pageData.description,
          pageData.dueDate,
          pageData.priority,
          notionUrl,
          pageData.startDate,
          pageData.endDate,
          pageData.figmaLink,
          devStartDate,  // Map to Dev Start Date in Jira
          devEndDate,   // Map to Dev End Date in Jira
          pageData.owner,
          pageData.roadmap,
          pageData.vertical
        );
        
        logger.info(`✅ Epic created successfully: ${jiraIssue.key}`);
        
        // Update the Jira Epic Link field in Notion (Epics database)
        const jiraUrl = this.jiraService.buildJiraUrl(jiraIssue.key);
        await this.notionService.updateJiraEpicLink(pageId, jiraIssue.key, jiraUrl);
        
        // Comments disabled - fully automatic workflow
        // await this.jiraService.addNotionCreationComment(jiraIssue.key, pageData.title);
      } else {
        // Create Story - check for parent Epic from Notion field
        let epicKey: string | null = null;
        
        // Check multiple fields for epic key (in priority order)
        if (pageData.parentEpic) {
          logger.info(`🔗 Using Parent Epic from Notion field: ${pageData.parentEpic}`);
          epicKey = pageData.parentEpic;
        } else if (pageData.epicLink) {
          // Fallback: Try to use Epic Link field
          logger.info(`🔗 Using Epic Link from Notion field: ${pageData.epicLink}`);
          epicKey = pageData.epicLink;
        } else if (pageData.epicKey) {
          // Also check epicKey field
          logger.info(`🔗 Using Epic Key from Notion field: ${pageData.epicKey}`);
          epicKey = pageData.epicKey;
        } else {
          // Final fallback: Try to find a related epic by title similarity
          logger.info(`🔍 No epic link found in Notion fields, searching for related epic...`);
          epicKey = await this.findRelatedEpic(pageData.title);
        }
        
        if (epicKey) {
          logger.info(`🔗 Creating Story linked to Epic ${epicKey}: "${pageData.title}"`);
        } else {
          logger.info(`📝 Creating standalone Story: "${pageData.title}"`);
        }
        
        logger.info(`📝 Story description: "${pageData.description?.substring(0, 200)}..."`);
        logger.info(`📊 Story points: ${pageData.storyPoints}`);
        logger.info(`🔗 Notion URL: ${notionUrl}`);

        if (pageData.figmaLink) {
          logger.info(`🎨 Figma link found: ${pageData.figmaLink}`);
        } else {
          logger.info(`⚠️ No Figma link found in Notion page`);
        }

        jiraIssue = await this.jiraService.createStory(
          pageData.title,
          pageData.description,
          epicKey || undefined,
          pageData.storyPoints,
          pageData.dueDate,
          pageData.priority,
          notionUrl,
          pageData.redDate,
          pageData.greenDate,
          pageData.blueDate,
          pageData.figmaLink
        );
        
        logger.info(`✅ Story created successfully: ${jiraIssue.key}`);
        
        // Update the Jira Link field in Notion (User Stories database)
        const jiraUrl = this.jiraService.buildJiraUrl(jiraIssue.key);
        await this.notionService.updateJiraLink(pageId, jiraIssue.key, jiraUrl);
        
        // Comments disabled - fully automatic workflow
        // await this.jiraService.addNotionCreationComment(jiraIssue.key, pageData.title);
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
      
      // Process Epics FIRST - they need to exist before User Stories can link to them
      logger.info('Processing Epics first (User Stories depend on Epics)...');
      for (const page of epicsPages) {
        try {
          await this.processNotionPageUpdate(page.id);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing Epic page ${page.id}:`, error);
          // Continue with other pages even if one fails
        }
      }

      // Process User Stories SECOND - after Epics are created, they can link to parent Epics
      logger.info('Processing User Stories after Epics...');
      for (const page of userStoriesPages) {
        try {
          await this.processNotionPageUpdate(page.id);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing User Story page ${page.id}:`, error);
          // Continue with other pages even if one fails
        }
      }

      logger.info(`Completed sync of ${processedCount} pages from both databases`);
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
        // First time processing this page, cache the full data
        this.pageStateCache.set(pageId, {
          ...currentPageData,
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

      // Define status change triggers - focused approach
      const statusChangeTriggers = [
        // Moving to Review - notify scrum masters
        { from: 'Ready For Dev', to: 'Review' },
        { from: 'In Progress', to: 'Review' },
        { from: 'Testing', to: 'Review' },
        { from: 'Blocked', to: 'Review' },
        { from: 'Draft', to: 'Review' },
        
        // Moving to Approved - notify scrum masters
        { from: 'Review', to: 'Approved' },
        { from: 'Draft', to: 'Approved' },
        { from: 'In Progress', to: 'Approved' },
        
        // Back to Ready For Dev - update content if changed
        { from: 'Review', to: 'Ready For Dev' },
        { from: 'In Progress', to: 'Ready For Dev' },
        { from: 'Testing', to: 'Ready For Dev' },
        { from: 'Blocked', to: 'Ready For Dev' },
        { from: 'Done', to: 'Ready For Dev' },
        
        // Moving from Done to In Progress - reopen and update
        { from: 'Done', to: 'In Progress' }
      ];

      // Check if this status change should trigger a comment
      const shouldComment = statusChangeTriggers.some(trigger => 
        trigger.from === oldStatus && trigger.to === newStatus
      );

      if (!shouldComment) {
        logger.info(`ℹ️ Status change ${oldStatus} → ${newStatus} does not require comment`);
        // Update cache with full page data but don't comment
        this.pageStateCache.set(pageId, {
          ...currentPageData,
          lastUpdated: new Date().toISOString()
        });
        return { handled: false };
      }

      // Handle different status change scenarios
      // Comments disabled - fully automatic workflow
      if (newStatus === 'Review') {
        // Moving TO Review - comments disabled
        logger.info(`👀 Status changed to "Review" - comments disabled`);
        
        // Comments disabled - fully automatic workflow
        // const scrumMasterEmails = config.notifications.scrumMasterEmails;
        // await this.jiraService.addReviewNotificationComment(
        //   jiraKey,
        //   oldStatus!,
        //   newStatus!,
        //   currentPageData.title || 'Unknown Issue',
        //   scrumMasterEmails
        // );
        
      } else if (newStatus === 'Approved') {
        // Moving TO Approved - comments disabled
        logger.info(`✅ Status changed to "Approved" - comments disabled`);
        
        // Comments disabled - fully automatic workflow
        // const scrumMasterEmails = config.notifications.scrumMasterEmails;
        // await this.jiraService.addApprovedNotificationComment(
        //   jiraKey,
        //   oldStatus!,
        //   newStatus!,
        //   currentPageData.title || 'Unknown Issue',
        //   scrumMasterEmails
        // );
        
      } else if (newStatus === 'Ready For Dev') {
        // Moving back TO Ready For Dev - update content only (no comments)
        logger.info(`🚀 Status changed to "Ready For Dev" - updating content (comments disabled)`);
        
        // First, check if the issue is resolved and reopen it if needed
        const issueStatus = await this.jiraService.getIssueStatus(jiraKey);
        if (issueStatus === 'Done' || issueStatus === 'Resolved') {
          logger.info(`🔄 Issue ${jiraKey} is resolved, reopening for Ready For Dev status`);
          await this.jiraService.reopenIssue(jiraKey, currentPageData.title || 'Unknown Issue');
        }
        
        // Update the Jira issue description with latest content from Notion
        await this.updateJiraIssueContent(jiraKey, currentPageData, pageId);
        
        // Comments disabled - fully automatic workflow
        // const scrumMasterEmails = config.notifications.scrumMasterEmails;
        // await this.jiraService.addReadyForDevUpdateComment(
        //   jiraKey,
        //   oldStatus!,
        //   newStatus!,
        //   currentPageData.title || 'Unknown Issue',
        //   scrumMasterEmails
        // );
        
      } else if (newStatus === 'In Progress' && oldStatus === 'Done') {
        // Moving from Done to In Progress - reopen and update (no comments)
        logger.info(`🔄 Status changed from "Done" to "In Progress" - reopening and updating (comments disabled)`);
        
        // Check if the issue is resolved and reopen it if needed
        const issueStatus = await this.jiraService.getIssueStatus(jiraKey);
        if (issueStatus === 'Done' || issueStatus === 'Resolved') {
          logger.info(`🔄 Issue ${jiraKey} is resolved, reopening for In Progress status`);
          await this.jiraService.reopenIssue(jiraKey, currentPageData.title || 'Unknown Issue');
        }
        
        // Update the Jira issue description with latest content from Notion
        await this.updateJiraIssueContent(jiraKey, currentPageData, pageId);
        
        // Comments disabled - fully automatic workflow
        // const scrumMasterEmails = config.notifications.scrumMasterEmails;
        // await this.jiraService.addReadyForDevUpdateComment(
        //   jiraKey,
        //   oldStatus!,
        //   newStatus!,
        //   currentPageData.title || 'Unknown Issue',
        //   scrumMasterEmails
        // );
      }

      // Update cache with full page data after processing
      this.pageStateCache.set(pageId, {
        ...currentPageData,
        lastUpdated: new Date().toISOString()
      });

      return { handled: true, oldStatus, newStatus };

    } catch (error) {
      logger.error(`Error handling status change for page ${pageId}:`, error);
      return { handled: false };
    }
  }

  async updateJiraIssueContent(jiraKey: string, pageData: any, pageId: string): Promise<void> {
    try {
      logger.info(`🔄 Updating Jira issue content for ${jiraKey}`);
      
      // Get cached data to compare changes
      const cachedData = this.pageStateCache.get(pageId);
      
      // Get fresh content from Notion
      const notionUrl = `https://www.notion.so/${pageId.replace(/-/g, '')}`;
      
      // Log Figma link status for debugging
      if (pageData.figmaLink) {
        logger.info(`🎨 Including Figma link in description update: ${pageData.figmaLink}`);
      } else {
        logger.debug(`ℹ️ No Figma link to include in description update`);
      }
      
      const freshDescription = this.jiraService.createDescriptionADF(pageData.description, notionUrl, true, pageData.figmaLink);
      
      // Build update data with all changed fields
      const updateData: any = {
        fields: {}
      };
      
      const changes: string[] = [];
      
      // Add Figma link to custom field if provided
      if (pageData.figmaLink && pageData.figmaLink.trim()) {
        const previousFigmaLink = cachedData?.figmaLink;
        if (!cachedData || previousFigmaLink !== pageData.figmaLink) {
          updateData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK] = pageData.figmaLink.trim();
          changes.push(`Figma Link: ${previousFigmaLink || 'Not set'} → ${pageData.figmaLink}`);
          logger.info(`🎨 Adding Figma link to custom field: ${pageData.figmaLink}`);
        }
      }
      
      // Check for title changes
      if (!cachedData || cachedData.title !== pageData.title) {
        if (pageData.title) {
          updateData.fields.summary = pageData.title;
          changes.push(`Title: "${cachedData?.title || 'N/A'}" → "${pageData.title}"`);
        }
      }
      
      // Always update description (content may have changed even if status didn't)
      updateData.fields.description = freshDescription;
      if (!cachedData || cachedData.description !== pageData.description) {
        changes.push('Description: Updated with latest content from Notion');
      }
      
      // Check for story points changes
      if (!cachedData || cachedData.storyPoints !== pageData.storyPoints) {
        if (pageData.storyPoints !== undefined) {
          updateData.fields[JIRA_CUSTOM_FIELDS.STORY_POINTS] = pageData.storyPoints;
          changes.push(`Story Points: ${cachedData?.storyPoints || 'N/A'} → ${pageData.storyPoints}`);
        }
      }
      
      // Check for due date changes
      if (!cachedData || cachedData.dueDate !== pageData.dueDate) {
        if (pageData.dueDate) {
          updateData.fields.duedate = pageData.dueDate;
          changes.push(`Due Date: ${cachedData?.dueDate || 'Not set'} → ${pageData.dueDate}`);
        } else if (cachedData?.dueDate && !pageData.dueDate) {
          // Clear due date if it was removed
          updateData.fields.duedate = null;
          changes.push(`Due Date: ${cachedData.dueDate} → Removed`);
        }
      }
      
      // Check for Dev Start Date and Dev End Date changes (for Epics)
      // Map Notion "Start date" and "End Date" to Jira "Dev Start Date" and "Dev End Date"
      const devStartDate = pageData.devStartDate || pageData.startDate;
      const devEndDate = pageData.devEndDate || pageData.endDate;
      const previousDevStartDate = cachedData?.devStartDate || cachedData?.startDate;
      const previousDevEndDate = cachedData?.devEndDate || cachedData?.endDate;
      
      // Normalize dates to YYYY-MM-DD format (Jira expects this format)
      const normalizedDevStartDate = devStartDate ? this.normalizeDateForJira(devStartDate) : undefined;
      const normalizedDevEndDate = devEndDate ? this.normalizeDateForJira(devEndDate) : undefined;
      
      // Update Dev Start Date and Dev End Date for Epics
      // Note: These custom fields must exist in Jira or the update will fail
      if (!cachedData || previousDevStartDate !== devStartDate) {
        if (normalizedDevStartDate) {
          updateData.fields[JIRA_CUSTOM_FIELDS.DEV_START_DATE] = normalizedDevStartDate;
          changes.push(`Dev Start Date: ${previousDevStartDate || 'Not set'} → ${normalizedDevStartDate}`);
        }
      }
      
      if (!cachedData || previousDevEndDate !== devEndDate) {
        if (normalizedDevEndDate) {
          updateData.fields[JIRA_CUSTOM_FIELDS.DEV_END_DATE] = normalizedDevEndDate;
          changes.push(`Dev End Date: ${previousDevEndDate || 'Not set'} → ${normalizedDevEndDate}`);
        }
      }
      
      // Check for epic link changes (parent epic)
      // Use parentEpic first, then epicLink as fallback
      const currentEpicKey = pageData.parentEpic || pageData.epicLink || pageData.epicKey;
      const previousEpicKey = cachedData?.parentEpic || cachedData?.epicLink || cachedData?.epicKey;
      
      // Also check current epic link in Jira to ensure it's set correctly
      // Stories use Epic Link custom field, not parent field
      let jiraCurrentEpicLink: string | null = null;
      if (currentEpicKey || !cachedData) {
        try {
          const jiraIssue = await this.jiraService.getIssue(jiraKey, [JIRA_CUSTOM_FIELDS.EPIC_LINK]); // Epic Link field
          // Try to get epic link from custom field
          if (jiraIssue.fields?.[JIRA_CUSTOM_FIELDS.EPIC_LINK]) {
            jiraCurrentEpicLink = jiraIssue.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK];
          }
          // Also check parent field as fallback (for backwards compatibility)
          if (!jiraCurrentEpicLink && jiraIssue.fields?.parent?.key) {
            jiraCurrentEpicLink = jiraIssue.fields.parent.key;
          }
        } catch (error) {
          logger.debug(`Could not get current epic link from Jira for ${jiraKey}`);
        }
      }
      
      // Update epic link if:
      // 1. We have an epic key in Notion and it's different from Jira
      // 2. We have an epic key in Notion but no epic link in Jira (missing link)
      // 3. The epic key changed in Notion
      if (currentEpicKey && (jiraCurrentEpicLink !== currentEpicKey || !jiraCurrentEpicLink)) {
        // Use Epic Link custom field, not parent field
        updateData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK] = currentEpicKey;
        changes.push(`Epic Link: ${jiraCurrentEpicLink || previousEpicKey || 'None'} → ${currentEpicKey}`);
        logger.info(`🔗 Updating epic link for ${jiraKey}: ${jiraCurrentEpicLink || 'None'} → ${currentEpicKey}`);
      } else if (previousEpicKey && !currentEpicKey && jiraCurrentEpicLink) {
        // Epic link was removed - we can't clear epic link in Jira, but log it
        logger.info(`⚠️ Epic link removed in Notion, but Jira epic link cannot be cleared automatically`);
        changes.push(`Epic Link: ${previousEpicKey} → Removed (manual update required in Jira)`);
      }
      
      // Log detected changes
      if (changes.length > 0) {
        logger.info(`📊 Detected changes for ${jiraKey}:`);
        changes.forEach(change => logger.info(`   • ${change}`));
      } else {
        logger.info(`ℹ️ No content changes detected for ${jiraKey}, but updating description to ensure sync`);
      }
      
      // Only update if there are actual changes or if we need to refresh description
      if (Object.keys(updateData.fields).length > 0) {
        // If Epic Link is in the update, try to update it separately first
        // This allows other fields to be updated even if Epic Link fails
        const epicLinkValue = updateData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK];
        const hasEpicLink = epicLinkValue !== undefined;
        
        if (hasEpicLink) {
          // Try to update Epic Link separately first using multiple methods
          let linked = false;
          let lastError: any = null;
          
          // Method 1: Try using Epic Link custom field
          try {
            await this.jiraService.updateIssue(jiraKey, {
              fields: {
                [JIRA_CUSTOM_FIELDS.EPIC_LINK]: epicLinkValue,
              },
            });
            logger.info(`✅ Epic Link updated for ${jiraKey}: ${epicLinkValue}`);
            linked = true;
            // Remove Epic Link from the main update since it's already updated
            delete updateData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK];
          } catch (epicLinkError: any) {
            lastError = epicLinkError;
            logger.debug(`⚠️ Epic Link field update failed, trying alternative methods: ${epicLinkError.message}`);
            
            // Method 2: Try using parent field
            try {
              await this.jiraService.updateIssue(jiraKey, {
                fields: {
                  parent: {
                    key: epicLinkValue,
                  },
                },
              });
              logger.info(`✅ Epic Link updated for ${jiraKey} via parent field: ${epicLinkValue}`);
              linked = true;
              // Remove Epic Link from the main update since it's already updated
              delete updateData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK];
            } catch (parentError: any) {
              lastError = parentError;
              logger.debug(`⚠️ Parent field update also failed: ${parentError.message}`);
            }
          }
          
          if (!linked) {
            // If all methods failed, log warning but continue with other updates
            const errorMessage = lastError?.response?.data?.errors?.[JIRA_CUSTOM_FIELDS.EPIC_LINK] || 
                                lastError?.response?.data?.errors?.customfield_10011 ||
                                lastError?.message || 'All linking methods failed';
            logger.warn(`⚠️ Could not update Epic Link for ${jiraKey}: ${errorMessage}`);
            logger.warn(`   💡 The Epic Link field may not be available for updates on this Jira instance`);
            logger.warn(`   💡 You may need to manually link the story to the epic in Jira`);
            // Remove Epic Link from the main update to avoid failing the whole update
            delete updateData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK];
          }
        }
        
        // Update remaining fields (if any)
        if (Object.keys(updateData.fields).length > 0) {
          await this.jiraService.updateIssue(jiraKey, updateData);
          logger.info(`✅ Jira issue ${jiraKey} updated with latest Notion data`);
          logger.info(`   Updated fields: ${Object.keys(updateData.fields).join(', ')}`);
        } else if (hasEpicLink) {
          // Only Epic Link was in the update, and it was already handled
          logger.info(`✅ Jira issue ${jiraKey} update complete`);
        }
      } else {
        logger.info(`ℹ️ No updates needed for ${jiraKey} - all fields are in sync`);
      }
      
    } catch (error) {
      logger.error(`❌ Failed to update Jira issue content for ${jiraKey}:`, error);
      throw error;
    }
  }

  /**
   * Normalize date format to YYYY-MM-DD for Jira
   * Handles various date formats from Notion
   */
  private normalizeDateForJira(dateString: string | undefined): string | undefined {
    if (!dateString) return undefined;
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Handle MM/DD/YYYY format (common in US, like "10/27/2025")
    const mmddyyyy = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      const [, month, day, year] = mmddyyyy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try to parse as ISO date string
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      logger.warn(`⚠️ Could not parse date: ${dateString}`);
    }
    
    // Return as-is if we can't parse it (might already be in correct format)
    return dateString;
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

  /**
   * Create user stories from an epic automatically
   * This method creates user stories in Jira linked to a parent epic
   */
  async createUserStoriesFromEpic(
    epicKey: string,
    userStories: Array<{
      title: string;
      description?: string;
      storyPoints?: number;
      priority?: string;
      dueDate?: string;
      figmaLink?: string;
      status?: string;
    }>
  ): Promise<{ created: number; stories: string[]; errors: string[] }> {
    try {
      logger.info(`🏗️ Creating user stories from Epic ${epicKey}`);
      logger.info(`📋 Number of user stories to create: ${userStories.length}`);

      const results = {
        created: 0,
        stories: [] as string[],
        errors: [] as string[]
      };

      // Verify epic exists
      try {
        const epic = await this.jiraService.getIssue(epicKey);
        logger.info(`✅ Epic ${epicKey} found: "${epic.fields.summary}"`);
      } catch (error) {
        logger.error(`❌ Epic ${epicKey} not found`);
        results.errors.push(`Epic ${epicKey} not found`);
        return results;
      }

      // Create each user story
      for (const story of userStories) {
        try {
          logger.info(`📝 Creating user story: "${story.title}"`);

          // Check for duplicates first
          const duplicateIssue = await this.jiraService.findDuplicateIssue(story.title, 'Story');
          if (duplicateIssue) {
            logger.warn(`⚠️ Duplicate story found: ${duplicateIssue.key} - "${story.title}"`);
            results.errors.push(`Duplicate story: ${duplicateIssue.key} - "${story.title}"`);
            continue;
          }

          // Create the story in Jira
          // Note: Epic Link field uses epic key (e.g., HAR-1118), not epic name
          const jiraIssue = await this.jiraService.createStory(
            story.title,
            story.description,
            epicKey, // Use epic key for Epic Link field
            story.storyPoints,
            story.dueDate,
            story.priority,
            undefined, // notionUrl - not available for auto-created stories
            undefined, // redDate
            undefined, // greenDate
            undefined, // blueDate
            story.figmaLink
          );

          logger.info(`✅ User story created: ${jiraIssue.key} - "${story.title}"`);
          results.created++;
          results.stories.push(jiraIssue.key);

          // Comments disabled - fully automatic workflow
          // await this.jiraService.addNotionCreationComment(jiraIssue.key, story.title);

        } catch (error: any) {
          logger.error(`❌ Error creating user story "${story.title}":`, error);
          results.errors.push(`Failed to create "${story.title}": ${error.message || 'Unknown error'}`);
        }
      }

      logger.info(`🎉 User story creation complete: ${results.created}/${userStories.length} created`);
      return results;

    } catch (error) {
      logger.error(`Error creating user stories from epic ${epicKey}:`, error);
      throw error;
    }
  }

  /**
   * Create user stories from an epic by epic title
   * Searches for the epic by title and creates user stories
   */
  async createUserStoriesFromEpicByTitle(
    epicTitle: string,
    userStories: Array<{
      title: string;
      description?: string;
      storyPoints?: number;
      priority?: string;
      dueDate?: string;
      figmaLink?: string;
      status?: string;
    }>
  ): Promise<{ epicKey?: string; created: number; stories: string[]; errors: string[] }> {
    try {
      logger.info(`🔍 Searching for Epic by title: "${epicTitle}"`);

      // Search for epic by title using JQL
      const jql = `project = "${config.jira.projectKey}" AND issuetype = "Epic" AND summary ~ "${epicTitle}" ORDER BY created DESC`;
      const epics = await this.jiraService.searchIssues(jql);

      if (epics.length === 0) {
        logger.error(`❌ Epic not found with title: "${epicTitle}"`);
        return {
          created: 0,
          stories: [],
          errors: [`Epic not found: "${epicTitle}"`]
        };
      }

      // Find exact match or use first result
      const epic = epics.find(e => 
        e.fields.summary.toLowerCase() === epicTitle.toLowerCase()
      ) || epics[0];

      logger.info(`✅ Found Epic: ${epic.key} - "${epic.fields.summary}"`);

      // Create user stories
      const results = await this.createUserStoriesFromEpic(epic.key, userStories);
      return {
        epicKey: epic.key,
        ...results
      };

    } catch (error) {
      logger.error(`Error creating user stories from epic by title "${epicTitle}":`, error);
      throw error;
    }
  }

}
