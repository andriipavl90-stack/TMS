const META_GROUPS = ['SUPER_ADMIN', 'ADMIN'];

export function isGlobalFinanceViewerUser(user) {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return !!(user.group && META_GROUPS.includes(user.group));
}

/** Matches server finance manager routes (role or TEAM_BOSS degree). */
export function isFinanceManagerUser(user) {
  if (!user) return false;
  const r = user.role;
  if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'BOSS') return true;
  return user.degree === 'TEAM_BOSS';
}

/** Params for GET /admin/users when building finance member pickers. */
export function financeUsersListParams(user, { limit = 1000 } = {}) {
  const params = { limit };
  if (!isGlobalFinanceViewerUser(user) && user?.group && !META_GROUPS.includes(user.group)) {
    params.group = user.group;
  }
  return params;
}
