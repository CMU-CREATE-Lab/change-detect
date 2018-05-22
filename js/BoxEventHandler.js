"use strict";

var BoxEventHandler = function(timelapse) {
  ///////////////////////////////////////////////////////////////////
  //
  // variables
  //

  var isMousedown = false;
  var isCursorDefault = true;
  var isMousedrag = false;
  var mouseOnHandleIndex = null;
  var closeHandDetectionInterval = null;
  var $viewerDiv = $(timelapse.getViewerDiv());
  var $videoDiv = $(timelapse.getVideoDiv());
  var diffBetweenMouseAndHandle = null;
  var originalXY = null;

  ///////////////////////////////////////////////////////////////////
  //
  // public functions
  //

  this.mousedownHandler = function(event) {
    isMousedown = true;
    if (mouseOnHandleIndex != null) {
      event.stopPropagation();
      isMousedrag = true;
      // Add a timer to detect if time machine adds the closedHand class
      if (closeHandDetectionInterval == null) {
        closeHandDetectionInterval = window.setInterval(function() {
          if ($videoDiv.hasClass("closedHand")) {
            $videoDiv.removeClass("closedHand");
            window.clearInterval(closeHandDetectionInterval);
            closeHandDetectionInterval = null;
          }
        }, 10);
      }
    }
  };

  this.mouseupHandler = function(event, afterDragCallBack) {
    if (isMousedrag == true && typeof afterDragCallBack == "function") {
      afterDragCallBack();
    }
    isMousedown = false;
    isMousedrag = false;
    diffBetweenMouseAndHandle = null;
    originalXY = null;
    if (closeHandDetectionInterval != null) {
      window.clearInterval(closeHandDetectionInterval);
      closeHandDetectionInterval = null;
    }
  };

  this.mousemoveHandler = function(event, handle, box, resizeCallback) {
    var offset = $viewerDiv.offset();
    var mx = event.pageX - offset.left;
    var my = event.pageY - offset.top;
    if (isMousedrag) {
      event.stopPropagation();
      if (diffBetweenMouseAndHandle == null) {
        setDiffBetweenMouseAndHandle(mx, my, box);
      } else {
        var x = mx - diffBetweenMouseAndHandle.x;
        var y = my - diffBetweenMouseAndHandle.y;
        resizeCallback(mouseOnHandleIndex, x, y);
      }
    } else {
      mouseOnHandleIndex = null;
      for (var i = 0; i < handle.length; i++) {
        if (boxContainPoint(mx, my, handle[i])) {
          mouseOnHandleIndex = i;
          setCursor(i);
          break;
        }
      }
    }
    if (mouseOnHandleIndex == null && !isMousedown && !isCursorDefault) {
      resetCursor();
    }
  };

  ///////////////////////////////////////////////////////////////////
  //
  // private functions
  //

  var setDiffBetweenMouseAndHandle = function(mx, my, box) {
    diffBetweenMouseAndHandle = {
      x: null,
      y: null
    }
    if (mouseOnHandleIndex == 0) {
      diffBetweenMouseAndHandle.x = mx - box.xmin;
      diffBetweenMouseAndHandle.y = my - box.ymin;
    } else if (mouseOnHandleIndex == 1) {
      diffBetweenMouseAndHandle.x = 0;
      diffBetweenMouseAndHandle.y = my - box.ymin;
    } else if (mouseOnHandleIndex == 2) {
      diffBetweenMouseAndHandle.x = mx - box.xmax;
      diffBetweenMouseAndHandle.y = my - box.ymin;
    } else if (mouseOnHandleIndex == 3) {
      diffBetweenMouseAndHandle.x = mx - box.xmax;
      diffBetweenMouseAndHandle.y = 0;
    } else if (mouseOnHandleIndex == 4) {
      diffBetweenMouseAndHandle.x = mx - box.xmax;
      diffBetweenMouseAndHandle.y = my - box.ymax;
    } else if (mouseOnHandleIndex == 5) {
      diffBetweenMouseAndHandle.x = 0;
      diffBetweenMouseAndHandle.y = my - box.ymax;
    } else if (mouseOnHandleIndex == 6) {
      diffBetweenMouseAndHandle.x = mx - box.xmin;
      diffBetweenMouseAndHandle.y = my - box.ymax;
    } else if (mouseOnHandleIndex == 7) {
      diffBetweenMouseAndHandle.x = mx - box.xmin;
      diffBetweenMouseAndHandle.y = 0;
    }
  };

  var boxContainPoint = function(x, y, box) {
    return ((x >= box.xmin && x <= box.xmax) && (y >= box.ymin && y <= box.ymax));
  };

  var setCursor = function(index) {
    isCursorDefault = false;
    if (index == 0)
      $videoDiv.removeClass('openHand closedHand').addClass('selectTopLeft');
    else if (index == 1)
      $videoDiv.removeClass('openHand closedHand').addClass('selectUp');
    else if (index == 2)
      $videoDiv.removeClass('openHand closedHand').addClass('selectTopRight');
    else if (index == 3)
      $videoDiv.removeClass('openHand closedHand').addClass('selectRight');
    else if (index == 4)
      $videoDiv.removeClass('openHand closedHand').addClass('selectBottomRight');
    else if (index == 5)
      $videoDiv.removeClass('openHand closedHand').addClass('selectDown');
    else if (index == 6)
      $videoDiv.removeClass('openHand closedHand').addClass('selectBottomLeft');
    else if (index == 7)
      $videoDiv.removeClass('openHand closedHand').addClass('selectLeft');
    else if (index == 8)
      $videoDiv.removeClass('openHand closedHand').addClass('selectMove');
  };

  var resetCursor = function() {
    isCursorDefault = true;
    $videoDiv.removeClass('selectMove selectTopLeft selectUp selectTopRight selectRight selectBottomRight selectDown selectBottomLeft selectLeft').addClass('openHand');
  };
};