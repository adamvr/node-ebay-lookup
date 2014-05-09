/**
 * Module dependencies
 */
var request = require('superagent')
  , _ = require('underscore')
  , path = require('JSONPath').eval
  , parse = require('xml2js').parseString;

/**
 * API endpoint
 */
var endpoint = 'http://svcs.ebay.com/services/search/FindingService/v1';

module.exports = function (kw) {
  return new Ebay(kw);
};

var Ebay = function (itemId) {
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
Ebay.prototype.country = function (country) {
  // Lookup matching country
  var results = _.where(countryId, {countryCode: country});

  // Set endpoint
  this.globalId = results.length ? results[0].globalId : null;

  // Return this for chaining
  return this;
};

Ebay.prototype.affiliate = function (affiliateId) {
  return this.affiliateId = affiliateId, this;
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

Ebay.prototype.done = function (cb) {
  return request
    .get(endpoint)
    .query({'OPERATION-NAME': 'findItemsAdvanced'})
    .query({'SERVICE-VERSION': '1.0.0'})
    .query({'SECURITY-APPNAME': this.id})
    .query({'GLOBAL-ID': this.globalId})
    .query({'RESPONSE-DATA-FORMAT': 'XML'})
    .query({'REST-PAYLOAD': ''}) // Why, ebay? Why?
    .query({'paginationInput.entriesPerPage': 1})
    .query({keywords: this.keywords})
    .query({'affiliate.trackingId': this.affiliateId})
    .query({'affiliate.networkId': this.networkId || defaultNetwork})
    .end(function (err, res) {
      if (err) return cb(err);

      return parse(res.text, function (err, p) {
        // Parsing errors
        if (err) return cb(err);

        // API errors
        if (err = parseErr(p)) return cb(err);

        // Return result
        return cb(null, p);
      });
    });
};

var parseErr = function (obj) {
  var result = path(obj, '$..error..message[0]');
  return result.length ? new Error(result[0]) : null;
};
