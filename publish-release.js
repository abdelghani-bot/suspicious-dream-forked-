// publish-release.js
// بيبني الملفات محليًا (بدون electron-builder --publish)، وبعدين
// بينشئ Release واحد على GitHub ويرفع الملفات (exe, blockmap, yml) بالتتابع
// (مش بالتوازي) عشان يمنع مشكلة انقسام الـ drafts.

const fs = require('fs');
const path = require('path');
const https = require('https');
const pkg = require('./package.json');

const OWNER = pkg.build?.publish?.owner || 'abdelghani-bot';
const REPO = pkg.build?.publish?.repo || 'suspicious-dream-forked-';
const OUT_DIR = pkg.build?.directories?.output || 'release';
const TAG = 'v' + pkg.version;
const TOKEN = (process.env.GITHUB_TOKEN || '').trim().replace(/^"(.*)"$/, '$1');

if (!TOKEN) {
  console.error('❌ GITHUB_TOKEN مش موجود. شغّل setx GITHUB_TOKEN ghp_xxxx وافتح CMD جديد.');
  process.exit(1);
}

if (!/^[\x21-\x7e]+$/.test(TOKEN)) {
  console.error('❌ التوكن فيه حروف غريبة (مسافات/سطر جديد). أعد setx GITHUB_TOKEN بدون علامات تنصيص أو مسافات زيادة.');
  process.exit(1);
}

function apiRequest(path_, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: path_,
      method,
      headers: {
        'User-Agent': 'pharmacypro-release-script',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(chunks ? JSON.parse(chunks) : null);
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`API error ${res.statusCode}: ${chunks}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadAsset(uploadPathBase, filePath) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const stat = fs.statSync(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const contentType =
      ext === '.exe' ? 'application/octet-stream' :
      ext === '.blockmap' ? 'application/octet-stream' :
      ext === '.yml' ? 'text/yaml' :
      ext === '.zip' ? 'application/zip' :
      'application/octet-stream';

    const options = {
      hostname: 'uploads.github.com',
      path: `${uploadPathBase}?name=${encodeURIComponent(fileName)}`,
      method: 'POST',
      headers: {
        'User-Agent': 'pharmacypro-release-script',
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': contentType,
        'Content-Length': stat.size,
      },
    };
    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  ✅ اترفع: ${fileName}`);
          resolve(JSON.parse(chunks));
        } else {
          reject(new Error(`فشل رفع ${fileName}: ${res.statusCode} ${chunks}`));
        }
      });
    });
    req.on('error', reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

(async () => {
  const outPath = path.resolve(__dirname, OUT_DIR);
  if (!fs.existsSync(outPath)) {
    console.error(`❌ مجلد المخرجات مش موجود: ${outPath}. شغّل build الأول.`);
    process.exit(1);
  }

  const validExt = ['.exe', '.blockmap', '.yml', '.zip', '.dmg', '.appimage', '.deb', '.rpm', '.msi'];
  const files = fs.readdirSync(outPath).filter((f) => {
    const full = path.join(outPath, f);
    if (!fs.statSync(full).isFile()) return false;
    const ext = path.extname(f).toLowerCase();
    if (!validExt.includes(ext)) return false;
    if (f === 'builder-debug.yml' || f === 'builder-effective-config.yaml') return false;
    // اسمح فقط بملفات latest.yml أو الملفات اللي فيها رقم النسخة الحالي
    if (f === 'latest.yml') return true;
    return f.includes(pkg.version);
  });

  if (files.length === 0) {
    console.error('❌ مفيش ملفات مناسبة في مجلد المخرجات. تأكد إن الـ build خلص صح.');
    process.exit(1);
  }

  console.log(`📦 ملفات هترفع (${files.length}):`);
  files.forEach((f) => console.log(`   - ${f}`));

  // 1. امسح أي release قديم بنفس التاج (سواء draft أو منشور)
  console.log(`\n🔍 بيدور على release قديم بالتاج ${TAG}...`);
  const releases = (await apiRequest(`/repos/${OWNER}/${REPO}/releases`)) || [];
  const matches = releases.filter((r) => r.tag_name === TAG);
  for (const rel of matches) {
    console.log(`🗑️  بيمسح release قديم: id=${rel.id}, draft=${rel.draft}`);
    await apiRequest(`/repos/${OWNER}/${REPO}/releases/${rel.id}`, 'DELETE');
  }

  // 2. اعمل release واحد جديد (منشور مباشرة، مش draft)
  console.log(`\n🚀 بيعمل release جديد بالتاج ${TAG}...`);
  const release = await apiRequest(`/repos/${OWNER}/${REPO}/releases`, 'POST', {
    tag_name: TAG,
    name: TAG,
    draft: false,
    prerelease: false,
    generate_release_notes: false,
  });

  if (!release || !release.upload_url) {
    console.error('❌ فشل إنشاء الـ release.');
    process.exit(1);
  }

  const uploadPathBase = release.upload_url.split('{')[0].replace('https://uploads.github.com', '');

  // 3. ارفع الملفات واحد ورا التاني (مش بالتوازي)
  console.log(`\n⬆️  بيرفع الملفات بالتتابع...`);
  for (const f of files) {
    await uploadAsset(uploadPathBase, path.join(outPath, f));
  }

  console.log(`\n✅ خلصنا! الـ release منشور فعليًا على:`);
  console.log(`   ${release.html_url}`);
})().catch((err) => {
  console.error('❌ حصل خطأ:', err.message);
  process.exit(1);
});
