#!/bin/sh
rtmpdump -r rtmp://video4.earthcam.com/fecnetwork/hdtimes10.flv \
-p "http://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1" \
-s "http://www.earthcam.com/swf/cam_player_v2/ecnPlayer.swf" \
-v -y hdtimes10.flv -R -o - \
| ffmpeg -i pipe:0 -r 1 -f image2 -strftime 1 /Users/hannes/framedump/nycts-%s.jpg