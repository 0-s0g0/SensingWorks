// One-time import of the user-approved CSV into the confirmed empty production WBS.
// Uses the existing Firebase CLI login. Never writes or prints credentials.
const fs = require('node:fs');
const path = require('node:path');
const auth = require('/opt/homebrew/lib/node_modules/firebase-tools/lib/auth.js');
const root = path.resolve(__dirname, '..');
const project = 'sensingworks';
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const collections = ['projects', 'wbsItems', 'taskAssignments', 'taskDependencies', 'completionReports', 'pointAwards', 'rewardPrivate'];
const encode = (v) => v === null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(encode) } } : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v } : { stringValue: v };
(async () => {
 const account = auth.getProjectDefaultAccount(root);
 if (!account) throw Error('Firebase CLI login required');
 const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
 const request = async (endpoint, payload) => {
  const response = await fetch(base + endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error?.message || String(response.status));
  return data;
 };
 const { transaction } = await request(':beginTransaction', { options: { readWrite: {} } });
 let committed = false;
 try {
  const snapshot = {};
  for (const collectionId of collections) {
   const results = await request(':runQuery', { transaction, structuredQuery: { from: [{ collectionId }] } });
   snapshot[collectionId] = results.filter((x) => x.document).map((x) => x.document);
  }
  for (const key of collections.filter((key) => key !== 'projects')) if (snapshot[key].length) throw Error(`${key} is not empty. Import stopped; nothing overwritten.`);
  const directory = path.join(root, '.local-backups');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = path.join(directory, `before-pet-poc-${new Date().toISOString().replaceAll(':', '-')}.json`);
  fs.writeFileSync(backup, JSON.stringify({ project, createdAt: new Date().toISOString(), snapshot }, null, 2), { mode: 0o600 });
  const data = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/pet-poc-initial.json'), 'utf8'));
  const writes = [];
  for (const key of ['projects', 'wbsItems', 'taskDependencies', 'rewardPrivate']) {
   for (const { id, ...body } of data[key]) {
    if (key === 'projects' && snapshot.projects.some((d) => d.name.endsWith('/' + id))) continue;
    writes.push({ update: { name: `projects/${project}/databases/(default)/documents/${key}/${id}`, fields: encode(body).mapValue.fields }, currentDocument: { exists: false } });
   }
  }
  if (writes.length > 500) throw Error('Atomic write limit exceeded');
  console.log(JSON.stringify({ project, writes: writes.length, wbs: data.wbsItems.length, backup, apply: process.argv.includes('--apply') }));
  if (process.argv.includes('--apply')) {
   const result = await request(':commit', { transaction, writes });
   committed = true;
   console.log(JSON.stringify({ committed: true, commitTime: result.commitTime, written: result.writeResults.length }));
  }
 } finally {
  if (!committed) await request(':rollback', { transaction });
 }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
