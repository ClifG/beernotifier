var request = require('request');
var cheerio = require('cheerio');
var utils = require('./scraperUtils');

module.exports = {
    scrapeSite: function(callback) {
        utils.retry(function(callback) {
            request('http://www.pineboxbar.com/draft', function(err, res, body) {
                if (err) {
                    return callback(err);
                }

                if (res.statusCode != 200) {
                    return callback('Failed to fetch page. Status code: ' + res.statusCode);
                }

                $ = cheerio.load(body);

                var beers = [];
                $('td.draft_brewery').each(function(i, element) {
                    var brewery = $(this).text();
                    var beer = $(this).nextAll('td.draft_name').text();

                    beers.push(brewery.trim() + ' ' + beer.trim());
                });

                return callback(null, beers);
            });
        }, 3, callback);
    }
};

