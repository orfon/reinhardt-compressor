var {Environment} = require('reinhardt');
var {Application} = require('stick');
var {CacheManager} = require('ringo-ehcache');

var app = exports.app = new Application();
app.configure('static', 'route');
app.static(module.resolve('./static/'), '', '/static');
app.static(module.resolve('./static.compressed/'), '', '/static.compressed');


var cacheManager = module.singleton('cacheManager', function() {
   return new CacheManager('/tmp/compressorcache/');
});
var env = new Environment({
   loader: [module.resolve('./templates/')],
   tags: [require('reinhardt-compressor')],
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
      cache: cacheManager,
      cacheTTL: 1000
   }
});

app.get('/', function(req) {
   return env.renderResponse("index.html", {
      variableJs: "query-" + ((Math.random() * 2 | 0) +1) + ".js"
   });
});

var start = function() {
   cacheManager.addCache('compressor');
   require("ringo/httpserver").main(module.id);
}

var stop = function() {
   // @@ todo
}

if (require.main == module) {
   start();
}
