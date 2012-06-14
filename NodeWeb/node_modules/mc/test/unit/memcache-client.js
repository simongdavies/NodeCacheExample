var sinon = require('sinon')
  , should = require('should')
  , mc = require('../../lib/memcache-client')
  , net = require('net');

describe('MemcacheClient', function () {

  var cli;

  beforeEach(function () {
    cli = new mc.Client("1.2.3.4:1001");
  });

  it("should exist after construction", function () {
    cli.should.exist;
  });

  it("solo strategies should always return 0", function() {
    mc.Strategy.solo().should.equal(0);
  });

  it("hash strategies should return as expected", function() {
    mc.Strategy.hash("Hello World", 16).should.equal(6);
  });

  it("raw adapter should add val property", function() {
    var test = { buffer: new Buffer("12345") };
    mc.Adapter.raw(test);
    test.val.should.equal("12345");
  });

  it("json adapter on valid json should return correct structure", function() {
    var test = { buffer: new Buffer("{ \"thing\": \"one\" }") };
    var result = mc.Adapter.json(test);
    should.exist(result.thing);
    result.thing.should.equal("one");
  });

  it("jason adapter on invalid json should return correct structure", function() {
    var test = { buffer: new Buffer("{ \"thing\"") };
    var result = mc.Adapter.json(test);
    should.exist(result.val);
    result.val.should.equal("{ \"thing\"");
  });

  it("binary adapter should return correct buffer", function() {
    var test = { buffer: new Buffer("12345") };
    var result = mc.Adapter.binary(test);
    result.toString('utf8').should.equal("12345");
  });

  it("string adapter should return correct value", function() {
    var test = { buffer: new Buffer("12345") };
    var result = mc.Adapter.string(test);
    result.should.equal("12345");
  });

  it("construction with one server should select the appropriate defaults", function() {
    cli.adapter.should.equal(mc.Adapter.string);
    cli.connections.length.should.equal(1);
    cli.strategy.should.equal(mc.Strategy.solo);
  });

  it("construction with multiple servers should select the appropriate defaults", function() {
    cli = new mc.Client(["1.2.3.4:1001","2.3.4.5:1001"]);
    cli.connections.length.should.equal(2);
    cli.strategy.should.equal(mc.Strategy.hash);
  });

  it("should enforce maximum time to live", function() {
    try {
      cli.setTimeToLive(5000000000);
      should.not.exist(cli); // If this gets called, it's broke.	
    } catch (x) {
      should.exist(x);
      x.should.equal('Invalid Time To Live: Max 2592000 (30 Days)');
    }
  });
  
  it("should connect to all servers properly", function() {
    cli = new mc.Client(["1.2.3.4:1001","2.3.4.5:1001"]);
    var mock1 = sinon.mock(cli.connections[0]).expects('open').once();
    var mock2 = sinon.mock(cli.connections[1]).expects('open').once();
    cli.connect(function() {});
    mock1.verify();
    mock2.verify();
  });

  it("should disconnect from all servers properly", function() {
    cli = new mc.Client(["1.2.3.4:1001","2.3.4.5:1001"]);
    var mock1 = sinon.mock(cli.connections[0]).expects('close').once();
    var mock2 = sinon.mock(cli.connections[1]).expects('close').once();
    cli.disconnect();
    mock1.verify();
    mock2.verify();
  });

  it("should callback correctly on all servers connect", function(done) {
    cli = new mc.Client(["1.2.3.4:1001","2.3.4.5:1001"]);
    var stub = { open: function(cb) { cb(); } };
    cli.connections[0] = stub;
    cli.connections[1] = stub;
    cli.connect(function() { done(); });
  });

  it("should redirect get requests with array keys correctly", function() {    
    var func = function() {};
    var keys = ['key1', 'key2'];
    var mock = sinon.mock(cli).expects('multiGet').once().withArgs(keys,'get',func);
    cli.get(keys, func);
    mock.verify();
  });
  
  it("should handle get requests for a single key correctly", function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('get test1');
      done();
    });	
    cli.get("test1", cb);
  });
 
  it("should handle requests for multiple keys correctly", function(done) {
    var cb = function() { return 1; };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('get test1 test2');
      done();
    });	
    cli.multiGet(["test1", "test2"], 'get', cb);
  });

  it("should handle gets requests correctly", function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('gets test1');
      done();
    });	
    cli.gets("test1", cb);    
  });

  it('should route set requests correctly', function() {
    var cb = function() {};
    var opts = { opt: 'optVal'};
    var mock = sinon.mock(cli).expects('store').once().withArgs('set', 'key', 'val', opts, cb);
    cli.set('key', 'val', opts, cb);
    mock.verify();
  });

  it('should route add requests correctly', function() {
    var cb = function() {};
    var mock = sinon.mock(cli).expects('store').once().withArgs('add', 'key', 'val', cb, undefined);
    cli.add('key', 'val', cb);
    mock.verify(); 
  });

  it('should route replace requests correctly', function() {
    var cb = function() {};
    var opts = { opt: 'optVal'};
    var mock = sinon.mock(cli).expects('store').once().withArgs('replace', 'key', 'val', opts, cb);
    cli.replace('key', 'val', opts, cb);
    mock.verify();
  });

  it('should route append requests correctly', function() {
    var cb = function() {};
    var opts = { opt: 'optVal'};
    var mock = sinon.mock(cli).expects('store').once().withArgs('append', 'key', 'val', opts, cb);
    cli.append('key', 'val', opts, cb);
    mock.verify();
  });

  it('should route prepend requests correctly', function() {
    var cb = function() {};
    var opts = { opt: 'optVal'};
    var mock = sinon.mock(cli).expects('store').once().withArgs('prepend', 'key', 'val', opts, cb);
    cli.prepend('key', 'val', opts, cb);
    mock.verify();
  });
  
  it('should route cas requests correctly with options present', function() {
    var cb = function() {};
    var opts = { opt: 'optVal'};
    var mock = sinon.mock(cli).expects('store').once().withArgs('cas', 'key', 'val', { opt: 'optVal', cas: 12345 }, cb);
    cli.cas('key', 'val', 12345, opts, cb);
    mock.verify();    
  });

  it('should route cas requests correctly with options absent', function() {
    var cb = function() {};
    var mock = sinon.mock(cli).expects('store').once().withArgs('cas', 'key', 'val', { cas: 12345 }, cb);
    cli.cas('key', 'val', 12345, cb);
    mock.verify();    
  });

  it('should handle storage of an invalid key correctly', function(done) {
    var key = 'key012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789' +
      '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789' +
      '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
    cli.store('add', key, 'val', function(err) {
      should.exist(err);
      err.type.should.equal('CLIENT_ERROR');
      err.description.should.equal('Key too long, max 250 char');
      done();
    });
  });

  it('should handle storage calls correctly with no options', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd, val) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('set key 0 0 3');
      val.toString('utf8').should.equal('val');
      done();
    });	
    cli.store("set", "key", "val", cb);    
	 
  });

  it('should handle storage calls correctly with the cas options', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd, val) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('set key 0 0 3 12345');
      val.toString('utf8').should.equal('val');
      done();
    });	
    cli.store("set", "key", "val", { cas: 12345 }, cb);    	 
  });

  it('should handle storage calls correctly with the flags options', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd, val) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('set key 7 0 3');
      val.toString('utf8').should.equal('val');
      done();
    });	
    cli.store("set", "key", "val", { flags: 7 }, cb);    	 
  });

  it('should handle storage calls correctly with the exptime option', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd, val) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('set key 7 5 3');
      val.toString('utf8').should.equal('val');
      done();
    });	
    cli.store("set", "key", "val", { flags: 7, exptime: 5 }, cb);    	 
  });

  it('should handle storage calls correctly with a default ttyl', function(done) {
    var cb = function() {};
    cli.setTimeToLive(7000); // 7000 second cache.
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd, val) {
      var expire = Math.floor(new Date().getTime() / 1000) + 7000;
      var cmdMatch = 'set key 7 ' + expire + ' 3';
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal(cmdMatch);
      val.toString('utf8').should.equal('val');
      done();
    });	
    cli.store("set", "key", "val", { flags: 7 }, cb);    	 
  });

  it('should error on invalid time to live on storage', function(done) {
    var cb = function(err) {
      should.exist(err);
      err.type.should.equal('INVALID_EXPIRATION_TIME');
      done();
    };
   cli.store("set", "key", "val", { exptime: 2592001 }, cb);
  });

  it('should handle incr calls with default params correctly.', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('incr test1 1');
      done();
    });	
    cli.incr("test1", cb);    
  });  

  it('should handle incr calls with explicit params correctly.', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('incr test1 23');
      done();
    });	
    cli.incr("test1", 23, cb);    
  });  


  it('should handle decr calls with default params correctly.', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('decr test1 1');
      done();
    });	
    cli.decr("test1", cb);    
  });  

  it('should handle decr calls with explicit params correctly.', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('decr test1 23');
      done();
    });	
    cli.decr("test1", 23, cb);    
  });  

  it('should handle delete calls correctly.', function(done) {
    var cb = function() {};
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      should.exist(processor);
      cb.should.equal(cb);
      cmd.should.equal('delete test1');
      done();
    });	
    cli.del("test1", cb);    
  });  

  it('should handle version calls correctly.', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val.length.should.equal(1)
      val[0].should.equal( '10.0' );
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, assembler, cmd) {
      assembler(null, '10.0');
    });
    cli.version(cb);
  });

  it('should handle version calls correctly with multiple connections.', function(done) {
    var cli = new mc.Client(['1.2.3.4', '2.3.4.5']);
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val.length.should.equal(2)
      val[0].should.equal( '10.0' );
      val[1].should.equal( '11.0' );
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, assembler, cmd) {
      assembler(null, '10.0');
    });
    var stub = sinon.stub(cli.connections[1], "write", function(processor, assembler, cmd) {
      assembler(null, '11.0');
    });
    cli.version(cb);
  });

  it('should handle stats calls correctly.', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val.length.should.equal(1)
      val[0].should.equal( 'STATS-0' );
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, assembler, cmd) {
      assembler(null, 'STATS-0');
    });
    cli.version(cb);
  });

  it('should handle stats calls correctly with multiple connections.', function(done) {
    var cli = new mc.Client(['1.2.3.4', '2.3.4.5']);
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val.length.should.equal(2)
      val[0].should.equal( 'STATS-0' );
      val[1].should.equal( 'STATS-1' );
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, assembler, cmd) {
      assembler(null, 'STATS-0');
    });
    var stub = sinon.stub(cli.connections[1], "write", function(processor, assembler, cmd) {
      assembler(null, 'STATS-1');
    });
    cli.version(cb);
  });

  it('should handle parsing of a valid numeric response correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val.should.equal(10);
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var results = processor({ str: "10"});
      cb(results.error, results.data);
    });	
    cli.decr("test1", cb);    
  });

  it('should handle parsing of a non-existent numeric response correctly', function(done) {
    var cb = function(err, val) {
      should.exist(err);
      should.not.exist(val);
      err.type.should.equal("NOT_FOUND");
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var results = processor({ str: "NOT_FOUND"});
      cb(results.error, results.data);
    });	
    cli.decr("test1", cb);    
  });

  it('should handle parsing of an error numeric response correctly', function(done) {
    var cb = function(err, val) {
      should.exist(err);
      should.not.exist(val);
      err.type.should.equal("CLIENT_ERROR");
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var results = processor({ str: "CLIENT_ERROR"});
      cb(results.error, results.data);
    });	
    cli.decr("test1", cb);    
  });

  it('should handle parsing of a valid min-response correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val.should.equal("STORED");
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var results = processor({ str: "STORED"});
      cb(results.error, results.data);
    });	
    cli.set("test1", "val", cb);    
  });

  it('should handle parsing of an error min-response correctly', function(done) {
    var cb = function(err, val) {
      should.exist(err);
      should.not.exist(val);
      err.type.should.equal("EXISTS");
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var results = processor({ str: "EXISTS"});
      cb(results.error, results.data);
    });	
    cli.add("test1", "val", cb);    
  });

  it('should handle parsing of a valid get correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val.test1.should.equal("value18");
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var buffer = new Buffer('VALUE test1 0 7\r\nvalue18\r\nEND\r\n', 'utf8');
      var results = processor({ str: "VALUE test1 0 7", next: 17}, buffer, mc.Adapter.string);
      cb(results.error, results.data);
    });	
    cli.get("test1", cb);    
  });

  it('should handle parsing of a get on a non-existent key correctly', function(done) {
    var cb = function(err, val) {
      should.exist(err);
      should.not.exist(val);
      err.type.should.equal("NOT_FOUND");
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var results = processor({ str: "END"});
      cb(results.error, results.data);
    });	
    cli.gets("test1", cb);    
  });

  it('should handle parsing of stats correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      should.exist(val[0].pid);
      val[0].pid.should.equal('12345');
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var buff = new Buffer('STAT pid 12345\r\nEND\r\n');
      var results = processor({}, buff);
      cb(results.error, results.data);
    });
    cli.stats(cb);
  });

  it('should handle parsing of items stats correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      should.exist(val[0].slabs);
      val[0].slabs[1].number.should.equal('76747');
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var buff = new Buffer('STAT items:1:number 76747\r\nEND\r\n');
      var results = processor({}, buff);
      cb(results.error, results.data);
    });
    cli.stats('items', cb);
  });

  it('should handle parsing of slabs stats correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      should.exist(val[0].slabs);
      val[0].slabs[1].mem_requested.should.equal('5804321');
      val[0].active_slabs.should.equal('1');
      val[0].total_malloced.should.equal('8388096');
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var buff = new Buffer('STAT 1:mem_requested 5804321\r\n'
			    + 'STAT active_slabs 1\r\n'
			    + 'STAT total_malloced 8388096\r\nEND\r\n');
      var results = processor({}, buff);
      cb(results.error, results.data);
    });
    cli.stats('slabs', cb);
  });

  it('should handle parsing of sizes stats correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      should.exist(val[0].bytes);
      should.exist(val[0].items);
      val[0].bytes.should.equal('96');
      val[0].items.should.equal('76747');
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var buff = new Buffer('STAT 96 76747\r\nEND\r\n');
      var results = processor({}, buff);
      cb(results.error, results.data);
    });
    cli.stats('sizes', cb);
  });

  it('should handle parsing of version correctly', function(done) {
    var cb = function(err, val) {
      should.not.exist(err);
      should.exist(val);
      val[0].should.equal('1.4.5');
      done();
    };
    var stub = sinon.stub(cli.connections[0], "write", function(processor, cb, cmd) {
      var results = processor({str: 'VERSION 1.4.5'});
      cb(results.error, results.data);
    });
    cli.version(cb);
  });



});
