ThumbnailAPI = function(config) {
  this.host = config.host || "http://timemachine-api.cmucreatelab.org/thumbnail"
  this.root = config.root;
  this.boundsLTRB = config.boundsLTRB || "0,0,100,100";
  this.width = config.width || 100;
  this.height = config.height || 100
  this.ignoreAspectRatio = config.ignoreAspectRatio || "";
  this.tileFormat = config.tileFormat || "mp4";
  this.nframes = config.nframes;
  this.frameTime = config.frameTime || "0";
  this.format = config.format || "png";
  this.filter = config.filter || "";
}

ThumbnailAPI.prototype.serialize = function() {
  var str = [];
  for(var p in this){
    if (this.hasOwnProperty(p) && this[p] != "" && p != "host") {
      str.push(encodeURIComponent(p) + "=" + this[p]);
    }
  }
  return str.join("&");
}

ThumbnailAPI.prototype.url = function() {
  return this.host + "?" + this.serialize();
}
