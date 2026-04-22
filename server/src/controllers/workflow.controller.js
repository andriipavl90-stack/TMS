import User from '../models/User.js';
import Worklog from '../models/Worklog.js';

/**
 * GET /api/workflow/chart?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * Returns per-user worked hours for the given range.
 * worked_seconds = real_time + add_time (both stored on Worklog).
 * date_to is treated as EXCLUSIVE (matches the client convention where
 * single-day = From=D, To=D+1).
 *
 * The authoritative join key from worklogs → users is `user_id`
 * (worklog.user_id references User._id directly). `hubstaff_id` is
 * kept on the response for reference and for any future Hubstaff sync.
 */
export const getChartData = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({ ok: false, message: 'date_from and date_to are required' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      return res.status(400).json({ ok: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // 1. All active users
    const users = await User.find({ status: 'active' })
      .select('name email group hubstaff_id')
      .sort({ name: 1 })
      .lean();

    // 2. Fetch worklogs in range (dates are stored as Date; to is exclusive)
    const fromDate = new Date(`${date_from}T00:00:00.000Z`);
    const toDate = new Date(`${date_to}T00:00:00.000Z`);

    const worklogs = await Worklog.find({
      date: { $gte: fromDate, $lt: toDate },
    })
      .select('user_id hubstaff_id date real_time add_time')
      .lean();

    // 3. Aggregate real_time + add_time per user_id
    const byUserId = {};
    for (const w of worklogs) {
      const uid = w.user_id?.toString();
      if (!uid) continue;
      if (!byUserId[uid]) byUserId[uid] = { real: 0, add: 0 };
      byUserId[uid].real += Number(w.real_time) || 0;
      byUserId[uid].add += Number(w.add_time) || 0;
    }

    // 4. Build per-user chart data (users with no matching worklogs show 0)
    const chartData = users.map(u => {
      const rec = byUserId[u._id.toString()] || { real: 0, add: 0 };
      const totalSeconds = rec.real + rec.add;
      return {
        userId: u._id,
        name: u.name,
        email: u.email,
        hubstaff_id: u.hubstaff_id || null,
        real_time: rec.real,
        add_time: rec.add,
        total_seconds: totalSeconds,
        total_hours: +(totalSeconds / 3600).toFixed(4),
      };
    });

    res.json({ ok: true, data: { chartData, date_from, date_to } });
  } catch (err) {
    console.error('workflow getChartData error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/workflow/users
 * Returns the list of active users for the ADD TIME modal dropdown.
 */
export const getWorkflowUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'active' })
      .select('name email group hubstaff_id')
      .sort({ name: 1 })
      .lean();
    res.json({ ok: true, data: { users } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * POST /api/workflow/add-time
 * Body: { userId, date, hours, minutes, description? }
 *
 * Upserts a Worklog for (user_id, day). Accumulates add_time.
 * Date is normalized to UTC midnight — findOne uses a day-range to be
 * tolerant of the existing rows (which store dates at local-midnight in UTC).
 */
export const addTime = async (req, res) => {
  try {
    const { userId, date, hours, minutes, description = '' } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, message: 'userId is required' });
    }
    if (!date) {
      return res.status(400).json({ ok: false, message: 'date is required' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const h = Number(hours) || 0;
    const m = Number(minutes) || 0;

    if (h < 0) return res.status(400).json({ ok: false, message: 'hours must be non-negative' });
    if (m < 0) return res.status(400).json({ ok: false, message: 'minutes must be non-negative' });
    if (m > 59) return res.status(400).json({ ok: false, message: 'minutes must be between 0 and 59' });
    if (h === 0 && m === 0) {
      return res.status(400).json({ ok: false, message: 'Time must be greater than 0' });
    }

    const addSeconds = h * 3600 + m * 60;

    const user = await User.findById(userId).select('name hubstaff_id').lean();
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    // Day range (UTC) — tolerant match for existing rows with any time-of-day component
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    let worklog = await Worklog.findOne({
      user_id: userId,
      date: { $gte: dayStart, $lt: dayEnd },
    });

    if (worklog) {
      worklog.add_time = (worklog.add_time || 0) + addSeconds;
      worklog.total_time = (worklog.real_time || 0) + worklog.add_time;
      if (description) worklog.note = description;
    } else {
      worklog = new Worklog({
        user_id: userId,
        hubstaff_id: user.hubstaff_id || null,
        date: dayStart,
        real_time: 0,
        add_time: addSeconds,
        total_time: addSeconds,
        note: description,
        source: 'manual',
        status: 'approved',
      });
    }
    await worklog.save();

    res.json({
      ok: true,
      data: worklog,
      message: `Added ${h}h ${m}m for ${user.name} on ${date}`,
    });
  } catch (err) {
    console.error('workflow addTime error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};
