var {Environment} = require('reinhardt');
var {Application} = require('stick');
var {CacheManager} = require('ringo-ehcache');

var app = exports.app = new Application();
app.configure('static', 'route');
// serve both: the normal "static" and the "static.compressed" URL.
// those must match the configuration you give below in the environment
app.static(module.resolve('./static/'), '', '/static');
app.static(module.resolve('./static.compressed/'), '', '/static.compressed');

// optional caching
var cacheManager = module.singleton('cacheManager', function() {
   var cacheManager = new CacheManager('/tmp/compressorcache/');
   cacheManager.addCache('compressor');
   return cacheManager;
});


var env = new Environment({
   loader: [module.resolve('./templates/')],
   tags: [require('reinhardt-compressor')],
   // Compressor configuration
   compressor : {
      enabled: true,
      source: {
         url: '/static/',
         path: module.resolve('static')
      },
      destination: {
         url: '/static.compressed/',
         path: module.resolve('static.compressed')
      },
      cache: cacheManager.getCache('compressor'),
      cacheTTL: 10
   }
});

app.get('/', function(req) {
   return env.renderResponse("index.html", {
      variableJs: "query-" + ((Math.random() * 2 | 0) +1) + ".js"
   });
});

var start = function() {
   require("ringo/httpserver").main(module.id);
}

var stop = function() {
   // @@ todo
}

if (require.main == module) {
   start();
}
