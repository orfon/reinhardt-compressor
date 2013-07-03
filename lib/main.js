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


var getCacheKey = function(arrayOfStrings) {
   return $s.digest(arrayOfStrings.join('')) + fs.extension(arrayOfStrings[0]);
}

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
 * input files absolute path
 */
CompressorNode.prototype.getInputPaths = function(context) {
   var inputContent = this.getOriginalContent(context);
   return inputContent.split('\n').map(function(fileName) {
      return fileName.trim();
   }).filter(function(fileName) {
      return fileName;
   });
}

CompressorNode.prototype.renderCached = function(inputPaths) {
   var cacheKey = getCacheKey(inputPaths);
   if (!this.env.config.compressor.cache) {
      return [cacheKey, null];
   }
   var cacheContent = this.env.config.compressor.cache.get(cacheKey);
   return [cacheKey, cacheContent];
}

CompressorNode.prototype.renderOutput = function(cacheKey, type, mediaFormat) {
   var r = templates[type].replace('{{url}}', this.env.config.compressor.destination.url + cacheKey);
   if (mediaFormat) {
      return r.replace('{{mediaFormat}}', mediaFormat)
   }
   return r;
}

CompressorNode.prototype.renderUncompressed = function(inputPaths, type) {
   return inputPaths.map(function(filePath) {
      return templates[type].replace('{{url}}', this.env.config.compressor.source.url + filePath);
   }, this).join('\n');
}

CompressorNode.prototype.writeCompressed = function(cacheKey, inputPaths) {
   var outPath = fs.join(this.env.config.compressor.destination.path, cacheKey);
   yuicompressor.compress(inputPaths, outPath,
            this.env.config.compressor.source.path, this.env.config.compressor.source.url);
}

CompressorNode.prototype.renderCompressed = function(context) {
   var inputPaths = this.getInputPaths(context);
   var fileType = fs.extension(inputPaths[0]) || '.js';

   // shortcut if we don't compress at all
   if (this.env.config.compressor.enabled === false) {
      return this.renderUncompressed(inputPaths, fileType);
   }

   // do we have html cached?
   var [cacheKey, cacheContent] = this.renderCached(inputPaths);
   if (cacheContent !== null) {
      log.trace('Cache HIT', cacheKey);
      return cacheContent;
   }

   // compress files and write to disk
   this.writeCompressed(cacheKey, inputPaths);

   // render html for template and put into cache
   var mediaType = this.mediaTypeFilter && this.mediaTypeFilter.resolve(context, true);
   var renderedOutput = this.renderOutput(cacheKey, fileType, mediaType);
   if (this.env.config.compressor.cache) {
      this.env.config.compressor.cache.put(cacheKey, renderedOutput, this.env.config.compressor.cacheTTL)
      print ('miss putting into cache')
      log.trace('Cache MISS', cacheKey);
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