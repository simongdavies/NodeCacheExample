
function Queue() {
  this.offset = 0;
  this.storage = [];
}

Queue.prototype.enqueue = function (obj) {
  this.storage.push(obj);
};

Queue.prototype.dequeue = function() {
  var obj = this.storage[this.offset++];
  if (this.offset * 2 > this.storage.length) {
    this.storage = this.storage.slice(this.offset);
    this.offset = 0;
  }
  return obj;
};

Queue.prototype.pop = function() {
  return this.storage.pop();
};

Queue.prototype.peek = function () {
  return this.storage[this.offset];
};

Queue.prototype.iter = function (cb) {
  for (var i = this.offset; i < this.storage.length; i++) {
    cb(this.storage[i]);
  }
};

Queue.prototype.count = function() {
  return this.storage.length - this.offset;
};

module.exports = Queue;
