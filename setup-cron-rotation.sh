#!/bin/bash

echo "🔄 Setting up automatic token rotation cron job..."

# Create the cron job script
cat > /tmp/rotate-tokens-cron.sh << 'EOF'
#!/bin/bash

# Token rotation script
cd /Users/ardit/zjira

# Log rotation attempts
echo "$(date): Starting token rotation check..." >> logs/token-rotation.log

# Check if tokens need rotation (example: check file modification date)
ENV_FILE="/Users/ardit/zjira/.env"
LAST_MODIFIED=$(stat -f %m "$ENV_FILE")
CURRENT_TIME=$(date +%s)
DAYS_SINCE_MODIFIED=$(( (CURRENT_TIME - LAST_MODIFIED) / 86400 ))

if [ $DAYS_SINCE_MODIFIED -gt 30 ]; then
    echo "$(date): Tokens are older than 30 days, rotation needed" >> logs/token-rotation.log
    
    # Send notification (you can customize this)
    echo "Token rotation reminder: Tokens are $DAYS_SINCE_MODIFIED days old" | \
    mail -s "Token Rotation Reminder" ardit@91.life 2>/dev/null || true
    
    # Run the rotation helper
    node rotate-tokens.js >> logs/token-rotation.log 2>&1
else
    echo "$(date): Tokens are fresh ($DAYS_SINCE_MODIFIED days old)" >> logs/token-rotation.log
fi
EOF

# Make the script executable
chmod +x /tmp/rotate-tokens-cron.sh

# Move to the project directory
mv /tmp/rotate-tokens-cron.sh /Users/ardit/zjira/rotate-tokens-cron.sh

# Add to crontab (runs every Monday at 9 AM)
(crontab -l 2>/dev/null; echo "0 9 * * 1 /Users/ardit/zjira/rotate-tokens-cron.sh") | crontab -

echo "✅ Cron job setup complete!"
echo ""
echo "📋 What was set up:"
echo "   - Cron job runs every Monday at 9 AM"
echo "   - Checks if tokens are older than 30 days"
echo "   - Logs rotation attempts to logs/token-rotation.log"
echo "   - Sends email reminder if rotation is needed"
echo ""
echo "🔍 To view cron jobs:"
echo "   crontab -l"
echo ""
echo "🗑️  To remove cron job:"
echo "   crontab -e"
echo "   (then delete the line with rotate-tokens-cron.sh)"
echo ""
echo "📊 To check rotation logs:"
echo "   tail -f logs/token-rotation.log"
