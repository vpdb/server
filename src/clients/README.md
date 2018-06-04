# Real-Time Architecture

## Goal

While VPDB doesn't have any time critical data per se, there are some use cases where real time would make a difference.
Basically, there are three categories:

1. *Must have*: Users should be able to schedule downloads directly through the web application. The goal here is that 
   with one click, a table file is saved to the correct local folder and optionally update PinballX's database. In order
   to do that, a push mechanism is needed to control a third-party app.
2. *Need to have*: Personal data should be synchronized, e.g. if a user clicks in one browser on a star, it should also
   show up in another open browser and in VPDB Agent.
3. *Nice to have*: Other data is synchronized, e.g. if a user is on a release page and the release gets updated, a 
   notification is shown on the page without the user having to reload it.

## Stack

Currently we use pusher.com, but for our usage, a native implementation through 
[websockets/ws](https://github.com/websockets/ws) should be sufficient. Socket.IO is too heavy and today's browsers all
natively support websockets. Node.js should be able to [handle a few thousand concurrent connections](https://blog.jayway.com/2015/04/13/600k-concurrent-websocket-connections-on-aws-using-node-js/)
easily.

## Communication

When the connection is established, nothing but the heartbeat will be sent through the socket. In order to receive data,
the client needs to subscribe to one or more *channels*.

### Server Channels

Server channels push database updates as they arrive to clients. Their primary goal is to keep the UI in sync with the
database, in real time. The goal of server channels is not to send everything to everybody but at the same time stay 
reasonably simple.

A good start would be to split server data into two channels: `private` and `public`. Private data is everything related
to the user, e.g. starring a release, or changing a setting. Public data are changes that everybody can see, e.g. 
posting a comment or adding a new version to a release. Public can further be split up in the future if necessary.

### Client Channels

This is where it gets more interesting. While the server channels' main goal is to keep the UI updated, we can also use
the websocket to actually execute stuff on client side. Thus, a client can expose APIs to which other clients can talk 
to. These APIs are asynchronous, i.e. a request can result in multiple events, describing progress and/or completion of
multiple tasks. 

A client API request is always addressed to *one explicit* client. However, the response(s) triggered by the request are
dispatched to all clients subscribed to the API of the request (the *client channel*). Thus, a client channel is 
short-lived during the duration of an API operation.

This simplifies passing of messages, because relaying responses back only to the caller gets complex when the caller 
disconnects and reconnects (and thus, the client ID changes). Additionally, a client might still wants to know what's 
going on even though it's not the direct caller (e.g. downloads should be displayed in all open browsers, not only where
the download was initiated).

When requesting connected clients from the server, the supported APIs are described for each client, so the caller knows
which actions it can request. All requests are sent through the websocket.

Worth noting is that client channels are scoped by user, i.e. a client from user A can't communicate with a client from 
user B.

### Message Format

Messages *arriving* due to a subscription ("event message") have these properties:

- `channel` - the channel to which the client was subscribed to in order to receive the message.
- `sender` - if sent by a client, this is its client ID.
- `event` - a channel-specific identifier which defines the format of the message.
- `data` - optional information about the event.
- `error` - a message describing the error in case `event` equals `error`

When *sending* a message ("action message") to a specific client's API, the structure slightly changes:

- `recipient` - the client ID of the client receiving the message (sending side)
- `sender` - the client ID of the client sending the message (receiving side)
- `action` - a channel-specific identifier which defines the format of the message
- `session_id` - a unique identifier that will be included in all messages triggered by this request.
- `data` - optional information about the action.
- `error` - a message describing the error in case `event` equals `error`
- `message` - the original erroneous message in case of a sender error


## Example

Let's take the must-have use case where a user wants to download a table and install it on the cab with one click. The 
user is logged at vpdb.io and has VPDB Agent running on the cab. The caller is the webapp and the callee is VPDB Agent.

1. When opening the release download dialog, the webapp requests the list of connected clients.
2. The server returns a list with connected clients and their supported APIs:
    ```json
    GET /v1/clients
    [
    	{
    		"client": {
    			"client_id": "1234-abcd", 
    			"app_name": "VPDB Agent", 
    			"machine_name": "My Pincab",
    			"machine_os": "win64"
    			"machine_os_version": "10"
    			"machine_host": "1.1.1.1",
    		},
    		"channels": {
    			"file_system": { 
    				"actions": [ "download_release", "download_file" ], 
    				"config": { "pinballx_enabled": true } }
    			}
    		},
    		"messages": { ... }
    	}
    ]
    ```
3. Under the download button, the user will now then see *VPDB Agent on My Pincab* listed as possible download destination.
4. In order to receive response events, the caller subscribes to the `file_system` channel (if not already done):
    ```json
    POST /v1/clients/subscribe
    { 
    	"channels": [ "file_system" ] 
    }
    ```
5. If the user selects *VPDB Agent on My Pincab*, the webapp tells the server to request the action from the callee.
    ```json
    {
    	"recipient": "1234-abcd",
    	"action": "download_release",
    	"session_id": "0987-yxyz",
    	"data": { "release": { ... }, "overwrite_if_exists": true, "update_pinballx_database": true, ... }
    }
    ```
   Note that this payload is saved on the server until the `end` or `error` event is sent, so new clients
   can retrieve currently active requests without having to wait for any new events to arrive.
6. The callee then receives the payload from the server on its websocket:
    ```json
    {
    	"sender": "abcd-1234",
       	"action": "download_release",
    	"session_id": "0987-yxyz",
    	"data": { ... }
    }
    ```    
7. The callee (VPDB Agent) connects to the server API, retrieves the data necessary for the action to execute, and 
   starts downloading the required files.
8. During the download, status updates are sent to the server:
    ```json
    {
    	"channel": "file_system",
    	"event": "download_start",
    	"session_id": "0987-yxz",
    	"data": { "file": { "type": "table_release", "name": "table.vpt" } }
    }
    ```
9. ..and received by the caller:
    ```json
    {
    	"channel": "file_system",
    	"sender": "1234-abcd",
    	"event": "download_start",
    	"session_id": "0987-yxz",
    	"data": { ... }
    }
    ```
10. After everything is downloaded, the callee announces the end of the operation:
    ```json
    {
    	"channel": "file_system",
    	"event": "end",
    	"session_id": "0987-yxz"
    }
    ```
    This results in the server removing the session and all other clients should mark the operation as completed.


### Error handling

Obviously a lot can go wrong. Sending wrong data to the websocket will result in an error with the given message object.
For example:

```json
{
	"recipient": "non-existent-id",
	"action": "download_release",
	"session_id": "0987-yxyz"
}
```

will result in a message sent to the caller:

```json
{
	"event": "error",
	"error": "Invalid client ID \"non-existent-id\"."
	"message": {
		"recipient": "non-existent-id",
		"action": "download_release",
		"session_id": "0987-yxyz"
	}
}
```

#### Caller connection breaks during request

If the caller disconnects due to bad connection, browser tab closing or anything else, it can retrieve the current 
status by calling `GET /v1/clients` after being relaunched:

```json
[
	{
		"client": { ... },
		"channels": { ... },
		"messages": {
			"file_system": [ { 
				"action": "download_release",
				"session_id": "0987-yxyz",
				"data": { ... } },
				"last_events": {
					"download_start": { "data": { ... }, "created_at": "..." }
					"download_progress": { "data": { ... }, "created_at": "..." }
				}
			} ]
		}
	}
]
```


#### Callee Errors

VPDB Agent can also lose connectivity or crash, or be closed. In either case, the websocket connection is terminated and
the server will announce it to all subscribed clients:

```json
{
	"sender": "1234-abcd",
	"channel": "download_release",
	"session_id": "0987-yxz",
	"event": "error",
	"error": "Client terminated connection."
}
```

If something happens on client side the callee can't handle (let's say disk is full during a download), it can also send
an error explictly:

```json
{
	"channel": "download_release",
	"session_id": "0987-yxz",
	"event": "error",
	"error": "Disk full. Please make some space and try again."
}
```

### Authentication

Only registered users can make use of the websocket. One way would be passing the current auth token when connecting to
the websocket as described [here](https://github.com/websockets/ws/issues/929). A good idea is probably to introduce a 
scope for realtime access, so it can be easily disabled per user.

