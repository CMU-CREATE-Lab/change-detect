// ThumbnailServiceAPI.js
"use strict";

var ThumbnailServiceAPI = function (config, args) {
  this.host = (config && config.host) ? config.host : "http://thumbnails.cmucreatelab.org/thumbnail";
  this.args = (args) ? args : {};
}

ThumbnailServiceAPI.prototype.serializeArgs = function() {
  var str = [];
  for(var key in this.args){
    if (this.args.hasOwnProperty(key)) {
      var val = encodeURIComponent(key);
      if (this.args[key] !== "") {
        val += "=" + encodeURIComponent(this.args[key]);
      }
      str.push(val);
    }
  }
  return str.join("&");
}
ThumbnailServiceAPI.prototype.serialize = function() {
  return this.host + "?" + this.serializeArgs();
}
