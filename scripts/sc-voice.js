#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const compression = require("compression");
const express = require('express');
const favicon = require('serve-favicon');
const app = module.exports = express();
const jwt = require('express-jwt');

const {
    RestBundle,
    RbServer,
} = require('scv-rb');
const {
    logger,
} = require('log-instance');
const {
    ScApi,
} = require('suttacentral-api');
const {
    ScvRest,
} = require('../index');

global.__appdir = path.dirname(__dirname);
RbServer.logDefault();

app.use(compression());

// ensure argv is actually for script instead of mocha
var argv = process.argv[1].match(__filename) && process.argv || [];
argv.filter(a => a==='--log-debug').length && (logger.level = 'debug');
var port = argv.reduce((a,v)=>(v==='-3000' ? 3000 : a), 80);

// set up application
app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", [
        "X-Requested-With",
        "Content-Type",
        "Access-Control-Allow-Headers",
        "Authorization",
    ].join(","));
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS, PUT, POST");
    next();
});

app.get('/scv/auth/*',
    jwt({secret: ScvRest.JWT_SECRET, algorithms:['HS256']}),
    (req, res, next) => {
        logger.debug(`authenticated path:${req.path}`);
        next();
    });
app.use("/scv/index.html", 
    express.static(path.join(__dirname, "../dist/index.html")));
app.use("/scv/img", express.static(path.join(__dirname, "../dist/img")));
app.use("/audio", express.static(path.join(__dirname, "../dist/audio")));
app.use(favicon(path.join(__dirname, "../public/img/favicon.png")));
app.use("/css", express.static(path.join(__dirname, "../dist/css")));
app.use("/fonts", express.static(path.join(__dirname, "../dist/fonts")));
app.use("/MaterialIcons.css", 
    express.static(path.join(__dirname, "../dist/MaterialIcons.css")));
app.use("/MaterialIcons.ttf", 
    express.static(path.join(__dirname, "../dist/MaterialIcons.ttf")));
app.use("/scv/img", express.static(path.join(__dirname, "../dist/img")));
app.use("/scv/audio", express.static(path.join(__dirname, "../dist/audio")));
app.use("/scv/js", express.static(path.join(__dirname, "../dist/js")));
app.use("/scv/css", express.static(path.join(__dirname, "../dist/css")));
app.use("/scv/fonts", express.static(path.join(__dirname, "../dist/fonts")));
app.use("/scv/sounds", express.static(path.join(__dirname, "../local/sounds")));

app.get(["/","/scv"], function(req,res,next) {
    res.redirect("/scv/index.html");
    next();
});
(async function() {
    try {
        var apiUrl = argv.some((a) => a === '--staging')
            ? 'http://staging.suttacentral.net/api'
            : 'http://suttacentral.net/api';
        var scApi = await new ScApi({
            apiUrl,
        }).initialize();
        var rbServer =  app.locals.rbServer = new RbServer();

        // create RestBundles
        var restBundles = app.locals.restBundles = [];
        let MS_MINUTE = 60*1000;
        var opts = {
            scApi,
            ephemeralAge: 60*MS_MINUTE,
        };
        //opts = undefined;
        var scvRest = new ScvRest(opts);
        app.locals.scvRest = scvRest;
        await scvRest.initialize();
        restBundles.push(scvRest);

        // create http server and web socket
        if (argv.some((a) => a === '--ssl')) {
            rbServer.listenSSL(app, restBundles); 
        } else {
            var ports = [port, 3000].concat(new Array(100).fill(3000).map((p,i)=>p+i));
            rbServer.listen(app, restBundles, ports); 
        }
        await rbServer.initialize();
    } catch(e) {
        logger.error(e.stack);
        throw e;
    }
})();
