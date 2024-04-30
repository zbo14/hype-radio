#!/usr/bin/env node

const Radio = require('./lib')

const radio = new Radio()

radio.on('error', error => {
  radio.log(error.message)
})

radio.start().catch(error => {
  console.error(error)
  process.exit(1)
})

process.on('SIGINT', async () => {
  await radio.stop()
  process.exit(0)
})
