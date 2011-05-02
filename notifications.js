var http = require('http'),  
    io = require('socket.io'),
    redis = require('redis'),
    redisListener = null,
    
server = http.createServer();
server.listen(process.env.VMC_APP_PORT || 8088);
    
//Set up Redis, dynamically discovering and connecting to the bound CloudFoundry service
if (process.env.VCAP_SERVICES) {
    console.log("Bound services detected.");
    var services = JSON.parse(process.env.VCAP_SERVICES);
    for (serviceType in services) {
        console.log("Service: "+serviceType);
        console.log("Service Info: "+JSON.stringify(services[serviceType]));
        if (serviceType.match(/redis*/)) {
            var service = services[serviceType][0];
            console.log("Connecting to Redis service "+service.name+":"+service.credentials.hostname+":"+service.credentials.port);
            redisListener = redis.createClient(service.credentials.port, service.credentials.hostname);
            redisListener.auth(service.credentials.password);
            break;
        }
    }
}

//Fall-back Redis connection for local development outside of CloudFoundry
if (!redisListener && !process.env.VCAP_APP_PORT) {
    console.log("Connecting to local Redis service");
    redisListener = redis.createClient();
}

if (!redisListener) {
    console.error("Fatal condition - no connection to Redis established");
    process.exit(1);
}

redisListener.on("connect", function(){ console.log("Redis listener connection established."); });

redisListener.on("error", function(err) { 
    console.log("Error thrown by redis listener connection: "+err);
    process.exit(1);
});
  
// socket.io for pushing messages to the browser
var io = io.listen(server, {transports: ['xhr-polling'], transportOptions: {'xhr-polling': {duration: 10000}} });

console.log(io.options);

redisListener.subscribe("notifications");

redisListener.on("message", function(channel, message){
    io.broadcast(JSON.parse(message));
});