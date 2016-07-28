'use strict';
const hapi = require('hapi');
const https = require('https');
const querystring = require('querystring');
const req = require('request');
const env2 = require('env2')('./config.env');
const goodOptions = {
    ops: {
        interval: 1000
    },
    reporters: {
        console: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ log: '*', response: '*' }]
        }, {
            module: 'good-console'
        }, 'stdout'],
        http: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ error: '*' }]
        }, {
            module: 'good-http',
            args: ['http://prod.logs:3000', {
                wreck: {
                    headers: { 'x-api-key': 12345 }
                }
            }]
        }]
    }
};
const plugins = [
  { register: require('good'), options: goodOptions, },
  require('inert')
];
const server = new hapi.Server();
server.connection({
  host: 'localhost',
  port: 4000
});
server.state('session', {
  ttl: 24 * 60 * 60 * 1000,
  isSecure: false,
  path: '/',
  encoding: 'base64json'
});
server.register(plugins, (err) => {
  if (err) return console.error(err);
  server.route({
    method: 'GET',
    path: '/',
    handler: {
      file: './index.html'
    }
  });
  server.route({
    method: 'GET',
    path: '/login',
    handler: function (request, reply) {
      const querystrings = querystring.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirectURI: process.env.BASE_URL,
    });
    reply.redirect('https://github.com/login/oauth/authorize?' + querystrings);
    }
  });
  server.route({
    method: 'GET',
    path: '/welcome',
    handler: function(request, reply) {
      const payload = {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: request.query.code
    };
    req.post(`https://github.com/login/oauth/access_token`,
      { form: payload,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Content-Length': payload.length
      }}, function(err, httpResponse, body){
        reply('Welcome, thank you for signing in!').state('session', body);
      });
    }
  });
  server.route({
    method: 'GET',
    path: '/gotouser',
    handler: function(request, reply) {
      if (request.state.session) {
      req
        .get('https://github.com/user')
        .on('response', function(response) {
           reply(response);
        });
      } else {
        reply.redirect('/');
      }
    }
  });
});
server.start((err) => {
  console.log(`Server is running on: ${server.info.uri}`);
});
