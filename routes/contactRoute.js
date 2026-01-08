const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');

router.post('/', async (req, res) => {


  try {
    const { name, email, subject, message, userId, userEmail } = req.body;

    // Validate required fields
    if (!name || !subject || !message) {

      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const senderEmail = userEmail || email;


    if (!senderEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Email to Business (Support Team)
    const businessEmailHTML = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">New Support Request</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">NexTrade Customer Support</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <!-- User Info Card -->
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #4f46e5;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">👤 Customer Information</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <strong style="color: #4b5563; display: block; font-size: 12px;">Name</strong>
            <span style="color: #1f2937; font-weight: 500;">${name}</span>
          </div>
          <div>
            <strong style="color: #4b5563; display: block; font-size: 12px;">Email</strong>
            <span style="color: #1f2937; font-weight: 500;">${senderEmail}</span>
          </div>
          <div>
            <strong style="color: #4b5563; display: block; font-size: 12px;">User ID</strong>
            <span style="color: #1f2937; font-weight: 500;">${userId || 'Not provided'}</span>
          </div>
          <div>
            <strong style="color: #4b5563; display: block; font-size: 12px;">Time</strong>
            <span style="color: #1f2937; font-weight: 500;">${new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      <!-- Subject -->
      <div style="margin-bottom: 20px;">
        <strong style="color: #4b5563; display: block; font-size: 12px; margin-bottom: 5px;">Subject</strong>
        <h2 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${subject}</h2>
      </div>

      <!-- Message -->
      <div>
        <strong style="color: #4b5563; display: block; font-size: 12px; margin-bottom: 10px;">Message</strong>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; line-height: 1.6; color: #374151;">
          ${message.replace(/\n/g, '<br>')}
        </div>
      </div>

      <!-- Priority Badge -->
      <div style="text-align: center; margin-top: 25px;">
        <span style="background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">
          Respond within 24 hours
        </span>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <div style="color: #4f46e5; font-size: 18px; font-weight: bold; margin-bottom: 8px;">NexTrade</div>
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        This support request was submitted through the NexTrade contact form.<br>
        Please respond directly to the customer's email address.
      </p>
    </div>
  </div>
</div>
    `;

    // Confirmation Email to User
    const userConfirmationHTML = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Message Received!</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">We've got your message and we're on it!</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <!-- Thank You Message -->
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="font-size: 48px; margin-bottom: 10px;">🙏</div>
        <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 20px;">Thank You, ${name}!</h2>
        <p style="color: #6b7280; margin: 0; line-height: 1.5;">
          We've successfully received your support request and our team is already looking into it.
        </p>
      </div>

      <!-- Request Summary -->
      <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #bae6fd;">
        <h3 style="margin: 0 0 15px 0; color: #0369a1; font-size: 16px;">Your Request Summary</h3>
        <div style="display: grid; gap: 10px;">
          <div>
            <strong style="color: #0c4a6e; display: block; font-size: 12px;">Subject</strong>
            <span style="color: #1e40af; font-weight: 500;">${subject}</span>
          </div>
          <div>
            <strong style="color: #0c4a6e; display: block; font-size: 12px;">Submitted</strong>
            <span style="color: #1e40af; font-weight: 500;">${new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      <!-- Next Steps -->
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">📅 What Happens Next?</h3>
        <div style="display: grid; gap: 12px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="background: #4f46e5; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">1</div>
            <div>
              <strong style="color: #1f2937; font-size: 14px;">Initial Review</strong>
              <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 13px; line-height: 1.4;">
                Our support team will review your request within the next few hours.
              </p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="background: #4f46e5; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">2</div>
            <div>
              <strong style="color: #1f2937; font-size: 14px;">Personalized Response</strong>
              <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 13px; line-height: 1.4;">
                You'll receive a detailed response from our expert team within 24 hours.
              </p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="background: #4f46e5; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">3</div>
            <div>
              <strong style="color: #1f2937; font-size: 14px;">Issue Resolution</strong>
              <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 13px; line-height: 1.4;">
                We'll work with you until your issue is completely resolved.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Support Info -->
      <div style="text-align: center; background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 500;">
          <strong>Need urgent help?</strong> Contact us via WhatsApp for instant support.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <div style="color: #10b981; font-size: 18px; font-weight: bold; margin-bottom: 8px;">NexTrade Support</div>
      <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.4;">
        This is an automated confirmation. Please do not reply to this email.<br>
        Our support team will contact you directly at <strong>${senderEmail}</strong>.
      </p>
    </div>
  </div>
</div>
    `;



    // Send to business
    await sendEmail({
      to: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER,
      subject: `Support Request: ${subject}`,
      message: businessEmailHTML
    });


    // Send confirmation to user

    await sendEmail({
      to: senderEmail,
      subject: "We've Received Your Message - NexTrade Support",
      message: userConfirmationHTML
    });


    res.status(200).json({
      success: true,
      message: 'Message sent successfully!'
    });

  } catch (error) {
    console.error('Contact form ERROR:', error);
    console.error('Error details:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
});

module.exports = router;
