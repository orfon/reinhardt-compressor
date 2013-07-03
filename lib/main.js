var {Node} = require('reinhardt/nodes');
var fs = require('fs');
var {Application} = require('stick');
var $s = require("ringo/utils/strings");

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
   // @@ if cache enabled, etc...
   var cacheKey = getCacheKey(inputPaths);
   var cacheContent = this.env.config.compressor.cache.get('compressor', cacheKey);
   return [cacheKey, cacheContent];
}

CompressorNode.prototype.renderOutput = function(cacheKey, type) {
   return templates[type].replace('{{url}}', this.env.config.compressor.destination.url + cacheKey);
}

CompressorNode.prototype.renderUncompressed = function(inputPaths, type) {
   return inputPaths.map(function(filePath) {
      return templates[type].replace('{{url}}', this.env.config.compressor.source.url + filePath);
   }, this).join('\n');
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
      return cacheContent;
   }

   // compress files and write to disk
   var mediaType = this.mediaTypeFilter && this.mediaTypeFilter.resolve(context, true);
   var outPath = fs.join(this.env.config.compressor.destination.path, cacheKey);
   var absoluteInputPaths = inputPaths.map(function(inputPath) {
      return fs.join(this.env.config.compressor.source.path, inputPath);
   }, this);
   yuicompressor.compress(absoluteInputPaths, outPath);

   // render html for template and put into cache
   var renderedOutput = this.renderOutput(cacheKey, fileType);
   if (cacheKey) {
      this.env.config.compressor.cache.put('compressor', cacheKey, renderedOutput, this.env.config.compressor.cacheTTL)
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
   }
   var mediaTypeFilter = parser.compileFilter(bits[0])

   // read all nodes until {% endcompress %}
   var inputFileNode = parser.parse(['endcompress']);
   // skip endcompress itself
   var token = parser.nextToken();
   return new CompressorNode(inputFileNode, mediaTypeFilter);
}