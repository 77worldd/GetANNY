const {EventEmitter}=require('node:events');const {v4:uuid}=require('uuid');
class TorrentEngine extends EventEmitter{
 constructor(){super();this.client=null;this.torrents=new Map();this.initializing=null;}
 async _client(){if(this.client)return this.client;if(!this.initializing)this.initializing=(async()=>{const {default:WebTorrent}=await import('webtorrent');this.client=new WebTorrent();return this.client})();return this.initializing;}
 async add(torrent,savePath,existingId){if(!torrent||!savePath)throw new Error('A magnet URL or torrent file and destination folder are required');const client=await this._client();const id=existingId||uuid();return new Promise((resolve,reject)=>{let settled=false;const t=client.add(torrent,{path:savePath},torrentInfo=>{settled=true;this.torrents.set(id,torrentInfo);this.emit('added',{id,name:torrentInfo.name});resolve({id,name:torrentInfo.name});});t.on('download',bytes=>this.emit('progress',{id,name:t.name,downloadedSize:t.downloaded,totalSize:t.length,speed:t.downloadSpeed,progress:t.length?t.progress*100:0,peers:t.numPeers}));t.on('done',()=>this.emit('complete',{id,name:t.name,path:t.path}));t.on('error',e=>{if(!settled)reject(e);else this.emit('error',{id,error:e.message})});});}
 pause(id){const t=this.torrents.get(id);if(!t)return false;t.pause();return true} resume(id){const t=this.torrents.get(id);if(!t)return false;t.resume();return true} remove(id){const t=this.torrents.get(id);if(!t)return false;return new Promise(resolve=>t.destroy({destroyStore:false},()=>{this.torrents.delete(id);resolve(true)}));}
 async close(){if(!this.client)return;await new Promise(r=>this.client.destroy(r));this.client=null;this.torrents.clear();}
}
module.exports={TorrentEngine};
