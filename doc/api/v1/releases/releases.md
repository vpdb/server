A release is a digital recreation of a pinball game (unless it's an original
game, of course).

# Structure

![Model][img-schema]

Looking at the schema above, we can state that:

  - Every release is linked to a [game][game] and while a game can have
    multiple releases linked to it, a release always refers to only one game.
  - A release contains one or more **versions**.
  - A version contains one or more **files**.

# Versions

As releases get updated, a new **version** of a given release is created.
The new version comes with a version number, a changelog and a set of files.

# Files

A version of a release can obviously contain more than just the table file.
It can also contain additional scripts or even multiple table files (see 
*flavors* below).

For every uploaded table file, additional metadata must be provided. Besides
the obligatory table screenshot, the flavor and the table's compatibility must
be defined:

## Flavors

Flavors are basically attributes that are relevant for every table file. There
are currently two flavor types:

  - *Orientation*: Defines the perspective in which the table is rendered. For
    now, possible values are landscape or portrait.
  - *Lightning*: Defines whether the playfield is illuminated or dark

Flavors play a significant role when browsing the site and downloading tables:
A user can globally set its preference and will then get only the selected 
flavors.

Note that flavor types are hard-coded and cannot be changed with the API.


## Compatibility

Every table file needs to be linked to at least one compatible 
[Visual Pinball build][build]. This allows authors to provide table files for
multiple versions of Visual Pinball in one single release. It also avoids
confusion about which release is supposed to work with which version of Visual
Pinball.


# Authors

Since a table is usually the effort of several people, multiple authors can be
defined for a release. An author consists of a link to the user as well as a
label describing the user's accomplishment ("3D Models", "Textures", etc).

Note that authors are specific to the release itself, meaning they apply to all
versions of the release.

# Tags

[Tags][tag] are markers of special features a table might integrate. A release
can have none or multiple tags assigned. The goal of tags is to provide a 
structured way of filtering releases, but also to advertise the features.

A tag comes with a name and a description. Icons are conceivable in the future.


[game]: api://core/games
[build]: api://core/builds
[tag]: api://core/tags
[img-schema]: /images/schema-release.svg