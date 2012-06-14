var sinon = require('sinon')
  , should = require('should')
  , Connection = require('../../lib/conn')
  , net = require('net');

describe('Connection', function () {
  
  var c;

  beforeEach(function() {
    c = new Connection();
    c.sock = new net.Socket();
    c.ready = true;
  });

  it('should construct successfully with valid server settings.', function() {
    var conn = new Connection('fred:1000');
    conn.host.should.equal('fred');
    conn.port.should.equal('1000');
  });
  
  it('should use a default port if not provided', function() {
    var conn = new Connection('fred');
    conn.host.should.equal('fred');
    conn.port.should.equal('11211');
  });
  
  it('should use default settings if none provided', function() {
    var conn = new Connection();
    conn.host.should.equal('localhost');
    conn.port.should.equal('11211');
  });

  it('should take the appropriate actions on restart', function() {
    c.buffer = new Buffer('123');
    c.flushQueue();
    should.not.exist(c.buffer);
    c.ready.should.equal.false;
  });

  it('should flush the queue properly.', function(done) {
    c.queue.enqueue({ callback: function(err) {
      err.type.should.equal('TEST_CODE');
      err.description.should.equal('A description');
      done();
    } });
    c.flushQueue('TEST_CODE', 'A description');
    c.queue.count().should.equal(0);
  });      

  it('should handle a write-on-bad-connection correctly', function(done) {
    c.sock = null;
    c.write(null,function(err) {
      should.exist(err);
      err.type.should.equal('CONNECTION_ERROR');
      err.description.should.equal('No Connection Available.');
      done();
    }, 'cmd');
  });
  
  it('should write a command without a value to the socket correctly', function() {
    var mock = sinon.mock(c.sock).expects('write').once().withArgs('get test\r\n');
    c.write(null, null, 'get test');
    mock.verify();
  });

  it('should write a command with a value to the socket correctly', function() {
    var buff = new Buffer('fla');
    var mock = sinon.mock(c.sock);
    mock.expects('write').once().withArgs('set\r\n');
    mock.expects('write').once().withArgs(buff);
    mock.expects('write').once().withArgs('\r\n');
    c.write(null, null, 'set', buff);
    mock.verify();
  });

  it('should read from the buffer correctly when there is no existing buffer', function() {
    var mock = sinon.mock(c).expects('processBuffer').once();
    c.read(new Buffer('12345'));
    should.exist(c.buffer);
    c.buffer.toString('utf8').should.equal('12345');
    mock.verify();
  });

  it('should read from the buffer correctly when there is an existing buffer', function() {
    var mock = sinon.mock(c).expects('processBuffer').once();  
    c.buffer = new Buffer('123');
    c.read(new Buffer('456789'));
    c.buffer.toString('utf8').should.equal('123456789');
    mock.verify();
  });

  it('should restart when receiving data with no handler', function() {
    var mock = sinon.mock(c).expects('restart').once();
    c.buffer = new Buffer('123');
    c.processBuffer();
    mock.verify();
  });

  it('should noop when there is less than a line of data to read', function() {
    c.buffer = new Buffer('123');
    c.queue.enqueue({ callback: null});
    c.processBuffer();
    c.buffer.toString('utf8').should.equal('123');
  });

  it('should correctly callback with an error on detecting an error message', function(done) {
    c.buffer = new Buffer('ERROR: Test Error\r\n');
    c.queue.enqueue({ callback: function(err) {
      should.exist(err);
      err.type.should.equal('ERROR: Test Error');
      done();
    } } );
    c.processBuffer();
  });

  it('should correctly handle a valid buffer with one exact response', function(done) {
    c.buffer = new Buffer('STORED\r\n');
    c.queue.enqueue({ callback: function(err, response) {
        should.exist(response);
        response.val.should.equal('STORED');
        done();
      }, 
      handler: function(line, buffer, adapter) {
        return { data: { val: 'STORED' },  bytes_parsed: 8 };
      } 
    } );
    c.processBuffer();
  });

  it('should correctly handle a valid buffer with more than one exact response', function(done) {
    c.buffer = new Buffer('STORED\r\nERROR: 1\r\n');
    c.queue.enqueue({ callback: function(err, response) {
        should.exist(response);
        response.val.should.equal('STORED');
      }, 
      handler: function(line, buffer, adapter) {
        return { data: { val: 'STORED' },  bytes_parsed: 8 };
      } 
    } );
    c.queue.enqueue({ callback: function(err) {
      should.exist(err);
      err.type.should.equal('ERROR: 1');
      done();
    } } );
    c.processBuffer();
  });

  it('should correctly handle a valid buffer with more than one response and leftover bytes.', function() {
    c.buffer = new Buffer('STORED\r\nERROR: 1\r\nYoYo');
    c.queue.enqueue({ callback: function(err, response) {
        should.exist(response);
        response.val.should.equal('STORED');
      }, 
      handler: function(line, buffer, adapter) {
        return { data: { val: 'STORED' },  bytes_parsed: 8 };
      } 
    } );
    c.queue.enqueue({ callback: function(err) {
      should.exist(err);
      err.type.should.equal('ERROR: 1');
    } } );
    c.queue.enqueue({ callback: function() {} } );
    c.processBuffer();
    should.exist(c.buffer);
    c.buffer.toString('utf8').should.equal('YoYo');
  });

});
