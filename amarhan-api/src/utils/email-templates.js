'use strict';

/**
 * Нууц үг сэргээх имэйлийн HTML — ажилтан, харилцагч хоёулаа адил загвар
 * ашиглана, зөвхөн холбоос нь өөр (admin panel vs харилцагчийн портал).
 */
function passwordResetEmail({ resetUrl, expiresInMinutes = 60 }) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">Нууц үг сэргээх хүсэлт</h2>
      <p style="line-height: 1.6; font-size: 14px; color: #374151;">
        Таны бүртгэлд нууц үг сэргээх хүсэлт ирлээ. Доорх товчийг дарж шинэ нууц үг тохируулна уу.
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Нууц үг сэргээх
        </a>
      </p>
      <p style="line-height: 1.6; font-size: 12px; color: #6b7280;">
        Холбоос ажиллахгүй бол энэ хаягийг хөтчид шууд хуулж оруулна уу:<br />
        <span style="word-break: break-all;">${resetUrl}</span>
      </p>
      <p style="line-height: 1.6; font-size: 12px; color: #6b7280;">
        Энэ холбоос ${expiresInMinutes} минутын хугацаанд хүчинтэй. Хэрэв та энэ хүсэлтийг
        илгээгээгүй бол энэ имэйлийг үл тоомсорлож болно — таны нууц үг өөрчлөгдөөгүй хэвээр байна.
      </p>
      <p style="margin-top: 28px; font-size: 12px; color: #9ca3af;">Ивээл Карго</p>
    </div>
  `;
}

module.exports = { passwordResetEmail };
