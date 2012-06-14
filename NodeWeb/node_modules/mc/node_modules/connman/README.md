
# connman

For full documentation, please visit: http://overclocked.com/connman

# connman

Connman is a very thin network connection manager for node.js. With connman you can create network connections or
pools of connections that will re-establish connection in case of interrupted connectivity. The developer retains
full and direct access to the node.js socket object. Rather than adding boilerplate code for listening to network
events and cut-n-paste retry logic, connman offers simple setup and teardown for your connections. With callbacks
for the connection event and any reset event, you can significantly simplify error management without any loss of
performance or functionality.

## Installation

    npm install connman

## Usage

### Connect to a single resource

Setting up a connection has five required parameters. Host and port, obviously. The following three callbacks are
the interesting part:

*onConnect* : Called when the initial connection is established. This takes as one parameter node's socket object
which the application can use for writing, additional configuration, or adding additional listeners. Connman will
already have added all listeners required for handling interesting network abnormalities.

*onReset* : This is called when a network connection is lost. You must provide this, but it may be a no-op if you
don't care to do anything. Some applications might want to drop a queue of callbacks waiting for server responses
that are now never going to arrive, or suspend writes until the connection is re-established. When onReset passes
back a function, this function is called when the connection is re-established. If none is passed back, onConnect
will be called again when the connection is re-established.

*onData* : This is called whenever there is new data to be read from the socket. onData takes one parameter - the
buffer containing server response.

So:

*connect(port, host, onConnect, onData, onReset, [options])*

Note that the optional options are the same as in the node.js socket constructor. Most use cases will not need to
pass in options.

The following example demonstrates access to a single socket.

    var cm = require('connman');

    var sock;

    function useSocket() {
      // Business logic that may involve writing to the socket.
    }

    function onData(buff) {
      // read data from the socket asynchronously.
    }

    // Callback to receive a newly created socket.
    function onConnect(socket) {
      sock = socket;
      useSocket();
    }

    // Callback to handle any cleanup in the case of a network reset...
    // This might be dropping or requeuing outstanding server requests waiting for a reply.
    function onReset() {
      // Cleanup.
      return useSocket; // Hand back a new starting point.
    }

    cm.connect(11211, 'my.memcache.server.company.com', onConnect, onReset, onData);

### Using your socket.

    function onData(buffer) {
      console.log(buffer.toString('utf8');
    }
    function onConnect(socket) {
      for(var i = 0; i < 100; i++) {
        socket.write('ping\r\n');
      }
    }

### Finding your socket

If you need to access the socket object, you can always ask connman for it:

    cm.getConnection(port, host);

### Creating a pool

    var myPool = cm.createPool('myPool');

### Finding a pool

    var myPool = cm.getPool('myPool');

### Adding a connection to a pool

    myPool.addConnection(port, host, onConnect, onReset, onData, options);

### Shutting things down

Note that using the node library's socket.end() will not have the desired effect: the library will just reconnect
immediately! Instead, use disconnect().

    // Close an individual socket:
    socket.disconnect();

    // Close all sockets in a pool:
    cm.getPool('myConnectionPool').disconnect();

    // Close all sockets managed by connman:
    cm.disconnectAll();



