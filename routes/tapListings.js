var express = require('express');
var router = express.Router();

var TapListing = require('../models/tapListing.js');

router.get('/', function(req, res) {
    var queryFilter = {};

    if (req.query.active) {
        queryFilter = { isActive: req.query.active === 'true' };
    }

    TapListing.find(queryFilter, null, {sort: {createdDate: -1}})
        .populate('dataSource', 'name')
        .exec(function(err, tapListings) {
        if (err) {
            console.dir(err);
            throw err;
        }
        res.json(tapListings);
    });
});

module.exports = router;