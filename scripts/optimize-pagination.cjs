const fs = require('fs');
const path = require('path');

function optimizeFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // We want to capture the const totalCount = ... part and const lists = ... part
  // Regex: 
  // const <var1> = await prisma.<model>.count({ where });
  // (optional comments or newlines)
  // const <var2> = await prisma.<model>.findMany({ ...args });
  
  const regex = /const\s+([a-zA-Z0-9_]+)\s*=\s*await\s+prisma\.([a-zA-Z0-9_]+)\.count\(\{?\s*where\s*\}?\);\s*(?:\/\/[^\n]*\s*)*const\s+([a-zA-Z0-9_]+)\s*=\s*await\s+prisma\.\2\.findMany\(\{([\s\S]*?)\}\);/g;

  let madeChanges = false;
  
  const newContent = content.replace(regex, (match, countVarName, modelName, listVarName, findManyArgs) => {
    madeChanges = true;
    return `const [${countVarName}, ${listVarName}] = await Promise.all([
      prisma.${modelName}.count({ where }),
      prisma.${modelName}.findMany({${findManyArgs}})
    ]);`;
  });

  if (madeChanges) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Optimized: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      optimizeFile(fullPath);
    }
  }
}

walkDir('./src/app/api');
console.log("Done checking APIs");
