var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");

var handle = {}
handle["/"] = requestHandlers.additem;
handle["/get"] = requestHandlers.get;
handle["/additem"] = requestHandlers.additem;
handle["/getitem"] = requestHandlers.getitem;
handle["/add"] = requestHandlers.add;
server.start(router.route, handle);