---
title: Style Guide
layout: styleguide.pug
menuIndex: 1
---

This is a living style guide, i.e. the content is entirely generated from the
style sheet comments of the current version of the app you're browsing using
[Knyle Style Sheets][kss]. 

## Base CSS

VPDB's styles are based on [Twitter Bootstrap][bootstrap]. It rakes care of 
element positioning and provides nomenclature for non-custom elements.  
Generally, if there's an element or component in Bootstrap, VPDB makes use of 
it. If you know Bootstrap's internal file structure (see below), our overrides 
are usually in the same file.

## Class Naming

Apart from Twitter Bootstrap specific classes, we use a modified version of 
[BEM naming][bem] - read all about it [here][bem-article].

In our case, one of the many benefits of this method is that it's usually 
easy to determine if a CSS class is a custom VPDB-specific class or a 
Twitter Bootstrap override - Bootstrap doesn't use `--` for its modifiers.

## Class Usage

In terms how CSS classes should be used, we try to apply the concept of *Single
Responsibility* and *Encapsulation*, explained 
[here][sre]. In short, we try to not overly rely on the DOM when styling our 
elements, but use classes instead and make them as re-usuable as possible.

Note that CSS styling is completely based on classes and no IDs are used. 
Classes that are prefixed with `vpdb-` are AngularJS directives and can usually
be ignored style-wise.

## Files

We roughly use Twitter Bootstrap's file structure, i.e. one file per pretty
much every component. The `.styl` files are all compiled into one single CSS 
anyway, so there aren't any performance hits caused by multiple style sheets.
[`vpdb.styl`][vpdb.styl] is the root file where everything else gets included.

Contrarily to Bootstrap, we separate color styles from the rest. Since we have
different color sets based on which theme a page or element is using, this 
seems the most practical approach. It also makes it really easy to add 
additional color themes.

## Coding Style

[Stylus][stylus] is the CSS preprocessor of choice. We use tabs, no spaces.

## Components

Use the menu navigation on the left to browse through the styles. You can
switch the color theme with the button on the bottom right of this page. Note
that not all styles are defined for all color themes since styles are only
written when they are actually used in the web application.

## Icons

While [FontAwesome][fa] & co are an elegant way to use vector-based icons, it 
became really cumbersome when adding new icons that weren't part of the 
FontAwesome package.

Due to [additional][tenreasons] [reasons][svgvsif], I decided to go for 
another approach: SVG icons. The idea is to include an SVG containing 
only definitions in the HTML layout and then reference these definitions
in the DOM using the `<use>` element. This method is also known as 
[SVG Sprites][svgsprites].

For this, we keep [one Illustrator file][ai-icons] and explode the art boards
into [multiple `.svg` files][icon-folder]. During build, we run 
[svgmin][svgmin] on them and [compile them][svgstore] into one definition file
at `gfx/svg-defs.svg`. The content of this file is then rendered into the HTML 
DOM. Whenever we use an icon in the DOM, we can render it by calling the 
`icon(svg-name)` Pug mixin. Color can be set by defining the `fill` CSS 
property.

However, since the SVG is in the DOM, we can't use it purely in a CSS class. 
For example, putting an SVG as background-image into an element via CSS isn't
possible without re-defining the SVG in the CSS. But even if we had the SVG in
the CSS or loaded it externally, we wouldn't be able to style it dynamically, 
since the SVG wouldn't be part of the DOM. This is why tools like 
[Grunticon][grunticon] or [Iconizr][iconizr] are of very limited use.

So for the six icons (checkbox on/off, radio on/off, sort caret up/down), we'll
continue using an icon font.


[kss]: https://github.com/kneath/kss
[bem]: http://bem.info/method/
[bem-article]: http://csswizardry.com/2013/01/mindbemding-getting-your-head-round-bem-syntax/
[bootstrap]: http://getbootstrap.com/
[sre]: http://drewbarontini.com/articles/single-responsibility/
[vpdb.styl]: https://github.com/vpdb/backend/blob/master/client/styles/vpdb.styl
[stylus]: http://learnboost.github.io/stylus/
[fa]: http://fontawesome.io/
[tenreasons]: http://ianfeather.co.uk/ten-reasons-we-switched-from-an-icon-font-to-svg/
[svgvsif]: http://css-tricks.com/icon-fonts-vs-svg/
[ai-icons]: https://github.com/vpdb/backend/blob/master/gfx/icons.ai
[icon-folder]: https://github.com/vpdb/backend/tree/master/gfx/icons
[svgmin]: https://github.com/sindresorhus/grunt-svgmin
[svgstore]: https://github.com/FWeinb/grunt-svgstore
[svgsprites]: http://css-tricks.com/svg-sprites-use-better-icon-fonts/
[grunticon]: https://github.com/filamentgroup/grunticon
[iconizr]: https://github.com/jkphl/grunt-iconizr