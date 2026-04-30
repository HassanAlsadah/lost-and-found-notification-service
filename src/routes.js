// ============================================
// Factor 13: API First
// POST /notify         → send notification for a match
// GET  /notify         → list all notifications
// GET  /notify/:userId → get user's notifications
// ============================================

const express = require('express');
const db = require('./db');
const { sendEmail } = require('./emailSender');
const logger = require('./logger');

const router = express.Router();

// -----------------------------------------
// POST /notify — Send notification for a match
// Teammate will trigger this via Event Bridge
// when match_found event is received
// -----------------------------------------
router.post('/', async (req, res) => {
  try {
    const { matchId } = req.body;

    if (!matchId) {
      return res.status(400).json({ error: 'matchId is required' });
    }

    // Get match details with user info
    const matchResult = await db.query(`
      SELECT m.*,
             li.title as lost_title, li.user_id as lost_user_id,
             fi.title as found_title, fi.user_id as found_user_id
      FROM matches m
      JOIN items li ON m.lost_item_id = li.id
      JOIN items fi ON m.found_item_id = fi.id
      WHERE m.id = $1
    `, [matchId]);

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Get both users' emails
    const lostUser = await db.query('SELECT email, name FROM users WHERE id = $1', [match.lost_user_id]);
    const foundUser = await db.query('SELECT email, name FROM users WHERE id = $1', [match.found_user_id]);

    const notifications = [];

    // Notify the user who lost the item
    if (lostUser.rows.length > 0) {
      const user = lostUser.rows[0];
      const emailResult = await sendEmail(
        user.email,
        'Match Found — Your Lost Item May Have Been Found!',
        `<h2>Good news, ${user.name}!</h2>
         <p>Your lost item <strong>"${match.lost_title}"</strong> may have been found.</p>
         <p>A found item <strong>"${match.found_title}"</strong> has a <strong>${match.score}%</strong> match score.</p>
         <p>Log in to your Lost & Found account to review the match and get in touch.</p>`
      );

      // Log notification to DB
      const notif = await db.query(
        `INSERT INTO notifications (user_id, match_id, channel, message, status)
         VALUES ($1, $2, 'email', $3, $4) RETURNING *`,
        [match.lost_user_id, matchId, `Match found for "${match.lost_title}"`, emailResult.success ? 'sent' : 'failed']
      );
      notifications.push(notif.rows[0]);
    }

    // Notify the user who found the item
    if (foundUser.rows.length > 0) {
      const user = foundUser.rows[0];
      const emailResult = await sendEmail(
        user.email,
        'Match Found — Someone May Be Looking For The Item You Found!',
        `<h2>Good news, ${user.name}!</h2>
         <p>The item you found <strong>"${match.found_title}"</strong> may belong to someone.</p>
         <p>A lost item <strong>"${match.lost_title}"</strong> has a <strong>${match.score}%</strong> match score.</p>
         <p>Log in to your Lost & Found account to review the match.</p>`
      );

      const notif = await db.query(
        `INSERT INTO notifications (user_id, match_id, channel, message, status)
         VALUES ($1, $2, 'email', $3, $4) RETURNING *`,
        [match.found_user_id, matchId, `Match found for "${match.found_title}"`, emailResult.success ? 'sent' : 'failed']
      );
      notifications.push(notif.rows[0]);
    }

    logger.info({ matchId, notificationsSent: notifications.length }, 'Notifications sent');

    res.status(200).json({
      message: `${notifications.length} notification(s) sent`,
      notifications
    });
  } catch (err) {
    logger.error({ err }, 'Notification failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -----------------------------------------
// GET /notify — List all notifications
// -----------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.status(200).json({ notifications: result.rows });
  } catch (err) {
    logger.error({ err }, 'List notifications failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -----------------------------------------
// GET /notify/:userId — Get user's notifications
// -----------------------------------------
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.status(200).json({ notifications: result.rows });
  } catch (err) {
    logger.error({ err }, 'Get user notifications failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
