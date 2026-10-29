class DownloadsRepo {
 constructor(database){this.db=database.db;this.insertStmt=this.db.prepare(`INSERT INTO downloads(id,url,filename,savePath,status,totalSize,downloadedSize,speed,mimeType,category,createdAt,updatedAt,error,headers,kind) VALUES(@id,@url,@filename,@savePath,@status,@totalSize,@downloadedSize,@speed,@mimeType,@category,@createdAt,@updatedAt,@error,@headers,@kind)`);this.updateStmt=this.db.prepare(`UPDATE downloads SET filename=@filename,savePath=@savePath,status=@status,totalSize=@totalSize,downloadedSize=@downloadedSize,speed=@speed,mimeType=@mimeType,category=@category,updatedAt=@updatedAt,error=@error,headers=@headers,kind=@kind WHERE id=@id`);}
 normalize(d){return {id:d.id,url:d.url,filename:d.filename||'download',savePath:d.savePath||'',status:d.status||'queued',totalSize:Number(d.totalSize)||0,downloadedSize:Number(d.downloadedSize)||0,speed:Number(d.speed)||0,mimeType:d.mimeType||null,category:d.category||'other',createdAt:d.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),error:d.error||null,headers:typeof d.headers==='string'?d.headers:JSON.stringify(d.headers||{}),kind:d.kind||'file'};}
 save(d){const row=this.normalize(d);if(this.db.prepare('SELECT 1 FROM downloads WHERE id=?').get(row.id))this.updateStmt.run(row);else this.insertStmt.run(row);return this.get(row.id);}
 get(id){const r=this.db.prepare('SELECT * FROM downloads WHERE id=?').get(id);if(r)try{r.headers=JSON.parse(r.headers||'{}')}catch{r.headers={}}return r||null;}
 getAll(){return this.db.prepare('SELECT * FROM downloads ORDER BY createdAt DESC').all().map(r=>{try{r.headers=JSON.parse(r.headers||'{}')}catch{r.headers={}}return r});}
 byStatus(status){return this.getAll().filter(d=>d.status===status)}
 remove(id){return this.db.prepare('DELETE FROM downloads WHERE id=?').run(id).changes>0}
 clearCompleted(){return this.db.prepare("DELETE FROM downloads WHERE status='completed'").run().changes}
 stats(){return this.db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='downloading' THEN 1 ELSE 0 END) active, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed, SUM(CASE WHEN status='downloading' THEN speed ELSE 0 END) speed FROM downloads`).get()}
}
module.exports={DownloadsRepo};
