import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    SHEET_ID: process.env.SHEET_ID ? 'Present' : 'Missing',
    EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Present' : 'Missing',
    KEY: process.env.GOOGLE_PRIVATE_KEY ? 'Present' : 'Missing'
  });
}
