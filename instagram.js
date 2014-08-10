var 
util        = require('util'),
fs          = require('fs'),
querystring = require('querystring'),
request     = require('request'),
app         = require('express')(),
path        = require('path'),
crypto      = require('crypto'),
tmp         = require('tmp'),
spawn       = require('child_process').spawn;

var j = request.jar();
var config = require('./config');

// we need this to keep track of IG posts and users we have seen, we get them
// twice usually, for whatever reason, and not neccessarily in order
LIMAP.prototype = {
  maxsize : undefined,
  entries : {},
  lastid : 0,
  put : function(entry) {
    while (Object.keys(this.entries).length > this.maxsize) {
      var minid = this.lastid;
      var minentry;
      for (var entry in this.entries) {
        if (this.entries[entry] < minid) {
          minid = this.entries[entry];
          minentry = entry;
        }
      }
      delete this.entries[minentry];
    }
    this.lastid++;
    this.entries[entry] = this.lastid;
    console.log(this.entries);
    return this;
  },
  has : function(entry) {
    return this.entries[entry] !== undefined;
  }
};

function LIMAP(maxsize) {
  this.maxsize = maxsize;
}

var igmap = LIMAP(1000);


var iclient = request.defaults({
  method: 'POST', 
  jar:j,
  headers: {'User-Agent':'Instagram 5.0.5 (Android)'}
});

function sign(payload) {
  var json = JSON.stringify(payload);
  return crypto.createHmac('sha256',config.instagram.key).update(json).digest('hex') + '.' + json;
}

var loginopt = {
  uri: 'https://i.instagram.com/api/v1/accounts/login/',
  form: {
    signed_body :  sign({
      _uuid      : config.instagram.uuid,
      password   : config.instagram.pass,
      username   : config.instagram.user,
      device_id  : config.instagram.uuid,
      from_reg   : false,
      _csrftoken : 'missing'
    }),
    ig_sig_key_version : 4
  }
};

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
          // do not annoy the same people twice and filter double notifications
          if (igmap.has(ipost.link) || igmap.has(ipost.user.username)) {
            return;
          }
          // we post at these coordinates, too. So exclude ourselves.
          if (ipost.user.username == config.instagram.user) {
            return;
          }
          igmap.put(ipost.link);
          igmap.put(ipost.user.username);

          console.log(ipost);
          console.log(ipost.link + ' ['+ipost.location.latitude+'/'+ipost.location.longitude+']');

          // PAYLOAD :)

          // find webcam pic
          var time = Math.round(new Date(tweet.created_at).getTime() / 1000);

          var fname = config.framepathprefix + time + config.framepathpostfix;
          // also try seconds before, there might be a gap
          if (!fs.existsSync(fname)) {
              fname = config.framepathprefix + (time - 1) + config.framepathpostfix;
          } else  if (!fs.existsSync(fname)) {
              fname = config.framepathprefix + (time - 2) + config.framepathpostfix;
          } else {
              return;
          }
          if (!fs.existsSync(fname)) {
              console.log('Could not find file ' + fname);
              return;
          }
          
          // download posted pic
          tmp.tmpName({postfix: '.jpg'},function (err, pathig) {
              var dlreq = request(ipost.images.low_resolution.url);
              dlreq.pipe(fs.createWriteStream(pathig));
              dlreq.on('end',function(){
              tmp.tmpName({postfix: '.jpg'},function (err, pathout) {
                // run imagemagick
                var bash = spawn('./instagramize.sh', [fname, pathig, pathout]);
                bash.on('exit', function (code) {
                  console.log(pathout);
                  // and now upload.. deep in cb hell

                  var taggeduserid = ipost.user.userid;
                  var picpath = pathout;

                  // login
                  // TODO: only login if cookie expired?
                  iclient(loginopt, function (error, response, body) {
                    if (error || response.statusCode != 200) {
                      console.log('ERROR logging in');
                      console.log(error);
                      console.log(body);
                      return;
                    }

                    respj = JSON.parse(body);
                    var userid = respj.logged_in_user.pk;
                    var uploadid = Math.round(new Date().getTime() / 1000);

                    // upload
                    var uploadopt = {
                      uri: 'http://i.instagram.com/api/v1/upload/photo/',
                    };
                    var r = iclient(uploadopt, function (error, response, body) {
                      if (error || response.statusCode != 200) {
                        console.log('ERROR uploading file');
                        console.log(error);
                        console.log(body);
                        return;
                      }
                      // configure      
                      var confopt = {
                        uri: 'https://i.instagram.com/api/v1/media/configure/',
                        form: {
                          signed_body : sign({
                            camera_position : 'back',
                            usertags        : '{\"in\":[{\"user_id\":\"'+taggeduserid+'\",\"position\":[0.5,0.5]}]}',
                            media_longitude : config.instagram.webcamlong,
                            _uuid           : config.instagram.uuid,
                            faces_detected  : 0,
                            upload_id       : uploadid,
                            caption         : 'Hey @' + ipost.user.username+', ' + config.instagram.caption,
                            geotag_enabled  : true,
                            source_type     : 1,
                            media_latitude  : config.instagram.webcamlat,
                            _uid            : userid
                          }),
                          ig_sig_key_version : 4
                        }
                      };
                      iclient(confopt, function (error, response, body) {
                        if (error || response.statusCode != 200) {
                          console.log('ERROR configuring post');
                          console.log(error);
                          console.log(body);
                          return;
                        }
                        console.log("SUCCESS");
                        console.log(util.inspect(JSON.parse(body), false, null));

                        // TODO: also post to twitter?

                      });
                    });
                    var form = r.form();
                    form.append('upload_id', uploadid);
                    form.append('photo', fs.createReadStream(picpath), {
                      filename   : 'photo',
                      contentType: 'image/jpeg'
                    });  
                  });
                });
              });
              });
          });
    });     
  });
});

  response.writeHead(200);
});

// siubscribe to the (official) IB streaming API
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
