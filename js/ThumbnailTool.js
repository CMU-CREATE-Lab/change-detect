"use strict";

var ThumbnailTool = function (timelapse, options) {
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
  var aspectRatio;

  var DEFAULT_BOX_PADDING = {
    top: 100,
    bottom: 150,
    left: 150,
    right: 150
  };
  var MIN_BOX_SIZE = {
    width: 50,
    height: 50
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Private methods
  //

  // Safely get the value from a variable, return a default value if undefined
  function safeGet(v, default_val) {
    if (typeof default_val === "undefined") default_val = "";
    return (typeof v === "undefined") ? default_val : v;
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Privileged methods
  //

  var resizeCanvas = function () {
    canvasLayer.resize_();
  };
  this.resizeCanvas = resizeCanvas;

  var showCropBox = function () {
    if (isCropBoxHidden) {
      canvasLayer.resize_();
      isCropBoxHidden = false;
      if (typeof cropBox.xmin === "undefined") {
        centerCropBox();
      } else {
        setCropBox();
      }
      drawCropBox();
      addCropHandleEvents();
    }
  };
  this.showCropBox = showCropBox;

  var hideCropBox = function () {
    if (!isCropBoxHidden) {
      isCropBoxHidden = true;
      clearCanvas();
      removeCropHandleEvents();
      clearAspectRatio();
    }
  };
  this.hideCropBox = hideCropBox;

  var centerAndDrawCropBox = function () {
    prevBoxWidth = null;
    prevBoxHeight = null;
    centerCropBox();
    drawCropBox();
  };
  this.centerAndDrawCropBox = centerAndDrawCropBox;

  var redrawCropBox = function () {
    prevBoxWidth = null;
    prevBoxHeight = null;
    setCropBox();
    drawCropBox();
  };
  this.redrawCropBox = redrawCropBox;

  var forceAspectRatio = function (w, h) {
    aspectRatio = (parseFloat(w) / parseFloat(h)).toFixed(6);
  };
  this.forceAspectRatio = forceAspectRatio;

  var swapBoxWidthHeight = function () {
    var rotatedBox = getRotatedBox();
    var r_tmp = aspectRatio;
    if (typeof r_tmp !== "undefined") clearAspectRatio();
    setAndDrawCropBox(rotatedBox.xmin, rotatedBox.ymin, rotatedBox.xmax, rotatedBox.ymax);
    if (typeof r_tmp !== "undefined") aspectRatio = (1 / r_tmp).toFixed(6);
  };
  this.swapBoxWidthHeight = swapBoxWidthHeight;

  // Rotate the box 90 degrees, equal to swapping the height and width
  var getRotatedBox = function (box) {
    box = safeGet(box, cropBox);
    var center = getBoxCenter(box);
    var w_half = Math.abs((box.xmax - box.xmin) / 2.0);
    var h_half = Math.abs((box.ymax - box.ymin) / 2.0);
    return {
      xmin: Math.round(center.x - h_half),
      ymin: Math.round(center.y - w_half),
      xmax: Math.round(center.x + h_half),
      ymax: Math.round(center.y + w_half)
    };
  };
  this.getRotatedBox = getRotatedBox;

  // Get the center position of the box
  var getBoxCenter = function (box) {
    box = safeGet(box, cropBox);
    return {
      x: (box.xmax + box.xmin) / 2.0,
      y: (box.ymax + box.ymin) / 2.0
    };
  };
  this.getBoxCenter = getBoxCenter;

  var clearAspectRatio = function (r) {
    aspectRatio = undefined;
  };
  this.clearAspectRatio = clearAspectRatio;

  // This is a wrapper function of getURL()
  // This function converts a share view url into settings, and pass these settings to getURL()
  // This return format of this function is the same as getURL()
  // This function is used for the story editor to get thumbnail urls from the saved share view url
  // If you modify this function, you need to make sure that the story editor still works
  var getUrlFromShareView = function (settings) {
    settings = safeGet(settings, {});
    if (typeof settings["shareView"] === "undefined" || settings["shareView"].trim() == "") return;
    var shareViewHashParams = UTIL.unpackVars(settings["shareView"]);
    if (typeof shareViewHashParams["v"] === "undefined") return;
    var bt = shareViewHashParams["bt"];
    var et = shareViewHashParams["et"];
    var ps = (bt == et) ? 0 : shareViewHashParams["ps"];
    var format = (bt == et) ? "png" : "mp4";
    format = safeGet(settings["format"], format);

    // Get urls from the getURL() function
    var args = {
      bound: timelapse.unsafeViewToView(shareViewHashParams["v"])["bbox"],
      width: settings["width"],
      height: settings["height"],
      l: shareViewHashParams["l"],
      ps: parseInt(ps),
      bt: bt,
      et: et,
      format: format,
      embedTime: false,
      startDwell: parseFloat(shareViewHashParams["startDwell"]),
      endDwell: parseFloat(shareViewHashParams["endDwell"]),
      fps: parseInt(shareViewHashParams["fps"]),
      swapWidthHeight: settings["swapWidthHeight"]
    };
    var url = getURL(args);
    for (var key in url["args"]) {
      args[key] = url["args"][key];
    }

    return {
      url: url["url"],
      args: args
    };
  };
  this.getUrlFromShareView = getUrlFromShareView;

  var getURL = function (settings) {
    settings = safeGet(settings, {});
    var isEarthTime = typeof(EARTH_TIMELAPSE_CONFIG) !== "undefined";

    var width = safeGet(settings["width"], cropBox.xmax - cropBox.xmin);
    var height = safeGet(settings["height"], cropBox.ymax - cropBox.ymin);
    var bound = safeGet(settings["bound"], cropBoxToViewBox());

    // Swap the width and height if necessary
    var swapWidthHeight = safeGet(settings["swapWidthHeight"], false);
    if (swapWidthHeight) {
      bound = getRotatedBox(bound);
      var tmp = width;
      width = height;
      height = tmp;
    }

    var config = {
      host: isEarthTime ? "https://thumbnails-earthtime.cmucreatelab.org/thumbnail" : "https://thumbnails-v2.createlab.org/thumbnail"
    };
    var startFrame = (typeof settings["startTime"] !== "undefined") ? settings["startTime"] * timelapse.getFps() : settings["startFrame"] || 0

    var boundsString = bound.xmin + "," + bound.ymin + "," + bound.xmax + "," + bound.ymax;
    var desiredView = boundsString + ",pts";

    var startDwell = safeGet(settings["startDwell"], 0);
    var endDwell = safeGet(settings["endDwell"], 0);
    var fps = safeGet(settings["fps"], timelapse.getFps());
    var ps = safeGet(settings["ps"], timelapse.getPlaybackRate() * 100);
    var bt = settings["bt"];
    var et = settings["et"];
    var format = safeGet(settings["format"], "png");
    if (format == "png" || bt == et) ps = 0;

    var shareViewOptions = {};
    shareViewOptions.bt = bt;
    shareViewOptions.et = et;
    shareViewOptions.ps = ps;
    shareViewOptions.l = settings['l'];
    shareViewOptions.forThumbnail = true;

    var startTime = timelapse.frameNumberToTime(startFrame);

    var shareLink = (typeof settings['shareView'] !== "undefined") ? "#" + settings['shareView'] : timelapse.getShareView(startTime, desiredView, shareViewOptions);
    var rootUrl = isEarthTime ? "https://headless.earthtime.org/" + shareLink : timelapse.getSettings().url;

    // This is used for the story editor to load the dwell time from the saved share view in the Google Sheet
    // Ultimately, we want to implement this feature in the time machine viewer
    rootUrl += "&startDwell=" + startDwell + "&endDwell=" + endDwell + "&fps=" + fps;

    var args = {
      root: rootUrl,
      width: width,
      height: height,
      startFrame: startFrame,
      format: format,
      fps: fps,
      tileFormat: timelapse.getMediaType().slice(1),
      startDwell: startDwell,
      endDwell: endDwell,
      ps: ps
    };

    if (isEarthTime) {
      args.fromScreenshot = "";
    } else {
      args.boundsLTRB = boundsString;
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

  var cropBoxToViewBox = function () {
    var topLeftPt = timelapse.convertViewportToTimeMachine({
      x: cropBox.xmin,
      y: cropBox.ymin
    });
    var bottomRightPt = timelapse.convertViewportToTimeMachine({
      x: cropBox.xmax,
      y: cropBox.ymax
    });
    return {
      xmin: Math.round(topLeftPt.x),
      ymin: Math.round(topLeftPt.y),
      xmax: Math.round(bottomRightPt.x),
      ymax: Math.round(bottomRightPt.y)
    };
  };
  this.cropBoxToViewBox = cropBoxToViewBox;

  var getBoxSize = function () {
    return Math.round(boxWidth) + "x" + Math.round(boxHeight);
  };
  this.getBoxSize = getBoxSize;

  var addCropHandleEvents = function () {
    $dataPanesContainer.on("mousedown", mousedownListener);
    $(document).on("mouseup", mouseupListener);
    $dataPanesContainer.on("mousemove", mousemoveListener);
  };
  this.addCropHandleEvents = addCropHandleEvents;

  var removeCropHandleEvents = function () {
    $dataPanesContainer.off("mousedown", mousedownListener);
    $(document).off("mouseup", mouseupListener);
    $dataPanesContainer.off("mousemove", mousemoveListener);
  };
  this.removeCropHandleEvents = removeCropHandleEvents;

  ///////////////////////////////////////////////////////////////////
  //
  // private functions
  //

  var setCropBox = function (xmin_box, ymin_box, xmax_box, ymax_box) {
    var xmin_box_was_defined = (typeof xmin_box !== "undefined");
    var xmax_box_was_defined = (typeof xmax_box !== "undefined");
    var ymin_box_was_defined = (typeof ymin_box !== "undefined");
    var ymax_box_was_defined = (typeof ymax_box !== "undefined");
    var min_box_width = MIN_BOX_SIZE.width;
    var min_box_height = MIN_BOX_SIZE.height;

    // If a value is undefined, use the original value
    if (typeof xmin_box === "undefined") {
      xmin_box = cropBox.xmin;
    }
    if (typeof xmax_box === "undefined") {
      xmax_box = cropBox.xmax;
    }
    if (typeof ymin_box === "undefined") {
      ymin_box = cropBox.ymin;
    }
    if (typeof ymax_box === "undefined") {
      ymax_box = cropBox.ymax;
    }

    boxWidth = (xmax_box - xmin_box);
    boxHeight = (ymax_box - ymin_box);

    if (aspectRatio) {
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
    }

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

  var drawCropBox = function () {
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

  var setAndDrawCropBox = function (xmin_box, ymin_box, xmax_box, ymax_box) {
    setCropBox(xmin_box, ymin_box, xmax_box, ymax_box);
    drawCropBox();
  };

  var clearCanvas = function () {
    ctx.clearRect(0, 0, canvasLayer.canvas.width, canvasLayer.canvas.height);
  };

  var centerCropBox = function () {
    var t = cropHandleSize + DEFAULT_BOX_PADDING.top;
    var b = cropHandleSize + DEFAULT_BOX_PADDING.bottom;
    var l = cropHandleSize + DEFAULT_BOX_PADDING.left;
    var r = cropHandleSize + DEFAULT_BOX_PADDING.right;
    setCropBox(l, t, canvasLayer.canvas.width - r, canvasLayer.canvas.height - b);
  };

  var mousemoveListener = function (event) {
    boxEventHandler.mousemoveHandler(event, cropHandle, cropBox, resizeCropBox);
  };

  var mouseupListener = function (event) {
    boxEventHandler.mouseupHandler(event);
  };

  var mousedownListener = function (event) {
    boxEventHandler.mousedownHandler(event);
  };

  var resizeCropBox = function (index, x, y) {
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

  // Check options
  options = safeGet(options, {});
  var canvasZindex = safeGet(options["paneZindex"], 10);
  var canvasId = safeGet(options["id"], "thumbnailTool");

  // Create a canvas layer for drawing the cropping box and handles
  canvasLayer = new TimeMachineCanvasLayer({
    timelapse: timelapse,
    animate: false,
    id: canvasId,
    paneZindex: canvasZindex,
    resizeHandler: function () {
      if (!isCropBoxHidden) {
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
