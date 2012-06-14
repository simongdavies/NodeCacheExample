var sinon = require('sinon')
  , should = require('should')
  , mc = require('../../lib/memcache-client')
  , net = require('net');

var count = 1;

function readFromServer(iter, cli) {
  var delay = Math.floor(Math.random() * 3000);
  var key = 'k' + iter;
  setTimeout(function () {
    cli.get(key, function (err, response) {
      if (err) {
	// Hack.
        if (err.type !== 'NOT_FOUND' && err.type !== 'CONNECTION_ERROR') {
          console.log(err);
          err.type.should.equal('CONNECTION_ERROR');
	}
      }
      else {
        response[key].should.equal(iter + '€100');
      }
      count++;
    });
  }, delay);
}

describe('MemcacheClient', function () {
  it("should handle a dropped collection without data corruption", function (done) {
    var cli = new mc.Client();    
    cli.connect(function () {
      for (var i = 1; i <= 50000; i++) {
        cli.set('k' + i, i + '€100', function (err, response) {
          if (err) {            
            err.type.should.equal('CONNECTION_ERROR');
          }
          else {
            response.should.equal('STORED');
          }
        });
        readFromServer(i, cli);
      }
    });
    setTimeout(function () {
      cli.connections[0].restart();
    }, 200);
    var t = setInterval(function () {
      if (count >= 50000) {
        clearInterval(t);
        cli.disconnect();
        done();
      }
    }, 500);
  });
});
