const mongoose = require('mongoose');
const dotenv = require('dotenv');
const https = require('https');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
dotenv.config({ quiet: true });

function dohQuery(name, type) {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    https.get(url, { headers: { accept: 'application/dns-json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
async function resolveSrvUri(uri) {
  if (!uri || !uri.startsWith('mongodb+srv://')) return uri;
  const urlObj = new URL(uri.replace('mongodb+srv://', 'http://'));
  const host = urlObj.hostname;
  const srv = await dohQuery(`_mongodb._tcp.${host}`, 'SRV');
  const txt = await dohQuery(host, 'TXT');
  const hosts = (srv.Answer || []).map((a) => { const p = a.data.split(' '); return `${p[3].replace(/\.$/, '')}:${p[2]}`; });
  const authSourceTxt = (txt.Answer || []).find((a) => a.data.includes('authSource'));
  const additionalParams = authSourceTxt ? '&' + authSourceTxt.data.replace(/"/g, '') : '';
  const credentials = urlObj.username ? `${urlObj.username}:${urlObj.password}@` : '';
  return `mongodb://${credentials}${hosts.join(',')}/?ssl=true&retryWrites=true&w=majority${additionalParams}`;
}

(async () => {
  const uri = await resolveSrvUri(process.env.MONGO_URI);
  await mongoose.connect(uri);
  const yash = await User.findOne({ email: 'yash.mishra@datacircles.in' });
  if (!yash) { console.log('yash.mishra user not found'); process.exit(0); }
  console.log('yash user id:', yash._id.toString());
  console.log('yash user org:', yash.organization?.toString());
  const sub = await Subscription.findOne({ organization: yash.organization });
  console.log('subscription:', sub ? { id: sub._id.toString(), planName: sub.planName, appStatus: sub.appStatus } : 'none');

  const rohit = await User.findOne({ email: 'rohit.zore@datacircles.in' });
  console.log('rohit user org:', rohit?.organization?.toString());
  console.log('same org as yash?', rohit?.organization?.toString() === yash.organization?.toString());
  process.exit(0);
})();
