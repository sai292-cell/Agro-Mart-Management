/**
 * SMS Gateway Service
 * Handles SMS OTP delivery to mobile numbers using Fast2SMS, Twilio, or Mock console delivery.
 */
import { env } from '../config/env.js';

/**
 * Normalizes phone number to standard 10-digit Indian mobile number
 * or E.164 format for international SMS
 * @param {string} phone
 * @returns {{ national: string, e164: string }}
 */
export function normalizePhoneNumber(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return { national: digits, e164: `+91${digits}` };
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return { national: digits.slice(2), e164: `+${digits}` };
  }
  return { national: digits, e164: digits.startsWith('+') ? digits : `+${digits}` };
}

/**
 * Sends OTP SMS via configured SMS gateway (Fast2SMS, Twilio, or Mock)
 * @param {string} phone - Target phone number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{ success: boolean, provider: string, message: string }>}
 */
export async function sendOtpSms(phone, otp) {
  const { national, e164 } = normalizePhoneNumber(phone);
  const messageText = `Your Shivshree Agro Mart login verification OTP is ${otp}. Valid for 5 minutes. Do not share this code.`;

  // Determine active provider based on configuration & available credentials
  let provider = env.SMS_PROVIDER || 'mock';
  if (provider === 'mock' && env.FAST2SMS_API_KEY) {
    provider = 'fast2sms';
  } else if (provider === 'mock' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    provider = 'twilio';
  }

  // 1. Fast2SMS Provider (Popular in India for Quick SMS / OTP routes)
  if (provider === 'fast2sms') {
    if (!env.FAST2SMS_API_KEY) {
      console.warn('⚠️ [SMS] Fast2SMS API key missing, falling back to mock provider');
    } else {
      try {
        console.log(`📱 [SMS - Fast2SMS] Dispatching OTP to +91${national}...`);
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': env.FAST2SMS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: national,
          }),
        });

        const data = await response.json();
        if (data.return === true || response.ok) {
          console.log(`✅ [SMS - Fast2SMS] OTP sent successfully to +91${national}`);
          return { success: true, provider: 'fast2sms', message: 'OTP sent via Fast2SMS' };
        } else {
          console.error(`❌ [SMS - Fast2SMS Error]:`, data);
        }
      } catch (err) {
        console.error(`❌ [SMS - Fast2SMS Exception]:`, err.message);
      }
    }
  }

  // 2. Twilio Provider (Standard international carrier delivery)
  if (provider === 'twilio') {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE } = env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_PHONE) {
      console.warn('⚠️ [SMS] Incomplete Twilio credentials, falling back to mock provider');
    } else {
      try {
        console.log(`📱 [SMS - Twilio] Dispatching OTP to ${e164}...`);
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

        const params = new URLSearchParams({
          To: e164,
          From: TWILIO_FROM_PHONE,
          Body: messageText,
        });

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const data = await response.json();
        if (response.ok && data.sid) {
          console.log(`✅ [SMS - Twilio] OTP sent successfully to ${e164} [SID: ${data.sid}]`);
          return { success: true, provider: 'twilio', message: 'OTP sent via Twilio' };
        } else {
          console.error(`❌ [SMS - Twilio Error]:`, data);
        }
      } catch (err) {
        console.error(`❌ [SMS - Twilio Exception]:`, err.message);
      }
    }
  }

  // 3. Mock Console Fallback (Default for dev environment & local testing)
  console.log(`🌾 =======================================================`);
  console.log(`📱 [SMS GATEWAY - MOCK] Live SMS to Mobile: ${e164}`);
  console.log(`🔐 OTP Verification Code: >>> ${otp} <<<`);
  console.log(`💬 Message: "${messageText}"`);
  console.log(`ℹ️ To receive real SMS on your mobile phone, configure FAST2SMS_API_KEY or Twilio credentials in server/.env`);
  console.log(`🌾 =======================================================`);

  return {
    success: true,
    provider: 'mock',
    message: `Mock OTP dispatched to console. Configure SMS_PROVIDER in server/.env for live mobile SMS.`,
  };
}
