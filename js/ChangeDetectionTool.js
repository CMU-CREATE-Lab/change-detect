var ChangeDetectionTool = function(timelapse, thumbnailTool, options) {
  ///////////////////////////////////////////////////////////////////
  //
  // variables
  //

  // Variables for the change detection chart
  var $viewerDiv = $(timelapse.getViewerDiv());
  var $chartContainer;
  var googleChart;
  var xhr = null;
  var requestMade = false;

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
    var viewportHeight = timelapse.getViewportHeight();
    $chartContainer.css({
      "position": "absolute",
      "top": (viewportHeight - 2) + "px",
      "left": "1px",
      "right": "1px",
      "bottom": "",
      "width": "auto",
      "height": ""
    });
  };
  this.resizeUI = resizeUI;

  ///////////////////////////////////////////////////////////////////
  //
  // private functions
  //

  var filter = function() {
    if ($chartContainer.hasClass("empty-chart")) {
      $chartContainer.removeClass("empty-chart");
    }
    if (!$chartContainer.hasClass("ajax-loader")) {
      $chartContainer.addClass("ajax-loader");
    }
    if ( typeof googleChart != "undefined") {
      googleChart.clearChart();
    }
    var config = {
      host: 'http://timemachine-api.cmucreatelab.org/thumbnail'
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
          callback(xhr.responseText);
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

  var hideFilterBound = function() {
    if (!isFilterBoundHidden) {
      isFilterBoundHidden = true;
      clearCanvas();
      removeFilterHandleEvents();
    }
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
    filter();
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

  var drawResults = function(response) {
    var data = [];
    data.push(['x', 'results']);
    for (var i = 0; i < response.length; i++) {
      var date = new Date(timelapse.getCaptureTimes()[i]);
      data.push([date, response[i]]);
    }
    googleChart = new google.visualization.LineChart($chartContainer[0]);
    var options = {
      hAxis: {
        gridlines: {
          count: 12
        }
      },
      vAxis: {
        textPosition: 'none',
        title: 'Amount of Change',
        minValue: 0,
        viewWindow: {
          min: 0
        }
      },
      chartArea: {
        left: 40,
        top: 0,
        width: "100%",
        height: "80%"
      },
      legend: 'none',
      curveType: 'function',
      'tooltip': {
        trigger: 'none'
      }
    };
    data = google.visualization.arrayToDataTable(data);
    googleChart.draw(data, options);
    googleChart.setSelection([{
      column: 1,
      row: timelapse.getCurrentFrameNumber()
    }]);

    google.visualization.events.addListener(googleChart, 'select', function() {
      var selection = googleChart.getSelection()[0];
      if ( typeof selection != "undefined") {
        var frame = selection.row;
        timelapse.seekToFrame(frame);
        timelapse.setPlaybackRate(0.50, true, false);
      }
    });

    timelapse.addTimeChangeListener(function() {
      googleChart.setSelection([{
        column: 1,
        row: timelapse.getCurrentFrameNumber()
      }]);
    });
  };

  ///////////////////////////////////////////////////////////////////
  //
  // Constructor code
  //

  // Create a chart div at the bottom of time machine viewer
  $chartContainer = $("<div class='change-detection-chart empty-chart'></div>");
  $chartContainer.hide();
  $viewerDiv.append($chartContainer);
  resizeUI();

  // Create a canvas layer for drawing the current marked area for change detection
  canvasLayer = new TimeMachineCanvasLayer({
    timelapse: timelapse,
    animate: false,
    updateHandler: function() {
      if ( typeof filterBound.xmin != "undefined" && !isFilterBoundHidden) {
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