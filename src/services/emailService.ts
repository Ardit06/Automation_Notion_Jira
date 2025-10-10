import nodemailer from 'nodemailer';
import { logger } from './loggerService';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Create transporter using Gmail SMTP
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'mardit15@gmail.com',
        pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_APP_PASSWORD // Use App Password for Gmail
      }
    });
  }

  private formatCommentText(commentText: any): string {
    // Handle ADF format comments from Jira
    if (typeof commentText === 'object' && commentText !== null) {
      if (commentText.content && Array.isArray(commentText.content)) {
        return this.extractTextFromADF(commentText.content);
      }
      // Fallback for other object formats
      return JSON.stringify(commentText);
    }
    
    // Handle string comments
    if (typeof commentText === 'string') {
      return commentText.replace(/\n/g, '<br>');
    }
    
    // Fallback for any other type
    return String(commentText);
  }

  private extractTextFromADF(content: any[]): string {
    let text = '';
    
    for (const item of content) {
      if (item.type === 'paragraph' && item.content) {
        for (const paragraphContent of item.content) {
          if (paragraphContent.type === 'text' && paragraphContent.text) {
            text += paragraphContent.text;
          }
        }
        text += '\n';
      } else if (item.type === 'text' && item.text) {
        text += item.text;
      }
    }
    
    return text.replace(/\n/g, '<br>').trim();
  }

  async sendCommentNotification(
    jiraKey: string,
    jiraUrl: string,
    commentAuthor: string,
    commentText: any,
    issueTitle: string,
    recipientEmail: string = 'mardit15@gmail.com'
  ): Promise<boolean> {
    try {
      const subject = `💬 New Comment on JIRA Issue: ${jiraKey}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; text-align: center;">🔔 JIRA Comment Notification</h2>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
            <h3 style="color: #333; margin-top: 0;">📋 Issue Details</h3>
            <p><strong>Issue:</strong> <a href="${jiraUrl}" style="color: #007bff; text-decoration: none;">${jiraKey}</a></p>
            <p><strong>Title:</strong> ${issueTitle}</p>
            <p><strong>Comment Author:</strong> ${commentAuthor}</p>
            
            <h3 style="color: #333; margin-top: 20px;">💬 Comment</h3>
            <div style="background: white; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0;">
              ${this.formatCommentText(commentText)}
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${jiraUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                🔗 View in JIRA
              </a>
            </div>
          </div>
          
          <div style="background: #6c757d; color: white; padding: 10px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            <p style="margin: 0;">This notification was sent by your Notion-JIRA Automation System</p>
          </div>
        </div>
      `;

      const textContent = `
JIRA Comment Notification

Issue: ${jiraKey}
Title: ${issueTitle}
Comment Author: ${commentAuthor}

Comment:
${commentText}

View in JIRA: ${jiraUrl}

---
This notification was sent by your Notion-JIRA Automation System
      `;

      const mailOptions = {
        from: `"JIRA Notifications" <${process.env.EMAIL_USER || 'mardit15@gmail.com'}>`,
        to: recipientEmail,
        subject: subject,
        text: textContent,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Email notification sent for comment on ${jiraKey} to ${recipientEmail}`);
      return true;

    } catch (error) {
      logger.error(`❌ Failed to send email notification for ${jiraKey}:`, error);
      return false;
    }
  }

  async sendIssueCreatedNotification(
    jiraKey: string,
    jiraUrl: string,
    issueTitle: string,
    issueType: string,
    notionUrl: string,
    recipientEmail: string = 'mardit15@gmail.com'
  ): Promise<boolean> {
    try {
      const subject = `🎯 New ${issueType} Created: ${jiraKey}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; text-align: center;">🎉 New ${issueType} Created</h2>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
            <h3 style="color: #333; margin-top: 0;">📋 Issue Details</h3>
            <p><strong>Issue:</strong> <a href="${jiraUrl}" style="color: #007bff; text-decoration: none;">${jiraKey}</a></p>
            <p><strong>Type:</strong> ${issueType}</p>
            <p><strong>Title:</strong> ${issueTitle}</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${jiraUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
                🔗 View in JIRA
              </a>
              <a href="${notionUrl}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                📄 View in Notion
              </a>
            </div>
          </div>
          
          <div style="background: #6c757d; color: white; padding: 10px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            <p style="margin: 0;">This notification was sent by your Notion-JIRA Automation System</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: `"JIRA Notifications" <${process.env.EMAIL_USER || 'mardit15@gmail.com'}>`,
        to: recipientEmail,
        subject: subject,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Issue creation notification sent for ${jiraKey} to ${recipientEmail}`);
      return true;

    } catch (error) {
      logger.error(`❌ Failed to send issue creation notification for ${jiraKey}:`, error);
      return false;
    }
  }

  async testEmailConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('✅ Email service connection verified');
      return true;
    } catch (error) {
      logger.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}
