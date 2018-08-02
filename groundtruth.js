const request = require('request-promise')
const fs = require('fs')

let packages, pi = 0, datenregister = []

request('https://datenregister.berlin.de/api/3/action/package_list')
	.then(function (body) {
	    packages = JSON.parse(body).result
	    getDetails()
	})
	.catch(function (err) {
		throw err
	});

const getDetails = () => {
	console.log(pi, packages.length, packages[pi])
	request('https://datenregister.berlin.de/api/3/action/package_show?id='+packages[pi])
		.then(function (body) {
		    datenregister.push(JSON.parse(body).result)
		    nextDetails()
		})
		.catch(function (err) {
			throw err
		});
}

const nextDetails = () => {
	pi++
	if(pi<packages.length){
		getDetails()
	}else{
		fs.writeFileSync(__dirname + '/output/datenregister.json', JSON.stringify(datenregister), 'utf8')
		process.exit()
	}
}