const {spawn}=require('node:child_process');const path=require('node:path');const fs=require('node:fs/promises');
class YtDlpWrapper{
 constructor({binPath}={}){this.binPath=binPath;this.processes=new Map();}
 executable(){const name=process.platform==='win32'?'yt-dlp.exe':process.platform==='darwin'?'yt-dlp_macos':'yt-dlp';return path.join(this.binPath||'',name)}
 run(args,{onProgress=()=>{},signal}={}){return new Promise((resolve,reject)=>{const child=spawn(this.executable(),args,{stdio:['ignore','pipe','pipe'],windowsHide:true,signal});let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b.toString();if(stdout.length>10_000_000)stdout=stdout.slice(-1_000_000)});child.stderr.on('data',b=>{const s=b.toString();stderr=(stderr+s).slice(-100_000);const m=s.match(/\[download\]\s+(\d+(?:\.\d+)?)%.*?at\s+([^\s]+).*?ETA\s+([^\s]+)/);if(m)onProgress({progress:+m[1],speed:m[2],eta:m[3]})});child.once('error',reject);child.once('close',code=>code===0?resolve(stdout.trim()):reject(new Error(stderr.trim()||`yt-dlp exited with code ${code}`)));});}
 async getInfo(url){const out=await this.run(['--dump-single-json','--no-warnings','--no-playlist',url]);return JSON.parse(out)}
 async getFormats(url){const info=await this.getInfo(url);return {title:info.title,thumbnail:info.thumbnail,duration:info.duration,formats:(info.formats||[]).filter(f=>f.url&&f.format_id).map(f=>({formatId:f.format_id,ext:f.ext,quality:f.format_note||f.resolution||'audio',resolution:f.resolution||null,filesize:f.filesize||f.filesize_approx||0,vcodec:f.vcodec,acodec:f.acodec,format:f.format}))};}
 async download({url,formatId,savePath,onProgress}){await fs.mkdir(savePath,{recursive:true});const args=['--no-playlist','--newline','-o',path.join(savePath,'%(title)s.%(ext)s')];if(formatId)args.push('-f',String(formatId));args.push(url);return this.run(args,{onProgress});}
}
module.exports={YtDlpWrapper};
