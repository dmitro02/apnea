const ROUND_DURATION = 6
const NUMBER_OF_ROUNDS = 5
const COUNTDOWN_DURATION = 3
const VOLUME = 0.01

class Timer {
    constructor(config) {
        const { 
            duration, 
            onInterval, 
            countdownDuration = 0, 
            interval = 1000,
            playShortBeep,
            playLongBeep,
         } = config

        this.duration = duration
        this.interval = interval
        this.countdownDuration = countdownDuration
        this.onInterval = onInterval
        this.playShortBeep = playShortBeep
        this.playLongBeep = playLongBeep
        this.elapsed = 0
    }
    #isInterrupted = false
    stop() { this.#isInterrupted = true }
    start() {
        return new Promise((resolve) => {
            const start = Date.now()
            const end = start + this.duration * 1000
            let expected = start + this.interval
            
            const step = () => {
                if (this.#isInterrupted) {
                    resolve(true)
                } else {
                    this.elapsed = Math.floor((Date.now() - start) / 1000)
                    this.onInterval && this.onInterval(this.elapsed)
                    this.#beepCountdown()
        
                    if (Date.now() >= end) {
                        resolve(false)
                    } else {
                        const drift = Date.now() - expected
                        if (drift > this.interval) {
                            console.error('timer error')
                        }
                        expected += this.interval
                        setTimeout(step, Math.max(0, this.interval - drift))
                    }
                }
            }
            setTimeout(step, this.interval)
        })
    }
    #beepCountdown() {
        const timeLeft = this.duration - this.elapsed
        if (timeLeft === 0) {
            this.playLongBeep && this.playLongBeep() 
        } else if (timeLeft > 0 && timeLeft < this.countdownDuration) {
            this.playShortBeep && this.playShortBeep()
        }
    }
}

class App {
    #isRunning = false
    #records
    #currentRound
    #currentRoundNumber
    #isCurrentRoundRecorded
    sound = new Sound()

    constructor(numberOfRounds, roundDuration, countdownDuration) {
        this.numberOfRounds = numberOfRounds || NUMBER_OF_ROUNDS
        this.roundDuration = roundDuration || ROUND_DURATION
        this.countdownDuration = countdownDuration || COUNTDOWN_DURATION
        this.ui = new UI(this)
    }

    async start() {
        if (this.#isRunning) return
        
        this.#isRunning = true

        this.sound.beepShort.play()
        this.#records = []

        const timerConfig = {
            duration: this.roundDuration, 
            onInterval: this.ui.renderTimeIndicator, 
            countdownDuration: this.countdownDuration, 
            playShortBeep: () => this.sound.beepShort.play(),
            playLongBeep: () => this.sound.beepLong.play(),
        }

        for (let i = 1; i <= this.numberOfRounds; i++) {  
            this.#currentRoundNumber = i
            this.#isCurrentRoundRecorded = false
            this.#currentRound = new Timer(timerConfig)

            this.ui.onRoundStarted(i)

            const isInterrupted = await this.#currentRound.start()
            this.record(i)
            if (isInterrupted) break
        }

        this.#isRunning = false

        this.ui.onSessionEnded(
            this.maxHoldingTime, 
            this.avrgHoldingTime
        ) 
    }

    stop() { this.#currentRound.stop() }

    record() {
        if (this.#isCurrentRoundRecorded) return
        this.ui.onRoundRecorded(
            this.#currentRoundNumber, 
            this.#currentRound.elapsed
        )
        this.#isCurrentRoundRecorded = true
        this.sound.beepShort.play()
        this.#records.push(this.#currentRound.elapsed)
    }

    onPressSpaceBar() {
        this.#isRunning ? this.record() : this.start()
    }

    get avrgHoldingTime() { 
        const total = this.#records.reduce((p, c) => p + c, 0)
        return Math.round(total / this.#records.length)
    }

    get maxHoldingTime() { 
        return Math.max(...this.#records)
    }
}

class UI {
    constructor(app) {
        this.app = app
    }

    renderTimeIndicator = (elapsedSec = 0) => {
        const timeLeftSec = ROUND_DURATION === elapsedSec 
            ? ROUND_DURATION
            : ROUND_DURATION - elapsedSec
        this.#getTimeIndicator().textContent = this.#formatTime(timeLeftSec)
    }
    
    renderRoundIndicator = (currentRoundNumber = '-') => {
        this.#getRoundIndicator().textContent = 
            currentRoundNumber + '/' + NUMBER_OF_ROUNDS
    }
    
    renderSessionResults = (roundNumber, recordSec) => {
        if (!roundNumber && !recordSec) {
            this.#getSessionResultsLeft().innerHTML = '' 
            this.#getSessionResultsRight().innerHTML = ''
            return
        }
        this.renderRoundRecord(roundNumber, recordSec)
    }
    
    renderStartBtn = () => {
        const btn = this.#getStartBtn()
        btn.removeEventListener('click', this.#handleClickOnRecordBtn)
        btn.addEventListener('click', this.#handleClickOnStartBtn)
        btn.textContent = 'start'
        btn.disabled = false
    }
    
    renderRecordBtn = (isDisabled) => {
        const btn = this.#getStartBtn()
        btn.removeEventListener('click', this.#handleClickOnStartBtn)
        btn.addEventListener('click', this.#handleClickOnRecordBtn)
        btn.textContent = 'record'
        btn.disabled = isDisabled
    }
    
    renderStopBtn = (isDisabled) => {
        const btn = this.#getStopBtn()
        btn.removeEventListener('click', this.#reset)
        btn.addEventListener('click', this.#handleClickOnStopBtn)
        btn.textContent = 'stop'
        btn.disabled = isDisabled
    }
    
    renderResetBtn = () => {
        const btn = this.#getStopBtn()
        btn.removeEventListener('click', this.#handleClickOnStopBtn)
        btn.addEventListener('click', this.#reset)
        btn.textContent = 'reset'
    }
    
    renderRoundRecord = (roundNumber, recordSec) => {
        const clone = this.#getRoundRecordTemplate().content.cloneNode(true)
        this.#getRoundNumber(clone).textContent = roundNumber + '.'
        this.#getRoundResult(clone).textContent = this.#formatTime(recordSec)
        roundNumber <= Math.ceil(NUMBER_OF_ROUNDS / 2)
            ? this.#getSessionResultsLeft().appendChild(clone)
            : this.#getSessionResultsRight().appendChild(clone)
    }

    renderSessionResult = (max, avrg) => {
        if (!max || !avrg) {
            this.#getSessionResult().style.display = 'none'
        } else {
            this.#getSessionResult().style.display = 'block'
            this.#getSessionResultMax().innerText = this.#formatTime(max)
            this.#getSessionResultAvrg().innerText =  this.#formatTime(avrg)
        }
    }
    
    onRoundStarted = (numberOfRounds, roundNumber) => {
        this.renderRoundIndicator(numberOfRounds, roundNumber)
        this.renderTimeIndicator()
        this.renderRecordBtn()
    }

    onRoundRecorded = (roundNumber, elapsed) => {
        this.renderSessionResults(roundNumber, elapsed)
    }

    onSessionEnded = (max, avrg) => {
        this.renderStartBtn()
        this.renderResetBtn()
        this.renderSessionResult(max, avrg)
    }

    #handlePressSpaceBtn = (e) => {
        if (e.keyCode === 32) {
            e.preventDefault()
            this.app.onPressSpaceBar()
        }
    }
    
    #handleClickOnStartBtn = () => { 
        this.renderSessionResults()
        this.renderSessionResult()
        this.renderRecordBtn()
        this.renderStopBtn()
        this.app.start()
    }

    #handleClickOnStopBtn = () => this.app.stop()
    #handleClickOnRecordBtn = () => {
        this.renderRecordBtn(true)
        this.app.record() 
    }
    #reset = () => {
        this.renderRoundIndicator()
        this.renderTimeIndicator()
        this.renderSessionResults()
        this.renderSessionResult()
        this.renderStartBtn()
        this.renderStopBtn(true)
    }
    
    init = () => {
        this.#reset()
        window.addEventListener('keyup', this.#handlePressSpaceBtn)
    }

    #getStartBtn = () => this.#getElement('.start-record-btn')
    #getStopBtn = () => this.#getElement('.stop-reset-btn')
    #getTimeIndicator = () => this.#getElement('.time-indicator')
    #getRoundIndicator = () => this.#getElement('.round-indicator')
    #getSessionResultsLeft = () => this.#getElement('.session-records-left')
    #getSessionResultsRight = () => this.#getElement('.session-records-right')
    #getSessionResult = () => this.#getElement('.session-result')
    #getSessionResultMax = () => this.#getElement('.session-result-max-value')
    #getSessionResultAvrg = () => this.#getElement('.session-result-avrg-value')
    #getRoundRecordTemplate = () => this.#getElement('#round-record')
    #getRoundNumber = (el) => this.#getElement('.round-number', el)
    #getRoundResult = (el) => this.#getElement('.round-result', el)

    #getElement = (selector, parent) => {
        return (parent || document).querySelector(selector)
    }

    #formatTime = (elapsedSec) => {
        let min = Math.floor(elapsedSec / 60)
        let sec = elapsedSec - min * 60
        return this.#formatTimeValue(min) + ':' + this.#formatTimeValue(sec)
    }
    
    #formatTimeValue = (val) => val < 10 ? '0' + val : val
} 

class Sound {
    #sounds = []

    constructor(volume) {
        this.defaultVolume = volume || VOLUME

        this.beepShort = this.#getBeep(1000)
        this.beepLong = this.#getBeep(4000)
    }

    #getBeep = (duration) => {
        const audioStr = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'
                       + Array(duration).join('123')  
        const audio = new Audio(audioStr) 
        audio.volume = this.defaultVolume
        this.#sounds.push(audio)
        return audio
    }

    setVolume(volume) {
        this.#sounds.forEach((s) => s.volume = volume)
    }
}

new App().ui.init()
