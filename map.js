const config = require('./config.json')

/*
Connect to the Berlin open data meta-data database
*/

const { Client } = require('pg')

const client = new Client({
  user: config.postgres.user,
  host: config.postgres.server,
  database: config.postgres.database,
  password: config.postgres.password,
  port: config.postgres.port,
})

client.connect()

/*
Load the CSV with all data sets
*/

const fs = require('fs')
const parse = require('csv-parse/lib/sync')
let csv = parse(fs.readFileSync(__dirname + '/data/daten_berlin_de.page_stats.datensaetze.csv', 'utf8'))

// keys => csv[0]

/*
In the current version the names in the database are not equal to the names in the portal due to a encoding problem, for the meantime the following creates a mapping table stored in a CSV
*/

let ci = 1, map = {}, notfound = []

//https://stackoverflow.com/questions/5069464/replace-multiple-strings-at-once
String.prototype.replaceArray = function(find, replace) {
  var replaceString = this;
  var regex; 
  for (var i = 0; i < find.length; i++) {
    regex = new RegExp(find[i], "g");
    replaceString = replaceString.replace(regex, replace[i]);
  }
  return replaceString;
};

const check = () => {

	/*
		Broken original data file:
		n%C3n%A4 > %C3%A4
		Â§ > §
		%F6 > %C3%B6
		%C3%F9 > %C3%9F
		Ã¼ > %C3%BC
		%C3%B6 > %C3%96
		Ã¤ > %C3%A4
		%25C3%25BC > %C3%BC
		%C3%83%C2%BC > %C3%BC
		%20 > ?? > -
	*/

	let name = decodeURI(csv[ci][0]),
		alt1_name = name.replaceArray(['ä','ö','ü','ß'],['ae','oe','ue','ss']),
		alt2_name = name.replaceArray(['ä','ö','ü','ß'],['-','-','-','-'])

	console.log(ci,name)

	client.query(`SELECT id, name FROM package WHERE name = '${name}'`, (err, res) => {
		if(res.rowCount == 0){

			client.query(`SELECT id, name FROM package WHERE name = '${alt1_name}'`, (err, res) => {
				if(res.rowCount == 0){

					client.query(`SELECT id, name FROM package WHERE name = '${alt2_name}'`, (err, res) => {
						if(res.rowCount == 0){

							notfound.push(name)
							nextCheck()
							
						}else{
							map[name] = {id:res.rows[0].id, name:res.rows[0].name}
							nextCheck()
						}
					})					
					
				}else{
					map[name] = {id:res.rows[0].id, name:res.rows[0].name}
					nextCheck()
				}
			})

		}else{
			map[name] = {id:res.rows[0].id, name:res.rows[0].name}
			nextCheck()
		}
	})
}

const nextCheck = () => {
	ci++
	if(ci<csv.length){
		check()
	}else{

		fs.writeFileSync(__dirname + '/output/map.json', JSON.stringify(map), 'utf8')
		fs.writeFileSync(__dirname + '/output/notfound.json', JSON.stringify(notfound), 'utf8')

		client.end()
		process.exit()	
	}
}

check()