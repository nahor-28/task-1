import { BrevoClient } from '@getbrevo/brevo';

const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

export async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.FRONTEND_ORIGIN}/verify?token=${token}`;

  await brevo.transactionalEmails.sendTransacEmail({
    subject: 'Verify your email',
    htmlContent: `<p>Click the link below to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    sender: { name: process.env.BREVO_SENDER_NAME, email: process.env.BREVO_SENDER_EMAIL },
    to: [{ email }],
  });
}
