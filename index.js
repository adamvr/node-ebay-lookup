/**
 * Module dependencies
 */
var request = require('superagent')
  , util = require('util')
  , _ = require('underscore')
  , path = require('JSONPath').eval
  , accounting = require('accounting')
  , currency = require('currency-symbol-map')
  , parse = require('xml2js').parseString;

/**
 * API endpoint
 */
var endpoint = 'http://svcs.ebay.com/services/search/FindingService/v1';

module.exports = function (itemId) {
  return new Ebay(itemId);
};

var Ebay = function (itemId) {
  this._filters = {};

  if ('object' === typeof itemId) {
    if (itemId.keywords) this.keywords = itemId.keywords, this.mode = 'search';
    if (itemId.itemId) this.itemId = itemId, this.mode = 'lookup';
  } else {
    this.itemId = itemId;
  }
};

Ebay.prototype.id = function (id) {
  return this.id = id, this;
};

var countryId = [
  {countryCode: 'AT', globalId: 'EBAY-AT' },
  {countryCode: 'AU', globalId: 'EBAY-AU'},
  {countryCode: 'CH', globalId: 'EBAY-CH'},
  {countryCode: 'DE', globalId: 'EBAY-DE'},
  {countryCode: 'CA', globalId: 'EBAY-ENCA'},
  {countryCode: 'ES', globalId: 'EBAY-ES'},
  {countryCode: 'FR', globalId: 'EBAY-FR'},
  {countryCode: 'BE', globalId: 'EBAY-FRBE'},
  {countryCode: 'UK', globalId: 'EBAY-GB'},
  {countryCode: 'HK', globalId: 'EBAY-HK'},
  {countryCode: 'IE', globalId: 'EBAY-IE'},
  {countryCode: 'IN', globalId: 'EBAY-IN'},
  {countryCode: 'IT', globalId: 'EBAY-IT'},
  {countryCode: 'MY', globalId: 'EBAY-MY'},
  {countryCode: 'NL', globalId: 'EBAY-NL'},
  {countryCode: 'PH', globalId: 'EBAY-PH'},
  {countryCode: 'PL', globalId: 'EBAY-PL'},
  {countryCode: 'SG', globalId: 'EBAY-SG'},
  {countryCode: 'US', globalId: 'EBAY-US'}
];
var defaultCountry = 'EBAY-US';
Ebay.prototype.country = function (country) {
  // Lookup matching country
  var results = _.where(countryId, {countryCode: country});

  // Set endpoint
  this.globalId = results.length ? results[0].globalId : null;

  // Return this for chaining
  return this;
};

Ebay.prototype.affiliate = function (id) {
  return this.trackingId = id, this;
};

var networks = [
  { id: 2, name: 'be free' },
  { id: 3, name: 'affilinet' },
  { id: 4, name: 'tradedoubler' },
  { id: 5, name: 'mediaplex' },
  { id: 6, name: 'doubleclick' },
  { id: 7, name: 'allyes' },
  { id: 8, name: 'bjmt' },
  { id: 9, name: 'ebay' }
];
var defaultNetwork = 9;
Ebay.prototype.network = function (network) {
  var results = _.where(networks, {name: network.toLowerCase()});

  // Set id
  this.networkId = results.length ? results[0].id : null;

  // Return this for chaining
  return this;
};

var listing = [
  { name: 'auction', id: 'Auction' },
  { name: 'buy it now', id: 'AuctionWithBIN' },
  { name: 'classified', id: 'Classified' },
  { name: 'fixed', id: 'FixedPrice' },
  { name: 'all', id: 'All' }
];
Ebay.prototype.type = function (type) {
  var results = _.where(listing, {name: type.toLowerCase()});

  // Choke on invalid listing type
  if (!results.length) throw new Error('Invalid listing type');

  // Add to filters
  this._filters['ListingType'] = [results[0].id];

  // Chain
  return this;
};

Ebay.prototype.condition = function (cond) {
  return this._filters['Condition'] = [capitalize(cond)], this;
};

Ebay.prototype.price = function (range) {
  // Convert to array if necessary
  range = _.isString(range) ? range.split('..') : range;

  // Add limits to filters
  if (range[0]) this._filters['MinPrice'] = [range[0]];
  if (range[1]) this._filters['MaxPrice'] = [range[1]];

  // Chain
  return this;
};

Ebay.prototype.done = function (cb) {
  return request
    .get(endpoint)
    .query({'OPERATION-NAME': 'findItemsAdvanced'})
    .query({'SERVICE-VERSION': '1.0.0'})
    .query({'SECURITY-APPNAME': this.id})
    .query({'GLOBAL-ID': this.globalId || defaultCountry})
    .query({'RESPONSE-DATA-FORMAT': 'XML'})
    .query({'REST-PAYLOAD': ''}) // Why, ebay? Why?
    .query({'paginationInput.entriesPerPage': 1})
    .query({keywords: this.keywords})
    .query({'affiliate.trackingId': this.trackingId})
    .query({'affiliate.networkId': this.networkId || defaultNetwork})
    .query({'itemFilter(0).name': 'ListingType'})
    .query({'itemFilter(0).value(0)': this.listingType || defaultListing})
    .query({'itemFilter(1).name': 'Condition'})
    .query({'itemFilter(1).value(0)': this._condition || defaultCondition})
    .end(function (err, res) {
      if (err) return cb(err);

      return parse(res.text, function (err, p) {
        // Parsing errors
        if (err) return cb(err);

        // API errors
        if (err = parseErr(p)) return cb(err);

        // Return result
        return cb(null, parseResults(p, extractions));
      });
    });
};

var parseErr = function (obj) {
  var result = path(obj, '$..error..message[0]');
  return result.length ? new Error(result[0]) : null;
};

var first = function (obj, query) {
  var result = path(obj, query);
  return result.length ? result[0] : null;
};

var formatPrice = function (obj) {
  var amount = obj._
    , code = obj.$ && obj.$.currencyId;

  if (!amount || !currency) return null;

  return accounting.formatMoney(amount, currency(code));
};

var extractions = [
  { name: 'id', query: '$..itemId[0]' },
  { name: 'name', query: '$..title[0]' },
  { name: 'url', query: '$..viewItemURL[0]' },
  { name: 'offerPrice',
    query: '$..sellingStatus..currentPrice[0]',
    transform: formatPrice
  },
  { name: 'listPrice',
    query: '$..discountPriceInfo..originalRetailPrice[0]',
    transform: formatPrice
  }
];

var parseResults = function (obj, extractions) {
  var that = this;

  var res = _
    .chain(extractions)
    .map(function (x) {
      var key = x.name
        , val = first(obj, x.query);

      // Transform value if we have a transform available
      if (x.transform && val !== null) val = x.transform.call(that, val);

      return [key, val];
    })
    .filter(function (x) {
      return x[1] !== null;
    })
    .object()
    .value();

  return _.keys(res).length ? res : null;
};

var capitalize = function (str) {
  return str.slice(0,1).toUpperCase() + str.slice(1)
};
