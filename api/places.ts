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
  const isOwner = authHeader === password;

  // Reading is public. Any mutation still requires the owner password.
  // If a caller supplies a credential, reject it when invalid so the UI can
  // distinguish a failed owner sign-in from an anonymous view-only request.
  if ((req.method !== 'GET' && !isOwner) || (req.method === 'GET' && authHeader && !isOwner)) {
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
    
    const placesSheet = doc.sheetsByTitle['Places'];
    const markersSheet = doc.sheetsByTitle['Markers'];
    const hotelsSheet = doc.sheetsByTitle['Hotels'];
    const lockedSheet = doc.sheetsByTitle['Locked'];
    const photosSheet = doc.sheetsByTitle['Photos'];
    let diarySheet = doc.sheetsByTitle['Diary'];

    const ensurePlaceColumns = async (sheet: any, includeEventDates = false) => {
      if (!sheet) return;
      await sheet.loadHeaderRow();
      const requiredColumns = includeEventDates ? ['priority', 'eventStartDate', 'eventEndDate'] : ['priority'];
      const missingColumns = requiredColumns.filter(column => !sheet.headerValues.includes(column));
      if (missingColumns.length > 0) {
        await sheet.setHeaderRow([...sheet.headerValues, ...missingColumns]);
      }
    };

    if (isOwner) {
      await Promise.all([ensurePlaceColumns(placesSheet, true), ensurePlaceColumns(hotelsSheet)]);
    }
    
    let routesSheet = doc.sheetsByTitle['Routes'];
    if (!routesSheet && req.method === 'POST' && req.body.type === 'route') {
      routesSheet = await doc.addSheet({ title: 'Routes', headerValues: ['id', 'name', 'placeIds', 'scope', 'tripType', 'completedPlaceIds', 'status'] });
    }

    if (routesSheet && isOwner) {
      await routesSheet.loadHeaderRow();
      const requiredRouteColumns = ['tripType', 'completedPlaceIds', 'status'];
      const missingRouteColumns = requiredRouteColumns.filter(column => !routesSheet.headerValues.includes(column));
      if (missingRouteColumns.length > 0) {
        await routesSheet.setHeaderRow([...routesSheet.headerValues, ...missingRouteColumns]);
      }
    }

    if (!diarySheet && req.method === 'POST' && req.body.type === 'diary') {
      diarySheet = await doc.addSheet({
        title: 'Diary',
        headerValues: ['id', 'date', 'title', 'notes', 'placeId', 'placeType', 'name', 'address', 'lat', 'lng', 'scope', 'createdAt']
      });
    }

    if (lockedSheet && isOwner) {
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
      const [placesRows, markersRows, hotelsRows, photoRows, routeRows, diaryRows] = await Promise.all([
        placesSheet ? placesSheet.getRows() : Promise.resolve([]),
        markersSheet ? markersSheet.getRows() : Promise.resolve([]),
        hotelsSheet ? hotelsSheet.getRows() : Promise.resolve([]),
        photosSheet ? photosSheet.getRows() : Promise.resolve([]),
        routesSheet ? routesSheet.getRows() : Promise.resolve([]),
        diarySheet ? diarySheet.getRows() : Promise.resolve([])
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
          priority: placesSheet?.headerValues.includes('priority') ? row.get('priority') || '' : '',
          scope: row.get('scope') || 'Austin',
          return: row.get('return') || '',
          details: row.get('details') || '',
          date: row.get('date') || '',
          eventStartDate: placesSheet?.headerValues.includes('eventStartDate') ? row.get('eventStartDate') || '' : '',
          eventEndDate: placesSheet?.headerValues.includes('eventEndDate') ? row.get('eventEndDate') || '' : '',
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
          priority: hotelsSheet?.headerValues.includes('priority') ? row.get('priority') || '' : '',
          scope: row.get('scope') || 'Austin',
          return: row.get('return') || '',
          date: row.get('date') || '',
          photos: (photoMap[id] || []).join(','),
        };
      });

      const routes = (routeRows || []).map(row => ({
        id: row.get('id') || '',
        name: row.get('name') || 'Untitled Trip',
        placeIds: (row.get('placeIds') || '').split(',').filter(Boolean),
        scope: row.get('scope') || 'Austin',
        tripType: row.get('tripType') === 'unordered' ? 'unordered' : 'ordered',
        completedPlaceIds: (row.get('completedPlaceIds') || '').split(',').filter(Boolean),
        status: ['active', 'completed'].includes(row.get('status')) ? row.get('status') : 'planned',
      }));

      const diaryEntries = (diaryRows || []).map(row => ({
        id: row.get('id') || '',
        date: row.get('date') || '',
        title: row.get('title') || row.get('name') || 'Diary entry',
        notes: row.get('notes') || '',
        placeId: row.get('placeId') || '',
        placeType: row.get('placeType') || '',
        name: row.get('name') || '',
        address: row.get('address') || '',
        lat: parseFloat(row.get('lat')) || 0,
        lng: parseFloat(row.get('lng')) || 0,
        scope: row.get('scope') || 'Austin',
        createdAt: row.get('createdAt') || '',
      }));

      return res.status(200).json({ places, markers, hotels, routes, diaryEntries });
    }

    if (req.method === 'POST') {
      const { id, status, rating, priority, notes, name, title, category, address, lat, lng, scope, return: returnFlag, details, photoUrl, date, eventStartDate, eventEndDate, type = 'place', placeId, placeType, placeIds, tripType, completedPlaceIds, action } = req.body;
      
      if (photoUrl && id && photosSheet) {
        await photosSheet.addRow({
          locationId: id,
          url: photoUrl
        });
        return res.status(200).json({ success: true });
      }

      if (type === 'diary') {
        if (!diarySheet) return res.status(404).json({ error: 'Diary sheet not found' });
        if (id) {
          const rows = await diarySheet.getRows();
          const row = rows.find(r => r.get('id') === id);
          if (!row) return res.status(404).json({ error: 'Diary entry not found' });
          if (action === 'delete') {
            await row.delete();
            return res.status(200).json({ success: true });
          }
          return res.status(400).json({ error: 'Unsupported diary action' });
        }

        const today = new Date().toISOString().slice(0, 10);
        const entryDate = date || today;
        if (entryDate > today) return res.status(400).json({ error: 'Diary entries cannot be dated in the future' });
        const newId = Math.random().toString(36).substr(2, 9);
        await diarySheet.addRow({
          id: newId,
          date: entryDate,
          title: title || name || 'Diary entry',
          notes: notes || '',
          placeId: placeId || '',
          placeType: placeType || '',
          name: name || '',
          address: address || '',
          lat: String(lat || 0),
          lng: String(lng || 0),
          scope: scope || 'Austin',
          createdAt: new Date().toISOString()
        });
        return res.status(200).json({ success: true, id: newId });
      }

      if (type === 'route') {
        if (!routesSheet) return res.status(404).json({ error: 'Routes sheet not found' });
        
        if (id) {
          const rows = await routesSheet.getRows();
          const row = rows.find(r => r.get('id') === id);
          if (row) {
            if (action === 'delete') {
              await row.delete();
              return res.status(200).json({ success: true });
            }
            if (name !== undefined) row.set('name', name);
            if (placeIds !== undefined) row.set('placeIds', (placeIds || []).join(','));
            if (scope !== undefined) row.set('scope', scope);
            if (tripType !== undefined) row.set('tripType', tripType === 'unordered' ? 'unordered' : 'ordered');
            if (completedPlaceIds !== undefined) row.set('completedPlaceIds', (completedPlaceIds || []).join(','));
            if (status !== undefined) row.set('status', ['planned', 'active', 'completed'].includes(status) ? status : 'planned');
            await row.save();
            return res.status(200).json({ success: true });
          }
          return res.status(404).json({ error: 'Trip not found' });
        }

        const newId = Math.random().toString(36).substr(2, 9);
        await routesSheet.addRow({
          id: newId,
          name: name || 'New Trip',
          placeIds: (placeIds || []).join(','),
          scope: scope || 'Austin',
          tripType: tripType === 'unordered' ? 'unordered' : 'ordered',
          completedPlaceIds: '',
          status: 'planned'
        });
        return res.status(200).json({ success: true, id: newId });
      }

      const targetSheet = type === 'hotel' ? hotelsSheet : placesSheet;
      if (!targetSheet) return res.status(404).json({ error: 'Sheet not found' });
      await ensurePlaceColumns(targetSheet, type !== 'hotel');
      const rows = await targetSheet.getRows();
      
      if (id) {
        const row = rows.find(r => r.get('id') === id);
        if (row) {
          if (action === 'delete') {
            if (routesSheet) {
              const routeRows = await routesSheet.getRows();
              await Promise.all(routeRows.map(async routeRow => {
                const nextPlaceIds = (routeRow.get('placeIds') || '')
                  .split(',')
                  .filter(Boolean)
                  .filter((placeId: string) => placeId !== `${type}:${id}` && placeId !== id);
                routeRow.set('placeIds', nextPlaceIds.join(','));
                const nextCompletedPlaceIds = (routeRow.get('completedPlaceIds') || '')
                  .split(',')
                  .filter(Boolean)
                  .filter((placeId: string) => placeId !== `${type}:${id}` && placeId !== id);
                if (routesSheet.headerValues.includes('completedPlaceIds')) routeRow.set('completedPlaceIds', nextCompletedPlaceIds.join(','));
                await routeRow.save();
              }));
            }
            await row.delete();
            return res.status(200).json({ success: true });
          }

          if (name !== undefined) row.set('name', name);
          if (category !== undefined && type !== 'hotel') row.set('category', category);
          if (address !== undefined) row.set('address', address);
          if (lat !== undefined) row.set('lat', String(lat));
          if (lng !== undefined) row.set('lng', String(lng));
          if (status !== undefined) row.set('status', status);
          if (rating !== undefined) row.set('rating', rating);
          if (priority !== undefined) row.set('priority', /^[1-5]$/.test(String(priority)) ? String(priority) : '');
          if (notes !== undefined) row.set('notes', notes);
          if (scope !== undefined) row.set('scope', scope);
          if (returnFlag !== undefined) row.set('return', returnFlag ? 'TRUE' : 'FALSE');
          if (details !== undefined) row.set('details', details);
          if (date !== undefined) row.set('date', date);
          if (eventStartDate !== undefined && type !== 'hotel') row.set('eventStartDate', eventStartDate);
          if (eventEndDate !== undefined && type !== 'hotel') row.set('eventEndDate', eventEndDate);
          await row.save();
          return res.status(200).json({ success: true });
        }
        return res.status(404).json({ error: 'Item not found' });
      }

      const newId = Math.random().toString(36).substr(2, 9);
      if (type === 'hotel') {
        await targetSheet.addRow({
          id: newId, name: name || 'New Hotel', address: address || '', lat: String(lat || 0), lng: String(lng || 0),
          status: 'To Do', notes: notes || '', rating: '', priority: '', scope: scope || 'Austin', return: '', date: ''
        });
      } else {
        await targetSheet.addRow({
          id: newId, category: category || 'Other', name: name || 'New Place', address: address || '', lat: String(lat || 0), lng: String(lng || 0),
          status: 'To Do', notes: notes || '', rating: '', priority: '', scope: scope || 'Austin', return: '', details: details || '', date: '',
          eventStartDate: eventStartDate || '', eventEndDate: eventEndDate || ''
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
