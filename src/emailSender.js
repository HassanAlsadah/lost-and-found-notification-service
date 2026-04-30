// ============================================
// Factor 4: Backing Services
// Email provider is an attached resource
// Connected via SMTP env vars
// Swap Gmail for SendGrid → change SMTP vars only
// ============================================

const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

const sendEmail = async (to, subject, htmlBody) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@lostandfound.com',
      to,
      subject,
      html: htmlBody
    });

    logger.info({ messageId: info.messageId, to }, 'Email sent');
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ err, to }, 'Email send failed');
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail };
