const nodemailer = require('nodemailer');

let transporter = null;

try {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('✅ Email transporter configured');
  } else {
    console.log('⚠ Email SMTP credentials not configured - emails will not be sent');
  }
} catch (error) {
  console.error('❌ Email transporter initialization error:', error);
}

class EmailService {
  static async sendBookingConfirmation(booking, facility, pitch, user) {
    if (!transporter) {
      console.log('⚠ Email skipped: SMTP not configured');
      return;
    }

    try {
      const mailOptions = {
        from: `"eHalısaha" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Rezervasyon Oluşturuldu - Ödeme Bekleniyor',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
              .bank-info { background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
              .detail-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .detail-label { font-weight: bold; color: #6b7280; }
              .detail-value { color: #111827; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              .amount { font-size: 24px; color: #10b981; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚽ Rezervasyonunuz Oluşturuldu</h1>
              </div>
              <div class="content">
                <p>Merhaba <strong>${user.full_name}</strong>,</p>
                <p>Rezervasyonunuz başarıyla oluşturuldu. Aşağıdaki bilgileri kontrol ediniz:</p>
                
                <div class="detail-row">
                  <span class="detail-label">Tesis:</span>
                  <span class="detail-value">${facility.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Saha:</span>
                  <span class="detail-value">${pitch.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Tarih & Saat:</span>
                  <span class="detail-value">${new Date(booking.start_time).toLocaleString('tr-TR')}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Toplam Ücret:</span>
                  <span class="detail-value">${booking.total_price} ₺</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Ödenecek Kapora:</span>
                  <span class="amount">${booking.deposit_amount} ₺</span>
                </div>

                ${booking.payment_method === 'bank_transfer' && facility.iban ? `
                  <div class="bank-info">
                    <h3 style="margin-top: 0;">💳 Havale/EFT Bilgileri</h3>
                    ${facility.account_holder_name ? `<p><strong>Alıcı:</strong> ${facility.account_holder_name}</p>` : ''}
                    <p><strong>IBAN:</strong> <code style="background: white; padding: 5px; border-radius: 4px;">${facility.iban}</code></p>
                    <p style="margin-bottom: 0; font-size: 14px; color: #92400e;">
                      ⚠ Lütfen kapora tutarını yukarıdaki IBAN'a gönderdikten sonra, tesis sahibi ödemenizi onaylayacaktır.
                    </p>
                  </div>
                ` : ''}

                <p style="margin-top: 20px;">
                  <strong>Önemli Not:</strong> Kalan ${(booking.total_price - booking.deposit_amount).toFixed(2)} ₺ sahada ödenecektir.
                </p>

                <p>Rezervasyonlarınızı <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-bookings">buradan</a> görüntüleyebilirsiniz.</p>
              </div>
              <div class="footer">
                <p>Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.</p>
                <p>&copy; 2026 eHalısaha. Tüm hakları saklıdır.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log('✅ Rezervasyon maili gönderildi:', user.email);
    } catch (error) {
      console.error('❌ Mail gönderme hatası:', error);
    }
  }

  static async sendBookingApproved(booking, facility, pitch, user) {
    if (!transporter) {
      console.log('⚠ Email skipped: SMTP not configured');
      return;
    }

    try {
      const mailOptions = {
        from: `"eHalısaha" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: '✅ Rezervasyonunuz Onaylandı!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
              .success-box { background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
              .detail-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .detail-label { font-weight: bold; color: #6b7280; }
              .detail-value { color: #111827; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Rezervasyonunuz Onaylandı!</h1>
              </div>
              <div class="content">
                <p>Merhaba <strong>${user.full_name}</strong>,</p>
                
                <div class="success-box">
                  <p style="margin: 0; font-size: 16px;">
                    🎉 Harika haber! Ödemeniz tesis sahibi tarafından onaylandı. Rezervasyonunuz artık <strong>aktif</strong>!
                  </p>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Tesis:</span>
                  <span class="detail-value">${facility.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Saha:</span>
                  <span class="detail-value">${pitch.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Tarih & Saat:</span>
                  <span class="detail-value">${new Date(booking.start_time).toLocaleString('tr-TR')}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Adres:</span>
                  <span class="detail-value">${facility.address}</span>
                </div>

                <p style="margin-top: 20px;">
                  <strong>Sahada Ödenecek Tutar:</strong> ${(booking.total_price - booking.deposit_amount).toFixed(2)} ₺
                </p>

                <p>Rezervasyonunuzu <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-bookings">buradan</a> görüntüleyebilirsiniz.</p>

                <p>İyi oyunlar! ⚽</p>
              </div>
              <div class="footer">
                <p>Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.</p>
                <p>&copy; 2026 eHalısaha. Tüm hakları saklıdır.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log('✅ Onay maili gönderildi:', user.email);
    } catch (error) {
      console.error('❌ Mail gönderme hatası:', error);
    }
  }
}

module.exports = EmailService;
