const ROUND_DURATION = 5
const NUMBER_OF_ROUNDS = 5
const COUNTDOWN_DURATION = 3
const VOLUME = 0.01

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

const getBeep = (duration) => {
    const audioStr = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'
                   + Array(duration).join('123')  
    const audio = new Audio(audioStr)            
    audio.volume = VOLUME
    return audio
}

const BEEP_SHORT = getBeep(1000)
const BEEP_LONG = getBeep(4000)

let session

const startSession = () => {
    if (!session || !session.isRunning) {
        setState(states.SESION_STARTED)
        BEEP_SHORT.play()

        session = new Session(
            NUMBER_OF_ROUNDS, 
            ROUND_DURATION, 
            COUNTDOWN_DURATION
        )
        session
            .run()
            .then(() => {
                setState(states.SESION_ENDED)        
                console.log(
                    'max:', session.maxHoldingTime, 
                    'avrg:', session.avrgHoldingTime
                )
            })
    }
}

const stopSession = () => {
    session.willBeStopped = true
}

const formatTime = (elapsedSec) => {
    let min = Math.floor(elapsedSec / 60)
    let sec = elapsedSec - min * 60
    return formatTimeValue(min) + ':' + formatTimeValue(sec)
}

const formatTimeValue = (value) => {
    return value < 10 ? '0' + value : value
}

const recordHoldTime = () => {
    session.currentRound.record()
}

const handlePressSpaceBtn = (e) => {
    if (e.keyCode === 32) {
        e.preventDefault()
        if (session && session.isRunning) {
            recordHoldTime()
        } else {
            startSession()
        }
    }
}

const handleClickOnStartBtn = () => {
    startSession()
}

const handleClickOnStopBtn = () => {
    stopSession()
}

const handleClickOnRecordBtn = () => {
    recordHoldTime()
}

const handleClickOnResetBtn = () => {
    reset()
}

class Session {
    numberOfRounds
    roundDuration
    countdownDuration
    willBeStopped = false
    isRunning = false
    currentRound 
    rounds = []
    constructor(numberOfRounds, roundDuration, countdownDuration) {
        this.numberOfRounds = numberOfRounds
        this.roundDuration = roundDuration
        this.countdownDuration = countdownDuration
    }
    async run() {
        this.isRunning = true
        for (let i = 1; i <= this.numberOfRounds; i++) {
            renderRoundIndicator(this.numberOfRounds, i)
            this.currentRound = new Round(
                i, this.roundDuration, this.countdownDuration)
            this.rounds.push(this.currentRound)
            if (await this.currentRound.run()) break
        }
        this.isRunning = false
    }

    get records() { return session.rounds.map((r) => r.recordSec) }
    get avrgHoldingTime() { 
        const total = this.records.reduce((p, c) => p + c, 0)
        return Math.round(total / this.records.length)
    }
    get maxHoldingTime() { 
        return Math.max(...this.records)
    }
}

class Round {
    number
    duration
    countdownDuration
    elapsedSec = 0
    recordSec
    constructor(number, duration, countdownDuration) {
        this.number = number
        this.duration = duration
        this.countdownDuration = countdownDuration
    }
    run() {
        return new Promise((resolve) => {
            const interval = 1000
            const start = Date.now()
            const end = start + this.duration * 1000
            let expected = start + interval

            setState(states.ROUND_STARTED)
            
            const step = () => {
                if (session.willBeStopped) {
                    this.record()
                    resolve(true)
                } else {
                    this.elapsedSec = Math.floor((Date.now() - start) / 1000)
                    renderTimeIndicator(this.elapsedSec)
                    this.beepCountdown()
        
                    if (Date.now() >= end) {
                        this.record()
                        resolve(false)
                    } else {
                        const drift = Date.now() - expected;
                        if (drift > interval) {
                            console.error('Timer is not working poperly!')
                        }
                        expected += interval
                        setTimeout(step, Math.max(0, interval - drift))
                    }
                }
            }
            setTimeout(step, interval)
        })
    }
    record() {
        if (this.recordSec == null) {
            this.recordSec = this.elapsedSec
            setState(states.ROUND_RECORDED)
            BEEP_SHORT.play()
            renderSessionResults(this.number, this.recordSec)
        }
    }
    beepCountdown() {
        const timeLeft = this.duration - this.elapsedSec
        if (timeLeft === 0) {
            BEEP_LONG.play() 
        } else if (timeLeft > 0 && timeLeft < this.countdownDuration) {
            BEEP_SHORT.play()
        }
    }
}

const renderTimeIndicator = (elapsedSec = 0) => {
    const timeLeftSec = ROUND_DURATION === elapsedSec 
        ? ROUND_DURATION
        : ROUND_DURATION - elapsedSec
    dom.timeIndicator.textContent = formatTime(timeLeftSec)
}

const renderRoundIndicator = (numberOfRounds = NUMBER_OF_ROUNDS, currentRoundNumber = '-') => {
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
    btn.removeEventListener('click', handleClickOnResetBtn)
    btn.addEventListener('click', handleClickOnStopBtn)
    btn.textContent = 'stop'
    btn.disabled = isDisabled
}

const renderResetBtn = () => {
    const btn = dom.stopBtn
    btn.removeEventListener('click', handleClickOnStopBtn)
    btn.addEventListener('click', handleClickOnResetBtn)
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

const reset = () => {
    setState(states.INITIAL)
}

const init = () => {
    reset()
    window.addEventListener('keyup', handlePressSpaceBtn)
}

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
