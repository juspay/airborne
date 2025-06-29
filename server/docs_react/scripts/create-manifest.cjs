const fs = require('fs');
const path = require('path');

const docSourcesPath = path.join(__dirname, '..', 'public', 'doc-sources');
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');

function getFileTree(dir) {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const tree = {};
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      tree[dirent.name] = getFileTree(res);
    } else {
      if (!tree.files) {
        tree.files = [];
      }
      tree.files.push(dirent.name);
    }
  }
  return tree;
}

try {
  const fileTree = getFileTree(docSourcesPath);
  fs.writeFileSync(manifestPath, JSON.stringify(fileTree, null, 2));
  console.log('manifest.json created successfully.');
} catch (error) {
  console.error('Error creating manifest.json:', error);
}
