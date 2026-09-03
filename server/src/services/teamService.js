const User = require('../models/User');

/**
 * Who counts as "my team" when sending a notification.
 *
 * The hierarchy is founder -> state_manager -> industry_manager -> executive,
 * linked by User.reportingTo. A notification must only reach the sender's own
 * branch of that tree — a State Manager broadcasting must not reach a peer
 * manager's executives (the same scoping bug we fixed on leads).
 */
const teamService = {
  /**
   * Active user ids reporting to `userId`, directly or at any depth below.
   * Walks the tree level by level rather than recursing per user, so a
   * three-level branch costs three queries regardless of team size.
   */
  async getDescendantIds(userId) {
    const collected = [];
    let frontier = [userId];

    // The tree is only ever four levels deep; the bound stops a cycle in the
    // data (a user reporting to their own report) from looping forever.
    for (let depth = 0; depth < 5 && frontier.length; depth++) {
      const children = await User.find({
        reportingTo: { $in: frontier },
        isActive: true,
      }).select('_id');

      const ids = children
        .map(c => c._id)
        .filter(id => !collected.some(seen => seen.equals(id)));

      if (!ids.length) break;
      collected.push(...ids);
      frontier = ids;
    }

    return collected;
  },

  /**
   * Recipients for a notification sent by `sender`.
   * The founder addresses every active member of staff; everyone else
   * addresses their own downline. `role` narrows it to one role, which is how
   * a document published for District Executives reaches only them.
   */
  async getTeamRecipientIds(sender, { role = null } = {}) {
    let ids;

    if (sender.role === 'founder') {
      const query = { isActive: true, _id: { $ne: sender._id } };
      if (role) query.role = role;
      const users = await User.find(query).select('_id');
      ids = users.map(u => u._id);
    } else {
      ids = await this.getDescendantIds(sender._id);
      if (role && ids.length) {
        const users = await User.find({ _id: { $in: ids }, role }).select('_id');
        ids = users.map(u => u._id);
      }
    }

    return ids.filter(id => !id.equals(sender._id));
  },
};

module.exports = teamService;
