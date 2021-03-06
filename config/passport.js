'use strict';

//Load Dependencies
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

//Load DB & models
var db = require('../models/index.js');

//Load Auth Variables
var configAuth = require('./auth');

module.exports = function(passport) {

    passport.use(new FacebookStrategy({
        clientID: configAuth.facebookAuth.clientID,
        clientSecret: configAuth.facebookAuth.clientSecret,
        callbackURL: configAuth.facebookAuth.callbackURL,
        profileFields: configAuth.facebookAuth.profileFields,
        passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
      },
    function(req, token, refreshToken, profile, done) {
    // check if the user is already logged in
     if (!req.user) {
       db.User.findOne({ where :{ 'facebook_id' : profile.id }}).then (function (user) {
		 if (user) { // if there is a user id already but no token (user was linked at one point and then removed)
		 if (!user.token) {
				user.token = token;
				user.name  = profile.displayName;
				user.email = profile.emails[0].value;
				user.save().then( function() {done(null, user);}).catch (function(e) {});
     } else {
				done(null, user);
		 }
		 } else {
 // if there is no user, create them
        db.User.create({
            facebook_id: profile.id,
            token: token,
            name: profile.displayName,
            email: profile.emails[0].value
            })
         .then(function(dbPost) {
             var newPort = {
               UserId: dbPost.id,
               currency: "USD",
               amount: "50000",
               expired: 0
             };
             db.Portfolio.create(newPort).then(function(dbPort) {
              done(null, user);}).catch (function(e) {
              });
             return dbPost;
           });
        }
		  });
   } else { // user already exists and is logged in, we have to link accounts
      var user                = req.user; // pull the user out of the session
          user.facebook_id    = profile.id;
          user.token          = token;
          user.name           = profile.displayName;
          user.email          = profile.emails[0].value;
          user.save().then( function() {done(null, user);}).catch (function(e) {});
    }


  }));

  // used to serialize the user for the session
  passport.serializeUser(function(user, done) {
        done(null, user.id);
    });
    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        User.findById(id).then(function(user){
      done(null, user);
    }).catch(function(e){
      done(e, false);
    });
    });

}
