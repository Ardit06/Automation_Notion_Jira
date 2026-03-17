import axios, { AxiosInstance } from 'axios';
import { JiraIssue, JiraCreateIssueRequest } from '../types';
import { config, ISSUE_TYPE_MAPPING, JIRA_CUSTOM_FIELDS } from '../config';
import { logger } from './loggerService';

export class JiraService {
  private client: AxiosInstance;

  constructor() {
    // Initialize with single user configuration
    this.client = this.createClient();
  }

  private createClient(): AxiosInstance {
    return axios.create({
      baseURL: `${config.jira.baseUrl}/rest/api/3`,
      auth: {
        username: config.jira.email,
        password: config.jira.apiToken,
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async createIssue(issueData: JiraCreateIssueRequest): Promise<JiraIssue> {
    try {
      logger.debug(`📤 Sending issue data to Jira: ${JSON.stringify(issueData, null, 2)}`);
      const response = await this.client.post('/issue', issueData);
      logger.info(`✅ Created Jira issue: ${response.data.key}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Error creating Jira issue`);
      logger.error(`   Status: ${error.response?.status} ${error.response?.statusText || ''}`);
      if (error.response?.data) {
        const errorData = error.response.data;
        logger.error(`   Jira Error Details:`);
        
        // Log specific field errors
        if (errorData.errors && Object.keys(errorData.errors).length > 0) {
          logger.error(`   Field Errors:`);
          Object.keys(errorData.errors).forEach(field => {
            logger.error(`     - ${field}: ${errorData.errors[field]}`);
          });
        }
        
        // Log general error messages
        if (errorData.errorMessages && Array.isArray(errorData.errorMessages) && errorData.errorMessages.length > 0) {
          logger.error(`   Error Messages:`);
          errorData.errorMessages.forEach((msg: string) => {
            logger.error(`     - ${msg}`);
          });
        }
        
        // If no structured errors, log the whole response
        if (!errorData.errors && !errorData.errorMessages) {
          logger.error(`   Raw error: ${JSON.stringify(errorData)}`);
        }
      }
      throw error;
    }
  }

  /**
   * Get create metadata for a project to see available issue types and fields
   */
  async getCreateMetadata(projectKey: string): Promise<any> {
    try {
      const response = await this.client.get(`/issue/createmeta`, {
        params: {
          projectKeys: projectKey,
          expand: 'projects.issuetypes.fields'
        }
      });
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Error fetching create metadata:`, error);
      throw error;
    }
  }

  /**
   * Discover custom field IDs by searching for fields by name
   * This helps automatically find the correct field IDs for Dev Start Date and Dev End Date
   */
  async discoverCustomFieldIds(projectKey: string, issueType: string = 'Epic'): Promise<{
    devStartDate?: string;
    devEndDate?: string;
    [key: string]: string | undefined;
  }> {
    try {
      logger.info(`🔍 Discovering custom field IDs for project ${projectKey}, issue type ${issueType}`);
      
      const metadata = await this.getCreateMetadata(projectKey);
      const discoveredFields: { [key: string]: string | undefined } = {};
      
      // Find the Epic issue type in the metadata
      const project = metadata.projects?.[0];
      if (!project) {
        logger.warn(`⚠️ No project found in metadata`);
        return discoveredFields;
      }
      
      const epicIssueType = project.issuetypes?.find((it: any) => 
        it.name?.toLowerCase() === issueType.toLowerCase()
      );
      
      if (!epicIssueType) {
        logger.warn(`⚠️ Issue type "${issueType}" not found in project metadata`);
        return discoveredFields;
      }
      
      const fields = epicIssueType.fields || {};
      
      // Search for Dev Start Date field
      const devStartDateField = Object.entries(fields).find(([fieldId, fieldData]: [string, any]) => {
        const fieldName = (fieldData as any)?.name?.toLowerCase() || '';
        return fieldName.includes('dev start') || 
               fieldName.includes('development start') ||
               fieldName.includes('start date');
      });
      
      if (devStartDateField) {
        discoveredFields.devStartDate = devStartDateField[0];
        const fieldData = devStartDateField[1] as any;
        logger.info(`✅ Found Dev Start Date field: ${devStartDateField[0]} (${fieldData?.name || 'Unknown'})`);
      } else {
        logger.warn(`⚠️ Dev Start Date field not found in metadata`);
      }
      
      // Search for Dev End Date field
      const devEndDateField = Object.entries(fields).find(([fieldId, fieldData]: [string, any]) => {
        const fieldName = (fieldData as any)?.name?.toLowerCase() || '';
        return fieldName.includes('dev end') || 
               fieldName.includes('development end') ||
               fieldName.includes('end date');
      });
      
      if (devEndDateField) {
        discoveredFields.devEndDate = devEndDateField[0];
        const fieldData = devEndDateField[1] as any;
        logger.info(`✅ Found Dev End Date field: ${devEndDateField[0]} (${fieldData?.name || 'Unknown'})`);
      } else {
        logger.warn(`⚠️ Dev End Date field not found in metadata`);
      }
      
      // Log all available date fields for debugging
      const dateFields = Object.entries(fields).filter(([fieldId, fieldData]: [string, any]) => {
        const field = fieldData as any;
        return field?.schema?.type === 'date' || field?.schema?.type === 'datetime';
      });
      
      if (dateFields.length > 0) {
        logger.debug(`📅 Available date fields in ${issueType}:`);
        dateFields.forEach(([fieldId, fieldData]: [string, any]) => {
          const field = fieldData as any;
          logger.debug(`   - ${fieldId}: ${field?.name || 'Unknown'} (${field?.schema?.type || 'Unknown'})`);
        });
      }
      
      return discoveredFields;
    } catch (error: any) {
      logger.error(`❌ Error discovering custom field IDs:`, error);
      return {};
    }
  }

  async getIssue(issueKey: string, fields?: string[], expand?: string[]): Promise<JiraIssue> {
    try {
      let url = `/issue/${issueKey}`;
      const params: string[] = [];
      
      if (fields && fields.length > 0) {
        params.push(`fields=${fields.join(',')}`);
      }
      
      if (expand && expand.length > 0) {
        params.push(`expand=${expand.join(',')}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      logger.debug(`📋 Fetching Jira issue ${issueKey} with params: ${params.join('&') || 'none'}`);
      const response = await this.client.get(url);
      logger.debug(`✅ Successfully fetched issue ${issueKey}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching Jira issue ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Get issue with detailed view (expanded fields)
   * Common expand options: renderedFields, names, schema, transitions, changelog
   */
  async getIssueDetailed(issueKey: string, expandOptions?: string[]): Promise<JiraIssue> {
    const defaultExpand = ['renderedFields', 'names', 'schema'];
    const expand = expandOptions || defaultExpand;
    
    logger.debug(`📋 Fetching detailed view for issue ${issueKey} with expand: ${expand.join(',')}`);
    return this.getIssue(issueKey, undefined, expand);
  }

  async updateIssue(issueKey: string, updateData: any): Promise<JiraIssue> {
    try {
      const response = await this.client.put(`/issue/${issueKey}`, updateData);
      logger.info(`Updated Jira issue: ${issueKey}`);
      return response.data;
    } catch (error) {
      logger.error(`Error updating Jira issue ${issueKey}:`, error);
      throw error;
    }
  }


  async searchIssues(jql: string): Promise<JiraIssue[]> {
    try {
      // Use the new search/jql endpoint instead of deprecated /search
      const response = await this.client.post('/search/jql', {
        jql,
        fields: ['key', 'summary', 'description', 'issuetype', 'status'],
        maxResults: 100,
      });
      return response.data.values || response.data.issues || [];
    } catch (error) {
      logger.error('Error searching Jira issues:', error);
      throw error;
    }
  }

  async findDuplicateIssue(summary: string, issueType: string): Promise<JiraIssue | null> {
    try {
      // Use exact match JQL query to avoid partial matches
      const jql = `summary = "${summary}" AND issuetype = "${issueType}" AND project = "${config.jira.projectKey}"`;
      logger.debug(`🔍 Searching for duplicates with JQL: ${jql}`);
      
      const issues = await this.searchIssues(jql);
      logger.debug(`🔍 Found ${issues.length} potential duplicates`);
      
      // Find exact match (case insensitive)
      const exactMatch = issues.find(issue => 
        issue.fields.summary.toLowerCase() === summary.toLowerCase()
      );
      
      if (exactMatch) {
        logger.info(`🔍 DUPLICATE DETECTED:`);
        logger.info(`   📋 Existing Issue: ${exactMatch.key}`);
        logger.info(`   📝 Title: "${exactMatch.fields.summary}"`);
        logger.info(`   🏷️ Type: ${exactMatch.fields.issuetype?.name || 'Unknown'}`);
        logger.info(`   📊 Status: ${exactMatch.fields.status?.name || 'Unknown'}`);
        logger.info(`   📅 Created: ${exactMatch.fields.created || 'Unknown'}`);
        logger.info(`   🔗 URL: ${this.buildJiraUrl(exactMatch.key)}`);
      } else {
        logger.info(`✅ NO DUPLICATES FOUND for title: "${summary}"`);
        logger.info(`   🆕 This is a new issue - proceeding with creation`);
      }
      
      return exactMatch || null;
    } catch (error) {
      logger.error('Error finding duplicate Jira issue:', error);
      return null;
    }
  }

  async findIssueByNotionPageId(notionPageId: string): Promise<JiraIssue | null> {
    try {
      const jql = `description ~ "${notionPageId}" AND project = "${config.jira.projectKey}"`;
      logger.debug(`🔍 Searching for Jira issue by Notion page ID: ${notionPageId}`);
      
      const issues = await this.searchIssues(jql);
      
      if (issues.length > 0) {
        logger.info(`🔗 FOUND JIRA ISSUE LINKED TO NOTION PAGE:`);
        logger.info(`   📋 Jira Key: ${issues[0].key}`);
        logger.info(`   📝 Title: "${issues[0].fields.summary}"`);
        logger.info(`   📊 Status: ${issues[0].fields.status?.name || 'Unknown'}`);
        logger.info(`   🔗 URL: ${this.buildJiraUrl(issues[0].key)}`);
        return issues[0];
      }
      
      logger.info(`❌ No Jira issue found for Notion page: ${notionPageId}`);
      return null;
    } catch (error) {
      logger.error('Error finding Jira issue by Notion page ID:', error);
      return null;
    }
  }

  /**
   * Convert date from various formats to Jira's expected format (YYYY-MM-DD)
   * Handles formats like: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.
   */
  private normalizeDate(dateString: string | undefined): string | undefined {
    if (!dateString) return undefined;
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Handle MM/DD/YYYY format (common in US)
    const mmddyyyy = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      const [, month, day, year] = mmddyyyy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Handle DD/MM/YYYY format (common in EU)
    const ddmmyyyy = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      // Try to detect which is which - if first part > 12, it's likely DD/MM
      const firstPart = parseInt(ddmmyyyy[1]);
      const secondPart = parseInt(ddmmyyyy[2]);
      if (firstPart > 12 && secondPart <= 12) {
        // Definitely DD/MM/YYYY
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else if (secondPart > 12 && firstPart <= 12) {
        // Definitely MM/DD/YYYY
        return `${year}-${firstPart.toString().padStart(2, '0')}-${secondPart.toString().padStart(2, '0')}`;
      }
      // Ambiguous - assume MM/DD/YYYY (US format)
      return `${year}-${firstPart.toString().padStart(2, '0')}-${secondPart.toString().padStart(2, '0')}`;
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
    logger.warn(`⚠️ Date format not recognized, using as-is: ${dateString}`);
    return dateString;
  }

  async createEpic(
    title: string, 
    description?: string, 
    dueDate?: string, 
    priority?: string,
    notionUrl?: string,
    startDate?: string,
    endDate?: string,
    figmaLink?: string,
    devStartDate?: string,
    devEndDate?: string,
    owner?: string,
    roadmap?: string,
    vertical?: string
  ): Promise<JiraIssue> {
    // Create ADF format description for Epics: include Notion link + full content
    let fullDescription = this.createDescriptionADF(description, notionUrl, true, figmaLink, owner, roadmap, vertical);

    // Normalize dates to YYYY-MM-DD format
    const normalizedDueDate = this.normalizeDate(dueDate);
    const normalizedDevStartDate = this.normalizeDate(devStartDate);
    const normalizedDevEndDate = this.normalizeDate(devEndDate);

    const issueData: JiraCreateIssueRequest = {
      fields: {
        summary: title,
        description: fullDescription,
        issuetype: {
          name: 'Epic',
        },
        project: {
          key: config.jira.projectKey,
        },
      },
    };

    // Epic Type is only required for some Jira projects (e.g., HAR)
    // Only add if the custom field is configured for this project
    if (JIRA_CUSTOM_FIELDS.EPIC_TYPE && JIRA_CUSTOM_FIELDS.EPIC_TYPE !== 'none') {
      issueData.fields[JIRA_CUSTOM_FIELDS.EPIC_TYPE] = { id: JIRA_CUSTOM_FIELDS.EPIC_TYPE_VALUE };
      logger.debug(`Adding Epic Type field: ${JIRA_CUSTOM_FIELDS.EPIC_TYPE} = ${JIRA_CUSTOM_FIELDS.EPIC_TYPE_VALUE}`);
    }

    // Note: Reporter field is automatically set to the authenticated user (API token owner)
    // and cannot be changed during issue creation

    // Add due date if provided
    if (normalizedDueDate) {
      issueData.fields.duedate = normalizedDueDate;
    }

    // Try to discover custom field IDs if not configured
    let devStartDateFieldId = JIRA_CUSTOM_FIELDS.DEV_START_DATE;
    let devEndDateFieldId = JIRA_CUSTOM_FIELDS.DEV_END_DATE;
    
    // If using default field IDs, try to discover the correct ones
    if (devStartDateFieldId === 'customfield_10020' || devEndDateFieldId === 'customfield_10022') {
      try {
        const discoveredFields = await this.discoverCustomFieldIds(config.jira.projectKey, 'Epic');
        if (discoveredFields.devStartDate) {
          devStartDateFieldId = discoveredFields.devStartDate;
          logger.info(`✅ Using discovered Dev Start Date field: ${devStartDateFieldId}`);
        }
        if (discoveredFields.devEndDate) {
          devEndDateFieldId = discoveredFields.devEndDate;
          logger.info(`✅ Using discovered Dev End Date field: ${devEndDateFieldId}`);
        }
      } catch (error) {
        logger.warn(`⚠️ Could not discover custom field IDs, using configured defaults`);
      }
    }

    // Add Dev Start Date and Dev End Date as custom fields (for timeline)
    // These map from Notion "Start date" and "End Date" to Jira "Dev Start Date" and "Dev End Date"
    if (normalizedDevStartDate) {
      issueData.fields[devStartDateFieldId] = normalizedDevStartDate;
      logger.debug(`Adding Dev Start Date: ${devStartDateFieldId} = ${normalizedDevStartDate}`);
      // Note: Dates are added to custom fields, not to description (description is ADF format)
    }

    if (normalizedDevEndDate) {
      issueData.fields[devEndDateFieldId] = normalizedDevEndDate;
      logger.debug(`Adding Dev End Date: ${devEndDateFieldId} = ${normalizedDevEndDate}`);
      // Note: Dates are added to custom fields, not to description (description is ADF format)
    }

    // Note: Start and end dates are added to custom fields (devStartDate/devEndDate)
    // If custom fields aren't available, they won't be added to description
    // (Description is ADF format and can't have strings concatenated to it)

    // Add priority if provided
    if (priority) {
      try {
        const jiraPriority = this.mapPriorityToJira(priority);
        issueData.fields.priority = {
          name: jiraPriority
        };
        logger.info(`⚡ Setting Epic priority: "${priority}" → "${jiraPriority}"`);
      } catch (error: any) {
        logger.warn(`⚠️ Could not set Epic priority "${priority}": ${error.message}`);
        // Continue without priority - issue will be created with default priority
      }
    }

    // Add Figma link to custom field if provided (in addition to description)
    if (figmaLink && figmaLink.trim()) {
      try {
        issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK] = figmaLink.trim();
        logger.info(`🎨 Adding Figma link to custom field during Epic creation: ${figmaLink}`);
      } catch (error: any) {
        logger.warn(`⚠️ Could not add Figma link to custom field during Epic creation: ${error.message}`);
        // Continue - Figma link is still in the description
      }
    }

    // Note: owner, roadmap, and vertical are already included in the description
    // via createDescriptionADF (called on line 365), so no need to add them again here

    try {
      return await this.createIssue(issueData);
    } catch (error: any) {
      // Log error details for debugging
      logger.warn(`⚠️ Epic creation failed: ${error.message}`);
      if (error.response?.data?.errors) {
        logger.warn(`⚠️ Jira API errors: ${JSON.stringify(error.response.data.errors)}`);
      }
      
      // If creation failed because of Priority or Figma Link field, try without them
      const hasPriorityError = priority && issueData.fields.priority && 
          error.response?.data?.errors?.priority;
      const hasFigmaLinkError = figmaLink && issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK] && 
          error.response?.data?.errors?.[JIRA_CUSTOM_FIELDS.FIGMA_LINK];
      
      if (hasPriorityError || hasFigmaLinkError) {
        if (hasPriorityError) {
          logger.warn(`⚠️ Priority field rejected by Jira, retrying without it`);
          delete issueData.fields.priority;
        }
        if (hasFigmaLinkError) {
          logger.warn(`⚠️ Figma Link field not available during creation, retrying without it`);
          delete issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK];
        }
        
        // Try creating again, with another retry for priority if needed
        try {
          return await this.createIssue(issueData);
        } catch (retryError: any) {
          // If retry also failed, check for priority error
          const hasPriorityErrorOnRetry = priority && issueData.fields.priority && 
              retryError.response?.data?.errors?.priority;
          
          if (hasPriorityErrorOnRetry) {
            logger.warn(`⚠️ Priority field rejected on retry, removing it and trying again`);
            delete issueData.fields.priority;
            return await this.createIssue(issueData);
          } else {
            throw retryError; // Re-throw if it's a different error
          }
        }
      } else {
        throw error; // Re-throw if it's a different error
      }
    }
  }

  async createStory(
    title: string, 
    description?: string, 
    epicKey?: string, 
    storyPoints?: number,
    dueDate?: string,
    priority?: string,
    notionUrl?: string,
    redDate?: string,
    greenDate?: string,
    blueDate?: string,
    figmaLink?: string
  ): Promise<JiraIssue> {
    // Create ADF format description for Stories: include Notion link + full content
    let fullDescription = this.createDescriptionADF(description, notionUrl, true, figmaLink);

    const issueData: JiraCreateIssueRequest = {
      fields: {
        summary: title,
        description: fullDescription,
        issuetype: {
          name: 'Story',
        },
        project: {
          key: config.jira.projectKey,
        },
      },
    };

    // Note: Reporter field is automatically set to the authenticated user (API token owner)
    // and cannot be changed during issue creation

    // Try to set Epic Link during creation if provided
    // Some Jira instances allow this field during creation, others require it to be set via update
    if (epicKey) {
      try {
        // Verify epic exists and is actually an Epic issue type before attempting to link
        const epic = await this.getIssue(epicKey, ['issuetype']);
        if (epic.fields.issuetype?.name?.toLowerCase() === 'epic') {
          // Try to set Epic Link during creation
          issueData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK] = epicKey;
          logger.debug(`Attempting to set Epic Link during creation: ${epicKey}`);
        } else {
          logger.warn(`⚠️ Issue ${epicKey} is not an Epic (type: ${epic.fields.issuetype?.name}), will skip epic linking`);
        }
      } catch (error: any) {
        logger.warn(`⚠️ Could not verify epic ${epicKey} before creation, will try to link after creation: ${error.message}`);
        // Don't set epic link during creation if we can't verify the epic
      }
    }

    // Add due date if provided
    if (dueDate) {
      issueData.fields.duedate = dueDate;
    }

    // Add priority if provided
    if (priority) {
      try {
        const jiraPriority = this.mapPriorityToJira(priority);
        issueData.fields.priority = {
          name: jiraPriority
        };
        logger.info(`⚡ Setting Story priority: "${priority}" → "${jiraPriority}"`);
      } catch (error: any) {
        logger.warn(`⚠️ Could not set Story priority "${priority}": ${error.message}`);
        // Continue without priority - issue will be created with default priority
      }
    }

    // Add Figma link to custom field if provided (in addition to description)
    if (figmaLink && figmaLink.trim()) {
      try {
        issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK] = figmaLink.trim();
        logger.info(`🎨 Adding Figma link to custom field during creation: ${figmaLink}`);
      } catch (error: any) {
        logger.warn(`⚠️ Could not add Figma link to custom field during creation: ${error.message}`);
        // Continue - Figma link is still in the description
      }
    }

    // Create the story first
    let createdIssue: JiraIssue;
    let epicLinkSetDuringCreation = false;
    
    try {
      createdIssue = await this.createIssue(issueData);
      logger.info(`✅ Story ${createdIssue.key} created successfully`);
      
      // Check if Epic Link was set during creation
      if (epicKey && issueData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK]) {
        epicLinkSetDuringCreation = true;
        logger.info(`✅ Epic Link set during creation: ${epicKey}`);
      }
    } catch (error: any) {
      // Log error details for debugging
      logger.warn(`⚠️ Story creation failed: ${error.message}`);
      if (error.response?.data?.errors) {
        logger.warn(`⚠️ Jira API errors: ${JSON.stringify(error.response.data.errors)}`);
      }
      
      // If creation failed because of Epic Link, Figma Link, or Priority field, try without them
      const hasEpicLinkError = epicKey && issueData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK] && 
          error.response?.data?.errors?.[JIRA_CUSTOM_FIELDS.EPIC_LINK];
      const hasFigmaLinkError = figmaLink && issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK] && 
          error.response?.data?.errors?.[JIRA_CUSTOM_FIELDS.FIGMA_LINK];
      const hasPriorityError = priority && issueData.fields.priority && 
          error.response?.data?.errors?.priority;
      
      logger.info(`🔍 Error detection: EpicLink=${!!hasEpicLinkError}, FigmaLink=${!!hasFigmaLinkError}, Priority=${!!hasPriorityError}`);
      
      if (hasEpicLinkError || hasFigmaLinkError || hasPriorityError) {
        // Remove problematic fields
        if (hasEpicLinkError) {
          logger.warn(`⚠️ Epic Link field not available during creation, retrying without it`);
          delete issueData.fields[JIRA_CUSTOM_FIELDS.EPIC_LINK];
        }
        if (hasFigmaLinkError) {
          logger.warn(`⚠️ Figma Link field not available during creation, retrying without it`);
          delete issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK];
        }
        if (hasPriorityError) {
          logger.warn(`⚠️ Priority field rejected by Jira, retrying without it`);
          delete issueData.fields.priority;
        }
        
        // Try creating again, with another retry for priority if needed
        try {
          createdIssue = await this.createIssue(issueData);
          logger.info(`✅ Story ${createdIssue.key} created successfully (without problematic fields)`);
        } catch (retryError: any) {
          // If retry also failed, check for priority error (common case)
          const hasPriorityErrorOnRetry = priority && issueData.fields.priority && 
              retryError.response?.data?.errors?.priority;
          
          if (hasPriorityErrorOnRetry) {
            logger.warn(`⚠️ Priority field rejected on retry, removing it and trying again`);
            delete issueData.fields.priority;
            createdIssue = await this.createIssue(issueData);
            logger.info(`✅ Story ${createdIssue.key} created successfully (without priority)`);
          } else {
            throw retryError; // Re-throw if it's a different error
          }
        }
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

    // After creation, try to set the optional fields (story points, figma link, and epic link if not set during creation)
    // These are done as separate update operations since they may not be available during creation

    // Set story points if provided
    if (storyPoints) {
      try {
        await this.updateIssue(createdIssue.key, {
          fields: {
            [JIRA_CUSTOM_FIELDS.STORY_POINTS]: storyPoints,
          },
        });
        logger.info(`✅ Set story points to ${storyPoints} for story ${createdIssue.key}`);
      } catch (error: any) {
        logger.warn(`⚠️ Could not set story points for ${createdIssue.key}: ${error.response?.data?.errors?.[JIRA_CUSTOM_FIELDS.STORY_POINTS] || error.message}`);
        logger.warn(`   Story created successfully, but story points field may not be available for this issue type`);
      }
    }

    // Set Figma link in custom field if provided (if it wasn't set during creation)
    if (figmaLink && figmaLink.trim() && !issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK]) {
      try {
        await this.updateIssue(createdIssue.key, {
          fields: {
            [JIRA_CUSTOM_FIELDS.FIGMA_LINK]: figmaLink.trim(),
          },
        });
        logger.info(`✅ Set Figma link in custom field for story ${createdIssue.key}: ${figmaLink}`);
      } catch (error: any) {
        logger.warn(`⚠️ Could not set Figma link in custom field for ${createdIssue.key}: ${error.response?.data?.errors?.[JIRA_CUSTOM_FIELDS.FIGMA_LINK] || error.message}`);
        logger.warn(`   Story created successfully, but Figma link field may not be available for this issue type`);
        // Continue - Figma link is still in the description
      }
    }

    // If epicKey is provided and wasn't set during creation, try to set it via update
    // Note: Stories are linked to Epics using the Epic Link custom field, not the parent field
    if (epicKey && !epicLinkSetDuringCreation) {
      try {
        // Verify epic exists and is actually an Epic issue type
        const epic = await this.getIssue(epicKey, ['issuetype']);
        if (epic.fields.issuetype?.name?.toLowerCase() !== 'epic') {
          logger.warn(`⚠️ Issue ${epicKey} is not an Epic (type: ${epic.fields.issuetype?.name}), cannot link story`);
        } else {
          // Try multiple methods to link the story to the epic
          let linked = false;
          let lastError: any = null;
          
          // Method 1: Try using Epic Link custom field via update
          try {
            await this.updateIssue(createdIssue.key, {
              fields: {
                [JIRA_CUSTOM_FIELDS.EPIC_LINK]: epicKey,
              },
            });
            logger.info(`✅ Linked story ${createdIssue.key} to epic ${epicKey} via Epic Link field`);
            linked = true;
          } catch (updateError: any) {
            // If update fails, try alternative methods
            lastError = updateError;
            logger.debug(`⚠️ Epic Link field update failed, trying alternative methods: ${updateError.message}`);
            
            // Method 2: Try using parent field (some Jira instances use this)
            try {
              await this.updateIssue(createdIssue.key, {
                fields: {
                  parent: {
                    key: epicKey,
                  },
                },
              });
              logger.info(`✅ Linked story ${createdIssue.key} to epic ${epicKey} via parent field`);
              linked = true;
            } catch (parentError: any) {
              lastError = parentError;
              logger.debug(`⚠️ Parent field update also failed: ${parentError.message}`);
              
              // Method 3: Try using issue links API to create a "relates to" or "epic link" relationship
              try {
                // Use the issue links API to create a link
                await this.client.post(`/rest/api/3/issue/${createdIssue.key}/remotelink`, {
                  globalId: `epic-link-${epicKey}-${createdIssue.key}`,
                  object: {
                    url: `${config.jira.baseUrl}/browse/${epicKey}`,
                    title: `Epic: ${epicKey}`,
                  },
                  relationship: 'Epic Link',
                });
                logger.info(`✅ Linked story ${createdIssue.key} to epic ${epicKey} via issue links API`);
                linked = true;
              } catch (linkError: any) {
                lastError = linkError;
                logger.debug(`⚠️ Issue links API also failed: ${linkError.message}`);
              }
            }
          }
          
          if (!linked) {
            // If all methods failed, log a warning
            const errorMessage = lastError?.response?.data?.errors?.[JIRA_CUSTOM_FIELDS.EPIC_LINK] || 
                                lastError?.response?.data?.errors?.customfield_10011 ||
                                lastError?.message || 'All linking methods failed';
            logger.warn(`⚠️ Story ${createdIssue.key} created but epic link could not be set: ${errorMessage}`);
            logger.warn(`   💡 The Epic Link field may not be available for updates on this Jira instance`);
            logger.warn(`   💡 You may need to manually link the story to the epic in Jira`);
            // Don't throw - story was created successfully, just without epic link
          }
        }
      } catch (error: any) {
        logger.warn(`⚠️ Could not verify epic ${epicKey} or link story: ${error.message}`);
        logger.warn(`   Story ${createdIssue.key} created successfully, but epic link could not be set`);
      }
    }

    return createdIssue;
  }

  async createTask(
    title: string, 
    description?: string, 
    parentKey?: string,
    labels?: string[]
  ): Promise<JiraIssue> {
    const issueData: JiraCreateIssueRequest = {
      fields: {
        summary: title,
        description: description || undefined,
        issuetype: {
          name: 'Task',
        },
        project: {
          key: config.jira.projectKey,
        },
        labels: [...(labels || [])],
      },
    };

    // Add parent link if provided
    if (parentKey) {
      issueData.fields.parent = {
        key: parentKey,
      };
    }

    return this.createIssue(issueData);
  }

  async getEpicKey(epicTitle: string): Promise<string | null> {
    try {
      const jql = `summary ~ "${epicTitle}" AND issuetype = "Epic" AND project = "${config.jira.projectKey}"`;
      const issues = await this.searchIssues(jql);
      
      const exactMatch = issues.find(issue => 
        issue.fields.summary.toLowerCase() === epicTitle.toLowerCase()
      );
      
      return exactMatch ? exactMatch.key : null;
    } catch (error) {
      logger.error('Error finding epic key:', error);
      return null;
    }
  }

  buildJiraUrl(issueKey: string): string {
    return `${config.jira.baseUrl}/browse/${issueKey}`;
  }

  getClient() {
    return this.client;
  }

  async addComment(issueKey: string, comment: string): Promise<boolean> {
    try {
      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: comment
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, commentData);
      logger.info(`✅ Comment added to ${issueKey}: "${comment.substring(0, 50)}..."`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add comment to ${issueKey}:`, error);
      return false;
    }
  }

  async getIssueStatus(jiraKey: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/issue/${jiraKey}`);
      return response.data.fields.status.name;
    } catch (error) {
      logger.error(`❌ Failed to get issue status for ${jiraKey}:`, error);
      return null;
    }
  }

  async reopenIssue(jiraKey: string, issueTitle: string): Promise<boolean> {
    try {
      // Comments disabled - fully automatic workflow
      // const commentText = `🔄 **Issue Reopened - Back to Ready For Dev**
      //
      // This issue "${issueTitle}" has been reopened because the status in Notion changed back to "Ready For Dev".
      //
      // The item is now ready for development again.
      //
      // ---
      // *Automated by Notion-Jira Integration*`;
      //
      // const commentData = {
      //   body: {
      //     type: 'doc',
      //     version: 1,
      //     content: [
      //       {
      //         type: 'paragraph',
      //         content: [
      //           {
      //             type: 'text',
      //             text: commentText,
      //             marks: []
      //           }
      //         ]
      //       }
      //     ]
      //   }
      // };
      //
      // await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      // logger.info(`✅ Reopening comment added to ${jiraKey}`);

      // Reopen the issue (transition to "To Do" or "Open")
      const transitionData = {
        transition: {
          id: '11' // "To Do" transition - you may need to adjust this ID based on your Jira setup
        }
      };

      await this.client.post(`/issue/${jiraKey}/transitions`, transitionData);
      logger.info(`✅ Jira issue ${jiraKey} reopened successfully`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to reopen Jira issue ${jiraKey}:`, error);
      return false;
    }
  }

  async resolveIssue(
    jiraKey: string,
    newStatus: string,
    issueTitle: string
  ): Promise<boolean> {
    try {
      // Comments disabled - fully automatic workflow
      // const commentText = `🔒 **Issue Resolved - Status Change**
      //
      // This issue "${issueTitle}" has been resolved because the status in Notion changed from "Ready For Dev" to "${newStatus}".
      //
      // This indicates that changes or additional work are needed before this item can be considered ready for development again.
      //
      // The issue will be automatically reopened if the status returns to "Ready For Dev".
      //
      // ---
      // *Automated by Notion-Jira Integration*`;
      //
      // const commentData = {
      //   body: {
      //     type: 'doc',
      //     version: 1,
      //     content: [
      //       {
      //         type: 'paragraph',
      //         content: [
      //           {
      //             type: 'text',
      //             text: commentText,
      //             marks: []
      //           }
      //         ]
      //       }
      //     ]
      //   }
      // };
      //
      // await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      // logger.info(`✅ Resolution comment added to ${jiraKey}`);

      // Now resolve the issue
      const transitionData = {
        transition: {
          id: '21' // "Done" transition - you may need to adjust this ID based on your Jira setup
        }
      };

      await this.client.post(`/issue/${jiraKey}/transitions`, transitionData);
      logger.info(`✅ Jira issue ${jiraKey} resolved successfully`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to resolve Jira issue ${jiraKey}:`, error);
      return false;
    }
  }

  async addReviewNotificationComment(issueKey: string, oldStatus: string, newStatus: string, issueTitle: string, scrumMasterEmails?: string[]): Promise<void> {
    try {
      const mentions = scrumMasterEmails?.map(email => `[~${email}]`).join(' ') || '';
      
      const comment = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `👀 REVIEW REQUESTED: `,
                  marks: [{ type: 'strong' }]
                },
                {
                  type: 'text',
                  text: `Ticket "${issueTitle}" is now in Review status!`
                }
              ]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Status changed from "${oldStatus}" to "${newStatus}". Please review and provide feedback.`
                }
              ]
            },
            ...(mentions ? [{
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `${mentions} - Please review this ticket.`,
                  marks: [{ type: 'strong' }]
                }
              ]
            }] : [])
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, comment);
      logger.info(`✅ Added review notification comment to ${issueKey}`);
    } catch (error) {
      logger.error(`❌ Failed to add review notification comment to ${issueKey}:`, error);
      throw error;
    }
  }

  async addApprovedNotificationComment(issueKey: string, oldStatus: string, newStatus: string, issueTitle: string, scrumMasterEmails?: string[]): Promise<void> {
    try {
      const mentions = scrumMasterEmails?.map(email => `[~${email}]`).join(' ') || '';
      
      const comment = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `✅ APPROVED: `,
                  marks: [{ type: 'strong' }]
                },
                {
                  type: 'text',
                  text: `Ticket "${issueTitle}" has been approved!`
                }
              ]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Status changed from "${oldStatus}" to "${newStatus}". This ticket is now ready to proceed.`
                }
              ]
            },
            ...(mentions ? [{
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `${mentions} - Ticket approved and ready.`,
                  marks: [{ type: 'strong' }]
                }
              ]
            }] : [])
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, comment);
      logger.info(`✅ Added approved notification comment to ${issueKey}`);
    } catch (error) {
      logger.error(`❌ Failed to add approved notification comment to ${issueKey}:`, error);
      throw error;
    }
  }

  async addReadyForDevUpdateComment(issueKey: string, oldStatus: string, newStatus: string, issueTitle: string, scrumMasterEmails?: string[]): Promise<void> {
    try {
      const mentions = scrumMasterEmails?.map(email => `[~${email}]`).join(' ') || '';
      
      const comment = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `📝 MEDIUM PRIORITY: `,
                  marks: [{ type: 'strong' }]
                },
                {
                  type: 'text',
                  text: `Ticket "${issueTitle}" moved back to Ready For Dev with updated content!`
                }
              ]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Status changed from "${oldStatus}" to "${newStatus}". Content has been updated from Notion.`
                }
              ]
            },
            ...(mentions ? [{
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Scrum Masters: ${mentions}`,
                  marks: [{ type: 'strong' }]
                }
              ]
            }] : [])
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, comment);
      logger.info(`✅ Added ready for dev update comment to ${issueKey}`);
    } catch (error) {
      logger.error(`❌ Failed to add ready for dev update comment to ${issueKey}:`, error);
      throw error;
    }
  }

  async addReadyForDevTagComment(
    jiraKey: string,
    issueTitle: string,
    taggedUserEmail?: string,
    taggedUserName?: string
  ): Promise<boolean> {
    try {
      // Create the comment text with tagging
      let commentText = `🚀 **Ready For Dev - Item Available for Development**

This issue "${issueTitle}" has been moved back to **Ready For Dev** status.

The development team can now work on this item. Please review and let us know if there are any additional requirements or clarifications needed.`;

      // Add tagging if user information is provided
      if (taggedUserEmail && taggedUserName) {
        commentText += `\n\nHi [~${taggedUserEmail}] (${taggedUserName}), please review this status change.`;
      } else if (taggedUserName) {
        // Fallback to just the name if email is not available
        commentText += `\n\nHi @${taggedUserName}, please review this status change.`;
      } else {
        // Default tagging to aurita@91.life if no specific user is provided
        commentText += `\n\nHi [~aurita@91.life], please review this status change.`;
      }

      commentText += `\n\nBest regards,\nAutomation System`;

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: commentText,
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      
      const userInfo = taggedUserName ? `${taggedUserName} (${taggedUserEmail || 'no email'})` : 'aurita@91.life (default)';
      logger.info(`✅ Ready For Dev tag comment added to ${jiraKey} for ${userInfo}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add Ready For Dev tag comment to ${jiraKey}:`, error);
      return false;
    }
  }

  async addStatusChangeComment(issueKey: string, oldStatus: string, newStatus: string, scrumMasterEmails?: string[]): Promise<boolean> {
    try {
      let comment = `🚀 **Back to Ready for Dev**\n\n`;
      comment += `This issue has been moved back to **Ready for Dev** status from **${oldStatus}**.\n\n`;
      comment += `The development team can now work on this item. Please review and let us know if there are any additional requirements or clarifications needed.\n\n`;
      
      if (scrumMasterEmails && scrumMasterEmails.length > 0) {
        const mentions = scrumMasterEmails.map(email => `[~${email}]`).join(' ');
        comment += `${mentions} This item is ready for development.`;
      } else {
        comment += `@scrum-master This item is ready for development.`;
      }

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: '📊 ',
                  marks: []
                },
                {
                  type: 'text',
                  text: 'Status Update from Notion',
                  marks: [{ type: 'strong' }]
                }
              ]
            },
            {
              type: 'paragraph',
              content: []
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Status changed from `,
                  marks: []
                },
                {
                  type: 'text',
                  text: oldStatus,
                  marks: [{ type: 'strong' }]
                },
                {
                  type: 'text',
                  text: ' → ',
                  marks: []
                },
                {
                  type: 'text',
                  text: newStatus,
                  marks: [{ type: 'strong' }]
                }
              ]
            },
            {
              type: 'paragraph',
              content: []
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: scrumMasterEmails && scrumMasterEmails.length > 0 
                    ? scrumMasterEmails.map(email => `[~${email}]`).join(' ')
                    : '@scrum-master',
                  marks: []
                },
                {
                  type: 'text',
                  text: ' Please review this status change.',
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, commentData);
      logger.info(`✅ Status change comment added to ${issueKey}: ${oldStatus} → ${newStatus}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add status change comment to ${issueKey}:`, error);
      return false;
    }
  }

  async addNotionCreationComment(jiraKey: string, issueTitle: string): Promise<boolean> {
    try {
      // Logging disabled - comments are not being used in automation
      // logger.info(`💬 Adding Notion creation comment to: ${jiraKey}`);

      const creationComment = `📝 **Created from Notion**

This ticket "${issueTitle}" has been created from Notion.

Please review the requirements and let us know if there are any questions or clarifications needed.

Best regards,
Automation System`;

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: creationComment,
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      logger.info(`✅ Notion creation comment added to ${jiraKey}`);
      
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add Notion creation comment to ${jiraKey}:`, error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/myself');
      return true;
    } catch (error) {
      logger.error('Jira connection test failed:', error);
      return false;
    }
  }

  private mapPriorityToJira(notionPriority: string): string {
    // Direct 1:1 mapping - Notion priority values map directly to Jira priority values
    const priorityMap: { [key: string]: string } = {
      'High': 'High',
      'Medium': 'Medium', 
      'Low': 'Low',
      'Critical': 'Critical',
      'Highest': 'Highest',  // Support for Highest if used in Notion
      'Lowest': 'Lowest'     // Support for Lowest if used in Notion
    };
    
    // Return mapped priority or default to Medium if not found
    const mappedPriority = priorityMap[notionPriority];
    if (!mappedPriority) {
      logger.warn(`⚠️ Unknown priority value "${notionPriority}", defaulting to "Medium"`);
      return 'Medium';
    }
    
    return mappedPriority;
  }

  private convertToADF(text: string): any {
    // Convert plain text to Atlassian Document Format (ADF)
    const lines = text.split('\n');
    const content = lines.map(line => ({
      type: 'paragraph',
      content: line.trim() ? [{
        type: 'text',
        text: line
      }] : []
    }));

    return {
      type: 'doc',
      version: 1,
      content: content.filter(block => block.content.length > 0)
    };
  }

  /**
   * Parses inline markdown formatting (bold, italic, strikethrough, code, links) and converts to ADF text nodes
   */
  private parseInlineMarkdown(text: string): any[] {
    if (!text) return [];
    
    const nodes: any[] = [];
    let currentIndex = 0;
    
    // Regex patterns for different markdown formats
    const patterns = [
      { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' }, // Links [text](url)
      { regex: /`([^`]+)`/g, type: 'code' }, // Inline code `code`
      { regex: /\*\*([^*]+)\*\*/g, type: 'bold' }, // Bold **text**
      { regex: /~~([^~]+)~~/g, type: 'strikethrough' }, // Strikethrough ~~text~~
      { regex: /\*([^*]+)\*/g, type: 'italic' }, // Italic *text*
    ];
    
    // Find all matches with their positions
    const matches: Array<{ start: number; end: number; type: string; content: string; url?: string }> = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: pattern.type,
          content: match[1],
          url: pattern.type === 'link' ? match[2] : undefined
        });
      }
    }
    
    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);
    
    // Remove overlapping matches (keep first match)
    const filteredMatches: typeof matches = [];
    for (const match of matches) {
      const overlaps = filteredMatches.some(m => 
        (match.start >= m.start && match.start < m.end) ||
        (match.end > m.start && match.end <= m.end)
      );
      if (!overlaps) {
        filteredMatches.push(match);
      }
    }
    
    // Build nodes from matches
    for (const match of filteredMatches) {
      // Add text before match
      if (match.start > currentIndex) {
        const beforeText = text.substring(currentIndex, match.start);
        if (beforeText) {
          nodes.push({ type: 'text', text: beforeText });
        }
      }
      
      // Add formatted node
      const marks: any[] = [];
      if (match.type === 'bold') {
        marks.push({ type: 'strong' });
      } else if (match.type === 'italic') {
        marks.push({ type: 'em' });
      } else if (match.type === 'strikethrough') {
        marks.push({ type: 'strike' });
      } else if (match.type === 'code') {
        marks.push({ type: 'code' });
      }
      
      if (match.type === 'link') {
        // For links, combine other marks with link mark
        const linkMarks = [...marks, { type: 'link', attrs: { href: match.url } }];
        nodes.push({
          type: 'text',
          text: match.content,
          marks: linkMarks
        });
      } else {
        nodes.push({
          type: 'text',
          text: match.content,
          marks: marks
        });
      }
      
      currentIndex = match.end;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      if (remainingText) {
        nodes.push({ type: 'text', text: remainingText });
      }
    }
    
    // If no matches found, return plain text
    if (nodes.length === 0 && text) {
      return [{ type: 'text', text: text }];
    }
    
    return nodes;
  }

  public convertMarkdownToADF(markdown: string): any {
    const lines = markdown.split('\n');
    const content: any[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      if (!line.trim()) {
        // Empty line - add empty paragraph
        content.push({
          type: 'paragraph',
          content: []
        });
        i++;
        continue;
      }
      
      // Handle blockquotes (> text)
      if (line.startsWith('> ')) {
        const quoteText = line.slice(2);
        const quoteContent = this.parseInlineMarkdown(quoteText);
        content.push({
          type: 'blockquote',
          content: [{
            type: 'paragraph',
            content: quoteContent
          }]
        });
        i++;
        continue;
      }
      
      // Handle headings (# ## ###)
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '');
        const headingContent = this.parseInlineMarkdown(text);
        
        content.push({
          type: 'heading',
          attrs: { level: Math.min(level, 6) },
          content: headingContent.length > 0 ? headingContent : [{ type: 'text', text: text }]
        });
        i++;
        continue;
      }
      
      // Handle code blocks (```language)
      if (line.startsWith('```')) {
        const language = line.slice(3).trim();
        const codeLines: string[] = [];
        let j = i + 1;
        
        // Collect code lines until closing ```
        while (j < lines.length) {
          const nextLine = lines[j];
          if (nextLine.startsWith('```')) {
            break;
          }
          codeLines.push(nextLine);
          j++;
        }
        
        const codeText = codeLines.join('\n');
        
        // Make Gherkin tests collapsible by using expand/collapse
        if (language === 'gherkin' || 
            codeText.toLowerCase().includes('given') || 
            codeText.toLowerCase().includes('when') || 
            codeText.toLowerCase().includes('then') ||
            codeText.toLowerCase().includes('feature:') ||
            codeText.toLowerCase().includes('scenario:')) {
          
          // Create collapsible section for Gherkin using ADF expand node
          content.push({
            type: 'expand',
            attrs: {
              title: '🧪 Acceptance Criteria'
            },
            content: [
              {
                type: 'codeBlock',
                attrs: { language: 'gherkin' },
                content: [{
                  type: 'text',
                  text: codeText
                }]
              }
            ]
          });
        } else {
          // Regular code block
          content.push({
            type: 'codeBlock',
            attrs: { language: language || 'text' },
            content: [{
              type: 'text',
              text: codeText
            }]
          });
        }
        
        // Skip processed lines
        i = j + 1;
        continue;
      }
      
      // Handle lists (- item)
      if (line.startsWith('- ') || line.startsWith('• ')) {
        const text = line.slice(2);
        const listContent = this.parseInlineMarkdown(text);
        content.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: listContent.length > 0 ? listContent : [{ type: 'text', text: text }]
            }]
          }]
        });
        i++;
        continue;
      }
      
      // Handle numbered lists (1. item)
      if (/^\d+\.\s/.test(line)) {
        const text = line.replace(/^\d+\.\s/, '');
        const listContent = this.parseInlineMarkdown(text);
        content.push({
          type: 'orderedList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: listContent.length > 0 ? listContent : [{ type: 'text', text: text }]
            }]
          }]
        });
        i++;
        continue;
      }
      
      // Handle checkboxes (☑ or ☐)
      if (line.startsWith('☑ ') || line.startsWith('☐ ')) {
        const text = line.slice(2);
        const checkboxContent = this.parseInlineMarkdown(text);
        content.push({
          type: 'taskList',
          content: [{
            type: 'taskItem',
            attrs: { localId: `task-${i}`, state: line.startsWith('☑') ? 'DONE' : 'TODO' },
            content: [{
              type: 'paragraph',
              content: checkboxContent.length > 0 ? checkboxContent : [{ type: 'text', text: text }]
            }]
          }]
        });
        i++;
        continue;
      }
      
      // Handle tables (markdown format: | cell | cell |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableRows: any[] = [];
        let j = i;
        let isHeader = true;
        
        // Collect all table rows
        while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
          const currentLine = lines[j].trim();
          
          // Skip separator row (|---|---|)
          if (currentLine.match(/^\|[\s\-:|]+\|$/)) {
            j++;
            continue;
          }
          
          // Parse cells
          const cells = currentLine
            .split('|')
            .slice(1, -1) // Remove first and last empty elements
            .map(cell => cell.trim());
          
          // Create table row
          const rowCells = cells.map(cellText => ({
            type: isHeader ? 'tableHeader' : 'tableCell',
            content: [{
              type: 'paragraph',
              content: cellText ? [{
                type: 'text',
                text: cellText
              }] : []
            }]
          }));
          
          tableRows.push({
            type: 'tableRow',
            content: rowCells
          });
          
          isHeader = false;
          j++;
        }
        
        if (tableRows.length > 0) {
          content.push({
            type: 'table',
            content: tableRows
          });
        }
        
        i = j;
        continue;
      }
      
      // Regular paragraph - parse inline markdown
      const paragraphContent = this.parseInlineMarkdown(line);
      content.push({
        type: 'paragraph',
        content: paragraphContent.length > 0 ? paragraphContent : [{ type: 'text', text: line }]
      });
      i++;
    }
    
    return {
      type: 'doc',
      version: 1,
      content: content
    };
  }

  public createDescriptionADF(
    description?: string, 
    notionUrl?: string, 
    includeDescription: boolean = false, 
    figmaLink?: string,
    owner?: string,
    roadmap?: string,
    vertical?: string
  ): any {
    const content: any[] = [];
    
    // Always add a Notion link block if provided
    if (notionUrl) {
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '🔗 ', marks: [] },
          {
            type: 'text',
            text: 'View in Notion',
            marks: [{ type: 'link', attrs: { href: notionUrl } }]
          }
        ]
      });
      
      // Add a separator line
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '—', marks: [] }
        ]
      });
    }

    // Always include the full description content for both Epics and Stories
    if (includeDescription && description && description.trim()) {
      // Convert description to ADF format (handles markdown-like content)
      const adf = this.convertMarkdownToADF(description);
      if (Array.isArray(adf?.content)) {
        content.push(...adf.content);
      }
      
      // Add footer note
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '\n', marks: [] }
        ]
      });
      
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '📝 ', marks: [] },
          { type: 'text', text: 'Content synchronized from Notion', marks: [{ type: 'em' }] }
        ]
      });
    }

    // Add Figma link if provided
    if (figmaLink && figmaLink.trim()) {
      logger.info(`🎨 Adding Figma link to Jira description: ${figmaLink}`);
      // Add separator before Figma link
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '—', marks: [] }
        ]
      });

      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '🎨 ', marks: [] },
          {
            type: 'text',
            text: 'View in Figma',
            marks: [{ type: 'link', attrs: { href: figmaLink.trim() } }]
          }
        ]
      });
    } else if (figmaLink !== undefined) {
      logger.debug(`⚠️ Figma link provided but empty or whitespace: "${figmaLink}"`);
    }

    // Add additional metadata if provided (Owner, Roadmap, Vertical)
    if (owner || roadmap || vertical) {
      // Add separator
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '—', marks: [] }
        ]
      });

      // Add metadata header
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Additional Information:', marks: [{ type: 'strong' }] }
        ]
      });

      // Add owner if provided
      if (owner) {
        content.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: '• Owner: ', marks: [] },
            { type: 'text', text: owner, marks: [] }
          ]
        });
      }

      // Add roadmap if provided
      if (roadmap) {
        content.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: '• Roadmap: ', marks: [] },
            { type: 'text', text: roadmap, marks: [] }
          ]
        });
      }

      // Add vertical if provided
      if (vertical) {
        content.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: '• Vertical: ', marks: [] },
            { type: 'text', text: vertical, marks: [] }
          ]
        });
      }
    }
    
    return { type: 'doc', version: 1, content };
  }

  public createNotionLinkADF(notionUrl: string): any {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '🔗 Notion Page: ',
              marks: [{ type: 'strong' }]
            },
            {
              type: 'text',
              text: 'View in Notion',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: notionUrl
                  }
                }
              ]
            }
          ]
        }
      ]
    };
  }
}
