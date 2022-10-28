const express = require('express')
const querystring = require('querystring');
const request = require('request'); // "Request" library
var cookieParser = require('cookie-parser')

const client_id = '2d4a2fe6204d464ba347a8c905298573';
const client_secret = '50d9650b9e6c44bcbb3e81b65c638fb4';
const PORT = process.env['PORT'] || 8081 ;
const HTTP = process.env['HTTP'] || 'https';
const HOST = process.env['HOST'] || 'ssp.scibrazeau.ca';
const redirect_uri = process.env['CLIENT_PORT'] ?
    `${HTTP}://${HOST}:${process.env['CLIENT_PORT']}/api/callback` :
    `${HTTP}://${HOST}/api/callback`;

const CLIENT_PORT = process.env['CLIENT_PORT'] || 'ssp.scibrazeau.ca';

const SPOT_TOKENA_KEY = 'spotTokenA';
const SPOT_TOKENR_KEY = 'spotTokenR';

const app = express();
app.use(cookieParser())


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
app.get('/api/login', function (req, res) {
    // your application requests authorization
    const scope = 'ugc-image-upload ugc-image-upload user-read-playback-state user-read-playback-state app-remote-control app-remote-control user-modify-playback-state user-modify-playback-state playlist-read-private playlist-read-private user-follow-modify user-follow-modify playlist-read-collaborative playlist-read-collaborative user-follow-read user-follow-read user-read-currently-playing user-read-currently-playing user-read-playback-position user-read-playback-position user-library-modify user-library-modify playlist-modify-private playlist-modify-private playlist-modify-public playlist-modify-public user-read-email user-read-email user-top-read user-top-read streaming streaming user-read-recently-played user-read-recently-played user-read-private user-read-private user-library-read user-library-read'
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: req.query.referrer
        }));
});

app.get('/api/callback', function (req, res) {
    // your application requests refresh and access tokens
    // after checking the state parameter
    const code = req.query.code;
    const state = req.query.state;
    console.log(`Received callback code==${code}, state==${state}`);
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        },
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
        },
        json: true
    };

    console.log(`Exchanging code for access token`);
    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;
            const refresh_token = body.refresh_token;
            console.log("Received token");
            res.cookie(SPOT_TOKENA_KEY, access_token);
            res.cookie(SPOT_TOKENR_KEY, refresh_token);
            res.redirect(req.query.state);
        } else {
            console.error("Failed to retrieve access token");
            res.status(response.statusCode).send(error);
        }
    });
});


app.get('/api/hello', function (req, res) {
    res.send('Hello back to you');
})

app.get('/api/refresh_token', function (req, res) {
    console.log("Generating refresh token");

    // requesting access token from refresh token
    const refresh_token = req.cookies['spotTokenR'];
    if (!refresh_token) {
        throw new Error('Missing spotTokenR');
    }
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))},
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;
            res.cookie(SPOT_TOKENA_KEY, access_token);
            res.send({
                'access_token': access_token
            });
        }
    });
});

app.use('/api/static', express.static('static/'))
app.use('/', express.static('spa/'))

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Example app listening on port ${PORT}`)
})
