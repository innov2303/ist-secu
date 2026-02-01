// Email service using Resend integration
import { Resend } from 'resend';

let connectionSettings: any;

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

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

interface InvoiceEmailData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
  subtotalCents: number;
  taxRate: number;
  taxCents: number;
  totalCents: number;
  dueDate?: Date | null;
  notes?: string | null;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function generateInvoiceEmailHTML(data: InvoiceEmailData): string {
  const itemsRows = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatPrice(item.unitPriceCents)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatPrice(item.totalCents)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${data.invoiceNumber} - Infra Shield Tools</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Infra Shield Tools</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Solutions de securite informatique</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Facture ${data.invoiceNumber}</h2>
    
    <p style="margin: 0 0 20px 0;">Bonjour ${data.customerName},</p>
    
    <p style="margin: 0 0 20px 0;">Veuillez trouver ci-dessous le detail de votre facture pour vos services Infra Shield Tools.</p>
    
    <div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Description</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Qte</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Prix unit.</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>
    
    <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #6b7280;">Sous-total HT:</span>
        <span style="font-weight: 500;">${formatPrice(data.subtotalCents)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #6b7280;">TVA (${data.taxRate}%):</span>
        <span style="font-weight: 500;">${formatPrice(data.taxCents)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid #e5e7eb; margin-top: 12px;">
        <span style="font-weight: 700; font-size: 18px; color: #1f2937;">Total:</span>
        <span style="font-weight: 700; font-size: 18px; color: #3b82f6;">${formatPrice(data.totalCents)}</span>
      </div>
    </div>
    
    ${data.dueDate ? `
    <div style="margin-top: 20px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>Date d'echeance:</strong> ${new Date(data.dueDate).toLocaleDateString('fr-FR')}
      </p>
    </div>
    ` : ''}
    
    ${data.notes ? `
    <div style="margin-top: 20px; padding: 12px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0; color: #4b5563; font-size: 14px;">
        <strong>Notes:</strong> ${data.notes}
      </p>
    </div>
    ` : ''}
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Merci pour votre confiance.
      </p>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">
        Infra Shield Tools - ist-security.fr
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const result = await client.emails.send({
      from: fromEmail || 'Infra Shield Tools <noreply@ist-security.fr>',
      to: data.customerEmail,
      subject: `Facture ${data.invoiceNumber} - Infra Shield Tools`,
      html: generateInvoiceEmailHTML(data),
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('Invoice email sent successfully:', result.data?.id);
    return { success: true };
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface SubscriptionInvoiceData {
  customerEmail: string;
  customerName: string;
  productName: string;
  amountCents: number;
  periodStart: Date;
  periodEnd: Date;
  stripeInvoiceId?: string;
}

export async function sendSubscriptionInvoiceEmail(data: SubscriptionInvoiceData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const periodStartStr = data.periodStart.toLocaleDateString('fr-FR');
    const periodEndStr = data.periodEnd.toLocaleDateString('fr-FR');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de paiement - Infra Shield Tools</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Infra Shield Tools</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Solutions de securite informatique</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: #dcfce7; border-radius: 50%; padding: 16px; margin-bottom: 12px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 style="color: #16a34a; margin: 0; font-size: 20px;">Paiement confirme</h2>
    </div>
    
    <p style="margin: 0 0 20px 0;">Bonjour ${data.customerName},</p>
    
    <p style="margin: 0 0 20px 0;">Nous confirmons le renouvellement de votre abonnement Infra Shield Tools.</p>
    
    <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
      <div style="margin-bottom: 12px;">
        <span style="color: #6b7280; font-size: 14px;">Produit:</span>
        <p style="margin: 4px 0 0 0; font-weight: 600;">${data.productName}</p>
      </div>
      <div style="margin-bottom: 12px;">
        <span style="color: #6b7280; font-size: 14px;">Periode:</span>
        <p style="margin: 4px 0 0 0; font-weight: 500;">${periodStartStr} - ${periodEndStr}</p>
      </div>
      <div style="padding-top: 12px; border-top: 1px solid #e5e7eb;">
        <span style="color: #6b7280; font-size: 14px;">Montant:</span>
        <p style="margin: 4px 0 0 0; font-weight: 700; font-size: 20px; color: #3b82f6;">${formatPrice(data.amountCents)}</p>
      </div>
    </div>
    
    <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
      Votre acces aux outils de securite reste actif. Vous pouvez telecharger vos scripts depuis votre espace client.
    </p>
    
    <div style="background: #e0f2fe; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #0284c7;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #0369a1;">Documentation</p>
      <p style="margin: 0 0 12px 0; color: #0c4a6e; font-size: 14px;">
        Consultez notre documentation pour apprendre a utiliser vos toolkits de securite.
      </p>
      <a href="https://ist-security.fr/documentation" style="display: inline-block; background: #0284c7; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 500; font-size: 14px;">Voir la documentation</a>
    </div>
    
    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">Suivi du Parc</p>
      <p style="margin: 0 0 12px 0; color: #14532d; font-size: 14px;">
        Importez vos rapports d'audit JSON pour centraliser le suivi de securite de vos machines. 
        Visualisez l'evolution des scores, gerez les corrections et organisez votre parc informatique.
      </p>
      <a href="https://ist-security.fr/documentation#suivi-parc" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 500; font-size: 14px;">Comment importer un rapport</a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Merci pour votre confiance.
      </p>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">
        Infra Shield Tools - ist-security.fr
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await client.emails.send({
      from: fromEmail || 'Infra Shield Tools <noreply@ist-security.fr>',
      to: data.customerEmail,
      subject: `Confirmation de paiement - ${data.productName} - Infra Shield Tools`,
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('Subscription invoice email sent successfully:', result.data?.id);
    return { success: true };
  } catch (error) {
    console.error('Error sending subscription invoice email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface PasswordResetEmailData {
  email: string;
  firstName: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reinitialisation de mot de passe - Infra Shield Tools</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #4b5563 0%, #374151 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Infra Shield Tools</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Solutions de securite informatique</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Reinitialisation de votre mot de passe</h2>
    
    <p style="margin: 0 0 20px 0;">Bonjour ${data.firstName},</p>
    
    <p style="margin: 0 0 20px 0;">Vous avez demande la reinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe :</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.resetUrl}" style="display: inline-block; background: #4b5563; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reinitialiser mon mot de passe</a>
    </div>
    
    <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">Ce lien est valable pendant 1 heure. Si vous n'avez pas demande cette reinitialisation, vous pouvez ignorer cet email.</p>
    
    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 12px; word-break: break-all;">${data.resetUrl}</p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        Infra Shield Tools - ist-security.fr
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await client.emails.send({
      from: fromEmail || 'Infra Shield Tools <noreply@ist-security.fr>',
      to: data.email,
      subject: 'Reinitialisation de votre mot de passe - Infra Shield Tools',
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('Password reset email sent successfully:', result.data?.id);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface EmailVerificationData {
  email: string;
  firstName: string;
  verificationUrl: string;
}

export async function sendEmailVerificationEmail(data: EmailVerificationData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification de votre email - Infra Shield Tools</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #374151 0%, #1f2937 100%); padding: 30px; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; text-align: center; font-size: 24px;">Infra Shield Tools</h1>
      <p style="color: #9ca3af; margin: 10px 0 0 0; text-align: center; font-size: 14px;">Securisez votre infrastructure</p>
    </div>
    
    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Verification de votre adresse email</h2>
      
      <p style="margin: 0 0 20px 0;">Bonjour ${data.firstName},</p>
      
      <p style="margin: 0 0 20px 0;">Merci de vous etre inscrit sur Infra Shield Tools. Pour activer votre compte et acceder a nos services, veuillez verifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.verificationUrl}" style="display: inline-block; background: #4b5563; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">Verifier mon email</a>
      </div>
      
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">Ce lien est valable pendant 24 heures. Si vous n'avez pas cree de compte sur notre plateforme, vous pouvez ignorer cet email.</p>
      
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
      <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 12px; word-break: break-all;">${data.verificationUrl}</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">
          Infra Shield Tools - ist-security.fr
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const result = await client.emails.send({
      from: fromEmail || 'Infra Shield Tools <noreply@ist-security.fr>',
      to: data.email,
      subject: 'Verifiez votre adresse email - Infra Shield Tools',
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('Email verification email sent successfully:', result.data?.id);
    return { success: true };
  } catch (error) {
    console.error('Error sending email verification email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface EmailChangeConfirmationData {
  email: string;
  firstName: string;
  newEmail: string;
  confirmationUrl: string;
}

export async function sendEmailChangeConfirmationEmail(data: EmailChangeConfirmationData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Changement d'adresse email - Infra Shield Tools</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #374151 0%, #1f2937 100%); padding: 30px; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; text-align: center; font-size: 24px;">Infra Shield Tools</h1>
      <p style="color: #9ca3af; margin: 10px 0 0 0; text-align: center; font-size: 14px;">Securisez votre infrastructure</p>
    </div>
    
    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Changement d'adresse email</h2>
      
      <p style="margin: 0 0 20px 0;">Bonjour ${data.firstName},</p>
      
      <p style="margin: 0 0 20px 0;">Vous avez demande a modifier l'adresse email associee a votre compte Infra Shield Tools.</p>
      
      <p style="margin: 0 0 20px 0;">Pour continuer et renseigner votre nouvelle adresse email, veuillez cliquer sur le bouton ci-dessous :</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.confirmationUrl}" style="display: inline-block; background: #4b5563; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">Modifier mon email</a>
      </div>
      
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">Ce lien est valable pendant 1 heure. Si vous n'avez pas demande ce changement, vous pouvez ignorer cet email.</p>
      
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
      <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 12px; word-break: break-all;">${data.confirmationUrl}</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">
          Infra Shield Tools - ist-security.fr
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const result = await client.emails.send({
      from: fromEmail || 'Infra Shield Tools <noreply@ist-security.fr>',
      to: data.email,
      subject: 'Modifier votre adresse email - Infra Shield Tools',
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('Email change confirmation sent successfully:', result.data?.id);
    return { success: true };
  } catch (error) {
    console.error('Error sending email change confirmation:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
