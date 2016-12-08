var {Node} = require('reinhardt/nodes');
var fs = require('fs');
var {Application} = require('stick');
var $s = require("ringo/utils/strings");
var log = require('ringo/logging').getLogger(module.id);

var yuicompressor = require('./yuicompressor');

var templates = {
   ".js": '<script type="text/javascript" src="{{url}}"> </script>',
   ".css": '<link rel="stylesheet" type="text/css" media="{{mediaFormat}}" title="CSS Stylesheet" href="{{url}}" />'
};


// hash over input file names and their modify time
var getFsCacheKey = function(absoluteInputPaths) {
   var modifyTimes = absoluteInputPaths.map(function(filePath) {
      return fs.lastModified(filePath).getTime();
   });
   return $s.digest(absoluteInputPaths.concat(modifyTimes).join('')).toLowerCase() + fs.extension(absoluteInputPaths[0]);
};

// hash over input file names
var getEhCacheKey = function(inputPaths) {
   return $s.digest(inputPaths.join(''));
};

var isModified = function(absoluteInputPaths, outPath) {
   var outMs = fs.lastModified(outPath).getTime();
   return absoluteInputPaths.some(function(inputPath) {
      return fs.lastModified(inputPath).getTime() > outMs;
   });
};

var CompressorNode = function(inputFileNode, mediaTypeFilter) {
   this.inputFileNode = inputFileNode;
   this.mediaTypeFilter = mediaTypeFilter || null;
   return this;
}
CompressorNode.prototype.getByType = Node.prototype.getByType;

CompressorNode.prototype.getOriginalContent = function(context) {
   return this.inputFileNode.render(context);
}

/**
 * input files relative to source.path
 */
CompressorNode.prototype.getInputPaths = function(context) {
   var inputContent = this.getOriginalContent(context);
   return inputContent.split('\n').map(function(fileName) {
      return fileName.trim();
   }).filter(function(fileName) {
      return fileName;
   });
}

CompressorNode.prototype.toAbsolutePath = function(inputPaths) {
   return inputPaths.map(function(filePath) {
      return fs.join(this.env.config.compressor.source.path, filePath);
   }, this);
}

CompressorNode.prototype.getCachedOutput = function(inputPaths) {
   var cacheKey = getEhCacheKey(inputPaths);
   if (!this.env.config.compressor.cache) {
      return [cacheKey, null];
   }
   var cacheContent = this.env.config.compressor.cache.get(cacheKey);
   return [cacheKey, cacheContent];
}

CompressorNode.prototype.renderOutput = function(cacheKey, type, mediaFormat) {
   var url = this.env.config.compressor.destination.url + cacheKey;
   var r = templates[type].replace('{{url}}', url);
   return r.replace('{{mediaFormat}}', mediaFormat || "");
}

CompressorNode.prototype.renderUncompressed = function(inputPaths, type, mediaFormat) {
   return inputPaths.map(function(filePath) {
      var t = templates[type].replace('{{url}}', this.env.config.compressor.source.url + filePath);
      return t.replace('{{mediaFormat}}', mediaFormat || '');
   }, this).join('\n');
}

CompressorNode.prototype.writeCompressed = function(cacheKey, inputPaths) {
   var config = {
      sourcePath: this.env.config.compressor.source.path,
      sourceUrl: this.env.config.compressor.source.url,
      destinationPath: this.env.config.compressor.destination.path,
      cacheKey: cacheKey
   };
   return yuicompressor.compress(inputPaths, config);

}

CompressorNode.prototype.renderCompressed = function(context) {
   var inputPaths = this.getInputPaths(context);
   var fileType = fs.extension(inputPaths[0]) || '.js';
   var mediaType = this.mediaTypeFilter && this.mediaTypeFilter.resolve(context, true);

   // shortcut if we don't compress at all
   if (this.env.config.compressor.enabled === false) {
      return this.renderUncompressed(inputPaths, fileType, mediaType);
   }

   // do we have the resulting html cached?
   var [ehCacheKey, cacheContent] = this.getCachedOutput(inputPaths);
   if (cacheContent !== null) {
      log.debug('Cache HIT', ehCacheKey);
      return cacheContent;
   }

   // does the file we plan on writing already exist?
   var fsCacheKey = getFsCacheKey(this.toAbsolutePath(inputPaths));
   var fsOutPath = fs.join(this.env.config.compressor.source.path, fsCacheKey);
   // if does not exist, the modify times have changed and we must
   // write this file
   if (fs.exists(fsOutPath) === false) {
      this.writeCompressed(fsCacheKey, inputPaths);
   }

   // render html for template and put into cache
   var renderedOutput = this.renderOutput(fsCacheKey, fileType, mediaType);
   if (this.env.config.compressor.cache) {
      this.env.config.compressor.cache.put(ehCacheKey, renderedOutput, this.env.config.compressor.cacheTTL);
      log.debug('Cache MISS', ehCacheKey);
   }
   return renderedOutput;
}


CompressorNode.prototype.render = function(context) {
   // @@ debug code path
   return this.renderCompressed(context)
}

exports.compress = function(parser, token) {
   var bits = token.splitContents().slice(1);
   if (bits.length > 1) {
      throw new Error('"compress" tag takes only one optional argument: the mediaformat');
   } else if (bits.length > 0) {
      var mediaTypeFilter = parser.compileFilter(bits[0])
   }

   // read all nodes until {% endcompress %}
   var inputFileNode = parser.parse(['endcompress']);
   // skip endcompress itself
   var token = parser.nextToken();
   return new CompressorNode(inputFileNode, mediaTypeFilter);
}