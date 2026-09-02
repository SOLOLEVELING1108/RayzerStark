const Jimp = require('jimp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
(async () => {
  const src = await Jimp.read(__dirname + '/build/icon.png');
  const sizes = [16,24,32,48,64,128,256];
  const bufs = [];
  for (const s of sizes) {
    const c = src.clone().resize(s, s, Jimp.RESIZE_BICUBIC);
    bufs.push(await c.getBufferAsync(Jimp.MIME_PNG));
  }
  const ico = await pngToIco(bufs);
  fs.writeFileSync(__dirname + '/build/icon.ico', ico);
  console.log('icon.ico written:', ico.length, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
