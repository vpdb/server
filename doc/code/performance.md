---
title: Performance
template: page.jade
menuIndex: 1
subsectionIndex: 4
---

# Overview

When it comes to web applications, pretty much everybody agrees that **speed is
a feature**. Basically, the faster a website is, the more people will use it.
It's not just a "nice to have", but has really become a necessity. Even Google
& co [favor fast loading pages](http://www.stevesouders.com/blog/2010/04/09/google-adds-site-speed-to-search-ranking/)
in their ranking for some time now.

VPDB employs a number of performance-related patterns and configurations that
are briefly explained as follows.

# Network

* SSL handshake optimization in order to get the number of round trips down 
  from 3+ to 1. See [Is TLS Fast yet?](https://istlsfastyet.com/) by Ilya 
  Grigorik
* [SPDY/HTTP 2.0](https://developers.google.com/speed/spdy/) support, which 
  employs several speed-related features.
* Use a CDN that supports both mentioned above, such as Cloud Flare.
* Enable HTTP content compression for non-SPDY browers

# Assets

* Minimize HTML
* Concatenate, minify and uglify all Javascripts
* Concatenate and minify style sheets
* Keep pixel images to a minimum and use vector based assets whenever possible
* Strip off unnecessary comments from SVG files
* Run PNGs through an optimizer (pngcrush gets them down 65%)
* Use decent caching (`etag`, `Modified-Since`), also for API requests.

..and some other stuff. Basically, the goal here is to get a good score from 
YSlow and webpagetest.org.

# Application

* Reduce server processing time by serving the entire DOM of the website 
  statically and precompiled. The only dynamic data coming from the server is
  from the API where no page rendering is involved. In fact, the Node.js 
  process doesn't even see HTML requests, they are processed directly by Nginx.
* Use the right order of style sheet and Javascript inclusion in the DOM.
* Use JSON as transport data format.
* Run the app through services like New Relic in order to determine performance
  bottle necks
* Running 300+ integration tests also give an idea ;)

# Browser

* Make sure that all animations are CSS3-based and not via Javascript
* Keep screen redraws to a minimum (thanks, Devtools!).

# Not (yet) applied patterns

* [Above the fold content delivery](https://github.com/addyosmani/critical)
* [Clean unused CSS](https://github.com/addyosmani/grunt-uncss)
* Google's [pagespeed module](https://developers.google.com/speed/) (we do most
  of that stuff already).
* [Closure compiler](http://closure-compiler.appspot.com/home)