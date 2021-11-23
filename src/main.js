const ROUND_DURATION = 5
const NUMBER_OF_ROUNDS = 5
const COUNTDOWN_DURATION = 0
const VOLUME = 0.01

class Timer {
    constructor(duration, onInterval, countdownDuration, interval) {
        this.duration = duration
        this.interval = interval || 1000 
        this.countdownDuration = countdownDuration || 0
        this.onInterval = onInterval
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
            sound.beepLong.play() 
        } else if (timeLeft > 0 && timeLeft < this.countdownDuration) {
            sound.beepShort.play()
        }
    }
}

class Session {
    isRunning = false
    #records
    #currentRound
    #currentRoundNumber
    #isCurrentRoundRecorded
    constructor(numberOfRounds, roundDuration, countdownDuration) {
        this.numberOfRounds = numberOfRounds || NUMBER_OF_ROUNDS
        this.roundDuration = roundDuration || ROUND_DURATION
        this.countdownDuration = countdownDuration || COUNTDOWN_DURATION
    }

    async start() {
        if (this.isRunning) return
        
        this.#onStart()

        for (let i = 1; i <= this.numberOfRounds; i++) {  
            this.#currentRoundNumber = i
            this.#isCurrentRoundRecorded = false

            this.#currentRound = new Timer(
                this.roundDuration,
                ui.renderTimeIndicator, 
                this.countdownDuration
            )

            state.setRoundStarted(this.numberOfRounds, i)

            const isInterrupted = await this.#currentRound.start()
            this.record(i)
            if (isInterrupted) break
        }
        this.#onStop()
    }
    stop() { this.#currentRound.stop() }
    record() {
        if (this.#isCurrentRoundRecorded) return
        state.setRoundRecorded(
            this.#currentRoundNumber, 
            this.#currentRound.elapsed
        )
        this.#isCurrentRoundRecorded = true
        sound.beepShort.play()
        this.#records.push(this.#currentRound.elapsed)
    }
    #onStart() {
        state.setSesionStarted()
        sound.beepShort.play()
        this.isRunning = true
        this.#records = []
    }
    #onStop() {
        this.isRunning = false
        state.setSessionEnded()       
        console.log(
            'max:', this.maxHoldingTime, 
            'avrg:', this.avrgHoldingTime
        )
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
    renderTimeIndicator = (elapsedSec = 0) => {
        const timeLeftSec = session.roundDuration === elapsedSec 
            ? session.roundDuration
            : session.roundDuration - elapsedSec
        this.#getTimeIndicator().textContent = this.#formatTime(timeLeftSec)
    }
    
    renderRoundIndicator = (currentRoundNumber = '-') => {
        this.#getRoundIndicator().textContent = 
            currentRoundNumber + '/' + session.numberOfRounds
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
        roundNumber <= Math.ceil(session.numberOfRounds / 2)
            ? this.#getSessionResultsLeft().appendChild(clone)
            : this.#getSessionResultsRight().appendChild(clone)
    }
    
    #handlePressSpaceBtn = (e) => {
        if (e.keyCode === 32) {
            e.preventDefault()
            session.isRunning ? session.record() : session.start()
        }
    }
    
    #handleClickOnStartBtn = () => session.start()
    #handleClickOnStopBtn = () => session.stop()
    #handleClickOnRecordBtn = () => session.record()
    #reset = () => state.setInitial()
    
    init = () => {
        this.#reset()
        window.addEventListener('keyup', this.#handlePressSpaceBtn)
    }

    #getStartBtn() { return this.#getElement('.start-record-btn') }
    #getStopBtn() { return this.#getElement('.stop-reset-btn') }
    #getTimeIndicator() { return this.#getElement('.time-indicator') }
    #getRoundIndicator() { return this.#getElement('.round-indicator') }
    #getSessionResultsLeft() { return this.#getElement('.session-results-left') }
    #getSessionResultsRight() { return this.#getElement('.session-results-right') }
    #getRoundRecordTemplate() { return this.#getElement('#round-record') }
    #getRoundNumber(el) { return this.#getElement('.round-number', el) }
    #getRoundResult(el) { return this.#getElement('.round-result', el) }

    #getElement(selector, parent) {
        return (parent || document).querySelector(selector)
    }

    #formatTime = (elapsedSec) => {
        let min = Math.floor(elapsedSec / 60)
        let sec = elapsedSec - min * 60
        return this.#formatTimeValue(min) + ':' + this.#formatTimeValue(sec)
    }
    
    #formatTimeValue = (val) => val < 10 ? '0' + val : val
}

class StateManager {
    #states = this.#createEnum([
        'INITIAL', 
        'SESION_STARTED',
        'ROUND_STARTED',
        'ROUND_RECORDED',
        'SESION_ENDED'
    ])

    setInitial() { this.#setState(this.#states.INITIAL) }

    setSesionStarted() { this.#setState(this.#states.SESION_STARTED) }

    setRoundStarted(numberOfRounds, roundNumber) { 
        this.#setState(
            this.#states.ROUND_STARTED,
            [ numberOfRounds, roundNumber ]
        )
    }

    setRoundRecorded(roundNumber, elapsed) { 
        this.#setState(
            this.#states.ROUND_RECORDED,
            [ roundNumber, elapsed ]
        ) 
    }

    setSessionEnded() { this.#setState(this.#states.SESION_ENDED) }
    
    #setState(state, params) {
        switch (state) {
            case this.#states.INITIAL:
                ui.renderRoundIndicator()
                ui.renderTimeIndicator()
                ui.renderSessionResults()
                ui.renderStartBtn()
                ui.renderStopBtn(true)
                break
            case this.#states.SESION_STARTED:
                ui.renderSessionResults()
                ui.renderRecordBtn()
                ui.renderStopBtn()
                break
            case this.#states.ROUND_STARTED:
                ui.renderRoundIndicator(...params)
                ui.renderTimeIndicator()
                ui.renderRecordBtn()
                break            
            case this.#states.ROUND_RECORDED:
                ui.renderRecordBtn(true)
                ui.renderSessionResults(...params)
                break
            case this.#states.SESION_ENDED:
                ui.renderStartBtn()
                ui.renderResetBtn()
        }
    }

    #createEnum(values) {
        return Object.freeze(
            values.reduce((obj, val) => 
                ({ ...obj, [val]:val }), {})
        )
    }
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

const session = new Session()
const state = new StateManager()
const sound = new Sound()
const ui = new UI()

ui.init()
