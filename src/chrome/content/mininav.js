var gLocked = false;
var gPrintProgressListener = {
  onStateChange : function (aWebProgress,
                            aRequest,
                            aStateFlags,
                            aStatus) {
    delayedShutdown();
  },

  onProgressChange : function (aWebProgress,
                               aRequest,
                               aCurSelfProgress,
                               aMaxSelfProgress,
                               aCurTotalProgress,
                               aMaxTotalProgress){},
  onLocationChange : function (aWebProgress,
                               aRequest,
                               aLocation,
                               aFlags){},

  onStatusChange : function (aWebProgress,
                             aRequest,
                             aStatus,
                             aMessage){},
  onSecurityChange : function (aWebProgress,
                               aRequest,
                               aState){},

  /* nsISupports */
  QueryInterface : function progress_qi(aIID) {
    if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsIWebProgressListener))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  }
};

var gBrowserProgressListener = {
  onLocationChange : function (aWebProgress, aRequest, aLocation, aFlags) {
    if (Components.interfaces
                  .nsIWebProgressListener
                  .LOCATION_CHANGE_ERROR_PAGE & aFlags) {
      // At this point, LOAD_BACKGROUND is set, so from now on, no event will
      // be fired.
      setTimeout(onPrintPageLoadComplete, 100);
    }
  },

  /* nsISupports */
  QueryInterface : function progress_qi(aIID) {
    if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsIWebProgressListener))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  }
};

// See http://developer.mozilla.org/en/docs/Code_snippets:Canvas

function savePNG(aCanvas, aPath) {
  var file = Components.classes["@mozilla.org/file/local;1"]
                       .createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath(aPath);

  var io = Components.classes["@mozilla.org/network/io-service;1"]
                     .getService(Components.interfaces.nsIIOService);
  var source = io.newURI(aCanvas.toDataURL("image/png", ""), null, null);
  var target = io.newFileURI(file);
    
  // prepare to save the canvas data
  var persist =
    Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
              .createInstance(Components.interfaces.nsIWebBrowserPersist);
  
  persist.persistFlags =
    Components.interfaces.nsIWebBrowserPersist
              .PERSIST_FLAGS_REPLACE_EXISTING_FILES |
    Components.interfaces.nsIWebBrowserPersist
              .PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
  
  persist.progressListener = gPrintProgressListener;
  persist.saveURI(source, null, null, null, null, file);
}

function startup() {
  sizeToContent();
  getBrowser().webProgress
              .addProgressListener(gBrowserProgressListener,
                                   Components.interfaces
                                             .nsIWebProgress
                                             .NOTIFY_LOCATION);

  getBrowser().addEventListener("pageshow", onPrintPageShow, false);
  
  var uri = (window.arguments)? window.arguments[0] : "";

  if (uri){
    try {
      getBrowser().loadURI(uri);
    }
    catch (e) {
      /* print error page, if possible */
      window.setTimeout(onPrintPageLoadComplete, 100);
    }
  }
  else
    delayedShutdown();

  /* Force killing process, if printing flow stopped for some reason,
     e.g. a network error prevents pageshow events from firing. */
  var timeout = 180;

  try {
    var prefs = Components.classes["@mozilla.org/preferences;1"]
                          .getService(Components.interfaces.nsIPrefBranch);
    timeout = prefs.getIntPref("extensions.cmdlnprint.timeout");
  }
  catch (e) {}

  window.setTimeout(window.close, timeout*1000);
}

function dateString() {
  var d = new Date();
  var tz = d.getTimezoneOffset() * -1;

  function ensureFormat(aDec) {
    return (aDec < 10)? "0" + aDec : aDec.toString();
  }

  var tzISO = "";
  if (tz < 0) {
    tz *= -1;
    tzISO += "-";
  }
  else
    tzISO += "+";

  tzISO += ensureFormat(tz/60) + ensureFormat(tz%60);
  
  return d.getFullYear().toString() +
         ensureFormat(d.getMonth() + 1) +
         ensureFormat(d.getDate()) + "-" +
         ensureFormat(d.getHours())+
         ensureFormat(d.getMinutes()) +
         ensureFormat(d.getSeconds()) + tzISO;
}

function outputFilePath(aMode) {
  var path = (window.arguments && window.arguments[2])?
               window.arguments[2] : "";
  if (path)
    return path;

  var prefs = Components.classes["@mozilla.org/preferences;1"]
                        .getService(Components.interfaces.nsIPrefBranch);

  var fileLeaf = "";
  try {
    fileLeaf = prefs.getComplexValue("extensions.cmdlnprint.basefilename",
                                      Components.interfaces.nsISupportsString)
                    .data;
    if (!fileLeaf)
      fileLeaf = "snapshot.%EXT%";
      
    var title = getBrowser().contentDocument.title;
    if (title.length > 32)
      title = title.substring(0, 32);

    fileLeaf = fileLeaf.replace("%HOST%", getBrowser().currentURI.host);
    fileLeaf = fileLeaf.replace("%TITLE%", title);
    fileLeaf = fileLeaf.replace("%DATE%", dateString());

    var ext = "dat";

    switch (aMode) {
    case 1:
      ext = "pdf";
      break;
    case 2:
      ext = "png";
      break;
    case 3:
      ext = "ps";
      break;
    case 4:
      if (/^text\/html/i.test(content.document.contentType)) {
        ext = "html";
      }
      else if (/xml/i.test(content.document.contentType)) {
        ext = "xml";
      }
      else {
        ext = "txt";
      }
      break;
    }

    fileLeaf = fileLeaf.replace("%EXT%", ext);

    /* forbidden letters, as title can be contain any letters. */
    while (/[\\\/\:\?\*\"\<\>\|]/.test(fileLeaf))
      fileLeaf = fileLeaf.replace(/[\\\/\:\?\*\"\<\>\|]/g, "_");

  }
  catch(e) {
    fileLeaf = "cmdlnprint.default.dat";
  }

  var file = Components.classes["@mozilla.org/download-manager;1"]
                       .getService(Components.interfaces.nsIDownloadManager)
                       .userDownloadsDirectory;
  file.append(fileLeaf);
  return file.path;
}

function printmode() {
  var mode = (window.arguments && window.arguments[1])?
               parseInt(window.arguments[1]) : 0;

  if (mode < 0) {
    var prefs = Components.classes["@mozilla.org/preferences;1"]
                          .getService(Components.interfaces.nsIPrefBranch);
    try {
      mode = prefs.getIntPref("extensions.cmdlnprint.mode");
    }
    catch (e) {
      mode = 0;
    }
  }

  return mode;
}

function printWithCanvas() {
  var canvas = document.createElementNS("http://www.w3.org/1999/xhtml",
                                        "canvas");

  var canvasWidth = content.scrollMaxX + content.innerWidth;
  var canvasHeight = content.scrollMaxY + content.innerHeight;

  /*
     Remove offset from scrollbar width.

     17px on WindowsXP, but this may depends on client theme or something.
     I guess the real width would be 16, plus extra 1px border for drop-
     -shadow.
     XXX FIXME!
   */
  if (content.scrollMaxX)
    canvasHeight -= 17;

  if (content.scrollMaxY)
    canvasWidth -= 17;

  canvas.style.width = canvasWidth + "px";
  canvas.style.height = canvasHeight + "px";
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;


  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.scale(1, 1);
  ctx.drawWindow(content, 0, 0, canvasWidth, canvasHeight,
                 "rgb(128,128,128)");
  savePNG(canvas, outputFilePath(2));
}

function onPrintPageShow(aEvent) {
  if (getBrowser().contentDocument.readyState == "complete") {
    setTimeout(onPrintPageLoadComplete, 0);
  }
  else {
    content.document.addEventListener("readystatechange",
                                      onDocumentReadyStateChange,
                                      false);
  }
}

function onDocumentReadyStateChange(aEvent) {
  if (getBrowser().contentDocument.readyState == "complete") {
    onPrintPageLoadComplete();
  }
}

function onPrintPageLoadComplete() {

  if (window.arguments && window.arguments[3]) {
    var delay = parseInt(window.arguments[3]);
    if (delay < 0)
      delay = 0;
    if (delay > 120)
      delay = 120;
    setTimeout(delayedPrintPageLoadComplete, delay * 1000);
  }
  else
    delayedPrintPageLoadComplete();
}


function setupOtherPreferences(settings) {
    if (window.arguments.length < 6) return;
    
    // orientation
    var aOrientation = (window.arguments[5]) ? window.arguments[5] : "default";
    settings.orientation =
        (aOrientation == "portrait") ? settings.kPortraitOrientation :
        (aOrientation == "landscape") ? settings.kLandscapeOrientation :
        settings.orientation ;
    // printBGColors
    var aBGColors = (window.arguments[6]) ? window.arguments[6] : "default";
    settings.printBGColors =
        (aBGColors == "yes") ? true :
        (aBGColors == "no") ? false :
        settings.printBGColors ;
    // printBGImages
    var aBGImages = (window.arguments[7]) ? window.arguments[7] : "default";
    settings.printBGImages =
        (aBGImages == "yes") ? true :
        (aBGImages == "no") ? false :
        settings.printBGImages ;
    // shrinkToFit
    var aShrinkToFit = (window.arguments[8]) ? window.arguments[8] : "default";
    settings.shrinkToFit =
        (aShrinkToFit == "yes") ? true :
        (aShrinkToFit == "no") ? false :
        settings.shrinkToFit ;
    // setup headers ?
    if ("yes" == window.arguments[9]) {
        settings.headerStrLeft = window.arguments[10];
        settings.headerStrCenter = window.arguments[11];
        settings.headerStrRight = window.arguments[12];
    }    
    // setup footers ?
    if ("yes" == window.arguments[13]) {
        settings.footerStrLeft = window.arguments[14];
        settings.footerStrCenter = window.arguments[15];
        settings.footerStrRight = window.arguments[16];
    }
    // range
    if ("yes" == window.arguments[17]) {
        settings.printRange = settings.kRangeSpecifiedPageRange;
        settings.startPageRange = parseInt(window.arguments[18], 10);
        settings.endPageRange = parseInt(window.arguments[19], 10);
    }
    // paper size
    if ("yes" == window.arguments[20]) {
        settings.paperSizeType = settings.kPaperSizeDefined;
        settings.paperSizeUnit = (window.arguments[21] == "in") ? settings.kPaperSizeInches : settings.kPaperSizeMillimeters ;
        settings.paperWidth = parseFloat(window.arguments[22]);
        settings.paperHeight = parseFloat(window.arguments[23]);
    }
    // page margins
    if ("no" != window.arguments[24]) {
        settings.unwriteableMarginTop = 0;
        settings.marginTop = parseFloat(window.arguments[24]) / ((settings.paperSizeUnit == settings.kPaperSizeInches) ? 1 : 25.4);
    }
    if ("no" != window.arguments[25]) {
        settings.unwriteableMarginRight = 0;
        settings.marginRight = parseFloat(window.arguments[25]) / ((settings.paperSizeUnit == settings.kPaperSizeInches) ? 1 : 25.4);
    }
    if ("no" != window.arguments[26]) {
        settings.unwriteableMarginBottom = 0;
        settings.marginBottom = parseFloat(window.arguments[26]) / ((settings.paperSizeUnit == settings.kPaperSizeInches) ? 1 : 25.4);
    }
    if ("no" != window.arguments[27]) {
        settings.unwriteableMarginLeft = 0;
        settings.marginLeft = parseFloat(window.arguments[27]) / ((settings.paperSizeUnit == settings.kPaperSizeInches) ? 1 : 25.4);
    }
}

function delayedPrintPageLoadComplete() {
  if (gLocked)
    return;
  else
    gLocked = true;

  var mode = printmode();

  if (mode == 2) {
    setTimeout(printWithCanvas, 100);
    return;
  }
  else if (mode == 4) {
    var file = Components.classes["@mozilla.org/file/local;1"]
                       .createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(outputFilePath(4));

    var io = Components.classes["@mozilla.org/network/io-service;1"]
                       .getService(Components.interfaces.nsIIOService);

    var persist =
      Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                .createInstance(Components.interfaces.nsIWebBrowserPersist);
  
    persist.persistFlags =
      Components.interfaces.nsIWebBrowserPersist
                .PERSIST_FLAGS_REPLACE_EXISTING_FILES |
      Components.interfaces.nsIWebBrowserPersist
                .PERSIST_FLAGS_BYPASS_CACHE |
      Components.interfaces.nsIWebBrowserPersist
                .PERSIST_FLAGS_FIXUP_ORIGINAL_DOM |
      Components.interfaces.nsIWebBrowserPersist
                .PERSIST_FLAGS_FIXUP_LINKS_TO_DESTINATION |
      Components.interfaces.nsIWebBrowserPersist
                .PERSIST_FLAGS_SERIALIZE_OUTPUT |
      Components.interfaces.nsIWebBrowserPersist
                .PERSIST_FLAGS_FIXUP_LINKS_TO_DESTINATION |
      Components.interfaces.nsIWebBrowserPersist
                .PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
  
    persist.progressListener = gPrintProgressListener;
    persist.saveDocument(content.document, file, null, null,
                         Components.interfaces.nsIWebBrowserPersist
                                   .ENCODE_FLAGS_ABSOLUTE_LINKS |
                         Components.interfaces.nsIWebBrowserPersist
                                   .ENCODE_FLAGS_ENCODE_W3C_ENTITIES, 0);
    return;
  }

  // We can't convert from XUL to printable format.  
  if (content.document.contentType == "text/xul" ||
      content.document.contentType == "application/vnd.mozilla.xul+xml") {
    delayedShutdown();
    return;
  }

  /* printing API */
  var webBrowserPrint =
    content.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
           .getInterface(Components.interfaces.nsIWebBrowserPrint);

  var printSettingsService =
    Components.classes["@mozilla.org/gfx/printsettings-service;1"]
              .getService(Components.interfaces.nsIPrintSettingsService);

  /* sigh, layout needs printPreview for currentPrintSettings.  */
  // var settings = webBrowserPrint.currentPrintSettings;
  var settings = printSettingsService.newPrintSettings;

  var printerName = printSettingsService.defaultPrinterName;

  if (window.arguments && window.arguments[4] &&
      window.arguments[4] != printerName) {
    if (mode == 0) {
      /* Check whether the printer name specified by an argument is valid. */
      var list =
        Components.classes["@mozilla.org/gfx/printerenumerator;1"]
                  .getService(Components.interfaces.nsIPrinterEnumerator)
                  .printerNameList;
      while (list.hasMore()) {
        if (window.arguments[4] == list.getNext()) {
          printerName = window.arguments[4];
          break;
        }
      }
    }
    else
      printerName = window.arguments[4];
  }

  switch (mode) {
  case 0:
    printSettingsService.initPrintSettingsFromPrinter
      (printerName, settings);
    
    printSettingsService.initPrintSettingsFromPrefs
      (settings, true, Components.interfaces.nsIPrintSettings.kInitSaveAll);
    
    setupOtherPreferences(settings);
    break;
  case 1:
  case 3:
    /*
       There's no way to set *global* settings in Firefox 3.0.
       I'm not too sure why, but UI is gone. This is not rendering bug,
       but browser (or toolkit) bug.
       So copy from default printer settings.
     */
    settings.printerName = printerName;

    /* We have no interest on those other than prefs. */
    printSettingsService.initPrintSettingsFromPrefs
      (settings, true, Components.interfaces.nsIPrintSettings.kInitSaveAll);
    
    setupOtherPreferences(settings);
    settings.printerName = null;

    /* settings for PDF. */
    settings.printToFile = true;
    settings.toFileName = outputFilePath(mode);

    settings.outputFormat = (mode == 1)?
      Components.interfaces.nsIPrintSettings.kOutputFormatPDF:
      Components.interfaces.nsIPrintSettings.kOutputFormatPS;
    break;
  default:
    /* Unkown mode. Can it go on? */
    return;
  }
  settings.printSilent = true;
  webBrowserPrint.print(settings, gPrintProgressListener);
}

function delayedShutdown() {
  window.setTimeout(window.close, 100);
}


function getBrowser() {
  return document.getElementById("content");
}
