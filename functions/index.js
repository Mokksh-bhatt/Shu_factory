const { onRequest } = require('firebase-functions/v2/https');

const OS_KEY = 'os_v2_app_hsqhibtvsrbo7lpehg4yutxvmvvc7nj66enu4wufjemxpegyfr2rncliwfuqiv5mi66uehjenaej564zqj5b4han7t5537ddi27ug4q';
const OS_APP_ID = '3ca07406-7594-42ef-ade4-39b98a4ef565';

// Proxy OneSignal REST API to bypass browser CORS restrictions
exports.notify = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  try {
    const body = { ...req.body, app_id: OS_APP_ID };
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${OS_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
