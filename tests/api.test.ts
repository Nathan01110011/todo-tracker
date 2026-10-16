import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/places';
import { sharedDoc } from './fakeSheets';

process.env.PASSWORD = 'test-owner';
process.env.SHEET_ID = 'fake-sheet';
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.invalid';
process.env.GOOGLE_PRIVATE_KEY = 'fake-key';
const request = async (method: string, body?: any, authorization?: string) => {
  let status = 200, data: any;
  await handler({ method, body, headers:{ authorization } } as any, { status(code: number) { status=code; return this; }, json(value: any) { data=value; return this; } } as any);
  return { status,data };
};

test('existing API protects experience writes, leaves public reads and legacy collections intact', async () => {
  sharedDoc.sheetsByTitle = {};
  assert.equal((await request('POST',{ type:'experience',action:'import' })).status,401);
  assert.equal(Object.keys(sharedDoc.sheetsByTitle).length,0);
  assert.equal((await request('GET',undefined,'wrong')).status,401);
  const read = await request('GET');
  assert.equal(read.status,200);
  assert.deepEqual(read.data.experiences,{ organisers:[],offerings:[],sessions:[] });
  const places = await sharedDoc.addSheet({ title:'Places',headerValues:['id','name','category','lat','lng','scope'] });
  await places.addRow({ id:'legacy',name:'My saved place',category:'Food',scope:'Austin' });
  const imported = await request('POST',{ type:'experience',action:'import' },'test-owner');
  assert.equal(imported.status,200);
  assert.equal(imported.data.experiences.organisers.length,24);
  const reread = await request('GET');
  assert.equal(reread.data.places[0].name,'My saved place');
  assert.equal(reread.data.experiences.sessions.length,15);
  assert.equal((await request('POST',{ type:'experience',action:'import' },'test-owner')).data.imported,0);
  const invalid = await request('POST',{ type:'experience',action:'save',kind:'sessions',record:{ title:'orphan' } },'test-owner');
  assert.equal(invalid.status,400);
});
