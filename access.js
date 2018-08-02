/*
Load the CSV with all data sets
*/

const fs = require('fs')
const parse = require('csv-parse/lib/sync')
let csv = parse(fs.readFileSync(__dirname + '/data/daten_berlin_de.page_stats.datensaetze.csv', 'utf8'))

/*
Check which data sets do not (or anymore) exist, which exist and which lead to an access denied page
*/

let status = {}, si = 1, errors = {}

const cheerio = require('cheerio')
const { exec } = require('child_process');
 
const buildRequest = () => {

	/*
	
		bullshit:

		<front>
		wfs) > wfs
		%3C at end

	*/

	let name = decodeURI(csv[si][0])

	exec('wget -O /Users/sebastianmeier/Sites/TSB/od-nutzung/output/temp.html https://daten.berlin.de/datensaetze/'+decodeURI(name), (err, stdout, stderr) => {
		if (err) {
			if(stderr.indexOf('ERROR 403: Forbidden')>=0){
				status[name] = '403'
			}else{
				console.log(err, stderr)
				errors[name] = {err:err, stderr:stderr}
			}
		}else{

			let $ = cheerio.load(fs.readFileSync(__dirname + '/output/temp.html', 'utf8'), {xmlMode: true});

			let title = $('#page-title').text().trim()
			
			if(title == 'Datensätze'){
				status[name] = '404'
			}else if(title == 'Access Denied / User log in'){
				status[name] = '401'
			}else{
				status[name] = '200'
			}

		}

		console.log(si, name, status[name])

		nextRequest()

	});


}

const nextRequest = () => {
	si++
	if(si<csv.length){
		buildRequest()
	}else{
		fs.writeFileSync(__dirname + '/output/access.json', JSON.stringify(status), 'utf8')
		fs.writeFileSync(__dirname + '/output/access-errors.json', JSON.stringify(errors), 'utf8')
		process.exit()
	}
}

buildRequest()