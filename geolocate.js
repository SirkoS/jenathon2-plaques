"use strict";

// includes
const Fs = require( 'mz/fs' ),
      Parser = require( 'papaparse' );

// constants
const ADD_COL_LAT = 1,
      ADD_COL_LON = 2,
      ADD_COL_STREET = 3,
      ADD_COL_NUMBER = 4,
      SRC_COL_W = 2,
      SRC_COL_GT = 3,
      SRC_COLCOUNT = 4,
      STOPWORDS = ['unbekannt'],
      REMOVALS = [
        /\([^\)]*\)/gi,   // additions in parenthesis
        /u\. a\./gi,
        /Str\./gi, /Straße/gi,
        /\d+\./gi,
      ];

async function run(){

  // Create address lookup
  const addLookup = {};
  let data = await Fs.readFile( __dirname + '/data/adressen.csv', 'utf8' );
  data.split( '\n' )
    .map( line => line.trim() )
    .filter( line => line != '' )
    .map( line => line.split( ',' ) )
    .forEach( line => {
      line[ ADD_COL_STREET ] = line[ ADD_COL_STREET ].replace( /Str\./gi, '' ).trim();
      addLookup[ line[ ADD_COL_STREET ] ] = addLookup[ line[ ADD_COL_STREET ] ] || {};
      addLookup[ line[ ADD_COL_STREET ] ][ line[ ADD_COL_NUMBER ] ] = {
        lat: line[ ADD_COL_LAT ],
        lon: line[ ADD_COL_LON ]
      }
    });

  // parse entries
  data = await Fs.readFile( __dirname + '/data/source.tsv', 'utf8' );
  let input = Parser.parse( data, { delimiter: '\t' } ).data;
  /*
  let input = data.split( '\n' )
                    .map( line => {
                      // remove start end stopcharacters
                      line = trimChar( line.trim(), [' ',':'] )
                      // get numbers out of parenthesis
                      line = line.replace( /\((\d{1,2})\)/gi, '$1' );

                      return line;
                    });
                    */

  // remove lines of wrong column count
  input = input.filter( (line, rowNumber) => {
    if( line.length != SRC_COLCOUNT ) {
      console.log( 'invalid line (' + rowNumber + ') column count', line.length );
      return false;
    } else {
      return true;
    }
  });

  // some pre processing of address columns
  input.forEach( (line) => {

    // remove start end stopcharacters
    line[ SRC_COL_W ] = trimChar( line[ SRC_COL_W ].trim(), [' ',':'] )
    // get numbers out of parenthesis
    line[ SRC_COL_W ] = line[ SRC_COL_W ].replace( /\((\d{1,2})\)/gi, '$1' );

    line[ SRC_COL_GT ] = line[ SRC_COL_GT ] || '';
    // remove start end stopcharacters
    line[ SRC_COL_GT ] = trimChar( line[ SRC_COL_GT ].trim(), [' ',':'] )
    // get numbers out of parenthesis
    line[ SRC_COL_GT ] = line[ SRC_COL_GT ].replace( /\((\d{1,2})\)/gi, '$1' );

  });


  // process
  let nohit = 0, hit = 0;
  input.forEach( entry => {

    // W cell
    let add = parse( entry[ SRC_COL_W ] ),
        coord = null,
        usedAddr = null;
    if( add && (add.length == 1) ) {
      ({ coord, usedAddr } = match( add[0] ));
    }
    entry.push( coord );

    // GT cell
    add = parse( entry[ SRC_COL_GT ] );
    coord = null;
    usedAddr = null;
    if( add && (add.length == 1) ) {
      ({ coord, usedAddr } = match( add[0] ));
    }
    entry.push( usedAddr );
    entry.push( coord );

  })

  let output = Parser.unparse( input, { delimiter: '\t' } );

  await Fs.writeFile( __dirname + '/data/res_geoloc.tsv', output );

  console.log( 'hits:', hit );
  console.log( 'nohits:', nohit );
  console.log( 'total:', (hit+nohit),'/', input.length );


  /* ------------------------- Functions ------------------------- */

  /*
   * parse one address string
   */
  function parse( entry ) {

    // try to parse the string
    let comp = Parser.parse( entry,{
      delimiter: function(input) { return input.includes( ';' ) ? ';' : ',' }
    });

    // 0nly parsables
    if( !('data' in comp) || (comp.data.length < 1) ){
      nohit++;
      return;
    }
    comp = comp.data[0].map( entry => entry.trim() ).filter( entry => entry != '' );

    // skip stopwords
    if( (comp.length == 1) && STOPWORDS.includes( input ) ){
      nohit++;
      return;
    }

    return comp;
  }

  /*
   * try to match a single entry to the address list
   */
  function match( input, entry ) {
      // removals
      REMOVALS.forEach( (r) => {
        input = input.replace( r, '' );
      });
      input = input.replace( /\(.*\)/, '' );

      // try to identify name and number
      const name = input.replace( /\d/gui, '' ).trim(),
            number = input.replace( /[^0-9]/gi, '' ).trim();

      // try to find
      if( (name in addLookup) && (number in addLookup[name]) ){
        // found it
        hit++;
        return {
          coord:    '@' + addLookup[name][number].lat + '/' + addLookup[name][number].lon,
          usedAddr: input.trim()
        };
      } else {
        nohit++;
        return { coord: '', usedAddr: '' };
      }

  }

}

run().then()
    .catch( (e) => console.log(e) );

// https://stackoverflow.com/a/26156806/1169798
function trimChar(string, charToRemove) {
    while(charToRemove.includes( string.charAt(0) )) {
        string = string.substring(1);
    }

    while(charToRemove.includes( string.charAt(string.length-1) ) ) {
        string = string.substring(0,string.length-1);
    }

    return string;
}