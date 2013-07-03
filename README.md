
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

== behind the scenes ===

The following happens when rendering a {{compress}} tag:

The content of the compress-tag is split by "\n". Each line is assumed to be one css or js file
relative to `source.path`, those are our input files. Within one compress-tag all input files
must be of the same type!

If `compressor.enabled` is `false`:
   * output one <style> or <script> per input file
   * no futher processing happens

If the compressor is enabled and the cache is enabled:
   * we do a cache lookup
   * cache key is the hash of the input files (not their contents! just the filepaths themselves)
   * if we get a cache hit
      * the cache content is returned
      * no further processing happens

If we get a cache miss:

  * `yuicompress` checks the modification time of the input files
  * if the input files are newer then the output: recompress

Finally, the html output for the compressed file is generated and put into the cache if enabled, or just
returned otherwise.