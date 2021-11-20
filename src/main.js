const ROUND_DURATION = 5
const NUMBER_OF_ROUNDS = 5
const COUNTDOWN_DURATION = 3
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
            BEEP_LONG.play() 
        } else if (timeLeft > 0 && timeLeft < this.countdownDuration) {
            BEEP_SHORT.play()
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
        this.numberOfRounds = numberOfRounds
        this.roundDuration = roundDuration
        this.countdownDuration = countdownDuration
    }
    async start() {
        if (this.isRunning) return
        
        this.#onStart()

        for (let i = 1; i <= this.numberOfRounds; i++) {  
            this.#currentRoundNumber = i
            this.#isCurrentRoundRecorded = false

            this.#currentRound = new Timer(
                this.roundDuration,
                renderTimeIndicator, 
                this.countdownDuration
            )

            renderRoundIndicator(this.numberOfRounds, i)
            setState(states.ROUND_STARTED)

            const isInterrupted = await this.#currentRound.start()
            this.record(i)
            if (isInterrupted) break
        }
        this.#onStop()
    }
    stop() { this.#currentRound.stop() }
    record() {
        if (this.#isCurrentRoundRecorded) return
        setState(states.ROUND_RECORDED)
        this.#isCurrentRoundRecorded = true
        BEEP_SHORT.play()
        this.#records.push(this.#currentRound.elapsed)
        renderSessionResults(
            this.#currentRoundNumber, 
            this.#currentRound.elapsed
        )
    }
    #onStart() {
        setState(states.SESION_STARTED)
        BEEP_SHORT.play()
        this.isRunning = true
        this.#records = []
    }
    #onStop() {
        this.isRunning = false
        setState(states.SESION_ENDED)        
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

class DomRegistry {
    get startBtn() { return this.getElement('.start-record-btn') }
    get stopBtn() { return this.getElement('.stop-reset-btn') }
    get timeIndicator() { return this.getElement('.time-indicator') }
    get roundIndicator() { return this.getElement('.round-indicator') }
    get sessionResultsLeft() { return this.getElement('.session-results-left') }
    get sessionResultsRight() { return this.getElement('.session-results-right') }
    get roundRecordTemplate() { return this.getElement('#round-record') }
    roundNumber(el) { return this.getElement('.round-number', el) }
    roundResult(el) { return this.getElement('.round-result', el) } 
    getElement(selector, parent) {
        return (parent || document).querySelector(selector)
    }
}

const dom = new DomRegistry()

const session = new Session(
    NUMBER_OF_ROUNDS, 
    ROUND_DURATION, 
    COUNTDOWN_DURATION
)

const createEnum = (values) => {
    return Object.freeze(
        values.reduce((obj, val) => 
            ({ ...obj, [val]:val }), {})
    )
}

const states = createEnum([
    'INITIAL', 
    'SESION_STARTED',
    'ROUND_STARTED',
    'ROUND_RECORDED',
    'SESION_ENDED'
])

const setState = (state) => {
    switch (state) {
        case states.INITIAL:
            renderRoundIndicator()
            renderTimeIndicator()
            renderSessionResults()
            renderStartBtn()
            renderStopBtn(true)
            break
        case states.SESION_STARTED:
            renderSessionResults()
            renderRecordBtn()
            renderStopBtn()
            break
        case states.ROUND_STARTED:
            renderTimeIndicator()
            renderRecordBtn()
            break            
        case states.ROUND_RECORDED:
            renderRecordBtn(true)
            break
        case states.SESION_ENDED:
            renderStartBtn()
            renderResetBtn()
    }
}

const getBeep = (duration) => {
    const audioStr = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'
                   + Array(duration).join('123')  
    const audio = new Audio(audioStr)            
    audio.volume = VOLUME
    return audio
}

const BEEP_SHORT = getBeep(1000)
const BEEP_LONG = getBeep(4000)

const formatTime = (elapsedSec) => {
    let min = Math.floor(elapsedSec / 60)
    let sec = elapsedSec - min * 60
    return formatTimeValue(min) + ':' + formatTimeValue(sec)
}

const formatTimeValue = (val) => val < 10 ? '0' + val : val

const handlePressSpaceBtn = (e) => {
    if (e.keyCode === 32) {
        e.preventDefault()
        if (session && session.isRunning) {
            session.record()
        } else {
            session.start()
        }
    }
}

const handleClickOnStartBtn = () => session.start()
const handleClickOnStopBtn = () => session.stop()
const handleClickOnRecordBtn = () => session.record()

const renderTimeIndicator = (elapsedSec = 0) => {
    const timeLeftSec = ROUND_DURATION === elapsedSec 
        ? ROUND_DURATION
        : ROUND_DURATION - elapsedSec
    dom.timeIndicator.textContent = formatTime(timeLeftSec)
}

const renderRoundIndicator = (
    numberOfRounds = NUMBER_OF_ROUNDS, 
    currentRoundNumber = '-'
) => {
    dom.roundIndicator.textContent = currentRoundNumber + '/' + numberOfRounds
}

const renderSessionResults = (roundNumber, recordSec) => {
    if (!roundNumber && !recordSec) {
        dom.sessionResultsLeft.innerHTML = '' 
        dom.sessionResultsRight.innerHTML = ''
        return
    }
    renderRoundRecord(roundNumber, recordSec)
}

const renderStartBtn = () => {
    const btn = dom.startBtn
    btn.removeEventListener('click', handleClickOnRecordBtn)
    btn.addEventListener('click', handleClickOnStartBtn)
    btn.textContent = 'start'
    btn.disabled = false
}

const renderRecordBtn = (isDisabled) => {
    const btn = dom.startBtn
    btn.removeEventListener('click', handleClickOnStartBtn)
    btn.addEventListener('click', handleClickOnRecordBtn)
    btn.textContent = 'record'
    btn.disabled = isDisabled
}

const renderStopBtn = (isDisabled) => {
    const btn = dom.stopBtn
    btn.removeEventListener('click', reset)
    btn.addEventListener('click', handleClickOnStopBtn)
    btn.textContent = 'stop'
    btn.disabled = isDisabled
}

const renderResetBtn = () => {
    const btn = dom.stopBtn
    btn.removeEventListener('click', handleClickOnStopBtn)
    btn.addEventListener('click', reset)
    btn.textContent = 'reset'
}

const renderRoundRecord = (roundNumber, recordSec) => {
    const clone = dom.roundRecordTemplate.content.cloneNode(true)
    dom.roundNumber(clone).textContent = roundNumber + '.'
    dom.roundResult(clone).textContent = formatTime(recordSec)
    roundNumber <= Math.ceil(NUMBER_OF_ROUNDS / 2)
        ? dom.sessionResultsLeft.appendChild(clone)
        : dom.sessionResultsRight.appendChild(clone)
}

const reset = () => setState(states.INITIAL)

const init = () => {
    reset()
    window.addEventListener('keyup', handlePressSpaceBtn)
}
