var request = require('request');
var cheerio = require('cheerio');

module.exports = {
    scrapeSite: function(callback) {
        request('http://thenoblefir.com/beer-cider.html', function(err, res, body) {
            if (err) {
                return callback(err);
            }

            if (res.statusCode != 200) {
                return callback('Failed to fetch page. Status code: ' + res.statusCode);
            }

            $ = cheerio.load(body);

            var beers = [];

            // There are two tables on the page. The first is the draft list.
            $('tbody').first().children('tr').each(function(i, element) {
                var children = $(this).children();
                beers.push($(children[0]).text().trim());
            });

            return callback(null, beers);
        });
    }
};
