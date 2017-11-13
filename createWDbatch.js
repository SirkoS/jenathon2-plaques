"use strict"
// includes
const Parser  = require( 'papaparse' ),
      Fs      = require( 'mz/fs' ),
      Wdk     = require( 'wikidata-sdk' ),
      Request = require( 'request-promise' );

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

  WD_QUERY: `
    SELECT  ?tafel
            ?tafelLabel
            ?commemorate
            ?coordinates
            ?address
    WHERE {
      ?tafel wdt:P31 wd:Q721747;      # instances of commemorative plaques
             wdt:P131 wd:Q3150 .      # located in the administrative territorial entity of the city of Jena
      OPTIONAL { ?tafel wdt:P547 ?commemorate . }  # commemorates
      OPTIONAL { ?tafel wdt:P625 ?coordinates . }  # coordinates
      OPTIONAL { ?tafel wdt:P969 ?address . }      # address
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } # labels for the plaque and the person
    }
  `,
  WD_FROM_POINT:  /Point\((\d+\.\d+) (\d+\.\d+)\)/gi,
  WD_FROM_LATLON: /@(\d+\.\d+)\/(\d+\.\d+)/gi,
  WD_TO_POINT:    '@$2/$1',
  WD_URL:         'http://www.wikidata.org/entity/',
  
  REPLACMENTS_NAME: [ [/^Baedecker, Karl$/, 'Baedeker, Karl'] ],

};


/**
 * flatten the objects resulted by the WD API
 */
function flatten( entry ) {
  return Object.keys( entry )
               .reduce( (agg, el) => { agg[el] = entry[el].value; return agg; }, {} );
}


!( async function(){

  // build url to retrieve already uploaded data
  const urlWD = Wdk.sparqlQuery( cfg.WD_QUERY );

  // query for existing entities
  const resp = await Request( urlWD ),
        existData = JSON.parse( resp );

  // two lookups: by commemorates URL and by name
  const entUrl = {},
        entName = {};
  for( let entry of existData.results.bindings ) {

    // flatten entry
    const pEntry = flatten( entry );

    // convert location format if present
    if( 'coordinates' in pEntry ) {
      // pEntry.coordinates = pEntry.coordinates.replace( cfg.WD_FROM_POINT, cfg.WD_TO_POINT );
      pEntry.lat = pEntry.coordinates.replace( cfg.WD_FROM_POINT, '$1' );
      pEntry.lon = pEntry.coordinates.replace( cfg.WD_FROM_POINT, '$2' );
    }

    // parse name
    const name = pEntry.tafelLabel.replace( cfg.LABEL_EN.trim(), '' ).trim();

    // add to name lookup
    entName[ name ] = pEntry;

    // if commemorate is set, add to lookup
    if( 'commemorate' in pEntry ) {

      // get the reference
      pEntry.commemorate = pEntry.commemorate.replace( cfg.WD_URL, '' );

      // add to lookup
      entUrl[ pEntry.commemorate ] = pEntry;

    }
  }

  // get file
  const file = await Fs.readFile( __dirname + '/data/res_wikidataId.tsv', 'utf8' );
  const data = Parser.parse( file, { delimiter: '\t' } );

  // skip lines with wrong column count
  const input = data.data.filter( (line) => line.length == cfg.COLCOUNT );

  // generate output
  const out = [], diff = [];
  for( let i=0; i<input.length; i++ ) {

    // shortcut
    const entry = input[i];

    // trim all entries
    for( let i=0; i<entry.length; i++ ) {
      if( typeof entry[i] == 'string' ) {
        entry[i] = entry[i].trim();
      }
    }

    // skip entries with neither coordinates nor wikilink
    if(    (entry[ cfg.COL_WDID ] == '')
        && (entry[ cfg.COL_PLACE_COORD ] == '') ) {
      continue;
    }

    // we have to adjust some entries
    for( let repl of cfg.REPLACMENTS_NAME ) {
       entry[cfg.COL_NAME] =  entry[cfg.COL_NAME].replace( repl[0], repl[1] );
    }

    // check, if we got something already
    let existEntry;
    if( (entry[ cfg.COL_WDID ] != '') && (entry[ cfg.COL_WDID ] in entUrl)) {
      existEntry = entUrl[ entry[ cfg.COL_WDID ] ];
    }
    else if( entry[cfg.COL_NAME] in entName ) {
      existEntry = entName[ entry[cfg.COL_NAME] ];
    }

    // get the uri for the entry
    let uri;
    if( existEntry ) {

      // we already know this entry, so reuse the old URI
      uri = existEntry.tafel.replace( cfg.WD_URL, '' );

    } else {

      // new entry
      // create entry and link to basic concepts
    out.push(
`CREATE
LAST	P17	Q183
LAST	P31	Q721747
LAST	P131	Q3150` );

      // add labels and descriptions
      out.push(
`LAST	Len	"${cfg.LABEL_EN} ${entry[cfg.COL_NAME]}"
LAST	Lde	"${cfg.LABEL_DE} ${entry[cfg.COL_NAME]}"
LAST	Den	"${cfg.DESC_EN}"
LAST	Dde	"${cfg.DESC_DE}"` );

      // use the magic word for other entries
      uri = 'LAST';
    }


    // is linked to person
    if( entry[ cfg.COL_WDID ] != '' ) {

      if( existEntry && ('commemorate' in existEntry) ) {

        // check for differences
        if( existEntry.commemorate != entry[ cfg.COL_WDID ] ) {
          diff.push( `${uri}	P547	${entry[ cfg.COL_WDID ]}` );
        }

      } else {

        // no entry so far, so add it
        out.push(`${uri}	P547	${entry[ cfg.COL_WDID ]}`);

      }

    }

    // we got a geolocated address
    if( entry[ cfg.COL_PLACE_COORD ] != '' ) {

      if( existEntry && ('coordinates' in existEntry) ) {

        // parse lat lon from data
        const lat = entry[ cfg.COL_PLACE_COORD ].replace( cfg.WD_FROM_LATLON, '$2' ),
              lon = entry[ cfg.COL_PLACE_COORD ].replace( cfg.WD_FROM_LATLON, '$1' );

        // check for differences
        if( !lat.includes(existEntry.lat) || !lon.includes(existEntry.lon) ) {
          console.log( existEntry.lat, 'in', lat, ':', lat.includes(existEntry.lat) );
          diff.push( JSON.stringify( [ [lat, lon ], [existEntry.lat, existEntry.lon] ] ) );
          diff.push( `${uri}	P625	${entry[ cfg.COL_PLACE_COORD ]}` );
          diff.push(`${uri}	P969	"${entry[ cfg.COL_PLACE_STR ]}"`);
        }

      } else {

        // no entry so far, so add it
        out.push(`${uri}	P625	${entry[ cfg.COL_PLACE_COORD ]}`);
        out.push(`${uri}	P969	"${entry[ cfg.COL_PLACE_STR ]}"`);

      }
    }

  }

  // write results to file
  await Fs.writeFile( __dirname + '/data/res_wikidataBatch.txt', out.join( '\n' ) );
  await Fs.writeFile( __dirname + '/data/res_wikidataBatch_diff.txt', diff.join( '\n' ) );

})()
  .catch( e => console.log(e) );