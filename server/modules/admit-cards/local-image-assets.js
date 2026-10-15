const fs = require('node:fs/promises');
const path = require('node:path');

const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const sourceAttribute = /(\s+src\s*=\s*)(["'])([^"']*)\2/i;
const isWithin = (directory, file) => {
  const relative = path.relative(directory, file);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

async function inlineLocalTemplateImages(markup, { rootDir, staticRootDir = path.resolve(__dirname, '../../..') }) {
  const sources = new Map();
  function localAsset(source) {
    const directory = source.startsWith('/uploads/img/') ? path.join(rootDir, 'uploads/img')
      : source.startsWith('/client/assets/') ? path.join(staticRootDir, 'client/assets') : '';
    if (!directory) return null;
    const prefix = source.startsWith('/uploads/img/') ? '/uploads/img/' : '/client/assets/';
    const relative = decodeURIComponent(source.split(/[?#]/)[0].slice(prefix.length));
    const file = path.resolve(directory, relative);
    if (!isWithin(directory, file) || !mimeTypes[path.extname(file).toLowerCase()]) throw new Error('Invalid template image path');
    return { directory, file };
  }
  String(markup).replace(/<img\b[^>]*>/gi, tag => {
    const source = sourceAttribute.exec(tag)?.[3];
    if (source && !sources.has(source)) {
      const asset = localAsset(source);
      if (asset) sources.set(source, asset);
    }
    return tag;
  });
  await Promise.all([...sources].map(async ([source, asset]) => {
    const [directory, file] = await Promise.all([fs.realpath(asset.directory), fs.realpath(asset.file)]);
    if (!isWithin(directory, file) || (await fs.stat(file)).size > 8 * 1024 * 1024) throw new Error('Invalid template image file');
    const bytes = await fs.readFile(file);
    sources.set(source, `data:${mimeTypes[path.extname(asset.file).toLowerCase()]};base64,${bytes.toString('base64')}`);
  }));
  return String(markup).replace(/<img\b[^>]*>/gi, tag => tag.replace(sourceAttribute,
    (match, prefix, quote, source) => sources.has(source) ? `${prefix}${quote}${sources.get(source)}${quote}` : match));
}

module.exports = { inlineLocalTemplateImages };
