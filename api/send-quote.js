import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      name, 
      email, 
      phone, 
      building_size, 
      roof_type, 
      cladding, 
      estimated_quote, 
      pdfBase64 
    } = req.body;

    // Validate required fields
    if (!name || !email || !pdfBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert base64 PDF to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Send email with Resend
    const response = await resend.emails.send({
      from: 'noreply@gardenstudio.co.uk', // Change to your domain or Resend default
      to: 'tappakah1@gmail.com',
      replyTo: email,
      subject: `New Garden Studio Order Request — ${name}`,
      html: `
        <h2>New Garden Studio Quote Request</h2>
        <p><strong>Customer Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || '-'}</p>
        <p><strong>Building Size:</strong> ${building_size}</p>
        <p><strong>Roof Type:</strong> ${roof_type}</p>
        <p><strong>Cladding:</strong> ${cladding}</p>
        <p><strong>Estimated Quote:</strong> ${estimated_quote}</p>
        <hr/>
        <p>Production pack PDF attached below.</p>
      `,
      attachments: [
        {
          filename: 'garden-studio-quote.pdf',
          content: pdfBuffer,
        },
      ],
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      emailId: response.data?.id 
    });

  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
}
