const fs = require('fs')
const access = require(__dirname + '/output/access.json')

const parse = require('csv-parse/lib/sync')
let csv = parse(fs.readFileSync(__dirname + '/data/daten_berlin_de.page_stats.datensaetze.csv', 'utf8'))

const cheerio = require('cheerio')
const { exec } = require('child_process');

let filtered = csv.filter((d,di)=>{
	let name = decodeURI(d[0])
	if(di>0 && name in access && access[name] == '200'){
		return true
	}
	return false
})

let fi = 0, 
	references = {},
	errors = {}

const getReferences = () => {
	let name = decodeURI(filtered[fi][0])
	exec('wget -O /Users/sebastianmeier/Sites/TSB/od-nutzung/output/temp.html https://daten.berlin.de/datensaetze/'+decodeURI(name), (err, stdout, stderr) => {

		let links = [], website = []

		if (err) {
			console.log(err, stderr)
			errors[name] = {err:err, stderr:stderr}
		}else{

			let $ = cheerio.load(fs.readFileSync(__dirname + '/output/temp.html', 'utf8'), {xmlMode: true});

			$('.dataset_resource .download-btn a.btn').each((i,a)=>{
				links.push($(a).attr('href'))
			})

			$('.field-name-field-website a').each((i,a)=>{
				website.push($(a).attr('href'))
			})
			
			references[name] = {refs:links,website:website}

		}

		console.log(fi, filtered.length, name, links.length, website.length)

		nextReference()

	});
}

const nextReference = () => {
	fi++
	if(fi<filtered.length){
		getReferences()
	}else{
		fs.writeFileSync(__dirname + '/output/references.json', JSON.stringify(references), 'utf8')
		fs.writeFileSync(__dirname + '/output/references-errors.json', JSON.stringify(errors), 'utf8')
		process.exit()
	}
}

getReferences()