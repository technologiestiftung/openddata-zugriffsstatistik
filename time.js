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

await client.connect()


const parse = require('csv-parse/lib/sync')


const res = await client.query('SELECT $1::text as message', ['Hello world!'])
console.log(res.rows[0].message) // Hello world!
await client.end()