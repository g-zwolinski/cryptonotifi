#starting command
pm2 start index.js -n "cryptonotifi" -l ./logs/"$(date +"%Y-%m-%d_%H-%M-%S").alog"