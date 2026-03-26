const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src', 'app', 'api');

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && entry.name === 'route.ts') {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Determine what module name to use based on the folder path
  // E.g., src/app/api/users/[id]/route.ts -> "users"
  const relativePath = path.relative(targetDir, filePath);
  const segments = relativePath.split(path.sep);
  const moduleName = segments[0]; 

  if (!moduleName || moduleName === 'upload' || moduleName === 'auth') {
    return; // Skip special routes
  }

  // Handle getAuthContext imports
  if (!content.includes('hasPermission')) {
    const permissionsImport = `import { hasPermission } from "@/lib/permissions";\n`;
    
    // Insert import after existing internal imports
    const importRegex = /(import .* from "@\/lib\/[^"]+";\n)(?!import .* from "@\/lib\/)/g;
    const matches = [...content.matchAll(importRegex)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const insertIdx = lastMatch.index + lastMatch[0].length;
      content = content.slice(0, insertIdx) + permissionsImport + content.slice(insertIdx);
    } else {
      content = permissionsImport + content;
    }
  }

  // Process GET requests (requires "read" or "manage" implicitly)
  content = refactorMethod(content, 'GET', moduleName, 'read');
  
  // Process POST, PUT, DELETE (typically requires "write" or "manage")
  content = refactorMethod(content, 'POST', moduleName, 'write');
  content = refactorMethod(content, 'PUT', moduleName, 'write');
  content = refactorMethod(content, 'DELETE', moduleName, 'manage'); // Assume DELETE requires manage or write

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored: ${filePath}`);
  }
}

function refactorMethod(content, httpMethod, moduleName, requiredAction) {
  // We need to find the `export async function METHOD(` block
  // and replace the explicit role check with `hasPermission`
  const methodRegex = new RegExp(`export async function ${httpMethod}\\b[\\s\\S]*?// Check permission\\s+if \\(\\s*!\\s*\\[["']ADMIN["'],\\s*["']SUPER_ADMIN["']\\]\\.includes\\((currentUser|user)\\.role\\)\\s*\\)\\s*\\{\\s*return forbidden\\([^\\)]+\\);\\s*\\}`, 'g');
  
  return content.replace(methodRegex, (match, userVar) => {
    // Replace the inner check
    const newCheck = `// Check permission
    if (${userVar}.role !== "SUPER_ADMIN" && !hasPermission(${userVar}.permissions, "${moduleName}", "${requiredAction}")) {
      return forbidden("Insufficient ${requiredAction} permissions for ${moduleName} module");
    }`;
    
    return match.replace(/(\/\/ Check permission\s+if\s*\(.*?\)\s*\{\s*return forbidden\(.*?\);\s*\})/s, newCheck);
  });
}

processDirectory(targetDir);
console.log('Refactoring complete.');
