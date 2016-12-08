Compresses a list of CSS or JS files into a destination directory. Serve and/or cache the files as you see fit.

== usage ==

    {{% compress %}}
         /static/reset.css
    	   /css/my.css
    {{% endcompress %}}


The cache is configured in the Reinhardt environment. You must add
this module to the `tags` list of your environment and configure
the source and destination paths as well as urls for compression.

This gives you the flexiblity of serving the source and compressed
files however you want.

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
