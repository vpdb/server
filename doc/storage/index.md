---
title: Storage API
header: Storage API
template: page.jade
menuIndex: 1
subsectionIndex: 1
---

# Overview

Although storage is handled by the same server as rest of the code, we keep the
**API** of the storage features separate from the rest. The reason is mainly
being able to easily offload storage to a different server in the future if
necessary without having to change the API.

# Authentication

There are protected and unprotected storage items. Unprotected (or *free*)
items don't need authentication and can be downloaded anonymously. Such items
are typically images and text files and aren't part of the rate limiting 
either.
