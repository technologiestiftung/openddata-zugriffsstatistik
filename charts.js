/*

this files builds small CSV files containing the data for the visualisations

*/

const math = require('mathjs')

const fs = require('fs')
const parse = require('csv-parse/lib/sync')
const moment = require('moment')

let csv = parse(fs.readFileSync(__dirname + '/data/daten_berlin_de.page_stats.datensaetze.csv', 'utf8'), {columns:true}),
	access = JSON.parse(fs.readFileSync(__dirname + '/output/access.json'))
	final = JSON.parse(fs.readFileSync(__dirname + '/output/final.json'))

let times = {pi:{},pv:{}}, accessible = {pi:{},pv:{}}, real = {pi:{},pv:{}}, real_access = {pi:{},pv:{}}, outlier_real_access = {pi:{},pv:{}}

csv.forEach(c=>{
	for(let key in c){
		let type = false
		if(key.indexOf('pi')>=0){
			type = 'pi'
		}else if(key.indexOf('pv')>=0){
			type = 'pv'
		}
		if(type){
			let time = key.split(' ')[0], value = parseInt(c[key])
			if(!(time in times[type])) times[type][time] = 0
			if(!isNaN(value)){
				times[type][time] += value
			}

			let name = decodeURI(c.page)

			if(name in access){
				if(access[name] == 200){
					if(!(time in accessible[type])) accessible[type][time] = 0
					if(!isNaN(value)){
						accessible[type][time] += value
					}
				}
			}
		}
	}
})

const findMinMaxOutlier = (a) => {

	let values = a.concat()

	values.sort( (a, b) => a - b )

	let q1 = values[Math.floor((values.length / 4))],
    	q3 = values[Math.ceil((values.length * (3 / 4)))],
    	iqr = q3 - q1,
		maxValue = q3 + iqr*7, //1.5
    	minValue = q1 - iqr*7 //1.5

    let outlier = values.filter(d=>(d>maxValue)?true:false)

    return (outlier.length > 0) ? maxValue : false
}

final.forEach(f=>{
	for(let type in real){
		f[type].forEach(d=>{
			if(!(d.date in real[type])) real[type][d.date] = 0
			real[type][d.date] += d.c

			if(f.access == 200){
				if(!(d.date in real_access[type])) real_access[type][d.date] = 0
				real_access[type][d.date] += d.c
			}
		})
	}
})

let outliers_max = {}, outlier_json = [], outlier_keys = {}

//in case of outliers duplicate the original data and reduce outliers to max
final.forEach(f=>{
	for(let type in real){
		let values = []
		f[type].forEach(p=>values.push(p.c))
		if(values.length>5 && math.max(values)>1000){
			let max = findMinMaxOutlier(values)
			if(max){

				if(!(f.page in outlier_keys)){
					outlier_json.push(f)
					outlier_keys[f.page] = true
				}

				f['original_'+type] = JSON.parse(JSON.stringify(f[type]))

				f[type].forEach(ff=>{
					if(ff.c > max){
						ff.c = max
					}
				})

				//Temporarily completely remove outlier sets
				//f[type] = []

			}
		}
	}
})

fs.writeFileSync(__dirname + '/output/charts/outlier.json', JSON.stringify(outlier_json), 'utf8')

let seasonal = {}

final.forEach(f=>{
	if(f.access == 200){
		for(let type in real){
			f[type].forEach(d=>{
				let date = moment(d.date),
					year = parseInt(date.format('YYYY')),
					month = parseInt(date.format('MM'))

				//ignore incomplete years
				if(year < 2018 && year > 2013){

					if(!(year in seasonal)) seasonal[year] = [0,0,0,0,0,0,0,0,0,0,0,0]
					
					seasonal[year][month-1] += d.c

				}

				if(!(d.date in outlier_real_access[type])) outlier_real_access[type][d.date] = 0
				outlier_real_access[type][d.date] += d.c
			})
		}
	}
})

let csv_seasonal = 'year,month,value'

for(let year in seasonal){
	let max = math.max(seasonal[year])
	seasonal[year].forEach((s,si)=>{
		csv_seasonal += `\n${year},${si},${s/max}`
	})
}

fs.writeFileSync(__dirname + '/output/charts/seasonal.csv', csv_seasonal, 'utf8')

let output = []

//for(let type in times){
	let type = 'pv'
	for(let date in times[type]){
		output.push({
			date:date,
			type:type,
			value:times[type][date]
		})
	}
	for(let date in accessible[type]){
	 	output.push({
	 		date:date,
	 		type:'a_'+type,
	 		value:accessible[type][date]
	 	})	
	}
	for(let date in real_access[type]){
		output.push({
			date:date,
			type:'ra_'+type,
			value:real_access[type][date]
		})	
	}
	for(let date in outlier_real_access[type]){
		output.push({
			date:date,
			type:'ora_'+type,
			value:outlier_real_access[type][date]
		})	
	}
//}

output.sort((a,b)=>new Date(b.date) - new Date(a.date))

let output_csv = 'date,type,value'

output.forEach(o=>{ output_csv += `\n${o.date},${o.type},${o.value}` })

fs.writeFileSync(__dirname + '/output/charts/all.csv', output_csv, 'utf8')

/*
Bot attacks
*/

let real_bots = {}

final.forEach(f=>{
	if(f.access == 200){
		f.pv.forEach(p=>{
			if(!(p.date in real_bots)) real_bots[p.date] = {req:0,count:0,reql:0,countl:0}
			if(p.c > 0){
				real_bots[p.date].req++
			}
			real_bots[p.date].count++

			//Only include files which were uploaded within the last four months
			let uploaded = moment(f.date_released), date = moment(p.date)
			//console.log(f.date_released, p.date, date.diff(uploaded, 'months'))
			if(date.diff(uploaded, 'months')<3){
				if(p.c > 0){
					real_bots[p.date].reql++
				}
				real_bots[p.date].countl++
			}

		})
	}
})

let real_bots_a = []

for(let date in real_bots){
	real_bots_a.push({
		date:date,
		type:'req',
		req:real_bots[date].req,
		count:real_bots[date].count
	})
	real_bots_a.push({
		date:date,
		type:'reql',
		req:real_bots[date].reql,
		count:real_bots[date].countl
	})
}

real_bots_a.sort((a,b)=>new Date(b.date) - new Date(a.date))

let csv_bot = 'date,type,value'

real_bots_a.forEach(r=>{ csv_bot += `\n${r.date},${r.type},${r.req/r.count}`; })

fs.writeFileSync(__dirname + '/output/charts/bots.csv', csv_bot, 'utf8')

/*
Data releases
*/

let releases = {}

final.forEach(f=>{
	if(f.access == 200){
		let date = moment(f.date_released).format('YYYY-MM-DD')
		if(moment(f.date_released).format('YYYY')>=2013){
			if(!(date in releases)) releases[date] = 0
			releases[date]++
		}
	}
})

let releases_a = [], releases_max = 0

for(let date in releases){
	releases_a.push({
		date:date,
		value:releases[date]
	})
	if(releases[date]>releases_max) releases_max = releases[date]
}

releases_a.sort((a,b)=>new Date(b.date) - new Date(a.date))

let csv_releases = 'date,value'

releases_a.forEach(r=>{ csv_releases += `\n${r.date},${r.value}`; })

fs.writeFileSync(__dirname + '/output/charts/releases.csv', csv_releases, 'utf8')

/*
Rate over time
*/

let overtime = []
final.forEach((f,fi)=>{
	let max = 0
	f.pv.forEach((p,pi)=>{ if(p.c > max && pi<24) max = p.c; })
	if(max>20){
		f.pv.forEach((p,pi)=>{
			if(pi<24){
				overtime.push({
					type:fi,
					x:pi,
					y:(p.c/max).toFixed(3)
				})
			}
		})
	}
})

let csv_time = 'date,value,type'

overtime.forEach(o=>{ csv_time += `\n${o.x},${o.y},${o.type}`; })

fs.writeFileSync(__dirname + '/output/charts/overtime.csv', csv_time, 'utf8')

/*
Histogram of average monthly downloads first 1 to 12 month after last update
*/

let histotime = []

final.forEach((f,fi)=>{
	if(f.access == 200){
		let item = {id:fi,time:[],alla:[],all:0,mean:0,median:0,max:0,min:0}

		f.pv.forEach(p=>{
			item.alla.push(p.c)
		})

		item.all = math.sum(item.alla)
		item.mean = (item.alla.length == 0)?0:math.mean(item.alla)
		item.max = (item.alla.length == 0)?0:math.max(item.alla)
		item.min = (item.alla.length == 0)?0:math.min(item.alla)
		item.median = (item.alla.length == 0)?0:math.median(item.alla)

		for(let diff = 1; diff<=12; diff++){
			let sum = []
			f.pv.forEach(p=>{
				let uploaded = moment(f.date_updated), date = moment(p.date), rDiff = date.diff(uploaded, 'days')
				if(rDiff >= (parseInt(uploaded.format('DD'))*-1 - 1) && rDiff<(365/12*(diff))){
					sum.push(p.c)
				}
			})
			if(sum.length-1 == diff){
				item.time[diff] = [math.mean(sum), math.median(sum)]
			}else{
				item.time[diff] = ['NaN','NaN']
			}
		}

		histotime.push(item)
	}
})

let csv_histotime = 'id,t1_mean,t1_median,t2_mean,t2_median,t3_mean,t3_median,t4_mean,t4_median,t5_mean,t5_median,t6_mean,t6_median,t7_mean,t7_median,t8_mean,t8_median,t9_mean,t9_median,t10_mean,t10_median,t11_mean,t11_median,t12_mean,t12_median',
	csv_histofull = 'all,mean,median'

histotime.forEach((h,hi)=>{
	let allNaN = true
	for(let i = 1; i<=12; i++){ if(h.time[i][0] != 'NaN' || h.time[i][1] != 'NaN'){ allNaN = false; }}

	if(!allNaN){
		csv_histotime += '\n'+h.id
		for(let i = 1; i<=12; i++){
			csv_histotime += ','+h.time[i][0]+','+h.time[i][1]
		}
	}

	csv_histofull += `\n${h.all},${h.mean},${h.median}`
})

fs.writeFileSync(__dirname + '/output/charts/histotime.csv', csv_histotime, 'utf8')
fs.writeFileSync(__dirname + '/output/charts/histofull.csv', csv_histofull, 'utf8')

/*
Top downloads
*/

let start_year = 2013,
	start_month = 4,
	end_year = 2018,
	end_month = 6

let top_level = 150

let groups = {
	'maintainer' : {}, 
	'license_title' : {},
	'author' : {},
	'group_name' : {}
}

let top10_all = [], top10_month = [], top10_grouped = []

let knngroups = JSON.parse(fs.readFileSync(__dirname + '/output/knn-template.json', 'utf8')),
	group_keys = {}

knngroups.forEach((g,gi)=>{
	g['sum'] = 0
	g['count'] = 0
	g.forEach(gg=>{
		group_keys[gg.label] = gi
	})
})

final.forEach(f=>{
	if(f.pv_sum > top_level){
		if(f.page in group_keys){
			knngroups[group_keys[f.page]].sum += f.pv_sum
			knngroups[group_keys[f.page]].count += f.pv.length
		}
		for(let g in groups){
			if(Array.isArray(f[g])){
				f[g].forEach(gg=>{
					if((gg.trim()).length>0){
						if(!(gg in groups[g])) groups[g][gg] = {}
						f.pv.forEach(p=>{
							let date = moment(p.date),
								year = parseInt(date.format('YYYY')),
								month = parseInt(date.format('MM'))

							if(!(year in groups[g][gg])) groups[g][gg][year] = {}
							if(!(month in groups[g][gg][year])) groups[g][gg][year][month] = 0

							groups[g][gg][year][month] += p.c
						})
					}
				})
			}else{
				if(f[g] != undefined && (f[g].trim()).length > 0){
					if(!(f[g] in groups[g])) groups[g][f[g]] = {}
					f.pv.forEach(p=>{
						let date = moment(p.date),
							year = parseInt(date.format('YYYY')),
							month = parseInt(date.format('MM'))

						if(!(year in groups[g][f[g]])) groups[g][f[g]][year] = {}
						if(!(month in groups[g][f[g]][year])) groups[g][f[g]][year][month] = 0

						groups[g][f[g]][year][month] += p.c
					})
				}
			}
		}
	}
})

for(let g in groups){
	for(let gg in groups[g]){
		for(let y = start_year; y<=end_year; y++){
			if(!(y in groups[g][gg])) groups[g][gg][y] = {}
			let m_end = (y==end_year)?end_month:12
			for(let m = (y==start_year)?start_month:1; m<=m_end; m++){
				if(!(m in groups[g][gg][y])) groups[g][gg][y][m] = 0
			}
		}
	}
}

let group_output = {}

for(let g in groups){
	if(!(g in group_output)) group_output[g] = {}

	let group_csv = 'date',
		sums = []

	for(let gg in groups[g]){

		sum = 0

		for(let year in groups[g][gg]){
			for(let month in groups[g][gg][year]){
				let date = `${year}-${((month<10)?'0':'')+month}-01`
				if(!(date in group_output[g]))group_output[g][date] = {}
				group_output[g][date][gg] = groups[g][gg][year][month]
				sum += groups[g][gg][year][month]
			}
		}

		sums.push({
			key:gg,
			sum:sum
		})
	}

	sums.sort((a,b)=>a.sum-b.sum)

	//group_output[g].sort((a,b)=>new Date(b.date) - new Date(a.date))
	sums.forEach(gg=>{
		group_csv += ',"' + gg.key + '"'
	})

	for (let date in group_output[g]){
		group_csv += `\n${date}`

		sums.forEach(gg=>{
			group_csv += ','

			if(!(gg.key in group_output[g][date])){
				group_csv += '0'
			}else{
				group_csv += group_output[g][date][gg.key]
			}

		})
	}

	fs.writeFileSync(__dirname + '/output/charts/group_'+g+'.csv', group_csv, 'utf8')
}

/*

Figure out who is being downloaded in the months 3/7/11

*/

let triggersets = {}, t_key = 'author'

final.forEach(f=>{
	if(f.access == 200){
		let normals = [], triggers = []
		f.pv.forEach(p=>{
			let month = parseInt(moment(p.date).format('MM'))
			if(month == 3 || month == 7 || month == 11){
				triggers.push(p.c)
			}else{
				normals.push(p.c)
			}
		})

		if(normals.length>0 && triggers.length>0){
			let normalmean = math.mean(normals),
				triggermean = math.mean(triggers)

			if(triggermean > normalmean*2){
				let val = 'na'
				if(t_key in f && f[t_key] != undefined){
					val = f[t_key].trim()
				}
				if(!(val in triggersets)) triggersets[val] = []
				triggersets[val].push(f.page)
			}
		}
	}
})

fs.writeFileSync(__dirname + '/output/charts/triggers.csv', JSON.stringify(triggersets), 'utf8')

/*

Top 10 and group output

*/

knngroups.sort((b,a)=>{
	return a.sum - b.sum
})

let top10csv = 'page,group,count'

for(let i = 0; i<10; i++){
	top10csv += `\n${knngroups[i][0].label},"${knngroups[i].map(d=>d.label).join(',')}",${knngroups[i].sum}`
}

fs.writeFileSync(__dirname + '/output/charts/top_group_abs.csv', top10csv, 'utf8')

knngroups = knngroups.filter(d=>(d.count>0)?true:false).sort((b,a)=>{
	return (a.sum/a.count) - (b.sum/b.count)
})

top10csv = 'page,group,count'

for(let i = 0; i<10; i++){
	top10csv += `\n${knngroups[i][0].label},"${knngroups[i].map(d=>d.label).join(',')}",${knngroups[i].sum/knngroups[i].count}`
}

fs.writeFileSync(__dirname + '/output/charts/top_group_month.csv', top10csv, 'utf8')

final.sort((b,a)=>{
	return a.pv_sum-b.pv_sum
})

top10csv = 'page,count'
for(let i = 0; i<10; i++){
	top10csv += `\n${final[i].page},${final[i].pv_sum}`
}

fs.writeFileSync(__dirname + '/output/charts/top_abs.csv', top10csv, 'utf8')

final.sort((b,a)=>{
	return (a.pv_sum/a.pv.length)-(b.pv_sum/b.pv.length)
})

top10csv = 'page,count'
for(let i = 0; i<10; i++){
	top10csv += `\n${final[i].page},${final[i].pv_sum/final[i].pv.length}`
}

fs.writeFileSync(__dirname + '/output/charts/top_month.csv', top10csv, 'utf8')