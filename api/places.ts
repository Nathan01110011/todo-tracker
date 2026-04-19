import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.SHEET_ID;
  const password = process.env.PASSWORD;

  if (!password) return res.status(500).json({ error: 'Server configuration error: PASSWORD not set.' });
  const authHeader = req.headers.authorization;
  if (authHeader !== password) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return res.status(401).json({ error: 'Unauthorized: Incorrect password.' });
  }

  if (!email || !key || !sheetId) {
    return res.status(500).json({ 
      error: 'Missing environment variables in Vercel.',
      details: `Email: ${!!email}, Key: ${!!key}, Sheet: ${!!sheetId}`
    });
  }

  try {
    const formattedKey = key.trim().replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');
    const serviceAccountAuth = new JWT({
      email: email.trim(),
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId.trim(), serviceAccountAuth);
    await doc.loadInfo();
    
    const placesSheet = doc.sheetsByIndex[0];
    const markersSheet = doc.sheetsByIndex[1];
    const hotelsSheet = doc.sheetsByIndex[2];
    const lockedSheet = doc.sheetsByIndex[3];
    const photosSheet = doc.sheetsByIndex[4];

    if (lockedSheet) {
      const lockRows = await lockedSheet.getRows();
      const lockRow = lockRows[0];
      if (lockRow) {
        const lastAttempt = parseInt(lockRow.get('timestamp') || '0');
        const now = Date.now();
        const secondsRemaining = Math.ceil((30000 - (now - lastAttempt)) / 1000);
        if (secondsRemaining > 0) {
          return res.status(423).json({ error: 'System Locked', retryAfter: secondsRemaining });
        }
      }
    }

    if (req.method === 'GET') {
      const [placesRows, markersRows, hotelsRows, photoRows] = await Promise.all([
        placesSheet ? placesSheet.getRows() : Promise.resolve([]),
        markersSheet ? markersSheet.getRows() : Promise.resolve([]),
        hotelsSheet ? hotelsSheet.getRows() : Promise.resolve([]),
        photosSheet ? photosSheet.getRows() : Promise.resolve([])
      ]);

      const photoMap: Record<string, string[]> = {};
      photoRows.forEach(row => {
        const locId = row.get('locationId');
        const url = row.get('url');
        if (locId && url) {
          if (!photoMap[locId]) photoMap[locId] = [];
          photoMap[locId].push(url);
        }
      });

      const places = (placesRows || []).map(row => {
        const id = row.get('id') || '';
        return {
          id,
          category: row.get('category') || 'Other',
          name: row.get('name') || 'Untitled',
          address: row.get('address') || '',
          lat: parseFloat(row.get('lat')) || 0,
          lng: parseFloat(row.get('lng')) || 0,
          status: row.get('status') || 'To Do',
          notes: row.get('notes') || '',
          rating: row.get('rating') || '',
          scope: row.get('scope') || 'Austin',
          return: row.get('return') || '',
          details: row.get('details') || '',
          date: row.get('date') || '',
          photos: (photoMap[id] || []).join(','),
        };
      });

      const markers = (markersRows || []).map(row => ({
        id: row.get('id') || '',
        type: row.get('type') || 'pin',
        name: row.get('name') || 'Untitled',
        address: row.get('address') || '',
        lat: parseFloat(row.get('lat')) || 0,
        lng: parseFloat(row.get('lng')) || 0,
        notes: row.get('notes') || '',
        scope: row.get('scope') || 'Austin',
        return: row.get('return') || '',
      }));

      const hotels = (hotelsRows || []).map(row => {
        const id = row.get('id') || '';
        return {
          id,
          name: row.get('name') || 'Untitled',
          address: row.get('address') || '',
          lat: parseFloat(row.get('lat')) || 0,
          lng: parseFloat(row.get('lng')) || 0,
          status: row.get('status') || 'To Do',
          notes: row.get('notes') || '',
          rating: row.get('rating') || '',
          scope: row.get('scope') || 'Austin',
          return: row.get('return') || '',
          date: row.get('date') || '',
          photos: (photoMap[id] || []).join(','),
        };
      });

      return res.status(200).json({ places, markers, hotels });
    }

    if (req.method === 'POST') {
      const { id, status, rating, notes, name, category, address, lat, lng, scope, return: returnFlag, details, photoUrl, date, type = 'place' } = req.body;
      
      if (photoUrl && id && photosSheet) {
        await photosSheet.addRow({
          locationId: id,
          url: photoUrl
        });
        return res.status(200).json({ success: true });
      }

      const targetSheet = type === 'hotel' ? hotelsSheet : placesSheet;
      if (!targetSheet) return res.status(404).json({ error: 'Sheet not found' });
      const rows = await targetSheet.getRows();
      
      if (id) {
        const row = rows.find(r => r.get('id') === id);
        if (row) {
          if (status !== undefined) row.set('status', status);
          if (rating !== undefined) row.set('rating', rating);
          if (notes !== undefined) row.set('notes', notes);
          if (scope !== undefined) row.set('scope', scope);
          if (returnFlag !== undefined) row.set('return', returnFlag ? 'TRUE' : 'FALSE');
          if (details !== undefined) row.set('details', details);
          if (date !== undefined) row.set('date', date);
          await row.save();
          return res.status(200).json({ success: true });
        }
        return res.status(404).json({ error: 'Item not found' });
      }

      const newId = Math.random().toString(36).substr(2, 9);
      if (type === 'hotel') {
        await targetSheet.addRow({
          id: newId, name: name || 'New Hotel', address: address || '', lat: String(lat || 0), lng: String(lng || 0),
          status: 'To Do', notes: notes || '', rating: '', scope: scope || 'Austin', return: '', date: ''
        });
      } else {
        await targetSheet.addRow({
          id: newId, category: category || 'Other', name: name || 'New Place', address: address || '', lat: String(lat || 0), lng: String(lng || 0),
          status: 'To Do', notes: notes || '', rating: '', scope: scope || 'Austin', return: '', details: details || '', date: ''
        });
      }
      return res.status(200).json({ success: true, id: newId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Unknown Google API Error',
      details: typeof error === 'object' ? JSON.stringify(error) : String(error)
    });
  }
}
