const ROUND_DURATION = 10
const NUMBER_OF_ROUNDS = 3
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
        renderStopBtn()
        renderTimeIndicator()
        renderRoundResult()
        BEEP_SHORT.play()

        session = new Session(
            NUMBER_OF_ROUNDS, 
            ROUND_DURATION, 
            COUNTDOWN_DURATION
        )
        session
            .run()
            .then(() => {
                renderStartBtn()        
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

const logElapsedTime = (elapsedSec) => {
    console.log(formatTime(elapsedSec))
}

const formatTime = (elapsedSec) => {
    let min = Math.floor(elapsedSec / 60)
    let sec = elapsedSec - min * 60
    return formatValue(min) + ':' + formatValue(sec)
}

const formatValue = (value) => {
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

            switchRecordBtn()
            
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
            switchRecordBtn()
            BEEP_SHORT.play()
            renderRoundResult(this.number, this.recordSec)
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

const getStartBtn = () => document.querySelector('.start-btn')
const getRecordBtn = () => document.querySelector('.record-btn')
const getTimeIndicator = () => document.querySelector('.time-indicator')
const getRoundIndicator = () => document.querySelector('.round-indicator')
const getSessionResultsEl = () => document.querySelector('.session-results')

const renderTimeIndicator = (elapsedSec = 0) => {
    const timeLeftSec = ROUND_DURATION === elapsedSec 
        ? ROUND_DURATION
        : ROUND_DURATION - elapsedSec
    getTimeIndicator().textContent = formatTime(timeLeftSec)
}

const renderRoundIndicator = (numberOfRounds = '-', currentRoundNumber = '-') => {
    getRoundIndicator().textContent = currentRoundNumber + '/' + numberOfRounds
}

const renderRoundResult = (roundNumber, recordSec) => {
    if (!roundNumber && !recordSec) {
        getSessionResultsEl().innerHTML = '' 
        return
    }
    const recordEl = document.createElement('div')
    recordEl.innerText = roundNumber + '. ' + formatTime(recordSec)
    getSessionResultsEl().appendChild(recordEl)
}

const renderStopBtn = () => {
    const startBtn = getStartBtn()
    startBtn.removeEventListener('click', handleClickOnStartBtn)
    startBtn.addEventListener('click', handleClickOnStopBtn)
    startBtn.textContent = 'stop'
}

const renderStartBtn = () => {
    const startBtn = getStartBtn()
    startBtn.removeEventListener('click', handleClickOnStopBtn)
    startBtn.addEventListener('click', handleClickOnStartBtn)
    startBtn.textContent = 'start'
}

const switchRecordBtn = (isDisabled) => {
    const btn = getRecordBtn()
    btn.disabled = isDisabled || !btn.disabled
    btn.disabled
        ? btn.removeEventListener('click', handleClickOnRecordBtn)
        : btn.addEventListener('click', handleClickOnRecordBtn)
}

const renderRecordButton = () => {
    const btn = getRecordBtn()
    btn.textContent = 'record'
    switchRecordBtn(true)
}

const init = () => {
    renderRoundIndicator(NUMBER_OF_ROUNDS)
    renderTimeIndicator()
    renderStartBtn()
    renderRecordButton()
    window.addEventListener('keyup', handlePressSpaceBtn)
}

const reset = () => {
    renderRoundIndicator(NUMBER_OF_ROUNDS)
    renderTimeIndicator()
    renderRoundResult()
}
