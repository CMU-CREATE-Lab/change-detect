/**
 * @license
 * Redistribution and use in source and binary forms ...
 *
 * Dependencies:
 *  org.gigapan.timelapse.Timelapse
 *  jQuery (http://jquery.com/)
 *
 * Copyright 2011 Carnegie Mellon University. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are
 * permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this list of
 *    conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list
 *    of conditions and the following disclaimer in the documentation and/or other materials
 *    provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY ''AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL CARNEGIE MELLON UNIVERSITY OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * The views and conclusions contained in the software and documentation are those of the
 * authors and should not be interpreted as representing official policies, either expressed
 * or implied, of Carnegie Mellon University.
 *
 * Authors:
 *  Paul Dille (pdille@andrew.cmu.edu)
 *  Yen-Chia Hsu (legenddolphin@gmail.com)
 *  Gabriel O'Donnell (gabrielo@cmu.edu)
 *
 */

"use strict";

var ChangeDetectionTool = function(timelapse, thumbnailTool, options) {
  ///////////////////////////////////////////////////////////////////
  //
  // variables
  //

  // Variables for the change detection chart
  var timeMachineDivId = timelapse.getTimeMachineDivId();
  var $viewerDiv = $(timelapse.getViewerDiv());
  var $chartContainer;
  var $chartContainerContent;
  var xhr = null;
  var requestMade = false;
  var data = [];
  var chart;

  // Variables for drawing the current marked area for change detection
  var canvasLayer;
  var ctx;
  var filterBound = {};
  var isFilterBoundHidden = true;
  var filterHandle = [];
  var filterHandleSize = 8;
  var filterHandleHalfSize = filterHandleSize / 2.0;
  var boxEventHandler = new BoxEventHandler(timelapse);
  var $dataPanesContainer = $("#" + timelapse.getDataPanesContainerId());


  ///////////////////////////////////////////////////////////////////
  //
  // public functions
  //

  var centerAndDrawFilterBound = function(size) {
    centerFilterBound(size);
    drawFilterBound();
  };
  this.centerAndDrawFilterBound = centerAndDrawFilterBound;

  var disable = function() {
    hideFilterBound();
    $chartContainer.hide();
  };
  this.disable = disable;

  var enable = function() {
    showFilterBound();
    $chartContainer.show();
  };
  this.enable = enable;

  var resizeUI = function() {
  };
  this.resizeUI = resizeUI;

  var filter = function() {
    if ($chartContainer.hasClass("empty-chart")) {
      $chartContainer.removeClass("empty-chart");
    }
    if (!$chartContainer.hasClass("ajax-loader")) {
      $chartContainer.addClass("ajax-loader");
    }
    if (typeof $chartContainerContent != "undefined") {
      $chartContainerContent.hide();
    }
    var config = {
      host: 'http://thumbnails.cmucreatelab.org/thumbnail'
    };
    var args = {
      root: timelapse.getSettings().url,
      boundsLTRB: filterBound.xmin + "," + filterBound.ymin + "," + filterBound.xmax + "," + filterBound.ymax,
      width: filterBound.xmax - filterBound.xmin,
      height: filterBound.ymax - filterBound.ymin,
      nframes: timelapse.getDatasetJSON().frames,
      filter: "difference-filter",
      format: "rgb24",
      tileFormat: timelapse.getMediaType().slice(1)
    };

    var t = new ThumbnailServiceAPI(config, args);
    if (requestMade) {
      xhr.abort();
    }
    requestMade = true;

    if (window.XDomainRequest) {
      xhr = new XDomainRequest();
      xhr.onload = function() {
        if (xhr.responseText != "") {
          requestMade = false;
          // Transmission completed
          var o = JSON.parse(xhr.responseText);
          drawResults(o.values);
          if ($chartContainer.hasClass("ajax-loader")) {
            $chartContainer.removeClass("ajax-loader");
          }
        }
      };
    } else if (window.XMLHttpRequest) {
      xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          requestMade = false;
          if (xhr.response != "") {
            // Transmission completed
            var o = JSON.parse(xhr.response);
            drawResults(o.values);
            if ($chartContainer.hasClass("ajax-loader")) {
              $chartContainer.removeClass("ajax-loader");
            }
          }
        }
      };
    }
    xhr.open('GET', t.serialize(), true);
    xhr.send();
  };
  this.filter = filter;

  var drawResults = function(response) {
    data = [];
    for (var i = 0; i < response.length; i++) {
      // If a date string has dashes (i.e. 2015-04-09 08:52:35), replace with slashes since IE/FireFox Date parser does not support this.
      var date = new Date(timelapse.getCaptureTimes()[i].replace(/-/g, "/"));
      data.push({x: date, y: response[i], frame: i});
    }
    if (!chart) {
      chart = new CanvasJS.Chart("change-detection-container", {
        zoomEnabled: true,
        axisX: {
          title: "Time",
          valueFormatString: "hh:mm:ss TT"
        },
        axisY: {
          title: "Amount of Change"
        },
        toolTip: {
          animationEnabled: false,
          content: "{x}"
        }
      });
      $chartContainerContent = $("#" + timelapse.getViewerDivId() + " .change-detection-chart .canvasjs-chart-container");
      timelapse.addTimeChangeListener(timeChangeListener);
    }
    chart.options.data = [
      {
        type: "line",
        cursor: "pointer",
        click: function(e) {
          timelapse.seekToFrame(e.dataPoint.frame);
        },
        dataPoints: data
      }
    ];
    timeChangeListener();
    $chartContainerContent.show();
    chart.render();
  };
  this.drawResults = drawResults;

  var hideFilterBound = function() {
    if (!isFilterBoundHidden) {
      isFilterBoundHidden = true;
      clearCanvas();
      removeFilterHandleEvents();
    }
  };
  this.hideFilterBound = hideFilterBound;

  ///////////////////////////////////////////////////////////////////
  //
  // private functions
  //
  var timeChangeListener = function() {
    var currentFrame = timelapse.getCurrentFrameNumber();
    var currentTimeHighlight = new Date(timelapse.getCaptureTimes()[currentFrame]);
    chart.options.data[1] = {
      type: "line",
      cursor: "pointer",
      markerType: "circle",
      markerSize: 12,
      markerBorderColor: "#fff",
      markerBorderThickness: 2,
      dataPoints: [{x: currentTimeHighlight, y: data[currentFrame].y}]
    }
    chart.render();
  };

  var showFilterBound = function() {
    if (isFilterBoundHidden) {
      isFilterBoundHidden = false;
      if ($chartContainer.hasClass("empty-chart")) {
        centerFilterBound("large");
      }
      drawFilterBound();
      addFilterHandleEvents();
    }
  };

  var getHandleBox = function(index) {
    var cv = timelapse.getBoundingBoxForCurrentView();
    /*
     * 0 1 2
     * 7 8 3
     * 6 5 4
     */
    var xmin = scale(filterHandle[index].xmin, cv.xmin, cv.xmax, 0, canvasLayer.canvas.width);
    var ymin = scale(filterHandle[index].ymin, cv.ymin, cv.ymax, 0, canvasLayer.canvas.height);
    if (index == 0) {
      xmin -= filterHandleSize;
      ymin -= filterHandleSize;
    } else if (index == 1) {
      xmin -= filterHandleHalfSize;
      ymin -= filterHandleSize;
    } else if (index == 2) {
      ymin -= filterHandleSize;
    } else if (index == 3) {
      ymin -= filterHandleHalfSize;
    } else if (index == 5) {
      xmin -= filterHandleHalfSize;
    } else if (index == 6) {
      xmin -= filterHandleSize;
    } else if (index == 7) {
      xmin -= filterHandleSize;
      ymin -= filterHandleHalfSize;
    } else if (index == 8) {
      xmin -= filterHandleHalfSize;
      ymin -= filterHandleHalfSize;
    }
    return {
      xmin: xmin,
      ymin: ymin,
      xmax: xmin + filterHandleSize,
      ymax: ymin + filterHandleSize
    };
  };

  var getFilterBox = function() {
    var cv = timelapse.getBoundingBoxForCurrentView();
    var v = timelapse.getView();
    var xmin = scale(filterBound.xmin, cv.xmin, cv.xmax, 0, canvasLayer.canvas.width);
    var ymin = scale(filterBound.ymin, cv.ymin, cv.ymax, 0, canvasLayer.canvas.height);
    var width = (filterBound.xmax - filterBound.xmin) * v.scale;
    var height = (filterBound.ymax - filterBound.ymin) * v.scale;
    return {
      xmin: xmin,
      ymin: ymin,
      xmax: xmin + width,
      ymax: ymin + height,
      width: width,
      height: height
    };
  };

  var setFilterBound = function(bound) {
    filterBound = bound;
    /*
     * 0 1 2
     * 7 8 3
     * 6 5 4
     */
    filterHandle[0].xmin = bound.xmin;
    filterHandle[0].ymin = bound.ymin;
    filterHandle[1].xmin = bound.xmin + (bound.xmax - bound.xmin) / 2.0;
    filterHandle[1].ymin = bound.ymin;
    filterHandle[2].xmin = bound.xmax;
    filterHandle[2].ymin = bound.ymin;
    filterHandle[3].xmin = bound.xmax;
    filterHandle[3].ymin = bound.ymin + (bound.ymax - bound.ymin) / 2.0;
    filterHandle[4].xmin = bound.xmax;
    filterHandle[4].ymin = bound.ymax;
    filterHandle[5].xmin = bound.xmin + (bound.xmax - bound.xmin) / 2.0;
    filterHandle[5].ymin = bound.ymax;
    filterHandle[6].xmin = bound.xmin;
    filterHandle[6].ymin = bound.ymax;
    filterHandle[7].xmin = bound.xmin;
    filterHandle[7].ymin = bound.ymin + (bound.ymax - bound.ymin) / 2.0;
    filterHandle[8].xmin = bound.xmin + (bound.xmax - bound.xmin) / 2.0;
    filterHandle[8].ymin = bound.ymin + (bound.ymax - bound.ymin) / 2.0;
  };

  var clearCanvas = function() {
    ctx.clearRect(0, 0, canvasLayer.canvas.width, canvasLayer.canvas.height);
  };

  var centerFilterBound = function(size) {
    var scaleConstant;
    if (size == "large") {
      scaleConstant = 60;
    } else if (size == "medium") {
      scaleConstant = 40;
    } else if (size == "small") {
      scaleConstant = 20;
    } else {
      scaleConstant = 60;
    }
    var view = timelapse.getView();
    var scaleOffsetX = scaleConstant / view.scale;
    var scaleOffsetY = scaleConstant / view.scale;
    var bound = {
      xmin: view.x - scaleOffsetX,
      xmax: view.x + scaleOffsetX,
      ymin: view.y - scaleOffsetY,
      ymax: view.y + scaleOffsetY
    };
    setFilterBound(bound);
  };

  var resizeFilterBound = function(index, x, y) {
    var bounds = timelapse.getBoundingBoxForCurrentView();
    x = scale(x, 0, canvasLayer.canvas.width, bounds.xmin, bounds.xmax);
    y = scale(y, 0, canvasLayer.canvas.height, bounds.ymin, bounds.ymax);
    var newBound = filterBound;
    switch (index) {
      case 0:
        newBound.xmin = x;
        newBound.ymin = y;
        break;
      case 1:
        newBound.ymin = y;
        break;
      case 2:
        newBound.ymin = y;
        newBound.xmax = x;
        break;
      case 3:
        newBound.xmax = x;
        break;
      case 4:
        newBound.xmax = x;
        newBound.ymax = y;
        break;
      case 5:
        newBound.ymax = y;
        break;
      case 6:
        newBound.xmin = x;
        newBound.ymax = y;
        break;
      case 7:
        newBound.xmin = x;
        break;
      case 8:
        var offsetX = (filterBound.xmin + filterBound.xmax) / 2 - x;
        var offsetY = (filterBound.ymin + filterBound.ymax) / 2 - y;
        newBound.xmin -= offsetX;
        newBound.ymin -= offsetY;
        newBound.xmax -= offsetX;
        newBound.ymax -= offsetY;
        break;
    }
    setFilterBound(newBound);
    drawFilterBound();
  };

  var scale = function(val, omin, omax, nmin, nmax) {
    return (((val - omin) * (nmax - nmin)) / (omax - omin) + nmin);
  };

  var mousemoveListener = function(event) {
    var filterHandleBox = [];
    for (var i = 0; i < filterHandle.length; i++) {
      filterHandleBox[i] = getHandleBox(i);
    }
    var filterBox = getFilterBox();
    boxEventHandler.mousemoveHandler(event, filterHandleBox, filterBox, resizeFilterBound);
  };

  var mouseupListener = function(event) {
    boxEventHandler.mouseupHandler(event);
  };

  var mousedownListener = function(event) {
    boxEventHandler.mousedownHandler(event);
  };

  var addFilterHandleEvents = function() {
    $dataPanesContainer.on("mousedown", mousedownListener);
    $(document).on("mouseup", mouseupListener);
    $dataPanesContainer.on("mousemove", mousemoveListener);
  };

  var removeFilterHandleEvents = function() {
    $dataPanesContainer.off("mousedown", mousedownListener);
    $(document).off("mouseup", mouseupListener);
    $dataPanesContainer.off("mousemove", mousemoveListener);
  };

  var drawFilterBound = function() {
    var filterBox = getFilterBox();
    ctx.clearRect(0, 0, canvasLayer.canvas.width, canvasLayer.canvas.height);
    ctx.strokeStyle = "rgb(255,0,0)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.strokeRect(filterBox.xmin, filterBox.ymin, filterBox.width, filterBox.height);
    ctx.fillStyle = "rgb(255,0,0)";
    ctx.lineWidth = 0;
    for (var i = 0; i < filterHandle.length; i++) {
      var box = getHandleBox(i);
      ctx.fillRect(box.xmin, box.ymin, filterHandleSize, filterHandleSize);
    }
  };

  ///////////////////////////////////////////////////////////////////
  //
  // Constructor code
  //

  // Create a chart div at the bottom of time machine viewer
  $chartContainer = $("<div id='change-detection-container' class='change-detection-chart empty-chart'></div>");
  $chartContainer.hide();
  $("#" + timeMachineDivId).append($chartContainer);
  resizeUI();

  // Create a canvas layer for drawing the current marked area for change detection
  canvasLayer = new TimeMachineCanvasLayer({
    timelapse: timelapse,
    animate: false,
    updateHandler: function() {
      if (typeof filterBound.xmin != "undefined" && !isFilterBoundHidden) {
        drawFilterBound();
      }
    },
    id: "changeDetection"
  });
  ctx = canvasLayer.canvas.getContext('2d');

  // Initialize the filter bound on time machine viewer
  filterBound = {
    xmin: undefined,
    ymin: undefined,
    xmax: undefined,
    ymax: undefined
  };
  for (var i = 0; i < 9; i++) {
    filterHandle[i] = {
      xmin: undefined,
      ymin: undefined,
      xmax: undefined,
      ymax: undefined
    };
  }
};