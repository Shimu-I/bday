// netlify/functions/send-email.js
// Real email sending via Resend API (free tier: 3000 emails/month)
// Deploy to Netlify, set RESEND_API_KEY environment variable, done.

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers so the browser can call this from any origin
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { recipients, birthdayName, senderName, experienceURL, subject } = body;

  // Validate
  if (!recipients || !recipients.length || !birthdayName || !experienceURL) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'Missing required fields: recipients, birthdayName, experienceURL' })
    };
  }

  // Get API key from environment
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'RESEND_API_KEY not configured. See deployment guide.' })
    };
  }

  const FROM_EMAIL = process.env.FROM_EMAIL || 'Luminary <birthday@yourdomain.com>';

  // Send one email per recipient
  const results = [];
  for (const email of recipients) {
    try {
      const emailSubject = subject || `A birthday experience is waiting for you, ${birthdayName} 🎂`;
      const htmlBody = buildEmailHTML(birthdayName, senderName, experienceURL);
      const textBody = buildEmailText(birthdayName, senderName, experienceURL);

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject: emailSubject,
          html: htmlBody,
          text: textBody
        })
      });

      const result = await response.json();
      if (response.ok) {
        results.push({ email, status: 'sent', id: result.id });
      } else {
        results.push({ email, status: 'failed', error: result.message || 'Unknown error' });
      }
    } catch (err) {
      results.push({ email, status: 'failed', error: err.message });
    }
  }

  const allSent = results.every(r => r.status === 'sent');
  const anySent = results.some(r => r.status === 'sent');

  return {
    statusCode: allSent ? 200 : anySent ? 207 : 500,
    headers,
    body: JSON.stringify({
      success: anySent,
      results,
      message: allSent
        ? `Email sent to ${results.length} recipient${results.length > 1 ? 's' : ''}`
        : `Sent: ${results.filter(r => r.status === 'sent').length}/${results.length}`
    })
  };
};

// ── Beautiful HTML email template ──
function buildEmailHTML(name, sender, url) {
  const senderLine = sender ? `<p style="color:#8a8a8a;font-size:14px;margin:0 0 24px">From ${sender}, with love</p>` : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#04040a;font-family:'Georgia',serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">

    <!-- Header -->
    <div style="text-align:center;padding:40px 0 32px;border-bottom:1px solid #1a1a2a">
      <p style="color:#c8a45a;font-size:11px;letter-spacing:4px;text-transform:uppercase;margin:0 0 16px">✦ &nbsp; L U M I N A R Y &nbsp; ✦</p>
      <h1 style="color:#ede8df;font-weight:300;font-size:clamp(28px,6vw,42px);line-height:1.1;margin:0;letter-spacing:-0.5px">
        Happy Birthday,<br/><em style="color:#c8a45a">${escapeHtml(name)}</em>
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:36px 0;border-bottom:1px solid #1a1a2a">
      ${senderLine}
      <p style="color:#ede8df;font-size:17px;line-height:1.8;margin:0 0 20px;font-weight:300">
        Someone who cares about you has created something special — an interactive birthday experience, crafted just for you.
      </p>
      <p style="color:#9a9a9a;font-size:15px;line-height:1.7;margin:0 0 32px;font-style:italic">
        Light virtual candles with your bare hand. Discover a personal letter, a voice message, and photos you'll love.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0">
        <a href="${url}" style="display:inline-block;background:linear-gradient(120deg,#c8a45a,#e4c988);color:#04040a;text-decoration:none;padding:16px 40px;border-radius:50px;font-family:sans-serif;font-size:16px;font-weight:600;letter-spacing:1px">
          ✦ &nbsp; Open Your Birthday Experience
        </a>
      </div>

      <p style="color:#5a5a6a;font-size:13px;text-align:center;margin:16px 0 0;font-family:sans-serif">
        Best experienced on a laptop or desktop with camera access enabled.
      </p>
    </div>

    <!-- Link fallback -->
    <div style="padding:24px 0">
      <p style="color:#5a5a6a;font-size:12px;font-family:sans-serif;margin:0 0 8px">Or copy this link into your browser:</p>
      <p style="color:#c8a45a;font-size:12px;font-family:monospace;word-break:break-all;margin:0;background:#0c0c14;padding:10px 14px;border-radius:6px;border:1px solid #1a1a2a">${url}</p>
    </div>

    <!-- Footer -->
    <div style="padding-top:24px;border-top:1px solid #1a1a2a;text-align:center">
      <p style="color:#3a3a4a;font-size:11px;font-family:sans-serif;margin:0;letter-spacing:1px">LUMINARY · BIRTHDAY EXPERIENCE PLATFORM</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Plain text fallback ──
function buildEmailText(name, sender, url) {
  const senderLine = sender ? `From ${sender}, with love.\n\n` : '';
  return `Happy Birthday, ${name}!\n\n${senderLine}Someone who cares about you has created an interactive birthday experience — just for you.\n\nOpen your party here:\n${url}\n\n(Best on a laptop or desktop with camera access enabled.)\n\n— Luminary`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
