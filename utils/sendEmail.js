const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
    try {
        const recipient = options.to || options.email;

        if (!recipient) {
            throw new Error('No recipients defined - options.to or options.email is required');
        }

        // Check environment variables
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error('Email credentials not configured');
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: `"NexTrade Support" <${process.env.EMAIL_USER}>`,
            to: recipient,
            subject: options.subject,
            html: options.message,
        };

        const result = await transporter.sendMail(mailOptions);

        return result;
    } catch (error) {
        console.error('Email sending failed:', error.message);
        throw error;
    }
};

module.exports = sendEmail;
