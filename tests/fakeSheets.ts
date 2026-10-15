// In-memory implementation of the Sheets methods used by the API. No live data is touched.
export class FakeRow {
  constructor(public values: Record<string, any>, private sheet: FakeSheet) {}
  get(key: string) { return this.values[key]; }
  set(key: string, value: any) { this.values[key] = value; }
  async save() {}
  async delete() { this.sheet.rows = this.sheet.rows.filter(r => r !== this); }
}
export class FakeSheet {
  rows: FakeRow[] = [];
  constructor(public headerValues: string[]) {}
  async getRows() { return this.rows; }
  async loadHeaderRow() {}
  async setHeaderRow(headers: string[]) { this.headerValues = headers; }
  async addRow(values: Record<string, any>) { const row = new FakeRow({ ...values }, this); this.rows.push(row); return row; }
  async addRows(values: Record<string, any>[]) { return Promise.all(values.map(v => this.addRow(v))); }
}
export class FakeDoc {
  sheetsByTitle: Record<string, FakeSheet> = {};
  async loadInfo() {}
  async addSheet({ title, headerValues }: { title: string; headerValues: string[] }) {
    if (this.sheetsByTitle[title]) throw new Error(`Sheet already exists: ${title}`);
    const sheet = new FakeSheet(headerValues); this.sheetsByTitle[title] = sheet; return sheet;
  }
}
// API-handler bundles substitute only the two external authentication/storage SDKs.
export const sharedDoc = new FakeDoc();
export class GoogleSpreadsheet { constructor() { return sharedDoc; } }
export class JWT {}
