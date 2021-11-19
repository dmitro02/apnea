const ROUND_DURATION = 2
const NUMBER_OF_ROUNDS = 7
const COUNTDOWN_DURATION = 3
const VOLUME = 0.01

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
                console.log(JSON.stringify(getSessionStats()));
            })
    }
}

const stopSession = () => {
    session.willBeStopped = true
}

const getSessionStats = () => {
    const records = session.rounds.map((r) => r.recordSec )
    const totalHold = records.reduce((p, c) => p + c, 0)
    const maxHold = Math.max(...records)
    const avrgHold = Math.round(totalHold / records.length)
    return { maxHold, avrgHold }
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
    get duration() { return 0 }
    get totalHoldingTime() { return 0 }
    get maxHoldingTime() { return 0 }
    get holdingPercentage() { return 0 }
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

const getElement = (selector, parent) => {
    parent = parent || document
    return parent.querySelector(selector)
}

const getStartBtn = () => getElement('.start-record-btn')
const getStopBtn = () => getElement('.stop-reset-btn')
const getTimeIndicatorEl = () => getElement('.time-indicator')
const getRoundIndicatorEl = () => getElement('.round-indicator')
const getSessionResultsEl = () => getElement('.session-results')
const getSessionResultsLeftEl = () => getElement('.session-results-left')
const getSessionResultsRightEl = () => getElement('.session-results-right')
const getRoundRecordTemplate = () => getElement('#round-record')
const getRoundNumberEl = (el) => getElement('.round-number', el) 
const getRoundResultEl = (el) => getElement('.round-result', el) 

const renderTimeIndicator = (elapsedSec = 0) => {
    const timeLeftSec = ROUND_DURATION === elapsedSec 
        ? ROUND_DURATION
        : ROUND_DURATION - elapsedSec
    getTimeIndicatorEl().textContent = formatTime(timeLeftSec)
}

const renderRoundIndicator = (numberOfRounds = NUMBER_OF_ROUNDS, currentRoundNumber = '-') => {
    getRoundIndicatorEl().textContent = currentRoundNumber + '/' + numberOfRounds
}

const renderSessionResults = (roundNumber, recordSec) => {
    if (!roundNumber && !recordSec) {
        getSessionResultsLeftEl().innerHTML = '' 
        getSessionResultsRightEl().innerHTML = ''
        return
    }
    renderRoundRecord(roundNumber, recordSec)
}

const renderStartBtn = () => {
    const btn = getStartBtn()
    btn.removeEventListener('click', handleClickOnRecordBtn)
    btn.addEventListener('click', handleClickOnStartBtn)
    btn.textContent = 'start'
    btn.disabled = false
}

const renderRecordBtn = (isDisabled) => {
    const btn = getStartBtn()
    btn.removeEventListener('click', handleClickOnStartBtn)
    btn.addEventListener('click', handleClickOnRecordBtn)
    btn.textContent = 'record'
    btn.disabled = isDisabled
}

const renderStopBtn = (isDisabled) => {
    const btn = getStopBtn()
    btn.removeEventListener('click', handleClickOnResetBtn)
    btn.addEventListener('click', handleClickOnStopBtn)
    btn.textContent = 'stop'
    btn.disabled = isDisabled
}

const renderResetBtn = () => {
    const btn = getStopBtn()
    btn.removeEventListener('click', handleClickOnStopBtn)
    btn.addEventListener('click', handleClickOnResetBtn)
    btn.textContent = 'reset'
}

const renderRoundRecord = (roundNumber, recordSec) => {
    const clone = getRoundRecordTemplate().content.cloneNode(true)
    getRoundNumberEl(clone).textContent = roundNumber + '.'
    getRoundResultEl(clone).textContent = formatTime(recordSec)
    roundNumber <= Math.ceil(NUMBER_OF_ROUNDS / 2)
        ? getSessionResultsLeftEl().appendChild(clone)
        : getSessionResultsRightEl().appendChild(clone)
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
