var 
express     = require('express'),
util        = require('util'),
fs          = require('fs'),
querystring = require('querystring'),
request     = require('request'),
app         = require('express')(),
path        = require('path'),
crypto      = require('crypto');

var j = request.jar();
var config = require('./config');


// this is the web server that listens to the IG API
app.get('/callback', function(request, response){
  if(request.param("hub.challenge") != null){
   console.log('received validation request')
   response.send(request.param("hub.challenge"));
 } else {
  console.log("ERROR on suscription request: %s", util.inspect(request));
}
});

app.post('/callback', function(request, response){
  JSON.parse(request).body.forEach(function(notificationOjb){
  // each notificationOjb tells us that we should ask the IG API for updates
  ropt = {uri:'https://api.instagram.com/v1/geographies/' + notificationOjb.object_id + '/media/recent' +
  '?' + querystring.stringify({client_id: config.instagram.client_id, count:'1'})};

  request(ropt,function(error, response, body) {
    if (error || response.statusCode != 200) {
      console.log('ERROR getting details after notification');
      console.log(body);
      return;
    }
    JSON.parse(body).data.forEach(function(ipost){
          var p = [ipost.location.latitude,ipost.location.longitude];
              if (p[0] < config.boundingbox[0] || p[0] > config.boundingbox[2] || 
              p[1] < config.boundingbox[1] || p[1] > config.boundingbox[3]) {
              return;
          }
          console.log(ipost);
          console.log(ipost.link + ' ['+ipost.location.latitude+'/'+ipost.location.longitude+']');

      // TODO payload
      // TODO remember last couple of image ids to avoid double posting
      // TODO: do not include ourselves...
    });     
  });
});

  response.writeHead(200);
});

// siubscribe to the IB streaming API
app.listen(config.instagram.streamingport, function(){
  console.log("Listening in port %d", config.instagram.streamingport);
  request.del('https://api.instagram.com/v1/subscriptions?'+
    querystring.stringify({client_id: config.instagram.client_id,client_secret:config.instagram.client_secret,object:'all'}),
    function(error,response,body) {
    console.log('cleaned old subscriptions');
    request.post(
      'https://api.instagram.com/v1/subscriptions/',
      { form: {
        client_id: config.instagram.client_id,
        client_secret:config.instagram.client_secret,
        object:'geography',
        aspect:'media',
        lat:    config.instagram.webcamlat,
        lng:    config.instagram.webcamlong,
        radius: config.instagram.radius,
        verify_token:'dpfkg', // does not really matter...
        callback_url:config.instagram.callback } },
        function (error, response, body) {
          if (error || response.statusCode != 200) {
            console.log('error subscribing');
            console.log(body)
          } else {
            console.log('subscribed. waiting...');
          }
        }
        );
  });
});
