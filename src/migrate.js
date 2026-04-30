require('dotenv').config();
const db = require('./db');
const logger = require('./logger');

const migrate = async () => {
  try {
    logger.info('Running database migration for notification-service...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        match_id INTEGER NOT NULL,
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_match ON notifications(match_id)');

    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  }
};

migrate();
