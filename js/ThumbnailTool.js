var ThumbnailTool = function(timelapse, options) {
  ///////////////////////////////////////////////////////////////////
  //
  // variables
  //

  // Others
  var thisObj = this;
  var canvasLayer;
  var ctx;
  var cropBox = {};
  var cropHandle = [];
  var cropHandleSize = 8;
  var cropHandleHalfSize = cropHandleSize / 2.0;
  var isCropBoxHidden = true;
  var $dataPanesContainer = $("#" + timelapse.getDataPanesContainerId());
  var boxEventHandler = new BoxEventHandler(timelapse);
  var boxWidth;
  var boxHeight;

  ///////////////////////////////////////////////////////////////////
  //
  // public functions
  //

  var showCropBox = function() {
    if (isCropBoxHidden) {
      isCropBoxHidden = false;
      drawCropBox();
      addCropHandleEvents();
    }
  };
  this.showCropBox = showCropBox;

  var hideCropBox = function() {
    if (!isCropBoxHidden) {
      isCropBoxHidden = true;
      clearCanvas();
      removeCropHandleEvents();
    }
  };
  this.hideCropBox = hideCropBox;

  var centerAndDrawCropBox = function(size) {
    centerCropBox(size);
    drawCropBox();
  };
  this.centerAndDrawCropBox = centerAndDrawCropBox;

  var getURL = function(settings) {
    var bound = ( typeof (settings["bound"]) == "undefined") ? cropBoxToViewBox() : settings["bound"];
    var config = {
      host: "http://thumbnails.cmucreatelab.org/thumbnail"
    };
    var args = {
      root: timelapse.getSettings().url,
      boundsLTRB: bound.xmin + "," + bound.ymin + "," + bound.xmax + "," + bound.ymax,
      width: ( typeof (settings["width"]) == "undefined") ? cropBox.xmax - cropBox.xmin : settings["width"],
      height: ( typeof (settings["height"]) == "undefined") ? cropBox.ymax - cropBox.ymin : settings["height"],
      frameTime: ( typeof (settings["startTime"]) == "undefined") ? timelapse.getCurrentTime() : settings["startTime"],
      format: ( typeof (settings["format"]) == "undefined") ? "png" : settings["format"],
      fps: ( typeof (settings["fps"]) == "undefined") ? timelapse.getFps() : settings["fps"],
      tileFormat: timelapse.getMediaType().slice(1)
    };

    if (settings.embedTime)
      args.labelsFromDataset = "";

    if ( typeof (settings["endTime"]) == "undefined") {
      if (args.format == "gif") {
        args.nframes = ( typeof (settings["nframes"]) == "undefined") ? 10 : settings["nframes"];
      } else if (args.format == "mp4" || args.format == "webm") {
        args.nframes = ( typeof (settings["nframes"]) == "undefined") ? 50 : settings["nframes"];
      }
    } else {
      args.nframes = (settings["endTime"] - args.frameTime) * timelapse.getFps() + 1;
    }
    if ( typeof args.nframes != "undefined") {
      args.nframes = parseInt(Math.round(args.nframes));
    }

    var t = new ThumbnailServiceAPI(config, args);
    return {
      url: t.serialize(),
      args: args
    };
  };
  this.getURL = getURL;

  var cropBoxToViewBox = function() {
    var topLeftPt = timelapse.convertViewportToTimeMachine({
      x: cropBox.xmin,
      y: cropBox.ymin
    });
    var bottomRightPt = timelapse.convertViewportToTimeMachine({
      x: cropBox.xmax,
      y: cropBox.ymax
    });
    return {
      xmin: topLeftPt.x,
      ymin: topLeftPt.y,
      xmax: bottomRightPt.x,
      ymax: bottomRightPt.y
    };
  };
  this.cropBoxToViewBox = cropBoxToViewBox;

  var getBoxSize = function() {
    return Math.round(boxWidth) + "x" + Math.round(boxHeight);
  };
  this.getBoxSize = getBoxSize;

  ///////////////////////////////////////////////////////////////////
  //
  // private functions
  //

  var setCropBox = function(xmin_box, ymin_box, xmax_box, ymax_box) {
    // If a value is undefined, use the original value
    if ( typeof xmin_box == "undefined") {
      xmin_box = cropBox.xmin;
    }
    if ( typeof xmax_box == "undefined") {
      xmax_box = cropBox.xmax;
    }
    if ( typeof ymin_box == "undefined") {
      ymin_box = cropBox.ymin;
    }
    if ( typeof ymax_box == "undefined") {
      ymax_box = cropBox.ymax;
    }
    // Check if the size is too small
    var isWidthTooSmall = false;
    var isHeightTooSmall = false;
    if (xmax_box - xmin_box < 40) {
      isWidthTooSmall = true;
    }
    if (ymax_box - ymin_box < 40) {
      isHeightTooSmall = true;
    }
    if (!isWidthTooSmall) {
      cropBox.xmin = xmin_box;
      cropBox.xmax = xmax_box;
      /*
       * 0 1 2
       * 7 8 3
       * 6 5 4
       */
      cropHandle[0].xmin = xmin_box - cropHandleSize;
      cropHandle[1].xmin = (xmin_box + xmax_box) / 2.0 - cropHandleHalfSize;
      cropHandle[2].xmin = xmax_box;
      cropHandle[3].xmin = xmax_box;
      cropHandle[4].xmin = xmax_box;
      cropHandle[5].xmin = cropHandle[1].xmin;
      cropHandle[6].xmin = cropHandle[0].xmin;
      cropHandle[7].xmin = cropHandle[0].xmin;
      cropHandle[8].xmin = cropHandle[1].xmin;
      for (var i = 0; i < cropHandle.length; i++) {
        cropHandle[i].xmax = cropHandle[i].xmin + cropHandleSize;
      }
    }
    if (!isHeightTooSmall) {
      cropBox.ymin = ymin_box;
      cropBox.ymax = ymax_box;
      /*
       * 0 1 2
       * 7 8 3
       * 6 5 4
       */
      cropHandle[0].ymin = ymin_box - cropHandleSize;
      cropHandle[1].ymin = cropHandle[0].ymin;
      cropHandle[2].ymin = cropHandle[0].ymin;
      cropHandle[3].ymin = (ymin_box + ymax_box) / 2.0 - cropHandleHalfSize;
      cropHandle[4].ymin = ymax_box;
      cropHandle[5].ymin = ymax_box;
      cropHandle[6].ymin = ymax_box;
      cropHandle[7].ymin = cropHandle[3].ymin;
      cropHandle[8].ymin = cropHandle[3].ymin;
      for (var i = 0; i < cropHandle.length; i++) {
        cropHandle[i].ymax = cropHandle[i].ymin + cropHandleSize;
      }
    }

    boxWidth = (xmax_box - xmin_box);
    boxHeight = (ymax_box - ymin_box);

  };

  var drawCropBox = function() {
    clearCanvas();
    ctx.beginPath();
    // Draw the mask
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.moveTo(0, 0);
    ctx.lineTo(canvasLayer.canvas.width, 0);
    ctx.lineTo(canvasLayer.canvas.width, canvasLayer.canvas.height);
    ctx.lineTo(0, canvasLayer.canvas.height);
    ctx.lineTo(0, 0);
    ctx.lineTo(cropBox.xmin, cropBox.ymin);
    ctx.lineTo(cropBox.xmin, cropBox.ymax);
    ctx.lineTo(cropBox.xmax, cropBox.ymax);
    ctx.lineTo(cropBox.xmax, cropBox.ymin);
    ctx.lineTo(cropBox.xmin, cropBox.ymin);
    ctx.lineTo(0, 0);
    ctx.fill();
    // Draw the cropping box
    ctx.strokeStyle = "rgb(0,255,0)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropBox.xmin, cropBox.ymin, cropBox.xmax - cropBox.xmin, cropBox.ymax - cropBox.ymin);
    // Draw the cropping handles
    ctx.fillStyle = "rgb(0,255,0)";
    ctx.lineWidth = 0;
    for (var i = 0; i < cropHandle.length; i++) {
      ctx.fillRect(cropHandle[i].xmin, cropHandle[i].ymin, cropHandleSize, cropHandleSize);
    }
  };

  var setAndDrawCropBox = function(xmin_box, ymin_box, xmax_box, ymax_box) {
    setCropBox(xmin_box, ymin_box, xmax_box, ymax_box);
    drawCropBox();
  };

  var clearCanvas = function() {
    ctx.clearRect(0, 0, canvasLayer.canvas.width, canvasLayer.canvas.height);
  };

  var centerCropBox = function(size) {
    var heightRatio;
    if (size == "large") {
      heightRatio = 0.35;
    } else if (size == "medium") {
      heightRatio = 0.2;
    } else if (size == "small") {
      heightRatio = 0.1;
    } else {
      heightRatio = 0.35;
    }
    var canvasHalfHeight = canvasLayer.canvas.height * heightRatio;
    var centerX = canvasLayer.canvas.width / 2.0;
    var centerY = canvasLayer.canvas.height / 2.0 - canvasLayer.canvas.height * 0.05;
    setCropBox(centerX - canvasHalfHeight, centerY - canvasHalfHeight, centerX + canvasHalfHeight, centerY + canvasHalfHeight);
  };

  var mousemoveListener = function(event) {
    boxEventHandler.mousemoveHandler(event, cropHandle, cropBox, resizeCropBox);
  };

  var mouseupListener = function(event) {
    boxEventHandler.mouseupHandler(event);
  };

  var mousedownListener = function(event) {
    boxEventHandler.mousedownHandler(event);
  };

  var addCropHandleEvents = function() {
    $dataPanesContainer.on("mousedown", mousedownListener);
    $(document).on("mouseup", mouseupListener);
    $dataPanesContainer.on("mousemove", mousemoveListener);
  };

  var removeCropHandleEvents = function() {
    $dataPanesContainer.off("mousedown", mousedownListener);
    $(document).off("mouseup", mouseupListener);
    $dataPanesContainer.off("mousemove", mousemoveListener);
  };

  var resizeCropBox = function(index, x, y) {
    if (index == 0) {
      setAndDrawCropBox(x, y, undefined, undefined);
    } else if (index == 1) {
      setAndDrawCropBox(undefined, y, undefined, undefined);
    } else if (index == 2) {
      setAndDrawCropBox(undefined, y, x, undefined);
    } else if (index == 3) {
      setAndDrawCropBox(undefined, undefined, x, undefined);
    } else if (index == 4) {
      setAndDrawCropBox(undefined, undefined, x, y);
    } else if (index == 5) {
      setAndDrawCropBox(undefined, undefined, undefined, y);
    } else if (index == 6) {
      setAndDrawCropBox(x, undefined, undefined, y);
    } else if (index == 7) {
      setAndDrawCropBox(x, undefined, undefined, undefined);
    } else if (index == 8) {
      var offsetX = (cropBox.xmin + cropBox.xmax) / 2 - x;
      var offsetY = (cropBox.ymin + cropBox.ymax) / 2 - y;
      setAndDrawCropBox(cropBox.xmin - offsetX, cropBox.ymin - offsetY, cropBox.xmax - offsetX, cropBox.ymax - offsetY);
    }
  };

  ///////////////////////////////////////////////////////////////////
  //
  // Constructor code
  //

  // Create a canvas layer for drawing the cropping box and handles
  canvasLayer = new TimeMachineCanvasLayer({
    timelapse: timelapse,
    animate: false,
    id: "thumbnailTool",
    resizeHandler: function() {
      centerCropBox("medium");
      if (!isCropBoxHidden) {
        drawCropBox();
      }
    }
  });
  ctx = canvasLayer.canvas.getContext('2d');

  // Initialize cropping box and handles
  cropBox = {
    xmin: undefined,
    ymin: undefined,
    xmax: undefined,
    ymax: undefined
  };
  for (var i = 0; i < 9; i++) {
    cropHandle[i] = {
      xmin: undefined,
      ymin: undefined,
      xmax: undefined,
      ymax: undefined
    };
  }
  centerCropBox("medium");
};