"use strict";

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

  var prevBoxWidth;
  var prevBoxHeight;

  var UTIL = org.gigapan.Util;

  ///////////////////////////////////////////////////////////////////
  //
  // public functions
  //

  var showCropBox = function() {
    if (isCropBoxHidden) {
      isCropBoxHidden = false;
      if (typeof(cropBox.xmin) == "undefined") {
        centerCropBox();
      } else {
        setCropBox();
      }
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

  var centerAndDrawCropBox = function() {
    showCropBox();
    centerCropBox();
    drawCropBox();
  };
  this.centerAndDrawCropBox = centerAndDrawCropBox;

  var redrawCropBox = function() {
    prevBoxWidth = null;
    prevBoxHeight = null;
    showCropBox();
    setCropBox();
    drawCropBox();
  }
  this.redrawCropBox = redrawCropBox;

  var getURL = function(settings) {
    var isEarthTime = typeof(EARTH_TIMELAPSE_CONFIG) !== "undefined";

    var bound = ( typeof (settings["bound"]) == "undefined") ? cropBoxToViewBox() : settings["bound"];
    var config = {
      host: isEarthTime ? "https://thumbnails-earthtime.cmucreatelab.org/thumbnail" : "https://thumbnails-v2.createlab.org/thumbnail"
    };
    var startFrame = settings["startTime"] ? settings["startTime"] * timelapse.getFps() : settings["startFrame"] || 0

    var boundsString = bound.xmin + "," + bound.ymin + "," + bound.xmax + "," + bound.ymax;
    var desiredView = boundsString + ",pts";

    var shareViewOptions = {};
    shareViewOptions.bt = settings['bt'];
    shareViewOptions.et = settings['et'];
    shareViewOptions.ps = settings['ps'];
    shareViewOptions.l = settings['l'];
    shareViewOptions.forThumbnail = true;

    var shareLink = settings['shareView'] ? "#" + settings['shareView'] : timelapse.getShareView(startTime, desiredView, shareViewOptions);
    var rootUrl = isEarthTime ? "https://headless.earthtime.org/" + encodeURIComponent(shareLink) : timelapse.getSettings().url;

    var startTime = timelapse.frameNumberToTime(startFrame);
    var args = {
      root: rootUrl,
      width: (typeof(settings["width"]) == "undefined") ? cropBox.xmax - cropBox.xmin : settings["width"],
      height: (typeof(settings["height"]) == "undefined") ? cropBox.ymax - cropBox.ymin : settings["height"],
      startFrame: startFrame,
      format: (typeof(settings["format"]) == "undefined") ? "png" : settings["format"],
      fps: (typeof(settings["fps"]) == "undefined") ? timelapse.getFps() : settings["fps"],
      tileFormat: timelapse.getMediaType().slice(1),
      startDwell: settings["startDwell"] || 0,
      endDwell: settings["endDwell"] || 0
    };

    if (!settings['shareView']) {
      args.boundsLTRB = boundsString;
    }

    if (isEarthTime) {
      args.fromScreenshot = "";
    }

    if (settings.smoothPlayback) {
      args.interpolateBetweenFrames = "";
    }

    if (settings.embedTime) {
      if (isEarthTime) {
        args.minimalUI = "";
      } else {
        args.labelsFromDataset = "";
      }
    }

    if (settings.baseMapsNoLabels) {
      args.baseMapsNoLabels = "";
    }

    if (typeof (settings["endTime"]) != "undefined") {
      args.nframes = parseInt((settings["endTime"] - args.frameTime) * timelapse.getFps() + 1);
    } else if (typeof (settings["nframes"]) != "undefined") {
      args.nframes = parseInt(settings["nframes"]);
    } else {
      args.nframes = 10;
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
    var xmin_box_was_defined = typeof(xmin_box) != "undefined";
    var xmax_box_was_defined = typeof(xmax_box) != "undefined";
    var ymin_box_was_defined = typeof(ymin_box) != "undefined";
    var ymax_box_was_defined = typeof(ymax_box) != "undefined";
    var min_box_width = 10;
    var min_box_height = 10;

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

    boxWidth = (xmax_box - xmin_box);
    boxHeight = (ymax_box - ymin_box);

    var aspectRatio = parseFloat((parseInt($("#thumbnail-width").val()) / parseInt($("#thumbnail-height").val())).toFixed(2));
    if (!aspectRatio) return;

    var boxHeightDiff = (boxWidth / aspectRatio) - boxHeight;
    var boxWidthDiff = (boxHeight * aspectRatio) - boxWidth;

    if (xmax_box_was_defined && ymax_box_was_defined && prevBoxHeight != null) {
      xmax_box += boxWidthDiff / 2;
      ymax_box += boxHeightDiff / 2;
    } else if (xmin_box_was_defined && ymin_box_was_defined && prevBoxHeight != null) {
      xmin_box -= boxWidthDiff / 2;
      ymin_box -= boxHeightDiff / 2;
    } else if (xmin_box_was_defined && ymax_box_was_defined && prevBoxHeight != null) {
      xmin_box -= boxWidthDiff / 2;
      ymax_box += boxHeightDiff / 2;
    } else if (xmax_box_was_defined && ymin_box_was_defined && prevBoxHeight != null) {
      xmax_box += boxWidthDiff / 2;
      ymin_box -= boxHeightDiff / 2;
    } else if (boxWidth != prevBoxWidth) {
      ymax_box += boxHeightDiff / 2;
      ymin_box -= boxHeightDiff / 2;
    } else if (boxHeight != prevBoxHeight) {
      xmax_box += boxWidthDiff / 2;
      xmin_box -= boxWidthDiff / 2;
    }

    boxWidth = (xmax_box - xmin_box);
    boxHeight = (ymax_box - ymin_box);

    if (boxWidth < min_box_width || boxHeight < min_box_height) {
      return;
    }

    prevBoxWidth = boxWidth;
    prevBoxHeight = boxHeight;

    // Check if the size is too small
    var isWidthTooSmall = false;
    var isHeightTooSmall = false;
    if (xmax_box - xmin_box < min_box_width) {
      isWidthTooSmall = true;
    }
    if (ymax_box - ymin_box < min_box_height) {
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
      // Set box height
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

  var centerCropBox = function() {
    var cropHandleSizeAndExtraPadding = cropHandleSize + 4;
    setCropBox(cropHandleSizeAndExtraPadding, cropHandleSizeAndExtraPadding, canvasLayer.canvas.width - cropHandleSizeAndExtraPadding, canvasLayer.canvas.height - cropHandleSizeAndExtraPadding);
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
      if (!isCropBoxHidden) {
        prevBoxWidth = null;
        prevBoxHeight = null;
        centerAndDrawCropBox();
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
};
