---
title: Style Guide
template: styleguide.jade
menuIndex: 1
---

This is VPDB's style guide. It's the internal style guide, designated for 
people who want to contribute to VPDB. Of course it also helps explaining
stuff that you might wrote a few months back and forgot about it by now. :)

This is a living style guide, i.e. the content is entirely generated from the
style sheet comments of the current version of the app you're browsing using
[Knyle Style Sheets](https://github.com/kneath/kss). 

## Base CSS

VPDB's styles are based on [Twitter Bootstrap](http://getbootstrap.com/). It
takes care of element positioning and provides nomenclature for non-custom
elements. Generally, if there's an element or component in Bootstrap, VPDB
makes use of it. If you know Bootstrap's internal file structure (see below),
our overrides are usually in the same file.

## Class Naming

Apart from Twitter Bootstrap specific classes, we use a modified version of 
[BEM naming](http://bem.info/method/) - read all about it 
[here](http://csswizardry.com/2013/01/mindbemding-getting-your-head-round-bem-syntax/).
In our case, one of the many benefits of this method is that it's usually 
easy to determine if a CSS class is a custom VPDB-specific class or a 
Twitter Bootstrap override - Bootstrap doesn't use `--` for its modifiers.

## Class Usage

In terms how CSS classes should be used, we try to apply the concept of *Single
Responsibility* and *Encapsulation*, explained 
[here](http://drewbarontini.com/articles/single-responsibility/). In short, we 
try to not overly rely on the DOM when styling our elements, but use classes
instead and make them as re-usuable as possible.

Note that CSS styling is completely based on classes and no IDs are used. 
Classes that are prefixed with `vpdb-` are AngularJS directives and can usually
be ignored style-wise.

## Files

We roughly use Twitter Bootstrap's file structure, i.e. one file per pretty much 
every component. The `.styl` files are all compiled into one single CSS anyway, 
so there aren't any performance hits caused by multiple style sheets.
[`vpdb.styl`](https://github.com/freezy/node-vpdb/blob/master/client/styles/vpdb.styl)
is the root file where everything else gets included.

Contrarily to Bootstrap, we separate color styles from the rest. Since we have
different color sets based on which theme a page or element is using, this 
seems the most practical approach. It also makes it really easy to add 
additional color themes.

## Coding Style

[Stylus](http://learnboost.github.io/stylus/) is the CSS preprocessor of choice.
We use tabs, no spaces.

## Components

The following list briefly describes each component. You can use the menu navigation
on the left hand side to quickly navigate each section.
