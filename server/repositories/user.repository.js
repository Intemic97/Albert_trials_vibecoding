/**
 * User Repository
 * Data access layer for users, organizations, user_organizations, pending_invitations.
 */

class UserRepository {
  constructor(db) {
    this.db = db;
  }

  // ============================================================
  // USERS
  // ============================================================

  async findById(id) {
    return this.db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async findByEmail(email) {
    return this.db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  async findNameById(id) {
    return this.db.get('SELECT name, email FROM users WHERE id = ?', [id]);
  }

  async countAll() {
    return this.db.get('SELECT COUNT(*) as count FROM users');
  }

  async findAllWithOrgs() {
    return this.db.all(
      `SELECT u.id, u.name, u.email, u.profilePhoto, u.companyRole, u.isAdmin, u.createdAt,
        u.onboardingRole, u.onboardingIndustry, u.onboardingUseCase, u.onboardingSource, u.onboardingCompleted,
        GROUP_CONCAT(DISTINCT o.name) as organizations, COUNT(DISTINCT uo.organizationId) as orgCount
       FROM users u
       LEFT JOIN user_organizations uo ON u.id = uo.userId
       LEFT JOIN organizations o ON uo.organizationId = o.id
       GROUP BY u.id ORDER BY u.createdAt DESC`
    );
  }

  async updateAdminStatus(userId, isAdmin) {
    return this.db.run('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin ? 1 : 0, userId]);
  }

  async delete(userId) {
    await this.db.run('DELETE FROM user_organizations WHERE userId = ?', [userId]);
    return this.db.run('DELETE FROM users WHERE id = ?', [userId]);
  }

  // ============================================================
  // ORGANIZATIONS
  // ============================================================

  async findOrgById(orgId) {
    return this.db.get('SELECT * FROM organizations WHERE id = ?', [orgId]);
  }

  async findOrgName(orgId) {
    return this.db.get('SELECT name FROM organizations WHERE id = ?', [orgId]);
  }

  async countOrgs() {
    return this.db.get('SELECT COUNT(*) as count FROM organizations');
  }

  async createOrg({ id, name, createdAt }) {
    return this.db.run('INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)', [id, name, createdAt]);
  }

  async updateOrgCompanyInfo(orgId, { name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview }) {
    return this.db.run(
      'UPDATE organizations SET name = ?, industry = ?, employees = ?, website = ?, linkedinUrl = ?, headquarters = ?, foundingYear = ?, overview = ? WHERE id = ?',
      [name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview, orgId]
    );
  }

  async findOrgCompanyInfo(orgId) {
    return this.db.get(
      'SELECT name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview FROM organizations WHERE id = ?',
      [orgId]
    );
  }

  async updateOrgLogo(orgId, logoPath) {
    return this.db.run('UPDATE organizations SET logo = ? WHERE id = ?', [logoPath, orgId]);
  }

  // Subscription
  async findOrgSubscription(orgId) {
    return this.db.get(
      'SELECT subscriptionPlan, stripeCustomerId, stripeSubscriptionId, subscriptionStatus, subscriptionCurrentPeriodEnd FROM organizations WHERE id = ?',
      [orgId]
    );
  }

  async updateOrgSubscription(orgId, data) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(orgId);
    return this.db.run(`UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async findOrgByStripeCustomerId(customerId) {
    return this.db.get('SELECT id FROM organizations WHERE stripeCustomerId = ?', [customerId]);
  }

  // Slack
  async findOrgSlackConfig(orgId) {
    return this.db.get(
      'SELECT slackBotToken, slackTeamId, slackTeamName, slackConnectedAt FROM organizations WHERE id = ?',
      [orgId]
    );
  }

  async updateOrgSlack(orgId, { slackBotToken, slackTeamId, slackTeamName, slackConnectedAt }) {
    return this.db.run(
      'UPDATE organizations SET slackBotToken = ?, slackTeamId = ?, slackTeamName = ?, slackConnectedAt = ? WHERE id = ?',
      [slackBotToken, slackTeamId, slackTeamName, slackConnectedAt, orgId]
    );
  }

  async clearOrgSlack(orgId) {
    return this.db.run(
      'UPDATE organizations SET slackBotToken = NULL, slackTeamId = NULL, slackTeamName = NULL, slackConnectedAt = NULL WHERE id = ?',
      [orgId]
    );
  }

  async findOrgBySlackTeamId(teamId) {
    return this.db.get('SELECT id, slackBotToken FROM organizations WHERE slackTeamId = ?', [teamId]);
  }

  // ============================================================
  // USER_ORGANIZATIONS
  // ============================================================

  async isUserInOrg(userId, orgId) {
    const row = await this.db.get('SELECT userId FROM user_organizations WHERE userId = ? AND organizationId = ?', [userId, orgId]);
    return !!row;
  }

  async addUserToOrg(userId, orgId, role = 'member') {
    return this.db.run('INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)', [userId, orgId, role]);
  }

  async findUserOrgIds(userId) {
    return this.db.all('SELECT organizationId FROM user_organizations WHERE userId = ?', [userId]);
  }

  // ============================================================
  // PENDING INVITATIONS
  // ============================================================

  async findPendingInvitations(orgId) {
    return this.db.all(
      "SELECT id, email, invitedByName, createdAt, status FROM pending_invitations WHERE organizationId = ? AND status = 'pending' ORDER BY createdAt DESC",
      [orgId]
    );
  }

  async findInvitationById(id, orgId) {
    return this.db.get('SELECT id, email FROM pending_invitations WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async deleteInvitation(id) {
    return this.db.run('DELETE FROM pending_invitations WHERE id = ?', [id]);
  }

  async deleteInvitationsByInviter(userId) {
    return this.db.run('DELETE FROM pending_invitations WHERE invitedBy = ?', [userId]);
  }
}

module.exports = { UserRepository };
