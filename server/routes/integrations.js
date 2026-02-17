/**
 * Integrations & External Services Routes
 * 
 * Handles: HTTP proxy, MySQL queries, email/SMS/WhatsApp sending,
 * node feedback, Slack integration.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db }) {

router.post('/proxy', authenticateToken, async (req, res) => {
    const { url, method = 'GET', headers = {} } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const response = await fetch(url, {
            method,
            headers: {
                ...headers,
                'User-Agent': 'Intemic-Workflow-Agent/1.0'
            }
        });

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: `Request failed: ${response.statusText}`, details: data });
        }

        res.json(data);
    } catch (error) {
        console.error('Proxy request error:', error);
        res.status(500).json({ error: error.message });
    }
});

// MySQL Query Endpoint
router.post('/mysql/query', authenticateToken, async (req, res) => {
    const { host, port, database, username, password, query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'SQL query is required' });
    }

    // Only allow SELECT queries for security
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
        return res.status(400).json({ error: 'Only SELECT queries are allowed for security reasons' });
    }

    try {
        const mysql = require('mysql2/promise');
        
        const connection = await mysql.createConnection({
            host: host || 'localhost',
            port: parseInt(port) || 3306,
            database: database,
            user: username,
            password: password,
            connectTimeout: 10000
        });

        const [rows] = await connection.execute(query);
        await connection.end();

        res.json({ results: rows });
    } catch (error) {
        console.error('MySQL query error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute MySQL query' });
    }
});

// Send Email Endpoint — uses Resend by default, falls back to SMTP if configured
router.post('/email/send', authenticateToken, async (req, res) => {
    const { to, subject, body, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

    if (!to) {
        return res.status(400).json({ error: 'Recipient email is required' });
    }

    try {
        const { sendEmail } = require('../utils/emailService');
        const result = await sendEmail({
            to,
            subject: subject || '(No subject)',
            text: body || '',
            html: body ? body.replace(/\n/g, '<br>') : '',
            smtp: (smtpUser && smtpPass) ? { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass } : undefined,
        });

        if (result.success) {
            res.json({ success: true, messageId: result.messageId, provider: result.provider });
        } else {
            res.status(500).json({ error: result.error || 'Failed to send email' });
        }
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send email' });
    }
});

// Send SMS Endpoint (using Twilio)
router.post('/sms/send', authenticateToken, async (req, res) => {
    const { to, body, accountSid, authToken, fromNumber } = req.body;

    if (!to) {
        return res.status(400).json({ error: 'Recipient phone number is required' });
    }

    if (!accountSid || !authToken || !fromNumber) {
        return res.status(400).json({ error: 'Twilio credentials are required (Account SID, Auth Token, and From Number)' });
    }

    try {
        const twilio = require('twilio');
        const client = twilio(accountSid, authToken);

        const message = await client.messages.create({
            body: body || '',
            from: fromNumber,
            to: to
        });

        console.log('SMS sent:', message.sid);
        res.json({ 
            success: true, 
            messageSid: message.sid,
            status: message.status,
            to: message.to,
            from: message.from
        });
    } catch (error) {
        console.error('SMS send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send SMS' });
    }
});

// Send WhatsApp Endpoint (using Twilio)
router.post('/whatsapp/send', authenticateToken, async (req, res) => {
    const { to, body, accountSid, authToken, fromNumber } = req.body;

    if (!to) {
        return res.status(400).json({ error: 'Recipient phone number is required' });
    }

    if (!accountSid || !authToken || !fromNumber) {
        return res.status(400).json({ error: 'Twilio credentials are required (Account SID, Auth Token, and From Number)' });
    }

    try {
        const twilio = require('twilio');
        const client = twilio(accountSid, authToken);

        const message = await client.messages.create({
            body: body || '',
            from: `whatsapp:${fromNumber}`,
            to: `whatsapp:${to}`
        });

        console.log('WhatsApp sent:', message.sid);
        res.json({ 
            success: true, 
            messageSid: message.sid,
            status: message.status,
            to: message.to,
            from: message.from
        });
    } catch (error) {
        console.error('WhatsApp send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send WhatsApp message' });
    }
});

// Node Feedback Endpoints
router.post('/node-feedback', authenticateToken, async (req, res) => {
    try {
        const { nodeType, nodeLabel, feedbackText, workflowId, workflowName } = req.body;

        if (!nodeType || !feedbackText) {
            return res.status(400).json({ error: 'Node type and feedback text are required' });
        }

        const id = Math.random().toString(36).substr(2, 9);
        const createdAt = new Date().toISOString();

        await db.run(`
            INSERT INTO node_feedback (id, nodeType, nodeLabel, feedbackText, userId, userName, userEmail, organizationId, workflowId, workflowName, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, nodeType, nodeLabel || '', feedbackText, req.user.id, req.user.name || '', req.user.email || '', req.user.orgId, workflowId || null, workflowName || null, createdAt]);

        res.json({ success: true, id, message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Error saving node feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Admin endpoint to get all node feedback
router.get('/admin/node-feedback', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const feedback = await db.all(`
            SELECT nf.*, o.name as organizationName
            FROM node_feedback nf
            LEFT JOIN organizations o ON nf.organizationId = o.id
            ORDER BY nf.createdAt DESC
        `);
        res.json(feedback);
    } catch (error) {
        console.error('Error fetching node feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

// Admin endpoint to delete node feedback
router.delete('/admin/node-feedback/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.run('DELETE FROM node_feedback WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting node feedback:', error);
        res.status(500).json({ error: 'Failed to delete feedback' });
    }
});


    // ==================== SLACK INTEGRATION ====================

    // Helper function to send messages to Slack
async function sendSlackMessage(token, channel, text, threadTs = null) {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            channel,
            text,
            thread_ts: threadTs,
            unfurl_links: false,
            unfurl_media: false
        })
    });

    const data = await response.json();
    if (!data.ok) {
        console.error('[Slack] Failed to send message:', data.error);
        throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
}

// Get Slack integration status for an organization

router.get('/integrations/slack', authenticateToken, async (req, res) => {
    try {
        const org = await db.get(
            'SELECT slackBotToken, slackTeamId, slackTeamName, slackConnectedAt FROM organizations WHERE id = ?',
            [req.user.orgId]
        );

        if (!org || !org.slackBotToken) {
            return res.json({ connected: false });
        }

        res.json({
            connected: true,
            teamName: org.slackTeamName,
            teamId: org.slackTeamId,
            connectedAt: org.slackConnectedAt
        });
    } catch (error) {
        console.error('[Slack Integration] Error fetching status:', error);
        res.status(500).json({ error: 'Failed to fetch Slack integration status' });
    }
});

// Connect Slack to organization
router.post('/integrations/slack/connect', authenticateToken, async (req, res) => {
    try {
        const { botToken } = req.body;

        if (!botToken || !botToken.startsWith('xoxb-')) {
            return res.status(400).json({ error: 'Invalid bot token. It should start with xoxb-' });
        }

        // Verify the token by calling Slack API
        const authResponse = await fetch('https://slack.com/api/auth.test', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${botToken}`,
                'Content-Type': 'application/json'
            }
        });

        const authData = await authResponse.json();

        if (!authData.ok) {
            return res.status(400).json({ error: `Invalid token: ${authData.error}` });
        }

        // Save the token and team info
        await db.run(`
            UPDATE organizations 
            SET slackBotToken = ?, slackTeamId = ?, slackTeamName = ?, slackConnectedAt = ?
            WHERE id = ?
        `, [botToken, authData.team_id, authData.team, new Date().toISOString(), req.user.orgId]);

        console.log(`[Slack Integration] Connected org ${req.user.orgId} to team ${authData.team}`);

        res.json({
            success: true,
            teamName: authData.team,
            teamId: authData.team_id
        });
    } catch (error) {
        console.error('[Slack Integration] Error connecting:', error);
        res.status(500).json({ error: 'Failed to connect Slack' });
    }
});

// Disconnect Slack from organization
router.post('/integrations/slack/disconnect', authenticateToken, async (req, res) => {
    try {
        await db.run(`
            UPDATE organizations 
            SET slackBotToken = NULL, slackTeamId = NULL, slackTeamName = NULL, slackConnectedAt = NULL
            WHERE id = ?
        `, [req.user.orgId]);

        console.log(`[Slack Integration] Disconnected org ${req.user.orgId}`);

        res.json({ success: true });
    } catch (error) {
        console.error('[Slack Integration] Error disconnecting:', error);
        res.status(500).json({ error: 'Failed to disconnect Slack' });
    }
});

// Get the Slack webhook URL for setup
router.get('/integrations/slack/webhook-info', authenticateToken, async (req, res) => {
    const baseUrl = process.env.API_URL || 'http://localhost:3001';
    res.json({
        webhookUrl: `${baseUrl}/api/slack/database-assistant`,
        instructions: [
            "1. Go to api.slack.com/apps and create a new app",
            "2. In 'OAuth & Permissions', add these Bot Token Scopes: chat:write, app_mentions:read, im:history",
            "3. Install the app to your workspace and copy the Bot User OAuth Token",
            "4. Paste the token above and click Connect",
            "5. In 'Event Subscriptions', enable events and set the Request URL to:",
            `   ${baseUrl}/api/slack/database-assistant`,
            "6. Subscribe to bot events: app_mention, message.im",
            "7. Reinstall the app if prompted"
        ]
    });
});

// Slack Events endpoint - receives messages and queries the Database Assistant (MULTI-TENANT)
router.post('/slack/database-assistant', async (req, res) => {
    const slackEvent = req.body;

    // Slack URL verification challenge
    if (slackEvent.challenge) {
        console.log('[Slack DB Assistant] Responding to URL verification challenge');
        return res.status(200).json({ challenge: slackEvent.challenge });
    }

    // Acknowledge immediately to prevent Slack retries (3 second timeout)
    res.status(200).json({ ok: true });

    // Process the event asynchronously
    try {
        const event = slackEvent.event;
        const teamId = slackEvent.team_id;
        
        // Only process messages (not bot messages or message changes)
        if (!event || event.bot_id || event.subtype) {
            console.log('[Slack DB Assistant] Ignoring non-user message');
            return;
        }

        // Check for app_mention or direct message
        const isAppMention = event.type === 'app_mention';
        const isDirectMessage = event.channel_type === 'im';
        
        if (!isAppMention && !isDirectMessage) {
            console.log('[Slack DB Assistant] Not a mention or DM, ignoring');
            return;
        }

        // Find the organization by Slack team_id (MULTI-TENANT)
        const org = await db.get(
            'SELECT id, slackBotToken FROM organizations WHERE slackTeamId = ?',
            [teamId]
        );

        if (!org || !org.slackBotToken) {
            console.error(`[Slack DB Assistant] No organization found for team ${teamId}`);
            return;
        }

        const slackBotToken = org.slackBotToken;
        const orgId = org.id;

        // Extract the question (remove the @mention if present)
        let question = event.text || '';
        question = question.replace(/<@[A-Z0-9]+>/g, '').trim();

        if (!question) {
            console.log('[Slack DB Assistant] No question text found');
            return;
        }

        console.log(`[Slack DB Assistant] Processing question for org ${orgId}: "${question}"`);

        // Check OpenAI is configured
        if (!process.env.OPENAI_API_KEY) {
            await sendSlackMessage(slackBotToken, event.channel,
                "❌ AI service is not configured. Please contact your administrator.",
                event.ts
            );
            return;
        }

        // Fetch database context for the organization
        const entities = await db.all('SELECT * FROM entities WHERE organizationId = ?', [orgId]);
        
        if (entities.length === 0) {
            await sendSlackMessage(slackBotToken, event.channel,
                "📭 No database entities found. Please set up your database first in Intemic.",
                event.ts
            );
            return;
        }

        const databaseContext = {};
        
        for (const entity of entities) {
            const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entity.id]);
            const records = await db.all('SELECT * FROM records WHERE entityId = ?', [entity.id]);
            
            const recordsWithValues = await Promise.all(records.map(async (record) => {
                const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [record.id]);
                const valuesMap = {};
                
                for (const v of values) {
                    const prop = properties.find(p => p.id === v.propertyId);
                    const key = prop ? prop.name : v.propertyId;
                    valuesMap[key] = v.value;
                }
                
                return valuesMap;
            }));
            
            databaseContext[entity.name] = {
                description: entity.description,
                properties: properties.map(p => ({
                    name: p.name,
                    type: p.type
                })),
                recordCount: records.length,
                records: recordsWithValues.slice(0, 50)
            };
        }

        // Call OpenAI to answer the question
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const systemPrompt = `You are a helpful database assistant for Intemic platform, responding via Slack.

DATABASE SCHEMA AND DATA:
${JSON.stringify(databaseContext, null, 2)}

INSTRUCTIONS:
1. Answer questions about the data clearly and concisely
2. When counting records, be precise
3. Format your response for Slack (use *bold*, _italic_, bullet points with •)
4. Keep responses concise but informative (Slack has character limits)
5. If the question is unclear, ask for clarification
6. Be friendly and helpful

RESPONSE FORMAT:
- Use Slack markdown: *bold*, _italic_, \`code\`
- Use bullet points with • for lists
- Keep it under 2000 characters
- Be conversational`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question }
            ],
            temperature: 0.3,
            max_tokens: 800
        });

        const answer = completion.choices[0]?.message?.content || 'Sorry, I could not process your question.';

        // Send the response back to Slack
        await sendSlackMessage(slackBotToken, event.channel, answer, event.ts);
        console.log('[Slack DB Assistant] Response sent successfully');

    } catch (error) {
        console.error('[Slack DB Assistant] Error:', error);
        
        // Try to send error message if we have the token
        try {
            const teamId = req.body.team_id;
            if (teamId) {
                const org = await db.get('SELECT slackBotToken FROM organizations WHERE slackTeamId = ?', [teamId]);
                if (org?.slackBotToken && req.body.event?.channel) {
                    await sendSlackMessage(org.slackBotToken, req.body.event.channel,
                        "❌ Sorry, I encountered an error processing your question. Please try again.",
                        req.body.event.ts
                    );
                }
            }
        } catch (e) {
            console.error('[Slack DB Assistant] Failed to send error message:', e);
        }
    }
});


    return router;
};
