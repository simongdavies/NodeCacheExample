var net = require('net');

var server = net.createServer(function(c) { //'connection' listener
  c.on('end', function() {});
  c.write('hello\r\n');
  c.pipe(c);
});
server.on('connection', function(conn) {
  setTimeout(function() {
    conn.end();
  },5000);
});
server.listen(8124);

setTimeout(function() {
  server.close();
},30000);
