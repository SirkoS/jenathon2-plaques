"use strict"
// includes
const Parser  = require( 'papaparse' ),
      Fs      = require( 'mz/fs' );

const cfg = {
  COL_NAME:         0,      // person name
  COL_WIKILINK:     1,      // wikipedia link
  COL_PLACE_STR:    5,      // string for used address
  COL_PLACE_COORD:  6,      // coordinates of address
  COL_WDID:         7,      // wikidata ID
  
  COLCOUNT:         8,
  SEP:              '\t',
  LABEL_EN:         'commemorative plaque:',
  LABEL_DE:         'Gedenktafel in Jena:',
  DESC_EN:          'commemorative plaque in Jena',
  DESC_DE:          'Gedenktafel in Jena',
};


!( async function(){
  
  // get file
  const file = await Fs.readFile( __dirname + '/data/res_wikidataId.tsv', 'utf8' );
  const data = Parser.parse( file, { delimiter: '\t' } );

  // skip lines with wrong column count
  const input = data.data.filter( (line) => line.length == cfg.COLCOUNT );
  
  // generate output
  const out = [];
  for( let i=0; i<input.length; i++ ) {

    // shortcut
    const entry = input[i];
    
    // skip entries with neither coordinates nor wikilink
    if(    (entry[ cfg.COL_WDID ].trim() == '')
        && (entry[ cfg.COL_PLACE_COORD ].trim() == '') ) {
      continue;
    }

    // create entry and link to basic concepts
    out.push( 
`CREATE
LAST	P17	Q183
LAST	P131	Q3150` );

    // add labels and descriptions
    out.push(
`LAST	Len	"${cfg.LABEL_EN} ${entry[cfg.COL_NAME]}"
LAST	Lde	"${cfg.LABEL_DE} ${entry[cfg.COL_NAME]}"
LAST	Den	"${cfg.DESC_EN}"
LAST	Dde	"${cfg.DESC_DE}"` );

    // is linked to person
    if( entry[ cfg.COL_WDID ].trim() != '' ) {
      out.push(`LAST	P547	${entry[ cfg.COL_WDID ]}`);
    }

    // we got a geolocated address
    if( entry[ cfg.COL_PLACE_COORD ].trim() != '' ) {
      out.push(`LAST	P625	${entry[ cfg.COL_PLACE_COORD ]}`);
      out.push(`LAST	P969	"${entry[ cfg.COL_PLACE_STR ]}"`);
    }
    
  }

  // write results to file
  await Fs.writeFile( __dirname + '/data/res_wikidataBatch.txt', out.join( '\n' ) );
  
})()
  .catch( e => console.log(e) );