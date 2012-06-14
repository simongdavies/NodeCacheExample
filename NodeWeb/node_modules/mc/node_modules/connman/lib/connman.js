
// Only dependency here is on the core node.js module.
var net = require('net');

// Creating a connection object will also open the connection, if possible.
//
// Inputs to create a connection are port and host, of course, as well as three
// callbacks to handle the onOpen, onData, and onReset situations. The options
// parameter, usually omitted, is passed directly to the Socket constructor: see
// node.js documentation for details.
//
// The onOpen will be called after a successful connection is established.
// The onReset callback is used when a connection is lost for any reason.
// The onData callback will be used whenever the connection has data buffered
// for reading.
function Connection(port, host, onOpen, onData, onReset, options) {
  if (!port) throw "Port is required to connect.";
  this.port    = port;
  this.host    = host || '127.0.0.1';
  this.backoff = 10;
  this.retry   = true;
  this.onReset = onReset;
  this.onOpen  = onOpen;
  this.onData  = onData;
  this.createSocket(options);
  this.connect();
}

// Reconnect uses a standard exponential backoff. The only time that connman
// does *not* reconnect is when the retry flag is unset, which only happens
// when disconnect is called explicitly. Attempts to connect to a non-existent
// or misconfigured host will continue to retry forever. Clients are advised
// to detect this situation.
Connection.prototype.reconnect = function() {
  if (!this.retry) { return; }
  if (this.backoff < 128000) {
    this.backoff *= 2;
  }
  var that = this;
  setTimeout(function () {
    that.connect();
  }, this.backoff);
};

// Because connman re-uses sockets, the heavy lifting is all done at create time.
Connection.prototype.connect = function() {
  if (!this.retry) return;
  this.sock.connect(this.port, this.host);
};

// Creating the socket registers all callbacks for the life of the socket object,
// which will be used over multiple connections to the dedicated host:port. The
// callbacks are registered on creation, including the 'connect' event handler.
Connection.prototype.createSocket = function (options) {
  var sock = new net.Socket(options);
  var that = this;
  // We add a disconnect method to the socket to handle a variety of circumstances:
  // First, the built in end method is itself called in error cases, making it
  // unsuitable for a controlled shutdown. Secondly, we want to handle cases in
  // which the socket has not actually been established yet, so rather than trying
  // to 'end' a socket that is not yet established, we simply add a sock.end to
  // the 'connect' event -- as soon as it is established, it will be correctly and
  // permanently terminated.
  sock.disconnect = function() {
    that.retry = false;
    // See https://github.com/joyent/node/blob/master/lib/net.js
    switch (sock.readyState) {
      case 'opening':
        sock.addListener('connect', function () {
          sock.end();
        });
        break;
      case 'open':
      case 'readOnly':
      case 'writeOnly':
        sock.end();
        break;
      case 'closed':
        break;
      default:
    }
  };

  // Should a different entry point be required after the initial connect for
  // a revived socket, that entry point should be passed back by the onReset
  // callback.
  sock.on('close', function() {
    var newStart = that.onReset();
    if (newStart) {
      that.onOpen = newStart;
    }
    that.reconnect();
  });

  // Error always leads to close, so this is a noop to prevent thrown errors.
  sock.on('error', function() {
  });

  // on Data is the entry point for data received on the connection:
  // This event calls back to the client.
  sock.on('data', this.onData);

  // We only want one connection listener in case of reconnect, so we add the listener on create.
  sock.on('connect', function() {
    that.backoff = 50; // Reset backoff on success
    that.onOpen(sock);
  });
  this.sock = sock;
};

// A pool is simply an array of connections.
function Pool() {
  this.conns = [];
}

// Adding a connection to a pool establishes the connection.
Pool.prototype.addConnection = function(port, host, onOpen, onReset, onData, options) {
  this.conns.push(new Connection(port, host, onOpen, onReset, onData, options));
};

// Access to the connections is available.
Pool.prototype.getConnections = function() {
  return this.conns;
};

// Disconnecting from a pool disconnects from all connections in the pool.
Pool.prototype.disconnect = function() {
  for (var i = 0; i < this.conns.length; i++) {
    this.conns[i].sock.disconnect();
  }
};

// The objects above are not directly exposed by the module interface, instead,
// the factory methods are:
module.exports = ( function() {
  var pools = {};
  var conns = {};
  me = {
    // Create a single connection.
    connect: function(port, host, onOpen, onData, onReset, options) {
      var conn = new Connection(port, host, onOpen, onData, onReset, options);
      conns[host + ':' + port] = conn;
    },
    // Obtain the connection by host and port.
    getConnection: function(port, host) {
      return conns[host + ':' + port];
    },
    // Create a pool, poolName is required to retrieve it later.
    createPool: function(poolName) {
      pools[poolName] = new Pool();
      return pools[poolName];
    },
    // And the retrieval method.
    getPool: function(poolName) {
      return pools[poolName];
    },
    // Disconnect from all connections, either individual or in pools.
    disconnectAll: function() {
      var key;
      for (key in pools) {
        if (pools.hasOwnProperty(key)) {
          pools[key].disconnect();
        }
      }
      for (key in conns) {
        if (conns.hasOwnProperty(key)) {
          conns[key].sock.disconnect();
        }
      }
    }
  };
  return me;
}());


// I'm a hustler. And my hustle is trying to figure out the best ways to do what I like
// without having to do much else. -- Mos Def
