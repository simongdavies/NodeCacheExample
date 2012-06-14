var cm = require('../lib/connman.js');

function runner() {

  var pinger;
  setTimeout(function() {
    cm.disconnectAll();
  },30000); // 30 Second Run.

  function onRead(buff) {
    console.log("D1 GOT: " + buff.toString('utf8'));
  }

  function onConnect(sock) {
    pinger = setInterval(function() {
      try {
        sock.write("Pride before fall.\r\n");
      } catch (ex) {
        // connman should handle & recover any serious socket problems.
      }
    }, 500);
  }

  function onReset() {
    clearInterval(pinger);
    return onConnect;
  }

  var p2;
  function c2(sock) {
    p2 = setInterval(function() {
      try {
        sock.write("Baby doll.\r\n");
      } catch(ex) {
        // Again nothing here.
      }
    }, 400);
  }

  function r2() {
    clearInterval(p2);
    return c2;
  }

  function  d2(buff) {
    console.log("D2 Got: " + buff.toString('utf8'));
  }

  var p3;
  function c3(sock) {
    p3 = setInterval(function() {
      try {
        sock.write("Bingo hall.\r\n");
      } catch(ex) {
        // Again nothing here.
      }
    }, 700);
  }

  function r3() {
    clearInterval(p3);
    return c3;
  }

  function  d3(buff) {
    console.log("D3 Got: " + buff.toString('utf8'));
  }

  var p4;
  function c4(sock) {
    p4 = setInterval(function() {
      try {
        sock.write("Basketball.\r\n");
      } catch(ex) {
        // Again nothing here.
      }
    }, 600);
  }

  function r4() {
    clearInterval(p4);
    return c4;
  }

  function  d4(buff) {
    console.log("D4 Got: " + buff.toString('utf8'));
  }

  cm.connect(8124, '127.0.0.1', onConnect, onRead, onReset);
  cm.connect(8124, 'localhost', c2, d2, r2);
  var pool = cm.createPool('pool');
  pool.addConnection(8124, '127.0.0.1', c3,d3,r3);
  pool.addConnection(8124, 'localhost', c4,d4,r4);
}

runner();



