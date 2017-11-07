# Jenathon 2
## Add commemorative plaque to Wikidata

### Sources

* http://dbm.neuro.uni-jena.de/gedenktafel/
* https://github.com/Daniel-Mietchen/ideas/issues/557
* https://opendata.jena.de/dataset/adressen-verortet
 
### Install

* clone repo
* `npm init`
* update `data/source.tsv`
  * structure: `Name | Wikipedia Link | Address living | Address plaque`
* get `data/adressen.csv` from https://opendata.jena.de/dataset/adressen-verortet
 
### Running

Run scripts in this order or adapt column index context in scripts heads.
Each script returns a TSV file with the following structure.

* `geolocate.js`
  * structure: `Name | Wikipedia Link | Address Home | Address Plaque | Coordinates Home | Coordinates Plaque`
* `wikidataId.js`
  * structure: `Name | Wikipedia Link | Address Home | Address Plaque | Coordinates Home | Coordinates Plaque | Wikidata ID`
* `createWDbatch.js`
  * structure: `Wikidata ID | Wikidata Property | Wikidata Value`

Final result will be in `data/res_wikidataBatch.txt` ready to deploy using https://tools.wmflabs.org/wikidata-todo/quick_statements.php
