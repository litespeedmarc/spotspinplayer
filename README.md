# spotspinplayer
Spotify Player for playing Spinning Mixes

# Useful links
https://medium.com/@benmorel/creating-a-linux-service-with-systemd-611b5c8b91d6
https://www.freedesktop.org/software/systemd/man/systemd.exec.html#
https://www.nginx.com/blog/using-free-ssltls-certificates-from-lets-encrypt-with-nginx/
http://nginx.org/en/docs/http/configuring_https_servers.html
https://hackprogramming.com/blog/how-to-setup-subdomain-or-host-multiple-domains-using-nginx-in-linux-server
https://blog.logrocket.com/how-to-run-a-node-js-server-with-nginx/

# Prod
We use nginx reverse proxy
node server located in /var/www/ssp.scibrazeau.ca/spotspinplayer
node server configured as service via /etc/systemd/system/ssp.service
* Troubleshoot via systemctl status ssp (will also spew out logs)
