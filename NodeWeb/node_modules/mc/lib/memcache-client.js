//    mc - the Memcache Client for Node
//    
//    Flexible support for application driven clustering and content types with no-hassle networking.

// The memcache library abstracts connections into a separate class for handling socket IO.
var Connection = require('./conn');

// Strategy
// --------
//
// Strategies are used for associating keys with specific memcache servers across a cluster. Only a basic hashing
// strategy is provided with this implementation, with the expectation that most application developers will want
// to provide application specific strategies. A strategy is a function that takes two parameters: a string (key)
// and an integer representing the size of server cluster. This function should return an index into the cluster.
var Strategy = {};

// CRC table, for the common hashing algorithm.
var crcTable = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";     

// The hash strategy uses CRC, which is actually not the most performant in javascript. For better performance,
// the user may want to implement a smarter hashing strategy.
Strategy.hash = function(key, max) {  
  var crc = 0; 
  var num = 0; 
  var hex = 0; 
  crc = crc ^ (-1);
  var len = key.length; 
  for (var i = 0; i < len; i++ ) {
    num = ( crc ^ key.charCodeAt( i ) ) & 0xFF; 
    hex = "0x" + crcTable.substr( num * 9, 8 ); 
    crc = ( crc >>> 8 ) ^ hex; 
  } 
  crc = Math.abs( crc ^ -1 );
  return crc % max;
};

// In the case of a single memcache server, we optimize everything else away.
Strategy.solo = function() {
  return 0;
};

module.exports.Strategy = Strategy;

// Adapter
// -------
//
// Adapters are content processors for get calls. The philosophy here is that the application convenience is king
// and the application developer should have all the tools to make the application a clean, readable, performant,
// and correct expression. This library provides a small set of convenience adapters for the most common uses but
// the real intent for application developers to provide adapters for more typical industrial conditions such as,
// for example, compressed json structures.
//
// The adapter should take a results structure (defined below), and it should return a value that the application
// will expect.
var Adapter = {};

// The raw adapter adds a string 'val' property to the results structure. The results structure is:
//     { buffer: <a buffer object containing the value returned from the server>,
//       flags:  <the flags set on the object>,
//       size:   <the number of bytes in the buffer>,
//     }
Adapter.raw = function(results) {
  results.val = results.buffer.toString('utf8');
  return results;
};

// The json adapter assumes that the value is a valid json string, and returns a javascript object. If the string
// is NOT valid json, the result is an object with the val property referencing the actual value.
Adapter.json = function(results) {
  try {
    return JSON.parse(results.buffer.toString('utf8'));      
  } catch (x) {
    return { val: results.buffer.toString('utf8') };
  }
};

// The binary adapter simply returns the buffer as is, discarding the flags and size information.
Adapter.binary = function(results) {
  return results.buffer;
};

// The string adapter returns the string representation of the value.
Adapter.string = function(results) {
  return results.buffer.toString('utf8');
};

// Built-in adapters are made available to application developers to hand to the memcache client, or cluster.
module.exports.Adapter = Adapter;

// Client
// ------
//
// The Client is the heart of the matter.
//
// The client initializes with a list of servers, an optional adapter, and an optional strategy.
function Client(servers, adapter, strategy) {
  this.adapter = adapter || Adapter.string;
  this.ttl = 0;         // Default time to live = forever.
  this.connections = [];
  if (Array.isArray(servers)) {
    for (var s in servers) {
      var server = servers[s];
      this.connections.push(new Connection(server, this.adapter));
    }      
  } else {
    this.connections.push(new Connection(servers, this.adapter));
  }
  if (this.connections.length == 1) { this.strategy = Strategy.solo; }
  else {this.strategy = strategy || Strategy.hash; }
}

// The memcached software puts a hard limit of 30 days on the ttl for keys -- or infinite.
Client.prototype.setTimeToLive = function (ttl) {
  if (ttl > 2592000) {
    throw "Invalid Time To Live: Max 2592000 (30 Days)";
  }
  this.ttl = ttl;
};

// The adapter may be set or reset at any time.
Client.prototype.setAdapter = function(adapter) {
  this.adapter = adapter;
  for (var c in this.connections) {
    this.connections[c].setAdapter(adapter);
  }
};

// After initializing the client, connect should be called. Connect will call back when
// all desired connections are established.
Client.prototype.connect = function (cb) {
  var count  = this.connections.length;
  for (var c in this.connections) {
    var connection = this.connections[c];
    connection.open(function() {
      count--;
      if (count === 0) { cb(); }
    });
  }
};

// To properly shut down, disconnect should be called.
Client.prototype.disconnect = function() {
  for (var c in this.connections) {
    this.connections[c].close();
  }
};

// Individual connections may be accessed.
Client.prototype.getConnection = function(key) {
  return this.connections[this.strategy(key, this.connections.length, this)];
};

// Multi get will take an array of keys and return values for any keys memcache
// has data for. Because this may not be all the keys requested, the object passed
// to the callback will be indexed by key.
Client.prototype.multiGet = function(keys, command, cb) {
  var buckets = [];
  var count = 0;
  for (var k in keys) {
    var key = keys[k];
    var bucket = this.strategy(key, this.connections.length, this);
    if (buckets[bucket]) { buckets[bucket] += (' ' + key); }
    else {
      count++; // New bucket!
      buckets[bucket] = key; 
    }
  }
  for (var i = 0; i < buckets.length; i++) {
    if (buckets[i]) {
      this.connections[i].write(process_get, cb, command + ' ' + buckets[i]);
    }
  }
};

// The simple case. Get a value.
Client.prototype.get = function (key, cb) {
  if (Array.isArray(key)) {
    this.multiGet(key, 'get', cb);
  } else {
    this.getConnection(key).write(process_get, cb, 'get ' + key);
  }
};

// Gets is nearly as simple, but it will also get the checksum used to validate
// a check-and-set write call.
Client.prototype.gets = function (key, cb) {
  if (Array.isArray(key)) {
    this.multiGet(key, 'gets', cb);
  } else {
    this.getConnection(key).write(process_get, cb, 'gets ' + key);
  }
};

// All the usual write operations get channeled through this method.
Client.prototype.store = function (operation, key, val, opts, cb) {
  var exptime = 0;
  var flags = 0;
  var cas;
  if (!cb) { cb = opts; }
  else {
    if (opts.exptime && opts.exptime > 2592000) {
      cb({ type: 'INVALID_EXPIRATION_TIME', description: 'Value ' + opts.exptime + ' exceeds max of 2592000'} );
      return;
    }
    exptime = opts.exptime || (this.ttl ? Math.floor((new Date()).getTime() / 1000) + this.ttl : 0);
    flags = opts.flags || 0;
    cas = opts.cas;
  }
  // Ensure any numeric values are expressed as a string.
  key = String(key);
  if (typeof val === "number") { val = String(val); }
  if (typeof val === "string") { val = new Buffer(val); }
  if (key.length > 250) {
    cb({
      type: 'CLIENT_ERROR',
      description: 'Key too long, max 250 char'
    }, null);
    return null;
  }
  var conn = this.getConnection(key, this.connections.length, this);
  if (cas) {
    conn.write(process_min_response, cb, [operation, key, flags, exptime, val.length, cas].join(' '), val);
  } else {
    conn.write(process_min_response, cb, [operation, key, flags, exptime, val.length].join(' '), val);
  }
};

// Set key and value.
Client.prototype.set = function (key, val, opts, cb) {
  this.store('set', key, val, opts, cb);
};

// Add key and value: error if exists.
Client.prototype.add = function (key, val, opts, cb) {
  this.store('add', key, val, opts, cb);
};

// Check and set key and value: error if checksum does not exist, or key is not present.
Client.prototype.cas = function (key, val, cas, opts, cb) {
  if (!cb) {
    cb = opts;
    opts = {};
  }
  opts.cas = cas;
  this.store('cas', key, val, opts, cb);
};

// Replace: error if does not exist
Client.prototype.replace = function (key, val, opts, cb) {
  this.store('replace', key, val, opts, cb);
};

// Append: add to the existing value, error if does not exist
Client.prototype.append = function (key, val, opts, cb) {
  this.store('append', key, val, opts, cb);
};

// Prepend: add to the beginning of the existing valye, error if does not exist
Client.prototype.prepend = function (key, val, opts, cb) {
  this.store('prepend', key, val, opts, cb);
};

// Increment the existing value. Error if does not exist or is not numeric.
Client.prototype.incr = function (key, val, cb) {
  if (!cb) {
    cb = val;
    val = 1;
  }
  var conn = this.getConnection(key);
  conn.write(process_numeric_response, cb, ['incr', key, val].join(' '));
};

// Decrement the existing value. Error if does not exist or is not numeric.
Client.prototype.decr = function (key, val, cb) {
  if (!cb) {
    cb = val;
    val = 1;
  }
  var conn = this.getConnection(key);
  conn.write(process_numeric_response, cb, ['decr', key, val].join(' '));
};

// Remove the existing value.
Client.prototype.del = function (key, cb) {
  var conn = this.getConnection(key);
  conn.write(process_min_response, cb, 'delete ' + key);
};

// Obtain an array of version information for all servers in the array.
Client.prototype.version = function (cb) {
  var count = this.connections.length;
  var versions = [];
  for (var conn in this.connections) {
    this.connections[conn].write(process_version, function(err, version) {
      count--;
      if (err) { versions.push(err); }
      else { versions.push(version); }
      if (count === 0) {
        cb(null, versions);
      }
    }, 'version');
  }
};

// Obtain stats for the servers, including the various stats subcommands.
//
// See memcached documentation for the meaning of results.
Client.prototype.stats = function (type, cb) {
  if (!cb) {
    cb = type;
    type = '';
  }
  var handler;
  switch (type) {
  case 'items':
    handler = process_items_stats;
    break;
  case 'sizes':
    handler = process_sizes_stats;
    break;
  case 'slabs':
    handler = process_slabs_stats;
    break;
  case '':
    handler = process_stats;
    break;
  default: // Forward compatible: treat any future state type as matching the default pattern.
    handler = process_stats;
  }
  var stats = [];
  var count = this.connections.length;
  for (var conn in this.connections) {
    this.connections[conn].write(handler, function(err, response) {
      count--;
      if (err) { stats.push(err); }
      else { stats.push(response); }
      if (count === 0) {
        cb(null, stats);
      }
    }, 'stats ' + type);    
  }
};
      
// Response parsing functions
// --------------------------
//
// The following private methods parse the response from the server.
var crlf = '\r\n';

var version_str = 'VERSION ';
var version_str_len = version_str.length;

var stat_str = 'STAT ';
var stat_str_len = stat_str.length;

var end_str = 'END' + crlf;
var end_str_trunc = 'END';
var end_str_len = end_str.length;

var items_str = 'STAT items:';
var items_str_len = items_str.length;

// Version is about the easiest thing to parse.
function process_version(line) {
  var results = {};
  results.bytes_parsed = line.next;
  if (line.str) {
    results.data = line.str.substring(version_str_len);
  }
  return results;
}

// Stats and the various subcommands are annoyingly tricky. Arguably, they could be
// dropped from this library and most users would be just as happy? Who needs to
// dynamically access these stats? Answer: monitors checking for abnormal or unhealthy
// conditions. And so we keep it.
function process_stats(line, buffer) {
  var results = {};
  var vstring = buffer.toString('utf8');
  var term = vstring.indexOf(end_str);
  if (term == -1) {
    results.bytes_parsed = -1;
  }
  else {
    var data = {};
    var keystart = vstring.indexOf(stat_str, 0);
    var valend;
    var valstart;
    while (keystart != -1 && keystart < term) {
      keystart += stat_str_len;
      valend = vstring.indexOf(crlf, keystart);
      valstart = vstring.indexOf(' ', keystart) + 1;
      var cat = vstring.substr(keystart, valstart - keystart - 1);
      var val = vstring.substr(valstart, valend - valstart);
      data[cat] = val;
      keystart = vstring.indexOf(stat_str, valend);
    }
    results.bytes_parsed = term + end_str_len;
    results.data = data;
  }
  return results;
}

// Items stats
function process_items_stats(line, buffer) {
  var results = {};
  var stats = buffer.toString('utf8');
  var term = stats.indexOf(end_str);
  if (term == -1) {
    results.bytes_parsed = -1;
  }
  else {
    var data = {};
    data.slabs = [];
    var keystart = stats.indexOf(items_str, 0);
    var valend;
    var valstart;
    while (keystart != -1 && keystart < term) {
      keystart += items_str_len;
      valend = stats.indexOf(crlf, keystart);
      valstart = stats.indexOf(' ', keystart) + 1;
      var cat = stats.substr(keystart, valstart - keystart - 1).split(':');
      var val = stats.substr(valstart, valend - valstart);
      if (!data.slabs[cat[0]]) {
        data.slabs[cat[0]] = {};
      }
      data.slabs[cat[0]][cat[1]] = val;
      keystart = stats.indexOf(items_str, valend);
    }
    results.bytes_parsed = term + end_str_len;
    results.data = data;
  }
  return results;
}

// Slabs Stats
function process_slabs_stats(line, buffer) {
  var results = {};
  var stats = buffer.toString('utf8');
  var term = stats.indexOf(end_str);
  if (term == -1) {
    results.bytes_parsed = -1;
  }
  else {
    var data = {};
    data.slabs = [];
    var keystart = stats.indexOf(stat_str, 0);
    var valend;
    var valstart;
    while (keystart != -1 && keystart < term) {
      keystart += stat_str_len;
      valend = stats.indexOf(crlf, keystart);
      valstart = stats.indexOf(' ', keystart) + 1;
      var cat = stats.substr(keystart, valstart - keystart - 1).split(':');
      var val = stats.substr(valstart, valend - valstart);
      if (isNaN(cat[0])) {
        data[cat[0]] = val;
      }
      else {
        if (!data.slabs[cat[0]]) {
          data.slabs[cat[0]] = {};
        }
        data.slabs[cat[0]][cat[1]] = val;
      }
      keystart = stats.indexOf(stat_str, valend);
    }
    results.bytes_parsed = term + end_str_len;
    results.data = data;
  }
  return results;
}

// Sizes stats
function process_sizes_stats(line, buffer) {
  var results = {};
  var stats = buffer.toString('utf8');
  var term = stats.indexOf(end_str);
  if (term == -1) {
    results.bytes_parsed = -1;
  }
  else {
    var data = {};
    var valend = stats.indexOf(crlf, 0);
    var info = stats.substr(stat_str_len, valend - stat_str_len).split(' ');
    data.bytes = info[0];
    data.items = info[1];
    results.data = data;
  }
  return results;
}

// A commonly repeated task
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

// Get, including multi get, looks for a definition line,
// Followed by a value of the appropriate length, 
// Potentially followed by more of the same.
function process_get(line, buffer, adapter) {
  var results = {};
  var data = {};
  var count = 0;
  while (line.str && line.str != end_str_trunc) {
    var item = {};
    var meta = line.str.split(' ');
    var key = meta[1];
    item.flags = meta[2];
    item.size = parseInt(meta[3], 10);
    var val_end = line.next + item.size;
    if (!val_end || val_end > buffer.length) { // Bail immediately if we have an incomplete value or NaN val_end
      results.bytes_parsed = -1;   // We'll wait for more and re-run.
      return results;
    }
    item.buffer = buffer.slice(line.next, val_end);
    if (meta[4]) {
      item.cas = meta[4];
      data[key] = {};
      data[key]['val'] = adapter(item);
      data[key]['cas'] = item.cas;
    } else {
      data[key] = adapter(item);	
    }
    
    line = process_line(buffer, val_end + 2); // Two bytes for the extra crlf in mc protocol
    count++;
  }
  if (line.str && line.str === end_str_trunc) {
    if (count === 0) {
      results.error = { type: 'NOT_FOUND', description: 'No Value Available' };
      results.data = null;
    } else {
      results.data = data;
    }
    results.bytes_parsed = line.next;
  }
  else {
    results.bytes_parsed = -1;
  }
  return results;
}

// The storage commands provide a very simple, terse response. Easy peasy.
function process_min_response(line) {
  var results = {};
  results.bytes_parsed = line.next;
  if (line.str) {
    switch (line.str) {
    case 'NOT_FOUND':
    case 'EXISTS':
    case 'NOT_STORED':
      results.error = {};
      results.error.type = line.str;
      results.error.description = 'Action Not Permitted';
      break;
    default:
      results.data = line.str;
    }
  }
  return results;
}

// Numeric responses, as in the case of incr and decr.
function process_numeric_response(line) {
  var results = {};
  results.bytes_parsed = line.next;
  if (line.str) {
    if (line.str == 'NOT_FOUND') {
      results.error = {};
      results.error.type = line.str;
      results.error.description = 'Numeric Response Not Found';
      results.data = null;
    }
    else if (line.str.substr(0, 12) == 'CLIENT_ERROR') {
      results.error = {};
      results.error.type = 'CLIENT_ERROR';
      results.error.description = line.str.substr(13);
      results.data = null;
    }
    else {
      results.data = +line.str;
    }
  }
  return results;
}

module.exports.Client = Client;

