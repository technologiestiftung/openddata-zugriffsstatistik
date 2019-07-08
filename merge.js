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
const moment = require('moment')

let csv = parse(fs.readFileSync(__dirname + '/data/daten_berlin_de.page_stats.datensaetze.csv', 'utf8'), {columns:true}),
	access = JSON.parse(fs.readFileSync(__dirname + '/output/access.json')),
	map = JSON.parse(fs.readFileSync(__dirname + '/output/reference-map.json'))

let data = [], ci = 0

const processItem = () => {
	let c = csv[ci]

	let page = decodeURI(c.page)

	console.log(ci, csv.length, page)

	let accessCode = 404
	if(page in access){
		accessCode = parseInt(access[page])
	}

	let pv = [], pi = [], pv_sum = 0, pi_sum = 0

	for(let key in c){
		if(key.indexOf('pi')>=0){
			if(!isNaN(parseInt(c[key]))){
				pi_sum += parseInt(c[key])
				pi.push({date:key.split(' ')[0], c:parseInt(c[key])})
			}else{
				pi.push({date:key.split(' ')[0], c:0})
			}
		}

		if(key.indexOf('pv')>=0){
			if(!isNaN(parseInt(c[key]))){
				pv_sum += parseInt(c[key])
				pv.push({date:key.split(' ')[0], c:parseInt(c[key])})
			}else{
				pv.push({date:key.split(' ')[0], c:0})
			}
		}
	}

	let ckan_url = '', ckan_id = ''

	if(page in map){
		ckan_url = map[page].name
		ckan_id = map[page].id
	}

	if(accessCode == 200 && ckan_url == '') accessCode = 204

	let item = {
		page:page,
		ckan_url:ckan_url,
		ckan_id:ckan_id,
		pv:pv,
		pi:pi,
		pv_sum:pv_sum,
		pi_sum:pi_sum,
		access:accessCode
	} 

	if(accessCode == 200){

		client.query(`SELECT package.title, package.url, package.author, package.author_email, package.maintainer, package.maintainer_email, package.notes, package.license_id, package.type, package.metadata_created, package.metadata_modified, package.geographical_granularity, package.temporal_granularity, package.date_released, package.date_updated, package.temporal_coverage_from, package.temporal_coverage_to, package.license_title, (SELECT string_agg(name, ';') FROM package_tag JOIN tag ON tag.id = package_tag.tag_id WHERE package_tag.package_id = package.id GROUP BY package_tag.package_id) AS tags, (SELECT string_agg(name, ';') FROM package_group JOIN "group" ON "group".id = package_group.group_id WHERE package_group.package_id = package.id GROUP BY package_group.package_id) AS group_name, (SELECT string_agg(title, ';') FROM package_group JOIN "group" ON "group".id = package_group.group_id WHERE package_group.package_id = package.id GROUP BY package_group.package_id) AS group_title FROM package WHERE package.id = '${ckan_id}'`, (err, res) => {
			if(err) throw err

			if(res.rowCount > 0){
				new Array('tags', 'group_name', 'group_title').forEach(n=>{
					if(res.rows[0][n] == null || res.rows[0][n].length == 0){
						res.rows[0][n] = []
					}else{
						let a = res.rows[0][n].split(';'),
							as = []
						a.forEach(aa=>{
							if(as.indexOf(aa)==-1) as.push(aa)
						})
						res.rows[0][n] = as

					}
				})
				
				for(let key in res.rows[0]){
					item[key] = res.rows[0][key]
				}

				//Turns out there is a lot of testing before a data set actually goes online ?!

				let d_released = moment(res.rows[0].date_released)
					d_released = moment(d_released.format('YYYY-MM')+'-01')

				for(let i = item.pv.length-1; i>=0; i--){
					let date = moment(item.pv[i].date)
					let diff = date.diff(d_released)
					if(diff < 0){
						item.pv.splice(i,1)
						item.pi.splice(i,1)
					}
				}

			}

			data.push(item)

			nextItem()
		})

	}else{

		//This is an item not accessible to the public (anymore)

		data.push(item)

		nextItem()
	}

}

const nextItem = () => {
	ci++
	if(ci<csv.length){
		processItem()
	}else{
		fs.writeFileSync(__dirname + '/output/final.json', JSON.stringify(data), 'utf8')
		process.exit()
	}
}

processItem()