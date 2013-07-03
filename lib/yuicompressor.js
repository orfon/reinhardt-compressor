var fs = require('fs');

// add all jar files to the classpath
var dir = module.resolve("../jars/");
fs.list(dir).forEach(function(file) {
  if (fs.extension(file) === ".jar") {
      addToClasspath(fs.join(dir, file));
  }
});

var JavaScriptCompressor = Packages.com.yahoo.platform.yui.compressor.JavaScriptCompressor;
var CssCompressor = Packages.com.yahoo.platform.yui.compressor.CssCompressor;

var ErrorReporter = function() {
   return new Packages.com.yahoo.org.mozilla.javascript.ErrorReporter({
      "warning": function(message, sourceName, line, lineSource, lineOffset) {
         //warn("WARN " + message, sourceName, line, lineSource);
      },
      "error": function(message, sourceName, line, lineSource, lineOffset) {
         print("ERROR " + message, sourceName, ':', line, lineSource);
      },
      "runtimeError": function(message, sourceName, line, lineSource, lineOffset) {
         print("JavaScript compilation error in " + sourceName + " line " + (line + lineOffset) + ", " + message);
      },
   });
}

var cssUrlRewrite = function(sourceText, sourceUri) {
   // convert all relative url('...') values so that the URL of referenced images
   // points to the location of uncompressed static files
   var sourceUri = new java.net.URI(sourceUri);
   return sourceText.replace(/url\(['"]?([^'")]+)['"]?\)/gi, function(match, url) {
      return "url('" + sourceUri.resolve(url) + "')";
   });
};

var compressIntoWriter = function(str, writer, type) {
   var inReader = new java.io.StringReader(str);
   if (type === '.js') {
      var compressor = new JavaScriptCompressor(inReader, new ErrorReporter());
      // linebreak, munge, verbose, preserverAllSemis, disableOptimize
      compressor.compress(writer, 80, true, true, true, true);
   } else {
      // linebreak
      var compressor = new CssCompressor(inReader);
      compressor.compress(writer, 80);
   }
   return
};

var isModified = function(inputPaths, outPath) {
   var outMs = fs.lastModified(outPath).getTime();
   return inputPaths.some(function(inputPath) {
      return fs.lastModified(inputPath).getTime() > outMs;
   });
}

exports.compress = function(inputPaths, outPath, sourcePath, sourceUri) {
   var type = fs.extension(inputPaths[0]) || '.js';
   var outWriter = new java.io.StringWriter();

   var absoluteInputPaths = inputPaths.map(function(filePath) {
      return fs.join(sourcePath, filePath);
   });
   if (!isModified(absoluteInputPaths, outPath)) {
      return false;
   }

   absoluteInputPaths.forEach(function(filePath, idx) {
      try {
         var str = fs.read(filePath) || '';
         if (type === '.css') {
            str = cssUrlRewrite(str, sourceUri + inputPaths[idx]);
         }
         compressIntoWriter(str, outWriter, type);
      } catch (e) {
         // @@ error handling
         print ('File not found', filePath);
      }
   });

   fs.write(outPath, outWriter.toString());
   return true;
}
