# Hype Radio

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://standardjs.com/)

A command-line radio application that plays the newest songs featured on [Hype Machine](https://hypem.com).

## Motivation

Hype Machine allows you to stream songs in your browser. However, playback goes from newest songs to oldest. Furthermore, you have to refresh/interact with the page to fetch new tracks.

Hype Radio provides a hands-off listening experience that plays the newest tracks for you.

## How it works

Hype Radio runs headless browser automation that does the following:
* Navigates to https://hypem.com/latest
* Starts playing the oldest track from the latest page
* Plays the next oldest track, rinse and repeat
* Displays track information (i.e. artist name, track name, streaming links) in terminal
* If it runs out of tracks, it checks for new tracks and plays them
* If there aren't new tracks, it waits for them to show up

## Installation

```shell
pnpm add -g hype-radio
```

## Usage

```shell
hype-radio
```

**Commands:**
* `m` - (un)mute
* `q` - quit