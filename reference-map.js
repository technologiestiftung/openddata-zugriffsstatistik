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

const fs = require('fs')

let references = JSON.parse(fs.readFileSync(__dirname + '/output/references.json', 'utf8')),
	ri = 0, map = {}, refs = []

for(let key in references){ refs.push({id:key,refs:references[key].refs,website:references[key].website}) }

const checkReference = () => {
	console.log(ri, refs[ri].id)
	if(refs[ri].refs.length > 0){
		let query = 'SELECT package.name AS name, package.id AS id FROM package JOIN resource ON package.id = resource.package_id WHERE '

		refs[ri].refs.forEach((r,ri)=>{
			if(ri>0) query += ' OR '
			query += " resource.url = '"+r+"'"
		})

		query += ' LIMIT 1'

		client.query(query, (err, res) => {
			if(err) throw err

			if(res.rowCount > 0){

				map[refs[ri].id] = {id:res.rows[0].id,name:res.rows[0].name}
				nextReference()

			}else if(refs[ri].website.length>0){

				client.query(`SELECT id, name FROM package WHERE url = '${refs[ri].website[0]}'`, (err, res) => {
					if(err) throw err

					if(res.rowCount > 0){
						map[refs[ri].id] = {id:res.rows[0].id,name:res.rows[0].name}
					}else{
						map[refs[ri].id] = false
					}
					nextReference()
				})

			}else{
				map[refs[ri].id] = false
				nextReference()
			}
		})


	}else if(refs[ri].website.length > 0){

		client.query(`SELECT id, name FROM package WHERE url = '${refs[ri].website[0]}'`, (err, res) => {
			if(err) throw err

			if(res.rowCount > 0){
				map[refs[ri].id] = {id:res.rows[0].id,name:res.rows[0].name}
			}else{
				map[refs[ri].id] = false
			}
			nextReference()
		})

	}else{
		map[refs[ri].id] = false
		nextReference()
	}
}

const nextReference = () => {
	ri++
	if(ri<refs.length){
		checkReference()
	}else{
		fs.writeFileSync(__dirname + '/output/reference-map.json', JSON.stringify(map), 'utf8')
		process.exit()
	}
}

checkReference()