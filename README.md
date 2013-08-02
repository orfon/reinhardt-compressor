
== usage ==

    {{% compress %}}
      /static/reset.css
    	/css/my.css
    {{% endcompress %}}


The cache is configured in the Reinhardt environment. You must add
this module to the `tags` list of your environment and configure
the source and destination paths for compression:

		var env = new Environment({
			// load the compressor tag
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
		      }
		   }
		});

To enable caching you must provide a cache implementation. I suggest you use `ringo-ehcache`.

		var cacheManager = module.singleton(function() {
			return new CacheManager('/tmp/foo');
		});
		// Compressor configuration
	   compressor : {
	   	cache: cacheManager.getCache('fooCompressor'),
	   	cacheTTL: 60,
	   	....
	   }

== Behind the scenes ==

Within the request-response cycle, file modification timestamps are periodically checked (depending on the value of `cacheTTL`) and modified files are recompressed.

When a {% compress %} tag is encoutered, the following happens:

The content of the compress-tag is split by "\n". Each line is assumed to be one css or js file
relative to `source.path`, those are our input files. All input files within one compress-tag must be of the same type.

    if compressor.enabled == false
      for each input file
        print <style> or <script> tag
	   exit

    memory cache key = input file names
    if memory cache key in cache:
      print cacheContent
      exit

    file cache key = input file names and their modification time
    if file cache key does not exist on filesystem:
      compress the input files to a file named like file cache key

    html = <style> or <script> linking to file cache key
    put html into cache as memory cache key
    print html
