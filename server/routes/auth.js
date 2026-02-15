/**
 * Auth & Organization Routes
 * 
 * Handles: authentication, registration, organization management,
 * profile updates, company information, invitations.
 */

const express = require('express');
const router = express.Router();
const { openDb } = require('../db');
const { 
    register, login, logout, authenticateToken, getMe, 
    getOrganizations, switchOrganization, getOrganizationUsers, 
    inviteUser, updateProfile, completeOnboarding,
    verifyEmail, resendVerification, validateInvitation, 
    registerWithInvitation, forgotPassword, validateResetToken, resetPassword 
} = require('../auth');

module.exports = function({ db }) {

    // Auth Routes
    router.post('/auth/register', register);
    router.post('/auth/login', login);
    router.post('/auth/logout', logout);
    router.get('/auth/verify-email', verifyEmail);
    router.post('/auth/resend-verification', resendVerification);
    router.get('/auth/validate-invitation', validateInvitation);
    router.post('/auth/register-with-invitation', registerWithInvitation);
    router.post('/auth/forgot-password', forgotPassword);
    router.get('/auth/validate-reset-token', validateResetToken);
    router.post('/auth/reset-password', resetPassword);
    router.get('/auth/me', authenticateToken, getMe);
    router.get('/auth/organizations', authenticateToken, getOrganizations);
    router.post('/auth/switch-org', authenticateToken, switchOrganization);
    router.get('/organization/users', authenticateToken, getOrganizationUsers);
    router.post('/organization/invite', authenticateToken, inviteUser);

    // Get pending invitations for current organization
    router.get('/organization/pending-invitations', authenticateToken, async (req, res) => {
        const orgId = req.user.orgId;
        const localDb = await openDb();

        try {
            const invitations = await localDb.all(`
                SELECT id, email, invitedByName, createdAt, status
                FROM pending_invitations 
                WHERE organizationId = ? AND status = 'pending'
                ORDER BY createdAt DESC
            `, [orgId]);

            res.json(invitations);
        } catch (error) {
            console.error('Get pending invitations error:', error);
            res.status(500).json({ error: 'Failed to fetch pending invitations' });
        }
    });

    // Cancel/delete a pending invitation
    router.delete('/organization/pending-invitations/:id', authenticateToken, async (req, res) => {
        const { id } = req.params;
        const orgId = req.user.orgId;
        const localDb = await openDb();

        try {
            const invitation = await localDb.get(
                'SELECT id, email FROM pending_invitations WHERE id = ? AND organizationId = ?',
                [id, orgId]
            );

            if (!invitation) {
                return res.status(404).json({ error: 'Invitation not found' });
            }

            await localDb.run('DELETE FROM pending_invitations WHERE id = ?', [id]);

            console.log(`[Auth] Invitation to ${invitation.email} cancelled for org ${orgId}`);
            res.json({ message: 'Invitation cancelled', email: invitation.email });
        } catch (error) {
            console.error('Cancel invitation error:', error);
            res.status(500).json({ error: 'Failed to cancel invitation' });
        }
    });

    // Create new organization
    router.post('/organizations', authenticateToken, async (req, res) => {
        const { name } = req.body;
        const userId = req.user.sub;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Organization name is required' });
        }

        const localDb = await openDb();

        try {
            const orgId = Math.random().toString(36).substr(2, 9);
            const now = new Date().toISOString();

            await localDb.run('BEGIN TRANSACTION');

            await localDb.run(
                'INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)',
                [orgId, name.trim(), now]
            );

            await localDb.run(
                'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
                [userId, orgId, 'admin']
            );

            await localDb.run('COMMIT');

            console.log(`[Org] User ${userId} created organization ${name} (${orgId})`);

            res.status(201).json({ 
                message: 'Organization created successfully',
                organization: { id: orgId, name: name.trim(), role: 'admin' }
            });

        } catch (error) {
            await localDb.run('ROLLBACK');
            console.error('Create organization error:', error);
            res.status(500).json({ error: 'Failed to create organization' });
        }
    });

    router.put('/profile', authenticateToken, updateProfile);
    router.post('/auth/onboarding', authenticateToken, completeOnboarding);

    // Company information endpoints
    router.get('/company', authenticateToken, async (req, res) => {
        try {
            const org = await db.get(
                'SELECT name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview FROM organizations WHERE id = ?',
                [req.user.orgId]
            );
            if (!org) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            res.json(org);
        } catch (error) {
            console.error('Get company info error:', error);
            res.status(500).json({ error: 'Failed to get company information' });
        }
    });

    router.put('/company', authenticateToken, async (req, res) => {
        const { name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview } = req.body;
        
        try {
            await db.run(
                `UPDATE organizations SET 
                    name = COALESCE(?, name),
                    industry = ?,
                    employees = ?,
                    website = ?,
                    linkedinUrl = ?,
                    headquarters = ?,
                    foundingYear = ?,
                    overview = ?
                WHERE id = ?`,
                [name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview, req.user.orgId]
            );
            
            res.json({ message: 'Company information updated successfully' });
        } catch (error) {
            console.error('Update company info error:', error);
            res.status(500).json({ error: 'Failed to update company information' });
        }
    });

    // Update organization logo
    router.put('/organizations/current/logo', authenticateToken, async (req, res) => {
        const { logo } = req.body;
        
        if (!logo) {
            return res.status(400).json({ error: 'Logo filename is required' });
        }
        
        const localDb = await openDb();
        
        try {
            await localDb.run(
                'UPDATE organizations SET logo = ? WHERE id = ?',
                [logo, req.user.orgId]
            );
            
            console.log(`[Org] Updated logo for organization ${req.user.orgId}`);
            res.json({ message: 'Organization logo updated successfully', logo });
        } catch (error) {
            console.error('Update organization logo error:', error);
            res.status(500).json({ error: 'Failed to update organization logo' });
        }
    });

    return router;
};

