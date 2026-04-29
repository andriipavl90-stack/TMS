import User from '../models/User.js';
import Worklog from '../models/Worklog.js';
import Daily from '../models/Daily.js';
import FinanceTransaction from '../models/FinanceTransaction.js';

/**
 * GET /api/dashboard?group=<groupName|all>
 *
 * Aggregates per-user data for the dashboard cards:
 *   - todayHours / yesterdayHours: sum of worklog.total_time (= real_time + add_time),
 *     bucketed by UTC day (today = current UTC day, yesterday = previous UTC day).
 *   - dailyTodayState: Daily.state for today (UTC day) — null if no doc.
 *   - monthlyIncome: per-user sum of FinanceTransaction.amount where
 *     type='income', status='accepted', date within the current UTC month.
 *
 * Excludes:
 *   - Users with status !== 'active'
 *   - Group '*' (super-admin sentinel)
 *   - Users with role 'SUPER_ADMIN' — never appears in cards or in the
 *     returned `groups` list.
 */
export const getDashboard = async (req, res) => {
  try {
    const { group } = req.query;

    // ── UTC day & month boundaries ────────────────────────────────────────
    const now = new Date();
    const todayStart = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ));
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const yesterdayEnd = todayStart;
    const monthStart = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), 1
    ));
    const monthEnd = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth() + 1, 1
    ));

    // ── 1. Active users (group filter applied here when present) ─────────
    const userQuery = {
      status: 'active',
      group: { $ne: '*' },
      role: { $ne: 'SUPER_ADMIN' },
    };
    if (group && group !== 'all') {
      userQuery.group = group;
    }
    const users = await User.find(userQuery)
      .select('name email group role degree hubstaff_id')
      .sort({ name: 1 })
      .lean();

    const userIds = users.map(u => u._id);

    // ── 2. Worklogs (today + yesterday) ──────────────────────────────────
    const worklogs = await Worklog.find({
      user_id: { $in: userIds },
      date: { $gte: yesterdayStart, $lt: todayEnd },
    })
      .select('user_id date real_time add_time total_time')
      .lean();

    // Aggregate seconds per user per bucket
    const hoursByUser = {};
    for (const w of worklogs) {
      const uid = w.user_id?.toString();
      if (!uid) continue;
      if (!hoursByUser[uid]) hoursByUser[uid] = { today: 0, yesterday: 0 };
      const d = new Date(w.date);
      const total = (Number(w.real_time) || 0) + (Number(w.add_time) || 0);
      if (d >= todayStart && d < todayEnd) {
        hoursByUser[uid].today += total;
      } else if (d >= yesterdayStart && d < yesterdayEnd) {
        hoursByUser[uid].yesterday += total;
      }
    }

    // ── 3. Today's Daily reports per user ────────────────────────────────
    const dailies = await Daily.find({
      userId: { $in: userIds },
      date: { $gte: todayStart, $lt: todayEnd },
    })
      .select('userId state date')
      .lean();

    // If multiple dailies exist for the same user/day, keep the latest by date
    const dailyByUser = {};
    for (const d of dailies) {
      const uid = d.userId?.toString();
      if (!uid) continue;
      const existing = dailyByUser[uid];
      if (!existing || new Date(d.date) > new Date(existing.date)) {
        dailyByUser[uid] = d;
      }
    }

    // ── 4. Monthly income per user (current UTC month) ──────────────────
    const incomeAgg = await FinanceTransaction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          type: 'income',
          status: 'accepted',
          date: { $gte: monthStart, $lt: monthEnd },
        },
      },
      { $group: { _id: '$userId', total: { $sum: '$amount' } } },
    ]);
    const incomeByUser = {};
    for (const row of incomeAgg) {
      incomeByUser[row._id.toString()] = row.total || 0;
    }

    // ── 5. Groups (always full list, regardless of the group filter) ─────
    const groupsList = await User.distinct('group', {
      status: 'active',
      group: { $ne: '*' },
      role: { $ne: 'SUPER_ADMIN' },
    });
    groupsList.sort();

    // ── 6. Build cards ───────────────────────────────────────────────────
    const cards = users.map(u => {
      const uid = u._id.toString();
      const h = hoursByUser[uid] || { today: 0, yesterday: 0 };
      const dailyDoc = dailyByUser[uid];
      return {
        userId: u._id,
        name: u.name,
        email: u.email,
        group: u.group,
        role: u.role,
        degree: u.degree,
        todaySeconds: h.today,
        yesterdaySeconds: h.yesterday,
        dailyTodayState: dailyDoc ? dailyDoc.state : null,
        monthlyIncome: incomeByUser[uid] || 0,
      };
    });

    // Sort: group ascending → admins (role ADMIN/BOSS) first → name ascending.
    // Applied here so every consumer (incl. the "All" tab) sees the same order.
    const isAdmin = (c) => c.role === 'ADMIN' || c.role === 'BOSS';
    cards.sort((a, b) => {
      const g = a.group.localeCompare(b.group, undefined, { numeric: true, sensitivity: 'base' });
      if (g !== 0) return g;
      const adminDelta = (isAdmin(b) ? 1 : 0) - (isAdmin(a) ? 1 : 0);
      if (adminDelta !== 0) return adminDelta;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    res.json({
      ok: true,
      data: {
        groups: groupsList,
        cards,
        meta: {
          todayUTC: todayStart.toISOString().slice(0, 10),
          monthUTC: monthStart.toISOString().slice(0, 7),
        },
      },
    });
  } catch (err) {
    console.error('dashboard getDashboard error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};
