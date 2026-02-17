/**
 * Centralized email service.
 * Uses Resend (configured via RESEND_API_KEY) as the primary provider.
 * Falls back to SMTP (nodemailer) only if explicit SMTP credentials are provided.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Intemic <onboarding@resend.dev>';

let resendInstance = null;

function getResend() {
    if (!resendInstance && RESEND_API_KEY) {
        const { Resend } = require('resend');
        resendInstance = new Resend(RESEND_API_KEY);
    }
    return resendInstance;
}

/**
 * Send an email using the best available provider.
 *
 * @param {object} options
 * @param {string} options.to           - Recipient email(s), comma-separated
 * @param {string} options.subject      - Email subject
 * @param {string} [options.text]       - Plain-text body
 * @param {string} [options.html]       - HTML body (takes priority over text)
 * @param {string} [options.from]       - From address (defaults to RESEND_FROM)
 * @param {object} [options.smtp]       - Optional explicit SMTP config { host, port, user, pass }
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string, error?: string }>}
 */
async function sendEmail({ to, subject, text, html, from, smtp }) {
    if (!to) throw new Error('Recipient email (to) is required');

    // Build HTML from text if no html provided
    const htmlBody = html || (text ? text.replace(/\n/g, '<br>') : '');
    const textBody = text || '';

    // ── 1. Try Resend ──
    const resend = getResend();
    if (resend) {
        try {
            const result = await resend.emails.send({
                from: from || RESEND_FROM,
                to: Array.isArray(to) ? to : to.split(',').map(e => e.trim()),
                subject: subject || '(No subject)',
                html: htmlBody || undefined,
                text: textBody || undefined,
            });

            if (result?.data?.id) {
                console.log(`[EmailService] Sent via Resend to ${to}, id: ${result.data.id}`);
                return { success: true, provider: 'resend', messageId: result.data.id };
            }
            if (result?.error) {
                console.warn('[EmailService] Resend error:', result.error);
                // Fall through to SMTP if available
            }
        } catch (err) {
            console.warn('[EmailService] Resend exception:', err.message);
            // Fall through to SMTP if available
        }
    }

    // ── 2. Try SMTP if credentials provided ──
    if (smtp && smtp.user && smtp.pass) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: smtp.host || 'smtp.gmail.com',
                port: parseInt(smtp.port) || 587,
                secure: (parseInt(smtp.port) || 587) === 465,
                auth: { user: smtp.user, pass: smtp.pass },
            });

            const info = await transporter.sendMail({
                from: from || smtp.user,
                to,
                subject: subject || '(No subject)',
                text: textBody,
                html: htmlBody,
            });

            console.log(`[EmailService] Sent via SMTP to ${to}, id: ${info.messageId}`);
            return { success: true, provider: 'smtp', messageId: info.messageId };
        } catch (err) {
            console.error('[EmailService] SMTP error:', err.message);
            return { success: false, provider: 'smtp', error: err.message };
        }
    }

    // ── 3. No provider available ──
    const reason = RESEND_API_KEY
        ? 'Resend failed and no SMTP fallback configured'
        : 'No email provider configured. Set RESEND_API_KEY in environment variables.';
    console.warn(`[EmailService] ${reason}`);
    return { success: false, provider: 'none', error: reason };
}

module.exports = { sendEmail };

