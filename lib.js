const EventEmitter = require('events')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const puppeteer = require('puppeteer')

async function resolveLink (link) {
  const response = await axios.get(link.href, { maxRedirects: 0, validateStatus: null })

  const href = (response.status >= 300 && response.status < 400)
    ? response.headers.location
    : response.headers.link?.split(';')?.shift()?.slice(1, -1)

  try {
    const url = new URL(href)
    url.search = ''

    return url.href
  } catch {
    return ''
  }
}

async function getTrack (track) {
  const [
    artistName,
    trackName,
    download,
    downloadExtra
  ] = await Promise.all([
    track.$eval('a.artist', element => element.textContent.trim() || '❓'),
    track.$eval('a.track', element => element.textContent.trim()),
    track.$eval('span.download > a', element => ({ label: element.textContent, href: element.href })).catch(() => null),
    track.$eval('span.download-extra > a', element => ({ label: element.textContent, href: element.href })).catch(() => null)
  ])

  await Promise.all([
    (async () => {
      if (download?.href) {
        download.href = await resolveLink(download)
      }
    })(),

    (async () => {
      if (downloadExtra?.href) {
        downloadExtra.href = await resolveLink(downloadExtra)
      }
    })()
  ])

  return { artistName, trackName, download, downloadExtra }
}

class Radio extends EventEmitter {
  #browser = null
  #page = null
  #currentTrack = null
  #previousTrack = null
  #nextTrack = null
  #logFile = fs.createWriteStream(path.join(__dirname, 'debug.log'))
  #tracks = []
  #muted = false

  log (message) {
    this.#logFile.write(message + '\n')
  }

  async toggleSound () {
    this.#muted = await this.#page.$eval('#player-volume-mute', element => {
      return element.classList.contains('icon-speaker-mute')
    })

    await this.#page.click('#player-volume-mute')
    this.#muted = !this.#muted
    this.printTracks()
  }

  async start () {
    this.printInfo()

    this.#browser = await puppeteer.launch({
      defaultViewport: null,
      headless: process.env.NODE_ENV !== 'development',
      protocolTimeout: 0,
      ignoreDefaultArgs: [
        '--mute-audio'
      ]
    })

    this.#page = (await this.#browser.pages())[0]

    await Promise.all([
      this.#page.waitForNetworkIdle(),
      this.#page.goto('https://hypem.com/latest')
    ])

    await this.play()
  }

  printInfo () {
    process.stdout.cursorTo(0, 0)
    process.stdout.clearScreenDown()
    process.stdout.write('\x1b[1;35mHype Radio\x1b[0m\n\n\x1b[1mCommands:\n\x1b[0m  m - (un)mute\n  q - quit\n')
  }

  printTracks () {
    process.stdout.cursorTo(0, 6)
    process.stdout.clearScreenDown()

    const message = [
      this.#currentTrack
        ? `\x1b[1;32mNow playing:\x1b[0m "${this.#currentTrack.trackName}" by ${this.#currentTrack.artistName}\x1b[0m \x1b[5m${this.#muted ? '🔇' : '🔊'}\x1b[0m`
        : '\x1b[1;36mWaiting for next track...\x1b[0m',
      this.#currentTrack?.download?.href &&
        `${this.#currentTrack?.download.label}: ${this.#currentTrack?.download.href}`,
      this.#currentTrack?.downloadExtra?.href &&
        `${this.#currentTrack?.downloadExtra.label}: ${this.#currentTrack?.downloadExtra.href}`,

      this.#previousTrack && `\n\x1b[33mPreviously:\x1b[0m "${this.#previousTrack.trackName}" by ${this.#previousTrack.artistName}`,
      this.#previousTrack?.download?.href &&
      `${this.#previousTrack?.download.label}: ${this.#previousTrack?.download.href}`,
      this.#previousTrack?.downloadExtra?.href &&
      `${this.#previousTrack?.downloadExtra.label}: ${this.#previousTrack?.downloadExtra.href}`,

      this.#nextTrack && `\n\x1b[36mNext up:\x1b[0m "${this.#nextTrack.trackName}" by ${this.#nextTrack.artistName}`
    ].filter(Boolean).join('\n') + '\n'

    process.stdout.write(message)
  }

  async getTracks () {
    const trackPromises = (await this.#page.$$('div.section.section-track')).map(async trackElement => {
      try {
        const trackInfo = await getTrack(trackElement)

        return { ...trackInfo, trackElement }
      } catch (error) {
        // this.emit('error', error)
      }
    })

    this.#tracks = (await Promise.all(trackPromises)).filter(Boolean).reverse()
  }

  getCurrentAndNextTracks () {
    const index = this.#tracks.findIndex(track => {
      return (
        track.artistName === this.#previousTrack.artistName &&
        track.trackName === this.#previousTrack.trackName
      )
    })

    this.#currentTrack = this.#tracks[index + 1] ?? null
    this.#nextTrack = this.#tracks[index + 2] ?? null
  }

  async play () {
    this.#previousTrack = this.#currentTrack ?? this.#previousTrack ?? null

    if (this.#previousTrack) {
      this.getCurrentAndNextTracks()

      if (!this.#currentTrack) {
        try {
          await this.#page.$eval('#track-notification', element => element.click())
          await this.#page.waitForNetworkIdle()
          this.log('Found new tracks')
          await this.getTracks()
          this.getCurrentAndNextTracks()
        } catch {}
      }
    } else {
      await this.getTracks()
      this.#currentTrack = this.#tracks[0] ?? null
      this.#nextTrack = this.#tracks[1] ?? null
    }

    this.printTracks()

    if (!this.#currentTrack) {
      this.log('Ran out of tracks')
      await this.#page?.waitForSelector('#track-notification', { timeout: 0 })
      await this.play()
      return
    }

    try {
      const { artistName, trackName } = this.#currentTrack
      this.log(`Playing "${trackName}" by ${artistName}`)
      await this.#currentTrack.trackElement.$eval('.play-ctrl', element => element.click())
      await this.#currentTrack.trackElement.waitForSelector('.play-ctrl.play', { timeout: 0 })
      this.log('Track done')
      await this.#page.click('a#playerPlay')
      await this.play()
    } catch (error) {
      this.emit('error', error)
    }
  }

  async stop () {
    await this.#browser?.close()
  }
}

module.exports = Radio
