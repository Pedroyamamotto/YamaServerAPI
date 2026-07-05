import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('api');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (content.includes('import chalkPkg from "chalk";')) {
    // Relative path to api/src/chalk-stub.js
    const target = path.resolve('api/src/chalk-stub.js');
    let rel = path.relative(path.dirname(file), target).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    content = content.replace(/import\s+chalkPkg\s+from\s+["']chalk["'];\nconst\s+chalk\s+=\s+chalkPkg\.default\s+\|\|\s+chalkPkg;/g, `import chalk from "${rel}";`);
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed chalk to stub in', file);
  }
});
console.log('Done chalk stub fix');
