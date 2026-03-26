const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '../src/messages');
const SOURCE_FILE = path.join(MESSAGES_DIR, 'en.json');
const TARGET_FILES = ['bn.json', 'hi.json', 'ur.json'];

function syncKeys(source, target) {
  const result = { ...target };
  
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      result[key] = syncKeys(source[key], target[key] || {});
    } else if (result[key] === undefined) {
      // Add missing key from source with a marker or the original text
      result[key] = `[MISSING: ${source[key]}]`;
      console.log(`Added missing key: ${key}`);
    }
  }
  
  return result;
}

try {
  const sourceContent = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  
  TARGET_FILES.forEach(filename => {
    const targetPath = path.join(MESSAGES_DIR, filename);
    const targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    
    console.log(`Syncing ${filename}...`);
    const synced = syncKeys(sourceContent, targetContent);
    
    fs.writeFileSync(targetPath, JSON.stringify(synced, null, 2), 'utf8');
    console.log(`Updated ${filename}`);
  });
} catch (error) {
  console.error('Sync failed:', error);
  process.exit(1);
}
