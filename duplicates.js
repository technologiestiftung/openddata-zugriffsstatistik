const csvOpti = require('csv-string-optimization')
 


/*----- LOAD DATA -----*/
csvOpti.dsv(__dirname + '/data/daten_berlin_de.page_stats.datensaetze.csv', ',')
    .then(data => {
 
        data.forEach(d=>{
            d.page = decodeURI(d.page)
        })

        let column_name = 'page',
            column = csvOpti.extractColumn(data, column_name)

        /*----- FINGERPRINTING -----*/
 
        let fp_template = csvOpti.createTemplate(
                csvOpti.fingerprint.readableCluster(
                    csvOpti.fingerprint.cluster(
                        csvOpti.fingerprint.analyse(
                            column
                        )
                    )
                )
            )
 
        csvOpti.save(__dirname + '/output/fp-template.json', fp_template)
 
        /*----- CLEAN FILE WITH TEMPLATE -----*/
        csvOpti.saveCsv(__dirname + '/output/fp-cleaned.csv', csvOpti.cleanFile(data, JSON.parse(fp_template), column_name))
 
 
        /*----- KNN -----*/
 
        let reduced_column = csvOpti.knn.reduce(column),
            clusters = csvOpti.knn.prepare(reduced_column)
 
        let knn_template = csvOpti.createTemplate(
                csvOpti.knn.readableCluster(
                    csvOpti.knn.cluster(
                        csvOpti.knn.analyse(
                            clusters, reduced_column, 0.1
                        )
                    ), 
                    reduced_column, column
                )
            )
 
        csvOpti.save(__dirname + '/output/knn-template.json', knn_template)
 
        /*----- CLEAN FILE WITH TEMPLATE -----*/
        csvOpti.saveCsv(__dirname + '/output/knn-cleaned.csv', csvOpti.cleanFile(data, JSON.parse(knn_template), column_name))
 
    }).catch(err => {
        console.log('err', err)
    })