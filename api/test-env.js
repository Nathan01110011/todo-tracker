export default function handler(req, res) {
  res.status(200).json({
    SHEET_ID: process.env.SHEET_ID ? 'Present' : 'Missing',
    EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Present' : 'Missing',
    KEY: process.env.GOOGLE_PRIVATE_KEY ? 'Present' : 'Missing'
  });
}
