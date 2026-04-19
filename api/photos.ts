import { v2 as cloudinary } from 'cloudinary';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const password = process.env.PASSWORD;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;

  // 1. Verify Password
  const authHeader = req.headers.authorization;
  if (!password || authHeader !== password) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!apiSecret || !apiKey || !cloudName) {
    return res.status(500).json({ error: 'Cloudinary configuration missing on server.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: 'tracker_photos' },
      apiSecret
    );

    return res.status(200).json({
      signature,
      timestamp,
      apiKey,
      cloudName
    });
  } catch (error: any) {
    console.error('Signer Error:', error);
    return res.status(500).json({ error: 'Failed to generate upload signature.' });
  }
}
