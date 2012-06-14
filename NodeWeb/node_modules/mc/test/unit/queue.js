
var Queue = require('../../lib/queue')
  , should = require('should');

describe('Queue', function() {
  var q;
  beforeEach(function() {
    q = new Queue();
    q.enqueue("single item");
  });
  
  describe('#count', function() {
    it('should correctly report the number of items in the queue', function() {
      q.count().should.equal(1);
    });
  });

  describe('#enqueue', function() {
    it('should add one object to the queue', function() {
      q.enqueue("second item");
      q.count().should.equal(2);
    });
  });

  describe('#dequeue', function() {
    it('should correctly remove the first item in the queue', function() {
      q.dequeue().should.equal('single item');
      q.count().should.equal(0);
    });
    it('should return undefined for an empty queue', function() {
      q.dequeue();
      should.not.exist(q.dequeue());
    });
  });

  describe('#peek', function() {
    it('should view the first item in the queue without removing it', function() {
      q.peek().should.equal('single item');
      q.count().should.equal(1);
    });
  });

  // I don't quite know how to test that we are not iterating *more* times than expected!
  describe('#iter', function() {
    it('should iterate over the full queue', function(done) {
      q.enqueue("second item");
      q.enqueue("third item");
      var count = 0;
      q.iter(function(item) {
        count++;
        switch (count) {
          case 1:
            item.should.equal("single item");
            break;
          case 2:
            item.should.equal("second item");
            break;
          case 3:
            item.should.equal("third item");
            done();
            break
          default:
            should.not.exist(item);
        }
      });
    });
  });
  
  describe('truncation', function() {
    it('should occur as expected', function() {
      q.enqueue("second");
      q.enqueue("third");
      q.enqueue("fourth");
      q.dequeue();
      q.storage.length.should.equal(4);
      q.dequeue();
      q.storage.length.should.equal(4);
      q.dequeue();
      q.storage.length.should.equal(1);
    });    
  });
  
});
