"use strict"
// includes
const Parser  = require( 'papaparse' ),
      Fs      = require( 'mz/fs' ),
      Request = require( 'request-promise' );

const cfg = {
  baseUrl: 'https://de.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=',
  wikiUrl: 'http://de.wikipedia.org/wiki/',  
  regexp:  /wikibase_item":"(Q\d+)"/gi,
  COL_WIKILINK: 1
};


!( async function(){
  
  // get file
  const file = await Fs.readFile( __dirname + '/data/res_geoloc.tsv', 'utf8' );
  const data = Parser.parse( file, { delimiter: '\t' } );

  for( let i=0; i<data.data.length; i++ ) {

    // shortcut
    let d = data.data[i];

    // get wiki-id
    const wikiId = d[cfg.COL_WIKILINK].replace( cfg.wikiUrl, '' );

    // skip if empty
    if( wikiId == '' ) {
      d.push( null );
      continue;
    }
    
    // get API response
    const wikires = await Request( cfg.baseUrl + wikiId );
    
    // wikidata id
    cfg.regexp.lastIndex = 0;
    const wikidataIdRes = cfg.regexp.exec( wikires );
    
    // do we have a match?
    let wikidataId = null;
    if( wikidataIdRes ) {
      console.log( 'match:', wikiId, ' - ', wikidataIdRes[1] )
      wikidataId = wikidataIdRes[1];
    } else {
      console.log( 'no match:', wikiId );
      console.log();
    }
    
    // append to table
    d.push( wikidataId );
  }

  const result = Parser.unparse( data, { delimiter: '\t' } );
  
  await Fs.writeFile( __dirname + '/data/res_wikidataId.tsv', result );
  
})()
  .catch( e => console.log(e) );