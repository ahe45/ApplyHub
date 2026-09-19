const fs = require('node:fs/promises');

// Streaming ZIP writers use data descriptors. Fill local headers after writing so
// existing AdmZip-based backup tools can edit and reserialize these ZIPs safely.
async function finalizeZipHeaders(filePath) {
  const file = await fs.open(filePath, 'r+');
  async function read(length, position) {
    const buffer=Buffer.alloc(length);
    const {bytesRead}=await file.read(buffer,0,length,position);
    if(bytesRead!==length)throw new Error('Incomplete ZIP header');
    return buffer;
  }
  try {
    const {size}=await file.stat();
    const tail=await read(Math.min(size,65557),Math.max(0,size-65557));
    let end=-1;
    for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50 && i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}
    if(end<0)throw new Error('ZIP central directory missing');
    const count=tail.readUInt16LE(end+10);
    let position=tail.readUInt32LE(end+16);
    // ZIP64 needs its own offsets; leave valid descriptors untouched in that case.
    if(count===65535 || position===0xffffffff)return;
    for(let index=0;index<count;index++){
      const central=await read(46,position);
      if(central.readUInt32LE(0)!==0x02014b50)throw new Error('Invalid ZIP central header');
      const localPosition=central.readUInt32LE(42);
      if(localPosition===0xffffffff)return;
      if(central.readUInt16LE(8)&8){
        const local=await read(30,localPosition);
        if(local.readUInt32LE(0)!==0x04034b50)throw new Error('Invalid ZIP local header');
        local.writeUInt16LE(local.readUInt16LE(6)&~8,6);
        central.copy(local,14,16,28);
        central.writeUInt16LE(central.readUInt16LE(8)&~8,8);
        await file.write(local,0,local.length,localPosition);
        await file.write(central,0,central.length,position);
      }
      position+=46+central.readUInt16LE(28)+central.readUInt16LE(30)+central.readUInt16LE(32);
    }
  } finally {await file.close();}
}
module.exports={finalizeZipHeaders};
