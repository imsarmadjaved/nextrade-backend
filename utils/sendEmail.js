const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
    // Email Sender (admin)
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Email details
    const mailOptions = {
        from: `"NexTrade Support" <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    // Send mail
    await transporter.sendMail(mailOptions);
    console.log("Email sent to:", options.email);
};

module.exports = sendEmail;
