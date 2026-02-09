/**
 * Auth Service
 * Business logic for authentication, permissions, organization access.
 * 
 * Role hierarchy:
 *   admin > member
 * 
 * Permissions:
 *   admin: full CRUD on org resources, manage members, integrations
 *   member: read/write own resources, no member management
 */

const ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
};

const PERMISSIONS = {
  // User management
  MANAGE_USERS: 'manage_users',
  INVITE_USERS: 'invite_users',
  REMOVE_USERS: 'remove_users',
  // Integrations
  MANAGE_INTEGRATIONS: 'manage_integrations',
  // Billing
  MANAGE_BILLING: 'manage_billing',
  // Organization
  UPDATE_ORG: 'update_org',
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MEMBER]: [], // Members can't manage users, integrations, etc.
};

class AuthService {
  constructor(repos) {
    this.userRepo = repos.user;
  }

  /**
   * Check if user has permission.
   */
  hasPermission(userRole, permission) {
    const perms = ROLE_PERMISSIONS[userRole] || [];
    return perms.includes(permission);
  }

  /**
   * Check if user is admin of current org.
   */
  isAdmin(userRole) {
    return userRole === ROLES.ADMIN;
  }

  /**
   * Verify user belongs to organization.
   */
  async verifyOrgAccess(userId, orgId) {
    return this.userRepo.isUserInOrg(userId, orgId);
  }

  /**
   * Get user profile with org info.
   */
  async getUserProfile(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) return null;
    const orgIds = await this.userRepo.findUserOrgIds(userId);
    return { ...user, organizationIds: orgIds.map(o => o.organizationId) };
  }

  /**
   * Remove user from organization (admin only).
   */
  async removeUser(targetUserId, orgId, requestorRole) {
    if (!this.hasPermission(requestorRole, PERMISSIONS.REMOVE_USERS)) {
      throw new Error('Insufficient permissions to remove users');
    }

    const user = await this.userRepo.findById(targetUserId);
    if (!user) throw new Error('User not found');

    await this.userRepo.delete(targetUserId);
    return { message: 'User removed', userId: targetUserId };
  }
}

module.exports = { AuthService, ROLES, PERMISSIONS };
