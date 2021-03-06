// *********************************************************************************
// api-routes.js - this file offers a set of routes for displaying and saving data to the db
// *********************************************************************************

// Dependencies
// =============================================================

global.fetch = require('node-fetch');
const cc = require('cryptocompare');

// Requiring our models
var db = require("../models");
var Sequelize = require('sequelize');
require('sequelize-values')(Sequelize);
const Op = Sequelize.Op;


// Routes
// =============================================================

module.exports = function(app) {


  //User Info
  app.get("/api/user/:id", function(req, res) {
    db.User.findAll({
      where: {
        id: req.params.id
      }
    }).then(function(dbUser) {
      console.log(Sequelize.getValues(dbUser));
      res.json(dbUser);
    })
  });

  //users last 10 trades
  //User Info
  app.get("/api/user-last-trades/:id", function(req, res) {
    db.Transaction.findAll({
      where: {
        UserId: req.params.id
      },
      order: Sequelize.col('createdAt'),
      limit: 10
    }).then(function(dbUser) {
      var lastTradesArray = [];
      for (var i = 0; i < dbUser.length; i++) {
        var totalAmtUSD = dbUser[i].amount * dbUser[i].price_paid;
        var lastTradesObj = {
          id: dbUser[i].id,
          currency: dbUser[i].currency,
          amount: dbUser[i].amount,
          pricePaid: dbUser[i].price_paid,
          totalAmtUSD: totalAmtUSD,
          transactionType: dbUser[i].transaction_type,
          createdAt: dbUser[i].createdAt,
          updatedAt: dbUser[i].updatedAt,
          UserId: dbUser[i].UserId
        }
        lastTradesArray.push(lastTradesObj);
      }


      console.log(lastTradesArray);
      res.json(lastTradesArray);
    })
  });

  //Get all currencies with price and variation in the last 24 hours
  app.get("/api/currencies", function(req, res) {
    db.Coin.findAll({
      order: Sequelize.col('sort_order'),
      limit: 30
    }).then(function(dbPost) {
      // console.log(Sequelize.getValues(dbPost));
      var newCurrArray = [];
      var newCurrObject = {};
      newCurrObjectArray = [];
      for (var i = 0; i < dbPost.length; i++) {
        newCurrArray.push(dbPost[i].symbol);
      }
      cc.priceFull(newCurrArray, ['USD'])
        .then(prices => {
          console.log(prices);
          for (var i = 0; i < dbPost.length; i++) {
            newCurrObject = {
              coin_id: dbPost[i].coin_id,
              key_id: dbPost[i].key_id,
              base_url: dbPost[i].base_url,
              url: dbPost[i].url,
              image_url: dbPost[i].image_url,
              name: dbPost[i].name,
              symbol: dbPost[i].symbol,
              coin_name: dbPost[i].coin_name,
              full_name: dbPost[i].full_name,
              price: prices[dbPost[i].symbol].USD.PRICE,
              change24Hour: prices[dbPost[i].symbol].USD.CHANGE24HOUR,
              changePct24Hour: prices[dbPost[i].symbol].USD.CHANGEPCT24HOUR,
              marketCap: prices[dbPost[i].symbol].USD.MKTCAP,
              volume24Hour: prices[dbPost[i].symbol].USD.TOTALVOLUME24H

            };
            newCurrObjectArray.push(newCurrObject);
          }
          // console.log(newCurrObjectArray);
          res.json(newCurrObjectArray);
        })
        .catch(console.error)
      return newCurrObjectArray;
    })
  })


  //New User
  app.post("/api/user/new", function(req, res) {
    db.User.create(req.body).then(function(dbPost) {
      console.log(dbPost.id);
      var newPort = {
        UserId: dbPost.id,
        currency: "USD",
        amount: 50000,
        expired: 0
      };
      db.Portfolio.create(newPort).then(function(dbPort) {
        return true;
      });
      res.json(dbPost);
    })
  });


  // Create Portfolio Object
  app.get("/api/portfolio/:id", function(req, res) {
    var coins = [];
    var userCoins = [];

    db.Portfolio.findAll({
      where: {
        userId: req.params.id,
        expired: false,
      },
      include: [db.User]
    }).then(function(dbPortfolio) {
      var dbPortfolio = Sequelize.getValues(dbPortfolio);

      for (var i = 0; i < dbPortfolio.length; i++) {
        coins.push(dbPortfolio[i].currency);
      }

      // db.Coins.findAll({
      //   where: {
      //     symbol: coins
      //   }
      // }).then(function(dbPortfolio) {
      //   console.log(Sequelize.getValues(dbPortfolio));
      // }

      cc.priceMulti(coins, 'USD')
        .then(prices => {
          var index = 0;
          for (var i in prices) {
            var value = dbPortfolio[index].amount * prices[i]["USD"];
            var userCoinObject = {
              coinName: dbPortfolio[index].currency,
              coinIcon: "?",
              userQty: dbPortfolio[index].amount,
              currentPrice: prices[i]["USD"],
              currentValue: value,
              valueChange: "?"
            };
            userCoins.push(userCoinObject);

            index++;
          }

          var currentNetWorth = 0;
          for (var i = 0; i < userCoins.length; i++) {
            console.log(userCoins[i].currentValue);
            currentNetWorth = currentNetWorth + userCoins[i].currentValue;
          }
          //console.log(dbPortfolio[0]);
          var portfolio = {
            userName: dbPortfolio[0].User.name,
            currentNetWorth: currentNetWorth,
            averageNetWorths: averageNetWorth(dbPortfolio[0].UserId, coins),
            topRanks: topRank(),
            userHoldings: userCoins
          }

          res.json(portfolio);
        })
        .catch(console.error)

    })
  });

  // PUT route for updating User
  app.put("/api/user", function(req, res) {
    db.User.update(
      req.body, {
        where: {
          id: req.body.id
        }
      }).then(function(dbPost) {
      res.json(dbPost);
    });
  });

  //get currency actual value
  app.get("/api/currencies/:symbol", function(req, res) {
  	var symbol = req.params.symbol.toUpperCase();
    db.Coin.findOne({
      where: {symbol: symbol}
    }).then(function(dbCoin) {
      res.json(dbCoin);
    })
  })



  function averageNetWorth(id, coins) {

    var netWorths = [];
    var day = 0;
    var total = 0;

    while (day < 7) {
      total = dayTotal(id, coins, day)
      console.log(total);
      netWorths.push(total);

      day++;
    }

    return [50000, 51000, 49000, 49500, 52300, 54777, 59000];
  }

  function dayTotal(id, coins, day) {

    var usd = [];
    var eth = [];
    var btc = [];
    var ltc = [];
    var total = 0;

    db.Portfolio.findAll({
      where: {
        userId: id,
        createdAt: {
          [Op.lt]: new Date(new Date() - day * 24 * 60 * 60 * 1000),
          [Op.gt]: new Date(new Date() - (day + 1) * 24 * 60 * 60 * 1000)
        }
      }
    }).then(function(result) {
      if (result.length > 0) {
        cc.priceHistorical('USD', coins, result[0]["_previousDataValues"]["createdAt"])
          .then(prices => {

            for (var i = 0; i < result.length; i++) {
              var curr = result[i]["_previousDataValues"]["currency"];
              var curencyValue = 1 / (prices[curr]);
              switch (result[i]["_previousDataValues"]["currency"]) {
                case "USD":
                  usd.push(result[i]["_previousDataValues"]["amount"] * curencyValue);
                  break;
                case "BTC":
                  btc.push(result[i]["_previousDataValues"]["amount"] * curencyValue);
                  break;
                case "ETH":
                  eth.push(result[i]["_previousDataValues"]["amount"] * curencyValue);
                  break;
                case "LTC":
                  ltc.push(result[i]["_previousDataValues"]["amount"] * curencyValue);
                  break;
                default:
                  break;
              }
            }
            var totalUsd = calculateAverage(usd);
            var totalEth = calculateAverage(eth);
            var totalBtc = calculateAverage(btc);
            var totalLtc = calculateAverage(ltc);
            total = totalUsd + totalEth + totalBtc + totalLtc;
            console.log(total);
            return total;
          })
          .catch(console.error)
      }
    });
  }

  function calculateAverage(coin) {
    var sum = 0;
    if (coin.length > 0) {
      for (var i = 0; i < coin.length; i++) {
        sum += coin[i];
      }
      return sum / coin.length;
    }
    return sum;
  }

  // function topRank() {

  // }

  // function currentNetWorth(id) {

  // }

  //get currency historical value
  app.get("/api/currencies/:symbol/:date", function(req, res) {
    var symbol = req.params.symbol.toUpperCase();
    cc.priceHistorical(symbol, ['USD'], new Date(req.params.date))
      .then(prices => {
        console.log(prices)
        res.json(prices);
      })
      .catch(console.error)
  })

  function topRank() {
    return "?";
  }


  //get currency value for the last 30 days
  app.get("/api/curr-hist-day/:symbol", function(req, res) {
    var symbol = req.params.symbol.toUpperCase();
    cc.histoDay(symbol, ['USD'])
      .then(prices => {
        console.log(prices)
        res.json(prices);
      })
      .catch(console.error)
  })

  //get currency value for the last week hourly
  app.get("/api/curr-hist-hour/:symbol", function(req, res) {
    var symbol = req.params.symbol.toUpperCase();
    cc.histoHour(symbol, ['USD'])
      .then(prices => {
        console.log(prices)
        res.json(prices);
      })
      .catch(console.error)
  })

  //get currency full price
  app.get("/api/curr-price-full/:symbol", function(req, res) {
    var symbol = req.params.symbol.toUpperCase();
    cc.priceFull(symbol, ['USD'])
      .then(prices => {
        console.log(prices)
        res.json(prices);
      })
      .catch(console.error)
  })


  //------------------------------------------------------------------------
  //------------------------------------------------------------------------
  // BUY AND SELL ROUTES
  //------------------------------------------------------------------------
  //------------------------------------------------------------------------

  // GET route for retrieving all historical transactions
  app.get("/api/transaction", function(req, res) {
    db.Transactions.findAll({}).then(function(transactions) {
      res.json(transactions)
    })
  });

  // GET route for retrieving all BUY transaction
  app.get("/api/transaction/buy/all", function(req, res) {
    db.Transactions.findAll({
      where: {
        transaction_type: 'B'
      }
    }).then(function(transactions) {
      res.json(transactions)
    })
  });

  // Get rotue for retrieving all BUY transactions per user
  app.get("/api/transaction/buy/:UserID", function(req, res) {
    db.Transactions.findAll({
      where: {
        Userid: req.body.params.UserID,
        transaction_type: 'B'
      }
    }).then(function(transactions) {
      res.json(transactions)
    })
  });

  // GET route for retrieving all SELL transaction
  app.get("/api/transaction/sell/all", function(req, res) {
    db.Transactions.findAll({
      where: {
        transaction_type: 'S'
      }
    }).then(function(transactions) {
      res.json(transactions)
    })
  });

  // Get rotue for retrieving all SELL transactions per user
  app.get("/api/transaction/sell/:UserID", function(req, res) {
    db.Transactions.findAll({
      where: {
        Userid: req.body.params.UserID,
        transaction_type: 'S'
      }
    }).then(function(transactions) {
      res.json(transactions)
    })
  });

  //------------------------------------------------------------------------
  // Single Orders
  //------------------------------------------------------------------------

  // POST route for single BUY Order
  app.post("/api/transaction/buy", function(req, res) {
    console.log('updating DB');
    console.log(req.body.params);
    // Set old USD wallet value to expired (0)
    db.Portfolio.update({
      expired: true
    }, {
      where: {
        UserId: req.body.params.userID,
        currency: ['USD', req.body.params.coinID],
      }}).then(function(result) {
	    // Set new USD wallet value
		    db.Portfolio.create({
		      UserId: req.body.params.userID,
		      currency: 'USD',
		      expired: false,
		      amount: req.body.params.currentUSD
		    }).then(function(result) {});
	    // Set new cryptocurrency amount
		    db.Portfolio.create({
		      UserId: req.body.params.userID,
		      currency: req.body.params.coinID,
		      expired: false,
		      amount: req.body.params.ccQuantity
		    }).then(function(result) {});
		});
    // Create transaction for cryptocurrency purchased
    db.Transaction.create({
      UserId: req.body.params.userID,
      currency: req.body.params.coinID,
      amount: req.body.params.ccQuantity,
      price_paid: req.body.params.ccPrice,
      transaction_type: 'B'
    }).then(function(result) {
      res.json(result);
    });
  });

  // POST route for single SELL Order
	app.post("/api/transaction/sell", function(req, res) {
    console.log('updating DB');
    console.log(req.body.params);

    // Set old USD wallet value to expired (0)
    db.Portfolio.update({
      expired: true
    }, {
      where: {
        UserId: req.body.params.userID,
        currency: ['USD', req.body.params.coinID],
      }}).then(function(result) {
		    // Set new USD wallet value
		    db.Portfolio.create({
		      UserId: req.body.params.userID,
		      currency: 'USD',
		      expired: false,
		      amount: req.body.params.currentUSD
		    }).then(function(result) {});
		    // Set new cryptocurrency amount
		    db.Portfolio.create({
		      UserId: req.body.params.userID,
		      currency: req.body.params.coinID,
		      expired: false,
		      amount: req.body.params.ccQuantity
		    }).then(function(result) {});
		});
    // Create transaction for cryptocurrency purchased
    db.Transaction.create({
      UserId: req.body.params.userID,
      currency: req.body.params.coinID,
      amount: req.body.params.ccQuantity,
      price_paid: req.body.params.ccPrice,
      transaction_type: 'S'
    }).then(function(result) {
      res.json(result);
    });
  });

};
