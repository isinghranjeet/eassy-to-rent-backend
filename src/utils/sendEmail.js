// const nodemailer = require('nodemailer');
// const logger = require('./logger');

// const sendEmail = async (options) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       service: 'gmail', // Standard configuration for Google
//       auth: {
//         user: process.env.SMTP_EMAIL || process.env.ADMIN_EMAIL,
//         pass: process.env.SMTP_PASSWORD || process.env.ADMIN_PASSWORD
//       }
//     });

//     const mailOptions = {
//       from: `"PG Finder Admin" <${process.env.SMTP_EMAIL || process.env.ADMIN_EMAIL}>`,
//       to: options.email,
//       subject: options.subject,
//       html: options.html,
//       text: options.text,
//     };

//     const info = await transporter.sendMail(mailOptions);
//     logger.info(`✅ Email sent: ${info.messageId}`);
//     return true;
//   } catch (error) {
//     logger.error(`❌ Send Email error: ${error.message}`);
//     return false;
//   }
// };
// console.log('🔥🔥🔥 SEND EMAIL UTILITY IS BEING LOADED! 🔥🔥🔥');

// module.exports = sendEmail;













const nodemailer = require('nodemailer');
const logger = require('./logger');

const sendEmail = async (options) => {
  try {
    console.log("EMAIL:", process.env.SMTP_EMAIL);
    console.log("PASS:", process.env.SMTP_PASSWORD ? "Loaded ✅" : "Missing ❌");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,              // 🔥 CHANGE
      secure: false,          // 🔥 CHANGE
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // 🔥 VERIFY CONNECTION (IMPORTANT)
    await transporter.verify();
    console.log("✅ SMTP Connected");

    const mailOptions = {
      from: `"PG Finder Admin" <${process.env.SMTP_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent:", info.messageId);
    logger.info(`✅ Email sent: ${info.messageId}`);

    return true;

  } catch (error) {
    console.error("❌ FULL EMAIL ERROR:", error); // 🔥 full error print
    logger.error(`❌ Send Email error: ${error.message}`);
    return false;
  }
};

module.exports = sendEmail;