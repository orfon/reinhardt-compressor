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

exports.compress = function(filePaths, outPath) {
   var type = fs.extension(filePaths[0]) || '.js';
   var outWriter = new java.io.StringWriter();

   filePaths.forEach(function(filePath) {
      try {
         var str = fs.read(filePath) || '';
         compressIntoWriter(str, outWriter, type);
      } catch (e) {
         // @@ error handling
         print ('File not found', filePath);
      }
   });

   fs.write(outPath, outWriter.toString());
}
