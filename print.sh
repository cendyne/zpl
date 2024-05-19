#!/bin/bash
cat "$1" | iconv -f utf-8 -t utf-16 | lp -d GK420d -o raw
