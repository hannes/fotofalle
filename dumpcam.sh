#!/bin/sh
rtmpdump -r rtmp://video4.earthcam.com/fecnetwork/hdtimes10.flv \
-p "http://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1" \
-s "http://www.earthcam.com/swf/cam_player_v2/ecnPlayer.swf" \
-v -y hdtimes10.flv -R -o - \
| ffmpeg -i pipe:0 -r 1 -vf drawtext="fontfile=FreeSans.ttf: text='Source\: http\://www.earthcam.com/usa/newyork/timessquare (no affiliation)': x=0: y=h-line_h: fontsize=14: fontcolor=white: box=1: boxcolor=black: borderw=1"  -f image2 -strftime 1 -q:v 1 /Users/hannes/framedump/nycts-%s.jpg


#