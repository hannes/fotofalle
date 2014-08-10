#!/bin/sh
convert $1 -crop 450x450+0+0 -quality 100 $3
convert tmp.jpg -fill white -stroke white -draw "rectangle -10,-10 128,128" -quality 100 $3
convert tmp.jpg $2 -geometry 125x125+0+0 -composite -format jpg -quality 100 $3
