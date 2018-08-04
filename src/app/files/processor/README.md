# Processors

VPDB analyzes and optimizes uploaded assets like screenshots, videos, DirectB2S backglasses and table files. 
Furthermore, it creates so-called *variations* of those uploads, such as thumbnails of different dimensions and aspect
ratios. The code doing that is called a *processor*.

## Processor Types

There are two types of processors: 

1. *Creation processors* take the original upload or one of its variations and create a new variation of it.
2. *Optimization processors* modify an existing file.
 
There can be multiple instances of each applied to a given file. For example, a DirectB2S file would apply a 
`Directb2sThumbProcessor` (creation) to extract a screenshot, followed by a `ImageVariationProcessor` (creation) to 
create thumbnails of that screenshot. Finally, the `Directb2sOptimizationProcessor` (optimization) and 
`ImageOptimizationProcessor` (optimization) are applied to the original `.directb2s` file and the thumbnails 
respectively.

## Execution Order

Since one upload can result in many processors being executed, prioritization and performance are important. VPDB uses
a [job queue](https://github.com/OptimalBits/bull) that allows sequential execution that are easy on the system load
while getting the most important jobs done first.

More specifically, we have a job queue for every file type and processor type, for example images independently of their
format get two queues, one for creation and one for optimization.

Since creation processors can be dependent on other creation processors (when the source of a variation is itself a
variation), creation jobs get only queued when their source is available.

## Matching

It's the processor's responsibility to find out whether it can process a given file or not. When a file is uploaded,
every processor is handed the `File` instance where it typically looks at the MIME type to decide whether it's a valid
input. This is repeated for every created variation, which allows nested chaining of multiple processors as mentioned
above.

The advantage of processors being self-aware is that there is no need to map which file type get processed by which
processor, which can get very complex given the nested nature.

## Availability

When a file is posted to the storage API, it immediately returns links to all available variations, despite none of them
being actually created yet. In case an HTTP request for a non-created variation comes in, the socket is kept open until
the file is available, at which point the data is returned, even if there are still optimization processors queued up.
The goal here is to serve the first available version as fast as possible and without having the client to implement 
some kind of re-try logic.

Some variations like thumbnails are directly served by the reverse proxy since they don't need authentication. These 
files are relocated to a different directory as soon as its parent entity (e.g. the release) gets published. Since this
can happen before they finished optimizing or even being created, the worker needs to be aware of this and move the file
to the correct location after processing.

For public access, the same logic applies as for non-created variations: The reverse proxy will fall back to the Node.js
process if a public file is not available, which will either serve then non-relocated resource off the original 
directory, or wait until the variation has been created and serve the file at that point.

## Implementation

The processor logic is split into three classes:

- **`ProcessorQueue`** implements the main logic and provides the API to the rest of the application. 
- **`ProcessorWorker`** provides static methods executed by the queue. Since the queue uses Redis, the workers could be
  spawned on a different physical machine if necessary.
- **`ProcessorManager`** keeps the references to queues and available processors and is available to the other two 
  classes in order to avoid circular dependencies.
  
Processors extend `CreationProcessor<V>` and `OptimizationProcessor<V>` respectively.  