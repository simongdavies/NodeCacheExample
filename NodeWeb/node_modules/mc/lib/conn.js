var net = require('net'),
    Queue = require('./queue'),
    cm = require('connman');

// Commonly used in the memcache protocol.
var crlf = '\r\n';

// Connection
// ----------
//
// The memcache client keeps open connections to all servers in the cluster. A connection object manages all 
function Connection(server, adapter) {
  if (server) {
    var hostElems = server.split(':');
    this.host = hostElems[0] || 'localhost';
    this.port = hostElems[1] || '11211';      
  } else {
    this.host = 'localhost';
    this.port = '11211';
  }
  this.buffer  = undefined;
  this.queue   = new Queue(); // Request Queue
  this.sock    = undefined;   // Our socket to the server.
  this.adapter = adapter;
  this.ready   = false;
}

// Open creates the actual socket and establishes our readiness to use.
// The callback is called when connected.
Connection.prototype.open = function(cb) {
  var that = this;
  cm.connect(this.port, this.host, function(sock) {
    that.sock = sock;
    that.ready = true;
    if (cb) cb();
  }, function(data) { that.read(data); }
  ,  function() { that.flushQueue(); });
};

// Disconnects the socket.
Connection.prototype.close = function () {
  this.ready = false;
  this.sock.disconnect();
};

Connection.prototype.restart = function() {
  this.close();
  this.open();
}

// Flush Queue:
// Eliminate all pending requests expecting a reply. We lost our connection, they are not going to arrive.
Connection.prototype.flushQueue = function () {
  this.ready = false;
  this.buffer = undefined;
  var lost = this.queue.dequeue();
  var count = 0;
  while (lost) {
    count++;
    lost.callback({
      type: "CONNECTION_ERROR",
      description: "Lost Connection to Server"
      }, null);
    lost = this.queue.dequeue();
  }
  return function() { this.ready = true; }
};

// Write to the socket, with appropriate checks around socket availability.
Connection.prototype.write = function (handler, callback, command, value) {
  // Lost our connection. Expect the error callback to be handled by error event, not here.
  if (!this.sock || !this.ready) {
    callback({ type: 'CONNECTION_ERROR', description: 'No Connection Available.'}, null);
    return;
  }
  try {
    this.sock.write(command + crlf);
    if (value) {
      this.sock.write(value);
      this.sock.write(crlf);
    }
    this.queue.enqueue({ handler: handler, callback: callback });
  }
  catch (x) {
    callback({ type: 'CONNECTION_ERROR', description: 'Lost connection to server.' }, null);
  }
};

// Read from the socket, called via connman when data is available.
Connection.prototype.read = function (data) {
  var buff = data;
  if (this.buffer && this.buffer.length > 0) { // We have pending data from server : merge
    buff = new Buffer(this.buffer.length + data.length);
    this.buffer.copy(buff);
    data.copy(buff, this.buffer.length);
  }
  this.buffer = buff;
  this.processBuffer();
};

function process_line(buffer, start) {
  var i = start || 0;
  var max = buffer.length - 1;
  while (i < max) {
    if (buffer[i] === 0x0d && buffer[i + 1] === 0x0a) {
      return {
        str: buffer.toString('utf8', start, i),
        next: i + 2
      };
    }
    i++;
  }
  return {
    str: null,
    next: -1
  };
}

// For each buffer load, process each response in the buffer,
// And handle incomplete loads.
Connection.prototype.processBuffer = function () {
  while (this.buffer.length > 0) {
    var dispatcher = this.queue.peek();
    if (!dispatcher) {
      // Something is seriously wrong! We are receiving data unexpectedly.
      this.restart();
      break;
    }
    var peekResponse = process_line(this.buffer);
    if (!peekResponse.str) { // No full line available. Need more data off the wire.
      break;
    }
    else if (peekResponse.str.substr(0, 5) === 'ERROR') {
      this.buffer = this.buffer.slice(peekResponse.next);
      this.queue.dequeue().callback({
        type: peekResponse.str,
        description: 'Response Error'
      }, null);
    }
    else {
      var results = dispatcher.handler(peekResponse, this.buffer, this.adapter);

      if (results.bytes_parsed == -1) { // Do nothing. Need more data.
        break; // Wait for a new data event.
      } else {
        this.buffer = this.buffer.slice(results.bytes_parsed);
        this.queue.dequeue();
        dispatcher.callback(results.error, results.data);
      }
    }
  }
};

module.exports = Connection;
