#!/usr/bin/env node

/**
 * Module dependencies
 */
var ebay = require('./')
  , nomnom = require('nomnom');

var opts = nomnom
  .script('ebay-lookup')
  .nocolors()
  .option('id', {
    abbr: 'i',
    required: true,
    help: 'Ebay api key'
  })
  .option('keywords', {
    abbr: 'k',
    required: true,
    help: 'Keywords to search for'
  })
  .option('affiliate', {
    abbr: 'a',
    help: 'Affiliate id'
  })
  .option('country', {
    abbr: 'c',
    help: 'Country'
  })
  .option('type', {
    abbr: 't',
    help: 'Offer type'
  })
  .parse();

ebay({keywords: opts.keywords})
  .id(opts.id)
  .affiliate(opts.affiliate)
  .country(opts.country)
  .type(opts.type)
  .done(function (err, res) {
    if (err) throw err;
    console.log(JSON.stringify(res));
  });
