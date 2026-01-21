import { Resend } from 'resend';

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected: ' + JSON.stringify(connectionSettings));
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function testEmail() {
  try {
    console.log('Testing Resend connection...');
    const { apiKey, fromEmail } = await getCredentials();
    console.log('Resend API Key found! From email:', fromEmail);
    
    const client = new Resend(apiKey);
    
    // Send a test email
    const result = await client.emails.send({
      from: fromEmail || 'test@ist-security.fr',
      to: 'cyrilallegretb@gmail.com',
      subject: 'Test Email - Infra Shield Tools',
      html: '<h1>Test</h1><p>Ceci est un email de test.</p>'
    });
    
    console.log('Email result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmail();
