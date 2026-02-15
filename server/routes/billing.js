/**
 * Billing & Stripe Routes
 * 
 * Handles: subscription management, checkout sessions, portal sessions,
 * quotation requests, Stripe webhooks.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db, stripe, STRIPE_PRICES }) {

// ==================== STRIPE BILLING ENDPOINTS ====================

// Get current subscription plan for the organization
router.get('/billing/subscription', authenticateToken, async (req, res) => {
    try {
        const org = await db.get(
            'SELECT subscriptionPlan, stripeCustomerId, stripeSubscriptionId, subscriptionStatus, subscriptionCurrentPeriodEnd FROM organizations WHERE id = ?',
            [req.user.orgId]
        );

        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json({
            plan: org.subscriptionPlan || 'free',
            status: org.subscriptionStatus || 'active',
            currentPeriodEnd: org.subscriptionCurrentPeriodEnd,
            hasStripeCustomer: !!org.stripeCustomerId
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// Create Stripe Checkout Session for subscription
router.post('/billing/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const { plan } = req.body; // 'pro' or 'business'

        if (!plan || !['pro', 'business'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "business"' });
        }

        const priceId = STRIPE_PRICES[plan];
        if (!priceId || priceId.includes('placeholder')) {
            return res.status(400).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY and price IDs in environment variables.' });
        }

        // Get or create Stripe customer
        const org = await db.get('SELECT * FROM organizations WHERE id = ?', [req.user.orgId]);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.sub]);

        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let customerId = org.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: org.name,
                metadata: {
                    organizationId: org.id,
                    userId: user.id
                }
            });
            customerId = customer.id;

            await db.run(
                'UPDATE organizations SET stripeCustomerId = ? WHERE id = ?',
                [customerId, org.id]
            );
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?billing=cancelled`,
            metadata: {
                organizationId: org.id,
                plan: plan
            }
        });

        res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
});

// Create Stripe Customer Portal session (for managing subscription)
router.post('/billing/create-portal-session', authenticateToken, async (req, res) => {
    try {
        const org = await db.get('SELECT stripeCustomerId FROM organizations WHERE id = ?', [req.user.orgId]);

        if (!org?.stripeCustomerId) {
            return res.status(400).json({ error: 'No active subscription found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: org.stripeCustomerId,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating portal session:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// Request quotation endpoint (sends email to sales team)
router.post('/request-quotation', authenticateToken, async (req, res) => {
    try {
        const { useCase } = req.body;

        if (!useCase || !useCase.trim()) {
            return res.status(400).json({ error: 'Use case is required' });
        }

        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.sub]);
        const org = await db.get('SELECT * FROM organizations WHERE id = ?', [req.user.orgId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Import Resend
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        // Send email to sales team
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #14b8a6;">Nueva solicitud de cotización</h2>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Usuario:</strong> ${user.name}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Organización:</strong> ${org ? org.name : 'N/A'}</p>
                    <p><strong>Plan actual:</strong> ${org ? org.subscriptionPlan || 'free' : 'N/A'}</p>
                </div>
                <div style="margin: 20px 0;">
                    <h3 style="color: #334155;">Caso de uso:</h3>
                    <p style="white-space: pre-wrap; background-color: #f8fafc; padding: 15px; border-radius: 8px;">${useCase}</p>
                </div>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
                    <p>Este email fue generado automáticamente desde la plataforma Intemic.</p>
                </div>
            </div>
        `;

        await resend.emails.send({
            from: 'Intemic Platform <onboarding@resend.dev>',
            to: ['a.mestre@intemic.com', 'm.alcazar@intemic.com'],
            subject: `Nueva solicitud de cotización - ${user.email}`,
            html: emailHtml
        });

        console.log('Quotation request email sent to sales team for user:', user.email);

        res.json({ 
            success: true, 
            message: 'Quotation request sent successfully' 
        });
    } catch (error) {
        console.error('Error sending quotation request:', error);
        res.status(500).json({ error: 'Failed to send quotation request' });
    }
});


    // ==================== STRIPE WEBHOOK ====================

router.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            // For testing without webhook signature verification
            event = JSON.parse(req.body.toString());
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('[Stripe Webhook] Event received:', event.type);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const orgId = session.metadata?.organizationId;
                const plan = session.metadata?.plan;

                if (orgId && plan) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    
                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionPlan = ?, 
                            stripeSubscriptionId = ?,
                            subscriptionStatus = ?,
                            subscriptionCurrentPeriodEnd = ?
                        WHERE id = ?
                    `, [
                        plan,
                        subscription.id,
                        subscription.status,
                        new Date(subscription.current_period_end * 1000).toISOString(),
                        orgId
                    ]);
                    console.log(`[Stripe] Organization ${orgId} upgraded to ${plan}`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                const org = await db.get('SELECT id FROM organizations WHERE stripeCustomerId = ?', [customerId]);
                
                if (org) {
                    // Determine plan from price
                    let plan = 'free';
                    const priceId = subscription.items.data[0]?.price?.id;
                    if (priceId === STRIPE_PRICES.business) {
                        plan = 'business';
                    } else if (priceId === STRIPE_PRICES.pro) {
                        plan = 'pro';
                    }

                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionPlan = ?,
                            subscriptionStatus = ?,
                            subscriptionCurrentPeriodEnd = ?
                        WHERE id = ?
                    `, [
                        plan,
                        subscription.status,
                        new Date(subscription.current_period_end * 1000).toISOString(),
                        org.id
                    ]);
                    console.log(`[Stripe] Subscription updated for org ${org.id}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                const org = await db.get('SELECT id FROM organizations WHERE stripeCustomerId = ?', [customerId]);
                
                if (org) {
                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionPlan = 'free',
                            stripeSubscriptionId = NULL,
                            subscriptionStatus = 'cancelled'
                        WHERE id = ?
                    `, [org.id]);
                    console.log(`[Stripe] Subscription cancelled for org ${org.id}`);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customerId = invoice.customer;

                const org = await db.get('SELECT id FROM organizations WHERE stripeCustomerId = ?', [customerId]);
                
                if (org) {
                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionStatus = 'past_due'
                        WHERE id = ?
                    `, [org.id]);
                    console.log(`[Stripe] Payment failed for org ${org.id}`);
                }
                break;
            }
        }
    } catch (error) {
        console.error('[Stripe Webhook] Error processing event:', error);
    }

    res.json({ received: true });
});


    return router;
};
