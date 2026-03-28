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
    // 🔥 Correct SMTP configuration (NO fallback mistakes)
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // 🔍 Debug (optional but useful)
    console.log("SMTP USER:", process.env.SMTP_EMAIL ? "Loaded ✅" : "Missing ❌");
    console.log("SMTP PASS:", process.env.SMTP_PASSWORD ? "Loaded ✅" : "Missing ❌");

    const mailOptions = {
      from: `"PG Finder Admin" <${process.env.SMTP_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent:", info.response);
    logger.info(`✅ Email sent: ${info.messageId}`);

    return true; // success
  } catch (error) {
    console.error("❌ EMAIL ERROR:", error); // FULL error print
    logger.error(`❌ Send Email error: ${error.message}`);

    return false; // fail
  }
};

module.exports = sendEmail;