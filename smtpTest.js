import nodemailer from "nodemailer";

async function testSMTP() {
  try {
    const transporter = nodemailer.createTransport({
      host: "mail.dev-designversestudios.com",
      port: 465,
      secure: true,
      auth: {
        user: "email@dev-designversestudios.com",
        pass: "Dev@123458R12",
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();
    console.log("SMTP is working ✅");

    const info = await transporter.sendMail({
      from: `"Dev Designverse" <email@dev-designversestudios.com>`,
      to: "production@designversestudios.com", // replace with your email
      subject: "SMTP Test Email",
      html: "<p>This is a test email from Nodemailer ✅</p>",
    });

    console.log("Test email sent:", info.messageId);
  } catch (error) {
    console.error("SMTP error:", error);
  }
}

testSMTP();
