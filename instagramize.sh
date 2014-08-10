#!/bin/sh
#convert $1 -crop 450x450+0+0 -quality 100 $3
convert $1 -gravity center -background black -extent 800x800 $3
#convert $3 -fill white -stroke white -draw "rectangle -10,-10 174,174" -quality 100 $3
convert $3 $2 -geometry 170x170+315+0 -composite -format jpg -quality 100 $3
