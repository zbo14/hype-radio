#!/usr/bin/env node

const readline = require('readline')
const Radio = require('./lib')

const radio = new Radio()

radio.on('error', error => {
  radio.log(error.message)
})

radio.start().catch(error => {
  console.error(error)
  process.exit(1)
})

readline.emitKeypressEvents(process.stdin)

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
}

async function quit () {
  await radio.stop()
  process.exit(0)
}

process.stdin.on('keypress', async (chunk, key) => {
  switch (key?.name) {
    case 'm': {
      await radio.toggleSound()
      break
    }

    case 'c': {
      if (key.ctrl) {
        await quit()
      }

      break
    }

    case 'q': {
      await quit()
    }
  }
})
